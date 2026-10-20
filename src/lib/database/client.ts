import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export class StorageUnavailableError extends Error {
  constructor(message = 'Persistent storage is not configured. Reports cannot be saved on this deployment.') { super(message); this.name = 'StorageUnavailableError'; }
}
export function getStorageStatus() {
  const url = process.env.DATABASE_URL;
  const deployed = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
  const remote = Boolean(url && /^(libsql|https):\/\//.test(url));
  const available = deployed ? remote && Boolean(process.env.DATABASE_AUTH_TOKEN) : !url || /^file:/.test(url) || remote;
  return { available, mode: available ? remote ? 'remote-libsql' : 'local-sqlite' : 'unavailable', persistent: available, deployed } as const;
}
export type Database = { client: Client; orm: ReturnType<typeof drizzle<typeof schema>>; mode: string };
const connections = new Map<string, Promise<Database>>();
export async function getDatabase(): Promise<Database> {
  const status = getStorageStatus();
  if (!status.available) throw new StorageUnavailableError();
  const url = process.env.DATABASE_URL || 'file:./data/accesspath.db';
  const key = `${url}:${process.env.DATABASE_AUTH_TOKEN ?? ''}`;
  let connection = connections.get(key);
  if (!connection) {
    connection = (async () => {
      if (url.startsWith('file:')) await mkdir(dirname(resolve(url.slice(5))), { recursive: true });
      // A single local connection keeps PRAGMA foreign_keys active for every operation.
      // libSQL batches below provide atomic writes without holding an interactive transaction.
      const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN, concurrency: 1 });
      await client.execute('PRAGMA foreign_keys = ON');
      if (url.startsWith('file:')) await client.execute('PRAGMA busy_timeout = 5000');
      return { client, orm: drizzle(client, { schema }), mode: status.mode };
    })();
    connections.set(key, connection);
  }
  return connection;
}
export async function initializeDatabase(database?: Database): Promise<Database> {
  const db = database ?? await getDatabase();
  const migration = await readFile(resolve(process.cwd(), 'drizzle/0000_initial.sql'), 'utf8');
  await db.client.executeMultiple(migration);
  // Acquire the write transaction before checking the version, so simultaneous
  // server starts cannot both rebuild reports. Existing reports remain intact.
  const transaction = await db.client.transaction('write');
  try {
    const applied = await transaction.execute('SELECT version FROM schema_migrations WHERE version=2');
    if (applied.rows.length === 0) {
      const optionalDescription = await readFile(resolve(process.cwd(), 'drizzle/0001_optional_report_description.sql'), 'utf8');
      for (const statement of optionalDescription.split(';').map((part) => part.trim()).filter(Boolean)) await transaction.execute(statement);
    }
    const worldMigration = await readFile(resolve(process.cwd(), 'drizzle/0002_world_obstacles.sql'), 'utf8');
    for (const statement of worldMigration.split(';').map(part => part.trim()).filter(Boolean)) await transaction.execute(statement);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally { transaction.close(); }
  return db;
}
export async function closeDatabases() {
  for (const database of connections.values()) (await database).client.close();
  connections.clear();
}
