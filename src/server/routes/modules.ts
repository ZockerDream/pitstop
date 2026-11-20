// Module ab 0.3: Lager, Dienstplan, Lohn, Schulungen, Tuning (Preise, Konfigurator, Prüfstand), Racing.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { formatUsd, orderLabel } from '../../shared/format';
import { quoteTuning, tuningOf, type TuningConfig } from '../../shared/tuning';
import type { Course, CourseProgress, Question } from '../../shared/types';
import { companyCtx, type Ctx } from '../auth/guards';
import { db, tx, type Queryable } from '../db/pool';
import { badRequest, conflict, forbidden, notFound, parseBody, zCents, zDate, zId, zRequired, zText } from '../errors';
import { audit, getMembership, listGroups } from '../repo/companies';
import { deleteRow, getRow, insertRow, updateRow } from '../repo/records';
import { idParam, type RouteOptions } from './util';

const zOptId = zId.nullable().optional();
const zTs = z.iso.datetime({ offset: true, message: 'Zeitpunkt erwartet' });

const partSchema = z.object({
  sku: zText(30).default(''),
  name: zRequired(80),
  unit: zText(12).default('Stk'),
  qty: z.number().int().min(0).max(1_000_000).default(0),
  minQty: z.number().int().min(0).max(1_000_000).default(0),
  priceCents: zCents.default(0),
  location: zText(40).default(''),
  note: zText(300).default(''),
});
const moveSchema = z.object({
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, 'Menge darf nicht 0 sein'),
  /** Zugang als Ausgabe buchen (Menge × Preis, Firmenkonto) */
  book: z.boolean().default(false),
  note: zText(120).default(''),
});
const shiftSchema = z.object({ userId: zId, startsAt: zTs, endsAt: zTs, role: zText(40).default(''), note: zText(200).default('') });
const wageSchema = z.object({ wageCents: zCents.optional(), commissionPct: z.number().int().min(0).max(100).optional() });
const runSchema = z.object({ from: zDate, to: zDate });
const lessonSchema = z.object({ title: zRequired(120), text: zText(5000).default('') });
const questionSchema = z.object({
  q: zRequired(300),
  kind: z.enum(['choice', 'text']).default('choice'),
  options: z.array(zRequired(200)).max(6).default([]),
  correct: z.number().int().min(-1).default(-1),
})
  .refine((x) => x.kind === 'text' || x.options.length >= 2, { message: 'Mindestens zwei Antworten', path: ['options'] })
  .refine((x) => x.kind === 'text' || (x.correct >= 0 && x.correct < x.options.length), { message: 'Richtige Antwort fehlt', path: ['correct'] });
const courseSchema = z.object({
  name: zRequired(80),
  category: zText(40).default('Allgemein'),
  lessons: z.array(lessonSchema).max(30).default([]),
  questions: z.array(questionSchema).max(40).default([]),
  passPct: z.number().int().min(0).max(100).default(70),
  validMonths: z.number().int().min(0).max(120).default(0),
  practical: z.boolean().default(false),
  /** Pflicht für diese Gruppen; 'alle' = jede Person in der Firma */
  requiredGroups: z.array(z.union([zId, z.literal('alle')])).default([]),
  trainerId: zOptId,
});
const dynoSchema = z.object({ vehicleId: zOptId, label: zText(60).default(''), hp: z.number().int().min(0).max(5000), torque: z.number().int().min(0).max(10000).default(0), note: zText(200).default('') });
const eventSchema = z.object({
  name: zRequired(80),
  kind: z.enum(['rennen', 'teamstart', 'trackday', 'meet']).default('rennen'),
  startsAt: zTs,
  track: zText(80).default(''),
  laps: z.number().int().min(0).max(500).default(0),
  feeCents: zCents.default(0),
  prizeCents: zCents.default(0),
  maxEntries: z.number().int().min(0).max(500).default(0),
  status: z.enum(['planung', 'offen', 'fertig', 'abgesagt']).default('planung'),
  note: zText(500).default(''),
});
const entrySchema = z.object({
  driver: zRequired(60),
  car: zText(60).default(''),
  startNo: zText(6).default(''),
  customerId: zOptId,
  team: z.boolean().default(false),
  lapMs: z.number().int().min(1).max(86_400_000).nullable().optional(),
  position: z.number().int().min(1).max(500).nullable().optional(),
});
const quoteSchema = z.object({
  vehicleId: zOptId,
  customerId: zOptId,
  cls: zText(30),
  sel: z.record(z.string(), z.number().int().min(0).max(20)),
  packageName: zText(40).optional(),
  title: zText(120).optional(),
});
const tuningSchema = z.object({
  parts: z.array(z.object({ key: z.string().regex(/^[a-z0-9_-]{1,20}$/), name: zRequired(40), levels: z.array(zRequired(30)).min(2).max(10), prices: z.array(z.number().int().min(0).max(10_000_000)) }))
    .min(1).max(30).refine((a) => a.every((p) => p.prices.length === p.levels.length), 'Je Stufe ein Preis'),
  classes: z.record(zRequired(30), z.number().min(0.1).max(10)),
  packages: z.array(z.object({ name: zRequired(40), discount: z.number().int().min(0).max(100), items: z.record(z.string(), z.number().int().min(0).max(20)), note: zText(120).default('') })).max(20),
});

/** Kursfragen ohne Lösung, außer man darf Kurse bearbeiten. */
export function courseView(row: Course, withAnswers: boolean): Course {
  return { ...row, questions: row.questions.map((x: Question) => ({ ...x, correct: withAnswers ? x.correct : -1 })) };
}
const COURSE_COLS = `id, name, category, lessons, questions, pass_pct AS "passPct", valid_months AS "validMonths", practical, required_groups AS "requiredGroups", trainer_id AS "trainerId"`;
export async function listCourses(q: Queryable, companyId: string): Promise<Course[]> {
  return (await q.query<Course>(`SELECT ${COURSE_COLS} FROM courses WHERE company_id = $1 ORDER BY category, name`, [companyId])).rows;
}
export async function listProgress(q: Queryable, companyId: string, userId?: string): Promise<CourseProgress[]> {
  const { rows } = await q.query<CourseProgress>(
    `SELECT p.course_id AS "courseId", p.user_id AS "userId", p.lessons_done AS "lessonsDone", p.score, p.practical_ok AS "practicalOk", p.passed_at AS "passedAt",
            p.answers, p.review,
            CASE WHEN p.passed_at IS NOT NULL AND c.valid_months > 0 THEN (p.passed_at + make_interval(months => c.valid_months))::date END AS "expiresAt"
       FROM course_progress p JOIN courses c ON c.id = p.course_id
      WHERE p.company_id = $1 ${userId ? 'AND p.user_id = $2' : ''}`,
    userId ? [companyId, userId] : [companyId],
  );
  return rows;
}
/** Punktzahl aus Auswahlfragen und bewerteten Freitexten; bestanden erst, wenn nichts mehr offen ist. */
async function scoreCourse(q: Queryable, course: Course, userId: string, choiceRight: number, answers: Record<string, string>, review: Record<string, boolean>, practical: boolean) {
  const textIdx = Object.keys(answers);
  const pending = textIdx.filter((i) => review[i] === undefined).length;
  const right = choiceRight + textIdx.filter((i) => review[i] === true).length;
  const score = Math.round((right / course.questions.length) * 100);
  const passed = !pending && score >= course.passPct && (!course.practical || practical);
  await q.query(
    `UPDATE course_progress SET choice_right = $3, answers = $4, review = $5, score = CASE WHEN $7 THEN score ELSE greatest(coalesce(score, 0), $6) END,
            passed_at = CASE WHEN $8 THEN current_date ELSE passed_at END, updated_at = now() WHERE course_id = $1 AND user_id = $2`,
    [course.id, userId, choiceRight, JSON.stringify(answers), JSON.stringify(review), score, pending > 0, passed],
  );
  return { score, right, passed, pending };
}

async function getCourse(q: Queryable, companyId: string, id: string): Promise<Course> {
  const { rows } = await q.query<Course>(`SELECT ${COURSE_COLS} FROM courses WHERE company_id = $1 AND id = $2`, [companyId, id]);
  if (!rows[0]) throw notFound();
  return rows[0];
}
export async function loadTuning(q: Queryable, companyId: string): Promise<TuningConfig> {
  const { rows } = await q.query<{ tuning: Partial<TuningConfig> }>('SELECT tuning FROM companies WHERE id = $1', [companyId]);
  return tuningOf(rows[0]?.tuning);
}

async function memberOf(q: Queryable, companyId: string, userId: string | null | undefined): Promise<void> {
  if (userId && !(await getMembership(q, companyId, userId))) throw badRequest('Diese Person ist nicht in der Firma.');
}
async function sameCompany(q: Queryable, table: 'vehicles' | 'customers' | 'events', companyId: string, id: string | null | undefined): Promise<void> {
  if (id && !(await getRow(q, table, companyId, id))) throw badRequest('Verknüpfung gehört nicht zu dieser Firma.');
}
function checkAuszahlung(c: Ctx, cents: number): void {
  const limit = c.rights.specials.auszahlung;
  if (limit === undefined || limit === false) throw forbidden('Ausgaben buchen braucht das Sonderrecht „Ausgaben buchen“.');
  if (typeof limit === 'number' && limit > 0 && cents > limit * 100) throw forbidden(`Ausgaben nur bis ${formatUsd(limit * 100)}.`);
}

export async function moduleRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  // --- Lager ----------------------------------------------------------------
  app.post('/c/:companyId/parts', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lager', 2);
    return insertRow(db(), 'parts', c.company.id, parseBody(partSchema, req.body));
  });
  app.patch('/c/:companyId/parts/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lager', 2);
    const row = await updateRow(db(), 'parts', c.company.id, idParam(req), parseBody(partSchema.partial(), req.body));
    if (!row) throw notFound();
    return row;
  });
  app.delete('/c/:companyId/parts/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lager', 3);
    const row = await getRow(db(), 'parts', c.company.id, idParam(req));
    if (!row) throw notFound();
    await deleteRow(db(), 'parts', c.company.id, row.id);
    await audit(db(), c.company.id, c.user.id, 'Lager', `${row.name} gelöscht`);
    return { ok: true };
  });
  // Zugang oder Entnahme; Zugang optional als Ausgabe buchen.
  app.post('/c/:companyId/parts/:id/move', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lager', 2);
    const b = parseBody(moveSchema, req.body);
    const id = idParam(req);
    return tx(async (q) => {
      const part = await getRow(q, 'parts', c.company.id, id);
      if (!part) throw notFound();
      if (part.qty + b.delta < 0) throw conflict(`Nur noch ${part.qty} ${part.unit} auf Lager.`);
      if (b.book && b.delta > 0 && part.priceCents > 0) {
        c.need('buchungen', 2);
        const cents = b.delta * part.priceCents;
        checkAuszahlung(c, cents);
        await insertRow(q, 'transactions', c.company.id, { account: 'firma', amountCents: -cents, text: `${b.delta} × ${part.name}`, category: 'Lager', createdBy: c.user.id });
      }
      await q.query('UPDATE parts SET qty = qty + $3 WHERE company_id = $1 AND id = $2', [c.company.id, id, b.delta]);
      await q.query('INSERT INTO part_moves (company_id, part_id, delta, note, created_by) VALUES ($1, $2, $3, $4, $5)', [c.company.id, id, b.delta, b.note, c.user.id]);
      await audit(q, c.company.id, c.user.id, 'Lager', `${part.name}: ${b.delta > 0 ? '+' : ''}${b.delta} ${part.unit}${b.note ? ` (${b.note})` : ''}`);
      return getRow(q, 'parts', c.company.id, id);
    });
  });

  // --- Dienstplan -----------------------------------------------------------
  app.post('/c/:companyId/shifts', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('dienstplan', 2);
    const b = parseBody(shiftSchema, req.body);
    if (c.ownOnly('dienstplan') && b.userId !== c.user.id) throw forbidden('Nur eigene Schichten.');
    if (Date.parse(b.endsAt) <= Date.parse(b.startsAt)) throw badRequest('Ende liegt vor dem Beginn.', { endsAt: 'Ende liegt vor dem Beginn' });
    await memberOf(db(), c.company.id, b.userId);
    return insertRow(db(), 'shifts', c.company.id, { ...b, createdBy: c.user.id });
  });
  app.patch('/c/:companyId/shifts/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('dienstplan', 2);
    const old = await getRow(db(), 'shifts', c.company.id, idParam(req));
    if (!old) throw notFound();
    const b = parseBody(shiftSchema.partial(), req.body);
    if (c.ownOnly('dienstplan') && (old.userId !== c.user.id || (b.userId && b.userId !== c.user.id))) throw forbidden('Nur eigene Schichten.');
    if (Date.parse(b.endsAt ?? old.endsAt) <= Date.parse(b.startsAt ?? old.startsAt)) throw badRequest('Ende liegt vor dem Beginn.');
    await memberOf(db(), c.company.id, b.userId);
    return updateRow(db(), 'shifts', c.company.id, old.id, b);
  });
  app.delete('/c/:companyId/shifts/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('dienstplan', 2);
    const old = await getRow(db(), 'shifts', c.company.id, idParam(req));
    if (!old) throw notFound();
    if (c.ownOnly('dienstplan') && old.userId !== c.user.id) throw forbidden('Nur eigene Schichten.');
    await deleteRow(db(), 'shifts', c.company.id, old.id);
    return { ok: true };
  });

  // --- Lohn & Provision -----------------------------------------------------
  app.patch('/c/:companyId/wages/:userId', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lohn', 3);
    const b = parseBody(wageSchema, req.body);
    const userId = idParam(req, 'userId');
    const r = await db().query('UPDATE memberships SET wage_cents = coalesce($3, wage_cents), commission_pct = coalesce($4, commission_pct) WHERE company_id = $1 AND user_id = $2', [
      c.company.id, userId, b.wageCents ?? null, b.commissionPct ?? null,
    ]);
    if (!r.rowCount) throw notFound();
    await audit(db(), c.company.id, c.user.id, 'Lohn', 'Lohnangaben geändert');
    return { ok: true };
  });
  // Lohnlauf: Stunden aus der Stempeluhr × Stundenlohn + Provision auf bezahlte Rechnungen eigener Aufträge/Einsätze.
  app.post('/c/:companyId/payslips/run', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lohn', 3);
    const { from, to } = parseBody(runSchema, req.body);
    if (to < from) throw badRequest('Zeitraum vertauscht.', { to: 'Ende vor Beginn' });
    return tx(async (q) => {
      const { rows } = await q.query<{ userId: string; wage: number; pct: number; fixed: number; minutes: number; revenue: number }>(
        `SELECT m.user_id AS "userId", m.wage_cents AS wage, m.commission_pct AS pct, m.fixed_cents AS fixed,
                coalesce((SELECT sum(extract(epoch FROM (d.ended_at - d.started_at)) / 60) FROM duty_sessions d
                           WHERE d.company_id = m.company_id AND d.user_id = m.user_id AND d.ended_at IS NOT NULL
                             AND d.started_at::date BETWEEN $2 AND $3), 0)::int AS minutes,
                coalesce((SELECT sum(b.amount_cents) FROM bills b
                           LEFT JOIN orders o ON o.id = b.order_id LEFT JOIN callouts e ON e.id = b.callout_id
                           WHERE b.company_id = m.company_id AND b.status = 'bezahlt' AND b.paid_at::date BETWEEN $2 AND $3
                             AND (o.assignee_id = m.user_id OR e.driver_id = m.user_id)), 0)::int AS revenue
           FROM memberships m WHERE m.company_id = $1 AND NOT m.locked AND (m.wage_cents > 0 OR m.commission_pct > 0 OR m.fixed_cents > 0)`,
        [c.company.id, from, to],
      );
      let created = 0;
      for (const r of rows) {
        const wageCents = Math.round((r.minutes / 60) * r.wage);
        const commissionCents = Math.round((r.revenue * r.pct) / 100);
        // Fixum gibt es je Lohnlauf, aber nur für Leute, die im Zeitraum gearbeitet oder Umsatz gebracht haben
        const fixedCents = r.minutes > 0 || r.revenue > 0 ? r.fixed : 0;
        if (!wageCents && !commissionCents && !fixedCents) continue;
        const ins = await q.query(
          `INSERT INTO payslips (company_id, user_id, period_from, period_to, minutes, wage_cents, commission_cents, fixed_cents, total_cents, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
          [c.company.id, r.userId, from, to, r.minutes, wageCents, commissionCents, fixedCents, wageCents + commissionCents + fixedCents, c.user.id],
        );
        created += ins.rowCount ?? 0;
      }
      await audit(q, c.company.id, c.user.id, 'Lohn', `Lohnlauf ${from} bis ${to}: ${created} Abrechnungen`);
      return { created };
    });
  });
  app.patch('/c/:companyId/payslips/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lohn', 3);
    const { bonusCents } = parseBody(z.object({ bonusCents: zCents }), req.body);
    const r = await db().query("UPDATE payslips SET bonus_cents = $3, total_cents = wage_cents + commission_cents + fixed_cents + $3 WHERE company_id = $1 AND id = $2 AND status = 'offen'", [c.company.id, idParam(req), bonusCents]);
    if (!r.rowCount) throw conflict('Nur offene Abrechnungen lassen sich ändern.');
    return { ok: true };
  });
  app.post('/c/:companyId/payslips/:id/pay', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lohn', 3);
    c.needSpecial('lohnzahlung');
    const id = idParam(req);
    return tx(async (q) => {
      const slip = await getRow(q, 'payslips', c.company.id, id);
      if (!slip) throw notFound();
      if (slip.status !== 'offen') throw conflict('Schon ausgezahlt.');
      const name = (await q.query<{ n: string }>('SELECT display_name AS n FROM users WHERE id = $1', [slip.userId])).rows[0]?.n ?? '';
      const t = await insertRow(q, 'transactions', c.company.id, { account: 'firma', amountCents: -slip.totalCents, text: `Lohn ${name} ${slip.periodFrom} bis ${slip.periodTo}`, category: 'Lohn', createdBy: c.user.id });
      await q.query("UPDATE payslips SET status = 'bezahlt', paid_at = now(), transaction_id = $2 WHERE id = $1", [id, t.id]);
      await audit(q, c.company.id, c.user.id, 'Lohn', `Lohn ${name} ausgezahlt: ${formatUsd(slip.totalCents)}`);
      return getRow(q, 'payslips', c.company.id, id);
    });
  });
  app.delete('/c/:companyId/payslips/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('lohn', 3);
    const r = await db().query("DELETE FROM payslips WHERE company_id = $1 AND id = $2 AND status = 'offen'", [c.company.id, idParam(req)]);
    if (!r.rowCount) throw conflict('Nur offene Abrechnungen lassen sich löschen.');
    return { ok: true };
  });

  // --- Schulungen -----------------------------------------------------------
  const writeCourse = async (c: Ctx, b: Partial<z.infer<typeof courseSchema>>, id?: string) => {
    const groups = await listGroups(db(), c.company.id);
    if (b.requiredGroups?.some((g) => g !== 'alle' && !groups.some((x) => x.id === g))) throw badRequest('Unbekannte Gruppe.');
    await memberOf(db(), c.company.id, b.trainerId);
    const map: [string, string, unknown][] = [
      ['name', 'name', b.name], ['category', 'category', b.category], ['lessons', 'lessons', b.lessons && JSON.stringify(b.lessons)],
      ['questions', 'questions', b.questions && JSON.stringify(b.questions)], ['passPct', 'pass_pct', b.passPct], ['validMonths', 'valid_months', b.validMonths],
      ['practical', 'practical', b.practical], ['requiredGroups', 'required_groups', b.requiredGroups && JSON.stringify(b.requiredGroups)], ['trainerId', 'trainer_id', b.trainerId],
    ];
    const set = map.filter(([, , v]) => v !== undefined);
    if (id) {
      if (!set.length) return getCourse(db(), c.company.id, id);
      const r = await db().query(`UPDATE courses SET ${set.map(([, col], i) => `${col} = $${i + 3}`).join(', ')} WHERE company_id = $1 AND id = $2 RETURNING id`, [c.company.id, id, ...set.map((x) => x[2])]);
      if (!r.rowCount) throw notFound();
      return getCourse(db(), c.company.id, id);
    }
    const r = await db().query<{ id: string }>(`INSERT INTO courses (company_id, ${set.map((x) => x[1]).join(', ')}) VALUES ($1, ${set.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`, [c.company.id, ...set.map((x) => x[2])]);
    return getCourse(db(), c.company.id, r.rows[0].id);
  };
  app.post('/c/:companyId/courses', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('schulungen', 2);
    const row = await writeCourse(c, parseBody(courseSchema, req.body));
    await audit(db(), c.company.id, c.user.id, 'Schulungen', `Kurs ${row.name} angelegt`);
    return row;
  });
  app.patch('/c/:companyId/courses/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('schulungen', 2);
    return writeCourse(c, parseBody(courseSchema.partial(), req.body), idParam(req));
  });
  app.delete('/c/:companyId/courses/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('schulungen', 3);
    const course = await getCourse(db(), c.company.id, idParam(req));
    await db().query('DELETE FROM courses WHERE id = $1', [course.id]);
    await audit(db(), c.company.id, c.user.id, 'Schulungen', `Kurs ${course.name} gelöscht`);
    return { ok: true };
  });
  // Lernen: jede Person in der Firma für sich selbst (Modul an, nicht im Support-Zugriff).
  const learner = async (req: Parameters<typeof companyCtx>[0]) => {
    const c = await companyCtx(req, cfg);
    if (c.rights.support) throw forbidden();
    if (!c.company.modules.includes('schulungen')) throw forbidden('Modul Schulungen ist aus.');
    if (c.rights.areas.schulungen.locked) throw forbidden('Schulungen sind für dich gesperrt.');
    return c;
  };
  const upsertProgress = (q: Queryable, c: Ctx, courseId: string, userId: string) =>
    q.query('INSERT INTO course_progress (company_id, course_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [c.company.id, courseId, userId]);
  app.post('/c/:companyId/courses/:id/lesson', async (req) => {
    const c = await learner(req);
    const course = await getCourse(db(), c.company.id, idParam(req));
    const { done } = parseBody(z.object({ done: z.number().int().min(0).max(30) }), req.body);
    await upsertProgress(db(), c, course.id, c.user.id);
    await db().query('UPDATE course_progress SET lessons_done = greatest(lessons_done, $3), updated_at = now() WHERE course_id = $1 AND user_id = $2', [course.id, c.user.id, Math.min(done, course.lessons.length)]);
    return { ok: true };
  });
  // Test: der Server wertet aus, die Lösungen verlassen den Server nicht.
  app.post('/c/:companyId/courses/:id/test', async (req) => {
    const c = await learner(req);
    const course = await getCourse(db(), c.company.id, idParam(req));
    const { answers } = parseBody(z.object({ answers: z.array(z.union([z.number().int().min(-1).max(10), zText(2000)])) }), req.body);
    if (!course.questions.length) throw badRequest('Dieser Kurs hat keinen Test.');
    if (answers.length !== course.questions.length) throw badRequest('Bitte alle Fragen beantworten.');
    return tx(async (q) => {
      await upsertProgress(q, c, course.id, c.user.id);
      const p = (await q.query<{ lessons: number; practical: boolean }>('SELECT lessons_done AS lessons, practical_ok AS practical FROM course_progress WHERE course_id = $1 AND user_id = $2', [course.id, c.user.id])).rows[0];
      if (p.lessons < course.lessons.length) throw conflict('Erst alle Lektionen durcharbeiten.');
      const texts: Record<string, string> = {};
      course.questions.forEach((x, i) => {
        if (x.kind === 'text') texts[i] = String(answers[i] ?? '').trim();
      });
      if (Object.values(texts).some((t) => !t)) throw badRequest('Bitte alle Freitext-Fragen beantworten.');
      const choiceRight = course.questions.filter((x, i) => x.kind !== 'text' && answers[i] === x.correct).length;
      const r = await scoreCourse(q, course, c.user.id, choiceRight, texts, {}, p.practical);
      if (r.passed) await audit(q, c.company.id, c.user.id, 'Schulungen', `${course.name} bestanden (${r.score} %)`);
      else if (r.pending) await audit(q, c.company.id, c.user.id, 'Schulungen', `${course.name}: Test abgegeben, ${r.pending} Freitext-Antworten warten auf Bewertung`);
      return { ...r, total: course.questions.length, needsPractical: r.score >= course.passPct && course.practical && !p.practical };
    });
  });
  // Freitext bewerten: Kurse bearbeiten oder Trainer, nie bei sich selbst; danach neu werten.
  app.post('/c/:companyId/courses/:id/review', async (req) => {
    const c = await companyCtx(req, cfg);
    const course = await getCourse(db(), c.company.id, idParam(req));
    if (!(c.rights.areas.schulungen.level >= 2 || (course.trainerId === c.user.id && !c.rights.support))) throw forbidden();
    const { userId, index, ok } = parseBody(z.object({ userId: zId, index: z.number().int().min(0).max(40), ok: z.boolean() }), req.body);
    if (userId === c.user.id) throw forbidden('Die eigenen Antworten bewertet jemand anderes.');
    if (course.questions[index]?.kind !== 'text') throw badRequest('Das ist keine Freitext-Frage.');
    return tx(async (q) => {
      const p = (await q.query<{ answers: Record<string, string>; review: Record<string, boolean>; choice: number; practical: boolean }>(
        'SELECT answers, review, choice_right AS choice, practical_ok AS practical FROM course_progress WHERE course_id = $1 AND user_id = $2 FOR UPDATE', [course.id, userId],
      )).rows[0];
      if (!p || !(String(index) in p.answers)) throw notFound('Keine Antwort zu dieser Frage.');
      const r = await scoreCourse(q, course, userId, p.choice, p.answers, { ...p.review, [index]: ok }, p.practical);
      await audit(q, c.company.id, c.user.id, 'Schulungen', `${course.name}: Freitext-Antwort bewertet${r.passed ? ' – bestanden' : ''}`);
      return r;
    });
  });

  // Praxisprüfung abnehmen: Kurse bearbeiten oder eingetragener Trainer, nie bei sich selbst.
  app.post('/c/:companyId/courses/:id/practical', async (req) => {
    const c = await companyCtx(req, cfg);
    const course = await getCourse(db(), c.company.id, idParam(req));
    if (!(c.rights.areas.schulungen.level >= 2 || (course.trainerId === c.user.id && !c.rights.support))) throw forbidden();
    const { userId, ok } = parseBody(z.object({ userId: zId, ok: z.boolean() }), req.body);
    if (userId === c.user.id) throw forbidden('Die eigene Praxisprüfung nimmt jemand anderes ab.');
    await memberOf(db(), c.company.id, userId);
    return tx(async (q) => {
      await upsertProgress(q, c, course.id, userId);
      await q.query(
        `UPDATE course_progress SET practical_ok = $3, practical_by = $4, updated_at = now(),
                passed_at = CASE WHEN $3 AND coalesce(score, 0) >= $5 AND lessons_done >= $6 AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(answers) k WHERE NOT review ? k) THEN current_date WHEN NOT $3 THEN NULL ELSE passed_at END
          WHERE course_id = $1 AND user_id = $2`,
        [course.id, userId, ok, c.user.id, course.questions.length ? course.passPct : 0, course.lessons.length],
      );
      await audit(q, c.company.id, c.user.id, 'Schulungen', `${course.name}: Praxisprüfung ${ok ? 'bestanden' : 'zurückgenommen'}`);
      return { ok: true };
    });
  });

  // --- Tuning ---------------------------------------------------------------
  app.put('/c/:companyId/tuning', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('tuning', 3);
    const b = parseBody(tuningSchema, req.body);
    await db().query('UPDATE companies SET tuning = $2 WHERE id = $1', [c.company.id, JSON.stringify(b)]);
    await audit(db(), c.company.id, c.user.id, 'Tuning', 'Preisliste geändert');
    return { ok: true };
  });
  app.delete('/c/:companyId/tuning', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('tuning', 3);
    await db().query("UPDATE companies SET tuning = '{}'::jsonb WHERE id = $1", [c.company.id]);
    await audit(db(), c.company.id, c.user.id, 'Tuning', 'Preisliste auf Vorgabe zurückgesetzt');
    return { ok: true };
  });
  // Konfigurator → Tuning-Auftrag. Der Preis wird hier neu berechnet, nicht vom Browser übernommen.
  app.post('/c/:companyId/tuning/order', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('tuning', 2);
    const b = parseBody(quoteSchema, req.body);
    await sameCompany(db(), 'customers', c.company.id, b.customerId);
    await sameCompany(db(), 'vehicles', c.company.id, b.vehicleId);
    const cfgT = await loadTuning(db(), c.company.id);
    const pkg = b.packageName ? cfgT.packages.find((p) => p.name === b.packageName) : undefined;
    const customer = b.customerId ? await getRow(db(), 'customers', c.company.id, b.customerId) : null;
    const contract = b.customerId
      ? (await db().query<{ pct: number }>("SELECT max(tuning_pct)::int AS pct FROM contracts WHERE company_id = $1 AND customer_id = $2 AND status = 'aktiv' AND (valid_until IS NULL OR valid_until >= current_date)", [c.company.id, b.customerId])).rows[0]?.pct ?? 0
      : 0;
    const discount = Math.max(pkg?.discount ?? 0, customer?.discount ?? 0, contract);
    const quote = quoteTuning(cfgT, b.cls, pkg ? pkg.items : b.sel, discount);
    if (!quote.lines.length) throw badRequest('Nichts ausgewählt.');
    const note = [`Klasse ${b.cls} (×${quote.factor})`, ...quote.lines.map((l) => `${l.part}: ${l.level} ($${l.usd})`), discount ? `Rabatt ${discount} %${pkg && pkg.discount === discount ? ` (Paket ${pkg.name})` : contract === discount ? ' (Rahmenvertrag)' : ''}` : ''].filter(Boolean).join('\n');
    const row = await insertRow(db(), 'orders', c.company.id, {
      title: b.title || (pkg ? `Tuning-Paket ${pkg.name}` : `Tuning: ${quote.lines.map((l) => l.part).join(', ')}`).slice(0, 120),
      kind: 'tuning', status: 'neu', customerId: b.customerId ?? null, vehicleId: b.vehicleId ?? null, amountCents: quote.totalCents, note, createdBy: c.user.id,
    });
    await audit(db(), c.company.id, c.user.id, 'Tuning', `${orderLabel(row.number)} aus Konfigurator: ${formatUsd(quote.totalCents)}`);
    return row;
  });
  app.post('/c/:companyId/dyno', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('tuning', 2);
    const b = parseBody(dynoSchema, req.body);
    await sameCompany(db(), 'vehicles', c.company.id, b.vehicleId);
    return insertRow(db(), 'dyno', c.company.id, { ...b, createdBy: c.user.id });
  });
  app.delete('/c/:companyId/dyno/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('tuning', 3);
    if (!(await deleteRow(db(), 'dyno', c.company.id, idParam(req)))) throw notFound();
    return { ok: true };
  });

  // --- Racing ---------------------------------------------------------------
  app.post('/c/:companyId/events', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 2);
    const row = await insertRow(db(), 'events', c.company.id, parseBody(eventSchema, req.body));
    await audit(db(), c.company.id, c.user.id, 'Racing', `Event ${row.name} angelegt`);
    return row;
  });
  app.patch('/c/:companyId/events/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 2);
    const row = await updateRow(db(), 'events', c.company.id, idParam(req), parseBody(eventSchema.partial(), req.body));
    if (!row) throw notFound();
    return row;
  });
  app.delete('/c/:companyId/events/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 3);
    const row = await getRow(db(), 'events', c.company.id, idParam(req));
    if (!row) throw notFound();
    await deleteRow(db(), 'events', c.company.id, row.id);
    await audit(db(), c.company.id, c.user.id, 'Racing', `Event ${row.name} gelöscht`);
    return { ok: true };
  });
  app.post('/c/:companyId/events/:id/entries', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 2);
    const ev = await getRow(db(), 'events', c.company.id, idParam(req));
    if (!ev) throw notFound();
    const b = parseBody(entrySchema, req.body);
    await sameCompany(db(), 'customers', c.company.id, b.customerId);
    if (ev.maxEntries) {
      const n = Number((await db().query<{ n: string }>('SELECT count(*) AS n FROM race_entries WHERE event_id = $1', [ev.id])).rows[0].n);
      if (n >= ev.maxEntries) throw conflict('Alle Startplätze sind vergeben.');
    }
    return insertRow(db(), 'entries', c.company.id, { ...b, eventId: ev.id });
  });
  app.patch('/c/:companyId/entries/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 2);
    const b = parseBody(entrySchema.partial(), req.body);
    await sameCompany(db(), 'customers', c.company.id, b.customerId);
    const row = await updateRow(db(), 'entries', c.company.id, idParam(req), b);
    if (!row) throw notFound();
    return row;
  });
  app.delete('/c/:companyId/entries/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 2);
    if (!(await deleteRow(db(), 'entries', c.company.id, idParam(req)))) throw notFound();
    return { ok: true };
  });
  // Startgeld kassieren: Einnahme in der Kasse.
  app.post('/c/:companyId/entries/:id/pay', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('racing', 2);
    const id = idParam(req);
    return tx(async (q) => {
      const en = await getRow(q, 'entries', c.company.id, id);
      if (!en) throw notFound();
      if (en.paid) throw conflict('Startgeld ist schon bezahlt.');
      const ev = (await getRow(q, 'events', c.company.id, en.eventId))!;
      if (ev.feeCents > 0) await insertRow(q, 'transactions', c.company.id, { account: 'kasse', amountCents: ev.feeCents, text: `Startgeld ${ev.name} · ${en.driver}`, category: 'Racing', createdBy: c.user.id });
      await q.query('UPDATE race_entries SET paid = true WHERE id = $1', [id]);
      return getRow(q, 'entries', c.company.id, id);
    });
  });
}
