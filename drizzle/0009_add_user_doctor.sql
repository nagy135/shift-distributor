ALTER TABLE users ADD COLUMN doctor_id integer REFERENCES doctors(id);
