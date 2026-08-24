import { createBackup } from './backup';
import { makeId, sendExternalNotification, type AppUser } from './server';

export type DailyBindings={DB:D1Database;FILES:R2Bucket};

function chinaDate(now:Date) {
  return new Date(now.getTime()+8*60*60*1000).toISOString().slice(0,10);
}

export async function runDailyJobs(bindings:DailyBindings,now=new Date()) {
  const runDate=chinaDate(now);const id=makeId('JOB');const startedAt=now.toISOString();
  const claim=await bindings.DB.prepare("INSERT OR IGNORE INTO daily_job_runs (id,job_name,run_date,status,detail,started_at) VALUES (?,'daily_finance',?,'running','',?)")
    .bind(id,runDate,startedAt).run();
  if(!claim.meta.changes)return {ran:false,runDate};
  try {
    const systemUser:AppUser={id:'USR_SUPER_ADMIN',email:'chenzack1008@gmail.com',name:'系统定时任务',role:'super_admin',status:'active',authUserId:null,mustChangePassword:false,departmentId:null};
    await createBackup(systemUser,'automatic',bindings);
    await bindings.DB.batch([
      bindings.DB.prepare("UPDATE payment_plans SET status='overdue',updated_at=? WHERE status='pending' AND due_date<?").bind(startedAt,runDate),
      bindings.DB.prepare("UPDATE invoices SET status='overdue',updated_at=? WHERE status IN ('unpaid','partial') AND due_date IS NOT NULL AND due_date<?").bind(startedAt,runDate),
    ]);
    const [plans,invoices]=await Promise.all([
      bindings.DB.prepare("SELECT id,subject,counterparty,due_date,kind FROM payment_plans WHERE status IN ('pending','overdue') AND due_date<=date(?,'+3 day') ORDER BY due_date LIMIT 100").bind(runDate).all<Record<string,unknown>>(),
      bindings.DB.prepare("SELECT id,invoice_number,counterparty,due_date,kind FROM invoices WHERE status IN ('unpaid','partial','overdue') AND due_date IS NOT NULL AND due_date<=date(?,'+3 day') ORDER BY due_date LIMIT 100").bind(runDate).all<Record<string,unknown>>(),
    ]);
    const message=`收付款计划 ${plans.results.length} 笔，发票 ${invoices.results.length} 张将在 3 天内到期或已经逾期。`;
    const users=await bindings.DB.prepare("SELECT id FROM app_users WHERE status='active' AND role IN ('super_admin','finance','owner','cashier')").all<Record<string,unknown>>();
    if((plans.results.length||invoices.results.length)&&users.results.length){
      await bindings.DB.batch(users.results.map((row)=>bindings.DB.prepare('INSERT OR IGNORE INTO notifications (id,user_id,title,message,kind,dedupe_key,created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(makeId('NOT'),String(row.id),'每日到期提醒',message,'due',`daily-due:${runDate}:${String(row.id)}`,startedAt)));
      await sendExternalNotification('每日到期提醒',message,'daily',id,bindings.DB);
    }
    const detail=`自动备份完成；到期计划 ${plans.results.length} 笔；到期发票 ${invoices.results.length} 张`;
    await bindings.DB.prepare("UPDATE daily_job_runs SET status='completed',detail=?,completed_at=? WHERE id=?").bind(detail,new Date().toISOString(),id).run();
    return {ran:true,runDate,detail};
  } catch(error) {
    const detail=error instanceof Error?error.message.slice(0,500):'未知错误';
    await bindings.DB.prepare("UPDATE daily_job_runs SET status='failed',detail=?,completed_at=? WHERE id=?").bind(detail,new Date().toISOString(),id).run();
    throw error;
  }
}
