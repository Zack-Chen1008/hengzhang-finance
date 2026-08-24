'use client';

import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';

type Role = 'super_admin'|'employee'|'manager'|'finance'|'owner'|'cashier';
type User = { id:string; email:string; name:string; role:Role; status:string; mustChangePassword:boolean; createdAt:string };
type Transaction = { id:string; type:'income'|'expense'; subject:string; counterparty:string; amount:number; note:string; status:string; createdBy:string; createdAt:string; attachmentCount:number };
type Partner = { id:string; name:string; kind:string; contact:string; phone:string; note:string; createdAt?:string; updatedAt:string };
type Approval = { id:string; transactionId:string; stage:string; action:string; actorName:string; comment:string; createdAt:string };
type Attachment = { id:string; transactionId:string; filename:string; contentType:string; size:number; createdAt:string };
type ResetRequest = { id:string; userId:string; name:string; email:string; requestedAt:string };
type Bootstrap = { companyName:string; currentUser:User; users:User[]; transactions:Transaction[]; partners:Partner[]; approvals:Approval[]; attachments:Attachment[]; resetRequests:ResetRequest[] };
type PageKey = 'dashboard'|'transactions'|'approvals'|'receivables'|'partners'|'users'|'reports';
type ModalState = { type:'transaction'; item?:Transaction } | { type:'partner'; item?:Partner } | { type:'user'; item?:User } | { type:'detail'; item:Transaction } | { type:'approval'; item:Transaction; action:'approve'|'reject' } | null;

const roleNames:Record<Role,string> = { super_admin:'超级管理员', employee:'普通员工', manager:'部门负责人', finance:'财务', owner:'老板', cashier:'出纳' };
const assignableRoles:Role[] = ['employee','manager','finance','owner','cashier'];
const pageNames:Record<PageKey,string> = { dashboard:'工作台', transactions:'收付款', approvals:'审批中心', receivables:'应收应付', partners:'往来单位', users:'人员管理', reports:'财务报表' };
const navItems:{key:PageKey; icon:string; label:string}[] = [
  {key:'dashboard',icon:'⌂',label:'工作台'}, {key:'transactions',icon:'↔',label:'收付款'}, {key:'approvals',icon:'✓',label:'审批中心'},
  {key:'receivables',icon:'¥',label:'应收应付'}, {key:'partners',icon:'◇',label:'往来单位'}, {key:'users',icon:'♙',label:'人员管理'}, {key:'reports',icon:'▥',label:'财务报表'},
];
const stageRoles:Record<string,Role> = { '待部门审批':'manager','待财务复核':'finance','待老板审批':'owner','待出纳付款':'cashier','待财务确认':'finance','审批中':'manager','待确认':'finance','待付款':'cashier' };

const money = (value:number) => `¥ ${value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateText = (value:string) => value ? new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
const kindText = (kind:string) => ({customer:'客户',supplier:'供应商',both:'客户兼供应商'}[kind] ?? kind);
const escapeXml = (value:string|number) => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

class ApiError extends Error {
  code?:string;
  status:number;
  constructor(message:string,status:number,code?:string){super(message);this.name='ApiError';this.status=status;this.code=code;}
}

function AuthLayout({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}){
  return <main className="auth-page"><section className="auth-card"><header><span className="auth-mark">衡</span><div><strong>衡账</strong><small>abc 公司财务管理</small></div></header><div className="auth-heading"><p>安全登录</p><h1>{title}</h1><span>{subtitle}</span></div>{children}<footer>账号由超级管理员陈泽宇统一管理</footer></section></main>;
}

async function api<T>(url:string, options?:RequestInit):Promise<T> {
  const response = await fetch(url,options);
  const data = await response.json().catch(() => ({})) as { error?:string; code?:string } & T;
  if (!response.ok) throw new ApiError(data.error ?? '操作失败',response.status,data.code);
  return data as T;
}

export default function FinanceApp() {
  const [data,setData] = useState<Bootstrap|null>(null);
  const [active,setActive] = useState<PageKey>(() => {
    if(typeof window==='undefined')return 'dashboard';
    const hash=window.location.hash.slice(1) as PageKey;
    return pageNames[hash]?hash:'dashboard';
  });
  const [modal,setModal] = useState<ModalState>(null);
  const [query,setQuery] = useState('');
  const [typeFilter,setTypeFilter] = useState('all');
  const [statusFilter,setStatusFilter] = useState('all');
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [authView,setAuthView] = useState<'checking'|'login'|'forgot'|'change'|'app'>('checking');
  const [forcedPasswordChange,setForcedPasswordChange] = useState(false);

  const reload = async () => {
    try { setError(''); setData(await api<Bootstrap>('/api/bootstrap')); }
    catch (cause) {
      if (cause instanceof ApiError && cause.code === 'AUTH_REQUIRED') { setData(null); setAuthView('login'); return; }
      if (cause instanceof ApiError && cause.code === 'PASSWORD_CHANGE_REQUIRED') { setData(null); setForcedPasswordChange(true); setAuthView('change'); return; }
      setError(cause instanceof Error ? cause.message : '加载失败');
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const session = await api<{user:User}>('/api/auth/session');
        if (session.user.mustChangePassword) { setForcedPasswordChange(true); setAuthView('change'); }
        else { setAuthView('app'); await reload(); }
      } catch { setAuthView('login'); }
    })();
  }, []);

  const navigate = (key:PageKey) => { setActive(key); window.history.replaceState(null,'',`#${key}`); };
  const flash = (text:string) => { setNotice(text); window.setTimeout(() => setNotice(''),3500); };
  const current = data?.currentUser;
  const isAdmin = current?.role === 'super_admin';
  const canApprove = (transaction:Transaction) => Boolean(current && (current.role === 'super_admin' || stageRoles[transaction.status] === current.role));
  const pending = useMemo(() => data?.transactions.filter((item) => !['已完成','已驳回'].includes(item.status)) ?? [],[data]);
  const myApprovals = pending.filter(canApprove);

  const filteredTransactions = useMemo(() => {
    if (!data) return [];
    const keyword = query.trim().toLowerCase();
    return data.transactions.filter((item) => {
      const textMatch = !keyword || `${item.id} ${item.subject} ${item.counterparty} ${item.note}`.toLowerCase().includes(keyword);
      return textMatch && (typeFilter === 'all' || item.type === typeFilter) && (statusFilter === 'all' || item.status === statusFilter);
    });
  },[data,query,typeFilter,statusFilter]);

  const totals = useMemo(() => {
    const rows = data?.transactions.filter((item) => item.status !== '已驳回') ?? [];
    const income = rows.filter((item) => item.type === 'income').reduce((sum,item) => sum + item.amount,0);
    const expense = rows.filter((item) => item.type === 'expense').reduce((sum,item) => sum + item.amount,0);
    return {income,expense,balance:income-expense,pending:pending.reduce((sum,item) => sum + item.amount,0)};
  },[data,pending]);

  async function submitLogin(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      const result=await api<{user:User}>('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:String(form.get('email')),password:String(form.get('password'))})});
      if(result.user.mustChangePassword){setForcedPasswordChange(true);setAuthView('change');}
      else{setAuthView('app');await reload();}
    } catch(cause){setError(cause instanceof Error?cause.message:'登录失败');} finally{setBusy(false);}
  }

  async function submitForgotPassword(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget); setBusy(true); setError('');
    try{const result=await api<{message:string}>('/api/auth/forgot-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:String(form.get('email'))})});setNotice(result.message);setAuthView('login');}
    catch(cause){setError(cause instanceof Error?cause.message:'申请失败');}finally{setBusy(false);}
  }

  async function submitChangePassword(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget); setBusy(true); setError('');
    try{await api('/api/auth/change-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({currentPassword:String(form.get('currentPassword')??''),newPassword:String(form.get('newPassword')),confirmPassword:String(form.get('confirmPassword'))})});setForcedPasswordChange(false);setAuthView('app');await reload();flash('密码修改成功');}
    catch(cause){setError(cause instanceof Error?cause.message:'修改失败');}finally{setBusy(false);}
  }

  async function logout() {
    try{await api('/api/auth/logout',{method:'POST'});}finally{setData(null);setError('');setNotice('');setAuthView('login');window.history.replaceState(null,'','#dashboard');}
  }

  async function resetUserPassword(userId:string,name:string) {
    if(!window.confirm(`确定把“${name}”的密码重置为123456吗？该账号需要重新登录并修改密码。`))return;
    try{const result=await api<{message:string}>('/api/auth/reset-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId})});await reload();flash(result.message);}
    catch(cause){flash(cause instanceof Error?cause.message:'重置失败');}
  }

  async function submitTransaction(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal || modal.type !== 'transaction') return;
    const form = new FormData(event.currentTarget); const existing = modal.item;
    const body = { id:existing?.id, type:String(form.get('type')), subject:String(form.get('subject')), counterparty:String(form.get('counterparty')), amount:Number(form.get('amount')), note:String(form.get('note')), createdAt:existing?.createdAt, attachmentCount:existing?.attachmentCount };
    setBusy(true);
    try { await api('/api/transactions',{method:existing?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); setModal(null); await reload(); flash(existing?'单据已修改':'申请已提交并进入审批流程'); }
    catch (cause) { flash(cause instanceof Error ? cause.message : '保存失败'); } finally { setBusy(false); }
  }

  async function removeTransaction(item:Transaction) {
    if (!window.confirm(`确定删除单据 ${item.id} 吗？相关审批记录和附件也会删除。`)) return;
    try { await api(`/api/transactions?id=${encodeURIComponent(item.id)}`,{method:'DELETE'}); setModal(null); await reload(); flash('单据已删除'); } catch (cause) { flash(cause instanceof Error?cause.message:'删除失败'); }
  }

  async function submitApproval(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal || modal.type !== 'approval') return;
    const form = new FormData(event.currentTarget); setBusy(true);
    try { await api('/api/approvals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({transactionId:modal.item.id,action:modal.action,comment:String(form.get('comment'))})}); setModal(null); await reload(); flash(modal.action === 'approve'?'审批已通过':'单据已驳回'); }
    catch (cause) { flash(cause instanceof Error?cause.message:'审批失败'); } finally { setBusy(false); }
  }

  async function submitPartner(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal || modal.type !== 'partner') return; const existing=modal.item; const form=new FormData(event.currentTarget);
    const body={id:existing?.id,name:String(form.get('name')),kind:String(form.get('kind')),contact:String(form.get('contact')),phone:String(form.get('phone')),note:String(form.get('note'))}; setBusy(true);
    try { await api('/api/partners',{method:existing?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); setModal(null); await reload(); flash(existing?'往来单位已修改':'往来单位已添加'); }
    catch(cause){flash(cause instanceof Error?cause.message:'保存失败');} finally{setBusy(false);}
  }

  async function removePartner(item:Partner) {
    if(!window.confirm(`确定删除往来单位“${item.name}”吗？`)) return;
    try{await api(`/api/partners?id=${encodeURIComponent(item.id)}`,{method:'DELETE'});await reload();flash('往来单位已删除');}catch(cause){flash(cause instanceof Error?cause.message:'删除失败');}
  }

  async function submitUser(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!modal||modal.type!=='user')return; const existing=modal.item; const form=new FormData(event.currentTarget);
    const body={id:existing?.id,email:String(form.get('email')),name:String(form.get('name')),role:String(form.get('role')),status:String(form.get('status')??'active')}; setBusy(true);
    try{await api('/api/users',{method:existing?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});setModal(null);await reload();flash(existing?'人员信息已修改':'人员已添加，初始密码为123456，首次登录必须改密');}
    catch(cause){flash(cause instanceof Error?cause.message:'保存失败');}finally{setBusy(false);}
  }

  async function removeUser(item:User) {
    if(!window.confirm(`确定删除“${item.name}”吗？`))return;
    try{await api(`/api/users?id=${encodeURIComponent(item.id)}`,{method:'DELETE'});await reload();flash('人员已删除');}catch(cause){flash(cause instanceof Error?cause.message:'删除失败');}
  }

  async function uploadAttachment(event:FormEvent<HTMLFormElement>,transaction:Transaction) {
    event.preventDefault(); const form=new FormData(event.currentTarget); form.set('transactionId',transaction.id); setBusy(true);
    try{await api('/api/attachments',{method:'POST',body:form});await reload();setModal({type:'detail',item:{...transaction,attachmentCount:transaction.attachmentCount+1}});flash('附件已上传');event.currentTarget.reset();}
    catch(cause){flash(cause instanceof Error?cause.message:'上传失败');}finally{setBusy(false);}
  }

  async function removeAttachment(item:Attachment,transaction:Transaction) {
    if(!window.confirm(`确定删除附件“${item.filename}”吗？`))return;
    try{await api(`/api/attachments?id=${encodeURIComponent(item.id)}`,{method:'DELETE'});await reload();setModal({type:'detail',item:{...transaction,attachmentCount:Math.max(0,transaction.attachmentCount-1)}});flash('附件已删除');}catch(cause){flash(cause instanceof Error?cause.message:'删除失败');}
  }

  function exportExcel(rows=filteredTransactions) {
    const headers=['单据编号','类型','业务事项','往来单位/人员','金额','状态','说明','创建时间'];
    const bodyRows=rows.map((item)=>[item.id,item.type==='income'?'收款':'付款',item.subject,item.counterparty,item.amount,item.status,item.note,dateText(item.createdAt)]);
    const rowXml=(row:(string|number)[])=>`<Row>${row.map((cell)=>`<Cell><Data ss:Type="${typeof cell==='number'?'Number':'String'}">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`;
    const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="账务明细"><Table>${rowXml(headers)}${bodyRows.map(rowXml).join('')}</Table></Worksheet></Workbook>`;
    const url=URL.createObjectURL(new Blob(['\ufeff',xml],{type:'application/vnd.ms-excel;charset=utf-8'})); const link=document.createElement('a'); link.href=url; link.download=`${data?.companyName??'公司'}-账务明细-${new Date().toISOString().slice(0,10)}.xls`; link.click(); URL.revokeObjectURL(url); flash(`已导出 ${rows.length} 条账务记录`);
  }

  if(authView==='checking')return <div className="state-screen"><div className="loader"/><h1>正在进入衡账</h1><p>请稍候</p></div>;
  if(authView==='login')return <AuthLayout title="登录衡账" subtitle="使用陈泽宇在人员管理中分配的账号"><form className="auth-form" onSubmit={submitLogin}><label>邮箱<input name="email" type="email" autoComplete="username" required placeholder="请输入登录邮箱"/></label><label>密码<input name="password" type="password" autoComplete="current-password" required placeholder="请输入密码"/></label>{error?<p className="auth-error">{error}</p>:null}{notice?<p className="auth-success">{notice}</p>:null}<button className="auth-submit" disabled={busy}>{busy?'正在登录…':'登录'}</button><button type="button" className="auth-link" onClick={()=>{setError('');setNotice('');setAuthView('forgot')}}>忘记密码</button></form><p className="auth-note">新账号初始密码为 123456，首次登录后必须修改。</p></AuthLayout>;
  if(authView==='forgot')return <AuthLayout title="申请重置密码" subtitle="提交后由超级管理员陈泽宇处理"><form className="auth-form" onSubmit={submitForgotPassword}><label>登录邮箱<input name="email" type="email" autoComplete="username" required placeholder="请输入账号邮箱"/></label>{error?<p className="auth-error">{error}</p>:null}<button className="auth-submit" disabled={busy}>{busy?'正在提交…':'提交重置申请'}</button><button type="button" className="auth-link" onClick={()=>{setError('');setAuthView('login')}}>返回登录</button></form></AuthLayout>;
  if(authView==='change')return <AuthLayout title={forcedPasswordChange?'首次登录，请修改密码':'修改密码'} subtitle={forcedPasswordChange?'为了账号安全，请先设置自己的新密码':'修改后其他设备的登录会失效'}><form className="auth-form" onSubmit={submitChangePassword}>{!forcedPasswordChange?<label>当前密码<input name="currentPassword" type="password" autoComplete="current-password" required/></label>:null}<label>新密码<input name="newPassword" type="password" minLength={8} maxLength={100} autoComplete="new-password" required placeholder="至少8位，不能使用123456"/></label><label>确认新密码<input name="confirmPassword" type="password" minLength={8} maxLength={100} autoComplete="new-password" required placeholder="再次输入新密码"/></label>{error?<p className="auth-error">{error}</p>:null}<button className="auth-submit" disabled={busy}>{busy?'正在保存…':'保存新密码并进入系统'}</button><button type="button" className="auth-link" onClick={()=>forcedPasswordChange?void logout():(setError(''),setAuthView('app'))}>{forcedPasswordChange?'退出并返回登录':'返回系统'}</button></form></AuthLayout>;
  if (!data && !error) return <div className="state-screen"><div className="loader"/><h1>正在读取 abc 财务数据</h1><p>请稍候</p></div>;
  if (error) return <div className="state-screen error-screen"><span>!</span><h1>暂时无法进入系统</h1><p>{error}</p><button onClick={()=>void reload()}>重新加载</button></div>;
  if (!data || !current) return null;
  const appData:Bootstrap = data;
  const appUser:User = current;

  const page = active === 'dashboard' ? renderDashboard() : active === 'transactions' ? renderTransactions() : active === 'approvals' ? renderApprovals() : active === 'receivables' ? renderReceivables() : active === 'partners' ? renderPartners() : active === 'users' ? renderUsers() : renderReports();

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">衡</span><div><strong>衡账</strong><small>{data.companyName}</small></div></div>
      <nav aria-label="主要导航">{navItems.map((item)=><button key={item.key} className={`nav-item ${active===item.key?'active':''}`} onClick={()=>navigate(item.key)}><span>{item.icon}</span>{item.label}{item.key==='approvals'&&myApprovals.length>0?<b>{myApprovals.length}</b>:null}</button>)}</nav>
      <div className="sidebar-foot"><span className="avatar">{current.name.slice(0,1)}</span><div><strong>{current.name}</strong><small>{roleNames[current.role]}</small></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">{data.companyName} · {pageNames[active]}</p><h1>{pageTitle(active)}</h1></div><div className="top-actions"><button className="secondary-button" onClick={()=>setModal({type:'transaction'})}>＋ 新建单据</button>{active==='transactions'||active==='reports'?<button className="primary-button" onClick={()=>exportExcel()}>⇩ 导出 Excel</button>:null}<button className="account-button" onClick={()=>{setForcedPasswordChange(false);setError('');setAuthView('change')}}>修改密码</button><button className="account-button" onClick={()=>void logout()}>退出登录</button></div></header>
      {page}
    </main>
    {renderModal()}
    {notice?<div className="toast" role="status">{notice}</div>:null}
  </div>;

  function pageTitle(key:PageKey){return ({dashboard:'公司资金一览',transactions:'收付款台账',approvals:'审批中心',receivables:'应收应付',partners:'往来单位',users:'人员与权限',reports:'财务报表'} as Record<PageKey,string>)[key];}

  function renderDashboard(){
    const metrics=[['本期收入',money(totals.income),'income'],['本期支出',money(totals.expense),'expense'],['账面结余',money(totals.balance),'balance'],['审批中金额',money(totals.pending),'pending']];
    return <><section className="metrics">{metrics.map(([label,value,tone])=><article className={`metric-card ${tone}`} key={label}><div className="metric-head"><span>{label}</span><i/></div><strong>{value}</strong><small>{appData.transactions.length} 笔账务记录</small></article>)}</section><section className="content-grid"><article className="panel"><div className="panel-title"><div><h2>待我审批</h2><p>按您的岗位显示当前环节</p></div><button className="text-button" onClick={()=>navigate('approvals')}>查看全部</button></div>{myApprovals.slice(0,4).map((item)=><ApprovalRow key={item.id} item={item}/>) }{myApprovals.length===0?<Empty title="暂无待办" text="当前没有需要您处理的审批"/>:null}</article><article className="panel"><div className="panel-title"><div><h2>最近收付款</h2><p>最新 5 笔业务</p></div><button className="text-button" onClick={()=>navigate('transactions')}>查看台账</button></div>{appData.transactions.slice(0,5).map((item)=><MiniTransaction key={item.id} item={item}/>)}{appData.transactions.length===0?<Empty title="还没有账务数据" text="点击右上角“新建单据”开始登记"/>:null}</article></section><section className="flow-banner"><div><span>1</span><strong>申请人提交</strong></div><i>→</i><div><span>2</span><strong>部门负责人</strong></div><i>→</i><div><span>3</span><strong>财务复核</strong></div><i>→</i><div><span>4</span><strong>老板审批</strong></div><i>→</i><div><span>5</span><strong>出纳付款</strong></div></section></>;
  }

  function renderTransactions(){
    const statuses=Array.from(new Set(appData.transactions.map((item)=>item.status)));
    return <section className="panel data-panel"><div className="filters"><input aria-label="搜索账务" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索单号、事项或往来单位"/><select value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}><option value="all">全部类型</option><option value="income">收款</option><option value="expense">付款</option></select><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="all">全部状态</option>{statuses.map((status)=><option key={status}>{status}</option>)}</select><span>共 {filteredTransactions.length} 笔</span></div><div className="table-wrap"><table><thead><tr><th>单据编号</th><th>业务事项</th><th>往来单位 / 人员</th><th>金额</th><th>状态</th><th>附件</th><th>操作</th></tr></thead><tbody>{filteredTransactions.map((item)=><tr key={item.id}><td>{item.id}</td><td><strong>{item.subject}</strong><small>{dateText(item.createdAt)}</small></td><td>{item.counterparty}</td><td className={item.type==='income'?'amount-in':'amount-out'}>{item.type==='income'?'+ ':'- '}{money(item.amount)}</td><td><Status value={item.status}/></td><td>{item.attachmentCount} 个</td><td><div className="row-actions"><button onClick={()=>setModal({type:'detail',item})}>详情</button>{['待部门审批','待财务确认','已驳回'].includes(item.status)?<button onClick={()=>setModal({type:'transaction',item})}>修改</button>:null}{isAdmin?<button className="danger" onClick={()=>void removeTransaction(item)}>删除</button>:null}</div></td></tr>)}</tbody></table>{filteredTransactions.length===0?<Empty title="没有符合条件的单据" text="调整筛选条件或新建一笔收付款"/>:null}</div></section>;
  }

  function renderApprovals(){
    return <div className="approval-layout"><section className="panel"><div className="panel-title"><div><h2>待我处理</h2><p>{roleNames[appUser.role]}可处理的当前环节</p></div><span className="count-pill">{myApprovals.length}</span></div>{myApprovals.map((item)=><ApprovalRow key={item.id} item={item}/>)}{myApprovals.length===0?<Empty title="审批已处理完" text="暂时没有属于您的审批任务"/>:null}</section><section className="panel"><div className="panel-title"><div><h2>全部审批中</h2><p>查看公司正在流转的单据</p></div></div>{pending.map((item)=><MiniTransaction key={item.id} item={item}/>)}{pending.length===0?<Empty title="暂无审批中的单据" text="新申请提交后会显示在这里"/>:null}</section></div>;
  }

  function renderReceivables(){
    const receivable=appData.transactions.filter((item)=>item.type==='income'&&!['已完成','已驳回'].includes(item.status)); const payable=appData.transactions.filter((item)=>item.type==='expense'&&!['已完成','已驳回'].includes(item.status));
    return <><section className="metrics two"><article className="metric-card income"><div className="metric-head"><span>应收款</span><i/></div><strong>{money(receivable.reduce((s,i)=>s+i.amount,0))}</strong><small>{receivable.length} 笔待确认收款</small></article><article className="metric-card expense"><div className="metric-head"><span>应付款</span><i/></div><strong>{money(payable.reduce((s,i)=>s+i.amount,0))}</strong><small>{payable.length} 笔待审批或付款</small></article></section><section className="content-grid"><ReceivableList title="应收明细" items={receivable}/><ReceivableList title="应付明细" items={payable}/></section></>;
  }

  function renderPartners(){
    const canManage=isAdmin||['finance','owner'].includes(appUser.role);
    return <section className="panel data-panel"><div className="section-actions"><div><h2>往来单位</h2><p>统一管理客户、供应商和联系人</p></div>{canManage?<button className="primary-button" onClick={()=>setModal({type:'partner'})}>＋ 添加单位</button>:null}</div><div className="card-grid">{appData.partners.map((item)=><article className="partner-card" key={item.id}><div className="partner-top"><span>{item.name.slice(0,1)}</span><div><h3>{item.name}</h3><p>{kindText(item.kind)}</p></div></div><dl><div><dt>联系人</dt><dd>{item.contact||'—'}</dd></div><div><dt>联系电话</dt><dd>{item.phone||'—'}</dd></div><div><dt>备注</dt><dd>{item.note||'—'}</dd></div></dl>{canManage?<div className="card-actions"><button onClick={()=>setModal({type:'partner',item})}>修改</button><button className="danger" onClick={()=>void removePartner(item)}>删除</button></div>:null}</article>)}{appData.partners.length===0?<Empty title="还没有往来单位" text="添加客户或供应商后，填单会更方便"/>:null}</div></section>;
  }

  function renderUsers(){
    return <section className="panel data-panel"><div className="section-actions"><div><h2>人员与权限</h2><p>员工使用邮箱和密码登录，岗位决定审批权限</p></div>{isAdmin?<button className="primary-button" onClick={()=>setModal({type:'user'})}>＋ 添加员工</button>:null}</div>{isAdmin&&appData.resetRequests.length>0?<div className="reset-request-box"><div><strong>密码重置申请</strong><span>{appData.resetRequests.length} 个待处理</span></div>{appData.resetRequests.map((request)=><article key={request.id}><span><strong>{request.name}</strong><small>{request.email} · {dateText(request.requestedAt)}</small></span><button onClick={()=>void resetUserPassword(request.userId,request.name)}>重置为 123456</button></article>)}</div>:null}<div className="role-legend">{(['employee','manager','finance','owner','cashier','super_admin'] as Role[]).map((role)=><span key={role}><i className={`role-dot ${role}`}/>{roleNames[role]}</span>)}</div><div className="table-wrap"><table><thead><tr><th>姓名</th><th>登录邮箱</th><th>岗位</th><th>登录状态</th><th>加入时间</th><th>操作</th></tr></thead><tbody>{appData.users.map((item)=><tr key={item.id}><td><strong>{item.name}</strong>{item.id===appUser.id?<small>当前账号</small>:null}</td><td>{item.email}</td><td>{roleNames[item.role]}</td><td><Status value={item.status!=='active'?'已停用':item.mustChangePassword?'待首次改密':'正常'}/></td><td>{dateText(item.createdAt)}</td><td>{isAdmin?<div className="row-actions"><button onClick={()=>setModal({type:'user',item})}>修改</button>{item.id!==appUser.id?<><button onClick={()=>void resetUserPassword(item.id,item.name)}>重置密码</button><button className="danger" onClick={()=>void removeUser(item)}>删除</button></>:null}</div>:'—'}</td></tr>)}</tbody></table></div></section>;
  }

  function renderReports(){
    const completed=appData.transactions.filter((item)=>item.status==='已完成'); const income=completed.filter((i)=>i.type==='income').reduce((s,i)=>s+i.amount,0); const expense=completed.filter((i)=>i.type==='expense').reduce((s,i)=>s+i.amount,0);
    return <><section className="report-hero"><div><p>已完成业务口径</p><strong>{money(income-expense)}</strong><span>净现金流</span></div><div className="report-split"><span>已确认收入<strong>{money(income)}</strong></span><span>已完成支出<strong>{money(expense)}</strong></span><span>完成单据<strong>{completed.length} 笔</strong></span></div><button onClick={()=>exportExcel(appData.transactions)}>导出全部 Excel</button></section><section className="content-grid"><article className="panel"><div className="panel-title"><div><h2>业务类型分布</h2><p>按全部有效单据计算</p></div></div><div className="distribution"><div style={{'--value':`${totals.income+totals.expense?totals.income/(totals.income+totals.expense)*100:0}%`} as CSSProperties}><span>{totals.income+totals.expense?Math.round(totals.income/(totals.income+totals.expense)*100):0}%</span></div><dl><dt><i className="income-dot"/>收入</dt><dd>{money(totals.income)}</dd><dt><i className="expense-dot"/>支出</dt><dd>{money(totals.expense)}</dd></dl></div></article><article className="panel"><div className="panel-title"><div><h2>流程完成情况</h2><p>按单据当前状态统计</p></div></div><div className="progress-list"><Progress label="已完成" count={appData.transactions.filter(i=>i.status==='已完成').length}/><Progress label="审批中" count={pending.length}/><Progress label="已驳回" count={appData.transactions.filter(i=>i.status==='已驳回').length}/></div></article></section></>;
  }

  function renderModal(){
    if(!modal)return null;
    if(modal.type==='transaction'){const item=modal.item;return <Modal title={item?'修改单据':'新建收付款单据'} subtitle="提交后自动进入公司审批流程"><form onSubmit={submitTransaction}><div className="field-row"><label>业务类型<select name="type" defaultValue={item?.type??'expense'}><option value="expense">付款 / 报销</option><option value="income">收款</option></select></label><label>金额（元）<input name="amount" type="number" min="0.01" step="0.01" defaultValue={item?.amount} required placeholder="0.00"/></label></div><label>业务事项<input name="subject" defaultValue={item?.subject} maxLength={80} required placeholder="例如：办公设备采购"/></label><label>往来单位 / 人员<input name="counterparty" defaultValue={item?.counterparty} maxLength={80} required placeholder="请输入客户、供应商或员工姓名"/></label><label>说明<textarea name="note" rows={3} maxLength={500} defaultValue={item?.note} placeholder="合同、项目、用途等补充信息"/></label><div className="form-tip">付款与报销：部门负责人 → 财务 → 老板 → 出纳；收款：财务确认</div><FormActions/></form></Modal>}
    if(modal.type==='partner'){const item=modal.item;return <Modal title={item?'修改往来单位':'添加往来单位'} subtitle="客户与供应商统一管理"><form onSubmit={submitPartner}><label>单位名称<input name="name" defaultValue={item?.name} maxLength={80} required/></label><div className="field-row"><label>类型<select name="kind" defaultValue={item?.kind??'customer'}><option value="customer">客户</option><option value="supplier">供应商</option><option value="both">客户兼供应商</option></select></label><label>联系人<input name="contact" defaultValue={item?.contact} maxLength={50}/></label></div><label>联系电话<input name="phone" defaultValue={item?.phone} maxLength={30}/></label><label>备注<textarea name="note" rows={3} defaultValue={item?.note} maxLength={300}/></label><FormActions/></form></Modal>}
    if(modal.type==='user'){const item=modal.item;const roleOptions=item?.role==='super_admin'?[...assignableRoles,'super_admin' as Role]:assignableRoles;return <Modal title={item?'修改人员权限':'添加员工'} subtitle="员工使用这里填写的邮箱登录"><form onSubmit={submitUser}><label>姓名<input name="name" defaultValue={item?.name} maxLength={50} required/></label><label>登录邮箱<input name="email" type="email" defaultValue={item?.email} disabled={Boolean(item)} required/></label><div className="field-row"><label>岗位<select name="role" defaultValue={item?.role??'employee'}>{roleOptions.map((role)=><option key={role} value={role}>{roleNames[role]}</option>)}</select></label>{item?<label>账号状态<select name="status" defaultValue={item.status}><option value="active">正常</option><option value="disabled">停用</option></select></label>:null}</div><div className="form-tip">新员工初始密码统一为 123456，首次登录必须修改；岗位决定审批权限。</div><FormActions/></form></Modal>}
    if(modal.type==='approval'){return <Modal title={modal.action==='approve'?'通过审批':'驳回单据'} subtitle={`${modal.item.subject} · ${money(modal.item.amount)}`}><form onSubmit={submitApproval}><div className="approval-summary"><span>当前环节</span><strong>{modal.item.status}</strong><span>往来单位</span><strong>{modal.item.counterparty}</strong></div><label>审批意见<textarea name="comment" rows={4} maxLength={300} placeholder={modal.action==='approve'?'可填写通过说明':'请填写驳回原因'} required={modal.action==='reject'}/></label><FormActions submitText={modal.action==='approve'?'确认通过':'确认驳回'} danger={modal.action==='reject'}/></form></Modal>}
    const item=modal.item; const files=appData.attachments.filter((a)=>a.transactionId===item.id); const history=appData.approvals.filter((a)=>a.transactionId===item.id);
    return <Modal title="单据详情" subtitle={item.id} wide><div className="detail-grid"><div><div className="detail-amount"><span>{item.type==='income'?'收款':'付款 / 报销'}</span><strong className={item.type==='income'?'amount-in':'amount-out'}>{money(item.amount)}</strong><Status value={item.status}/></div><dl className="detail-list"><div><dt>业务事项</dt><dd>{item.subject}</dd></div><div><dt>往来单位 / 人员</dt><dd>{item.counterparty}</dd></div><div><dt>创建时间</dt><dd>{dateText(item.createdAt)}</dd></div><div><dt>说明</dt><dd>{item.note||'—'}</dd></div></dl><h3>附件</h3><form className="upload-box" onSubmit={(event)=>void uploadAttachment(event,item)}><input name="file" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" required/><button disabled={busy}>上传</button><small>图片、PDF、Word、Excel，单个不超过 20MB</small></form><div className="attachment-list">{files.map((file)=><div key={file.id}><span>▧</span><a href={`/api/attachments?id=${encodeURIComponent(file.id)}`}>{file.filename}</a><small>{(file.size/1024).toFixed(1)} KB</small>{isAdmin||appUser.role==='finance'?<button onClick={()=>void removeAttachment(file,item)}>删除</button>:null}</div>)}{files.length===0?<p className="muted">暂无附件</p>:null}</div></div><div><h3>审批记录</h3><div className="timeline">{history.map((record)=><div key={record.id}><i className={record.action}/><span><strong>{record.stage}</strong><small>{record.actorName} · {dateText(record.createdAt)}</small>{record.comment?<p>{record.comment}</p>:null}</span></div>)}</div></div></div><div className="modal-actions"><button onClick={()=>setModal(null)}>关闭</button>{canApprove(item)?<button className="submit-button" onClick={()=>setModal({type:'approval',item,action:'approve'})}>处理审批</button>:null}</div></Modal>;
  }

  function Modal({title,subtitle,children,wide=false}:{title:string;subtitle:string;children:ReactNode;wide?:boolean}){return <div className="modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setModal(null)}}><section className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true"><div className="modal-header"><div><p>{subtitle}</p><h2>{title}</h2></div><button onClick={()=>setModal(null)} aria-label="关闭">×</button></div><div className="modal-body">{children}</div></section></div>}
  function FormActions({submitText='保存',danger=false}:{submitText?:string;danger?:boolean}){return <div className="modal-actions"><button type="button" onClick={()=>setModal(null)}>取消</button><button className={`submit-button ${danger?'danger-submit':''}`} disabled={busy}>{busy?'处理中…':submitText}</button></div>}
  function ApprovalRow({item}:{item:Transaction}){return <div className="approval-row"><span className={`type-badge ${item.type}`}>{item.type==='income'?'收':'付'}</span><button className="approval-main" onClick={()=>setModal({type:'detail',item})}><strong>{item.subject}</strong><small>{item.counterparty} · {money(item.amount)}</small></button><Status value={item.status}/><div className="approval-buttons"><button className="reject" onClick={()=>setModal({type:'approval',item,action:'reject'})}>驳回</button>{isAdmin?<button className="delete" onClick={()=>void removeTransaction(item)}>删除</button>:null}<button onClick={()=>setModal({type:'approval',item,action:'approve'})}>通过</button></div></div>}
  function MiniTransaction({item}:{item:Transaction}){return <button className="mini-transaction" onClick={()=>setModal({type:'detail',item})}><span className={`type-badge ${item.type}`}>{item.type==='income'?'收':'付'}</span><span><strong>{item.subject}</strong><small>{item.counterparty}</small></span><b className={item.type==='income'?'amount-in':'amount-out'}>{money(item.amount)}</b><Status value={item.status}/></button>}
  function ReceivableList({title,items}:{title:string;items:Transaction[]}){return <article className="panel"><div className="panel-title"><div><h2>{title}</h2><p>{items.length} 笔未完成业务</p></div></div>{items.map((item)=><MiniTransaction key={item.id} item={item}/>)}{items.length===0?<Empty title={`暂无${title}`} text="当前没有待处理记录"/>:null}</article>}
  function Status({value}:{value:string}){return <span className={`status status-${value}`}>{value}</span>}
  function Empty({title,text}:{title:string;text:string}){return <div className="empty"><span>○</span><strong>{title}</strong><p>{text}</p></div>}
  function Progress({label,count}:{label:string;count:number}){const total=Math.max(appData.transactions.length,1);return <div><span>{label}<b>{count} 笔</b></span><i><em style={{width:`${count/total*100}%`}}/></i></div>}
}
