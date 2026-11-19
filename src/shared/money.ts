// Geld immer als Ganzzahl in Cent. MwSt wird auf die Netto-Summe gerechnet, nicht je Zeile.

export interface LineLike {
  quantity: number;
  unitPriceCents: number;
}

export interface Totals {
  net: number;
  vat: number;
  gross: number;
}

export function lineTotal(item: LineLike): number {
  return Math.round(item.quantity * item.unitPriceCents);
}

export function totalsFor(items: LineLike[], vatRate: number): Totals {
  const net = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const vat = Math.round((net * vatRate) / 100);
  return { net, vat, gross: net + vat };
}

export function grossFromNet(netCents: number, vatRate: number): number {
  return netCents + Math.round((netCents * vatRate) / 100);
}

/** "1.234,56" / "1234,5" / "12" → Cent; leer oder ungültig → null. */
export function parseEuroInput(input: string): number | null {
  const s = input.replace(/\s|€/g, '');
  if (!s) return null;
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(s)) return null;
  const [intPart, decPart = ''] = s.replace(/\./g, '').split(',');
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
  return Number.isFinite(cents) ? cents : null;
}

/** "2,5" → 2.5; leer oder ungültig → null. Höchstens zwei Nachkommastellen. */
export function parseDecimalInput(input: string): number | null {
  const s = input.trim().replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 6800 → "68,00" (für Eingabefelder). */
export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

export function decimalToInput(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false });
}
