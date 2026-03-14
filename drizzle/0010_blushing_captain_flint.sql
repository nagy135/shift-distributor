ALTER TABLE `users` ADD `admin` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `users`
SET `admin` = 1
WHERE `role` IN ('shift_assigner', 'department_assigner');
