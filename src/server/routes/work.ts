// Fachbereiche einer Firma: Kunden, Fahrzeuge, Aufträge, Einsätze, Rechnungen, Buchungen, Stempeluhr.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { calloutLabel, formatUsd, orderLabel } from '../../shared/format';
import type { Area } from '../../shared/permissions';
import { companyCtx, type Ctx } from '../auth/guards';
import { db, tx, type Queryable } from '../db/pool';
import { badRequest, conflict, forbidden, notFound, parseBody, zCents, zId, zRequired, zText } from '../errors';
import { audit, getMembership } from '../repo/companies';
import { deleteRow, getRow, insertRow, updateRow, type Kind } from '../repo/records';
import { addDays, today } from '../../shared/dates';
import { checkQualified } from './more';
import { removeOrderPhotos } from './photos';
import { idParam, type RouteOptions } from './util';

const zOptId = zId.nullable().optional();
const customerSchema = z.object({
  name: zRequired(80),
  kind: z.enum(['privat', 'firma', 'fraktion', 'racing']).default('privat'),
  phone: zText(40).default(''),
  note: zText(1000).default(''),
  discount: z.number().int().min(0).max(100).default(0),
});
const vehicleSchema = z.object({ customerId: zOptId, plate: zRequired(16).transform((s) => s.toUpperCase()), model: zText(60).default(''), note: zText(500).default('') });
const orderSchema = z.object({
  title: zRequired(120),
  kind: z.enum(['werkstatt', 'tuning', 'karosserie', 'racing']).default('werkstatt'),
  status: z.enum(['neu', 'arbeit', 'wartet', 'fertig', 'abgeholt']).default('neu'),
  priority: z.boolean().default(false),
  customerId: zOptId,
  vehicleId: zOptId,
  assigneeId: zOptId,
  amountCents: zCents.default(0),
  progress: z.number().int().min(0).max(100).default(0),
  note: zText(2000).default(''),
  serviceId: zOptId,
});
const calloutSchema = z.object({
  location: zRequired(120),
  x: z.number().min(-5000).max(9000).nullable().default(null),
  y: z.number().min(-5000).max(9000).nullable().default(null),
  requester: zText(80).default(''),
  vehicle: zText(80).default(''),
  status: z.enum(['offen', 'unterwegs', 'vorort', 'erledigt']).default('offen'),
  driverId: zOptId,
  truck: zText(40).default(''),
  feeCents: zCents.default(0),
});
const billSchema = z.object({
  customerId: zOptId,
  orderId: zOptId,
  calloutId: zOptId,
  title: zRequired(160),
  amountCents: zCents.refine((v) => v > 0, 'Betrag muss größer als 0 sein'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  kind: z.enum(['rechnung', 'angebot']).default('rechnung'),
});
const txSchema = z.object({
  account: z.enum(['firma', 'kasse', 'trinkgeld', 'rennteam']).default('firma'),
  amountCents: z.number().int().min(-2_000_000_000).max(2_000_000_000).refine((v) => v !== 0, 'Betrag darf nicht 0 sein'),
  text: zRequired(160),
  category: zText(40).default('Sonstiges'),
  bookedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Prüft, dass eine verknüpfte ID zur selben Firma gehört. */
async function sameCompany(q: Queryable, k: Kind, companyId: string, id: string | null | undefined): Promise<void> {
  if (id && !(await getRow(q, k, companyId, id))) throw badRequest('Verknüpfung gehört nicht zu dieser Firma.');
}
async function memberOf(q: Queryable, companyId: string, userId: string | null | undefined): Promise<void> {
  if (userId && !(await getMembership(q, companyId, userId))) throw badRequest('Diese Person ist nicht in der Firma.');
}
/** Bei „nur eigene“ darf man fremde Einträge nicht ändern. */
function checkOwn(c: Ctx, area: Area, ownerIds: (string | null)[]): void {
  if (c.ownOnly(area) && !ownerIds.includes(c.user.id)) throw forbidden('Nur eigene Einträge.');
}

export async function workRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  // --- Kunden ---------------------------------------------------------------
  app.post('/c/:companyId/customers', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('kunden', 2);
    const b = parseBody(customerSchema, req.body);
    const row = await insertRow(db(), 'customers', c.company.id, b);
    await db().query('UPDATE customers SET created_by = $2 WHERE id = $1', [row.id, c.user.id]);
    return row;
  });
  app.patch('/c/:companyId/customers/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('kunden', 2);
    const b = parseBody(customerSchema.partial().extend({ blocked: z.boolean().optional() }), req.body);
    if (b.blocked !== undefined) c.needSpecial('kundensperre');
    const row = await updateRow(db(), 'customers', c.company.id, idParam(req), b);
    if (!row) throw notFound();
    if (b.blocked !== undefined) await audit(db(), c.company.id, c.user.id, 'Kunden', `${row.name} ${b.blocked ? 'gesperrt' : 'entsperrt'}`);
    return row;
  });
  app.delete('/c/:companyId/customers/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('kunden', 2);
    c.needSpecial('kundenloeschen');
    const row = await getRow(db(), 'customers', c.company.id, idParam(req));
    if (!row || !(await deleteRow(db(), 'customers', c.company.id, row.id))) throw notFound();
    await audit(db(), c.company.id, c.user.id, 'Kunden', `${row.name} gelöscht`);
    return { ok: true };
  });

  // --- Fahrzeuge ------------------------------------------------------------
  app.post('/c/:companyId/vehicles', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('fahrzeuge', 2);
    const b = parseBody(vehicleSchema, req.body);
    await sameCompany(db(), 'customers', c.company.id, b.customerId);
    return insertRow(db(), 'vehicles', c.company.id, b);
  });
  app.patch('/c/:companyId/vehicles/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('fahrzeuge', 2);
    const b = parseBody(vehicleSchema.partial(), req.body);
    await sameCompany(db(), 'customers', c.company.id, b.customerId);
    const row = await updateRow(db(), 'vehicles', c.company.id, idParam(req), b);
    if (!row) throw notFound();
    return row;
  });
  app.delete('/c/:companyId/vehicles/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('fahrzeuge', 3);
    if (!(await deleteRow(db(), 'vehicles', c.company.id, idParam(req)))) throw notFound();
    return { ok: true };
  });

  // --- Aufträge -------------------------------------------------------------
  app.post('/c/:companyId/orders', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('auftraege', 2);
    const b = parseBody(orderSchema, req.body);
    await sameCompany(db(), 'customers', c.company.id, b.customerId);
    await sameCompany(db(), 'vehicles', c.company.id, b.vehicleId);
    await memberOf(db(), c.company.id, b.assigneeId);
    await checkQualified(db(), c.company.id, b.assigneeId, b.serviceId);
    const row = await insertRow(db(), 'orders', c.company.id, { ...b, createdBy: c.user.id });
    await audit(db(), c.company.id, c.user.id, 'Werkstatt', `${orderLabel(row.number)} angelegt: ${row.title}`);
    return row;
  });
  app.patch('/c/:companyId/orders/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('auftraege', 2);
    const id = idParam(req);
    const old = await getRow(db(), 'orders', c.company.id, id);
    if (!old) throw notFound();
    checkOwn(c, 'auftraege', [old.assigneeId, old.createdBy]);
    const b = parseBody(orderSchema.partial(), req.body);
    await sameCompany(db(), 'customers', c.company.id, b.customerId);
    await sameCompany(db(), 'vehicles', c.company.id, b.vehicleId);
    await memberOf(db(), c.company.id, b.assigneeId);
    if (b.assigneeId !== undefined || b.serviceId !== undefined) {
      await checkQualified(db(), c.company.id, b.assigneeId === undefined ? old.assigneeId : b.assigneeId, b.serviceId === undefined ? old.serviceId : b.serviceId);
    }
    const row = await updateRow(db(), 'orders', c.company.id, id, b);
    if (b.status && b.status !== old.status) await audit(db(), c.company.id, c.user.id, 'Werkstatt', `${orderLabel(old.number)}: ${old.status} → ${b.status}`);
    return row;
  });
  app.delete('/c/:companyId/orders/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('auftraege', 3);
    const row = await getRow(db(), 'orders', c.company.id, idParam(req));
    if (!row) throw notFound();
    await removeOrderPhotos(cfg, c.company.id, row.id);
    await deleteRow(db(), 'orders', c.company.id, row.id);
    await audit(db(), c.company.id, c.user.id, 'Werkstatt', `${orderLabel(row.number)} gelöscht`);
    return { ok: true };
  });

  // --- Einsätze -------------------------------------------------------------
  app.post('/c/:companyId/callouts', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('leitstelle', 2);
    const b = parseBody(calloutSchema, req.body);
    if (b.driverId && b.driverId !== c.user.id) c.needSpecial('zuteilen');
    await memberOf(db(), c.company.id, b.driverId);
    const row = await insertRow(db(), 'callouts', c.company.id, { ...b, createdBy: c.user.id });
    await audit(db(), c.company.id, c.user.id, 'Abschleppdienst', `${calloutLabel(row.number)} angelegt: ${row.location}`);
    return row;
  });
  app.patch('/c/:companyId/callouts/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('leitstelle', 2);
    const id = idParam(req);
    const old = await getRow(db(), 'callouts', c.company.id, id);
    if (!old) throw notFound();
    const b = parseBody(calloutSchema.partial(), req.body);
    // Offene Einsätze ohne Fahrer darf man sich selbst nehmen, auch bei „nur eigene“.
    const takesFree = !old.driverId && b.driverId === c.user.id;
    if (!takesFree) checkOwn(c, 'leitstelle', [old.driverId, old.createdBy]);
    if (b.driverId !== undefined && b.driverId !== old.driverId && b.driverId !== c.user.id) c.needSpecial('zuteilen');
    await memberOf(db(), c.company.id, b.driverId);
    const row = await updateRow(db(), 'callouts', c.company.id, id, b);
    if (b.status === 'erledigt' && old.status !== 'erledigt') await db().query('UPDATE callouts SET done_at = now() WHERE id = $1', [id]);
    if (b.status && b.status !== old.status) await audit(db(), c.company.id, c.user.id, 'Abschleppdienst', `${calloutLabel(old.number)}: ${old.status} → ${b.status}`);
    return b.status === 'erledigt' ? getRow(db(), 'callouts', c.company.id, id) : row;
  });

  // --- Rechnungen -----------------------------------------------------------
  app.post('/c/:companyId/bills', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('rechnungen', 2);
    const b = parseBody(billSchema, req.body);
    await sameCompany(db(), 'customers', c.company.id, b.customerId);
    await sameCompany(db(), 'orders', c.company.id, b.orderId);
    await sameCompany(db(), 'callouts', c.company.id, b.calloutId);
    const dueDate = b.dueDate ?? (b.kind === 'rechnung' ? addDays(today(), c.company.extra.payDays ?? 3) : null);
    const row = await insertRow(db(), 'bills', c.company.id, { ...b, dueDate, createdBy: c.user.id });
    await audit(db(), c.company.id, c.user.id, 'Finanzen', `${b.kind === 'angebot' ? 'Angebot' : 'Rechnung'} R-${row.number} über ${formatUsd(row.amountCents)} ${b.kind === 'angebot' ? 'erstellt' : 'gestellt'}`);
    return row;
  });
  // Angebot annehmen: wird zur Rechnung mit Zahlungsziel.
  app.post('/c/:companyId/bills/:id/accept', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('rechnungen', 2);
    const bill = await getRow(db(), 'bills', c.company.id, idParam(req));
    if (!bill) throw notFound();
    checkOwn(c, 'rechnungen', [bill.createdBy]);
    if (bill.kind !== 'angebot' || bill.status !== 'offen') throw conflict('Nur offene Angebote lassen sich annehmen.');
    await db().query("UPDATE bills SET kind = 'rechnung', due_date = $2, created_at = now() WHERE id = $1", [bill.id, addDays(today(), c.company.extra.payDays ?? 3)]);
    await audit(db(), c.company.id, c.user.id, 'Finanzen', `Angebot R-${bill.number} angenommen, jetzt Rechnung`);
    return getRow(db(), 'bills', c.company.id, bill.id);
  });
  // Mahnen: Zähler hoch und – wenn erlaubt – Nachricht an den Kunden.
  app.post('/c/:companyId/bills/:id/remind', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('rechnungen', 2);
    return tx(async (q) => {
      const bill = await getRow(q, 'bills', c.company.id, idParam(req));
      if (!bill) throw notFound();
      checkOwn(c, 'rechnungen', [bill.createdBy]);
      if (bill.kind !== 'rechnung' || bill.status !== 'offen') throw conflict('Nur offene Rechnungen lassen sich mahnen.');
      await q.query('UPDATE bills SET reminders = reminders + 1, reminded_at = now() WHERE id = $1', [bill.id]);
      let sent = false;
      if (bill.customerId && c.company.modules.includes('kunden') && c.rights.areas.nachrichten.level >= 2) {
        await insertRow(q, 'messages', c.company.id, {
          customerId: bill.customerId, dir: 'out', read: true, userId: c.user.id,
          text: `Zahlungserinnerung: Rechnung R-${bill.number} (${bill.title}) über ${formatUsd(bill.amountCents)} ist noch offen.`,
        });
        sent = true;
      }
      await audit(q, c.company.id, c.user.id, 'Finanzen', `R-${bill.number}: ${bill.reminders + 1}. Mahnung${sent ? ' (Nachricht an Kunden)' : ''}`);
      return { ok: true, sent };
    });
  });
  // Bezahlt: Rechnung schließen und Einnahme in Kasse oder Firmenkonto buchen (eine Transaktion).
  app.post('/c/:companyId/bills/:id/pay', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('rechnungen', 2);
    const { account } = parseBody(z.object({ account: z.enum(['firma', 'kasse', 'trinkgeld', 'rennteam']).default('kasse') }), req.body);
    const id = idParam(req);
    return tx(async (q) => {
      const bill = await getRow(q, 'bills', c.company.id, id);
      if (!bill) throw notFound();
      checkOwn(c, 'rechnungen', [bill.createdBy]);
      if (bill.status !== 'offen') throw conflict('Die Rechnung ist nicht mehr offen.');
      if (bill.kind === 'angebot') throw conflict('Ein Angebot erst annehmen, dann bezahlen.');
      await q.query("UPDATE bills SET status = 'bezahlt', paid_at = now() WHERE id = $1", [id]);
      await insertRow(q, 'transactions', c.company.id, { account, amountCents: bill.amountCents, text: `R-${bill.number} ${bill.title}`, category: 'Einnahme', billId: id, createdBy: c.user.id });
      await audit(q, c.company.id, c.user.id, 'Finanzen', `R-${bill.number} bezahlt (${account === 'kasse' ? 'Kasse' : 'Firmenkonto'})`);
      return getRow(q, 'bills', c.company.id, id);
    });
  });
  app.post('/c/:companyId/bills/:id/cancel', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('rechnungen', 2);
    c.needSpecial('storno');
    const id = idParam(req);
    return tx(async (q) => {
      const bill = await getRow(q, 'bills', c.company.id, id);
      if (!bill) throw notFound();
      if (bill.status === 'storniert') throw conflict('Schon storniert.');
      if (bill.status === 'bezahlt') {
        await insertRow(q, 'transactions', c.company.id, { account: 'firma', amountCents: -bill.amountCents, text: `Storno R-${bill.number}`, category: 'Storno', billId: id, createdBy: c.user.id });
      }
      await q.query("UPDATE bills SET status = 'storniert' WHERE id = $1", [id]);
      await audit(q, c.company.id, c.user.id, 'Finanzen', `R-${bill.number} storniert`);
      return getRow(q, 'bills', c.company.id, id);
    });
  });

  // --- Buchungen ------------------------------------------------------------
  app.post('/c/:companyId/transactions', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('buchungen', 2);
    const b = parseBody(txSchema, req.body);
    if (b.amountCents < 0) {
      const limit = c.rights.specials.auszahlung;
      if (limit === undefined || limit === false) throw forbidden('Ausgaben buchen braucht das Sonderrecht „Ausgaben buchen“.');
      if (typeof limit === 'number' && limit > 0 && -b.amountCents > limit * 100) throw forbidden(`Ausgaben nur bis ${formatUsd(limit * 100)}.`);
    }
    const row = await insertRow(db(), 'transactions', c.company.id, { ...b, createdBy: c.user.id });
    await audit(db(), c.company.id, c.user.id, 'Finanzen', `Buchung ${formatUsd(row.amountCents)}: ${row.text}`);
    return row;
  });

  // --- Stempeluhr (jeder für sich) ------------------------------------------
  app.post('/c/:companyId/duty/start', async (req) => {
    const c = await companyCtx(req, cfg);
    if (c.rights.support) throw forbidden();
    const r = await db().query('INSERT INTO duty_sessions (company_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id', [c.company.id, c.user.id]);
    if (!r.rowCount) throw conflict('Du bist schon im Dienst.');
    await audit(db(), c.company.id, c.user.id, 'Dienst', 'Dienst begonnen');
    return { ok: true };
  });
  app.post('/c/:companyId/duty/stop', async (req) => {
    const c = await companyCtx(req, cfg);
    const r = await db().query('UPDATE duty_sessions SET ended_at = now() WHERE company_id = $1 AND user_id = $2 AND ended_at IS NULL', [c.company.id, c.user.id]);
    if (!r.rowCount) throw conflict('Du bist nicht im Dienst.');
    await audit(db(), c.company.id, c.user.id, 'Dienst', 'Dienst beendet');
    return { ok: true };
  });
  app.delete('/c/:companyId/duty/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('dienstzeiten', 3);
    if (!(await deleteRow(db(), 'duty', c.company.id, idParam(req)))) throw notFound();
    await audit(db(), c.company.id, c.user.id, 'Personal', 'Dienstzeit gelöscht');
    return { ok: true };
  });
}
