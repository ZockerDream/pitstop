import type { ContactInput, ContactPerson, Customer, CustomerInput, Note, NoteKind } from '../../shared/types';
import type { Queryable } from '../db/pool';
import { updateColumns } from './sql';

const CUSTOMER_COLS = `id, number, name, kind, status, street, zip, city, phone, email, vat_id AS "vatId",
  payment_term_days AS "paymentTermDays", owner_employee_id AS "ownerEmployeeId", tags, created_at AS "createdAt"`;
const CUSTOMER_FIELDS: Record<keyof CustomerInput, string> = {
  name: 'name',
  kind: 'kind',
  status: 'status',
  street: 'street',
  zip: 'zip',
  city: 'city',
  phone: 'phone',
  email: 'email',
  vatId: 'vat_id',
  paymentTermDays: 'payment_term_days',
  ownerEmployeeId: 'owner_employee_id',
  tags: 'tags',
};
const CONTACT_COLS = `id, customer_id AS "customerId", name, position, phone, email, is_primary AS "isPrimary"`;
const NOTE_COLS = `id, customer_id AS "customerId", kind, text, author_user_id AS "authorUserId", author_name AS "authorName", created_at AS "createdAt"`;

export async function listCustomers(q: Queryable): Promise<Customer[]> {
  const { rows } = await q.query<Customer>(`SELECT ${CUSTOMER_COLS} FROM customers ORDER BY name`);
  return rows;
}

export async function getCustomer(q: Queryable, id: string): Promise<Customer | null> {
  const { rows } = await q.query<Customer>(`SELECT ${CUSTOMER_COLS} FROM customers WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function insertCustomer(q: Queryable, c: CustomerInput, createdAt?: string, number?: number): Promise<Customer> {
  const { rows } = await q.query<Customer>(
    `INSERT INTO customers (name, kind, status, street, zip, city, phone, email, vat_id, payment_term_days, owner_employee_id, tags, created_at, number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, coalesce($13::date, CURRENT_DATE), coalesce($14, nextval('customer_number_seq')))
     RETURNING ${CUSTOMER_COLS}`,
    [c.name, c.kind, c.status, c.street, c.zip, c.city, c.phone, c.email, c.vatId, c.paymentTermDays, c.ownerEmployeeId, c.tags, createdAt ?? null, number ?? null],
  );
  return rows[0];
}

export function updateCustomer(q: Queryable, id: string, patch: Partial<CustomerInput>): Promise<Customer | null> {
  return updateColumns<Customer>(q, 'customers', id, patch, CUSTOMER_FIELDS, CUSTOMER_COLS);
}

export async function listContacts(q: Queryable): Promise<ContactPerson[]> {
  const { rows } = await q.query<ContactPerson>(`SELECT ${CONTACT_COLS} FROM contacts ORDER BY is_primary DESC, name`);
  return rows;
}

/** Legt einen Ansprechpartner an; ist er Hauptkontakt, verlieren die anderen den Status. Gibt alle Kontakte des Kunden zurück. */
export async function insertContact(q: Queryable, customerId: string, c: ContactInput): Promise<ContactPerson[]> {
  if (c.isPrimary) await q.query('UPDATE contacts SET is_primary = false WHERE customer_id = $1', [customerId]);
  const { rows: existing } = await q.query<{ n: number }>('SELECT count(*)::int AS n FROM contacts WHERE customer_id = $1', [customerId]);
  const isPrimary = c.isPrimary || existing[0].n === 0;
  await q.query('INSERT INTO contacts (customer_id, name, position, phone, email, is_primary) VALUES ($1,$2,$3,$4,$5,$6)', [
    customerId,
    c.name,
    c.position,
    c.phone,
    c.email,
    isPrimary,
  ]);
  const { rows } = await q.query<ContactPerson>(`SELECT ${CONTACT_COLS} FROM contacts WHERE customer_id = $1 ORDER BY is_primary DESC, name`, [customerId]);
  return rows;
}

export async function listNotes(q: Queryable): Promise<Note[]> {
  const { rows } = await q.query<Note>(`SELECT ${NOTE_COLS} FROM notes ORDER BY created_at DESC`);
  return rows;
}

export async function insertNote(
  q: Queryable,
  n: { customerId: string; kind: NoteKind; text: string; authorUserId: string | null; authorName: string; createdAt?: string },
): Promise<Note> {
  const { rows } = await q.query<Note>(
    `INSERT INTO notes (customer_id, kind, text, author_user_id, author_name, created_at)
     VALUES ($1,$2,$3,$4,$5, coalesce($6::timestamptz, now())) RETURNING ${NOTE_COLS}`,
    [n.customerId, n.kind, n.text, n.authorUserId, n.authorName, n.createdAt ?? null],
  );
  return rows[0];
}
