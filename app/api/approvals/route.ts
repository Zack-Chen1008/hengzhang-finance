import { env } from 'cloudflare:workers';
import { addNotification, errorResponse, makeId, notifyRole, requireAppUser, writeAudit } from '../../lib/server';
import { approvalStages, canApproveTransaction, nextApprovalStatus } from '../../lib/workflow';

export async function POST(request:Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json() as Record<string, unknown>;
    const transactionId = String(body.transactionId ?? '');
    const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : null;
    const comment = String(body.comment ?? '').trim().slice(0,300);
    if (!transactionId || !action) return Response.json({ error:'审批参数不完整' }, { status:400 });
    const transaction = await env.DB.prepare('SELECT status,subject,created_by,department_id FROM transactions WHERE id = ?').bind(transactionId).first<Record<string, unknown>>();
    if (!transaction) return Response.json({ error:'单据不存在' }, { status:404 });
    const currentStatus = String(transaction.status);
    const stage = approvalStages[currentStatus];
    if (!stage) return Response.json({ error:'当前单据不需要审批' }, { status:400 });
    if (!canApproveTransaction(user,currentStatus,transaction.department_id?String(transaction.department_id):null)) return Response.json({ error:user.role==='manager'?'只能审批本部门单据':'当前环节不属于您的岗位' }, { status:403 });
    const nextStatus = nextApprovalStatus(currentStatus,action)!;
    const now = new Date().toISOString();
    const approvalId = makeId('APR');
    await env.DB.batch([
      env.DB.prepare('UPDATE transactions SET status = ? WHERE id = ?').bind(nextStatus,transactionId),
      env.DB.prepare('INSERT INTO approvals (id,transaction_id,stage,action,actor_id,actor_name,comment,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(approvalId,transactionId,currentStatus,action,user.id,user.name,comment,now),
    ]);
    await writeAudit(user,action==='approve'?'通过审批':'驳回单据','transaction',transactionId,comment||currentStatus);
    if(action==='reject')await addNotification(String(transaction.created_by),'单据已驳回',`${String(transaction.subject)}：${comment||'请修改后重新提交'}`,'workflow');
    else {
      const nextRole=approvalStages[nextStatus]?.role;if(nextRole)await notifyRole(nextRole,'新的审批任务',`${String(transaction.subject)} · 当前环节：${nextStatus}`,'workflow',transaction.department_id?String(transaction.department_id):null);
      else await addNotification(String(transaction.created_by),'单据流程已完成',String(transaction.subject),'workflow');
    }
    return Response.json({ status:nextStatus, approval:{ id:approvalId,transactionId,stage:currentStatus,action,actorName:user.name,comment,createdAt:now } });
  } catch (error) { return errorResponse(error); }
}
