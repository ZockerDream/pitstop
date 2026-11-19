import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addDays, diffDays, isValidISODate, today } from '../../shared/dates';
import { formatEuro } from '../../shared/format';
import { totalsFor } from '../../shared/money';
import { EXPENSE_CATEGORIES, UNITS } from '../../shared/types';
import { requirePermission } from '../auth/guards';
import { db, tx } from '../db/pool';
import { badRequest, conflict, notFound, parseBody, zCents, zDate, zId, zRequired, zText } from '../errors';
import { getCustomer, insertNote } from '../repo/customers';
import { insertExpense } from '../repo/expenses';
import { getInvoice, insertInvoice, markPaid, raiseDunning } from '../repo/invoices';
import { getVehicle, raiseMileage } from '../repo/vehicles';
import { idParam, type RouteOptions } from './util';

const itemSchema = z.object({
  description: zRequired(300),
  quantity: z.number({ message: 'Menge fehlt' }).gt(0, 'Menge muss größer 0 sein').max(100_000, 'Menge zu groß'),
  unit: z.enum(UNITS, { message: 'Bitte Einheit wählen' }),
  unitPriceCents: zCents,
});

const invoiceSchema = z.object({
  customerId: zId,
  vehicleId: zId.nullable().default(null),
  mileage: z.number({ message: 'Zahl erwartet' }).int().min(0, 'Nicht negativ').max(3_000_000).nullable().default(null),
  issueDate: zDate,
  paymentTermDays: z.number({ message: 'Zahl erwartet' }).int().min(0, 'Mindestens 0 Tage').max(120, 'Höchstens 120 Tage'),
  items: z.array(itemSchema).min(1, 'Mindestens eine Position').max(100, 'Höchstens 100 Positionen'),
});

const expenseSchema = z.object({
  date: zDate,
  supplier: zRequired(200),
  category: z.enum(EXPENSE_CATEGORIES, { message: 'Bitte Kategorie wählen' }),
  description: zText(300).default(''),
  netCents: zCents.refine((v) => v > 0, 'Betrag muss größer 0 sein'),
  vatRate: z.union([z.literal(0), z.literal(7), z.literal(19)], { message: 'MwSt.-Satz 0, 7 oder 19 %' }),
  paid: z.boolean().default(true),
});

export async function financeRoutes(app: FastifyInstance, _opts: RouteOptions): Promise<void> {
  app.post('/invoices', async (req) => {
    const user = requirePermission(req, 'finance:view');
    const input = parseBody(invoiceSchema, req.body);
    if (!isValidISODate(input.issueDate)) throw badRequest('Bitte die markierten Angaben prüfen.', { issueDate: 'Ungültiges Datum' });
    const customer = await getCustomer(db(), input.customerId);
    if (!customer) throw badRequest('Bitte die markierten Angaben prüfen.', { customerId: 'Kunde nicht gefunden' });
    if (customer.status === 'inactive') throw badRequest('Bitte die markierten Angaben prüfen.', { customerId: 'Inaktive Kunden erhalten keine Rechnungen' });
    if (input.vehicleId) {
      const vehicle = await getVehicle(db(), input.vehicleId);
      if (!vehicle || vehicle.customerId !== input.customerId) {
        throw badRequest('Bitte die markierten Angaben prüfen.', { vehicleId: 'Fahrzeug gehört nicht zu diesem Kunden' });
      }
    }
    const items = input.items.map((i) => ({ ...i, quantity: Math.round(i.quantity * 100) / 100 }));
    if (totalsFor(items, 19).gross <= 0) throw badRequest('Die Rechnung braucht einen Betrag größer 0.');
    const result = await tx(async (c) => {
      const id = await insertInvoice(c, {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        mileage: input.vehicleId ? input.mileage : null,
        issueDate: input.issueDate,
        dueDate: addDays(input.issueDate, input.paymentTermDays),
        vatRate: 19,
        items,
        createdByUserId: user.id,
      });
      // Kilometerstand am Fahrzeug fortschreiben (nur nach oben).
      const vehicle = input.vehicleId && input.mileage !== null ? await raiseMileage(c, input.vehicleId, input.mileage) : null;
      return { invoice: await getInvoice(c, id), vehicle };
    });
    req.log.info({ invoice: result.invoice?.number }, 'Rechnung erstellt');
    return result;
  });

  app.post('/invoices/:id/pay', async (req) => {
    requirePermission(req, 'finance:view');
    const id = idParam(req);
    if (!(await getInvoice(db(), id))) throw notFound('Rechnung nicht gefunden.');
    if (!(await markPaid(db(), id, today()))) throw conflict('Die Rechnung ist bereits bezahlt.');
    return { invoice: await getInvoice(db(), id) };
  });

  app.post('/invoices/:id/remind', async (req) => {
    const user = requirePermission(req, 'finance:view');
    const id = idParam(req);
    const now = today();
    return tx(async (c) => {
      const inv = await getInvoice(c, id);
      if (!inv) throw notFound('Rechnung nicht gefunden.');
      if (inv.status !== 'open') throw conflict('Die Rechnung ist bereits bezahlt.');
      if (inv.dueDate >= now) throw conflict('Die Rechnung ist noch nicht fällig.');
      if (inv.dunningLevel >= 3) throw conflict('Die höchste Mahnstufe ist bereits erreicht.');
      await raiseDunning(c, id, now);
      const invoice = (await getInvoice(c, id))!;
      const gross = totalsFor(invoice.items, invoice.vatRate).gross;
      const note = await insertNote(c, {
        customerId: invoice.customerId,
        kind: 'system',
        text: `Mahnung Stufe ${invoice.dunningLevel} zu Rechnung #${invoice.number} versendet (${formatEuro(gross)}, ${diffDays(invoice.dueDate, now)} Tage überfällig).`,
        authorUserId: user.id,
        authorName: user.displayName,
      });
      return { invoice, note };
    });
  });

  app.post('/expenses', async (req) => {
    const user = requirePermission(req, 'finance:view');
    const input = parseBody(expenseSchema, req.body);
    if (!isValidISODate(input.date)) throw badRequest('Bitte die markierten Angaben prüfen.', { date: 'Ungültiges Datum' });
    const expense = await insertExpense(db(), input, user.id);
    return { expense };
  });
}
