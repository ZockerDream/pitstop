import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { db } from './pool';

const LOCK_KEY = 74_210_001;

/** Lokal liegen die Migrationen unter src/, im Image unter dist/server/migrations. */
function migrationsDir(): string {
  const candidates = [path.join(process.cwd(), 'src/server/db/migrations'), path.join(process.cwd(), 'dist/server/migrations')];
  const dir = candidates.find((d) => existsSync(d));
  if (!dir) throw new Error(`Migrationsordner nicht gefunden (gesucht: ${candidates.join(', ')})`);
  return dir;
}

export async function migrate(log: Logger): Promise<void> {
  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  const client = await db().connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(path.join(dir, file), 'utf8');
      log.info({ migration: file }, 'Wende Migration an');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} fehlgeschlagen: ${(err as Error).message}`, { cause: err });
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}
