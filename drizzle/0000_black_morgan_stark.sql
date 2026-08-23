CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`counterparty` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
