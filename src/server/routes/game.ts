// Spielserver-Anbindung (FiveM-Ressource fivem/pitstop): Schlüssel je Firma, Dienst ein/aus, Notruf → Einsatz,
// Zahlung aus der Ingame-Bank → Rechnung bezahlt, Rundenzeiten, Fahrzeug- und Fahndungsabfrage, Kontostand.
// Aufruf mit „Authorization: Bearer pg_…“. Ein Schlüssel gilt nur für seine Firma.
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { calloutLabel, formatUsd } from '../../shared/format';
import type { GameKey } from '../../shared/types';
import { companyCtx } from '../auth/guards';
import { db, tx } from '../db/pool';
import { badRequest, conflict, forbidden, HttpError, notFound, parseBody, zCents, zRequired, zText } from '../errors';
import { audit } from '../repo/companies';
import { insertRow } from '../repo/records';
import { accountBalance } from './more';
import { idParam, type RouteOptions } from './util';

const hashKey = (k: string) => createHash('sha256').update(k).digest('hex');
const zPlayer = z.string().trim().min(1, 'Spieler fehlt').max(80);
const LIMIT = { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } };

interface GameCtx {
  companyId: string;
  name: string;
  modules: string[];
}

async function gameCtx(req: FastifyRequest): Promise<GameCtx> {
  const h = req.headers.authorization ?? '';
  const key = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!key.startsWith('pg_')) throw new HttpError(401, 'GAME_KEY', 'Spielserver-Schlüssel fehlt (Authorization: Bearer pg_…).');
  const { rows } = await db().query<GameCtx & { status: string }>(
    `UPDATE game_keys k SET last_used_at = now() FROM companies c
      WHERE k.hash = $1 AND NOT k.revoked AND c.id = k.company_id
      RETURNING c.id AS "companyId", c.name, c.modules, c.status`,
    [hashKey(key)],
  );
  if (!rows[0]) throw new HttpError(401, 'GAME_KEY', 'Spielserver-Schlüssel ungültig oder widerrufen.');
  if (rows[0].status === 'paused') throw forbidden('Die Firma ist pausiert.');
  return rows[0];
}
const needModule = (g: GameCtx, m: string) => {
  if (!g.modules.includes(m)) throw forbidden(`Modul ${m} ist in dieser Firma aus.`);
};

/** Spieler → Mitglied: Spiel-ID der Mitgliedschaft (z. B. license:…) oder verknüpfte Discord-ID („discord:123“ oder „123“). */
async function memberFor(g: GameCtx, player: string): Promise<{ userId: string; name: string }> {
  const discord = player.replace(/^discord:/, '');
  const { rows } = await db().query<{ userId: string; name: string }>(
    `SELECT m.user_id AS "userId", u.display_name AS name FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.company_id = $1 AND NOT m.locked AND u.active AND (m.game_id = $2 OR (u.discord_id IS NOT NULL AND u.discord_id = $3))
      LIMIT 1`,
    [g.companyId, player, discord],
  );
  if (!rows[0]) throw notFound('Spieler ist kein Mitglied dieser Firma (Spiel-ID unter Mitglieder & Zugänge eintragen oder Discord verknüpfen).');
  return rows[0];
}

export async function gameRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  // --- Schlüssel verwalten (in der Firma, Firmendaten verwalten) ------------
  app.get('/c/:companyId/game-keys', async (req): Promise<{ keys: GameKey[] }> => {
    const c = await companyCtx(req, cfg);
    c.need('firma', 3);
    const { rows } = await db().query<GameKey>('SELECT id, name, prefix, last_used_at AS "lastUsedAt", revoked, created_at AS "createdAt" FROM game_keys WHERE company_id = $1 ORDER BY created_at DESC', [c.company.id]);
    return { keys: rows };
  });
  app.post('/c/:companyId/game-keys', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('firma', 3);
    const { name } = parseBody(z.object({ name: zRequired(60) }), req.body);
    const key = `pg_${randomBytes(24).toString('base64url')}`;
    await db().query('INSERT INTO game_keys (company_id, name, prefix, hash, created_by) VALUES ($1, $2, $3, $4, $5)', [c.company.id, name, key.slice(0, 9), hashKey(key), c.user.id]);
    await audit(db(), c.company.id, c.user.id, 'Firma', `Spielserver-Schlüssel „${name}“ erstellt`);
    return { key };
  });
  app.post('/c/:companyId/game-keys/:id/revoke', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('firma', 3);
    const r = await db().query<{ name: string }>('UPDATE game_keys SET revoked = true WHERE company_id = $1 AND id = $2 AND NOT revoked RETURNING name', [c.company.id, idParam(req)]);
    if (!r.rowCount) throw notFound();
    await audit(db(), c.company.id, c.user.id, 'Firma', `Spielserver-Schlüssel „${r.rows[0].name}“ widerrufen`);
    return { ok: true };
  });

  // --- Aufrufe des Spielservers ---------------------------------------------
  app.get('/game/status', LIMIT, async (req) => {
    const g = await gameCtx(req);
    const { rows } = await db().query<{ name: string; gameId: string }>(
      `SELECT u.display_name AS name, m.game_id AS "gameId" FROM duty_sessions d JOIN users u ON u.id = d.user_id
         JOIN memberships m ON m.company_id = d.company_id AND m.user_id = d.user_id
        WHERE d.company_id = $1 AND d.ended_at IS NULL ORDER BY d.started_at`, [g.companyId],
    );
    const open = Number((await db().query<{ n: string }>("SELECT count(*) AS n FROM callouts WHERE company_id = $1 AND status <> 'erledigt'", [g.companyId])).rows[0].n);
    return { company: g.name, onDuty: rows, openCallouts: open };
  });

  // Dienst ein/aus (Stempeluhr)
  app.post('/game/duty', LIMIT, async (req) => {
    const g = await gameCtx(req);
    const b = parseBody(z.object({ player: zPlayer, on: z.boolean().optional() }), req.body);
    const m = await memberFor(g, b.player);
    const open = (await db().query('SELECT 1 FROM duty_sessions WHERE company_id = $1 AND user_id = $2 AND ended_at IS NULL', [g.companyId, m.userId])).rowCount;
    const on = b.on ?? !open;
    if (on && open) return { onDuty: true, name: m.name, changed: false };
    if (!on && !open) return { onDuty: false, name: m.name, changed: false };
    if (on) await db().query('INSERT INTO duty_sessions (company_id, user_id, note) VALUES ($1, $2, $3)', [g.companyId, m.userId, 'aus dem Spiel']);
    else await db().query('UPDATE duty_sessions SET ended_at = now() WHERE company_id = $1 AND user_id = $2 AND ended_at IS NULL', [g.companyId, m.userId]);
    await audit(db(), g.companyId, m.userId, 'Dienst', on ? 'Dienst begonnen (im Spiel)' : 'Dienst beendet (im Spiel)');
    return { onDuty: on, name: m.name, changed: true };
  });

  // Notruf → offener Einsatz in der Leitstelle
  app.post('/game/callouts', LIMIT, async (req) => {
    const g = await gameCtx(req);
    needModule(g, 'abschlepp');
    const b = parseBody(z.object({
      location: zRequired(120), x: z.number().min(-5000).max(9000).nullable().default(null), y: z.number().min(-5000).max(9000).nullable().default(null),
      requester: zText(80).default(''), vehicle: zText(80).default(''), feeCents: zCents.default(0),
    }), req.body);
    const row = await insertRow(db(), 'callouts', g.companyId, { ...b, status: 'offen' });
    await audit(db(), g.companyId, null, 'Abschleppdienst', `${calloutLabel(row.number)} Notruf aus dem Spiel: ${row.location}`);
    return { id: row.id, number: row.number, label: calloutLabel(row.number) };
  });

  // Zahlung aus der Ingame-Bank: Rechnung R-<nummer> bezahlt, Betrag muss stimmen
  app.post('/game/payments', LIMIT, async (req) => {
    const g = await gameCtx(req);
    needModule(g, 'finanzen');
    const b = parseBody(z.object({ bill: z.union([z.number().int().positive(), z.string().regex(/^(R-)?\d+$/i)]), amountCents: zCents, account: z.enum(['firma', 'kasse']).default('firma'), payer: zText(80).default('') }), req.body);
    const number = Number(String(b.bill).replace(/^R-/i, ''));
    return tx(async (q) => {
      const bill = (await q.query<{ id: string; amount: number; status: string; kind: string; title: string }>(
        'SELECT id, amount_cents AS amount, status, kind, title FROM bills WHERE company_id = $1 AND number = $2 FOR UPDATE', [g.companyId, number],
      )).rows[0];
      if (!bill) throw notFound(`Rechnung R-${number} gibt es nicht.`);
      if (bill.kind !== 'rechnung') throw conflict('Das ist ein Angebot, keine Rechnung.');
      if (bill.status !== 'offen') throw conflict(`R-${number} ist nicht offen (${bill.status}).`);
      if (b.amountCents !== bill.amount) throw badRequest(`Betrag stimmt nicht: offen sind ${formatUsd(bill.amount)}.`);
      await q.query("UPDATE bills SET status = 'bezahlt', paid_at = now() WHERE id = $1", [bill.id]);
      await insertRow(q, 'transactions', g.companyId, { account: b.account, amountCents: bill.amount, text: `R-${number} ${bill.title}`, category: 'Einnahme', billId: bill.id });
      await audit(q, g.companyId, null, 'Finanzen', `R-${number} im Spiel bezahlt${b.payer ? ` von ${b.payer}` : ''} (${formatUsd(bill.amount)})`);
      return { ok: true, bill: `R-${number}` };
    });
  });

  // Kontostand für das Bank-Skript
  app.get('/game/balance', LIMIT, async (req) => {
    const g = await gameCtx(req);
    needModule(g, 'finanzen');
    return { firma: await accountBalance(db(), g.companyId, 'firma'), kasse: await accountBalance(db(), g.companyId, 'kasse') };
  });

  // Rundenzeit aus dem Rennskript
  app.post('/game/laps', LIMIT, async (req) => {
    const g = await gameCtx(req);
    needModule(g, 'racing');
    const b = parseBody(z.object({
      track: zRequired(40), driver: zText(60).default(''), car: zText(6).optional(), session: zText(40).default('Training'),
      s1: z.number().int().min(1).max(3_600_000), s2: z.number().int().min(1).max(3_600_000), s3: z.number().int().min(1).max(3_600_000),
    }), req.body);
    const carId = b.car ? (await db().query<{ id: string }>('SELECT id FROM race_cars WHERE company_id = $1 AND number = $2', [g.companyId, b.car])).rows[0]?.id ?? null : null;
    const row = await insertRow(db(), 'laps', g.companyId, { carId, driver: b.driver, track: b.track, session: b.session, s1: b.s1, s2: b.s2, s3: b.s3 });
    return { id: row.id, lapMs: b.s1 + b.s2 + b.s3 };
  });

  // Fahrzeugabfrage (Kennzeichen) und Fahndung
  app.get('/game/vehicles/:plate', LIMIT, async (req) => {
    const g = await gameCtx(req);
    const plate = decodeURIComponent((req.params as { plate: string }).plate).toUpperCase().trim();
    const v = (await db().query<{ id: string; model: string; stolen: boolean; owner: string | null }>(
      'SELECT v.id, v.model, v.stolen, c.name AS owner FROM vehicles v LEFT JOIN customers c ON c.id = v.customer_id WHERE v.company_id = $1 AND upper(v.plate) = $2', [g.companyId, plate],
    )).rows[0];
    if (!v) return { plate, known: false, stolen: false };
    const open = (await db().query<{ number: number; title: string; status: string }>("SELECT number, title, status FROM orders WHERE vehicle_id = $1 AND status <> 'abgeholt' ORDER BY number", [v.id])).rows;
    return { plate, known: true, model: v.model, owner: v.owner, stolen: v.stolen, openOrders: open.map((o) => ({ label: `W-${o.number}`, title: o.title, status: o.status })) };
  });
  app.post('/game/vehicles/:plate/stolen', LIMIT, async (req) => {
    const g = await gameCtx(req);
    const plate = decodeURIComponent((req.params as { plate: string }).plate).toUpperCase().trim();
    const b = parseBody(z.object({ stolen: z.boolean(), by: zText(80).default('') }), req.body);
    const v = (await db().query<{ id: string }>('SELECT id FROM vehicles WHERE company_id = $1 AND upper(plate) = $2', [g.companyId, plate])).rows[0];
    if (!v) {
      if (!b.stolen) return { ok: true, known: false };
      // Unbekanntes Kennzeichen als Fahndung vormerken, damit die Annahme warnt
      await insertRow(db(), 'vehicles', g.companyId, { plate, model: '', note: `Fahndung aus dem Spiel${b.by ? ` (${b.by})` : ''}` });
    }
    await db().query('UPDATE vehicles SET stolen = $3 WHERE company_id = $1 AND upper(plate) = $2', [g.companyId, plate, b.stolen]);
    await audit(db(), g.companyId, null, 'Fahrzeuge', `${plate} ${b.stolen ? 'als gestohlen gemeldet' : 'aus der Fahndung genommen'} (Spiel${b.by ? `, ${b.by}` : ''})`);
    return { ok: true, known: !!v };
  });

}
