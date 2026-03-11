CREATE TABLE `month_publications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`is_published` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`published_by_user_id` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`published_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `month_publications_month_unique` ON `month_publications` (`month`);
