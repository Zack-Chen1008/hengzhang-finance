# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-08-24
- Primary product surfaces: 邮箱密码登录、首次改密、财务驾驶舱、收付款台账、审批中心、应收应付、往来单位、人员管理、密码重置申请、财务报表
- Evidence reviewed: 现有衡账站点；用户确认公司名 abc、陈泽宇为超级管理员、员工由人员管理创建、初始密码与重置密码均为 123456、首次登录强制改密

## Brand
- Personality: 稳健、清晰、可信、不过度金融化
- Trust signals: 独立登录、密码不可明文保存、首次改密、金额口径明确、审批状态清楚、操作留痕、风险提醒克制
- Avoid: 花哨渐变、夸张动效、密集小字、把专业会计术语强加给普通员工

## Product goals
- Goals: 让非财务员工能提交，让负责人、财务、老板和出纳按岗位完成审批与付款闭环
- Non-goals: 第一版不承担税务申报、总账结账或法定财务报表
- Success signals: 用户能在一分钟内判断资金情况，并在三步内发起收付款

## Personas and jobs
- Primary personas: 公司负责人、财务、出纳、普通员工
- User jobs: 安全登录、首次设置个人密码、申请或处理密码重置、看资金概况、发起申请、完成审批、登记回单、追踪应收应付
- Key contexts of use: 工作日桌面端高频处理，手机端查看和审批

## Information architecture
- Primary navigation: 工作台、收付款、审批中心、应收应付、往来单位、人员管理、财务报表
- Core routes/screens: 登录、忘记密码、强制改密；登录后为单页应用内七个业务页面
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
- New/changed components: 登录卡片、忘记密码表单、首次改密表单、退出入口、密码重置申请卡片、侧栏、顶部操作区、指标卡、审批待办、资金趋势、流水表、收付款弹窗、人员与角色表、往来单位表、附件区、确认弹窗、导出控件
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
- Framework/styling system: Vinext、React、Tailwind CSS
- Design-token constraints: 使用 CSS 变量保持统一
- Performance constraints: 首屏不依赖大图
- Compatibility constraints: 现代桌面和移动浏览器
- Authentication constraints: 所有业务接口由服务端会话校验；密码使用带盐慢哈希；连续失败触发临时锁定；重置后旧会话失效
- Test/screenshot expectations: 构建通过，核心操作键盘可用，响应式布局不溢出

## Open questions
- [x] 公司与审批层级：abc；当前用户为超级管理员；付款与报销依次经过部门负责人、财务、老板、出纳
- [x] 登录与账号：陈泽宇为超级管理员；员工由人员管理创建；初始/重置密码为 123456；首次登录强制改密
- [ ] 是否需要对接银行、企业微信或钉钉 / 用户 / 后续外部集成
- [ ] 是否升级为完整会计核算 / 用户 / 后续科目、凭证和法定报表
