import { env } from 'cloudflare:workers';
import { createRecycleRecord, errorResponse, makeId, requireAppUser, requireRole, writeAudit } from '../../lib/server';

function amountCents(value:unknown){const amount=Number(value);return Number.isFinite(amount)&&amount>0?Math.round(amount*100):0}
function dateValue(value:unknown){const text=String(value??'');return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:''}

export async function POST(request:Request){
  try{
    const user=await requireAppUser();requireRole(user,['finance','owner','cashier']);const body=await request.json() as Record<string,unknown>;const entity=String(body.entity??'');const now=new Date().toISOString();
    if(entity==='invoice'){
      requireRole(user,['finance','owner']);const kind=['receivable','payable'].includes(String(body.kind))?String(body.kind):'';const number=String(body.invoiceNumber??'').trim();const counterparty=String(body.counterparty??'').trim();const cents=amountCents(body.amount);const issueDate=dateValue(body.issueDate);const dueDate=dateValue(body.dueDate)||null;const note=String(body.note??'').trim();
      if(!kind||!number||!counterparty||!cents||!issueDate)return Response.json({error:'请完整填写发票信息'},{status:400});const id=makeId('INV');
      try{await env.DB.prepare("INSERT INTO invoices (id,kind,invoice_number,counterparty,amount_cents,issue_date,due_date,status,note,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'unpaid',?,?,?,?)").bind(id,kind,number,counterparty,cents,issueDate,dueDate,note,user.id,now,now).run()}catch{return Response.json({error:'发票号码已存在'},{status:409})}
      await writeAudit(user,'新增发票','invoice',id,number);return Response.json({ok:true},{status:201});
    }
    if(entity==='plan'){
      const kind=['receivable','payable'].includes(String(body.kind))?String(body.kind):'';const subject=String(body.subject??'').trim();const counterparty=String(body.counterparty??'').trim();const cents=amountCents(body.amount);const dueDate=dateValue(body.dueDate);const note=String(body.note??'').trim();
      if(!kind||!subject||!counterparty||!cents||!dueDate)return Response.json({error:'请完整填写收付款计划'},{status:400});const id=makeId('PLN');await env.DB.prepare("INSERT INTO payment_plans (id,kind,subject,counterparty,amount_cents,due_date,status,note,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?,?,?)").bind(id,kind,subject,counterparty,cents,dueDate,note,user.id,now,now).run();await writeAudit(user,'新增付款计划','payment_plan',id,subject);return Response.json({ok:true},{status:201});
    }
    if(entity==='bank_import'){
      requireRole(user,['finance','cashier']);const accountId=String(body.accountId??'');const rows=Array.isArray(body.rows)?body.rows.slice(0,1000) as Record<string,unknown>[]:[];if(!accountId||!rows.length)return Response.json({error:'请选择账户并导入有效流水'},{status:400});
      const statements=[];for(const row of rows){const occurredOn=dateValue(row.date);const amount=Number(row.amount);const description=String(row.description??'').trim();if(!occurredOn||!Number.isFinite(amount)||!description)continue;statements.push(env.DB.prepare("INSERT INTO bank_statement_rows (id,account_id,occurred_on,description,amount_cents,balance_cents,reference,status,imported_by,imported_at) VALUES (?,?,?,?,?,?,?,'unmatched',?,?)").bind(makeId('BNK'),accountId,occurredOn,description,Math.round(amount*100),Number.isFinite(Number(row.balance))?Math.round(Number(row.balance)*100):null,String(row.reference??''),user.id,now))}
      for(let offset=0;offset<statements.length;offset+=50)await env.DB.batch(statements.slice(offset,offset+50));await writeAudit(user,'导入银行流水','bank_statement','batch',`${statements.length}条`);return Response.json({count:statements.length});
    }
    if(entity==='auto_reconcile'){
      requireRole(user,['finance','cashier']);const rows=await env.DB.prepare("SELECT id,amount_cents,occurred_on FROM bank_statement_rows WHERE status='unmatched' ORDER BY occurred_on").all<Record<string,unknown>>();let matched=0;
      for(const row of rows.results){const amount=Number(row.amount_cents);const type=amount>=0?'income':'expense';const transaction=await env.DB.prepare("SELECT id FROM transactions WHERE type=? AND amount_cents=? AND status='已完成' AND abs(julianday(substr(created_at,1,10))-julianday(?))<=3 AND id NOT IN (SELECT transaction_id FROM bank_statement_rows WHERE transaction_id IS NOT NULL) LIMIT 1").bind(type,Math.abs(amount),String(row.occurred_on)).first<Record<string,unknown>>();if(transaction){await env.DB.prepare("UPDATE bank_statement_rows SET status='matched',transaction_id=? WHERE id=?").bind(String(transaction.id),String(row.id)).run();matched+=1}}
      await writeAudit(user,'自动对账','bank_statement','batch',`匹配${matched}条`);return Response.json({matched});
    }
    return Response.json({error:'不支持的财务操作'},{status:400});
  }catch(error){return errorResponse(error)}
}

export async function PATCH(request:Request){
  try{const user=await requireAppUser();requireRole(user,['finance','owner','cashier']);const body=await request.json() as Record<string,unknown>;const entity=String(body.entity??'');const id=String(body.id??'');const status=String(body.status??'');if(!id)return Response.json({error:'缺少记录编号'},{status:400});
    if(entity==='invoice'&&['unpaid','partial','paid','void'].includes(status)){requireRole(user,['finance','owner']);await env.DB.prepare('UPDATE invoices SET status=?,updated_at=? WHERE id=?').bind(status,new Date().toISOString(),id).run();await writeAudit(user,'更新发票状态','invoice',id,status);return Response.json({ok:true})}
    if(entity==='plan'&&['pending','completed','overdue','cancelled'].includes(status)){await env.DB.prepare('UPDATE payment_plans SET status=?,updated_at=? WHERE id=?').bind(status,new Date().toISOString(),id).run();await writeAudit(user,'更新计划状态','payment_plan',id,status);return Response.json({ok:true})}
    return Response.json({error:'状态不正确'},{status:400});
  }catch(error){return errorResponse(error)}
}

export async function DELETE(request:Request){
  try{const user=await requireAppUser();requireRole(user,['finance','owner']);const url=new URL(request.url);const entity=url.searchParams.get('entity')??'';const id=url.searchParams.get('id')??'';const table=entity==='invoice'?'invoices':entity==='plan'?'payment_plans':'';if(!table)return Response.json({error:'删除类型不正确'},{status:400});const row=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first<Record<string,unknown>>();if(!row)return Response.json({error:'记录不存在'},{status:404});await createRecycleRecord(user,entity==='invoice'?'invoice':'payment_plan',id,String(row.invoice_number??row.subject),row);await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();await writeAudit(user,'删除财务记录',entity,id,String(row.invoice_number??row.subject));return Response.json({ok:true})}catch(error){return errorResponse(error)}
}
