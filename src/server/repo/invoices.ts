import type { Invoice, InvoiceItem, InvoiceItemInput, VatRate } from '../../shared/types';
import type { Queryable } from '../db/pool';

const INVOICE_COLS = `id, number, customer_id AS "customerId", vehicle_id AS "vehicleId", mileage, issue_date AS "issueDate", due_date AS "dueDate",
  vat_rate AS "vatRate", status, paid_at AS "paidAt", dunning_level AS "dunningLevel",
  last_reminded_at AS "lastRemindedAt", created_at AS "createdAt"`;
const ITEM_COLS = `id, invoice_id AS "invoiceId", description, quantity, unit, unit_price_cents AS "unitPriceCents"`;

type InvoiceRow = Omit<Invoice, 'items'>;
type ItemRow = InvoiceItem & { invoiceId: string };

async function attachItems(q: Queryable, invoices: InvoiceRow[]): Promise<Invoice[]> {
  if (invoices.length === 0) return [];
  const { rows } = await q.query<ItemRow>(`SELECT ${ITEM_COLS} FROM invoice_items WHERE invoice_id = ANY($1::uuid[]) ORDER BY position`, [
    invoices.map((i) => i.id),
  ]);
  const byInvoice = new Map<string, InvoiceItem[]>();
  for (const { invoiceId, ...item } of rows) {
    const list = byInvoice.get(invoiceId) ?? [];
    list.push(item);
    byInvoice.set(invoiceId, list);
  }
  return invoices.map((inv) => ({ ...inv, items: byInvoice.get(inv.id) ?? [] }));
}

export async function listInvoices(q: Queryable): Promise<Invoice[]> {
  const { rows } = await q.query<InvoiceRow>(`SELECT ${INVOICE_COLS} FROM invoices ORDER BY number DESC`);
  return attachItems(q, rows);
}

export async function getInvoice(q: Queryable, id: string): Promise<Invoice | null> {
  const { rows } = await q.query<InvoiceRow>(`SELECT ${INVOICE_COLS} FROM invoices WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  return (await attachItems(q, rows))[0];
}

export interface NewInvoice {
  customerId: string;
  vehicleId?: string | null;
  mileage?: number | null;
  issueDate: string;
  dueDate: string;
  vatRate: VatRate;
  items: InvoiceItemInput[];
  createdByUserId: string | null;
  number?: number;
  status?: 'open' | 'paid';
  paidAt?: string | null;
  dunningLevel?: number;
  lastRemindedAt?: string | null;
  createdAt?: string;
}

/** Muss in einer Transaktion laufen (Rechnung + Positionen). */
export async function insertInvoice(q: Queryable, inv: NewInvoice): Promise<string> {
  const { rows } = await q.query<{ id: string }>(
    `INSERT INTO invoices (customer_id, issue_date, due_date, vat_rate, status, paid_at, dunning_level, last_reminded_at, created_by_user_id, number, created_at, vehicle_id, mileage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, coalesce($10, nextval('invoice_number_seq')), coalesce($11::timestamptz, now()), $12, $13)
     RETURNING id`,
    [
      inv.customerId,
      inv.issueDate,
      inv.dueDate,
      inv.vatRate,
      inv.status ?? 'open',
      inv.paidAt ?? null,
      inv.dunningLevel ?? 0,
      inv.lastRemindedAt ?? null,
      inv.createdByUserId,
      inv.number ?? null,
      inv.createdAt ?? null,
      inv.vehicleId ?? null,
      inv.mileage ?? null,
    ],
  );
  const id = rows[0].id;
  let position = 1;
  for (const item of inv.items) {
    await q.query('INSERT INTO invoice_items (invoice_id, position, description, quantity, unit, unit_price_cents) VALUES ($1,$2,$3,$4,$5,$6)', [
      id,
      position++,
      item.description,
      item.quantity,
      item.unit,
      item.unitPriceCents,
    ]);
  }
  return id;
}

export async function markPaid(q: Queryable, id: string, paidAt: string): Promise<boolean> {
  const { rowCount } = await q.query(`UPDATE invoices SET status = 'paid', paid_at = $2 WHERE id = $1 AND status = 'open'`, [id, paidAt]);
  return (rowCount ?? 0) > 0;
}

export async function raiseDunning(q: Queryable, id: string, remindedAt: string): Promise<boolean> {
  const { rowCount } = await q.query(
    `UPDATE invoices SET dunning_level = dunning_level + 1, last_reminded_at = $2
      WHERE id = $1 AND status = 'open' AND due_date < $2 AND dunning_level < 3`,
    [id, remindedAt],
  );
  return (rowCount ?? 0) > 0;
}
