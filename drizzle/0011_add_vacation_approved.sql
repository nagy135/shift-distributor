ALTER TABLE vacation_days ADD COLUMN approved integer DEFAULT false NOT NULL;
UPDATE vacation_days SET approved = false WHERE approved IS NULL;
