// Server-Einstellungen (Tabelle settings, Schlüssel 'server'), im Speicher zwischengespeichert.
import type { ServerSettings } from '../shared/types';
import type { Queryable } from './db/pool';

export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  maintenance: false,
  maintenanceText: 'Pitstop wird gerade gewartet. Bitte später noch einmal versuchen.',
  defaultModules: ['werkstatt', 'abschlepp', 'tuning', 'racing', 'kunden', 'personal', 'schulungen', 'finanzen'],
  backupHour: 4,
  backupKeep: 14,
};

let cache: ServerSettings = DEFAULT_SERVER_SETTINGS;

export const serverSettings = (): ServerSettings => cache;

export async function loadServerSettings(q: Queryable): Promise<ServerSettings> {
  const { rows } = await q.query<{ value: Partial<ServerSettings> }>("SELECT value FROM settings WHERE key = 'server'");
  cache = { ...DEFAULT_SERVER_SETTINGS, ...(rows[0]?.value ?? {}) };
  return cache;
}

export async function saveServerSettings(q: Queryable, patch: Partial<ServerSettings>): Promise<ServerSettings> {
  const next = { ...cache, ...patch };
  await q.query(
    "INSERT INTO settings (key, value) VALUES ('server', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [JSON.stringify(next)],
  );
  cache = next;
  return cache;
}

/** Kleiner Merker in settings (z. B. letzte automatische Sicherung). */
export async function getMark<T>(q: Queryable, key: string, fallback: T): Promise<T> {
  const { rows } = await q.query<{ value: T }>('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? fallback;
}
export async function setMark(q: Queryable, key: string, value: unknown): Promise<void> {
  await q.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()', [key, JSON.stringify(value)]);
}
