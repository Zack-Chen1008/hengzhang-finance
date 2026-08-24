import { env } from 'cloudflare:workers';
import { createRecycleRecord, errorResponse, makeId, requireAppUser, requireRole, writeAudit } from '../../lib/server';
import { canAccessTransaction } from '../../lib/workflow';

const allowedExtensions = ['jpg','jpeg','png','webp','pdf','doc','docx','xls','xlsx'];

export async function POST(request:Request) {
  try {
    const user = await requireAppUser();
    const form = await request.formData();
    const file = form.get('file');
    const transactionId = String(form.get('transactionId') ?? '');
    if (!(file instanceof File) || !transactionId) return Response.json({ error:'请选择文件和关联单据' }, { status:400 });
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowedExtensions.includes(extension)) return Response.json({ error:'只支持图片、PDF、Word 和 Excel 文件' }, { status:400 });
    if (file.size <= 0 || file.size > 20 * 1024 * 1024) return Response.json({ error:'单个附件不能超过 20MB' }, { status:400 });
    const transaction = await env.DB.prepare('SELECT id,created_by,department_id FROM transactions WHERE id=?').bind(transactionId).first<Record<string,unknown>>();
    if (!transaction) return Response.json({ error:'关联单据不存在' }, { status:404 });
    if (!canAccessTransaction(user,String(transaction.created_by),transaction.department_id?String(transaction.department_id):null)) return Response.json({ error:'您不能给无权查看的单据上传附件' }, { status:403 });
    const id = makeId('ATT');
    const safeName = file.name.replace(/[\\/\x00-\x1F]/g,'_').slice(0,180);
    const key = `transactions/${transactionId}/${id}-${safeName}`;
    await env.FILES.put(key,await file.arrayBuffer(),{ httpMetadata:{ contentType:file.type || 'application/octet-stream' } });
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO attachments (id,transaction_id,file_key,filename,content_type,size,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id,transactionId,key,safeName,file.type || 'application/octet-stream',file.size,user.id,now).run();
    await writeAudit(user,'上传附件','attachment',id,safeName);
    return Response.json({ item:{ id,transactionId,filename:safeName,contentType:file.type,size:file.size,createdAt:now } }, { status:201 });
  } catch (error) { return errorResponse(error); }
}

export async function GET(request:Request) {
  try {
    const user = await requireAppUser();
    const id = new URL(request.url).searchParams.get('id') ?? '';
    const row = await env.DB.prepare('SELECT a.file_key,a.filename,a.content_type,t.created_by,t.department_id FROM attachments a JOIN transactions t ON t.id=a.transaction_id WHERE a.id=?').bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error:'附件不存在' }, { status:404 });
    if (!canAccessTransaction(user,String(row.created_by),row.department_id?String(row.department_id):null)) return Response.json({ error:'您没有查看该附件的权限' }, { status:403 });
    const object = await env.FILES.get(String(row.file_key));
    if (!object) return Response.json({ error:'附件文件不存在' }, { status:404 });
    return new Response(object.body,{ headers:{ 'content-type':String(row.content_type), 'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(String(row.filename))}` } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request:Request) {
  try {
    const user = await requireAppUser();
    requireRole(user,['finance']);
    const id = new URL(request.url).searchParams.get('id') ?? '';
    const row = await env.DB.prepare('SELECT * FROM attachments WHERE id=?').bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({error:'附件不存在'},{status:404});
    await createRecycleRecord(user,'attachment',id,String(row.filename),row);
    await env.DB.prepare('DELETE FROM attachments WHERE id=?').bind(id).run();
    await writeAudit(user,'删除附件','attachment',id,String(row.filename));
    return Response.json({ ok:true });
  } catch (error) { return errorResponse(error); }
}
