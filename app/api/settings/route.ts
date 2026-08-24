import { env } from 'cloudflare:workers';
import { createRecycleRecord, errorResponse, makeId, requireAppUser, requireRole, writeAudit } from '../../lib/server';

const kinds = ['bank','cash','department','project','income_category','expense_category'];

function parseItem(body:Record<string,unknown>) {
  const kind=String(body.kind??''); const name=String(body.name??'').trim(); const detail=String(body.detail??'').trim(); const openingBalance=Number(body.openingBalance??0);
  if(!kinds.includes(kind)||!name||name.length>80||detail.length>200||!Number.isFinite(openingBalance))return null;
  return {kind,name,detail,openingBalanceCents:Math.round(openingBalance*100)};
}

export async function POST(request:Request){
  try{
    const user=await requireAppUser();requireRole(user,['super_admin']);const body=await request.json() as Record<string,unknown>;
    if(body.entity==='company'){
      const name=String(body.companyName??'').trim();if(!name||name.length>100)return Response.json({error:'请输入正确的公司名称'},{status:400});
      const now=new Date().toISOString();await env.DB.prepare('UPDATE company_settings SET company_name=?,updated_at=? WHERE id=1').bind(name,now).run();await writeAudit(user,'修改公司名称','company','1',name);return Response.json({companyName:name});
    }
    const item=parseItem(body);if(!item)return Response.json({error:'请完整填写基础参数'},{status:400});
    const id=makeId('CFG');const now=new Date().toISOString();await env.DB.prepare("INSERT INTO organization_items (id,kind,name,detail,opening_balance_cents,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)").bind(id,item.kind,item.name,item.detail,item.openingBalanceCents,now,now).run();
    await writeAudit(user,'新增基础参数','organization_item',id,`${item.kind}:${item.name}`);return Response.json({item:{id,...item,openingBalance:item.openingBalanceCents/100,status:'active',createdAt:now,updatedAt:now}},{status:201});
  }catch(error){return errorResponse(error)}
}

export async function PATCH(request:Request){
  try{
    const user=await requireAppUser();requireRole(user,['super_admin']);const body=await request.json() as Record<string,unknown>;const id=String(body.id??'');const item=parseItem(body);
    if(!id||!item)return Response.json({error:'修改内容不完整'},{status:400});const now=new Date().toISOString();
    await env.DB.prepare('UPDATE organization_items SET kind=?,name=?,detail=?,opening_balance_cents=?,updated_at=? WHERE id=?').bind(item.kind,item.name,item.detail,item.openingBalanceCents,now,id).run();
    await writeAudit(user,'修改基础参数','organization_item',id,item.name);return Response.json({ok:true});
  }catch(error){return errorResponse(error)}
}

export async function DELETE(request:Request){
  try{
    const user=await requireAppUser();requireRole(user,['super_admin']);const id=new URL(request.url).searchParams.get('id')??'';
    const row=await env.DB.prepare('SELECT * FROM organization_items WHERE id=?').bind(id).first<Record<string,unknown>>();if(!row)return Response.json({error:'参数不存在'},{status:404});
    await createRecycleRecord(user,'organization_item',id,String(row.name),row);await env.DB.prepare('DELETE FROM organization_items WHERE id=?').bind(id).run();await writeAudit(user,'删除基础参数','organization_item',id,String(row.name));return Response.json({ok:true});
  }catch(error){return errorResponse(error)}
}
