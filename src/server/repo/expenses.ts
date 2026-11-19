import type { Expense, ExpenseInput } from '../../shared/types';
import type { Queryable } from '../db/pool';

const EXPENSE_COLS = `id, date, supplier, category, description, net_cents AS "netCents", vat_rate AS "vatRate", paid, created_at AS "createdAt"`;

export async function listExpenses(q: Queryable): Promise<Expense[]> {
  const { rows } = await q.query<Expense>(`SELECT ${EXPENSE_COLS} FROM expenses ORDER BY date DESC, created_at DESC`);
  return rows;
}

export async function insertExpense(q: Queryable, e: ExpenseInput, createdByUserId: string | null): Promise<Expense> {
  const { rows } = await q.query<Expense>(
    `INSERT INTO expenses (date, supplier, category, description, net_cents, vat_rate, paid, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${EXPENSE_COLS}`,
    [e.date, e.supplier, e.category, e.description, e.netCents, e.vatRate, e.paid, createdByUserId],
  );
  return rows[0];
}
