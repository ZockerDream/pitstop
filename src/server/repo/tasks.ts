import type { Task } from '../../shared/types';
import type { Queryable } from '../db/pool';

const TASK_COLS = `id, title, done, due_date AS "dueDate", created_at AS "createdAt"`;

export async function listTasks(q: Queryable): Promise<Task[]> {
  const { rows } = await q.query<Task>(`SELECT ${TASK_COLS} FROM tasks ORDER BY done, due_date NULLS LAST, created_at`);
  return rows;
}

export async function insertTask(q: Queryable, t: { title: string; dueDate: string | null; done?: boolean }): Promise<Task> {
  const { rows } = await q.query<Task>(`INSERT INTO tasks (title, due_date, done) VALUES ($1, $2, $3) RETURNING ${TASK_COLS}`, [
    t.title,
    t.dueDate,
    t.done ?? false,
  ]);
  return rows[0];
}

export async function toggleTask(q: Queryable, id: string): Promise<Task | null> {
  const { rows } = await q.query<Task>(`UPDATE tasks SET done = NOT done WHERE id = $1 RETURNING ${TASK_COLS}`, [id]);
  return rows[0] ?? null;
}
