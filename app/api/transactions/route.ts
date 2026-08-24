import { env } from 'cloudflare:workers';
import { createRecycleRecord, errorResponse, makeId, mapTransaction, notifyRole, requireAppUser, requireRole, writeAudit } from '../../lib/server';

function parseBody(body:Record<string, unknown>) {
  const type = body.type === 'income' ? 'income' : body.type === 'expense' ? 'expense' : null;
  const subject = String(body.subject ?? '').trim();
  const counterparty = String(body.counterparty ?? '').trim();
  const note = String(body.note ?? '').trim();
  const amount = Number(body.amount);
  if (!type || !subject || !counterparty || !Number.isFinite(amount) || amount <= 0 || subject.length > 80 || counterparty.length > 80 || note.length > 500) return null;
  return { type, subject, counterparty, note, amount } as const;
}

export async function GET() {
  try {
    const user = await requireAppUser();
    const statement = user.role === 'employee'
      ? env.DB.prepare(`SELECT t.*, (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id = t.id) AS attachment_count
          FROM transactions t WHERE t.created_by=? ORDER BY t.created_at DESC LIMIT 500`).bind(user.id)
      : env.DB.prepare(`SELECT t.*, (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id = t.id) AS attachment_count
          FROM transactions t ORDER BY t.created_at DESC LIMIT 500`);
    const result = await statement.all();
    return Response.json({ items:result.results.map(mapTransaction) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request:Request) {
  try {
    const user = await requireAppUser();
    const parsed = parseBody(await request.json() as Record<string, unknown>);
    if (!parsed) return Response.json({ error:'请完整填写正确的单据信息' }, { status:400 });
    const now = new Date();
    const id = makeId(parsed.type === 'income' ? 'SK' : 'FK');
    const status = parsed.type === 'income' ? '待财务确认' : '待部门审批';
    await env.DB.batch([
      env.DB.prepare('INSERT INTO transactions (id,type,subject,counterparty,amount_cents,note,status,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id,parsed.type,parsed.subject,parsed.counterparty,Math.round(parsed.amount * 100),parsed.note,status,user.id,now.toISOString()),
      env.DB.prepare('INSERT INTO approvals (id,transaction_id,stage,action,actor_id,actor_name,comment,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(makeId('APR'),id,'申请提交','submitted',user.id,user.name,parsed.note,now.toISOString()),
    ]);
    await writeAudit(user,'新建单据','transaction',id,parsed.subject);
    await notifyRole(parsed.type==='income'?'finance':'manager',parsed.type==='income'?'待确认收款':'待审批付款',`${parsed.subject} · ${parsed.counterparty} · ¥${parsed.amount.toFixed(2)}`);
    return Response.json({ item:{ id,...parsed,status,createdBy:user.id,createdAt:now.toISOString(),attachmentCount:0 } }, { status:201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request:Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? '');
    const parsed = parseBody(body);
    if (!id || !parsed) return Response.json({ error:'请检查修改内容' }, { status:400 });
    const existing = await env.DB.prepare('SELECT created_by,status FROM transactions WHERE id = ?').bind(id).first<Record<string, unknown>>();
    if (!existing) return Response.json({ error:'单据不存在' }, { status:404 });
    const editable = ['待部门审批','待财务确认','已驳回'].includes(String(existing.status));
    if (!editable || (user.role !== 'super_admin' && String(existing.created_by) !== user.id)) return Response.json({ error:'当前状态不能修改，或您没有权限' }, { status:403 });
    const status = parsed.type === 'income' ? '待财务确认' : '待部门审批';
    await env.DB.prepare('UPDATE transactions SET type=?,subject=?,counterparty=?,amount_cents=?,note=?,status=? WHERE id=?')
      .bind(parsed.type,parsed.subject,parsed.counterparty,Math.round(parsed.amount * 100),parsed.note,status,id).run();
    await writeAudit(user,'修改单据','transaction',id,parsed.subject);
    return Response.json({ item:{ id,...parsed,status,createdBy:String(existing.created_by),createdAt:String(body.createdAt ?? ''),attachmentCount:Number(body.attachmentCount ?? 0) } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request:Request) {
  try {
    const user = await requireAppUser();
    requireRole(user, ['super_admin']);
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!id) return Response.json({ error:'缺少单据编号' }, { status:400 });
    const transaction = await env.DB.prepare('SELECT * FROM transactions WHERE id=?').bind(id).first<Record<string,unknown>>();
    if(!transaction)return Response.json({error:'单据不存在'},{status:404});
    const approvals = await env.DB.prepare('SELECT * FROM approvals WHERE transaction_id=?').bind(id).all<Record<string,unknown>>();
    const files = await env.DB.prepare('SELECT * FROM attachments WHERE transaction_id=?').bind(id).all<Record<string,unknown>>();
    await createRecycleRecord(user,'transaction',id,String(transaction.subject),{transaction,approvals:approvals.results,attachments:files.results});
    await env.DB.batch([
      env.DB.prepare('DELETE FROM attachments WHERE transaction_id = ?').bind(id),
      env.DB.prepare('DELETE FROM approvals WHERE transaction_id = ?').bind(id),
      env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id),
    ]);
    await writeAudit(user,'删除单据','transaction',id,String(transaction.subject));
    return Response.json({ ok:true });
  } catch (error) { return errorResponse(error); }
}
