import { env } from 'cloudflare:workers';
import { errorResponse, mapTransaction, requireAppUser } from '../../lib/server';
import { runDailyJobs } from '../../lib/daily';
import { transactionScopeSql } from '../../lib/workflow';

export async function GET() {
  try {
    const currentUser = await requireAppUser();
    await runDailyJobs({DB:env.DB,FILES:env.FILES}).catch((error)=>console.error('daily job fallback failed',error));

    const scope=transactionScopeSql(currentUser);
    const transactionBase=env.DB.prepare(`SELECT t.*, (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id=t.id) AS attachment_count FROM transactions t${scope.sql} ORDER BY t.created_at DESC LIMIT 500`);
    const transactionStatement=scope.values.length?transactionBase.bind(...scope.values):transactionBase;
    const approvalBase=env.DB.prepare(`SELECT a.* FROM approvals a JOIN transactions t ON t.id=a.transaction_id${scope.sql} ORDER BY a.created_at DESC LIMIT 1000`);
    const attachmentBase=env.DB.prepare(`SELECT a.id,a.transaction_id,a.filename,a.content_type,a.size,a.created_at FROM attachments a JOIN transactions t ON t.id=a.transaction_id${scope.sql} ORDER BY a.created_at DESC LIMIT 1000`);
    const approvalStatement=scope.values.length?approvalBase.bind(...scope.values):approvalBase;
    const attachmentStatement=scope.values.length?attachmentBase.bind(...scope.values):attachmentBase;
    const [company,users,partners,transactions,approvals,attachments,resetRequests,organizationItems,invoices,plans,bankRows,notifications,notificationSettings,auditLogs,deletedRecords,backups,deliveries,dailyRuns] = await Promise.all([
      env.DB.prepare('SELECT company_name FROM company_settings WHERE id=1').first<Record<string,unknown>>(),
      currentUser.role==='super_admin'?env.DB.prepare('SELECT id,email,name,role,status,must_change_password,department_id,created_at FROM app_users ORDER BY created_at').all():Promise.resolve({results:[]}),
      ['super_admin','finance','owner'].includes(currentUser.role)?env.DB.prepare('SELECT id,name,kind,contact,phone,note,created_at,updated_at FROM partners ORDER BY updated_at DESC').all():Promise.resolve({results:[]}),
      transactionStatement.all(),
      approvalStatement.all(),
      attachmentStatement.all(),
      currentUser.role==='super_admin'?env.DB.prepare(`SELECT r.id,r.user_id,r.requested_at,u.name,u.email FROM password_reset_requests r JOIN app_users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.requested_at DESC`).all():Promise.resolve({results:[]}),
      env.DB.prepare("SELECT * FROM organization_items WHERE status='active' ORDER BY kind,name").all(),
      ['super_admin','finance','owner'].includes(currentUser.role)?env.DB.prepare('SELECT * FROM invoices ORDER BY issue_date DESC,created_at DESC LIMIT 500').all():Promise.resolve({results:[]}),
      ['super_admin','finance','owner','cashier'].includes(currentUser.role)?env.DB.prepare('SELECT * FROM payment_plans ORDER BY due_date,status LIMIT 500').all():Promise.resolve({results:[]}),
      ['super_admin','finance','cashier'].includes(currentUser.role)?env.DB.prepare('SELECT * FROM bank_statement_rows ORDER BY occurred_on DESC,imported_at DESC LIMIT 1000').all():Promise.resolve({results:[]}),
      env.DB.prepare('SELECT id,title,message,kind,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 200').bind(currentUser.id).all(),
      currentUser.role==='super_admin'?env.DB.prepare('SELECT email_webhook,wechat_webhook,dingtalk_webhook,email_enabled,wechat_enabled,dingtalk_enabled,updated_at FROM notification_settings WHERE id=1').first<Record<string,unknown>>():Promise.resolve(null),
      currentUser.role==='super_admin'?env.DB.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300').all():Promise.resolve({results:[]}),
      currentUser.role==='super_admin'?env.DB.prepare('SELECT id,entity_type,entity_id,label,deleted_by_name,deleted_at FROM deleted_records ORDER BY deleted_at DESC LIMIT 300').all():Promise.resolve({results:[]}),
      currentUser.role==='super_admin'?env.DB.prepare('SELECT id,kind,size,created_by,created_at FROM backups ORDER BY created_at DESC LIMIT 100').all():Promise.resolve({results:[]}),
      currentUser.role==='super_admin'?env.DB.prepare('SELECT id,channel,title,message,status,response_code,error,source_kind,created_at,sent_at FROM notification_deliveries ORDER BY created_at DESC LIMIT 200').all():Promise.resolve({results:[]}),
      currentUser.role==='super_admin'?env.DB.prepare('SELECT id,job_name,run_date,status,detail,started_at,completed_at FROM daily_job_runs ORDER BY started_at DESC LIMIT 60').all():Promise.resolve({results:[]}),
    ]);
    const mapMoney=(row:Record<string,unknown>)=>({...row,amount:Number(row.amount_cents??0)/100});
    return Response.json({
      companyName:String(company?.company_name??'abc'),currentUser,
      users:users.results.map((row)=>({id:String(row.id),email:String(row.email),name:String(row.name),role:String(row.role),status:String(row.status),mustChangePassword:Boolean(row.must_change_password),departmentId:row.department_id?String(row.department_id):null,createdAt:String(row.created_at)})),
      partners:partners.results.map((row)=>({id:String(row.id),name:String(row.name),kind:String(row.kind),contact:String(row.contact),phone:String(row.phone),note:String(row.note),createdAt:String(row.created_at),updatedAt:String(row.updated_at)})),
      transactions:transactions.results.map(mapTransaction),
      approvals:approvals.results.map((row)=>({id:String(row.id),transactionId:String(row.transaction_id),stage:String(row.stage),action:String(row.action),actorName:String(row.actor_name),comment:String(row.comment),createdAt:String(row.created_at)})),
      attachments:attachments.results.map((row)=>({id:String(row.id),transactionId:String(row.transaction_id),filename:String(row.filename),contentType:String(row.content_type),size:Number(row.size),createdAt:String(row.created_at)})),
      resetRequests:resetRequests.results.map((row)=>({id:String(row.id),userId:String(row.user_id),name:String(row.name),email:String(row.email),requestedAt:String(row.requested_at)})),
      organizationItems:organizationItems.results.map((row)=>({id:String(row.id),kind:String(row.kind),name:String(row.name),detail:String(row.detail),openingBalance:Number(row.opening_balance_cents)/100,status:String(row.status),createdAt:String(row.created_at),updatedAt:String(row.updated_at)})),
      invoices:invoices.results.map((row)=>({...mapMoney(row),id:String(row.id),invoiceNumber:String(row.invoice_number),counterparty:String(row.counterparty),issueDate:String(row.issue_date),dueDate:row.due_date?String(row.due_date):'',status:String(row.status),kind:String(row.kind),note:String(row.note)})),
      paymentPlans:plans.results.map((row)=>({...mapMoney(row),id:String(row.id),subject:String(row.subject),counterparty:String(row.counterparty),dueDate:String(row.due_date),status:String(row.status),kind:String(row.kind),note:String(row.note)})),
      bankRows:bankRows.results.map((row)=>({id:String(row.id),accountId:String(row.account_id),occurredOn:String(row.occurred_on),description:String(row.description),amount:Number(row.amount_cents)/100,balance:row.balance_cents==null?null:Number(row.balance_cents)/100,reference:String(row.reference),status:String(row.status),transactionId:row.transaction_id?String(row.transaction_id):null})),
      notifications:notifications.results.map((row)=>({id:String(row.id),title:String(row.title),message:String(row.message),kind:String(row.kind),readAt:row.read_at?String(row.read_at):null,createdAt:String(row.created_at)})),
      notificationSettings:notificationSettings?{emailConfigured:Boolean(notificationSettings.email_webhook),wechatConfigured:Boolean(notificationSettings.wechat_webhook),dingtalkConfigured:Boolean(notificationSettings.dingtalk_webhook),emailEnabled:Boolean(notificationSettings.email_enabled),wechatEnabled:Boolean(notificationSettings.wechat_enabled),dingtalkEnabled:Boolean(notificationSettings.dingtalk_enabled),updatedAt:String(notificationSettings.updated_at)}:null,
      auditLogs:auditLogs.results.map((row)=>({id:String(row.id),userName:String(row.user_name),action:String(row.action),entityType:String(row.entity_type),entityId:String(row.entity_id),detail:String(row.detail),createdAt:String(row.created_at)})),
      deletedRecords:deletedRecords.results.map((row)=>({id:String(row.id),entityType:String(row.entity_type),entityId:String(row.entity_id),label:String(row.label),deletedByName:String(row.deleted_by_name),deletedAt:String(row.deleted_at)})),
      backups:backups.results.map((row)=>({id:String(row.id),kind:String(row.kind),size:Number(row.size),createdBy:String(row.created_by),createdAt:String(row.created_at)})),
      notificationDeliveries:deliveries.results.map((row)=>({id:String(row.id),channel:String(row.channel),title:String(row.title),message:String(row.message),status:String(row.status),responseCode:row.response_code==null?null:Number(row.response_code),error:String(row.error??''),sourceKind:String(row.source_kind),createdAt:String(row.created_at),sentAt:row.sent_at?String(row.sent_at):null})),
      dailyRuns:dailyRuns.results.map((row)=>({id:String(row.id),jobName:String(row.job_name),runDate:String(row.run_date),status:String(row.status),detail:String(row.detail),startedAt:String(row.started_at),completedAt:row.completed_at?String(row.completed_at):null})),
    });
  } catch(error){return errorResponse(error)}
}
