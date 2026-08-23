import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
