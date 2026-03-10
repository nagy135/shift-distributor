CREATE TABLE `unavailable_date_change_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doctor_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`added_count` integer DEFAULT 0 NOT NULL,
	`removed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `unavailable_date_change_log_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`log_id` integer NOT NULL,
	`month` text NOT NULL,
	`day_in_month` integer NOT NULL,
	`change_type` text NOT NULL,
	FOREIGN KEY (`log_id`) REFERENCES `unavailable_date_change_logs`(`id`) ON UPDATE no action ON DELETE no action
);
