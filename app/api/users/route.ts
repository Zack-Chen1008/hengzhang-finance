import { env } from 'cloudflare:workers';
import { errorResponse, hashPassword, INITIAL_PASSWORD, makeId, requireAppUser, requireRole, Role } from '../../lib/server';

const roles:Role[] = ['employee','manager','finance','owner','cashier','super_admin'];
const assignableRoles:Role[] = ['employee','manager','finance','owner','cashier'];

export async function POST(request:Request) {
  try {
    const current = await requireAppUser();
    requireRole(current,['super_admin']);
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const role = String(body.role ?? '') as Role;
    if (!/^\S+@\S+\.\S+$/.test(email) || !name || name.length > 50 || !assignableRoles.includes(role)) return Response.json({ error:'请填写正确的姓名、邮箱和岗位' }, { status:400 });
    const id = makeId('USR');
    const now = new Date().toISOString();
    const password = await hashPassword(INITIAL_PASSWORD);
    try {
      await env.DB.prepare('INSERT INTO app_users (id,auth_user_id,email,name,role,status,password_hash,password_salt,must_change_password,created_at,updated_at) VALUES (?,NULL,?,?,?,?,?,?,1,?,?)')
        .bind(id,email,name,role,'active',password.hash,password.salt,now,now).run();
    } catch {
      return Response.json({ error:'该邮箱已经存在' }, { status:409 });
    }
    return Response.json({ item:{ id,email,name,role,status:'active',mustChangePassword:true,createdAt:now }, initialPassword:INITIAL_PASSWORD }, { status:201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request:Request) {
  try {
    const current = await requireAppUser();
    requireRole(current,['super_admin']);
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? '');
    const name = String(body.name ?? '').trim();
    const role = String(body.role ?? '') as Role;
    const status = body.status === 'disabled' ? 'disabled' : 'active';
    if (!id || !name || !roles.includes(role)) return Response.json({ error:'修改内容不完整' }, { status:400 });
    if (id !== current.id && role === 'super_admin') return Response.json({ error:'陈泽宇是唯一的超级管理员' }, { status:400 });
    if (id === current.id && (role !== 'super_admin' || status !== 'active')) return Response.json({ error:'不能停用自己或取消自己的超级管理员权限' }, { status:400 });
    await env.DB.prepare('UPDATE app_users SET name=?,role=?,status=?,updated_at=? WHERE id=?').bind(name,role,status,new Date().toISOString(),id).run();
    if (status === 'disabled') await env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(id).run();
    return Response.json({ ok:true });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request:Request) {
  try {
    const current = await requireAppUser();
    requireRole(current,['super_admin']);
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!id || id === current.id) return Response.json({ error:'不能删除当前登录账号' }, { status:400 });
    await env.DB.batch([
      env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM password_reset_requests WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM app_users WHERE id=?').bind(id),
    ]);
    return Response.json({ ok:true });
  } catch (error) { return errorResponse(error); }
}
