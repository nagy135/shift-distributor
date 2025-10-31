const { existsSync, readFileSync } = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const rootDir = process.cwd();
const dbPath = path.resolve(rootDir, 'data', 'sqlite.db');

if (!existsSync(dbPath)) {
  process.exit(0);
}

const db = new Database(dbPath);

try {
  const doctorsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'doctors'")
    .get();

  if (!doctorsTable) {
    db.close();
    process.exit(0);
  }

  db.exec(
    'CREATE TABLE IF NOT EXISTS "__drizzle_migrations" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "hash" text NOT NULL, "created_at" numeric)'
  );

  const migrationCount = db
    .prepare('SELECT COUNT(*) AS count FROM "__drizzle_migrations"')
    .get();

  if (migrationCount && migrationCount.count > 0) {
    db.close();
    process.exit(0);
  }

  const journalPath = path.resolve(rootDir, 'drizzle', 'meta', '_journal.json');
  if (!existsSync(journalPath)) {
    db.close();
    process.exit(0);
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const baselineTags = new Set([
    '0000_lovely_genesis',
    '0001_fearless_otto_octavius',
    '0002_lowly_guardsmen',
    '0003_outstanding_ken_ellis',
    '0004_clever_radioactive_man',
  ]);

  const entries = Array.isArray(journal.entries)
    ? journal.entries.filter((entry) => baselineTags.has(entry.tag))
    : [];

  if (entries.length === 0) {
    db.close();
    process.exit(0);
  }

  const insert = db.prepare('INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)');
  const insertBaseline = db.transaction((records) => {
    records
      .sort((a, b) => Number(a.when) - Number(b.when))
      .forEach((record) => {
        insert.run(`baseline-${record.tag}`, record.when);
      });
  });

  insertBaseline(entries);
} finally {
  db.close();
}


