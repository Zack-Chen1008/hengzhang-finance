import { env } from 'cloudflare:workers';
import { errorResponse, makeId, requireAppUser, Role } from '../../lib/server';

const stages:Record<string,{role:Role; next:string}> = {
  '待部门审批': { role:'manager', next:'待财务复核' },
  '待财务复核': { role:'finance', next:'待老板审批' },
  '待老板审批': { role:'owner', next:'待出纳付款' },
  '待出纳付款': { role:'cashier', next:'已完成' },
  '待财务确认': { role:'finance', next:'已完成' },
  '审批中': { role:'manager', next:'待财务复核' },
  '待确认': { role:'finance', next:'已完成' },
  '待付款': { role:'cashier', next:'已完成' },
};

export async function POST(request:Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json() as Record<string, unknown>;
    const transactionId = String(body.transactionId ?? '');
    const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : null;
    const comment = String(body.comment ?? '').trim().slice(0,300);
    if (!transactionId || !action) return Response.json({ error:'审批参数不完整' }, { status:400 });
    const transaction = await env.DB.prepare('SELECT status FROM transactions WHERE id = ?').bind(transactionId).first<Record<string, unknown>>();
    if (!transaction) return Response.json({ error:'单据不存在' }, { status:404 });
    const currentStatus = String(transaction.status);
    const stage = stages[currentStatus];
    if (!stage) return Response.json({ error:'当前单据不需要审批' }, { status:400 });
    if (user.role !== 'super_admin' && user.role !== stage.role) return Response.json({ error:'当前环节不属于您的岗位' }, { status:403 });
    const nextStatus = action === 'approve' ? stage.next : '已驳回';
    const now = new Date().toISOString();
    const approvalId = makeId('APR');
    await env.DB.batch([
      env.DB.prepare('UPDATE transactions SET status = ? WHERE id = ?').bind(nextStatus,transactionId),
      env.DB.prepare('INSERT INTO approvals (id,transaction_id,stage,action,actor_id,actor_name,comment,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(approvalId,transactionId,currentStatus,action,user.id,user.name,comment,now),
    ]);
    return Response.json({ status:nextStatus, approval:{ id:approvalId,transactionId,stage:currentStatus,action,actorName:user.name,comment,createdAt:now } });
  } catch (error) { return errorResponse(error); }
}
