CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`file_key` text NOT NULL,
	`size` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_backups_created_at` ON `backups` (`created_at`);--> statement-breakpoint
CREATE TABLE `bank_statement_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`occurred_on` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`balance_cents` integer,
	`reference` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'unmatched' NOT NULL,
	`transaction_id` text,
	`imported_by` text NOT NULL,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bank_statement_account_date` ON `bank_statement_rows` (`account_id`,`occurred_on`);--> statement-breakpoint
CREATE INDEX `idx_bank_statement_status` ON `bank_statement_rows` (`status`);--> statement-breakpoint
CREATE TABLE `deleted_records` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`label` text NOT NULL,
	`record_json` text NOT NULL,
	`deleted_by` text NOT NULL,
	`deleted_by_name` text NOT NULL,
	`deleted_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_deleted_records_deleted_at` ON `deleted_records` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`invoice_number` text NOT NULL,
	`counterparty` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`transaction_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invoices_number` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_invoices_due_date` ON `invoices` (`due_date`,`status`);--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`email_webhook` text DEFAULT '' NOT NULL,
	`wechat_webhook` text DEFAULT '' NOT NULL,
	`dingtalk_webhook` text DEFAULT '' NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`wechat_enabled` integer DEFAULT false NOT NULL,
	`dingtalk_enabled` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`kind` text DEFAULT 'system' NOT NULL,
	`dedupe_key` text,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notifications_dedupe` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `organization_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_organization_items_kind` ON `organization_items` (`kind`,`status`);--> statement-breakpoint
CREATE TABLE `payment_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`counterparty` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invoice_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_payment_plans_due_date` ON `payment_plans` (`due_date`,`status`);