// Kalenderdaten als 'YYYY-MM-DD'-Strings. Nie `new Date('YYYY-MM-DD')` verwenden (UTC!),
// sondern parseDate/toISODate. Vergleiche direkt als String (lexikografisch korrekt).

let todayOverride: string | null = null;

/** Nur für Tests/Demos: „heute“ festlegen (Client: Query-Parameter ?heute=JJJJ-MM-TT). */
export function setTodayOverride(iso: string | null): void {
  todayOverride = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/** Die einzige Stelle, die das aktuelle Datum liest. */
export function today(): string {
  return todayOverride ?? toISODate(new Date());
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return toISODate(d) === s;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseDate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
}

/** b − a in Tagen. */
export function diffDays(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return toISODate(new Date(y, m, 0));
}

export function addMonthKey(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toISODate(d).slice(0, 7);
}

/** Die letzten n Monate inklusive des Monats von `iso`, älteste zuerst. */
export function lastMonths(iso: string, n: number): string[] {
  const current = monthKey(iso);
  return Array.from({ length: n }, (_, i) => addMonthKey(current, i - (n - 1)));
}

export function isWeekend(iso: string): boolean {
  const day = parseDate(iso).getDay();
  return day === 0 || day === 6;
}

/** Arbeitstage (Mo–Fr) zwischen from und to, beide inklusive. */
export function workdaysBetween(from: string, to: string): number {
  if (to < from) return 0;
  let count = 0;
  let cur = from;
  while (cur <= to) {
    if (!isWeekend(cur)) count++;
    cur = addDays(cur, 1);
  }
  return count;
}

/** Schnittmenge zweier Zeiträume in Arbeitstagen. */
export function overlapWorkdays(aFrom: string, aTo: string, bFrom: string, bTo: string): number {
  const from = aFrom > bFrom ? aFrom : bFrom;
  const to = aTo < bTo ? aTo : bTo;
  return workdaysBetween(from, to);
}

export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

/** Montag der Woche von iso. */
export function weekStart(iso: string): string {
  const d = parseDate(iso);
  const day = (d.getDay() + 6) % 7; // Mo = 0
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}
