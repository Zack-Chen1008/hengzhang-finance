import { env } from 'cloudflare:workers';
import { createRecycleRecord, errorResponse, makeId, mapTransaction, notifyRole, requireAppUser, requireRole, writeAudit } from '../../lib/server';
import { transactionScopeSql } from '../../lib/workflow';

function parseBody(body:Record<string,unknown>) {
  const type=body.type==='income'?'income':body.type==='expense'?'expense':null;
  const subject=String(body.subject??'').trim();
  const counterparty=String(body.counterparty??'').trim();
  const note=String(body.note??'').trim();
  const amount=Number(body.amount);
  const accountId=String(body.accountId??'').trim();
  const departmentId=String(body.departmentId??'').trim();
  const projectId=String(body.projectId??'').trim()||null;
  const categoryId=String(body.categoryId??'').trim();
  if(!type||!subject||!counterparty||!accountId||!departmentId||!categoryId||!Number.isFinite(amount)||amount<=0||subject.length>80||counterparty.length>80||note.length>500)return null;
  return {type,subject,counterparty,note,amount,accountId,departmentId,projectId,categoryId} as const;
}

async function validateOrganization(parsed:NonNullable<ReturnType<typeof parseBody>>) {
  const ids=[parsed.accountId,parsed.departmentId,parsed.categoryId,...(parsed.projectId?[parsed.projectId]:[])];
  const placeholders=ids.map(()=>'?').join(',');
  const result=await env.DB.prepare(`SELECT id,kind FROM organization_items WHERE status='active' AND id IN (${placeholders})`).bind(...ids).all<Record<string,unknown>>();
  const kinds=new Map(result.results.map((row)=>[String(row.id),String(row.kind)]));
  if(!['bank','cash'].includes(kinds.get(parsed.accountId)??''))return '请选择有效的银行或现金账户';
  if(kinds.get(parsed.departmentId)!=='department')return '请选择有效部门';
  if(parsed.projectId&&kinds.get(parsed.projectId)!=='project')return '请选择有效项目';
  const categoryKind=parsed.type==='income'?'income_category':'expense_category';
  if(kinds.get(parsed.categoryId)!==categoryKind)return parsed.type==='income'?'请选择有效收入分类':'请选择有效支出分类';
  return null;
}

export async function GET() {
  try {
    const user=await requireAppUser();const scope=transactionScopeSql(user);
    const statement=env.DB.prepare(`SELECT t.*, (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id=t.id) AS attachment_count FROM transactions t${scope.sql} ORDER BY t.created_at DESC LIMIT 500`);
    const result=scope.values.length?await statement.bind(...scope.values).all():await statement.all();
    return Response.json({items:result.results.map(mapTransaction)});
  } catch(error){return errorResponse(error)}
}

export async function POST(request:Request) {
  try {
    const user=await requireAppUser();const parsed=parseBody(await request.json() as Record<string,unknown>);
    if(!parsed)return Response.json({error:'请完整填写账户、部门、分类和单据信息'},{status:400});
    const departmentId=['employee','manager'].includes(user.role)?user.departmentId:parsed.departmentId;
    if(!departmentId)return Response.json({error:'请管理员先为您的账号分配部门'},{status:400});
    const normalized={...parsed,departmentId};const validationError=await validateOrganization(normalized);
    if(validationError)return Response.json({error:validationError},{status:400});
    const now=new Date();const id=makeId(parsed.type==='income'?'SK':'FK');const status=parsed.type==='income'?'待财务确认':'待部门审批';
    await env.DB.batch([
      env.DB.prepare('INSERT INTO transactions (id,type,subject,counterparty,amount_cents,note,status,created_by,account_id,department_id,project_id,category_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id,parsed.type,parsed.subject,parsed.counterparty,Math.round(parsed.amount*100),parsed.note,status,user.id,parsed.accountId,departmentId,parsed.projectId,parsed.categoryId,now.toISOString()),
      env.DB.prepare('INSERT INTO approvals (id,transaction_id,stage,action,actor_id,actor_name,comment,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(makeId('APR'),id,'申请提交','submitted',user.id,user.name,parsed.note,now.toISOString()),
    ]);
    await writeAudit(user,'新建单据','transaction',id,parsed.subject);
    await notifyRole(parsed.type==='income'?'finance':'manager',parsed.type==='income'?'待确认收款':'待审批付款',`${parsed.subject} · ${parsed.counterparty} · ¥${parsed.amount.toFixed(2)}`,'workflow',departmentId);
    return Response.json({item:{id,...normalized,status,createdBy:user.id,createdAt:now.toISOString(),attachmentCount:0}},{status:201});
  } catch(error){return errorResponse(error)}
}

export async function PATCH(request:Request) {
  try {
    const user=await requireAppUser();const body=await request.json() as Record<string,unknown>;const id=String(body.id??'');const parsed=parseBody(body);
    if(!id||!parsed)return Response.json({error:'请检查修改内容，账户、部门和分类不能为空'},{status:400});
    const existing=await env.DB.prepare('SELECT created_by,status,department_id FROM transactions WHERE id=?').bind(id).first<Record<string,unknown>>();
    if(!existing)return Response.json({error:'单据不存在'},{status:404});
    const editable=['待部门审批','待财务确认','已驳回'].includes(String(existing.status));
    if(!editable||(user.role!=='super_admin'&&String(existing.created_by)!==user.id))return Response.json({error:'当前状态不能修改，或您没有权限'},{status:403});
    const departmentId=['employee','manager'].includes(user.role)?user.departmentId:parsed.departmentId;
    if(!departmentId)return Response.json({error:'请管理员先为您的账号分配部门'},{status:400});
    const normalized={...parsed,departmentId};const validationError=await validateOrganization(normalized);
    if(validationError)return Response.json({error:validationError},{status:400});
    const status=parsed.type==='income'?'待财务确认':'待部门审批';
    await env.DB.prepare('UPDATE transactions SET type=?,subject=?,counterparty=?,amount_cents=?,note=?,status=?,account_id=?,department_id=?,project_id=?,category_id=? WHERE id=?')
      .bind(parsed.type,parsed.subject,parsed.counterparty,Math.round(parsed.amount*100),parsed.note,status,parsed.accountId,departmentId,parsed.projectId,parsed.categoryId,id).run();
    await writeAudit(user,'修改单据','transaction',id,parsed.subject);
    return Response.json({item:{id,...normalized,status,createdBy:String(existing.created_by),createdAt:String(body.createdAt??''),attachmentCount:Number(body.attachmentCount??0)}});
  } catch(error){return errorResponse(error)}
}

export async function DELETE(request:Request) {
  try {
    const user=await requireAppUser();requireRole(user,['super_admin']);const id=new URL(request.url).searchParams.get('id')??'';
    if(!id)return Response.json({error:'缺少单据编号'},{status:400});
    const transaction=await env.DB.prepare('SELECT * FROM transactions WHERE id=?').bind(id).first<Record<string,unknown>>();if(!transaction)return Response.json({error:'单据不存在'},{status:404});
    const approvals=await env.DB.prepare('SELECT * FROM approvals WHERE transaction_id=?').bind(id).all<Record<string,unknown>>();const files=await env.DB.prepare('SELECT * FROM attachments WHERE transaction_id=?').bind(id).all<Record<string,unknown>>();
    await createRecycleRecord(user,'transaction',id,String(transaction.subject),{transaction,approvals:approvals.results,attachments:files.results});
    await env.DB.batch([env.DB.prepare('DELETE FROM attachments WHERE transaction_id=?').bind(id),env.DB.prepare('DELETE FROM approvals WHERE transaction_id=?').bind(id),env.DB.prepare('DELETE FROM transactions WHERE id=?').bind(id)]);
    await writeAudit(user,'删除单据','transaction',id,String(transaction.subject));return Response.json({ok:true});
  } catch(error){return errorResponse(error)}
}
