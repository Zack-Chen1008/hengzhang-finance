import { env } from 'cloudflare:workers';
import { errorResponse, hashPassword, INITIAL_PASSWORD, requireAppUser, requireRole, writeAudit } from '../../../lib/server';

export async function POST(request:Request) {
  try {
    const current = await requireAppUser();
    requireRole(current,['super_admin']);
    const body = await request.json() as Record<string, unknown>;
    const userId = String(body.userId ?? '');
    if (!userId || userId === current.id) return Response.json({ error:'不能在这里重置当前登录账号' }, { status:400 });
    const target = await env.DB.prepare('SELECT id FROM app_users WHERE id=?').bind(userId).first();
    if (!target) return Response.json({ error:'账号不存在' }, { status:404 });
    const password = await hashPassword(INITIAL_PASSWORD);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE app_users SET password_hash=?,password_salt=?,must_change_password=1,updated_at=? WHERE id=?').bind(password.hash,password.salt,now,userId),
      env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(userId),
      env.DB.prepare("UPDATE password_reset_requests SET status='processed',processed_at=?,processed_by=? WHERE user_id=? AND status='pending'").bind(now,current.id,userId),
    ]);
    await writeAudit(current,'管理员重置密码','user',userId,'重置为初始密码并要求首次改密');
    return Response.json({ message:'密码已重置为123456，该账号下次登录必须修改密码。' });
  } catch (error) { return errorResponse(error); }
}
