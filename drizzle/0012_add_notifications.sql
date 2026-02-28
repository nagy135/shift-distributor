CREATE TABLE `notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES users(id),
  `message` text NOT NULL,
  `is_read` integer DEFAULT false NOT NULL,
  `created_at` integer
);
