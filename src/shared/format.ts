import { diffDays, parseDate } from './dates';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const euroRounded = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const monthShortFmt = new Intl.DateTimeFormat('de-DE', { month: 'short' });
const monthLongFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

export function formatEuroRounded(cents: number): string {
  return euroRounded.format(cents / 100);
}

export function formatNumber(n: number): string {
  return number.format(n);
}

export function formatHours(n: number): string {
  return `${number.format(n)} Std.`;
}

export function formatSignedHours(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '±';
  return `${sign}${number.format(Math.abs(n))} Std.`;
}

export function formatDays(n: number): string {
  return `${number.format(n)} ${n === 1 ? 'Tag' : 'Tage'}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  return dateFmt.format(parseDate(iso));
}

export function formatDateShort(iso: string): string {
  return dateShortFmt.format(parseDate(iso));
}

export function formatDateTime(isoTimestamp: string): string {
  return dateTimeFmt.format(new Date(isoTimestamp));
}

export function formatRange(from: string, to: string): string {
  if (from === to) return formatDate(from);
  if (from.slice(0, 4) === to.slice(0, 4)) return `${formatDateShort(from)}–${formatDate(to)}`;
  return `${formatDate(from)}–${formatDate(to)}`;
}

export function formatMonthShort(month: string): string {
  return monthShortFmt.format(parseDate(`${month}-01`)).replace('.', '');
}

export function formatMonthLong(month: string): string {
  return monthLongFmt.format(parseDate(`${month}-01`));
}

/** „heute“, „gestern“, „vor 3 Tagen“, „in 5 Tagen“, ab 60 Tagen das Datum. */
export function formatRelative(iso: string, todayIso: string): string {
  const d = diffDays(todayIso, iso.slice(0, 10));
  if (d === 0) return 'heute';
  if (d === -1) return 'gestern';
  if (d === 1) return 'morgen';
  if (Math.abs(d) >= 60) return formatDate(iso.slice(0, 10));
  return d < 0 ? `vor ${-d} Tagen` : `in ${d} Tagen`;
}

export function formatPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${number.format(n)} %`;
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s-]/gu, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function customerNumberLabel(n: number): string {
  return `KD-${n}`;
}
