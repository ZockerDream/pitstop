// CSV-Export: Datensätze einer Firma oder des Servers. Rechteprüfung macht der Aufrufer.
import type { Queryable } from '../db/pool';

export const EXPORT_SETS: { id: string; label: string; scope: 'company' | 'server' }[] = [
  { id: 'kunden', label: 'Kunden', scope: 'company' },
  { id: 'fahrzeuge', label: 'Fahrzeuge', scope: 'company' },
  { id: 'auftraege', label: 'Aufträge', scope: 'company' },
  { id: 'einsaetze', label: 'Einsätze', scope: 'company' },
  { id: 'rechnungen', label: 'Rechnungen', scope: 'company' },
  { id: 'buchungen', label: 'Buchungen', scope: 'company' },
  { id: 'dienstzeiten', label: 'Dienstzeiten', scope: 'company' },
  { id: 'mitglieder', label: 'Mitglieder', scope: 'company' },
  { id: 'lager', label: 'Lager', scope: 'company' },
  { id: 'dienstplan', label: 'Dienstplan', scope: 'company' },
  { id: 'lohn', label: 'Lohnabrechnungen', scope: 'company' },
  { id: 'nachweise', label: 'Schulungsnachweise', scope: 'company' },
  { id: 'rennen', label: 'Rennergebnisse', scope: 'company' },
  { id: 'protokoll', label: 'Firmen-Protokoll', scope: 'company' },
  { id: 'konten', label: 'Benutzerkonten', scope: 'server' },
  { id: 'firmen', label: 'Firmen', scope: 'server' },
  { id: 'serverprotokoll', label: 'Server-Protokoll', scope: 'server' },
];

const SQL: Record<string, string> = {
  kunden: `SELECT number AS "Nr", name AS "Name", kind AS "Art", phone AS "Telefon", discount AS "Rabatt %", blocked AS "Gesperrt", note AS "Notiz", created_at AS "Angelegt" FROM customers WHERE company_id = $1 ORDER BY name`,
  fahrzeuge: `SELECT v.plate AS "Kennzeichen", v.model AS "Modell", c.name AS "Halter", v.note AS "Notiz" FROM vehicles v LEFT JOIN customers c ON c.id = v.customer_id WHERE v.company_id = $1 ORDER BY v.plate`,
  auftraege: `SELECT 'W-' || o.number AS "Nr", o.title AS "Titel", o.kind AS "Art", o.status AS "Status", c.name AS "Kunde", u.display_name AS "Zuständig", o.amount_cents / 100.0 AS "Betrag $", o.created_at AS "Angelegt" FROM orders o LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN users u ON u.id = o.assignee_id WHERE o.company_id = $1 ORDER BY o.number`,
  einsaetze: `SELECT 'E-' || e.number AS "Nr", e.location AS "Ort", e.x AS "X", e.y AS "Y", e.requester AS "Auftraggeber", e.status AS "Status", u.display_name AS "Fahrer", e.fee_cents / 100.0 AS "Gebühr $", e.created_at AS "Angelegt", e.done_at AS "Erledigt" FROM callouts e LEFT JOIN users u ON u.id = e.driver_id WHERE e.company_id = $1 ORDER BY e.number`,
  rechnungen: `SELECT 'R-' || b.number AS "Nr", b.title AS "Leistung", c.name AS "Kunde", b.amount_cents / 100.0 AS "Betrag $", b.status AS "Status", b.created_at AS "Gestellt", b.paid_at AS "Bezahlt" FROM bills b LEFT JOIN customers c ON c.id = b.customer_id WHERE b.company_id = $1 ORDER BY b.number`,
  buchungen: `SELECT booked_at AS "Datum", account AS "Konto", text AS "Text", category AS "Kategorie", amount_cents / 100.0 AS "Betrag $" FROM transactions WHERE company_id = $1 ORDER BY booked_at, created_at`,
  dienstzeiten: `SELECT u.display_name AS "Person", d.started_at AS "Beginn", d.ended_at AS "Ende", round(extract(epoch FROM (coalesce(d.ended_at, now()) - d.started_at)) / 60) AS "Minuten" FROM duty_sessions d JOIN users u ON u.id = d.user_id WHERE d.company_id = $1 ORDER BY d.started_at`,
  mitglieder: `SELECT u.display_name AS "Name", u.email AS "E-Mail", u.discord AS "Discord", m.rank AS "Rang", m.locked AS "Gesperrt", m.joined_at AS "Seit" FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.company_id = $1 ORDER BY u.display_name`,
  protokoll: `SELECT a.created_at AS "Zeit", coalesce(u.display_name, 'System') AS "Wer", a.area AS "Bereich", a.action AS "Aktion" FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.company_id = $1 ORDER BY a.created_at`,
  lager: `SELECT sku AS "Nr", name AS "Teil", qty AS "Bestand", min_qty AS "Mindestbestand", unit AS "Einheit", price_cents / 100.0 AS "Preis $", location AS "Lagerort" FROM parts WHERE company_id = $1 ORDER BY name`,
  dienstplan: `SELECT u.display_name AS "Person", s.starts_at AS "Beginn", s.ends_at AS "Ende", s.role AS "Aufgabe", s.note AS "Notiz" FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.company_id = $1 ORDER BY s.starts_at`,
  lohn: `SELECT u.display_name AS "Person", p.period_from AS "Von", p.period_to AS "Bis", round(p.minutes / 60.0, 2) AS "Stunden", p.wage_cents / 100.0 AS "Lohn $", p.commission_cents / 100.0 AS "Provision $", p.bonus_cents / 100.0 AS "Bonus $", p.total_cents / 100.0 AS "Gesamt $", p.status AS "Status", p.paid_at AS "Ausgezahlt" FROM payslips p JOIN users u ON u.id = p.user_id WHERE p.company_id = $1 ORDER BY p.period_to, u.display_name`,
  nachweise: `SELECT u.display_name AS "Person", c.name AS "Kurs", p.lessons_done AS "Lektionen", p.score AS "Test %", p.practical_ok AS "Praxis", p.passed_at AS "Bestanden", CASE WHEN p.passed_at IS NOT NULL AND c.valid_months > 0 THEN (p.passed_at + make_interval(months => c.valid_months))::date END AS "Gültig bis" FROM course_progress p JOIN courses c ON c.id = p.course_id JOIN users u ON u.id = p.user_id WHERE p.company_id = $1 ORDER BY c.name, u.display_name`,
  rennen: `SELECT e.name AS "Event", e.starts_at AS "Datum", e.track AS "Strecke", r.position AS "Platz", r.start_no AS "Nr", r.driver AS "Fahrer", r.car AS "Fahrzeug", r.lap_ms / 1000.0 AS "Beste Runde s", r.paid AS "Startgeld bezahlt" FROM race_entries r JOIN race_events e ON e.id = r.event_id WHERE r.company_id = $1 ORDER BY e.starts_at, r.position NULLS LAST`,
  konten: `SELECT display_name AS "Name", email AS "E-Mail", discord AS "Discord", is_server_admin AS "Server-Admin", active AS "Aktiv", last_login_at AS "Zuletzt", created_at AS "Angelegt" FROM users ORDER BY display_name`,
  firmen: `SELECT name AS "Firma", status AS "Status", array_to_string(modules, ', ') AS "Module", support_access AS "Support", created_at AS "Angelegt" FROM companies ORDER BY name`,
  serverprotokoll: `SELECT a.created_at AS "Zeit", coalesce(u.display_name, 'System') AS "Wer", a.area AS "Bereich", a.action AS "Aktion" FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.company_id IS NULL ORDER BY a.created_at`,
};

export async function exportRows(q: Queryable, set: string, companyId: string | null): Promise<Record<string, unknown>[]> {
  const { rows } = await q.query(SQL[set], SQL[set].includes('$1') ? [companyId] : []);
  return rows;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v);
  // Formel-Injektion in Tabellenprogrammen verhindern
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Semikolon-getrennt mit BOM, damit Excel Umlaute richtig öffnet. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '﻿';
  const head = Object.keys(rows[0]);
  return '﻿' + [head.map(cell).join(';'), ...rows.map((r) => head.map((h) => cell(r[h])).join(';'))].join('\r\n') + '\r\n';
}
