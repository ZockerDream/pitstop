import type { Absence, AbsenceKind, AbsenceStatus } from '../../shared/types';
import type { Queryable } from '../db/pool';

const ABSENCE_COLS = `id, employee_id AS "employeeId", kind, from_date AS "fromDate", to_date AS "toDate", status, comment,
  decision_note AS "decisionNote", requested_at AS "requestedAt", decided_at AS "decidedAt",
  decided_by_name AS "decidedByName", seen_by_requester AS "seenByRequester"`;

export async function listAbsences(q: Queryable): Promise<Absence[]> {
  const { rows } = await q.query<Absence>(`SELECT ${ABSENCE_COLS} FROM absences ORDER BY from_date DESC`);
  return rows;
}

export async function getAbsence(q: Queryable, id: string): Promise<Absence | null> {
  const { rows } = await q.query<Absence>(`SELECT ${ABSENCE_COLS} FROM absences WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Nicht abgelehnte Abwesenheiten derselben Art, die den Zeitraum überschneiden. */
export async function findOverlapping(q: Queryable, employeeId: string, kind: AbsenceKind, from: string, to: string): Promise<Absence[]> {
  const { rows } = await q.query<Absence>(
    `SELECT ${ABSENCE_COLS} FROM absences
      WHERE employee_id = $1 AND kind = $2 AND status <> 'rejected' AND from_date <= $4 AND to_date >= $3`,
    [employeeId, kind, from, to],
  );
  return rows;
}

export interface NewAbsence {
  employeeId: string;
  kind: AbsenceKind;
  fromDate: string;
  toDate: string;
  status: AbsenceStatus;
  comment: string;
  decisionNote?: string;
  decidedByUserId?: string | null;
  decidedByName?: string;
  decided?: boolean;
  seenByRequester?: boolean;
  createdByUserId: string | null;
  requestedAt?: string;
  decidedAt?: string;
}

export async function insertAbsence(q: Queryable, a: NewAbsence): Promise<Absence> {
  const { rows } = await q.query<Absence>(
    `INSERT INTO absences (employee_id, kind, from_date, to_date, status, comment, decision_note, decided_at, decided_by_user_id,
                           decided_by_name, seen_by_requester, created_by_user_id, requested_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $8::boolean THEN coalesce($14::timestamptz, now()) END, $9, $10, $11, $12, coalesce($13::timestamptz, now()))
     RETURNING ${ABSENCE_COLS}`,
    [
      a.employeeId,
      a.kind,
      a.fromDate,
      a.toDate,
      a.status,
      a.comment,
      a.decisionNote ?? '',
      a.decided ?? false,
      a.decidedByUserId ?? null,
      a.decidedByName ?? '',
      a.seenByRequester ?? false,
      a.createdByUserId,
      a.requestedAt ?? null,
      a.decidedAt ?? null,
    ],
  );
  return rows[0];
}

export async function decideAbsence(
  q: Queryable,
  id: string,
  d: { status: 'approved' | 'rejected'; decisionNote: string; userId: string; userName: string; seenByRequester: boolean },
): Promise<Absence | null> {
  const { rows } = await q.query<Absence>(
    `UPDATE absences SET status = $2, decision_note = $3, decided_at = now(), decided_by_user_id = $4, decided_by_name = $5, seen_by_requester = $6
      WHERE id = $1 AND status = 'requested' RETURNING ${ABSENCE_COLS}`,
    [id, d.status, d.decisionNote, d.userId, d.userName, d.seenByRequester],
  );
  return rows[0] ?? null;
}

export async function deleteRequestedAbsence(q: Queryable, id: string): Promise<boolean> {
  const { rowCount } = await q.query(`DELETE FROM absences WHERE id = $1 AND status = 'requested'`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function markAbsenceSeen(q: Queryable, id: string): Promise<Absence | null> {
  const { rows } = await q.query<Absence>(`UPDATE absences SET seen_by_requester = true WHERE id = $1 RETURNING ${ABSENCE_COLS}`, [id]);
  return rows[0] ?? null;
}
