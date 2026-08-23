'use client';

import { FormEvent, useEffect, useState } from 'react';

const metrics = [
  { label: '本月收入', value: '¥ 486,920.00', note: '较上月 +12.6%', tone: 'income' },
  { label: '本月支出', value: '¥ 218,450.00', note: '较上月 -4.8%', tone: 'expense' },
  { label: '账户余额', value: '¥ 1,268,340.52', note: '3 个资金账户', tone: 'balance' },
  { label: '待审批金额', value: '¥ 76,800.00', note: '8 笔单据待处理', tone: 'pending' },
];

type Transaction = { id:string; type:'income'|'expense'; subject:string; counterparty:string; amount:number; status:string };

const demoTransactions: Transaction[] = [
  { id:'SK20260823001', type:'income', subject:'项目服务费', counterparty:'杭州星云科技有限公司', amount:86000, status:'已到账' },
  { id:'FK20260822018', type:'expense', subject:'办公设备采购', counterparty:'上海启明办公', amount:18650, status:'待付款' },
  { id:'BX20260822009', type:'expense', subject:'差旅报销', counterparty:'陈晨', amount:3280, status:'审批中' },
];

export default function Home() {
  const [modalType, setModalType] = useState<'income'|'expense'|null>(null);
  const [items, setItems] = useState<Transaction[]>(demoTransactions);
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/transactions').then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.items?.length) setItems(data.items);
    }).catch(() => undefined);
  }, []);

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalType || submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const response = await fetch('/api/transactions', { method:'POST', body:JSON.stringify({
        type:modalType,
        subject:String(form.get('subject') ?? ''),
        counterparty:String(form.get('counterparty') ?? ''),
        amount:Number(form.get('amount')),
        note:String(form.get('note') ?? ''),
      }), headers:{'content-type':'application/json'} });
      if (!response.ok) throw new Error('submit failed');
      const data = await response.json();
      setItems((current) => [data.item, ...current]);
      setModalType(null);
      setNotice(`${modalType === 'income' ? '收款' : '付款'}申请已提交，单号 ${data.item.id}`);
      window.setTimeout(() => setNotice(''), 4000);
    } catch {
      setNotice('提交失败，请检查网络后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">衡</span><strong>衡账</strong></div>
        <nav aria-label="主要导航">
          <a className="nav-item active" href="#dashboard"><span>⌂</span>工作台</a>
          <a className="nav-item" href="#transactions"><span>↔</span>收付款</a>
          <a className="nav-item" href="#approval"><span>✓</span>审批中心 <b>8</b></a>
          <a className="nav-item" href="#receivable"><span>¥</span>应收应付</a>
          <a className="nav-item" href="#partners"><span>◇</span>往来单位</a>
          <a className="nav-item" href="#reports"><span>▥</span>财务报表</a>
        </nav>
        <div className="sidebar-foot"><span className="avatar">财</span><div><strong>财务管理员</strong><small>华辰科技有限公司</small></div></div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div><p className="eyebrow">2026年8月23日 · 星期日</p><h1>下午好，先看看公司的资金情况</h1></div>
          <div className="top-actions"><button className="icon-button" aria-label="查看通知">●<span className="notification-dot" /></button><button className="secondary-button" onClick={() => setModalType('income')}>＋ 发起收款</button><button className="primary-button" onClick={() => setModalType('expense')}>＋ 发起付款</button></div>
        </header>

        <section className="metrics" aria-label="资金概况">
          {metrics.map((metric) => <article className={`metric-card ${metric.tone}`} key={metric.label}><div className="metric-head"><span>{metric.label}</span><i /></div><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
        </section>

        <section className="content-grid">
          <article className="panel cash-panel">
            <div className="panel-title"><div><h2>资金收支趋势</h2><p>近 6 个月公司资金流动</p></div><button className="filter-button">近 6 个月⌄</button></div>
            <div className="legend"><span><i className="income-dot" />收入</span><span><i className="expense-dot" />支出</span></div>
            <div className="chart" aria-label="近六个月收入支出柱状图">
              {[['3月',54,38],['4月',68,44],['5月',58,33],['6月',78,48],['7月',66,41],['8月',88,39]].map(([month, income, expense]) => <div className="bar-group" key={month}><div className="bars"><i className="income-bar" style={{height:`${income}%`}}/><i className="expense-bar" style={{height:`${expense}%`}}/></div><span>{month}</span></div>)}
            </div>
          </article>

          <article className="panel todo-panel" id="approval">
            <div className="panel-title"><div><h2>待我处理</h2><p>今天还有 8 项待办</p></div><a href="#approval">查看全部</a></div>
            <div className="todo-item"><span className="todo-icon pay">付</span><div><strong>付款审批</strong><p>办公设备采购 · ¥18,650.00</p><small>王琳提交 · 10分钟前</small></div><button aria-label="查看付款审批">›</button></div>
            <div className="todo-item"><span className="todo-icon claim">报</span><div><strong>报销审批</strong><p>北京客户拜访 · ¥3,280.00</p><small>陈晨提交 · 1小时前</small></div><button aria-label="查看报销审批">›</button></div>
            <div className="risk-note"><span>!</span><div><strong>2 笔应收款即将逾期</strong><p>合计 ¥128,000.00，请及时跟进</p></div></div>
          </article>
        </section>

        <section className="panel transactions" id="transactions">
          <div className="panel-title"><div><h2>最近收付款</h2><p>公司最新资金动态</p></div><a href="#transactions">查看全部流水</a></div>
          <div className="table-wrap"><table><thead><tr><th>单据编号</th><th>业务事项</th><th>往来单位 / 人员</th><th>金额</th><th>状态</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.id}</td><td><strong>{item.subject}</strong></td><td>{item.counterparty}</td><td className={item.type === 'income' ? 'amount-in' : 'amount-out'}>{item.type === 'income' ? '+' : '-'} ¥ {item.amount.toLocaleString('zh-CN',{minimumFractionDigits:2})}</td><td><span className={`status ${item.status}`}>{item.status}</span></td><td><button aria-label={`查看${item.id}`}>•••</button></td></tr>)}</tbody></table></div>
        </section>
      </main>

      {modalType && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if(event.target === event.currentTarget) setModalType(null); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-header"><div><p>{modalType === 'income' ? 'INCOME REQUEST' : 'PAYMENT REQUEST'}</p><h2 id="modal-title">发起{modalType === 'income' ? '收款' : '付款'}申请</h2></div><button onClick={() => setModalType(null)} aria-label="关闭">×</button></div>
          <form onSubmit={submitTransaction}>
            <label>业务事项<input name="subject" required maxLength={50} placeholder={modalType === 'income' ? '例如：项目服务费' : '例如：设备采购款'} /></label>
            <label>{modalType === 'income' ? '付款单位' : '收款单位 / 人员'}<input name="counterparty" required maxLength={60} placeholder="请输入往来单位或人员" /></label>
            <label>金额（元）<div className="money-input"><span>¥</span><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></div></label>
            <label>说明<textarea name="note" rows={3} maxLength={200} placeholder="可填写合同、项目或付款用途" /></label>
            <div className="form-tip"><span>✓</span>提交后将进入“负责人审批 → 财务复核 → 出纳处理”流程</div>
            <div className="modal-actions"><button type="button" onClick={() => setModalType(null)}>取消</button><button className="submit-button" disabled={submitting}>{submitting ? '提交中…' : '提交申请'}</button></div>
          </form>
        </section>
      </div>}
      {notice && <div className={`toast ${notice.includes('失败') ? 'error' : ''}`} role="status">{notice}</div>}
    </div>
  );
}
