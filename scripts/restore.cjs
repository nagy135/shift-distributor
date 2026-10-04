const { resolve, dirname } = require("node:path");
const { existsSync, mkdirSync, chmodSync } = require("node:fs");
const Database = require("better-sqlite3");
require("@next/env").loadEnvConfig(process.cwd());

async function restore() {
  const source = process.argv[2];
  const target =
    process.argv[3] ?? process.env.DATABASE_PATH ?? "./data/review/sqlite.db";
  if (!source)
    throw new Error(
      "Usage: npm run db:restore -- <backup> [new database path]",
    );
  if (existsSync(resolve(target)))
    throw new Error(
      "Target already exists. Choose a new path to preserve existing data.",
    );
  mkdirSync(dirname(resolve(target)), { recursive: true, mode: 0o700 });
  const sqlite = new Database(resolve(source), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    if (sqlite.pragma("integrity_check", { simple: true }) !== "ok")
      throw new Error("Invalid backup");
    await sqlite.backup(resolve(target));
    chmodSync(resolve(target), 0o600);
    console.log("Restored working copy:", resolve(target));
  } finally {
    sqlite.close();
  }
}
restore().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
