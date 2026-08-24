import { env } from 'cloudflare:workers';
import { errorResponse, makeId, requireAppUser, requireRole } from '../../lib/server';

function parse(body:Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  const kind = ['customer','supplier','both'].includes(String(body.kind)) ? String(body.kind) : '';
  const contact = String(body.contact ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const note = String(body.note ?? '').trim();
  if (!name || !kind || name.length > 80 || contact.length > 50 || phone.length > 30 || note.length > 300) return null;
  return { name,kind,contact,phone,note };
}

export async function POST(request:Request) {
  try {
    const user = await requireAppUser();
    requireRole(user,['finance','owner']);
    const item = parse(await request.json() as Record<string, unknown>);
    if (!item) return Response.json({ error:'请完整填写往来单位信息' }, { status:400 });
    const id = makeId('PAR'); const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO partners (id,name,kind,contact,phone,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id,item.name,item.kind,item.contact,item.phone,item.note,now,now).run();
    return Response.json({ item:{ id,...item,createdAt:now,updatedAt:now } }, { status:201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request:Request) {
  try {
    const user = await requireAppUser();
    requireRole(user,['finance','owner']);
    const body = await request.json() as Record<string, unknown>; const id = String(body.id ?? ''); const item = parse(body);
    if (!id || !item) return Response.json({ error:'修改内容不完整' }, { status:400 });
    const updatedAt = new Date().toISOString();
    await env.DB.prepare('UPDATE partners SET name=?,kind=?,contact=?,phone=?,note=?,updated_at=? WHERE id=?')
      .bind(item.name,item.kind,item.contact,item.phone,item.note,updatedAt,id).run();
    return Response.json({ item:{ id,...item,updatedAt } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request:Request) {
  try {
    const user = await requireAppUser();
    requireRole(user,['finance','owner']);
    const id = new URL(request.url).searchParams.get('id') ?? '';
    await env.DB.prepare('DELETE FROM partners WHERE id=?').bind(id).run();
    return Response.json({ ok:true });
  } catch (error) { return errorResponse(error); }
}
