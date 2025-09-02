PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_doctors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'black',
	`unavailable_shift_types` text DEFAULT '[]' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_doctors`("id", "name", "color", "unavailable_shift_types", "created_at") SELECT "id", "name", "color", "unavailable_shift_types", "created_at" FROM `doctors`;--> statement-breakpoint
DROP TABLE `doctors`;--> statement-breakpoint
ALTER TABLE `__new_doctors` RENAME TO `doctors`;--> statement-breakpoint
PRAGMA foreign_keys=ON;