# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-08-24
- Primary product surfaces: 邮箱密码登录、首次改密、财务驾驶舱、收付款台账、审批中心、应收应付、往来单位、人员管理、财务报表、发票与付款计划、银行对账、系统设置、消息中心、数据安全
- Evidence reviewed: 现有衡账站点；用户确认公司名 abc、陈泽宇为超级管理员、五类岗位使用默认邮箱、初始密码与重置密码均为 123456、首次登录强制改密、部门数据隔离、单据必须包含账户/部门/收支分类、期初余额进入统计、每日自动备份与到期提醒、外部通知保留发送记录

## Brand
- Personality: 稳健、清晰、可信、不过度金融化
- Trust signals: 独立登录、密码不可明文保存、首次改密、金额口径明确、审批状态清楚、操作留痕、风险提醒克制
- Avoid: 花哨渐变、夸张动效、密集小字、把专业会计术语强加给普通员工

## Product goals
- Goals: 让非财务员工能提交，让负责人、财务、老板和出纳按岗位完成审批与付款闭环
- Non-goals: 第一版不承担税务申报、总账结账或法定财务报表
- Success signals: 用户能在一分钟内判断资金情况，并在三步内发起收付款

## Personas and jobs
- Primary personas: 超级管理员、公司负责人、财务、出纳、部门负责人、普通员工
- User jobs: 安全登录、首次设置个人密码、申请或处理密码重置、看资金概况、发起申请、完成审批、登记回单、追踪应收应付、维护基础参数、管理发票与计划、导入并核对银行流水、恢复误删数据、处理消息
- Key contexts of use: 工作日桌面端高频处理，手机端查看和审批

## Information architecture
- Primary navigation: 工作台、收付款、审批中心、应收应付、往来单位、人员管理、财务报表、财务工具、消息中心、系统设置、数据安全
- Core routes/screens: 登录、忘记密码、强制改密；登录后按岗位展示有权限的业务页面
- Content hierarchy: 待办与风险优先，其次资金指标，再次趋势和最近流水

## Design principles
- Principle 1: 先给结论，再给明细
- Principle 2: 状态用文字与颜色双重表达
- Tradeoffs: 优先可读性和操作确定性，不追求一次展示所有字段

## Visual language
- Color: 深墨蓝导航、浅灰蓝背景、品牌蓝操作、绿表示收入、红橙表示支出或风险
- Typography: 中文系统字体，数字使用等宽特征
- Spacing/layout rhythm: 8px 基准，桌面卡片 20–24px 内距
- Shape/radius/elevation: 10–16px 圆角，轻边框与低阴影
- Motion: 仅用于抽屉、菜单和状态反馈，尊重减少动效设置
- Imagery/iconography: 不使用装饰图片；图标只承担导航与状态辨识

## Components
- Existing components to reuse: 无
- New/changed components: 登录卡片、管理员直接重置密码、部门与岗位分配、侧栏、指标卡、审批待办、收付款弹窗（账户/部门/项目/分类）、人员与角色表、附件区、导出控件、基础参数表单、发票与计划表、银行 CSV 导入与对账、含期初余额的月度统计、通知收件箱、外部通知配置与发送记录、每日任务记录、备份列表、回收站、操作日志
- Variants and states: 未登录/首次改密/正常登录/停用/重置待处理；收入/支出、待审批/已通过/已驳回/已完成
- Token/component ownership: 颜色与尺寸由 `app/globals.css` 管理

## Accessibility
- Target standard: WCAG 2.1 AA
- Keyboard/focus behavior: 所有操作可聚焦，弹层可关闭，焦点样式清晰
- Contrast/readability: 不仅依赖颜色传达状态，正文不小于 14px
- Screen-reader semantics: 使用语义化按钮、表格、标题和标签
- Reduced motion and sensory considerations: 减少动效偏好下关闭过渡

## Responsive behavior
- Supported breakpoints/devices: 360px 手机至宽屏桌面
- Layout adaptations: 窄屏侧栏收起、卡片单列、表格横向滚动
- Touch/hover differences: 触控目标不小于 40px，核心操作不依赖悬停

## Interaction states
- Loading: 使用局部骨架或按钮处理中状态
- Empty: 解释原因并提供发起入口
- Error: 就近说明问题并保留用户输入
- Success: 登录、改密与重置均明确下一步；业务提交显示单据编号
- Disabled: 说明不可操作原因
- Offline/slow network, if applicable: 提交时防重复，失败可重试

## Content voice
- Tone: 简洁、专业、说人话
- Terminology: 使用“收款、付款、审批、回单”，避免不必要的会计黑话
- Microcopy rules: 金额带人民币符号和千分位，日期完整，按钮使用动作词

## Implementation constraints
- Framework/styling system: Vinext、React、CSS
- Design-token constraints: 使用 CSS 变量保持统一
- Performance constraints: 首屏不依赖大图
- Compatibility constraints: 现代桌面和移动浏览器
- Authentication constraints: 所有业务接口由服务端会话校验；密码使用带盐慢哈希；连续失败触发临时锁定；重置后旧会话失效
- Test/screenshot expectations: 构建、类型检查与 lint 通过；自动测试覆盖部门可见范围、跨部门审批拦截、完整审批链、期初余额统计和到期判断；核心操作键盘可用，响应式布局不溢出

## Open questions
- [x] 公司与审批层级：abc；当前用户为超级管理员；付款与报销依次经过部门负责人、财务、老板、出纳
- [x] 登录与账号：陈泽宇为超级管理员；员工由人员管理创建；初始/重置密码为 123456；首次登录强制改密
- [x] 默认岗位账号：employee、manager、finance、owner、cashier 均使用 `@abc.local` 默认邮箱
- [x] 通知一期：站内消息 + 邮件自动化、企业微信、钉钉 Webhook 配置入口
- [x] 部门权限：员工仅本人，部门负责人仅本部门，财务/老板/出纳/超级管理员为全公司范围
- [x] 自动任务：每天 00:05 运行自动备份和三天到期提醒，并保留任务及外部发送结果
- [ ] 外部通知的真实 Webhook 地址与各平台模板 / 用户 / 上线后在消息中心配置
- [ ] 是否升级为完整会计核算 / 用户 / 后续科目、凭证和法定报表
