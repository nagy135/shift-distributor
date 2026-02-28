CREATE TABLE `vacation_days` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `doctor_id` integer NOT NULL REFERENCES doctors(id),
  `date` text NOT NULL,
  `color` text NOT NULL,
  `created_at` integer
);
