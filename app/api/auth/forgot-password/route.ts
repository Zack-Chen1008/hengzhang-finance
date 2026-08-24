import { env } from 'cloudflare:workers';
import { ensureDatabase, errorResponse, makeId } from '../../../lib/server';

export async function POST(request:Request) {
  try {
    await ensureDatabase();
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? '').trim().toLowerCase().slice(0,160);
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error:'请输入正确的邮箱' }, { status:400 });
    const user = await env.DB.prepare("SELECT id FROM app_users WHERE lower(email)=lower(?) AND status='active' LIMIT 1").bind(email).first<Record<string, unknown>>();
    if (user) {
      const now = new Date().toISOString();
      const pending = await env.DB.prepare("SELECT id FROM password_reset_requests WHERE user_id=? AND status='pending' LIMIT 1").bind(String(user.id)).first<Record<string, unknown>>();
      if (pending) await env.DB.prepare('UPDATE password_reset_requests SET requested_at=? WHERE id=?').bind(now,String(pending.id)).run();
      else await env.DB.prepare("INSERT INTO password_reset_requests (id,user_id,status,requested_at) VALUES (?,?,'pending',?)").bind(makeId('PWD'),String(user.id),now).run();
    }
    return Response.json({ message:'申请已提交。请联系陈泽宇在人员管理中重置密码。' });
  } catch (error) { return errorResponse(error); }
}
