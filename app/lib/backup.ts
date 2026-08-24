import { env } from 'cloudflare:workers';
import { AppUser, makeId, writeAudit } from './server';

const backupTables = [
  'company_settings','organization_items','transactions','partners','approvals','attachments',
  'invoices','payment_plans','bank_statement_rows','notifications','notification_settings',
] as const;

const restoreColumns:Record<(typeof backupTables)[number],string[]> = {
  company_settings:['id','company_name','updated_at'],
  organization_items:['id','kind','name','detail','opening_balance_cents','status','created_at','updated_at'],
  transactions:['id','type','subject','counterparty','amount_cents','note','status','created_by','created_at'],
  partners:['id','name','kind','contact','phone','note','created_at','updated_at'],
  approvals:['id','transaction_id','stage','action','actor_id','actor_name','comment','created_at'],
  attachments:['id','transaction_id','file_key','filename','content_type','size','uploaded_by','created_at'],
  invoices:['id','kind','invoice_number','counterparty','amount_cents','issue_date','due_date','status','transaction_id','note','created_by','created_at','updated_at'],
  payment_plans:['id','kind','subject','counterparty','amount_cents','due_date','status','invoice_id','note','created_by','created_at','updated_at'],
  bank_statement_rows:['id','account_id','occurred_on','description','amount_cents','balance_cents','reference','status','transaction_id','imported_by','imported_at'],
  notifications:['id','user_id','title','message','kind','dedupe_key','read_at','created_at'],
  notification_settings:['id','email_webhook','wechat_webhook','dingtalk_webhook','email_enabled','wechat_enabled','dingtalk_enabled','updated_at'],
};

export async function createBackup(user:AppUser,kind:'automatic'|'manual'|'pre_restore'='manual') {
  const data:Record<string,unknown[]> = {};
  for (const table of backupTables) data[table] = (await env.DB.prepare(`SELECT * FROM ${table}`).all()).results;
  const createdAt = new Date().toISOString();
  const id = makeId('BAK');
  const payload = JSON.stringify({ version:1,createdAt,createdBy:user.id,data });
  const fileKey = `backups/${createdAt.slice(0,10)}/${id}.json`;
  await env.FILES.put(fileKey,payload,{ httpMetadata:{ contentType:'application/json; charset=utf-8' } });
  await env.DB.prepare('INSERT INTO backups (id,kind,file_key,size,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .bind(id,kind,fileKey,new TextEncoder().encode(payload).byteLength,user.id,createdAt).run();
  await writeAudit(user,'创建备份','backup',id,kind);
  return { id,kind,size:new TextEncoder().encode(payload).byteLength,createdAt };
}

export async function maybeCreateAutomaticBackup(user:AppUser) {
  const today = new Date().toISOString().slice(0,10);
  const exists = await env.DB.prepare("SELECT id FROM backups WHERE kind='automatic' AND substr(created_at,1,10)=? LIMIT 1").bind(today).first();
  if (!exists) await createBackup(user,'automatic');
}

export async function restoreBackup(user:AppUser,backupId:string) {
  const row = await env.DB.prepare('SELECT file_key FROM backups WHERE id=?').bind(backupId).first<Record<string, unknown>>();
  if (!row) throw new Response(JSON.stringify({ error:'备份不存在' }),{ status:404,headers:{'content-type':'application/json'} });
  await createBackup(user,'pre_restore');
  const object = await env.FILES.get(String(row.file_key));
  if (!object) throw new Response(JSON.stringify({ error:'备份文件不存在' }),{ status:404,headers:{'content-type':'application/json'} });
  const parsed = JSON.parse(await object.text()) as {version:number;data:Record<string,Record<string,unknown>[]>};
  if (parsed.version !== 1 || !parsed.data) throw new Response(JSON.stringify({ error:'备份格式不受支持' }),{ status:400,headers:{'content-type':'application/json'} });

  for (const table of backupTables) {
    const rows = Array.isArray(parsed.data[table]) ? parsed.data[table] : [];
    await env.DB.prepare(`DELETE FROM ${table}`).run();
    const columns = restoreColumns[table];
    for (let offset=0; offset<rows.length; offset += 50) {
      const statements = rows.slice(offset,offset+50).map((record) => env.DB.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
        .bind(...columns.map((column) => record[column] ?? null)));
      if (statements.length) await env.DB.batch(statements);
    }
  }
  await writeAudit(user,'恢复备份','backup',backupId,'完整业务数据恢复');
}
