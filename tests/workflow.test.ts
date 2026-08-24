import { describe,expect,it } from 'vitest';
import { calculateCashSummary,canAccessTransaction,canApproveTransaction,isDueSoon,nextApprovalStatus,transactionScopeSql } from '../app/lib/workflow';

const user=(role:'super_admin'|'employee'|'manager'|'finance'|'owner'|'cashier',departmentId:string|null='DEP_A')=>({id:`U_${role}`,role,departmentId});

describe('部门数据权限',()=>{
  it('普通员工只能看自己创建的单据',()=>{
    expect(canAccessTransaction(user('employee'),'U_employee','DEP_A')).toBe(true);
    expect(canAccessTransaction(user('employee'),'OTHER','DEP_A')).toBe(false);
  });

  it('部门负责人只能看和审批本部门单据',()=>{
    expect(canAccessTransaction(user('manager'),'OTHER','DEP_A')).toBe(true);
    expect(canAccessTransaction(user('manager'),'OTHER','DEP_B')).toBe(false);
    expect(canApproveTransaction(user('manager'),'待部门审批','DEP_A')).toBe(true);
    expect(canApproveTransaction(user('manager'),'待部门审批','DEP_B')).toBe(false);
  });

  it('财务、老板、出纳和超级管理员可查看全公司',()=>{
    for(const role of ['finance','owner','cashier','super_admin'] as const)expect(canAccessTransaction(user(role),'OTHER','DEP_B')).toBe(true);
  });

  it('查询条件与岗位范围一致',()=>{
    expect(transactionScopeSql(user('manager'))).toEqual({sql:' WHERE t.department_id=?',values:['DEP_A']});
    expect(transactionScopeSql(user('employee'))).toEqual({sql:' WHERE t.created_by=?',values:['U_employee']});
    expect(transactionScopeSql(user('finance'))).toEqual({sql:'',values:[]});
  });
});

describe('核心财务流程',()=>{
  it('付款审批按部门、财务、老板、出纳依次流转',()=>{
    expect(nextApprovalStatus('待部门审批','approve')).toBe('待财务复核');
    expect(nextApprovalStatus('待财务复核','approve')).toBe('待老板审批');
    expect(nextApprovalStatus('待老板审批','approve')).toBe('待出纳付款');
    expect(nextApprovalStatus('待出纳付款','approve')).toBe('已完成');
    expect(nextApprovalStatus('待财务复核','reject')).toBe('已驳回');
  });

  it('收款由财务确认完成',()=>expect(nextApprovalStatus('待财务确认','approve')).toBe('已完成'));

  it('期初余额计入账面余额，驳回单据不计入统计',()=>{
    expect(calculateCashSummary(10_000,[
      {type:'income',amount:3_000,status:'已完成'},
      {type:'expense',amount:1_200,status:'待财务复核'},
      {type:'expense',amount:9_999,status:'已驳回'},
    ])).toEqual({openingBalance:10_000,income:3_000,expense:1_200,balance:11_800});
  });

  it('识别三天内到期与逾期项目',()=>{
    expect(isDueSoon('2026-08-24','2026-08-24')).toBe(true);
    expect(isDueSoon('2026-08-27','2026-08-24')).toBe(true);
    expect(isDueSoon('2026-08-28','2026-08-24')).toBe(false);
    expect(isDueSoon('2026-08-20','2026-08-24')).toBe(true);
  });
});
