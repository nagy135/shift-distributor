PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`shift_type` text NOT NULL,
	`doctor_ids` text DEFAULT '[]' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_shifts` ("id", "date", "shift_type", "doctor_ids", "created_at")
SELECT
	"id",
	"date",
	"shift_type",
	CASE
		WHEN "doctor_id" IS NULL THEN '[]'
		ELSE json_array("doctor_id")
	END,
	"created_at"
FROM `shifts`;
--> statement-breakpoint
DROP TABLE `shifts`;--> statement-breakpoint
ALTER TABLE `__new_shifts` RENAME TO `shifts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;

