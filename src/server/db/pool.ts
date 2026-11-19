import pg from 'pg';
import type { Config } from '../config';

// Typ-Parser: date bleibt 'YYYY-MM-DD' (kein Zeitzonen-Versatz), numeric/int8 werden Zahlen,
// timestamptz wird ein ISO-String.
const parseTimestamptz = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ);
pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v: string) => parseFloat(v));
pg.types.setTypeParser(pg.types.builtins.INT8, (v: string) => parseInt(v, 10));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v: string) => (parseTimestamptz(v) as Date).toISOString());

export type Queryable = pg.Pool | pg.PoolClient;

let pool: pg.Pool | null = null;

export function initPool(cfg: Pick<Config, 'db'>): pg.Pool {
  pool = new pg.Pool({ ...cfg.db, max: 10, idleTimeoutMillis: 30_000 });
  pool.on('error', () => {
    // Verbindungsfehler im Leerlauf; die nächste Abfrage baut neu auf.
  });
  return pool;
}

export function db(): pg.Pool {
  if (!pool) throw new Error('Datenbank-Pool ist nicht initialisiert.');
  return pool;
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}
