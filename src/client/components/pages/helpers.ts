// Kleine Helfer für die Seiten.
import type { CompanyData } from '../../../shared/types';

export const memberName = (d: CompanyData | null, id: string | null | undefined) => (id ? (d?.members.find((m) => m.userId === id)?.displayName ?? 'Unbekannt') : '');
export const firstName = (d: CompanyData | null, id: string | null | undefined) => memberName(d, id).split(' ')[0];
export const customerName = (d: CompanyData | null, id: string | null | undefined) => (id ? (d?.customers.find((c) => c.id === id)?.name ?? '–') : '–');
export const plateOf = (d: CompanyData | null, id: string | null | undefined) => (id ? (d?.vehicles.find((v) => v.id === id)?.plate ?? '') : '');
export const memberOptions = (d: CompanyData | null): [string, string][] => [['', '– niemand –'], ...(d?.members.filter((m) => !m.locked).map((m) => [m.userId, m.displayName] as [string, string]) ?? [])];
export const customerOptions = (d: CompanyData | null): [string, string][] => [['', '– ohne Kunde –'], ...(d?.customers.map((c) => [c.id, c.name] as [string, string]) ?? [])];
export const vehicleOptions = (d: CompanyData | null, customerId?: string | null): [string, string][] => [
  ['', '– ohne Fahrzeug –'],
  ...(d?.vehicles.filter((v) => !customerId || v.customerId === customerId).map((v) => [v.id, `${v.plate} · ${v.model}`] as [string, string]) ?? []),
];
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
