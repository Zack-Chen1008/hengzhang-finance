import type { AppUser, Role } from './server';

export type TransactionScope = Pick<AppUser,'id'|'role'|'departmentId'>;

export const approvalStages:Record<string,{role:Role;next:string}> = {
  '待部门审批':{role:'manager',next:'待财务复核'},
  '待财务复核':{role:'finance',next:'待老板审批'},
  '待老板审批':{role:'owner',next:'待出纳付款'},
  '待出纳付款':{role:'cashier',next:'已完成'},
  '待财务确认':{role:'finance',next:'已完成'},
};

export function canAccessTransaction(user:TransactionScope,createdBy:string,departmentId:string|null) {
  if (['super_admin','finance','owner','cashier'].includes(user.role)) return true;
  if (user.role === 'manager') return Boolean(user.departmentId && departmentId === user.departmentId);
  return createdBy === user.id;
}

export function transactionScopeSql(user:TransactionScope,alias='t') {
  if (['super_admin','finance','owner','cashier'].includes(user.role)) return { sql:'', values:[] as string[] };
  if (user.role === 'manager') return { sql:` WHERE ${alias}.department_id=?`, values:[user.departmentId ?? '__NO_DEPARTMENT__'] };
  return { sql:` WHERE ${alias}.created_by=?`, values:[user.id] };
}

export function canApproveTransaction(user:TransactionScope,status:string,departmentId:string|null) {
  const stage=approvalStages[status];
  if (!stage) return false;
  if (user.role === 'super_admin') return true;
  if (user.role !== stage.role) return false;
  return user.role !== 'manager' || Boolean(user.departmentId && user.departmentId === departmentId);
}

export function nextApprovalStatus(status:string,action:'approve'|'reject') {
  const stage=approvalStages[status];
  if (!stage) return null;
  return action === 'reject' ? '已驳回' : stage.next;
}

export function calculateCashSummary(openingBalance:number,transactions:{type:'income'|'expense';amount:number;status:string}[]) {
  const valid=transactions.filter((item)=>item.status!=='已驳回');
  const income=valid.filter((item)=>item.type==='income').reduce((sum,item)=>sum+item.amount,0);
  const expense=valid.filter((item)=>item.type==='expense').reduce((sum,item)=>sum+item.amount,0);
  return { openingBalance,income,expense,balance:openingBalance+income-expense };
}

export function isDueSoon(dueDate:string,today:string,days=3) {
  const start=Date.parse(`${today}T00:00:00Z`);
  const due=Date.parse(`${dueDate}T00:00:00Z`);
  if (!Number.isFinite(start)||!Number.isFinite(due)) return false;
  const difference=Math.floor((due-start)/86_400_000);
  return difference<=days;
}
