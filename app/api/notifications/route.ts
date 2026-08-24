import { env } from 'cloudflare:workers';
import { addNotification, errorResponse, requireAppUser, requireRole, sendExternalNotification, writeAudit } from '../../lib/server';

export async function PATCH(request:Request){
  try{const user=await requireAppUser();const body=await request.json() as Record<string,unknown>;const id=String(body.id??'');if(id==='all')await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(new Date().toISOString(),user.id).run();else await env.DB.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(new Date().toISOString(),id,user.id).run();return Response.json({ok:true})}catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  try{const user=await requireAppUser();requireRole(user,['super_admin']);const body=await request.json() as Record<string,unknown>;const action=String(body.action??'');
    if(action==='settings'){
      const current=await env.DB.prepare('SELECT * FROM notification_settings WHERE id=1').first<Record<string,unknown>>();const pick=(key:string)=>{const value=String(body[key]??'').trim();return value||String(current?.[key]??'')};const email=pick('email_webhook');const wechat=pick('wechat_webhook');const dingtalk=pick('dingtalk_webhook');
      for(const url of [email,wechat,dingtalk])if(url&&!url.startsWith('https://'))return Response.json({error:'通知地址必须以 https:// 开头'},{status:400});
      const now=new Date().toISOString();await env.DB.prepare('UPDATE notification_settings SET email_webhook=?,wechat_webhook=?,dingtalk_webhook=?,email_enabled=?,wechat_enabled=?,dingtalk_enabled=?,updated_at=? WHERE id=1').bind(email,wechat,dingtalk,body.emailEnabled?1:0,body.wechatEnabled?1:0,body.dingtalkEnabled?1:0,now).run();await writeAudit(user,'修改通知配置','notification_settings','1','外部通知渠道');return Response.json({ok:true});
    }
    if(action==='test'){await addNotification(user.id,'通知测试','站内消息渠道工作正常。','test');await sendExternalNotification('衡账通知测试','外部通知渠道配置成功。');return Response.json({message:'测试消息已发送'})}
    return Response.json({error:'不支持的通知操作'},{status:400});
  }catch(error){return errorResponse(error)}
}
