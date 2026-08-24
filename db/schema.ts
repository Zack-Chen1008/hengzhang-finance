import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type', { enum:['income','expense'] }).notNull(),
  subject: text('subject').notNull(),
  counterparty: text('counterparty').notNull(),
  amountCents: integer('amount_cents').notNull(),
  note: text('note').notNull().default(''),
  status: text('status').notNull(),
  createdBy: text('created_by').notNull(),
  accountId: text('account_id'),
  departmentId: text('department_id'),
  projectId: text('project_id'),
  categoryId: text('category_id'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_transactions_created_at').on(table.createdAt),
  index('idx_transactions_department').on(table.departmentId,table.createdAt),
  index('idx_transactions_account').on(table.accountId,table.createdAt),
]);

export const appUsers = sqliteTable('app_users', {
  id:text('id').primaryKey(),
  authUserId:text('auth_user_id'),
  email:text('email').notNull(),
  name:text('name').notNull(),
  role:text('role').notNull(),
  status:text('status').notNull().default('active'),
  passwordHash:text('password_hash').notNull().default(''),
  passwordSalt:text('password_salt').notNull().default(''),
  mustChangePassword:integer('must_change_password', { mode:'boolean' }).notNull().default(true),
  departmentId:text('department_id'),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_users_email').on(table.email), index('idx_users_auth_user_id').on(table.authUserId), index('idx_users_department').on(table.departmentId,table.status)]);

export const authSessions = sqliteTable('auth_sessions', {
  id:text('id').primaryKey(),
  userId:text('user_id').notNull(),
  tokenHash:text('token_hash').notNull(),
  expiresAt:text('expires_at').notNull(),
  createdAt:text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_sessions_token_hash').on(table.tokenHash), index('idx_sessions_user_id').on(table.userId), index('idx_sessions_expires_at').on(table.expiresAt)]);

export const passwordResetRequests = sqliteTable('password_reset_requests', {
  id:text('id').primaryKey(),
  userId:text('user_id').notNull(),
  status:text('status').notNull().default('pending'),
  requestedAt:text('requested_at').notNull(),
  processedAt:text('processed_at'),
  processedBy:text('processed_by'),
}, (table) => [index('idx_reset_requests_status').on(table.status,table.requestedAt), index('idx_reset_requests_user_id').on(table.userId)]);

export const loginAttempts = sqliteTable('login_attempts', {
  email:text('email').primaryKey(),
  failedCount:integer('failed_count').notNull().default(0),
  lockedUntil:text('locked_until'),
  updatedAt:text('updated_at').notNull(),
});

export const partners = sqliteTable('partners', {
  id:text('id').primaryKey(),
  name:text('name').notNull(),
  kind:text('kind').notNull(),
  contact:text('contact').notNull().default(''),
  phone:text('phone').notNull().default(''),
  note:text('note').notNull().default(''),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull(),
});

export const approvals = sqliteTable('approvals', {
  id:text('id').primaryKey(),
  transactionId:text('transaction_id').notNull(),
  stage:text('stage').notNull(),
  action:text('action').notNull(),
  actorId:text('actor_id').notNull(),
  actorName:text('actor_name').notNull(),
  comment:text('comment').notNull().default(''),
  createdAt:text('created_at').notNull(),
}, (table) => [index('idx_approvals_transaction_id').on(table.transactionId,table.createdAt)]);

export const attachments = sqliteTable('attachments', {
  id:text('id').primaryKey(),
  transactionId:text('transaction_id').notNull(),
  fileKey:text('file_key').notNull(),
  filename:text('filename').notNull(),
  contentType:text('content_type').notNull(),
  size:integer('size').notNull(),
  uploadedBy:text('uploaded_by').notNull(),
  createdAt:text('created_at').notNull(),
}, (table) => [index('idx_attachments_transaction_id').on(table.transactionId)]);

export const companySettings = sqliteTable('company_settings', {
  id:integer('id').primaryKey(),
  companyName:text('company_name').notNull(),
  updatedAt:text('updated_at').notNull(),
});

export const organizationItems = sqliteTable('organization_items', {
  id:text('id').primaryKey(),
  kind:text('kind').notNull(),
  name:text('name').notNull(),
  detail:text('detail').notNull().default(''),
  openingBalanceCents:integer('opening_balance_cents').notNull().default(0),
  status:text('status').notNull().default('active'),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull(),
}, (table) => [index('idx_organization_items_kind').on(table.kind,table.status)]);

export const invoices = sqliteTable('invoices', {
  id:text('id').primaryKey(),
  kind:text('kind').notNull(),
  invoiceNumber:text('invoice_number').notNull(),
  counterparty:text('counterparty').notNull(),
  amountCents:integer('amount_cents').notNull(),
  issueDate:text('issue_date').notNull(),
  dueDate:text('due_date'),
  status:text('status').notNull().default('unpaid'),
  transactionId:text('transaction_id'),
  note:text('note').notNull().default(''),
  createdBy:text('created_by').notNull(),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_invoices_number').on(table.invoiceNumber), index('idx_invoices_due_date').on(table.dueDate,table.status)]);

export const paymentPlans = sqliteTable('payment_plans', {
  id:text('id').primaryKey(),
  kind:text('kind').notNull(),
  subject:text('subject').notNull(),
  counterparty:text('counterparty').notNull(),
  amountCents:integer('amount_cents').notNull(),
  dueDate:text('due_date').notNull(),
  status:text('status').notNull().default('pending'),
  invoiceId:text('invoice_id'),
  note:text('note').notNull().default(''),
  createdBy:text('created_by').notNull(),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull(),
}, (table) => [index('idx_payment_plans_due_date').on(table.dueDate,table.status)]);

export const bankStatementRows = sqliteTable('bank_statement_rows', {
  id:text('id').primaryKey(),
  accountId:text('account_id').notNull(),
  occurredOn:text('occurred_on').notNull(),
  description:text('description').notNull(),
  amountCents:integer('amount_cents').notNull(),
  balanceCents:integer('balance_cents'),
  reference:text('reference').notNull().default(''),
  status:text('status').notNull().default('unmatched'),
  transactionId:text('transaction_id'),
  importedBy:text('imported_by').notNull(),
  importedAt:text('imported_at').notNull(),
}, (table) => [index('idx_bank_statement_account_date').on(table.accountId,table.occurredOn), index('idx_bank_statement_status').on(table.status)]);

export const notifications = sqliteTable('notifications', {
  id:text('id').primaryKey(),
  userId:text('user_id').notNull(),
  title:text('title').notNull(),
  message:text('message').notNull(),
  kind:text('kind').notNull().default('system'),
  dedupeKey:text('dedupe_key'),
  readAt:text('read_at'),
  createdAt:text('created_at').notNull(),
}, (table) => [index('idx_notifications_user_read').on(table.userId,table.readAt,table.createdAt), uniqueIndex('idx_notifications_dedupe').on(table.dedupeKey)]);

export const notificationSettings = sqliteTable('notification_settings', {
  id:integer('id').primaryKey(),
  emailWebhook:text('email_webhook').notNull().default(''),
  wechatWebhook:text('wechat_webhook').notNull().default(''),
  dingtalkWebhook:text('dingtalk_webhook').notNull().default(''),
  emailEnabled:integer('email_enabled', { mode:'boolean' }).notNull().default(false),
  wechatEnabled:integer('wechat_enabled', { mode:'boolean' }).notNull().default(false),
  dingtalkEnabled:integer('dingtalk_enabled', { mode:'boolean' }).notNull().default(false),
  updatedAt:text('updated_at').notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id:text('id').primaryKey(),
  userId:text('user_id').notNull(),
  userName:text('user_name').notNull(),
  action:text('action').notNull(),
  entityType:text('entity_type').notNull(),
  entityId:text('entity_id').notNull(),
  detail:text('detail').notNull().default(''),
  createdAt:text('created_at').notNull(),
}, (table) => [index('idx_audit_logs_created_at').on(table.createdAt), index('idx_audit_logs_entity').on(table.entityType,table.entityId)]);

export const deletedRecords = sqliteTable('deleted_records', {
  id:text('id').primaryKey(),
  entityType:text('entity_type').notNull(),
  entityId:text('entity_id').notNull(),
  label:text('label').notNull(),
  recordJson:text('record_json').notNull(),
  deletedBy:text('deleted_by').notNull(),
  deletedByName:text('deleted_by_name').notNull(),
  deletedAt:text('deleted_at').notNull(),
}, (table) => [index('idx_deleted_records_deleted_at').on(table.deletedAt)]);

export const backups = sqliteTable('backups', {
  id:text('id').primaryKey(),
  kind:text('kind').notNull(),
  fileKey:text('file_key').notNull(),
  size:integer('size').notNull(),
  createdBy:text('created_by').notNull(),
  createdAt:text('created_at').notNull(),
}, (table) => [index('idx_backups_created_at').on(table.createdAt)]);

export const notificationDeliveries = sqliteTable('notification_deliveries', {
  id:text('id').primaryKey(),
  channel:text('channel').notNull(),
  title:text('title').notNull(),
  message:text('message').notNull(),
  status:text('status').notNull(),
  responseCode:integer('response_code'),
  error:text('error').notNull().default(''),
  sourceKind:text('source_kind').notNull().default('system'),
  sourceId:text('source_id'),
  createdAt:text('created_at').notNull(),
  sentAt:text('sent_at'),
}, (table) => [index('idx_notification_deliveries_created').on(table.createdAt), index('idx_notification_deliveries_status').on(table.status,table.createdAt)]);

export const dailyJobRuns = sqliteTable('daily_job_runs', {
  id:text('id').primaryKey(),
  jobName:text('job_name').notNull(),
  runDate:text('run_date').notNull(),
  status:text('status').notNull(),
  detail:text('detail').notNull().default(''),
  startedAt:text('started_at').notNull(),
  completedAt:text('completed_at'),
}, (table) => [uniqueIndex('idx_daily_job_unique').on(table.jobName,table.runDate), index('idx_daily_job_started').on(table.startedAt)]);
