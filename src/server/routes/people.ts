import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { can } from '../../shared/permissions';
import { formatRange } from '../../shared/format';
import { isValidISODate, workdaysBetween } from '../../shared/dates';
import { CONTRACT_TYPES, DEPARTMENTS } from '../../shared/types';
import { requirePermission, requireUser } from '../auth/guards';
import { db } from '../db/pool';
import { badRequest, conflict, forbidden, notFound, parseBody, zDate, zId, zOptionalDate, zOptionalEmail, zRequired, zText } from '../errors';
import { decideAbsence, deleteRequestedAbsence, findOverlapping, getAbsence, insertAbsence, markAbsenceSeen } from '../repo/absences';
import { getEmployee, insertEmployee, updateEmployee, upsertTimesheet } from '../repo/employees';
import { insertTask, toggleTask } from '../repo/tasks';
import { idParam, type RouteOptions } from './util';

const employeeFields = {
  firstName: zRequired(100),
  lastName: zRequired(100),
  jobTitle: zText(150).default(''),
  department: z.enum(DEPARTMENTS, { message: 'Bitte Abteilung wählen' }),
  email: zOptionalEmail.default(''),
  phone: zText(50).default(''),
  hourlyRateCents: z.number({ message: 'Betrag fehlt' }).int().min(0).max(100_000, 'Stundensatz zu hoch'),
  contractType: z.enum(CONTRACT_TYPES, { message: 'Bitte Vertragsart wählen' }),
  weeklyHours: z.number({ message: 'Zahl erwartet' }).min(0, 'Mindestens 0').max(60, 'Höchstens 60 Stunden'),
  entryDate: zDate,
  probationEndDate: zOptionalDate.default(null),
  fixedTermEndDate: zOptionalDate.default(null),
  managerId: zId.nullable().default(null),
  vacationDaysPerYear: z.number({ message: 'Zahl erwartet' }).min(0).max(60, 'Höchstens 60 Tage'),
  carryOverDays: z.number({ message: 'Zahl erwartet' }).min(0).max(60, 'Höchstens 60 Tage'),
  active: z.boolean().default(true),
};
const employeeSchema = z.object(employeeFields);
const employeePatchSchema = z.object(employeeFields).partial();
const timesheetSchema = z.object({
  targetHours: z.number({ message: 'Zahl erwartet' }).min(0).max(400, 'Höchstens 400 Stunden'),
  workedHours: z.number({ message: 'Zahl erwartet' }).min(0).max(400, 'Höchstens 400 Stunden'),
});

const absenceSchema = z.object({
  employeeId: zId.optional(),
  kind: z.enum(['vacation', 'sick']).default('vacation'),
  fromDate: zDate,
  toDate: zDate,
  comment: zText(300).default(''),
  approveDirectly: z.boolean().optional(),
});
const decideSchema = z.object({
  status: z.enum(['approved', 'rejected'], { message: 'Genehmigen oder Ablehnen' }),
  decisionNote: zText(300).default(''),
});
const taskSchema = z.object({ title: zRequired(200), dueDate: zOptionalDate.default(null) });

export async function peopleRoutes(app: FastifyInstance, _opts: RouteOptions): Promise<void> {
  // ---- Mitarbeitende
  app.post('/employees', async (req) => {
    requirePermission(req, 'employee:edit');
    const input = parseBody(employeeSchema, req.body);
    if (input.managerId && !(await getEmployee(db(), input.managerId))) throw badRequest('Bitte die markierten Angaben prüfen.', { managerId: 'Unbekannt' });
    return { employee: await insertEmployee(db(), input) };
  });

  app.patch('/employees/:id', async (req) => {
    requirePermission(req, 'employee:edit');
    const id = idParam(req);
    const patch = parseBody(employeePatchSchema, req.body);
    if (patch.managerId === id) throw badRequest('Bitte die markierten Angaben prüfen.', { managerId: 'Niemand ist sein eigener Vorgesetzter' });
    const employee = await updateEmployee(db(), id, patch);
    if (!employee) throw notFound('Mitarbeiter nicht gefunden.');
    return { employee };
  });

  app.put('/employees/:id/timesheets/:month', async (req) => {
    requirePermission(req, 'employee:edit');
    const id = idParam(req);
    const month = (req.params as { month: string }).month;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw notFound();
    const input = parseBody(timesheetSchema, req.body);
    if (!(await getEmployee(db(), id))) throw notFound('Mitarbeiter nicht gefunden.');
    return { timesheet: await upsertTimesheet(db(), { employeeId: id, month, ...input }) };
  });

  // ---- Abwesenheiten
  app.post('/absences', async (req) => {
    const user = requireUser(req);
    const input = parseBody(absenceSchema, req.body);
    const employeeId = input.employeeId ?? user.employeeId;
    if (!employeeId) throw badRequest('Dein Benutzer ist keinem Mitarbeiter zugeordnet.');
    if (employeeId !== user.employeeId && !can(user.role, 'absence:createForOthers')) throw forbidden();
    if (input.kind === 'sick' && !can(user.role, 'absence:reportSick')) throw forbidden();
    if (!isValidISODate(input.fromDate)) throw badRequest('Bitte die markierten Angaben prüfen.', { fromDate: 'Ungültiges Datum' });
    if (!isValidISODate(input.toDate)) throw badRequest('Bitte die markierten Angaben prüfen.', { toDate: 'Ungültiges Datum' });
    if (input.toDate < input.fromDate) throw badRequest('Bitte die markierten Angaben prüfen.', { toDate: 'Darf nicht vor dem Beginn liegen' });
    if (input.kind === 'vacation' && workdaysBetween(input.fromDate, input.toDate) < 1) {
      throw badRequest('Bitte die markierten Angaben prüfen.', { toDate: 'Der Zeitraum enthält keinen Arbeitstag' });
    }
    const employee = await getEmployee(db(), employeeId);
    if (!employee || !employee.active) throw notFound('Mitarbeiter nicht gefunden.');
    const overlap = await findOverlapping(db(), employeeId, input.kind, input.fromDate, input.toDate);
    if (overlap.length > 0) {
      throw conflict(`Überschneidet sich mit einem bestehenden Eintrag (${formatRange(overlap[0].fromDate, overlap[0].toDate)}).`);
    }
    const decideNow = input.kind === 'sick' || (input.approveDirectly === true && can(user.role, 'absence:decide'));
    const absence = await insertAbsence(db(), {
      employeeId,
      kind: input.kind,
      fromDate: input.fromDate,
      toDate: input.toDate,
      status: decideNow ? 'approved' : 'requested',
      comment: input.comment,
      decided: decideNow,
      decidedByUserId: decideNow ? user.id : null,
      decidedByName: decideNow ? user.displayName : '',
      seenByRequester: decideNow,
      createdByUserId: user.id,
    });
    return { absence };
  });

  app.post('/absences/:id/decide', async (req) => {
    const user = requirePermission(req, 'absence:decide');
    const id = idParam(req);
    const input = parseBody(decideSchema, req.body);
    const existing = await getAbsence(db(), id);
    if (!existing) throw notFound('Antrag nicht gefunden.');
    if (existing.status !== 'requested') throw conflict('Über diesen Antrag wurde bereits entschieden.');
    const absence = await decideAbsence(db(), id, {
      status: input.status,
      decisionNote: input.decisionNote,
      userId: user.id,
      userName: user.displayName,
      seenByRequester: existing.employeeId === user.employeeId,
    });
    if (!absence) throw conflict('Über diesen Antrag wurde bereits entschieden.');
    return { absence };
  });

  app.delete('/absences/:id', async (req) => {
    const user = requireUser(req);
    const id = idParam(req);
    const existing = await getAbsence(db(), id);
    if (!existing) throw notFound('Antrag nicht gefunden.');
    if (existing.employeeId !== user.employeeId && !can(user.role, 'absence:decide')) throw forbidden();
    if (existing.status !== 'requested' || !(await deleteRequestedAbsence(db(), id))) {
      throw conflict('Nur offene Anträge können zurückgezogen werden.');
    }
    return { id };
  });

  app.post('/absences/:id/seen', async (req) => {
    const user = requireUser(req);
    const id = idParam(req);
    const existing = await getAbsence(db(), id);
    if (!existing) throw notFound('Antrag nicht gefunden.');
    if (existing.employeeId !== user.employeeId) throw forbidden();
    return { absence: await markAbsenceSeen(db(), id) };
  });

  // ---- Manuelle Aufgaben
  app.post('/tasks', async (req) => {
    requirePermission(req, 'task:manage');
    const input = parseBody(taskSchema, req.body);
    return { task: await insertTask(db(), input) };
  });

  app.post('/tasks/:id/toggle', async (req) => {
    requirePermission(req, 'task:manage');
    const task = await toggleTask(db(), idParam(req));
    if (!task) throw notFound('Aufgabe nicht gefunden.');
    return { task };
  });
}
