import { env } from 'cloudflare:workers';
import { createSession, ensureDatabase, errorResponse, sessionCookie, verifyPassword } from '../../../lib/server';

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export async function POST(request:Request) {
  try {
    await ensureDatabase();
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? '').trim().toLowerCase().slice(0,160);
    const password = String(body.password ?? '').slice(0,200);
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) return Response.json({ error:'请输入正确的邮箱和密码' }, { status:400 });

    const now = new Date();
    const attempt = await env.DB.prepare('SELECT failed_count,locked_until FROM login_attempts WHERE email=?').bind(email).first<Record<string, unknown>>();
    if (attempt?.locked_until && new Date(String(attempt.locked_until)) > now) {
      return Response.json({ error:'尝试次数过多，请15分钟后再试' }, { status:429 });
    }

    const user = await env.DB.prepare('SELECT id,email,name,role,status,password_hash,password_salt,must_change_password FROM app_users WHERE lower(email)=lower(?) LIMIT 1')
      .bind(email).first<Record<string, unknown>>();
    const valid = Boolean(user) && await verifyPassword(password,String(user?.password_hash ?? ''),String(user?.password_salt ?? ''));
    if (!valid) {
      const failures = Number(attempt?.failed_count ?? 0) + 1;
      const lockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null;
      await env.DB.prepare(`INSERT INTO login_attempts (email,failed_count,locked_until,updated_at) VALUES (?,?,?,?)
        ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at`)
        .bind(email,failures,lockedUntil,now.toISOString()).run();
      return Response.json({ error:failures >= MAX_FAILURES ? '尝试次数过多，请15分钟后再试' : '邮箱或密码错误' }, { status:401 });
    }
    if (String(user!.status) !== 'active') return Response.json({ error:'账号已停用，请联系陈泽宇' }, { status:403 });

    await env.DB.prepare('DELETE FROM login_attempts WHERE email=?').bind(email).run();
    const session = await createSession(String(user!.id));
    return new Response(JSON.stringify({ user:{ id:String(user!.id),email:String(user!.email),name:String(user!.name),role:String(user!.role),status:String(user!.status),mustChangePassword:Boolean(user!.must_change_password) } }), {
      status:200,
      headers:{ 'content-type':'application/json', 'set-cookie':sessionCookie(session.token,session.maxAge) },
    });
  } catch (error) { return errorResponse(error); }
}
