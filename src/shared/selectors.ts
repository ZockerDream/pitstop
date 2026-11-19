// Alle abgeleiteten Werte. Werden nie gespeichert, sondern immer hier berechnet.
import {
  addDays,
  addMonths,
  diffDays,
  lastMonths,
  monthKey,
  overlapWorkdays,
  rangesOverlap,
  weekStart,
  workdaysBetween,
} from './dates';
import { customerNumberLabel } from './format';
import { departmentLabel } from './labels';
import { grossFromNet, totalsFor, type Totals } from './money';
import type {
  Absence,
  AppData,
  Customer,
  Employee,
  EmployeeStatus,
  Expense,
  ExpenseCategory,
  Invoice,
  InvoiceDisplayStatus,
  Note,
  TimesheetMonth,
  Vehicle,
} from './types';

export const REMINDER_PAUSE_DAYS = 14;
export const LEAD_STALE_DAYS = 14;
/** Aufgabe „HU anbieten“ erscheint so viele Tage vor dem Termin (und bis 7 Tage danach). */
export const INSPECTION_NOTICE_DAYS = 14;

export function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]));
}

export function employeeName(e: Pick<Employee, 'firstName' | 'lastName'>): string {
  return `${e.firstName} ${e.lastName}`;
}

/** Kleinbuchstaben, Umlaute ausgeschrieben – für die Suche. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ---- Rechnungen -------------------------------------------------------------

export function invoiceTotals(inv: Pick<Invoice, 'items' | 'vatRate'>): Totals {
  return totalsFor(inv.items, inv.vatRate);
}

export function isOverdue(inv: Invoice, today: string): boolean {
  return inv.status === 'open' && inv.dueDate < today;
}

export function invoiceDisplayStatus(inv: Invoice, today: string): InvoiceDisplayStatus {
  if (inv.status === 'paid') return 'paid';
  return isOverdue(inv, today) ? 'overdue' : 'open';
}

export function daysOverdue(inv: Invoice, today: string): number {
  return Math.max(0, diffDays(inv.dueDate, today));
}

export function needsReminder(inv: Invoice, today: string): boolean {
  if (!isOverdue(inv, today) || inv.dunningLevel >= 3) return false;
  return !inv.lastRemindedAt || diffDays(inv.lastRemindedAt, today) > REMINDER_PAUSE_DAYS;
}

export function customerOpenAmount(invoices: Invoice[], customerId: string): number {
  return invoices
    .filter((i) => i.customerId === customerId && i.status === 'open')
    .reduce((sum, i) => sum + invoiceTotals(i).gross, 0);
}

export function customerRevenue(invoices: Invoice[], customerId: string): number {
  return invoices.filter((i) => i.customerId === customerId).reduce((sum, i) => sum + invoiceTotals(i).net, 0);
}

export function expenseGross(e: Expense): number {
  return grossFromNet(e.netCents, e.vatRate);
}

// ---- Fahrzeuge --------------------------------------------------------------

/** Kennzeichen für die Suche: ohne Leer- und Bindestriche, klein ("R-MA 330" → "rma330"). */
export function normalizePlate(plate: string): string {
  return normalize(plate).replace(/[\s-]/g, '');
}

export function vehicleLabel(v: Pick<Vehicle, 'make' | 'model' | 'variant'>): string {
  return [v.make, v.model, v.variant].filter(Boolean).join(' ');
}

export type InspectionState = 'overdue' | 'soon' | 'ok' | 'unknown';

export function inspectionState(v: Pick<Vehicle, 'nextInspection'>, today: string): InspectionState {
  if (!v.nextInspection) return 'unknown';
  if (v.nextInspection < today) return 'overdue';
  return diffDays(today, v.nextInspection) <= 60 ? 'soon' : 'ok';
}

// ---- Kunden -----------------------------------------------------------------

/** Datum des letzten Kontakts (jüngste Notiz, die kein Systemeintrag ist). */
export function lastContactDate(notes: Note[], customerId: string): string | null {
  let latest: string | null = null;
  for (const n of notes) {
    if (n.customerId !== customerId || n.kind === 'system') continue;
    if (!latest || n.createdAt > latest) latest = n.createdAt;
  }
  return latest ? latest.slice(0, 10) : null;
}

export function isStaleLead(c: Customer, notes: Note[], today: string): boolean {
  if (c.status !== 'lead') return false;
  const last = lastContactDate(notes, c.id) ?? c.createdAt;
  return diffDays(last, today) > LEAD_STALE_DAYS;
}

// ---- Personal ---------------------------------------------------------------

export function absenceWorkdays(a: Pick<Absence, 'fromDate' | 'toDate'>): number {
  return workdaysBetween(a.fromDate, a.toDate);
}

export function employeeStatusToday(absences: Absence[], employeeId: string, today: string): EmployeeStatus {
  let vacation = false;
  for (const a of absences) {
    if (a.employeeId !== employeeId || a.status !== 'approved') continue;
    if (a.fromDate > today || a.toDate < today) continue;
    if (a.kind === 'sick') return 'sick';
    vacation = true;
  }
  return vacation ? 'vacation' : 'on_duty';
}

export interface VacationBalance {
  entitlement: number;
  carryOver: number;
  taken: number;
  planned: number;
  requested: number;
  remaining: number;
}

export function vacationBalance(employee: Employee, absences: Absence[], year: number, today: string): VacationBalance {
  const yFrom = `${year}-01-01`;
  const yTo = `${year}-12-31`;
  const tomorrow = addDays(today, 1);
  let taken = 0;
  let planned = 0;
  let requested = 0;
  for (const a of absences) {
    if (a.employeeId !== employee.id || a.kind !== 'vacation') continue;
    if (a.status === 'approved') {
      if (a.fromDate <= today) taken += overlapWorkdays(a.fromDate, a.toDate < today ? a.toDate : today, yFrom, yTo);
      if (a.toDate >= tomorrow) planned += overlapWorkdays(a.fromDate > tomorrow ? a.fromDate : tomorrow, a.toDate, yFrom, yTo);
    } else if (a.status === 'requested') {
      requested += overlapWorkdays(a.fromDate, a.toDate, yFrom, yTo);
    }
  }
  const entitlement = employee.vacationDaysPerYear ?? 0;
  const carryOver = employee.carryOverDays ?? 0;
  return { entitlement, carryOver, taken, planned, requested, remaining: entitlement + carryOver - taken - planned };
}

export function overtimeBalance(timesheets: TimesheetMonth[], employeeId: string): number {
  const sum = timesheets
    .filter((t) => t.employeeId === employeeId)
    .reduce((acc, t) => acc + (t.workedHours - t.targetHours), 0);
  return Math.round(sum * 10) / 10;
}

export function timesheetFor(timesheets: TimesheetMonth[], employeeId: string, month: string): TimesheetMonth | undefined {
  return timesheets.find((t) => t.employeeId === employeeId && t.month === month);
}

/** Vorschlag für das Monats-Soll: Wochenstunden × Arbeitstage / 5, auf halbe Stunden gerundet. */
export function defaultTargetHours(weeklyHours: number, month: string): number {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const days = workdaysBetween(`${month}-01`, `${month}-${String(last).padStart(2, '0')}`);
  return Math.round(((weeklyHours * days) / 5) * 2) / 2;
}

/** Abwesenheiten (genehmigt), die den Zeitraum berühren. */
export function absencesInRange(absences: Absence[], from: string, to: string): Absence[] {
  return absences
    .filter((a) => a.status === 'approved' && rangesOverlap(a.fromDate, a.toDate, from, to))
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
}

export function currentWeek(today: string): { from: string; to: string } {
  const from = weekStart(today);
  return { from, to: addDays(from, 6) };
}

// ---- Dashboard --------------------------------------------------------------

export interface DashboardKpis {
  openGross: number;
  overdueGross: number;
  monthRevenue: number;
  prevMonthRevenue: number;
  revenueChangePct: number | null;
  activeCustomers: number;
  leads: number;
  presentToday: number;
  totalEmployees: number;
  onVacation: number;
  sick: number;
}

export function dashboardKpis(data: AppData, today: string): DashboardKpis {
  let openGross = 0;
  let overdueGross = 0;
  let monthRevenue = 0;
  let prevMonthRevenue = 0;
  const month = monthKey(today);
  const prevCutoff = addMonths(today, -1);
  const prevMonth = monthKey(prevCutoff);
  for (const inv of data.invoices) {
    const t = invoiceTotals(inv);
    if (inv.status === 'open') {
      openGross += t.gross;
      if (inv.dueDate < today) overdueGross += t.gross;
    }
    if (monthKey(inv.issueDate) === month) monthRevenue += t.net;
    if (monthKey(inv.issueDate) === prevMonth && inv.issueDate <= prevCutoff) prevMonthRevenue += t.net;
  }
  const activeEmployees = data.employees.filter((e) => e.active);
  let onVacation = 0;
  let sick = 0;
  for (const e of activeEmployees) {
    const s = employeeStatusToday(data.absences, e.id, today);
    if (s === 'vacation') onVacation++;
    if (s === 'sick') sick++;
  }
  return {
    openGross,
    overdueGross,
    monthRevenue,
    prevMonthRevenue,
    revenueChangePct: prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : null,
    activeCustomers: data.customers.filter((c) => c.status === 'active').length,
    leads: data.customers.filter((c) => c.status === 'lead').length,
    presentToday: activeEmployees.length - onVacation - sick,
    totalEmployees: activeEmployees.length,
    onVacation,
    sick,
  };
}

export interface MonthPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export function revenueVsExpenses(invoices: Invoice[], expenses: Expense[], today: string, months = 6): MonthPoint[] {
  const keys = lastMonths(today, months);
  const map = new Map(keys.map((k) => [k, { month: k, revenue: 0, expenses: 0 }]));
  for (const inv of invoices) {
    const p = map.get(monthKey(inv.issueDate));
    if (p) p.revenue += invoiceTotals(inv).net;
  }
  for (const e of expenses) {
    const p = map.get(monthKey(e.date));
    if (p) p.expenses += e.netCents;
  }
  return keys.map((k) => map.get(k)!);
}

export function expensesByCategory(expenses: Expense[], from: string, to: string): { category: ExpenseCategory; net: number }[] {
  const sums = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    if (e.date < from || e.date > to) continue;
    sums.set(e.category, (sums.get(e.category) ?? 0) + e.netCents);
  }
  return [...sums.entries()].map(([category, net]) => ({ category, net })).sort((a, b) => b.net - a.net);
}

// ---- Aufgaben & Freigaben ---------------------------------------------------

export type DerivedTaskKind = 'approve' | 'remind' | 'inspection' | 'lead' | 'decided' | 'manual';

export interface DerivedTask {
  key: string;
  kind: DerivedTaskKind;
  refId: string;
  title: string;
  detail: string;
}

export function derivedTasks(data: AppData, today: string): DerivedTask[] {
  const isAdmin = data.me.role === 'admin';
  const employees = byId(data.employees);
  const customers = byId(data.customers);
  const tasks: DerivedTask[] = [];

  if (isAdmin) {
    const requested = data.absences
      .filter((a) => a.kind === 'vacation' && a.status === 'requested')
      .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
    for (const a of requested) {
      const e = employees.get(a.employeeId);
      const days = absenceWorkdays(a);
      tasks.push({
        key: `approve:${a.id}`,
        kind: 'approve',
        refId: a.id,
        title: `Urlaubsantrag von ${e ? employeeName(e) : 'Unbekannt'} genehmigen`,
        detail: `${shortRange(a.fromDate, a.toDate)}, ${days} ${days === 1 ? 'Arbeitstag' : 'Arbeitstage'}${a.comment ? ` · „${a.comment}“` : ''}`,
      });
    }

    const overdue = data.invoices.filter((i) => needsReminder(i, today)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const inv of overdue) {
      const c = customers.get(inv.customerId);
      const gross = invoiceTotals(inv).gross;
      tasks.push({
        key: `remind:${inv.id}`,
        kind: 'remind',
        refId: inv.id,
        title: `Überfällige Rechnung #${inv.number} mahnen`,
        detail: `${c?.name ?? 'Unbekannter Kunde'} · ${formatEuroPlain(gross)} · ${daysOverdue(inv, today)} Tage überfällig${inv.dunningLevel > 0 ? ` · bisher M${inv.dunningLevel}` : ''}`,
      });
    }
  }

  const vehiclesDue = data.vehicles
    .filter((v) => {
      if (!v.nextInspection) return false;
      const c = customers.get(v.customerId);
      if (!c || c.status !== 'active') return false;
      if (!isAdmin && (data.me.employeeId === null || c.ownerEmployeeId !== data.me.employeeId)) return false;
      const d = diffDays(today, v.nextInspection);
      return d <= INSPECTION_NOTICE_DAYS && d >= -7;
    })
    .sort((a, b) => a.nextInspection!.localeCompare(b.nextInspection!));
  for (const v of vehiclesDue) {
    const c = customers.get(v.customerId)!;
    const d = diffDays(today, v.nextInspection!);
    tasks.push({
      key: `inspection:${v.id}`,
      kind: 'inspection',
      refId: c.id,
      title: `HU für ${v.plate} anbieten`,
      detail: `${vehicleLabel(v)} · ${c.name} · ${d < 0 ? `seit ${-d} Tagen fällig` : d === 0 ? 'heute fällig' : `fällig in ${d} Tagen`}`,
    });
  }

  const leads = data.customers.filter(
    (c) => isStaleLead(c, data.notes, today) && (isAdmin || (data.me.employeeId !== null && c.ownerEmployeeId === data.me.employeeId)),
  );
  for (const c of leads) {
    const last = lastContactDate(data.notes, c.id);
    tasks.push({
      key: `lead:${c.id}`,
      kind: 'lead',
      refId: c.id,
      title: `Lead ${c.name} nachfassen`,
      detail: last ? `Letzter Kontakt vor ${diffDays(last, today)} Tagen` : 'Noch kein Kontakt erfasst',
    });
  }

  if (data.me.employeeId) {
    const decided = data.absences.filter(
      (a) => a.employeeId === data.me.employeeId && a.kind === 'vacation' && a.status !== 'requested' && !a.seenByRequester,
    );
    for (const a of decided) {
      tasks.push({
        key: `decided:${a.id}`,
        kind: 'decided',
        refId: a.id,
        title: `Dein Urlaubsantrag (${shortRange(a.fromDate, a.toDate)}) wurde ${a.status === 'approved' ? 'genehmigt' : 'abgelehnt'}`,
        detail: a.decisionNote ? `Begründung: ${a.decisionNote}` : a.decidedByName ? `Entschieden von ${a.decidedByName}` : '',
      });
    }
  }

  if (isAdmin) {
    const manual = data.tasks
      .filter((t) => !t.done)
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
    for (const t of manual) {
      tasks.push({
        key: `manual:${t.id}`,
        kind: 'manual',
        refId: t.id,
        title: t.title,
        detail: t.dueDate ? (t.dueDate < today ? `Fällig seit ${diffDays(t.dueDate, today)} Tagen` : `Fällig ${t.dueDate === today ? 'heute' : `in ${diffDays(today, t.dueDate)} Tagen`}`) : '',
      });
    }
  }

  return tasks;
}

function shortRange(from: string, to: string): string {
  const f = `${from.slice(8, 10)}.${from.slice(5, 7)}.`;
  const t = `${to.slice(8, 10)}.${to.slice(5, 7)}.`;
  return from === to ? f : `${f}–${t}`;
}

function formatEuroPlain(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

// ---- Suche ------------------------------------------------------------------

export interface SearchHit {
  type: 'customer' | 'invoice' | 'employee' | 'vehicle';
  id: string;
  title: string;
  subtitle: string;
}

export function search(data: AppData, query: string, includeInvoices: boolean, limit = 5): SearchHit[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const hits: SearchHit[] = [];
  const contactsByCustomer = new Map<string, string[]>();
  for (const c of data.contacts) {
    const list = contactsByCustomer.get(c.customerId) ?? [];
    list.push(c.name);
    contactsByCustomer.set(c.customerId, list);
  }

  const customerMap = byId(data.customers);
  const qPlate = q.replace(/[\s-]/g, '');
  const vehicles = data.vehicles
    .filter((v) => (qPlate.length >= 2 && normalizePlate(v.plate).includes(qPlate)) || normalize(`${vehicleLabel(v)} ${v.vin}`).includes(q))
    .slice(0, limit);
  for (const v of vehicles) {
    hits.push({ type: 'vehicle', id: v.customerId, title: `${v.plate} · ${vehicleLabel(v)}`, subtitle: customerMap.get(v.customerId)?.name ?? '' });
  }

  const customers = data.customers
    .filter((c) => {
      const hay = normalize([c.name, customerNumberLabel(c.number), c.city, c.zip, ...(contactsByCustomer.get(c.id) ?? [])].join(' '));
      return hay.includes(q);
    })
    .slice(0, limit);
  for (const c of customers) {
    hits.push({ type: 'customer', id: c.id, title: c.name, subtitle: `${customerNumberLabel(c.number)} · ${c.zip} ${c.city}` });
  }

  if (includeInvoices) {
    const invoices = data.invoices
      .filter((i) => {
        const name = customerMap.get(i.customerId)?.name ?? '';
        return normalize(`#${i.number} ${i.number} ${name}`).includes(q);
      })
      .sort((a, b) => b.number - a.number)
      .slice(0, limit);
    for (const i of invoices) {
      hits.push({
        type: 'invoice',
        id: i.id,
        title: `Rechnung #${i.number}`,
        subtitle: `${customerMap.get(i.customerId)?.name ?? ''} · ${formatEuroPlain(invoiceTotals(i).gross)}`,
      });
    }
  }

  const employees = data.employees
    .filter((e) => normalize(`${employeeName(e)} ${e.jobTitle} ${departmentLabel[e.department]}`).includes(q))
    .slice(0, limit);
  for (const e of employees) {
    hits.push({ type: 'employee', id: e.id, title: employeeName(e), subtitle: `${e.jobTitle} · ${departmentLabel[e.department]}` });
  }
  return hits;
}
