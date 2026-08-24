import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

export type Role = 'super_admin' | 'employee' | 'manager' | 'finance' | 'owner' | 'cashier';
export type AppUser = { id:string; email:string; name:string; role:Role; status:string; authUserId:string|null; mustChangePassword:boolean };

export const SESSION_COOKIE = 'hengzhang_session';
export const INITIAL_PASSWORD = '123456';
export const SUPER_ADMIN_EMAIL = 'chenzack1008@gmail.com';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 100_000;
const DEFAULT_ROLE_ACCOUNTS:{id:string;email:string;name:string;role:Role}[] = [
  { id:'USR_DEFAULT_EMPLOYEE',email:'employee@abc.local',name:'普通员工',role:'employee' },
  { id:'USR_DEFAULT_MANAGER',email:'manager@abc.local',name:'部门负责人',role:'manager' },
  { id:'USR_DEFAULT_FINANCE',email:'finance@abc.local',name:'财务',role:'finance' },
  { id:'USR_DEFAULT_OWNER',email:'owner@abc.local',name:'老板',role:'owner' },
  { id:'USR_DEFAULT_CASHIER',email:'cashier@abc.local',name:'出纳',role:'cashier' },
];

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
    password_hash TEXT NOT NULL DEFAULT '',
    password_salt TEXT NOT NULL DEFAULT '',
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TEXT NOT NULL,
    processed_at TEXT,
    processed_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    email TEXT PRIMARY KEY,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
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
  `CREATE TABLE IF NOT EXISTS organization_items (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
    opening_balance_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, invoice_number TEXT NOT NULL UNIQUE,
    counterparty TEXT NOT NULL, amount_cents INTEGER NOT NULL, issue_date TEXT NOT NULL,
    due_date TEXT, status TEXT NOT NULL DEFAULT 'unpaid', transaction_id TEXT,
    note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payment_plans (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, subject TEXT NOT NULL, counterparty TEXT NOT NULL,
    amount_cents INTEGER NOT NULL, due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    invoice_id TEXT, note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bank_statement_rows (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, occurred_on TEXT NOT NULL, description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL, balance_cents INTEGER, reference TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unmatched', transaction_id TEXT, imported_by TEXT NOT NULL, imported_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'system', dedupe_key TEXT UNIQUE, read_at TEXT, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notification_settings (
    id INTEGER PRIMARY KEY CHECK(id=1), email_webhook TEXT NOT NULL DEFAULT '',
    wechat_webhook TEXT NOT NULL DEFAULT '', dingtalk_webhook TEXT NOT NULL DEFAULT '',
    email_enabled INTEGER NOT NULL DEFAULT 0, wechat_enabled INTEGER NOT NULL DEFAULT 0,
    dingtalk_enabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_name TEXT NOT NULL, action TEXT NOT NULL,
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS deleted_records (
    id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL,
    record_json TEXT NOT NULL, deleted_by TEXT NOT NULL, deleted_by_name TEXT NOT NULL, deleted_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, file_key TEXT NOT NULL, size INTEGER NOT NULL,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_approvals_transaction_id ON approvals(transaction_id, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON attachments(transaction_id)',
  'CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON app_users(auth_user_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON auth_sessions(token_hash)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth_sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON auth_sessions(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_reset_requests_status ON password_reset_requests(status, requested_at)',
  'CREATE INDEX IF NOT EXISTS idx_reset_requests_user_id ON password_reset_requests(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_organization_items_kind ON organization_items(kind,status)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)',
  'CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date,status)',
  'CREATE INDEX IF NOT EXISTS idx_payment_plans_due_date ON payment_plans(due_date,status)',
  'CREATE INDEX IF NOT EXISTS idx_bank_statement_account_date ON bank_statement_rows(account_id,occurred_on)',
  'CREATE INDEX IF NOT EXISTS idx_bank_statement_status ON bank_statement_rows(status)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id,read_at,created_at)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(dedupe_key)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type,entity_id)',
  'CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at ON deleted_records(deleted_at)',
  'CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at)',
];

function bytesToBase64Url(bytes:Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

function base64UrlToBytes(value:string) {
  const normalized = value.replaceAll('-','+').replaceAll('_','/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary,(character) => character.charCodeAt(0));
}

async function derivePassword(password:string,salt:Uint8Array) {
  const material = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt).buffer,iterations:PASSWORD_ITERATIONS },material,256);
  return bytesToBase64Url(new Uint8Array(bits));
}

export async function hashPassword(password:string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash:await derivePassword(password,salt), salt:bytesToBase64Url(salt) };
}

export async function verifyPassword(password:string,expectedHash:string,salt:string) {
  if (!expectedHash || !salt) return false;
  const actual = await derivePassword(password,base64UrlToBytes(salt));
  if (actual.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index=0; index<actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  return difference === 0;
}

async function hashSessionToken(token:string) {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function ensureDatabase() {
  await env.DB.batch(schemaStatements.map((sql) => env.DB.prepare(sql)));
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO company_settings (id,company_name,updated_at) VALUES (1,'abc',?)").bind(now).run();
  await env.DB.prepare("INSERT OR IGNORE INTO notification_settings (id,updated_at) VALUES (1,?)").bind(now).run();

  const admin = await env.DB.prepare('SELECT id FROM app_users WHERE lower(email)=lower(?) LIMIT 1')
    .bind(SUPER_ADMIN_EMAIL).first<Record<string, unknown>>();
  if (!admin) {
    const password = await hashPassword(INITIAL_PASSWORD);
    await env.DB.prepare('INSERT INTO app_users (id,auth_user_id,email,name,role,status,password_hash,password_salt,must_change_password,created_at,updated_at) VALUES (?,NULL,?,?,?,?,?,?,1,?,?)')
      .bind('USR_SUPER_ADMIN',SUPER_ADMIN_EMAIL,'陈泽宇','super_admin','active',password.hash,password.salt,now,now).run();
  } else {
    await env.DB.prepare("UPDATE app_users SET name='陈泽宇',role='super_admin',status='active',updated_at=? WHERE id=?").bind(now,String(admin.id)).run();
  }

  for (const account of DEFAULT_ROLE_ACCOUNTS) {
    const exists = await env.DB.prepare('SELECT id FROM app_users WHERE lower(email)=lower(?) LIMIT 1').bind(account.email).first();
    if (!exists) {
      const password = await hashPassword(INITIAL_PASSWORD);
      await env.DB.prepare('INSERT INTO app_users (id,auth_user_id,email,name,role,status,password_hash,password_salt,must_change_password,created_at,updated_at) VALUES (?,NULL,?,?,?,?,?,?,1,?,?)')
        .bind(account.id,account.email,account.name,account.role,'active',password.hash,password.salt,now,now).run();
    }
  }

  const usersWithoutPassword = await env.DB.prepare("SELECT id FROM app_users WHERE password_hash IS NULL OR password_hash='' OR password_salt IS NULL OR password_salt=''").all<Record<string, unknown>>();
  for (const row of usersWithoutPassword.results) {
    const password = await hashPassword(INITIAL_PASSWORD);
    await env.DB.prepare('UPDATE app_users SET password_hash=?,password_salt=?,must_change_password=1,updated_at=? WHERE id=?')
      .bind(password.hash,password.salt,now,String(row.id)).run();
  }

  await env.DB.batch([
    env.DB.prepare("UPDATE transactions SET status = '待部门审批' WHERE status = '审批中'"),
    env.DB.prepare("UPDATE transactions SET status = '待财务确认' WHERE status = '待确认'"),
    env.DB.prepare("UPDATE transactions SET status = '待出纳付款' WHERE status = '待付款'"),
    env.DB.prepare("UPDATE transactions SET status = '已完成' WHERE status = '已到账'"),
    env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now),
  ]);
}

export async function createSession(userId:string) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000);
  await env.DB.prepare('INSERT INTO auth_sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)')
    .bind(makeId('SES'),userId,await hashSessionToken(token),expiresAt.toISOString(),now.toISOString()).run();
  return { token, maxAge:SESSION_SECONDS };
}

export function sessionCookie(token:string,maxAge:number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function currentSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? '';
}

export async function deleteCurrentSession() {
  const token = await currentSessionToken();
  if (token) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hashSessionToken(token)).run();
}

export async function requireAppUser(options:{allowPasswordChange?:boolean} = {}): Promise<AppUser> {
  await ensureDatabase();
  const token = await currentSessionToken();
  if (!token) throw new Response(JSON.stringify({ error:'请先登录', code:'AUTH_REQUIRED' }), { status:401, headers:{'content-type':'application/json'} });
  const row = await env.DB.prepare(`SELECT u.id,u.auth_user_id,u.email,u.name,u.role,u.status,u.must_change_password
    FROM auth_sessions s JOIN app_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(await hashSessionToken(token),new Date().toISOString()).first<Record<string, unknown>>();
  if (!row) throw new Response(JSON.stringify({ error:'登录已失效，请重新登录', code:'AUTH_REQUIRED' }), { status:401, headers:{'content-type':'application/json'} });
  if (row.status !== 'active') throw new Response(JSON.stringify({ error:'您的账号已停用', code:'ACCOUNT_DISABLED' }), { status:403, headers:{'content-type':'application/json'} });
  const user = { id:String(row.id), authUserId:row.auth_user_id ? String(row.auth_user_id) : null, email:String(row.email), name:String(row.name), role:row.role as Role, status:String(row.status), mustChangePassword:Boolean(row.must_change_password) };
  if (user.mustChangePassword && !options.allowPasswordChange) throw new Response(JSON.stringify({ error:'首次登录需要修改密码', code:'PASSWORD_CHANGE_REQUIRED' }), { status:428, headers:{'content-type':'application/json'} });
  return user;
}

export function requireRole(user: AppUser, roles: Role[]) {
  if (user.role !== 'super_admin' && !roles.includes(user.role)) throw new Response(JSON.stringify({ error:'您没有执行此操作的权限' }), { status:403, headers:{'content-type':'application/json'} });
}

export async function writeAudit(user:AppUser,action:string,entityType:string,entityId:string,detail='') {
  await env.DB.prepare('INSERT INTO audit_logs (id,user_id,user_name,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(makeId('LOG'),user.id,user.name,action,entityType,entityId,detail.slice(0,500),new Date().toISOString()).run();
}

export async function createRecycleRecord(user:AppUser,entityType:string,entityId:string,label:string,record:unknown) {
  await env.DB.prepare('INSERT INTO deleted_records (id,entity_type,entity_id,label,record_json,deleted_by,deleted_by_name,deleted_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(makeId('DEL'),entityType,entityId,label.slice(0,120),JSON.stringify(record),user.id,user.name,new Date().toISOString()).run();
}

export async function addNotification(userId:string,title:string,message:string,kind='system',dedupeKey:string|null=null) {
  const statement = env.DB.prepare('INSERT OR IGNORE INTO notifications (id,user_id,title,message,kind,dedupe_key,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(makeId('NOT'),userId,title.slice(0,80),message.slice(0,300),kind,dedupeKey,new Date().toISOString());
  await statement.run();
}

export async function notifyRole(role:Role,title:string,message:string,kind='workflow') {
  const users = await env.DB.prepare("SELECT id FROM app_users WHERE role=? AND status='active'").bind(role).all<Record<string, unknown>>();
  if (users.results.length) await env.DB.batch(users.results.map((row) => env.DB.prepare('INSERT INTO notifications (id,user_id,title,message,kind,created_at) VALUES (?,?,?,?,?,?)')
    .bind(makeId('NOT'),String(row.id),title.slice(0,80),message.slice(0,300),kind,new Date().toISOString())));
  await sendExternalNotification(title,message);
}

export async function sendExternalNotification(title:string,message:string) {
  const settings = await env.DB.prepare('SELECT email_webhook,wechat_webhook,dingtalk_webhook,email_enabled,wechat_enabled,dingtalk_enabled FROM notification_settings WHERE id=1').first<Record<string, unknown>>();
  if (!settings) return;
  const jobs:Promise<unknown>[] = [];
  const post = (url:string,body:unknown) => fetch(url,{ method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body) }).catch(() => null);
  if (settings.email_enabled && String(settings.email_webhook).startsWith('https://')) jobs.push(post(String(settings.email_webhook),{ title,message,source:'衡账' }));
  if (settings.wechat_enabled && String(settings.wechat_webhook).startsWith('https://')) jobs.push(post(String(settings.wechat_webhook),{ msgtype:'text',text:{ content:`【${title}】${message}` } }));
  if (settings.dingtalk_enabled && String(settings.dingtalk_webhook).startsWith('https://')) jobs.push(post(String(settings.dingtalk_webhook),{ msgtype:'text',text:{ content:`【${title}】${message}` } }));
  await Promise.all(jobs);
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
