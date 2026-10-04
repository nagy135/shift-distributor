UPDATE doctors SET unavailable_shift_types = json_extract(unavailable_shift_types, '$') WHERE json_type(unavailable_shift_types) = 'text';
--> statement-breakpoint
UPDATE shifts SET shift_type = CASE shift_type WHEN 'INT-1' THEN 'ITS-1' WHEN 'INT-2' THEN 'ITS-2' WHEN 'ND' THEN 'night' ELSE shift_type END;
--> statement-breakpoint
DELETE FROM shifts WHERE shift_type = 'ND-frei' AND doctor_ids = '[]';
--> statement-breakpoint
UPDATE shifts SET doctor_ids = COALESCE((SELECT json_group_array(DISTINCT CAST(j.value AS INTEGER)) FROM shifts s, json_each(s.doctor_ids) j WHERE s.date = shifts.date AND s.shift_type = shifts.shift_type), '[]');
--> statement-breakpoint
DELETE FROM shifts WHERE id NOT IN (SELECT MIN(id) FROM shifts GROUP BY date, shift_type);
--> statement-breakpoint
DELETE FROM unavailable_dates WHERE id NOT IN (SELECT MIN(id) FROM unavailable_dates GROUP BY doctor_id, date);
--> statement-breakpoint
CREATE UNIQUE INDEX shifts_date_type_unique ON shifts(date, shift_type);
--> statement-breakpoint
CREATE TABLE __new_vacation_days (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, doctor_id integer NOT NULL REFERENCES doctors(id), date text NOT NULL, color text NOT NULL, approved integer NOT NULL DEFAULT 0, created_at integer);
--> statement-breakpoint
INSERT INTO __new_vacation_days SELECT id, doctor_id, date, color, approved, created_at FROM vacation_days;
--> statement-breakpoint
DROP TABLE vacation_days;
--> statement-breakpoint
ALTER TABLE __new_vacation_days RENAME TO vacation_days;
--> statement-breakpoint
CREATE UNIQUE INDEX vacation_doctor_date_unique ON vacation_days(doctor_id, date);
--> statement-breakpoint
CREATE UNIQUE INDEX unavailable_doctor_date_unique ON unavailable_dates(doctor_id, date);
--> statement-breakpoint
ALTER TABLE shifts ADD COLUMN version integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE calendar_email_deliveries (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, delivery_key text NOT NULL, status text NOT NULL, message_id text, output_path text, created_at integer NOT NULL);

--> statement-breakpoint
CREATE UNIQUE INDEX calendar_email_deliveries_delivery_key_unique ON calendar_email_deliveries(delivery_key);
