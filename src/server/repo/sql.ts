import type { Queryable } from '../db/pool';

/** UPDATE nur für die übergebenen Felder; columns bildet camelCase-Feld → Spalte ab. */
export async function updateColumns<T>(
  q: Queryable,
  table: string,
  id: string,
  patch: object,
  columns: Record<string, string>,
  returning: string,
): Promise<T | null> {
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [field, column] of Object.entries(columns)) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      values.push((patch as Record<string, unknown>)[field]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  const sql = sets.length
    ? `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $1 RETURNING ${returning}`
    : `SELECT ${returning} FROM ${table} WHERE id = $1`;
  const { rows } = await q.query<T & object>(sql, values);
  return (rows[0] as T) ?? null;
}
