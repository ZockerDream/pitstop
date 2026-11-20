// Serverweite Funktionen ab 0.4: Einstellungen (Wartung, Standard-Module, Sicherungsplan), Anbindungen (Katalog, Wünsche,
// API-Schlüssel), öffentliche Nur-Lese-API /api/v1 und die Hintergrundjobs (automatische Sicherung, Daueraufträge).
import { createHash, randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import { z } from 'zod';
import { INTEGRATIONS } from '../../shared/integrations';
import { MODULES } from '../../shared/permissions';
import type { ApiKey } from '../../shared/types';
import { requireServerAdmin } from '../auth/guards';
import type { Config } from '../config';
import { db, tx } from '../db/pool';
import { badRequest, HttpError, notFound, parseBody, zRequired, zText } from '../errors';
import { audit } from '../repo/companies';
import { getMark, loadServerSettings, saveServerSettings, serverSettings, setMark } from '../settings';
import { runStandingOrders } from './more';
import { createBackup } from './server';
import { idParam, type RouteOptions } from './util';

const settingsSchema = z.object({
  maintenance: z.boolean().optional(),
  maintenanceText: zText(300).optional(),
  defaultModules: z.array(z.enum(MODULES.filter((m) => m.optional).map((m) => m.id) as [string, ...string[]])).optional(),
  backupHour: z.number().int().min(0).max(23).nullable().optional(),
  backupKeep: z.number().int().min(1).max(365).optional(),
});

const hashKey = (k: string) => createHash('sha256').update(k).digest('hex');

/** API-Schlüssel aus „Authorization: Bearer ps_…“ prüfen. */
async function requireApiKey(req: FastifyRequest): Promise<void> {
  const h = req.headers.authorization ?? '';
  const key = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!key) throw new HttpError(401, 'API_KEY', 'API-Schlüssel fehlt (Authorization: Bearer …).');
  const r = await db().query('UPDATE api_keys SET last_used_at = now() WHERE hash = $1 AND NOT revoked RETURNING id', [hashKey(key)]);
  if (!r.rowCount) throw new HttpError(401, 'API_KEY', 'API-Schlüssel ungültig oder widerrufen.');
}

async function publicCompany(id: string): Promise<{ id: string; name: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const { rows } = await db().query<{ id: string; name: string }>("SELECT id, name FROM companies WHERE id = $1 AND status = 'active' AND coalesce((extra->>'publicData')::boolean, false)", [id]);
  if (!rows[0]) throw notFound('Firma nicht gefunden oder nicht öffentlich.');
  return rows[0];
}

export async function platformRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  // --- Einstellungen --------------------------------------------------------
  app.get('/server/settings', async (req) => {
    requireServerAdmin(req);
    return { settings: await loadServerSettings(db()) };
  });
  app.patch('/server/settings', async (req) => {
    const me = requireServerAdmin(req);
    const b = parseBody(settingsSchema, req.body);
    const s = await saveServerSettings(db(), Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)));
    await audit(db(), null, me.id, 'Einstellungen', `Server-Einstellungen geändert (${Object.keys(b).join(', ')})${b.maintenance !== undefined ? ` – Wartungsmodus ${b.maintenance ? 'an' : 'aus'}` : ''}`);
    return { settings: s };
  });

  // --- Anbindungen: Wünsche -------------------------------------------------
  app.get('/server/integrations', async (req) => {
    const me = requireServerAdmin(req);
    const { rows } = await db().query<{ key: string; n: number; mine: boolean }>('SELECT key, count(*)::int AS n, bool_or(user_id = $1) AS mine FROM integration_votes GROUP BY key', [me.id]);
    return { integrations: INTEGRATIONS.map((i) => ({ ...i, votes: rows.find((r) => r.key === i.key)?.n ?? 0, voted: rows.find((r) => r.key === i.key)?.mine ?? false })) };
  });
  app.post('/server/integrations/:key/vote', async (req) => {
    const me = requireServerAdmin(req);
    const key = (req.params as Record<string, string>).key;
    const i = INTEGRATIONS.find((x) => x.key === key);
    if (!i) throw notFound();
    if (i.status === 'verfügbar') throw badRequest('Das gibt es schon.');
    const del = await db().query('DELETE FROM integration_votes WHERE key = $1 AND user_id = $2', [key, me.id]);
    if (!del.rowCount) await db().query('INSERT INTO integration_votes (key, user_id) VALUES ($1, $2)', [key, me.id]);
    return { voted: !del.rowCount };
  });

  // --- API-Schlüssel --------------------------------------------------------
  app.get('/server/api-keys', async (req): Promise<{ keys: ApiKey[] }> => {
    requireServerAdmin(req);
    const { rows } = await db().query<ApiKey>('SELECT id, name, prefix, last_used_at AS "lastUsedAt", revoked, created_at AS "createdAt" FROM api_keys ORDER BY created_at DESC');
    return { keys: rows };
  });
  app.post('/server/api-keys', async (req) => {
    const me = requireServerAdmin(req);
    const { name } = parseBody(z.object({ name: zRequired(60) }), req.body);
    const key = `ps_${randomBytes(24).toString('base64url')}`;
    await db().query('INSERT INTO api_keys (name, prefix, hash, created_by) VALUES ($1, $2, $3, $4)', [name, key.slice(0, 9), hashKey(key), me.id]);
    await audit(db(), null, me.id, 'Anbindungen', `API-Schlüssel „${name}“ erstellt`);
    return { key };
  });
  app.post('/server/api-keys/:id/revoke', async (req) => {
    const me = requireServerAdmin(req);
    const r = await db().query<{ name: string }>('UPDATE api_keys SET revoked = true WHERE id = $1 AND NOT revoked RETURNING name', [idParam(req)]);
    if (!r.rowCount) throw notFound();
    await audit(db(), null, me.id, 'Anbindungen', `API-Schlüssel „${r.rows[0].name}“ widerrufen`);
    return { ok: true };
  });

  // --- Öffentliche API (nur lesen, nur freigegebene Firmen) -----------------
  app.get('/v1/companies', async (req) => {
    await requireApiKey(req);
    const { rows } = await db().query("SELECT id, name, short FROM companies WHERE status = 'active' AND coalesce((extra->>'publicData')::boolean, false) ORDER BY name");
    return { companies: rows };
  });
  app.get('/v1/companies/:id/prices', async (req) => {
    await requireApiKey(req);
    const co = await publicCompany(idParam(req));
    const { rows } = await db().query('SELECT name, area, price_cents AS "priceCents" FROM services WHERE company_id = $1 ORDER BY area, name', [co.id]);
    return { company: co.name, prices: rows };
  });
  app.get('/v1/companies/:id/events', async (req) => {
    await requireApiKey(req);
    const co = await publicCompany(idParam(req));
    const { rows } = await db().query(
      `SELECT e.name, e.kind, e.starts_at AS "startsAt", e.track, e.laps, e.fee_cents AS "feeCents", e.prize_cents AS "prizeCents", e.max_entries AS "maxEntries",
              (SELECT count(*)::int FROM race_entries x WHERE x.event_id = e.id) AS entries
         FROM race_events e WHERE e.company_id = $1 AND e.status IN ('planung', 'offen') AND e.starts_at > now() - interval '1 day' ORDER BY e.starts_at LIMIT 50`,
      [co.id],
    );
    return { company: co.name, events: rows };
  });
  app.get('/v1/companies/:id/leaderboard', async (req) => {
    await requireApiKey(req);
    const co = await publicCompany(idParam(req));
    const { rows } = await db().query(
      `SELECT track, driver, min(ms)::int AS "bestMs" FROM (
          SELECT e.track, x.driver, x.lap_ms AS ms FROM race_entries x JOIN race_events e ON e.id = x.event_id WHERE x.company_id = $1 AND x.lap_ms IS NOT NULL
          UNION ALL SELECT track, driver, s1 + s2 + s3 FROM laps WHERE company_id = $1 AND driver <> '') t
        GROUP BY track, driver ORDER BY track, "bestMs" LIMIT 500`,
      [co.id],
    );
    return { company: co.name, laps: rows };
  });
  void cfg;
}

/** Hintergrundjobs: alle 10 Minuten Daueraufträge buchen und zur eingestellten Stunde einmal am Tag sichern. */
export function startJobs(cfg: Config, log: Logger): () => void {
  const tick = async () => {
    try {
      const n = await tx((q) => runStandingOrders(q, null, null));
      if (n) log.info(`${n} Daueraufträge gebucht`);
      const s = await loadServerSettings(db());
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      if (s.backupHour !== null && now.getHours() >= s.backupHour && (await getMark(db(), 'backup_last_auto', '')) !== day) {
        const file = await createBackup(cfg);
        const list = [...(await getMark<string[]>(db(), 'backup_auto', [])), file.name];
        const drop = list.slice(0, Math.max(0, list.length - s.backupKeep));
        for (const name of drop) rmSync(path.join(cfg.dataDir, 'backups', name), { force: true });
        await setMark(db(), 'backup_auto', list.slice(drop.length));
        await setMark(db(), 'backup_last_auto', day);
        await audit(db(), null, null, 'Sicherung', `Automatische Sicherung ${file.name}${drop.length ? `, ${drop.length} alte entfernt` : ''}`);
        log.info(`Automatische Sicherung ${file.name}`);
      }
    } catch (err) {
      log.error({ err }, 'Hintergrundjob fehlgeschlagen');
    }
  };
  const first = setTimeout(() => void tick(), 15_000);
  const t = setInterval(() => void tick(), 10 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(t);
  };
}

export { serverSettings };
