import { env } from 'cloudflare:workers';
import { createSession, errorResponse, hashPassword, INITIAL_PASSWORD, requireAppUser, sessionCookie, verifyPassword } from '../../../lib/server';

export async function POST(request:Request) {
  try {
    const user = await requireAppUser({ allowPasswordChange:true });
    const body = await request.json() as Record<string, unknown>;
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');
    const confirmPassword = String(body.confirmPassword ?? '');
    if (newPassword.length < 8 || newPassword.length > 100) return Response.json({ error:'新密码至少8位，最多100位' }, { status:400 });
    if (newPassword !== confirmPassword) return Response.json({ error:'两次输入的新密码不一致' }, { status:400 });
    if (newPassword === INITIAL_PASSWORD) return Response.json({ error:'新密码不能继续使用初始密码123456' }, { status:400 });

    if (!user.mustChangePassword) {
      const row = await env.DB.prepare('SELECT password_hash,password_salt FROM app_users WHERE id=?').bind(user.id).first<Record<string, unknown>>();
      if (!row || !await verifyPassword(currentPassword,String(row.password_hash),String(row.password_salt))) return Response.json({ error:'当前密码不正确' }, { status:400 });
    }

    const password = await hashPassword(newPassword);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE app_users SET password_hash=?,password_salt=?,must_change_password=0,updated_at=? WHERE id=?').bind(password.hash,password.salt,now,user.id),
      env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id),
    ]);
    const session = await createSession(user.id);
    return new Response(JSON.stringify({ ok:true }), { status:200, headers:{ 'content-type':'application/json', 'set-cookie':sessionCookie(session.token,session.maxAge) } });
  } catch (error) { return errorResponse(error); }
}
