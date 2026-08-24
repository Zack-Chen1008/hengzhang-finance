CREATE TABLE `daily_job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_name` text NOT NULL,
	`run_date` text NOT NULL,
	`status` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_job_unique` ON `daily_job_runs` (`job_name`,`run_date`);--> statement-breakpoint
CREATE INDEX `idx_daily_job_started` ON `daily_job_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`response_code` integer,
	`error` text DEFAULT '' NOT NULL,
	`source_kind` text DEFAULT 'system' NOT NULL,
	`source_id` text,
	`created_at` text NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_notification_deliveries_created` ON `notification_deliveries` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notification_deliveries_status` ON `notification_deliveries` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `department_id` text;--> statement-breakpoint
CREATE INDEX `idx_users_department` ON `app_users` (`department_id`,`status`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `account_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `department_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `project_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `category_id` text;--> statement-breakpoint
CREATE INDEX `idx_transactions_department` ON `transactions` (`department_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_transactions_account` ON `transactions` (`account_id`,`created_at`);