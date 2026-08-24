import { env } from 'cloudflare:workers';
import { errorResponse, mapTransaction, requireAppUser } from '../../lib/server';

export async function GET() {
  try {
    const currentUser = await requireAppUser();
    const [company, users, partners, transactions, approvals, attachments] = await Promise.all([
      env.DB.prepare('SELECT company_name FROM company_settings WHERE id = 1').first<Record<string, unknown>>(),
      env.DB.prepare('SELECT id,email,name,role,status,created_at FROM app_users ORDER BY created_at').all(),
      env.DB.prepare('SELECT id,name,kind,contact,phone,note,created_at,updated_at FROM partners ORDER BY updated_at DESC').all(),
      env.DB.prepare(`SELECT t.*, (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id = t.id) AS attachment_count
        FROM transactions t ORDER BY t.created_at DESC LIMIT 500`).all(),
      env.DB.prepare('SELECT id,transaction_id,stage,action,actor_id,actor_name,comment,created_at FROM approvals ORDER BY created_at DESC LIMIT 1000').all(),
      env.DB.prepare('SELECT id,transaction_id,filename,content_type,size,created_at FROM attachments ORDER BY created_at DESC LIMIT 1000').all(),
    ]);
    return Response.json({
      companyName:String(company?.company_name ?? 'abc'),
      currentUser,
      users:users.results.map((row) => ({ id:String(row.id), email:String(row.email), name:String(row.name), role:String(row.role), status:String(row.status), createdAt:String(row.created_at) })),
      partners:partners.results.map((row) => ({ id:String(row.id), name:String(row.name), kind:String(row.kind), contact:String(row.contact), phone:String(row.phone), note:String(row.note), createdAt:String(row.created_at), updatedAt:String(row.updated_at) })),
      transactions:transactions.results.map(mapTransaction),
      approvals:approvals.results.map((row) => ({ id:String(row.id), transactionId:String(row.transaction_id), stage:String(row.stage), action:String(row.action), actorName:String(row.actor_name), comment:String(row.comment), createdAt:String(row.created_at) })),
      attachments:attachments.results.map((row) => ({ id:String(row.id), transactionId:String(row.transaction_id), filename:String(row.filename), contentType:String(row.content_type), size:Number(row.size), createdAt:String(row.created_at) })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
