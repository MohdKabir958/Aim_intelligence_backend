import { PrismaClient } from '@prisma/client';
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chat.db');
console.log(`📁 [Database] Path: ${dbPath}`);

// Create better-sqlite3 database connection
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Create the Prisma adapter (Prisma 6 compatible)
const adapter = new PrismaBetterSQLite3(db);

// Create Prisma client with the adapter
const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
});

export default prisma;
export { db };
