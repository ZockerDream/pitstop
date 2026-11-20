// Version 0.4: Annahme, Hallenplan, Werkzeug, Lager-Bestellungen, Fuhrpark, Racing-Team/Setups/Runden/Trackdays,
// Rahmenverträge, Nachrichten, Ränge, Bewerbungen, Abwesenheiten, Nachträge, Schulungstermine, Lizenzen,
// Kasse/Daueraufträge/Trinkgeld/Ziele/Umbuchungen, Preisliste, Regelwerk, Pinnwand, Firmeneinstellungen, Webhooks, Live-Feed, Vorschau.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addDays, addMonths, today } from '../../shared/dates';
import { FEED_AREAS, WEBHOOK_EVENTS } from '../../shared/feed';
import { formatUsd, orderLabel } from '../../shared/format';
import type { CompanyExtra, FeedItem } from '../../shared/types';
import { generatePassword, hashPassword } from '../auth/password';
import { companyCtx, type Ctx } from '../auth/guards';
import { db, tx, type Queryable } from '../db/pool';
import { badRequest, conflict, forbidden, notFound, parseBody, zCents, zDate, zId, zRequired, zText } from '../errors';
import { webhookUrlProblem, sendHook } from '../hooks';
import { audit, getMembership, listGroups, rightsFor, updateCompany } from '../repo/companies';
import { getRow, insertRow } from '../repo/records';
import { getUserWithHashByEmail, insertUser } from '../repo/users';
import { checkRefs, crud } from './crud';
import { idParam, type RouteOptions } from './util';

const zOptId = zId.nullable().optional();
const zTs = z.iso.datetime({ offset: true, message: 'Zeitpunkt erwartet' });
const zOptDate = zDate.nullable().optional();
const zAccount = z.enum(['firma', 'kasse', 'trinkgeld', 'rennteam']);
const zInt = (min: number, max: number) => z.number().int().min(min).max(max);

/** Ausgaben brauchen das Sonderrecht „Ausgaben buchen“ (mit Betragsgrenze). */
export function checkPayout(c: Ctx, cents: number): void {
  const limit = c.rights.specials.auszahlung;
  if (limit === undefined || limit === false) throw forbidden('Ausgaben buchen braucht das Sonderrecht „Ausgaben buchen“.');
  if (typeof limit === 'number' && limit > 0 && cents > limit * 100) throw forbidden(`Ausgaben nur bis ${formatUsd(limit * 100)}.`);
}

async function courseExists(q: Queryable, companyId: string, id: string | null | undefined): Promise<void> {
  if (id && !(await q.query('SELECT 1 FROM courses WHERE company_id = $1 AND id = $2', [companyId, id])).rowCount) throw badRequest('Kurs gehört nicht zu dieser Firma.', { courseId: 'Unbekannt' });
}

/** Preisliste: Leistungen mit Nachweis dürfen nur Leute übernehmen, die den Kurs gültig bestanden haben. */
export async function checkQualified(q: Queryable, companyId: string, assigneeId: string | null | undefined, serviceId: string | null | undefined): Promise<void> {
  if (!assigneeId || !serviceId) return;
  const { rows } = await q.query<{ course: string | null; name: string }>(
    'SELECT s.course_id AS course, coalesce(c.name, \'\') AS name FROM services s LEFT JOIN courses c ON c.id = s.course_id WHERE s.company_id = $1 AND s.id = $2',
    [companyId, serviceId],
  );
  if (!rows[0]) throw badRequest('Leistung gehört nicht zu dieser Firma.', { serviceId: 'Unbekannt' });
  if (!rows[0].course) return;
  const ok = await q.query(
    `SELECT 1 FROM course_progress p JOIN courses c ON c.id = p.course_id
      WHERE p.course_id = $1 AND p.user_id = $2 AND p.passed_at IS NOT NULL
        AND (c.valid_months = 0 OR (p.passed_at + make_interval(months => c.valid_months))::date >= current_date)`,
    [rows[0].course, assigneeId],
  );
  if (!ok.rowCount) {
    const n = (await q.query<{ n: string }>('SELECT display_name AS n FROM users WHERE id = $1', [assigneeId])).rows[0]?.n ?? 'Diese Person';
    throw badRequest(`${n} fehlt der Nachweis „${rows[0].name}“ für diese Leistung.`, { assigneeId: `Nachweis „${rows[0].name}“ fehlt` });
  }
}

export async function accountBalance(q: Queryable, companyId: string, account: string): Promise<number> {
  const { rows } = await q.query<{ s: string | null }>('SELECT sum(amount_cents) AS s FROM transactions WHERE company_id = $1 AND account = $2', [companyId, account]);
  return Number(rows[0].s ?? 0);
}

/** Fällige Daueraufträge buchen und auf den nächsten Termin setzen. */
export async function runStandingOrders(q: Queryable, companyId: string | null, userId: string | null): Promise<number> {
  const { rows } = await q.query<{ id: string; companyId: string; text: string; amount: number; account: string; category: string; every: string; next: string }>(
    `SELECT id, company_id AS "companyId", text, amount_cents AS amount, account, category, every, next_date::text AS next
       FROM standing_orders WHERE active AND next_date <= current_date ${companyId ? 'AND company_id = $1' : ''} FOR UPDATE`,
    companyId ? [companyId] : [],
  );
  let n = 0;
  for (const r of rows) {
    let next = r.next;
    // Verpasste Termine einzeln nachbuchen (höchstens 24, damit ein alter Termin nicht endlos bucht)
    for (let i = 0; i < 24 && next <= today(); i++) {
      await insertRow(q, 'transactions', r.companyId, { account: r.account, amountCents: r.amount, text: r.text, category: r.category, bookedAt: next, createdBy: userId });
      next = r.every === 'woche' ? addDays(next, 7) : r.every === 'jahr' ? addMonths(next, 12) : addMonths(next, 1);
      n++;
    }
    await q.query('UPDATE standing_orders SET next_date = $2 WHERE id = $1', [r.id, next]);
    await audit(q, r.companyId, userId, 'Kasse', `Dauerauftrag gebucht: ${r.text} (${formatUsd(r.amount)})`);
  }
  return n;
}

const learnerCtx = (c: Ctx) => {
  if (c.rights.support) throw forbidden();
  if (!c.company.modules.includes('schulungen')) throw forbidden('Modul Schulungen ist aus.');
  if (c.rights.areas.schulungen.locked) throw forbidden('Schulungen sind für dich gesperrt.');
};

// --- Schemas ----------------------------------------------------------------
const baySchema = z.object({ name: zRequired(40), kind: z.enum(['hebebuehne', 'lack', 'pruefstand', 'wasch', 'sonstig']).default('hebebuehne'), position: zInt(0, 100).default(0) });
const bookingSchema = z.object({ bayId: zId, orderId: zOptId, title: zText(120).default(''), startsAt: zTs, endsAt: zTs });
const toolSchema = z.object({ name: zRequired(80), info: zText(120).default(''), location: zText(60).default(''), checkDue: zOptDate, note: zText(300).default('') });
const fleetSchema = z.object({
  name: zRequired(60), model: zText(60).default(''), plate: zText(16).default('').transform((s) => s.toUpperCase()), km: zInt(0, 10_000_000).default(0),
  fuel: zInt(0, 100).default(100), serviceDue: zOptDate, note: zText(300).default(''),
});
const raceCarSchema = z.object({
  number: zText(6).default(''), car: zRequired(60), driverId: zOptId, status: z.enum(['bereit', 'wartung', 'defekt']).default('bereit'), km: zInt(0, 10_000_000).default(0),
  wear: z.record(zRequired(20), zInt(0, 100)).default({}), budgetCents: zCents.default(0), note: zText(300).default(''),
});
const champSchema = z.object({ season: zInt(2000, 2100), team: zRequired(60), points: zInt(-10000, 100000).default(0), own: z.boolean().default(false) });
const lapSchema = z.object({ carId: zOptId, driver: zText(60).default(''), track: zRequired(40), s1: zInt(1, 3_600_000), s2: zInt(1, 3_600_000), s3: zInt(1, 3_600_000), session: zText(40).default('Training') });
const trackdaySchema = z.object({ eventId: zOptId, customerId: zOptId, vehicleId: zOptId, package: zRequired(40), transport: z.boolean().default(false), status: z.enum(['angefragt', 'bestaetigt', 'abgesagt']).default('angefragt') });
const contractSchema = z.object({
  customerId: zId, title: zText(80).default(''), workshopPct: zInt(0, 100).default(0), tuningPct: zInt(0, 100).default(0), rules: zText(1000).default(''),
  billing: zText(200).default(''), validUntil: zOptDate, status: z.enum(['aktiv', 'pruefen', 'beendet']).default('aktiv'),
});
const rankSchema = z.object({ name: zRequired(60), position: zInt(0, 100).default(0), wageCents: zCents.default(0), commissionPct: zInt(0, 100).default(0), fixedCents: zCents.default(0), groups: z.array(zId).max(20).default([]) });
const applicationSchema = z.object({
  name: zRequired(80), role: zText(60).default(''), contact: zText(120).default(''), text: zText(2000).default(''), rating: zInt(0, 5).default(0),
  status: z.enum(['neu', 'gespraech', 'eingestellt', 'abgesagt']).default('neu'), interviewAt: zTs.nullable().optional(), note: zText(1000).default(''),
});
const sessionSchema = z.object({ courseId: zId, startsAt: zTs, kind: z.enum(['praxis', 'einfuehrung', 'test']).default('praxis'), trainerId: zOptId, note: zText(300).default('') });
const licenseSchema = z.object({ name: zRequired(80), holderId: zOptId, validUntil: zOptDate, note: zText(300).default('') });
const standingSchema = z.object({
  text: zRequired(120), amountCents: zInt(-2_000_000_000, 2_000_000_000).refine((v) => v !== 0, 'Betrag darf nicht 0 sein'), account: zAccount.default('firma'),
  category: zText(40).default('Dauerauftrag'), every: z.enum(['woche', 'monat', 'jahr']).default('monat'), nextDate: zDate, active: z.boolean().default(true),
});
const goalSchema = z.object({ name: zRequired(80), targetCents: zCents.refine((v) => v > 0, 'Ziel muss größer als 0 sein'), account: zAccount.default('firma'), deadline: zOptDate });
const serviceSchema = z.object({ name: zRequired(80), area: zText(30).default('Werkstatt'), priceCents: zCents.default(0), courseId: zOptId, note: zText(300).default('') });
const webhookSchema = z.object({ name: zText(60).default(''), url: zRequired(500), kind: z.enum(['discord', 'json']).default('discord'), events: z.array(z.enum(WEBHOOK_EVENTS as [string, ...string[]])).default([]), active: z.boolean().default(true) });
const intakeSchema = z.object({
  plate: zRequired(16).transform((s) => s.toUpperCase()),
  model: zText(60).default(''),
  customerId: zOptId,
  newCustomer: zText(80).default(''),
  km: zInt(0, 10_000_000).optional(),
  fuel: zText(12).default(''),
  damage: z.array(zText(30)).max(20).default([]),
  checks: z.array(zText(60)).max(20).default([]),
  wishes: zText(2000).default(''),
  title: zRequired(120),
  kind: z.enum(['werkstatt', 'tuning', 'karosserie', 'racing']).default('werkstatt'),
  assigneeId: zOptId,
  serviceId: zOptId,
  amountCents: zCents.optional(),
  priority: z.boolean().default(false),
  bayId: zOptId,
  startsAt: zTs.optional(),
  endsAt: zTs.optional(),
  confirmStolen: z.boolean().default(false),
});
const pollSchema = z.object({ question: zRequired(200), options: z.array(zRequired(80)).min(2).max(8), endsAt: zTs.nullable().default(null) });
const postSchema = z.object({ title: zRequired(120), body: zText(5000).default(''), pinned: z.boolean().default(false), poll: pollSchema.nullable().default(null) });
const extraSchema = z.object({
  payDays: zInt(0, 365).optional(),
  footer: zText(200).optional(),
  locations: z.array(z.object({ name: zRequired(60), note: zText(120).default('') })).max(20).optional(),
  templates: z.array(zRequired(200)).max(30).optional(),
  trackdayPackages: z.array(z.object({ name: zRequired(30), priceCents: zCents, items: z.array(zRequired(80)).max(12) })).max(8).optional(),
  publicData: z.boolean().optional(),
});

export async function moreRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  // --- Hallenplan -----------------------------------------------------------
  crud(app, cfg, { kind: 'bays', path: 'bays', area: 'hallenplan', log: 'Hallenplan', name: (r) => `Platz ${r.name}`, schema: baySchema, write: 3 });
  const checkBooking = async (c: Ctx, b: Record<string, unknown>, old: { id: string; bayId: string; startsAt: string; endsAt: string } | null) => {
    const bay = (b.bayId as string) ?? old?.bayId;
    const s = (b.startsAt as string) ?? old?.startsAt;
    const e = (b.endsAt as string) ?? old?.endsAt;
    if (!bay || !s || !e) return;
    if (Date.parse(e) <= Date.parse(s)) throw badRequest('Ende liegt vor dem Beginn.', { endsAt: 'Ende liegt vor dem Beginn' });
    const clash = await db().query<{ title: string }>(
      'SELECT title FROM bay_bookings WHERE company_id = $1 AND bay_id = $2 AND starts_at < $4 AND ends_at > $3 AND id <> coalesce($5::uuid, gen_random_uuid()) LIMIT 1',
      [c.company.id, bay, s, e, old?.id ?? null],
    );
    if (clash.rowCount) throw conflict(`Der Platz ist in der Zeit schon belegt (${clash.rows[0].title || 'Buchung'}).`);
  };
  crud(app, cfg, {
    kind: 'bookings', path: 'bookings', area: 'hallenplan', log: 'Hallenplan', name: (r) => `Buchung ${r.title}`, schema: bookingSchema, remove: 2,
    refs: { bayId: 'bays', orderId: 'orders' }, extra: (c) => ({ createdBy: c.user.id }), check: checkBooking, quietPatch: true,
  });

  // --- Werkzeug -------------------------------------------------------------
  crud(app, cfg, { kind: 'tools', path: 'tools', area: 'werkzeug', log: 'Werkzeug', name: (r) => r.name, schema: toolSchema, quietPatch: true });
  app.post('/c/:companyId/tools/:id/:action', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('werkzeug', 2);
    const action = (req.params as Record<string, string>).action;
    const t = await getRow(db(), 'tools', c.company.id, idParam(req));
    if (!t) throw notFound();
    const b = parseBody(z.object({ userId: zOptId, note: zText(300).optional() }), req.body ?? {});
    if (action === 'issue') {
      if (t.status !== 'frei') throw conflict(t.status === 'wartung' ? 'Das Werkzeug ist in der Wartung.' : 'Das Werkzeug ist schon ausgegeben.');
      const who = b.userId ?? c.user.id;
      if (!(await getMembership(db(), c.company.id, who))) throw badRequest('Diese Person ist nicht in der Firma.');
      await db().query("UPDATE tools SET status = 'ausgegeben', holder_id = $2, since = now() WHERE id = $1", [t.id, who]);
      await audit(db(), c.company.id, c.user.id, 'Werkzeug', `${t.name} ausgegeben`);
    } else if (action === 'return') {
      if (t.status !== 'ausgegeben') throw conflict('Das Werkzeug ist nicht ausgegeben.');
      await db().query("UPDATE tools SET status = 'frei', holder_id = NULL, since = NULL WHERE id = $1", [t.id]);
      await audit(db(), c.company.id, c.user.id, 'Werkzeug', `${t.name} zurückgenommen`);
    } else if (action === 'maintenance') {
      if (t.status === 'ausgegeben') throw conflict('Erst zurücknehmen, dann in die Wartung.');
      const on = t.status !== 'wartung';
      await db().query(`UPDATE tools SET status = $2, since = CASE WHEN $3 THEN now() ELSE NULL END, note = coalesce($4, note) WHERE id = $1`, [t.id, on ? 'wartung' : 'frei', on, b.note ?? null]);
      await audit(db(), c.company.id, c.user.id, 'Werkzeug', `${t.name}: Wartung ${on ? 'begonnen' : 'abgeschlossen'}`);
    } else throw notFound();
    return getRow(db(), 'tools', c.company.id, t.id);
  });

  // --- Fahrzeugannahme → Auftrag --------------------------------------------
  app.post('/c/:companyId/intake', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('auftraege', 2);
    const b = parseBody(intakeSchema, req.body);
    await checkRefs(db(), c.company.id, { customerId: 'customers', assigneeId: 'member', bayId: 'bays' }, b);
    await checkQualified(db(), c.company.id, b.assigneeId, b.serviceId);
    if (b.bayId) {
      c.need('hallenplan', 2);
      if (!b.startsAt || !b.endsAt) throw badRequest('Für den Platz Beginn und Ende angeben.', { startsAt: 'Beginn fehlt' });
      await checkBooking(c, { bayId: b.bayId, startsAt: b.startsAt, endsAt: b.endsAt }, null);
    }
    return tx(async (q) => {
      let vehicle = (await q.query<{ id: string; stolen: boolean; customerId: string | null }>(
        'SELECT id, stolen, customer_id AS "customerId" FROM vehicles WHERE company_id = $1 AND upper(plate) = $2', [c.company.id, b.plate],
      )).rows[0];
      if (vehicle?.stolen && !b.confirmStolen) throw conflict(`Kennzeichen ${b.plate} ist als gestohlen gemeldet. Bitte Leitung oder Behörde informieren.`);
      let customerId = b.customerId ?? vehicle?.customerId ?? null;
      if (!customerId && b.newCustomer) {
        c.need('kunden', 2);
        customerId = (await insertRow(q, 'customers', c.company.id, { name: b.newCustomer })).id;
        await audit(q, c.company.id, c.user.id, 'Kunden', `Kunde ${b.newCustomer} bei der Annahme angelegt`);
      }
      if (customerId) {
        const cust = await getRow(q, 'customers', c.company.id, customerId);
        if (cust?.blocked) throw conflict(`${cust.name} ist gesperrt. Annahme nur nach Rücksprache mit der Leitung.`);
      }
      if (!vehicle) {
        c.need('fahrzeuge', 2);
        const v = await insertRow(q, 'vehicles', c.company.id, { plate: b.plate, model: b.model, customerId });
        vehicle = { id: v.id, stolen: false, customerId };
      }
      let amount = b.amountCents;
      if (amount === undefined && b.serviceId) amount = (await getRow(q, 'services', c.company.id, b.serviceId))?.priceCents ?? 0;
      const order = await insertRow(q, 'orders', c.company.id, {
        title: b.title, kind: b.kind, status: 'neu', priority: b.priority, customerId, vehicleId: vehicle.id, assigneeId: b.assigneeId ?? null, amountCents: amount ?? 0,
        note: b.wishes, serviceId: b.serviceId ?? null, createdBy: c.user.id,
        intake: { km: b.km, fuel: b.fuel, damage: b.damage, checks: b.checks, wishes: b.wishes },
      });
      if (b.bayId) await insertRow(q, 'bookings', c.company.id, { bayId: b.bayId, orderId: order.id, title: `${orderLabel(order.number)} ${b.title}`, startsAt: b.startsAt, endsAt: b.endsAt, createdBy: c.user.id });
      await audit(q, c.company.id, c.user.id, 'Annahme', `${b.plate} angenommen → ${orderLabel(order.number)} ${b.title}${vehicle.stolen ? ' (Kennzeichen gestohlen gemeldet!)' : ''}`);
      return order;
    });
  });
  app.post('/c/:companyId/vehicles/:id/stolen', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('fahrzeuge', 2);
    const { stolen } = parseBody(z.object({ stolen: z.boolean() }), req.body);
    const v = await getRow(db(), 'vehicles', c.company.id, idParam(req));
    if (!v) throw notFound();
    await db().query('UPDATE vehicles SET stolen = $2 WHERE id = $1', [v.id, stolen]);
    await audit(db(), c.company.id, c.user.id, 'Fahrzeuge', `${v.plate} ${stolen ? 'als gestohlen gemeldet' : 'nicht mehr gestohlen'}`);
    return { ok: true };
  });

  // --- Lager: Bestellungen und Inventur -------------------------------------
  app.post('/c/:companyId/parts/:id/orders', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lager', 2);
    const part = await getRow(db(), 'parts', c.company.id, idParam(req));
    if (!part) throw notFound();
    const b = parseBody(z.object({ qty: zInt(1, 1_000_000), supplier: zText(80).default(''), costCents: zCents.optional(), expected: zOptDate }), req.body);
    const row = await insertRow(db(), 'partOrders', c.company.id, { ...b, partId: part.id, costCents: b.costCents ?? b.qty * part.priceCents, createdBy: c.user.id });
    await audit(db(), c.company.id, c.user.id, 'Lager', `Bestellt: ${b.qty} ${part.unit} ${part.name}${b.supplier ? ` bei ${b.supplier}` : ''}`);
    return row;
  });
  app.post('/c/:companyId/part-orders/:id/:action', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lager', 2);
    const action = (req.params as Record<string, string>).action;
    const { book } = parseBody(z.object({ book: z.boolean().default(false) }), req.body ?? {});
    return tx(async (q) => {
      const po = await getRow(q, 'partOrders', c.company.id, idParam(req));
      if (!po) throw notFound();
      if (po.status !== 'bestellt') throw conflict('Die Bestellung ist schon abgeschlossen.');
      const part = (await getRow(q, 'parts', c.company.id, po.partId))!;
      if (action === 'cancel') {
        await q.query("UPDATE part_orders SET status = 'storniert' WHERE id = $1", [po.id]);
        await audit(q, c.company.id, c.user.id, 'Lager', `Bestellung ${part.name} storniert`);
      } else if (action === 'deliver') {
        if (book && po.costCents > 0) {
          c.need('buchungen', 2);
          checkPayout(c, po.costCents);
          await insertRow(q, 'transactions', c.company.id, { account: 'firma', amountCents: -po.costCents, text: `Wareneingang ${po.qty} × ${part.name}`, category: 'Lager', createdBy: c.user.id });
        }
        await q.query("UPDATE part_orders SET status = 'geliefert', delivered_at = now() WHERE id = $1", [po.id]);
        await q.query('UPDATE parts SET qty = qty + $2 WHERE id = $1', [part.id, po.qty]);
        await q.query('INSERT INTO part_moves (company_id, part_id, delta, note, created_by) VALUES ($1, $2, $3, $4, $5)', [c.company.id, part.id, po.qty, `Wareneingang ${po.supplier}`.trim(), c.user.id]);
        await audit(q, c.company.id, c.user.id, 'Lager', `Wareneingang: ${po.qty} ${part.unit} ${part.name}`);
      } else throw notFound();
      return getRow(q, 'partOrders', c.company.id, po.id);
    });
  });
  app.post('/c/:companyId/parts/:id/count', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lager', 2);
    const { qty } = parseBody(z.object({ qty: zInt(0, 1_000_000) }), req.body);
    return tx(async (q) => {
      const part = await getRow(q, 'parts', c.company.id, idParam(req));
      if (!part) throw notFound();
      const delta = qty - part.qty;
      if (delta) {
        await q.query('UPDATE parts SET qty = $2 WHERE id = $1', [part.id, qty]);
        await q.query('INSERT INTO part_moves (company_id, part_id, delta, note, created_by) VALUES ($1, $2, $3, $4, $5)', [c.company.id, part.id, delta, 'Inventur', c.user.id]);
        await audit(q, c.company.id, c.user.id, 'Lager', `Inventur ${part.name}: ${part.qty} → ${qty} ${part.unit}`);
      }
      return getRow(q, 'parts', c.company.id, part.id);
    });
  });

  // --- Fuhrpark -------------------------------------------------------------
  crud(app, cfg, { kind: 'fleet', path: 'fleet', area: 'fuhrpark', log: 'Fuhrpark', name: (r) => r.name, schema: fleetSchema, quietPatch: true });
  app.post('/c/:companyId/fleet/:id/:action', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('fuhrpark', 2);
    const action = (req.params as Record<string, string>).action;
    const b = parseBody(
      z.object({ userId: zOptId, km: zInt(0, 10_000_000).optional(), fuel: zInt(0, 100).optional(), costCents: zCents.default(0), note: zText(300).default(''), book: z.boolean().default(false), serviceDue: zOptDate }),
      req.body ?? {},
    );
    return tx(async (q) => {
      const f = await getRow(q, 'fleet', c.company.id, idParam(req));
      if (!f) throw notFound();
      if (b.km !== undefined && b.km < f.km) throw badRequest('Der km-Stand kann nicht sinken.', { km: `Mindestens ${f.km}` });
      const log = (a: string) => q.query('INSERT INTO fleet_log (company_id, fleet_id, user_id, action, km, fuel, cost_cents, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
        c.company.id, f.id, c.user.id, a, b.km ?? null, b.fuel ?? null, b.costCents, b.note,
      ]);
      if (action === 'issue') {
        if (f.status !== 'frei') throw conflict(f.status === 'werkstatt' ? `${f.name} ist in der Werkstatt.` : `${f.name} ist schon im Einsatz.`);
        const who = b.userId ?? c.user.id;
        if (!(await getMembership(q, c.company.id, who))) throw badRequest('Diese Person ist nicht in der Firma.');
        await q.query("UPDATE fleet SET status = 'einsatz', driver_id = $2 WHERE id = $1", [f.id, who]);
        await log('ausgabe');
        await audit(q, c.company.id, c.user.id, 'Fuhrpark', `${f.name} ausgegeben`);
      } else if (action === 'return') {
        if (f.status !== 'einsatz') throw conflict(`${f.name} ist nicht ausgegeben.`);
        await q.query("UPDATE fleet SET status = 'frei', driver_id = NULL, km = coalesce($2, km), fuel = coalesce($3, fuel) WHERE id = $1", [f.id, b.km ?? null, b.fuel ?? null]);
        await log('rueckgabe');
        await audit(q, c.company.id, c.user.id, 'Fuhrpark', `${f.name} zurück${b.km !== undefined ? ` (${b.km} km)` : ''}`);
      } else if (action === 'fuel') {
        if (b.book && b.costCents > 0) {
          c.need('buchungen', 2);
          checkPayout(c, b.costCents);
          await insertRow(q, 'transactions', c.company.id, { account: 'firma', amountCents: -b.costCents, text: `Tanken ${f.name}`, category: 'Fuhrpark', createdBy: c.user.id });
        }
        await q.query('UPDATE fleet SET fuel = coalesce($2, 100), km = coalesce($3, km) WHERE id = $1', [f.id, b.fuel ?? null, b.km ?? null]);
        await log('tanken');
      } else if (action === 'damage') {
        if (!b.note) throw badRequest('Bitte den Schaden beschreiben.', { note: 'Pflichtfeld' });
        await q.query("UPDATE fleet SET status = 'werkstatt', driver_id = NULL, note = $2 WHERE id = $1", [f.id, b.note]);
        await log('schaden');
        let order = '';
        if (c.rights.areas.auftraege.level >= 2 && c.company.modules.includes('werkstatt')) {
          const o = await insertRow(q, 'orders', c.company.id, { title: `Fuhrpark: ${f.name} – ${b.note}`.slice(0, 120), kind: 'werkstatt', status: 'neu', priority: true, note: `${f.plate} · gemeldet von ${c.user.displayName}`, createdBy: c.user.id });
          order = ` → ${orderLabel(o.number)}`;
        }
        await audit(q, c.company.id, c.user.id, 'Fuhrpark', `Schaden an ${f.name}: ${b.note}${order}`);
      } else if (action === 'service') {
        if (f.status === 'einsatz') throw conflict('Erst zurücknehmen.');
        await q.query("UPDATE fleet SET status = 'frei', service_due = coalesce($2, service_due), note = '' WHERE id = $1", [f.id, b.serviceDue ?? null]);
        await log('service');
        await audit(q, c.company.id, c.user.id, 'Fuhrpark', `${f.name} wieder einsatzbereit`);
      } else throw notFound();
      return getRow(q, 'fleet', c.company.id, f.id);
    });
  });

  // --- Racing: Team, Meisterschaft, Setups, Runden, Trackdays ---------------
  crud(app, cfg, { kind: 'raceCars', path: 'race-cars', area: 'racing', log: 'Racing', name: (r) => `Rennwagen #${r.number} ${r.car}`, schema: raceCarSchema, refs: { driverId: 'member' }, quietPatch: true });
  crud(app, cfg, { kind: 'championship', path: 'championship', area: 'racing', log: 'Racing', name: (r) => `Meisterschaft ${r.season}: ${r.team}`, schema: champSchema, remove: 2, quietPatch: true });
  crud(app, cfg, { kind: 'laps', path: 'laps', area: 'racing', log: 'Racing', name: (r) => `Runde ${r.track} (${r.driver || 'ohne Fahrer'})`, schema: lapSchema, refs: { carId: 'raceCars' }, remove: 2 });
  app.put('/c/:companyId/setups', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 2);
    const b = parseBody(z.object({ carId: zId, track: zRequired(40), vals: z.record(zRequired(30), zText(40)).refine((o) => Object.keys(o).length <= 30, 'Höchstens 30 Werte'), note: zText(1000).default('') }), req.body);
    await checkRefs(db(), c.company.id, { carId: 'raceCars' }, b);
    await db().query(
      `INSERT INTO setups (company_id, car_id, track, vals, note) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (car_id, track) DO UPDATE SET vals = EXCLUDED.vals, note = EXCLUDED.note, updated_at = now()`,
      [c.company.id, b.carId, b.track, JSON.stringify(b.vals), b.note],
    );
    return { ok: true };
  });
  const packagePrice = (c: Ctx, name: string) => {
    const p = (c.company.extra.trackdayPackages ?? []).find((x) => x.name === name);
    if (!p) throw badRequest('Unbekanntes Paket.', { package: 'Unbekannt' });
    return p.priceCents;
  };
  crud(app, cfg, {
    kind: 'trackdays', path: 'trackdays', area: 'racing', log: 'Racing', name: (r) => `Trackday-Buchung ${r.package}`, schema: trackdaySchema,
    refs: { eventId: 'events', customerId: 'customers', vehicleId: 'vehicles' },
    // Preis kommt aus dem Paket der Firma, nicht vom Browser
    check: async (c, b, old) => {
      if (b.package) b.priceCents = packagePrice(c, b.package as string);
      if (old && b.package && old.billId) throw conflict('Schon abgerechnet: Paket nicht mehr änderbar.');
    },
  });
  app.post('/c/:companyId/trackdays/:id/bill', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 2);
    c.need('rechnungen', 2);
    return tx(async (q) => {
      const t = await getRow(q, 'trackdays', c.company.id, idParam(req));
      if (!t) throw notFound();
      if (t.billId) throw conflict('Schon abgerechnet.');
      const ev = t.eventId ? await getRow(q, 'events', c.company.id, t.eventId) : null;
      const bill = await insertRow(q, 'bills', c.company.id, {
        customerId: t.customerId, title: `Trackday ${t.package}${ev ? ` · ${ev.name}` : ''}${t.transport ? ' inkl. Transport' : ''}`, amountCents: t.priceCents,
        dueDate: addDays(today(), c.company.extra.payDays ?? 3), createdBy: c.user.id,
      });
      await q.query("UPDATE trackday_bookings SET bill_id = $2, status = CASE WHEN status = 'angefragt' THEN 'bestaetigt' ELSE status END WHERE id = $1", [t.id, bill.id]);
      await audit(q, c.company.id, c.user.id, 'Finanzen', `Rechnung R-${bill.number} für Trackday ${t.package} über ${formatUsd(bill.amountCents)}`);
      return bill;
    });
  });

  // --- Rahmenverträge, Nachrichten -------------------------------------------
  crud(app, cfg, { kind: 'contracts', path: 'contracts', area: 'vertraege', log: 'Verträge', name: (r) => `Rahmenvertrag ${r.title || ''}`.trim(), schema: contractSchema, refs: { customerId: 'customers' } });
  app.post('/c/:companyId/messages', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('nachrichten', 2);
    const b = parseBody(z.object({ customerId: zId, dir: z.enum(['in', 'out']).default('out'), text: zRequired(1000) }), req.body);
    await checkRefs(db(), c.company.id, { customerId: 'customers' }, b);
    const row = await insertRow(db(), 'messages', c.company.id, { ...b, userId: c.user.id, read: b.dir === 'out' });
    const name = (await getRow(db(), 'customers', c.company.id, b.customerId))!.name;
    await audit(db(), c.company.id, c.user.id, 'Nachrichten', b.dir === 'out' ? `Nachricht an ${name}` : `Nachricht von ${name} eingetragen`);
    return row;
  });
  app.post('/c/:companyId/messages/read', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('nachrichten', 2);
    const { customerId } = parseBody(z.object({ customerId: zId }), req.body);
    await db().query('UPDATE messages SET read = true WHERE company_id = $1 AND customer_id = $2', [c.company.id, customerId]);
    return { ok: true };
  });

  // --- Ränge, Bewerbungen ---------------------------------------------------
  const checkRankGroups = async (c: Ctx, b: Record<string, unknown>) => {
    const ids = b.groups as string[] | undefined;
    if (!ids?.length) return;
    const groups = await listGroups(db(), c.company.id);
    if (ids.some((g) => !groups.some((x) => x.id === g && !x.isOwner))) throw badRequest('Unbekannte Gruppe.', { groups: 'Unbekannte Gruppe' });
  };
  crud(app, cfg, { kind: 'ranks', path: 'ranks', area: 'raenge', log: 'Ränge', name: (r) => `Rang ${r.name}`, schema: rankSchema, write: 3, check: checkRankGroups });
  // Befördern: Rang setzen, auf Wunsch Gruppen des Rangs und Lohnmodell übernehmen (je mit eigenem Recht).
  app.post('/c/:companyId/ranks/:id/assign', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('zugaenge', 2);
    const rank = await getRow(db(), 'ranks', c.company.id, idParam(req));
    if (!rank) throw notFound();
    const b = parseBody(z.object({ userId: zId, groups: z.boolean().default(false), wage: z.boolean().default(false) }), req.body);
    if (!(await getMembership(db(), c.company.id, b.userId))) throw badRequest('Diese Person ist nicht in der Firma.');
    if (b.groups) c.need('gruppen', 2);
    if (b.wage) c.need('lohn', 3);
    return tx(async (q) => {
      await q.query('UPDATE memberships SET rank = $3 WHERE company_id = $1 AND user_id = $2', [c.company.id, b.userId, rank.name]);
      if (b.groups) for (const g of rank.groups) await q.query('INSERT INTO group_members (group_id, user_id) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM groups WHERE id = $1 AND company_id = $3 AND NOT is_owner) ON CONFLICT DO NOTHING', [g, b.userId, c.company.id]);
      if (b.wage) await q.query('UPDATE memberships SET wage_cents = $3, commission_pct = $4, fixed_cents = $5 WHERE company_id = $1 AND user_id = $2', [c.company.id, b.userId, rank.wageCents, rank.commissionPct, rank.fixedCents]);
      const name = (await q.query<{ n: string }>('SELECT display_name AS n FROM users WHERE id = $1', [b.userId])).rows[0].n;
      await audit(q, c.company.id, c.user.id, 'Ränge', `${name} ist jetzt ${rank.name}${b.groups ? ' (Gruppen übernommen)' : ''}${b.wage ? ' (Lohnmodell übernommen)' : ''}`);
      return { ok: true };
    });
  });
  crud(app, cfg, { kind: 'applications', path: 'applications', area: 'bewerbungen', log: 'Bewerbungen', name: (r) => `Bewerbung ${r.name}`, schema: applicationSchema, quietPatch: true });
  // Einstellen: Konto anlegen (oder vorhandenes nehmen), in die Firma aufnehmen, Bewerbung schließen.
  app.post('/c/:companyId/applications/:id/hire', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('bewerbungen', 2);
    c.need('zugaenge', 2);
    c.needSpecial('einladen');
    const b = parseBody(z.object({ email: z.email({ message: 'Ungültige E-Mail-Adresse' }), rankId: zOptId }), req.body);
    return tx(async (q) => {
      const a = await getRow(q, 'applications', c.company.id, idParam(req));
      if (!a) throw notFound();
      if (a.status === 'eingestellt') throw conflict('Schon eingestellt.');
      const rank = b.rankId ? await getRow(q, 'ranks', c.company.id, b.rankId) : null;
      if (b.rankId && !rank) throw badRequest('Unbekannter Rang.');
      let user = await getUserWithHashByEmail(q, b.email);
      let startPassword: string | null = null;
      if (!user) {
        startPassword = generatePassword();
        const created = await insertUser(q, { email: b.email, displayName: a.name, passwordHash: await hashPassword(startPassword), mustChangePassword: true });
        user = { ...created, passwordHash: '' };
      }
      const ins = await q.query('INSERT INTO memberships (company_id, user_id, rank, wage_cents, commission_pct, fixed_cents) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING', [
        c.company.id, user.id, rank?.name ?? a.role, rank?.wageCents ?? 0, rank?.commissionPct ?? 0, rank?.fixedCents ?? 0,
      ]);
      if (!ins.rowCount) throw conflict('Diese Person ist schon in der Firma.');
      if (rank && c.rights.areas.gruppen.level >= 2) for (const g of rank.groups) await q.query('INSERT INTO group_members (group_id, user_id) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM groups WHERE id = $1 AND company_id = $3 AND NOT is_owner) ON CONFLICT DO NOTHING', [g, user.id, c.company.id]);
      await q.query("UPDATE applications SET status = 'eingestellt' WHERE id = $1", [a.id]);
      await audit(q, c.company.id, c.user.id, 'Bewerbungen', `${a.name} eingestellt`);
      return { userId: user.id, startPassword };
    });
  });

  // --- Abwesenheiten, Stempel-Nachträge -------------------------------------
  app.post('/c/:companyId/absences', async (req) => {
    const c = await companyCtx(req, cfg);
    if (c.rights.support) throw forbidden();
    const b = parseBody(z.object({ userId: zOptId, dateFrom: zDate, dateTo: zDate, kind: z.enum(['urlaub', 'krank', 'schule', 'pruefung', 'sonstiges']).default('urlaub'), note: zText(300).default('') }), req.body);
    if (b.dateTo < b.dateFrom) throw badRequest('Ende vor Beginn.', { dateTo: 'Ende vor Beginn' });
    const who = b.userId ?? c.user.id;
    if (who !== c.user.id) {
      c.need('dienstplan', 2);
      if (c.ownOnly('dienstplan')) throw forbidden('Nur eigene Einträge.');
    }
    if (!(await getMembership(db(), c.company.id, who))) throw badRequest('Diese Person ist nicht in der Firma.');
    // Wer den Dienstplan verwaltet, trägt direkt genehmigt ein.
    const status = c.rights.areas.dienstplan.level >= 3 ? 'genehmigt' : 'beantragt';
    const row = await insertRow(db(), 'absences', c.company.id, { ...b, userId: who, status, decidedBy: status === 'genehmigt' ? c.user.id : null });
    await audit(db(), c.company.id, c.user.id, 'Dienstplan', `Abwesenheit ${b.kind} ${b.dateFrom} bis ${b.dateTo} ${status}`);
    return row;
  });
  app.post('/c/:companyId/absences/:id/decide', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('dienstplan', 3);
    const { ok } = parseBody(z.object({ ok: z.boolean() }), req.body);
    const a = await getRow(db(), 'absences', c.company.id, idParam(req));
    if (!a) throw notFound();
    if (a.userId === c.user.id && !c.rights.owner) throw forbidden('Den eigenen Antrag entscheidet jemand anderes.');
    await db().query('UPDATE absences SET status = $2, decided_by = $3 WHERE id = $1', [a.id, ok ? 'genehmigt' : 'abgelehnt', c.user.id]);
    await audit(db(), c.company.id, c.user.id, 'Dienstplan', `Abwesenheit ${a.dateFrom} bis ${a.dateTo} ${ok ? 'genehmigt' : 'abgelehnt'}`);
    return { ok: true };
  });
  app.delete('/c/:companyId/absences/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    const a = await getRow(db(), 'absences', c.company.id, idParam(req));
    if (!a) throw notFound();
    if (!(c.rights.areas.dienstplan.level >= 3 || (a.userId === c.user.id && a.status === 'beantragt'))) throw forbidden();
    await db().query('DELETE FROM absences WHERE id = $1', [a.id]);
    return { ok: true };
  });
  app.post('/c/:companyId/corrections', async (req) => {
    const c = await companyCtx(req, cfg);
    if (c.rights.support) throw forbidden();
    const b = parseBody(z.object({ dutyId: zOptId, startedAt: zTs, endedAt: zTs, reason: zRequired(300) }), req.body);
    if (Date.parse(b.endedAt) <= Date.parse(b.startedAt)) throw badRequest('Ende liegt vor dem Beginn.', { endedAt: 'Ende liegt vor dem Beginn' });
    if (Date.parse(b.endedAt) - Date.parse(b.startedAt) > 24 * 3600_000) throw badRequest('Höchstens 24 Stunden am Stück.');
    if (b.dutyId) {
      const d = await getRow(db(), 'duty', c.company.id, b.dutyId);
      if (!d || d.userId !== c.user.id) throw badRequest('Nur eigene Dienstzeiten nachtragen.');
    }
    const row = await insertRow(db(), 'corrections', c.company.id, { ...b, userId: c.user.id });
    await audit(db(), c.company.id, c.user.id, 'Dienst', 'Nachtrag zur Dienstzeit beantragt');
    return row;
  });
  app.post('/c/:companyId/corrections/:id/decide', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('dienstzeiten', 3);
    const { ok } = parseBody(z.object({ ok: z.boolean() }), req.body);
    return tx(async (q) => {
      const k = await getRow(q, 'corrections', c.company.id, idParam(req));
      if (!k) throw notFound();
      if (k.status !== 'beantragt') throw conflict('Schon entschieden.');
      if (k.userId === c.user.id && !c.rights.owner) throw forbidden('Den eigenen Nachtrag genehmigt jemand anderes.');
      if (ok) {
        if (k.dutyId) await q.query('UPDATE duty_sessions SET started_at = $2, ended_at = $3 WHERE id = $1 AND company_id = $4', [k.dutyId, k.startedAt, k.endedAt, c.company.id]);
        else await q.query('INSERT INTO duty_sessions (company_id, user_id, started_at, ended_at, note) VALUES ($1, $2, $3, $4, $5)', [c.company.id, k.userId, k.startedAt, k.endedAt, `Nachtrag: ${k.reason}`]);
      }
      await q.query('UPDATE duty_corrections SET status = $2, decided_by = $3 WHERE id = $1', [k.id, ok ? 'genehmigt' : 'abgelehnt', c.user.id]);
      await audit(q, c.company.id, c.user.id, 'Dienst', `Nachtrag ${ok ? 'genehmigt' : 'abgelehnt'}`);
      return { ok: true };
    });
  });

  // --- Schulungstermine, Lizenzen -------------------------------------------
  crud(app, cfg, {
    kind: 'sessions', path: 'course-sessions', area: 'schulungen', log: 'Schulungen', name: () => 'Schulungstermin', schema: sessionSchema, remove: 2,
    refs: { trainerId: 'member' }, check: (c, b) => courseExists(db(), c.company.id, b.courseId as string | undefined),
  });
  app.post('/c/:companyId/course-sessions/:id/join', async (req) => {
    const c = await companyCtx(req, cfg);
    learnerCtx(c);
    const { join, userId } = parseBody(z.object({ join: z.boolean(), userId: zOptId }), req.body);
    const who = userId ?? c.user.id;
    if (who !== c.user.id) c.need('schulungen', 2);
    if (!(await getMembership(db(), c.company.id, who))) throw badRequest('Diese Person ist nicht in der Firma.');
    const r = await db().query(
      `UPDATE course_sessions SET participants = CASE WHEN $3 THEN (CASE WHEN participants ? $2 THEN participants ELSE participants || to_jsonb($2::text) END) ELSE participants - $2 END
        WHERE company_id = $1 AND id = $4`,
      [c.company.id, who, join, idParam(req)],
    );
    if (!r.rowCount) throw notFound();
    return { ok: true };
  });
  crud(app, cfg, { kind: 'licenses', path: 'licenses', area: 'schulungen', log: 'Schulungen', name: (r) => `Lizenz ${r.name}`, schema: licenseSchema, refs: { holderId: 'member' } });

  // --- Finanzen: Umbuchung, Kassenabschluss, Daueraufträge, Trinkgeld, Ziele -
  app.post('/c/:companyId/transfers', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('buchungen', 2);
    const b = parseBody(z.object({ from: zAccount, to: zAccount, amountCents: zCents.refine((v) => v > 0, 'Betrag fehlt'), text: zText(120).default('') }), req.body);
    if (b.from === b.to) throw badRequest('Gleiches Konto.', { to: 'Anderes Konto wählen' });
    checkPayout(c, b.amountCents);
    return tx(async (q) => {
      const text = b.text || 'Umbuchung';
      await insertRow(q, 'transactions', c.company.id, { account: b.from, amountCents: -b.amountCents, text, category: 'Umbuchung', createdBy: c.user.id });
      await insertRow(q, 'transactions', c.company.id, { account: b.to, amountCents: b.amountCents, text, category: 'Umbuchung', createdBy: c.user.id });
      await audit(q, c.company.id, c.user.id, 'Kasse', `Umbuchung ${formatUsd(b.amountCents)}: ${b.from} → ${b.to}`);
      return { ok: true };
    });
  });
  app.post('/c/:companyId/closings', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('buchungen', 2);
    const b = parseBody(z.object({ countedCents: zCents, note: zText(300).default('') }), req.body);
    return tx(async (q) => {
      await q.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`kasse-${c.company.id}`]);
      const expected = await accountBalance(q, c.company.id, 'kasse');
      const diff = b.countedCents - expected;
      if (diff !== 0) await insertRow(q, 'transactions', c.company.id, { account: 'kasse', amountCents: diff, text: 'Kassendifferenz beim Tagesabschluss', category: 'Kassendifferenz', createdBy: c.user.id });
      const row = await insertRow(q, 'closings', c.company.id, { expectedCents: expected, countedCents: b.countedCents, note: b.note, createdBy: c.user.id });
      await audit(q, c.company.id, c.user.id, 'Kasse', `Tagesabschluss: gezählt ${formatUsd(b.countedCents)}, Differenz ${formatUsd(diff)}`);
      return row;
    });
  });
  crud(app, cfg, { kind: 'standing', path: 'standing', area: 'buchungen', log: 'Kasse', name: (r) => `Dauerauftrag ${r.text}`, schema: standingSchema, write: 3 });
  app.post('/c/:companyId/standing/run', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('buchungen', 2);
    return { booked: await tx((q) => runStandingOrders(q, c.company.id, c.user.id)) };
  });
  crud(app, cfg, { kind: 'goals', path: 'goals', area: 'buchungen', log: 'Kasse', name: (r) => `Ziel ${r.name}`, schema: goalSchema, remove: 2 });
  // Trinkgeld nach gestempelten Stunden im Zeitraum verteilen (Ausgabe aus der Trinkgeldkasse je Person).
  app.post('/c/:companyId/tips', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('buchungen', 2);
    const b = parseBody(z.object({ from: zDate, to: zDate, preview: z.boolean().default(false) }), req.body);
    if (b.to < b.from) throw badRequest('Zeitraum vertauscht.', { to: 'Ende vor Beginn' });
    return tx(async (q) => {
      await q.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`trinkgeld-${c.company.id}`]);
      const pot = await accountBalance(q, c.company.id, 'trinkgeld');
      const { rows } = await q.query<{ userId: string; name: string; minutes: number }>(
        `SELECT d.user_id AS "userId", u.display_name AS name, sum(extract(epoch FROM (d.ended_at - d.started_at)) / 60)::int AS minutes
           FROM duty_sessions d JOIN users u ON u.id = d.user_id
           JOIN memberships m ON m.company_id = d.company_id AND m.user_id = d.user_id AND NOT m.locked
          WHERE d.company_id = $1 AND d.ended_at IS NOT NULL AND d.started_at::date BETWEEN $2 AND $3
          GROUP BY d.user_id, u.display_name HAVING sum(extract(epoch FROM (d.ended_at - d.started_at))) > 0 ORDER BY name`,
        [c.company.id, b.from, b.to],
      );
      const total = rows.reduce((a, r) => a + r.minutes, 0);
      // Cent-genau verteilen: abrunden, Rest an die mit den meisten Minuten
      const shares = rows.map((r) => ({ ...r, cents: total ? Math.floor((pot * r.minutes) / total) : 0 }));
      let rest = pot - shares.reduce((a, s) => a + s.cents, 0);
      for (const s of [...shares].sort((x, y) => y.minutes - x.minutes)) {
        if (rest <= 0) break;
        s.cents += 1;
        rest -= 1;
      }
      if (b.preview) return { pot, shares };
      if (pot <= 0) throw conflict('Die Trinkgeldkasse ist leer.');
      if (!total) throw conflict('Im Zeitraum hat niemand gestempelt.');
      checkPayout(c, pot);
      for (const s of shares) if (s.cents > 0) await insertRow(q, 'transactions', c.company.id, { account: 'trinkgeld', amountCents: -s.cents, text: `Trinkgeld an ${s.name}`, category: 'Trinkgeld', createdBy: c.user.id });
      await audit(q, c.company.id, c.user.id, 'Kasse', `Trinkgeld verteilt: ${formatUsd(pot)} an ${shares.length} Personen`);
      return { pot, shares };
    });
  });

  // --- Preisliste, Regelwerk, Pinnwand --------------------------------------
  crud(app, cfg, {
    kind: 'services', path: 'services', area: 'preisliste', log: 'Preisliste', name: (r) => r.name, schema: serviceSchema,
    check: (c, b) => courseExists(db(), c.company.id, b.courseId as string | undefined),
  });
  app.post('/c/:companyId/rules', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('regelwerk', 2);
    const b = parseBody(z.object({ title: zRequired(120), body: zText(20000).default('') }), req.body);
    const { rows } = await db().query<{ id: string }>('INSERT INTO rule_docs (company_id, title, body) VALUES ($1, $2, $3) RETURNING id', [c.company.id, b.title, b.body]);
    await audit(db(), c.company.id, c.user.id, 'Regelwerk', `${b.title} veröffentlicht`);
    return { id: rows[0].id };
  });
  // Neue Fassung: Version steigt, alle müssen neu bestätigen.
  app.patch('/c/:companyId/rules/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('regelwerk', 2);
    const b = parseBody(z.object({ title: zRequired(120).optional(), body: zText(20000).optional(), newVersion: z.boolean().default(true) }), req.body);
    const r = await db().query<{ title: string; version: number }>(
      `UPDATE rule_docs SET title = coalesce($3, title), body = coalesce($4, body), version = version + CASE WHEN $5 THEN 1 ELSE 0 END, updated_at = now()
        WHERE company_id = $1 AND id = $2 RETURNING title, version`,
      [c.company.id, idParam(req), b.title ?? null, b.body ?? null, b.newVersion],
    );
    if (!r.rowCount) throw notFound();
    await audit(db(), c.company.id, c.user.id, 'Regelwerk', `${r.rows[0].title}: Version ${r.rows[0].version}`);
    return { ok: true };
  });
  app.delete('/c/:companyId/rules/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('regelwerk', 3);
    const r = await db().query<{ title: string }>('DELETE FROM rule_docs WHERE company_id = $1 AND id = $2 RETURNING title', [c.company.id, idParam(req)]);
    if (!r.rowCount) throw notFound();
    await audit(db(), c.company.id, c.user.id, 'Regelwerk', `${r.rows[0].title} gelöscht`);
    return { ok: true };
  });
  app.post('/c/:companyId/rules/:id/ack', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('regelwerk', 1);
    if (c.rights.support) throw forbidden();
    const r = await db().query<{ title: string; version: number }>('SELECT title, version FROM rule_docs WHERE company_id = $1 AND id = $2', [c.company.id, idParam(req)]);
    if (!r.rowCount) throw notFound();
    await db().query('INSERT INTO rule_acks (doc_id, user_id, version) VALUES ($1, $2, $3) ON CONFLICT (doc_id, user_id) DO UPDATE SET version = EXCLUDED.version, acked_at = now()', [idParam(req), c.user.id, r.rows[0].version]);
    await audit(db(), c.company.id, c.user.id, 'Regelwerk', `${r.rows[0].title} (Version ${r.rows[0].version}) bestätigt`);
    return { ok: true };
  });

  app.post('/c/:companyId/posts', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('pinnwand', 2);
    const b = parseBody(postSchema, req.body);
    if (b.pinned) c.need('pinnwand', 3);
    const { rows } = await db().query<{ id: string }>('INSERT INTO posts (company_id, author_id, title, body, pinned, poll) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [
      c.company.id, c.user.id, b.title, b.body, b.pinned, b.poll ? JSON.stringify(b.poll) : null,
    ]);
    await db().query('INSERT INTO post_reads (post_id, user_id) VALUES ($1, $2)', [rows[0].id, c.user.id]);
    await audit(db(), c.company.id, c.user.id, 'Pinnwand', `${b.poll ? 'Umfrage' : 'Beitrag'}: ${b.title}`);
    return { id: rows[0].id };
  });
  const ownPost = async (c: Ctx, id: string) => {
    const p = (await db().query<{ authorId: string | null; title: string }>('SELECT author_id AS "authorId", title FROM posts WHERE company_id = $1 AND id = $2', [c.company.id, id])).rows[0];
    if (!p) throw notFound();
    if (!(c.rights.areas.pinnwand.level >= 3 || (p.authorId === c.user.id && c.rights.areas.pinnwand.level >= 2))) throw forbidden('Nur eigene Beiträge.');
    return p;
  };
  app.patch('/c/:companyId/posts/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    const id = idParam(req);
    await ownPost(c, id);
    const b = parseBody(z.object({ title: zRequired(120).optional(), body: zText(5000).optional(), pinned: z.boolean().optional() }), req.body);
    if (b.pinned !== undefined) c.need('pinnwand', 3);
    await db().query('UPDATE posts SET title = coalesce($2, title), body = coalesce($3, body), pinned = coalesce($4, pinned) WHERE id = $1', [id, b.title ?? null, b.body ?? null, b.pinned ?? null]);
    return { ok: true };
  });
  app.delete('/c/:companyId/posts/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    const id = idParam(req);
    const p = await ownPost(c, id);
    await db().query('DELETE FROM posts WHERE id = $1', [id]);
    await audit(db(), c.company.id, c.user.id, 'Pinnwand', `${p.title} gelöscht`);
    return { ok: true };
  });
  app.post('/c/:companyId/posts/:id/read', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('pinnwand', 1);
    if (c.rights.support) return { ok: true };
    const r = await db().query('INSERT INTO post_reads (post_id, user_id) SELECT id, $3 FROM posts WHERE company_id = $1 AND id = $2 ON CONFLICT DO NOTHING', [c.company.id, idParam(req), c.user.id]);
    return { ok: true, new: !!r.rowCount };
  });
  app.post('/c/:companyId/posts/:id/vote', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('pinnwand', 1);
    if (c.rights.support) throw forbidden();
    const { option } = parseBody(z.object({ option: zInt(0, 7) }), req.body);
    const p = (await db().query<{ poll: { options: string[]; endsAt: string | null } | null }>('SELECT poll FROM posts WHERE company_id = $1 AND id = $2', [c.company.id, idParam(req)])).rows[0];
    if (!p) throw notFound();
    if (!p.poll) throw badRequest('Das ist keine Umfrage.');
    if (option >= p.poll.options.length) throw badRequest('Unbekannte Antwort.');
    if (p.poll.endsAt && Date.parse(p.poll.endsAt) < Date.now()) throw conflict('Die Umfrage ist beendet.');
    await db().query('INSERT INTO poll_votes (post_id, user_id, option) VALUES ($1, $2, $3) ON CONFLICT (post_id, user_id) DO UPDATE SET option = EXCLUDED.option', [idParam(req), c.user.id, option]);
    await db().query('INSERT INTO post_reads (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [idParam(req), c.user.id]);
    return { ok: true };
  });

  // --- Weitere Firmeneinstellungen ------------------------------------------
  app.patch('/c/:companyId/extra', async (req) => {
    const c = await companyCtx(req, cfg);
    const b = parseBody(extraSchema, req.body);
    // Jede Einstellung gehört zu einem Bereich
    if (b.templates !== undefined) c.need('nachrichten', 3);
    if (b.trackdayPackages !== undefined) c.need('racing', 3);
    if (b.payDays !== undefined || b.footer !== undefined || b.locations !== undefined || b.publicData !== undefined) c.need('firma', 2);
    const extra: CompanyExtra = { ...c.company.extra, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) };
    await updateCompany(db(), c.company.id, { extra });
    await audit(db(), c.company.id, c.user.id, 'Firma', `Einstellungen geändert (${Object.keys(b).join(', ')})`);
    return { ok: true };
  });

  // --- Webhooks (Discord-Meldungen) -----------------------------------------
  crud(app, cfg, {
    kind: 'webhooks', path: 'webhooks', area: 'firma', log: 'Firma', name: (r) => `Webhook ${r.name || r.kind}`, schema: webhookSchema, write: 3,
    check: (_c, b) => {
      if (typeof b.url === 'string') {
        const p = webhookUrlProblem(b.url);
        if (p) throw badRequest(p, { url: p });
      }
    },
  });
  app.post('/c/:companyId/webhooks/:id/test', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('firma', 3);
    const h = await getRow(db(), 'webhooks', c.company.id, idParam(req));
    if (!h) throw notFound();
    const status = await sendHook(h, { company: c.company.name, area: 'Test', action: 'Testnachricht aus Pitstop', user: c.user.displayName, at: new Date().toISOString() });
    await db().query('UPDATE webhooks SET last_status = $2, last_at = now() WHERE id = $1', [h.id, status]);
    return { status };
  });

  // --- Live-Feed: Protokoll, gefiltert nach den Bereichen, die man sieht ------
  app.get('/c/:companyId/feed', async (req): Promise<{ items: FeedItem[] }> => {
    const c = await companyCtx(req, cfg);
    // Bereiche mit „nur eigene“ fehlen im Feed, sonst sähe man fremde Einträge (z. B. Lohn anderer)
    const allowed = Object.entries(FEED_AREAS).filter(([, v]) => c.rights.areas[v.area].level >= 1 && !c.rights.areas[v.area].own).map(([k]) => k);
    if (!allowed.length) return { items: [] };
    const { rows } = await db().query<FeedItem>(
      `SELECT a.id, coalesce(u.display_name, 'System') AS "userName", a.area, a.action, a.created_at AS "createdAt"
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
        WHERE a.company_id = $1 AND a.area = ANY($2) ORDER BY a.id DESC LIMIT 150`,
      [c.company.id, allowed],
    );
    return { items: rows };
  });

  // --- Vorschau als Person: effektive Rechte eines Mitglieds ----------------
  app.get('/c/:companyId/rights/:userId', async (req) => {
    const c = await companyCtx(req, cfg);
    if (!(c.rights.areas.gruppen.level >= 1 || c.rights.areas.zugaenge.level >= 1)) throw forbidden();
    const userId = idParam(req, 'userId');
    const r = await rightsFor(db(), c.company, userId, false, today());
    if (!r) throw notFound('Diese Person ist nicht in der Firma.');
    return { rights: r };
  });

  // --- Lohn: Fixum je Person ------------------------------------------------
  app.patch('/c/:companyId/wages/:userId/fixed', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lohn', 3);
    const { fixedCents } = parseBody(z.object({ fixedCents: zCents }), req.body);
    const r = await db().query('UPDATE memberships SET fixed_cents = $3 WHERE company_id = $1 AND user_id = $2', [c.company.id, idParam(req, 'userId'), fixedCents]);
    if (!r.rowCount) throw notFound();
    return { ok: true };
  });
}
