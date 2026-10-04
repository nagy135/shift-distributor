ALTER TABLE doctors ADD COLUMN color text DEFAULT 'black';
--> statement-breakpoint
ALTER TABLE doctors ADD COLUMN unavailable_shift_types text NOT NULL DEFAULT '[]';
