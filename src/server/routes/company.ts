// Firma: Gesamtstand (Bootstrap), Firmendaten, Module, Mitglieder, Gruppen, Ausnahmen, Protokoll, Kartenbild, Export.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AREA_IDS, MODULES, SPECIALS, type Area } from '../../shared/permissions';
import type { CompanyData, PartUse, Post, RuleDoc } from '../../shared/types';
import { generatePassword, hashPassword } from '../auth/password';
import { companyCtx } from '../auth/guards';
import { db, tx } from '../db/pool';
import { badRequest, conflict, forbidden, notFound, parseBody, zId, zRequired, zText } from '../errors';
import { audit, listAudit, listExceptions, listGroups, listMembers, mapFile, updateCompany } from '../repo/companies';
import { listRows } from '../repo/records';
import { courseView, listCourses, listProgress, loadTuning } from './modules';
import { getUserWithHashByEmail, insertUser } from '../repo/users';
import { toCsv, EXPORT_SETS, exportRows } from './export';
import { idParam, type RouteOptions } from './util';

const zLevel = z.enum(['x', '0', '1', '2', '3']);
const levelsSchema = z.record(z.string(), zLevel).refine((o) => Object.keys(o).every((k) => (AREA_IDS as string[]).includes(k)), 'Unbekannter Bereich');
const groupSchema = z.object({
  name: zRequired(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Farbe als #rrggbb'),
  description: zText(300),
  levels: levelsSchema,
  own: z.record(z.string(), z.boolean()),
  specials: z.record(z.string(), z.union([z.boolean(), z.number().int().min(0).max(100_000_000)])).refine(
    (o) => Object.keys(o).every((k) => SPECIALS.some((s) => s.key === k)),
    'Unbekanntes Sonderrecht',
  ),
});

const companySchema = z.object({
  name: zRequired(80).optional(),
  short: zText(8).optional(),
  info: z.object({ address: zText(120).optional(), phone: zText(40).optional(), hours: zText(80).optional(), discord: zText(120).optional() }).optional(),
  lockWins: z.boolean().optional(),
  supportAccess: z.boolean().optional(),
  mapBounds: z.object({ x0: z.number(), x1: z.number(), y0: z.number(), y1: z.number() }).refine((b) => b.x1 > b.x0 && b.y1 > b.y0, 'Ränder vertauscht').optional(),
});

const memberSchema = z.object({ rank: zText(60).optional(), phone: zText(40).optional(), locked: z.boolean().optional(), groups: z.array(zId).optional(), gameId: zText(80).optional() });
const inviteSchema = z.object({ email: z.email({ message: 'Ungültige E-Mail-Adresse' }), displayName: zRequired(80), rank: zText(60).default(''), groups: z.array(zId).default([]) });
const exceptionSchema = z.object({
  userId: zId,
  area: z.enum(AREA_IDS as [string, ...string[]]),
  level: z.enum(['x', '1', '2', '3']),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum').nullable().default(null),
  reason: zText(200).default(''),
});

const EXPORT_AREA: Record<string, Area> = {
  kunden: 'kunden', fahrzeuge: 'fahrzeuge', auftraege: 'auftraege', einsaetze: 'leitstelle', rechnungen: 'rechnungen', buchungen: 'buchungen',
  dienstzeiten: 'dienstzeiten', mitglieder: 'mitarbeiter', protokoll: 'protokoll', lager: 'lager', dienstplan: 'dienstplan', lohn: 'lohn',
  nachweise: 'schulungen', rennen: 'racing',
};

export async function companyRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  app.get('/c/:companyId/bootstrap', async (req): Promise<CompanyData> => {
    const c = await companyCtx(req, cfg);
    const q = db();
    const id = c.company.id;
    const r = c.rights.areas;
    const me = c.user.id;
    const own = (area: keyof typeof r, sql: string) => (r[area].own ? sql : '');
    const [members, groups, exceptions, customers, vehicles, orders, callouts, bills, transactions, duty] = await Promise.all([
      listMembers(q, id),
      r.gruppen.level || r.zugaenge.level ? listGroups(q, id) : Promise.resolve([]),
      r.gruppen.level || r.zugaenge.level ? listExceptions(q, id) : Promise.resolve([]),
      r.kunden.level ? listRows(q, 'customers', id) : Promise.resolve([]),
      r.fahrzeuge.level || r.kunden.level ? listRows(q, 'vehicles', id) : Promise.resolve([]),
      r.auftraege.level ? listRows(q, 'orders', id, own('auftraege', 'assignee_id = $2 OR created_by = $2'), r.auftraege.own ? [me] : []) : Promise.resolve([]),
      r.leitstelle.level ? listRows(q, 'callouts', id, own('leitstelle', 'driver_id = $2 OR created_by = $2 OR driver_id IS NULL'), r.leitstelle.own ? [me] : []) : Promise.resolve([]),
      r.rechnungen.level ? listRows(q, 'bills', id, own('rechnungen', 'created_by = $2'), r.rechnungen.own ? [me] : []) : Promise.resolve([]),
      r.buchungen.level ? listRows(q, 'transactions', id) : Promise.resolve([]),
      r.dienstzeiten.level && !r.dienstzeiten.own
        ? listRows(q, 'duty', id, "started_at > now() - interval '35 days'")
        : listRows(q, 'duty', id, "user_id = $2 AND started_at > now() - interval '35 days'", [me]),
    ]);
    const mods = c.company.modules;
    const learn = mods.includes('schulungen') && !c.rights.support && !r.schulungen.locked;
    const [parts, shifts, wages, payslips, courses, progress, dyno, events, entries, tuning] = await Promise.all([
      r.lager.level ? listRows(q, 'parts', id) : Promise.resolve([]),
      r.dienstplan.level
        ? listRows(q, 'shifts', id, `ends_at > now() - interval '14 days' AND starts_at < now() + interval '60 days'${r.dienstplan.own ? ' AND user_id = $2' : ''}`, r.dienstplan.own ? [me] : [])
        : Promise.resolve([]),
      r.lohn.level
        ? q.query(`SELECT user_id AS "userId", wage_cents AS "wageCents", commission_pct AS "commissionPct", fixed_cents AS "fixedCents" FROM memberships WHERE company_id = $1${r.lohn.own ? ' AND user_id = $2' : ''}`, r.lohn.own ? [id, me] : [id]).then((x) => x.rows)
        : Promise.resolve([]),
      r.lohn.level ? listRows(q, 'payslips', id, r.lohn.own ? 'user_id = $2' : '', r.lohn.own ? [me] : [], 500) : Promise.resolve([]),
      learn || r.schulungen.level ? listCourses(q, id).then((cs) => cs.map((x) => courseView(x, r.schulungen.level >= 2))) : Promise.resolve([]),
      // Trainer sehen zusätzlich den Stand ihrer eigenen Kurse (für Praxisprüfung und Freitext-Bewertung)
      r.schulungen.level
        ? listProgress(q, id)
        : learn
          ? Promise.all([listProgress(q, id), listCourses(q, id)]).then(([ps, cs]) => ps.filter((p) => p.userId === me || cs.some((c) => c.id === p.courseId && c.trainerId === me)))
          : Promise.resolve([]),
      r.tuning.level ? listRows(q, 'dyno', id, '', [], 300) : Promise.resolve([]),
      r.racing.level ? listRows(q, 'events', id) : Promise.resolve([]),
      r.racing.level ? listRows(q, 'entries', id) : Promise.resolve([]),
      loadTuning(q, id),
    ]);
    const none = Promise.resolve([]);
    const mine = (area: keyof typeof r) => !r[area].level || r[area].own;
    const [partOrders, partUse, bays, bookings, tools, fleet, fleetLog, raceCars, championship, setups, laps, trackdays, contracts, messages] = await Promise.all([
      r.lager.level ? listRows(q, 'partOrders', id, "status = 'bestellt' OR created_at > now() - interval '30 days'") : none,
      r.lager.level
        ? q.query<PartUse>(`SELECT part_id AS "partId", (-sum(delta))::int AS used FROM part_moves WHERE company_id = $1 AND delta < 0 AND note <> 'Inventur' AND created_at > now() - interval '30 days' GROUP BY part_id`, [id]).then((x) => x.rows)
        : none,
      r.hallenplan.level ? listRows(q, 'bays', id) : none,
      r.hallenplan.level ? listRows(q, 'bookings', id, "ends_at > now() - interval '7 days' AND starts_at < now() + interval '30 days'") : none,
      r.werkzeug.level ? listRows(q, 'tools', id) : none,
      r.fuhrpark.level ? listRows(q, 'fleet', id) : none,
      r.fuhrpark.level ? listRows(q, 'fleetLog', id, '', [], 300) : none,
      r.racing.level ? listRows(q, 'raceCars', id) : none,
      r.racing.level ? listRows(q, 'championship', id) : none,
      r.racing.level ? listRows(q, 'setups', id) : none,
      r.racing.level ? listRows(q, 'laps', id, '', [], 500) : none,
      r.racing.level ? listRows(q, 'trackdays', id) : none,
      r.vertraege.level || r.tuning.level ? listRows(q, 'contracts', id) : none,
      r.nachrichten.level ? listRows(q, 'messages', id, "created_at > now() - interval '90 days'", [], 2000) : none,
    ]);
    const [ranks, applications, absences, corrections, sessions, licenses, closings, standing, goals, services, rules, posts, webhooks] = await Promise.all([
      r.raenge.level || r.zugaenge.level ? listRows(q, 'ranks', id) : none,
      r.bewerbungen.level ? listRows(q, 'applications', id) : none,
      mine('dienstplan') ? listRows(q, 'absences', id, 'user_id = $2', [me]) : listRows(q, 'absences', id, "date_to > current_date - 60"),
      r.dienstzeiten.level >= 3 ? listRows(q, 'corrections', id, "status = 'beantragt' OR created_at > now() - interval '30 days'") : listRows(q, 'corrections', id, 'user_id = $2', [me], 50),
      learn || r.schulungen.level ? listRows(q, 'sessions', id, "starts_at > now() - interval '30 days'") : none,
      r.schulungen.level ? listRows(q, 'licenses', id) : listRows(q, 'licenses', id, 'holder_id = $2', [me]),
      r.buchungen.level ? listRows(q, 'closings', id, '', [], 60) : none,
      r.buchungen.level ? listRows(q, 'standing', id) : none,
      r.buchungen.level ? listRows(q, 'goals', id) : none,
      r.preisliste.level || r.auftraege.level ? listRows(q, 'services', id) : none,
      r.regelwerk.level
        ? q.query<RuleDoc>(
          `SELECT d.id, d.title, d.body, d.version, d.updated_at AS "updatedAt",
                  coalesce((SELECT jsonb_agg(a.user_id) FROM rule_acks a WHERE a.doc_id = d.id AND a.version = d.version), '[]'::jsonb) AS "ackedBy"
             FROM rule_docs d WHERE d.company_id = $1 ORDER BY d.title`, [id]).then((x) => x.rows)
        : none,
      r.pinnwand.level
        ? q.query<Post>(
          `SELECT p.id, p.author_id AS "authorId", p.title, p.body, p.pinned, p.poll, p.created_at AS "createdAt",
                  (SELECT count(*)::int FROM post_reads x WHERE x.post_id = p.id) AS reads,
                  EXISTS (SELECT 1 FROM post_reads x WHERE x.post_id = p.id AND x.user_id = $2) AS "readByMe",
                  coalesce((SELECT jsonb_agg(n ORDER BY o) FROM (SELECT o, (SELECT count(*)::int FROM poll_votes v WHERE v.post_id = p.id AND v.option = o) AS n
                              FROM generate_series(0, coalesce(jsonb_array_length(p.poll->'options'), 0) - 1) o) t), '[]'::jsonb) AS votes,
                  (SELECT option FROM poll_votes v WHERE v.post_id = p.id AND v.user_id = $2) AS "myVote"
             FROM posts p WHERE p.company_id = $1 ORDER BY p.pinned DESC, p.created_at DESC LIMIT 100`, [id, me]).then((x) => x.rows)
        : none,
      r.firma.level >= 3 ? listRows(q, 'webhooks', id) : none,
    ]);
    const [photos, gameKeys] = await Promise.all([
      r.auftraege.level
        ? q.query(`SELECT p.id, p.order_id AS "orderId", p.size, p.note, p.created_by AS "createdBy", p.created_at AS "createdAt"
                     FROM order_photos p JOIN orders o ON o.id = p.order_id WHERE p.company_id = $1 ${r.auftraege.own ? 'AND (o.assignee_id = $2 OR o.created_by = $2)' : ''}
                    ORDER BY p.created_at`, r.auftraege.own ? [id, me] : [id]).then((x) => x.rows)
        : none,
      r.firma.level >= 3
        ? q.query('SELECT id, name, prefix, last_used_at AS "lastUsedAt", revoked, created_at AS "createdAt" FROM game_keys WHERE company_id = $1 ORDER BY created_at DESC', [id]).then((x) => x.rows)
        : none,
    ]);
    const myGroups = (await q.query<{ id: string }>('SELECT g.id FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE g.company_id = $1 AND gm.user_id = $2', [id, me])).rows.map((x) => x.id);
    // Kontaktdaten nur mit Recht auf Mitarbeiter
    const visibleMembers = r.mitarbeiter.level || r.zugaenge.level ? members : members.map((m) => ({ ...m, email: '', phone: '', gameId: '', lastLoginAt: null }));
    return {
      company: c.company, rights: c.rights, members: visibleMembers, groups, exceptions, customers, vehicles, orders, callouts, bills, transactions, duty,
      parts, shifts, wages, payslips, courses, progress, dyno, events, entries, tuning, myGroups,
      partOrders, partUse, bays, bookings, tools, fleet, fleetLog, raceCars, championship, setups, laps, trackdays, contracts, messages,
      ranks, applications, absences, corrections, sessions, licenses, closings, standing, goals, services, rules, posts, webhooks, photos, gameKeys,
    };
  });

  app.patch('/c/:companyId/settings', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('firma', 2);
    const body = parseBody(companySchema, req.body);
    if (body.supportAccess !== undefined && !c.rights.owner) throw forbidden('Support-Zugriff kann nur der Inhaber freigeben.');
    if (body.mapBounds && c.rights.areas.firma.level < 2) throw forbidden();
    await updateCompany(db(), c.company.id, { ...body, info: body.info ? { ...c.company.info, ...body.info } : undefined });
    await audit(db(), c.company.id, c.user.id, 'Firma', body.supportAccess !== undefined ? `Support-Zugriff ${body.supportAccess ? 'erlaubt' : 'entzogen'}` : 'Firmendaten geändert');
    return { ok: true };
  });

  app.put('/c/:companyId/modules', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('module', 2);
    const { modules } = parseBody(z.object({ modules: z.array(z.enum(MODULES.filter((m) => m.optional).map((m) => m.id) as [string, ...string[]])) }), req.body);
    await updateCompany(db(), c.company.id, { modules });
    await audit(db(), c.company.id, c.user.id, 'Module', `Module: ${modules.join(', ') || 'keine'}`);
    return { ok: true };
  });

  // --- Mitglieder ----------------------------------------------------------
  app.post('/c/:companyId/members', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('zugaenge', 2);
    c.needSpecial('einladen');
    const body = parseBody(inviteSchema, req.body);
    if (body.groups.length) c.need('gruppen', 2);
    return tx(async (q) => {
      const groups = await listGroups(q, c.company.id);
      if (body.groups.some((g) => !groups.find((x) => x.id === g && !x.isOwner))) throw badRequest('Unbekannte Gruppe.');
      let user = await getUserWithHashByEmail(q, body.email);
      let startPassword: string | null = null;
      if (!user) {
        startPassword = generatePassword();
        const created = await insertUser(q, { email: body.email, displayName: body.displayName, passwordHash: await hashPassword(startPassword), mustChangePassword: true });
        user = { ...created, passwordHash: '' };
      }
      const ins = await q.query('INSERT INTO memberships (company_id, user_id, rank) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [c.company.id, user.id, body.rank]);
      if (!ins.rowCount) throw conflict('Diese Person ist schon in der Firma.');
      for (const g of body.groups) await q.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [g, user.id]);
      await audit(q, c.company.id, c.user.id, 'Zugänge', `${body.displayName} aufgenommen`);
      return { userId: user.id, startPassword };
    });
  });

  app.patch('/c/:companyId/members/:userId', async (req) => {
    const c = await companyCtx(req, cfg);
    const userId = idParam(req, 'userId');
    c.need('zugaenge', 2);
    const body = parseBody(memberSchema, req.body);
    return tx(async (q) => {
      const groups = await listGroups(q, c.company.id);
      const isOwner = groups.some((g) => g.isOwner && g.members.includes(userId));
      if (isOwner && body.locked) throw badRequest('Den Inhaber kann man nicht sperren.');
      const r = await q.query('UPDATE memberships SET rank = coalesce($3, rank), phone = coalesce($4, phone), locked = coalesce($5, locked), game_id = coalesce($6, game_id) WHERE company_id = $1 AND user_id = $2', [
        c.company.id, userId, body.rank ?? null, body.phone ?? null, body.locked ?? null, body.gameId ?? null,
      ]);
      if (!r.rowCount) throw notFound();
      if (body.groups) {
        c.need('gruppen', 2);
        const wanted = new Set(body.groups);
        for (const g of groups) {
          if (g.isOwner) continue; // Inhaber nur per Übertragung
          const has = g.members.includes(userId);
          if (wanted.has(g.id) && !has) await q.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [g.id, userId]);
          if (!wanted.has(g.id) && has) await q.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [g.id, userId]);
        }
      }
      if (body.locked !== undefined) await q.query('DELETE FROM duty_sessions WHERE company_id = $1 AND user_id = $2 AND ended_at IS NULL AND $3', [c.company.id, userId, body.locked]);
      await audit(q, c.company.id, c.user.id, 'Zugänge', `Mitglied geändert${body.locked !== undefined ? (body.locked ? ' (gesperrt)' : ' (entsperrt)') : ''}${body.groups ? ' (Gruppen)' : ''}`);
      return { ok: true };
    });
  });

  app.delete('/c/:companyId/members/:userId', async (req) => {
    const c = await companyCtx(req, cfg);
    const userId = idParam(req, 'userId');
    c.need('zugaenge', 3);
    const groups = await listGroups(db(), c.company.id);
    if (groups.some((g) => g.isOwner && g.members.includes(userId))) throw badRequest('Den Inhaber kann man nicht entfernen.');
    await tx(async (q) => {
      await q.query('DELETE FROM group_members gm USING groups g WHERE gm.group_id = g.id AND g.company_id = $1 AND gm.user_id = $2', [c.company.id, userId]);
      await q.query('DELETE FROM permission_exceptions WHERE company_id = $1 AND user_id = $2', [c.company.id, userId]);
      await q.query('DELETE FROM memberships WHERE company_id = $1 AND user_id = $2', [c.company.id, userId]);
      await audit(q, c.company.id, c.user.id, 'Zugänge', 'Mitglied entfernt');
    });
    return { ok: true };
  });

  // --- Gruppen --------------------------------------------------------------
  app.post('/c/:companyId/groups', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('gruppen', 2);
    const b = parseBody(groupSchema, req.body);
    const { rows } = await db().query<{ id: string }>(
      `INSERT INTO groups (company_id, name, color, description, levels, own, specials, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT coalesce(max(position), 0) + 1 FROM groups WHERE company_id = $1)) RETURNING id`,
      [c.company.id, b.name, b.color, b.description, JSON.stringify(b.levels), JSON.stringify(b.own), JSON.stringify(b.specials)],
    );
    await audit(db(), c.company.id, c.user.id, 'Gruppen', `Gruppe „${b.name}“ angelegt`);
    return { id: rows[0].id };
  });

  app.put('/c/:companyId/groups/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('gruppen', 2);
    const id = idParam(req);
    const b = parseBody(groupSchema, req.body);
    const g = (await listGroups(db(), c.company.id)).find((x) => x.id === id);
    if (!g) throw notFound();
    if (g.isOwner) throw badRequest('Die Inhaber-Gruppe hat immer alle Rechte.');
    const levels = Object.fromEntries(Object.entries(b.levels).filter(([, v]) => v !== '0'));
    await db().query('UPDATE groups SET name = $3, color = $4, description = $5, levels = $6, own = $7, specials = $8 WHERE company_id = $1 AND id = $2', [
      c.company.id, id, b.name, b.color, b.description, JSON.stringify(levels), JSON.stringify(b.own), JSON.stringify(b.specials),
    ]);
    await audit(db(), c.company.id, c.user.id, 'Gruppen', `Gruppe „${b.name}“ geändert`);
    return { ok: true };
  });

  app.delete('/c/:companyId/groups/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('gruppen', 3);
    const id = idParam(req);
    const g = (await listGroups(db(), c.company.id)).find((x) => x.id === id);
    if (!g) throw notFound();
    if (g.isOwner) throw badRequest('Die Inhaber-Gruppe kann man nicht löschen.');
    await db().query('DELETE FROM groups WHERE company_id = $1 AND id = $2', [c.company.id, id]);
    await audit(db(), c.company.id, c.user.id, 'Gruppen', `Gruppe „${g.name}“ gelöscht (${g.members.length} Mitglieder)`);
    return { ok: true };
  });

  // --- Ausnahmen ------------------------------------------------------------
  app.put('/c/:companyId/exceptions', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('gruppen', 2);
    const b = parseBody(exceptionSchema, req.body);
    await db().query(
      `INSERT INTO permission_exceptions (company_id, user_id, area, level, until, reason) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (company_id, user_id, area) DO UPDATE SET level = EXCLUDED.level, until = EXCLUDED.until, reason = EXCLUDED.reason`,
      [c.company.id, b.userId, b.area, b.level, b.until, b.reason],
    );
    await audit(db(), c.company.id, c.user.id, 'Gruppen', `Ausnahme ${b.area} gesetzt`);
    return { ok: true };
  });

  app.delete('/c/:companyId/exceptions/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('gruppen', 2);
    await db().query('DELETE FROM permission_exceptions WHERE company_id = $1 AND id = $2', [c.company.id, idParam(req)]);
    return { ok: true };
  });

  app.get('/c/:companyId/audit', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('protokoll', 1);
    return { entries: await listAudit(db(), c.company.id) };
  });

  // --- Kartenbild (eigene Datei je Firma, bleibt auf dem Server) ------------
  app.register(async (scope) => {
    scope.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp'], { parseAs: 'buffer', bodyLimit: 60 * 1024 * 1024 }, (_req, body, done) => done(null, body));
    scope.put('/c/:companyId/map', { bodyLimit: 60 * 1024 * 1024 }, async (req) => {
      const c = await companyCtx(req, cfg);
      c.need('firma', 2);
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.headers['content-type'] ?? ''];
      if (!ext || !Buffer.isBuffer(req.body)) throw badRequest('Bitte ein Bild (JPG, PNG oder WebP) hochladen.');
      const dir = path.join(cfg.dataDir, 'maps');
      mkdirSync(dir, { recursive: true });
      for (const e of ['jpg', 'png', 'webp']) rmSync(path.join(dir, `${c.company.id}.${e}`), { force: true });
      writeFileSync(path.join(dir, `${c.company.id}.${ext}`), req.body);
      await audit(db(), c.company.id, c.user.id, 'Firma', 'Kartenbild hochgeladen');
      return { ok: true };
    });
  });

  app.delete('/c/:companyId/map', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('firma', 2);
    const f = mapFile(cfg.dataDir, c.company.id);
    if (f) rmSync(f, { force: true });
    return { ok: true };
  });

  app.get('/c/:companyId/map', async (req, reply) => {
    const c = await companyCtx(req, cfg);
    const f = mapFile(cfg.dataDir, c.company.id);
    if (!f) throw notFound('Kein Kartenbild hinterlegt.');
    const type = f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    reply.header('Cache-Control', 'private, no-cache');
    return reply.type(type).send(readFileSync(f));
  });

  // --- Export der eigenen Firma (Sonderrecht „Daten exportieren“) -----------
  app.get('/c/:companyId/export/:set', async (req, reply) => {
    const c = await companyCtx(req, cfg);
    c.needSpecial('export');
    const set = (req.params as Record<string, string>).set;
    if (!EXPORT_SETS.find((s) => s.id === set && s.scope === 'company')) throw notFound();
    // Zusätzlich muss man den Bereich ganz sehen dürfen (nicht nur eigene Einträge).
    const area = EXPORT_AREA[set];
    c.need(area);
    if (c.ownOnly(area)) throw forbidden('Export nur mit Sicht auf alle Einträge.');
    const rows = await exportRows(db(), set, c.company.id);
    await audit(db(), c.company.id, c.user.id, 'Export', `Export ${set}`);
    reply.header('Content-Disposition', `attachment; filename="pitstop-${set}.csv"`);
    return reply.type('text/csv; charset=utf-8').send(toCsv(rows));
  });
}
