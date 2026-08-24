CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token_hash` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`email` text PRIMARY KEY NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `password_reset_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text NOT NULL,
	`processed_at` text,
	`processed_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_reset_requests_status` ON `password_reset_requests` (`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `idx_reset_requests_user_id` ON `password_reset_requests` (`user_id`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_salt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `must_change_password` integer DEFAULT true NOT NULL;