import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../chatgpt-auth';

export type Role = 'super_admin' | 'employee' | 'manager' | 'finance' | 'owner' | 'cashier';
export type AppUser = { id:string; email:string; name:string; role:Role; status:string; authUserId:string|null };

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    subject TEXT NOT NULL,
    counterparty TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    auth_user_id TEXT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    contact TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    file_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    company_name TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_approvals_transaction_id ON approvals(transaction_id, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON attachments(transaction_id)',
  'CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON app_users(auth_user_id)',
];

export async function ensureDatabase() {
  await env.DB.batch(schemaStatements.map((sql) => env.DB.prepare(sql)));
  await env.DB.prepare("INSERT OR IGNORE INTO company_settings (id,company_name,updated_at) VALUES (1,'abc',?)")
    .bind(new Date().toISOString()).run();
}

export async function requireAppUser(): Promise<AppUser> {
  const identity = await getChatGPTUser();
  if (!identity) throw new Response(JSON.stringify({ error:'请先登录后使用' }), { status:401, headers:{'content-type':'application/json'} });
  await ensureDatabase();
  let row = await env.DB.prepare('SELECT id,auth_user_id,email,name,role,status FROM app_users WHERE auth_user_id = ? OR lower(email) = lower(?) LIMIT 1')
    .bind(identity.userId, identity.email).first<Record<string, unknown>>();
  if (!row) {
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM app_users').first<{count:number}>();
    if (Number(count?.count ?? 0) > 0) throw new Response(JSON.stringify({ error:'您的账号尚未被管理员加入系统' }), { status:403, headers:{'content-type':'application/json'} });
    const id = `USR${Date.now()}`;
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO app_users (id,auth_user_id,email,name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id, identity.userId, identity.email, identity.fullName ?? identity.email, 'super_admin', 'active', now, now).run();
    row = { id, auth_user_id:identity.userId, email:identity.email, name:identity.fullName ?? identity.email, role:'super_admin', status:'active' };
  } else if (!row.auth_user_id) {
    await env.DB.prepare('UPDATE app_users SET auth_user_id = ?, updated_at = ? WHERE id = ?').bind(identity.userId, new Date().toISOString(), row.id).run();
    row.auth_user_id = identity.userId;
  }
  if (row.status !== 'active') throw new Response(JSON.stringify({ error:'您的账号已停用' }), { status:403, headers:{'content-type':'application/json'} });
  return { id:String(row.id), authUserId:row.auth_user_id ? String(row.auth_user_id) : null, email:String(row.email), name:String(row.name), role:row.role as Role, status:String(row.status) };
}

export function requireRole(user: AppUser, roles: Role[]) {
  if (user.role !== 'super_admin' && !roles.includes(user.role)) throw new Response(JSON.stringify({ error:'您没有执行此操作的权限' }), { status:403, headers:{'content-type':'application/json'} });
}

export function makeId(prefix:string) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

export function errorResponse(error:unknown) {
  if (error instanceof Response) return error;
  console.error(error);
  return Response.json({ error:'系统处理失败，请稍后重试' }, { status:500 });
}

export function mapTransaction(row:Record<string, unknown>) {
  return {
    id:String(row.id),
    type:row.type as 'income'|'expense',
    subject:String(row.subject),
    counterparty:String(row.counterparty),
    amount:Number(row.amount_cents) / 100,
    note:String(row.note ?? ''),
    status:String(row.status),
    createdBy:String(row.created_by),
    createdAt:String(row.created_at),
    attachmentCount:Number(row.attachment_count ?? 0),
  };
}
