import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';

type StoredTransaction = { id:string; type:'income'|'expense'; subject:string; counterparty:string; amount:number; status:string };

async function ensureDatabase() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    subject TEXT NOT NULL,
    counterparty TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)').run();
}

function rowToItem(row: Record<string, unknown>): StoredTransaction {
  return { id:String(row.id), type:row.type as 'income'|'expense', subject:String(row.subject), counterparty:String(row.counterparty), amount:Number(row.amount_cents) / 100, status:String(row.status) };
}

export async function GET() {
  await ensureDatabase();
  const result = await env.DB.prepare('SELECT id, type, subject, counterparty, amount_cents, status FROM transactions ORDER BY created_at DESC LIMIT 30').all();
  return Response.json({ items: result.results.map(rowToItem) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error:'请先登录' }, { status:401 });
  const body = await request.json() as Record<string, unknown>;
  const type = body.type === 'income' ? 'income' : body.type === 'expense' ? 'expense' : null;
  const subject = String(body.subject ?? '').trim();
  const counterparty = String(body.counterparty ?? '').trim();
  const note = String(body.note ?? '').trim();
  const amount = Number(body.amount);
  if (!type || !subject || !counterparty || !Number.isFinite(amount) || amount <= 0 || subject.length > 50 || counterparty.length > 60 || note.length > 200) {
    return Response.json({ error:'请检查填写内容' }, { status:400 });
  }
  await ensureDatabase();
  const now = new Date();
  const prefix = type === 'income' ? 'SK' : 'FK';
  const id = `${prefix}${now.toISOString().slice(0,10).replaceAll('-','')}${String(Date.now()).slice(-6)}`;
  const status = type === 'income' ? '待确认' : '审批中';
  await env.DB.prepare('INSERT INTO transactions (id,type,subject,counterparty,amount_cents,note,status,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id,type,subject,counterparty,Math.round(amount * 100),note,status,user.userId,now.toISOString()).run();
  return Response.json({ item:{ id,type,subject,counterparty,amount,status } }, { status:201 });
}
