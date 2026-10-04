const { readFileSync, mkdirSync } = require("node:fs");
const { resolve, dirname, join } = require("node:path");
const { createHash } = require("node:crypto");
const Database = require("better-sqlite3");

function migrateDatabase(
  sqlite,
  folder = resolve(__dirname, "../drizzle"),
  until = Infinity,
) {
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, hash text NOT NULL, created_at numeric)",
  );
  const latest =
    sqlite
      .prepare("SELECT MAX(created_at) AS timestamp FROM __drizzle_migrations")
      .get().timestamp ?? 0;
  const hasDoctors = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE name = 'doctors'")
    .get();
  if (hasDoctors && !latest)
    throw new Error(
      "Existing database has no migration history. Restore a known backup before migrating.",
    );
  const journal = JSON.parse(
    readFileSync(join(folder, "meta/_journal.json"), "utf8"),
  );
  sqlite.pragma("foreign_keys = OFF");
  try {
    for (const entry of journal.entries) {
      if (entry.when <= latest || entry.when > until) continue;
      const sql = readFileSync(join(folder, entry.tag + ".sql"), "utf8");
      sqlite.transaction(() => {
        // Some legacy migrations were applied outside the journal. Skip only verified existing columns/tables.
        for (const statement of sql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter(Boolean)) {
          if (/^PRAGMA foreign_keys/i.test(statement)) {
            const rest = statement
              .replace(/^PRAGMA foreign_keys\s*=\s*(?:ON|OFF);?/i, "")
              .trim();
            if (rest) sqlite.exec(rest);
            continue;
          }
          const alter = statement.match(
            /^ALTER TABLE [`"]?(\w+)[`"]? ADD (?:COLUMN )?[`"]?(\w+)/i,
          );
          if (
            alter &&
            sqlite
              .prepare(`PRAGMA table_info("${alter[1]}")`)
              .all()
              .some((c) => c.name === alter[2])
          )
            continue;
          const create = statement.match(/^CREATE TABLE [`"]?(\w+)[`"]?/i);
          if (
            create &&
            sqlite
              .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
              )
              .get(create[1])
          )
            throw new Error("Unexpected existing table: " + create[1]);
          sqlite.exec(statement);
        }
        if (sqlite.pragma("foreign_key_check").length)
          throw new Error(
            "Migration would leave invalid foreign keys: " + entry.tag,
          );
        sqlite
          .prepare(
            "INSERT INTO __drizzle_migrations(hash, created_at) VALUES (?, ?)",
          )
          .run(createHash("sha256").update(sql).digest("hex"), entry.when);
      })();
    }
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
  if (sqlite.pragma("integrity_check", { simple: true }) !== "ok")
    throw new Error("Database integrity check failed");
}

module.exports = { migrateDatabase };
if (require.main === module) {
  require("@next/env").loadEnvConfig(process.cwd());
  const filename = resolve(process.env.DATABASE_PATH ?? "./data/sqlite.db");
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const sqlite = new Database(filename);
  try {
    migrateDatabase(sqlite);
    console.log("Migrations complete:", filename);
  } finally {
    sqlite.close();
  }
}
