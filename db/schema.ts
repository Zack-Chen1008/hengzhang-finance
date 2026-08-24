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
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_transactions_created_at').on(table.createdAt)]);

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
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_users_email').on(table.email), index('idx_users_auth_user_id').on(table.authUserId)]);

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
