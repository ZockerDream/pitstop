// Anzeigeformate (deutsch, Spielwährung $ ohne Steuern).

const usd = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? '−' : '';
  return `${sign}$${usd.format(Math.abs(cents) / 100)}`;
}

/** „1.250“, „1.250,50“, „$900“ → Cent; null bei ungültiger Eingabe. */
export function parseUsd(input: string): number | null {
  const s = input.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 2 });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function formatDateTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** Dauer in Minuten als „2:05 h“. */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
}

export function formatAgo(isoTimestamp: string, now = Date.now()): string {
  const min = Math.round((now - new Date(isoTimestamp).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const orderLabel = (n: number) => `W-${n}`;
export const calloutLabel = (n: number) => `E-${n}`;
export const billLabel = (n: number) => `R-${n}`;
export const customerLabel = (n: number) => `K-${n}`;
