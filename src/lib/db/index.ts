import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Ensure data directory exists with proper permissions
const dataDir = './data';
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true, mode: 0o777 });
}

const dbPath = join(dataDir, 'sqlite.db');
const sqlite = new Database(dbPath, {
  fileMustExist: false
});
export const db = drizzle(sqlite, { schema }); 
