// Demo-Firma „Demo Motorsport“ für DEMO_MODE=true. Feste Personen, damit man jede Rolle mit einem Klick ausprobieren kann.
import type { PoolClient } from 'pg';
import { hashPassword } from '../auth/password';
import { createCompany } from '../repo/companies';
import { insertRow } from '../repo/records';
import { insertUser } from '../repo/users';
import { seedMore } from './more';
import { seedModules } from './modules';

export const DEMO_PERSONAS = [
  { key: 'inhaber', name: 'Vince Moretti', email: 'inhaber@demo.pitstop', rank: 'Inhaber', group: null },
  { key: 'leitung', name: 'Dana Brooks', email: 'leitung@demo.pitstop', rank: 'Werkstattleitung', group: 'Leitung' },
  { key: 'mechanik', name: 'Jamal Carter', email: 'mechanik@demo.pitstop', rank: 'Mechaniker', group: 'Mechanik' },
  { key: 'abschlepp', name: 'Rosa Diaz', email: 'abschlepp@demo.pitstop', rank: 'Abschleppfahrerin', group: 'Abschleppdienst' },
  { key: 'buero', name: 'Ellen Park', email: 'buero@demo.pitstop', rank: 'Büro & Finanzen', group: 'Büro & Finanzen' },
] as const;
export type DemoPersona = (typeof DEMO_PERSONAS)[number]['key'];

const CUSTOMERS: [string, 'privat' | 'firma' | 'fraktion' | 'racing', string][] = [
  ['LSPD Fuhrpark', 'fraktion', '911-0001'], ['EMS Los Santos', 'fraktion', '911-0002'], ['Downtown Cab Co.', 'firma', '555-0190'],
  ['Lamar Davis', 'privat', '555-0144'], ['Gerald Simmons', 'privat', '555-0161'], ['Tessa Nguyen', 'racing', '555-0177'],
  ['Weazel News', 'firma', '555-0102'], ['Marco Rossi', 'privat', '555-0133'], ['Vinewood Racing Club', 'racing', '555-0188'],
  ['Hannah Kraus', 'privat', '555-0122'],
];
const VEHICLES: [number, string, string][] = [
  [0, 'LSPD 12', 'Vapid Stanier'], [0, 'LSPD 31', 'Vapid Scout'], [1, 'EMS 04', 'Brute Ambulance'], [2, 'CAB 22', 'Vapid Taxi'],
  [3, 'LD 404', 'Karin Kuruma'], [4, 'GS 777', 'Ubermacht Oracle'], [5, 'TN 23', 'Pfister Comet'], [6, 'WZL 1', 'Vapid Speedo'],
  [7, 'MR 88', 'Grotti Turismo'], [8, 'VRC 7', 'Annis Elegy RH8'], [9, 'HK 15', 'Dinka Blista'],
];

export async function seedDemo(q: PoolClient): Promise<void> {
  const pw = await hashPassword('demo-passwort-nicht-benutzen');
  const ids: Record<string, string> = {};
  for (const p of DEMO_PERSONAS) {
    ids[p.key] = (await insertUser(q, { email: p.email, displayName: p.name, passwordHash: pw, mustChangePassword: false, isDemo: true })).id;
  }
  const cid = await createCompany(q, 'Demo Motorsport', 'DM', ids.inhaber);
  const groups = (await q.query<{ id: string; name: string }>('SELECT id, name FROM groups WHERE company_id = $1', [cid])).rows;
  for (const p of DEMO_PERSONAS) {
    if (p.key === 'inhaber') continue;
    await q.query('INSERT INTO memberships (company_id, user_id, rank) VALUES ($1, $2, $3)', [cid, ids[p.key], p.rank]);
    const g = groups.find((x) => x.name === p.group);
    if (g) await q.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [g.id, ids[p.key]]);
  }
  // Jamal fährt auch Abschlepp
  await q.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groups.find((g) => g.name === 'Abschleppdienst')!.id, ids.mechanik]);

  const cust: string[] = [];
  for (const [name, kind, phone] of CUSTOMERS) cust.push((await insertRow(q, 'customers', cid, { name, kind, phone, discount: kind === 'fraktion' ? 15 : 0 })).id);
  const veh: string[] = [];
  for (const [ci, plate, model] of VEHICLES) veh.push((await insertRow(q, 'vehicles', cid, { customerId: cust[ci], plate, model })).id);

  const orders: [string, string, string, number, number, string, number, boolean][] = [
    ['Inspektion und Ölwechsel', 'werkstatt', 'neu', 0, 0, 'leitung', 450, false],
    ['Bremsen vorne neu', 'werkstatt', 'arbeit', 1, 1, 'mechanik', 1200, true],
    ['Motor-Tuning Stufe 3', 'tuning', 'arbeit', 6, 6, 'mechanik', 18500, false],
    ['Folierung Mattschwarz', 'karosserie', 'wartet', 5, 5, 'leitung', 4200, false],
    ['Unfallschaden Front', 'karosserie', 'arbeit', 3, 3, 'mechanik', 3600, true],
    ['Rennsetup Vinewood Sprint', 'racing', 'fertig', 8, 9, 'mechanik', 2500, false],
    ['Klimaanlage prüfen', 'werkstatt', 'fertig', 2, 3, 'leitung', 300, false],
    ['Reifenwechsel', 'werkstatt', 'abgeholt', 9, 10, 'mechanik', 600, false],
  ];
  for (const [title, kind, status, ci, vi, who, usd, prio] of orders) {
    await insertRow(q, 'orders', cid, {
      title, kind, status, customerId: cust[ci], vehicleId: veh[vi], assigneeId: ids[who], amountCents: usd * 100, priority: prio,
      progress: status === 'arbeit' ? 40 : status === 'fertig' || status === 'abgeholt' ? 100 : 0, createdBy: ids.leitung,
    });
  }
  const callouts: [string, number, number, string, string, string | null, number][] = [
    ['Sandy Shores Airfield', 1720, 3250, 'EMS Los Santos', 'offen', null, 900],
    ['Legion Square, Parkhaus', 195, -934, 'LSPD', 'offen', null, 350],
    ['Route 68, Höhe Harmony', 520, 2690, 'Lamar Davis', 'unterwegs', 'abschlepp', 650],
    ['Del Perro Pier', -1600, -1060, 'Downtown Cab Co.', 'vorort', 'mechanik', 350],
    ['Mirror Park', 1100, -500, 'EMS Los Santos', 'erledigt', 'abschlepp', 350],
  ];
  for (const [location, x, y, requester, status, driver, usd] of callouts) {
    await insertRow(q, 'callouts', cid, { location, x, y, requester, status, driverId: driver ? ids[driver] : null, truck: driver ? 'Abschlepper 1' : '', feeCents: usd * 100, createdBy: ids.leitung });
  }
  await q.query("UPDATE callouts SET done_at = now() - interval '70 minutes' WHERE company_id = $1 AND status = 'erledigt'", [cid]);

  const bills: [number, string, number, string][] = [
    [0, 'Wartungsvertrag Fuhrpark November', 1500, 'bezahlt'], [2, 'Klimaanlage CAB 22', 300, 'bezahlt'], [9, 'Reifenwechsel HK 15', 600, 'bezahlt'],
    [4, 'Diagnose Oracle', 250, 'offen'], [8, 'Rennsetup Elegy', 2500, 'offen'], [1, 'Abschleppen Mirror Park', 350, 'offen'],
  ];
  for (const [ci, title, usd, status] of bills) {
    const b = await insertRow(q, 'bills', cid, { customerId: cust[ci], title, amountCents: usd * 100, createdBy: ids.buero });
    if (status === 'bezahlt') {
      await q.query("UPDATE bills SET status = 'bezahlt', paid_at = now() - interval '1 day' WHERE id = $1", [b.id]);
      await insertRow(q, 'transactions', cid, { account: 'kasse', amountCents: usd * 100, text: `R-${b.number} ${title}`, category: 'Einnahme', billId: b.id, createdBy: ids.buero });
    }
  }
  const tx: [string, number, string, string, number][] = [
    ['firma', 80000, 'Startkapital', 'Einlage', 30], ['firma', -3500, 'Miete Halle', 'Miete', 20], ['firma', -2400, 'Teile Großhandel', 'Material', 12],
    ['firma', -1800, 'Werkzeug', 'Werkzeug', 9], ['kasse', 1200, 'Barverkauf Öl', 'Einnahme', 5], ['firma', -650, 'Strom und Wasser', 'Nebenkosten', 3],
  ];
  for (const [account, usd, text, category, daysAgo] of tx) {
    await q.query(
      `INSERT INTO transactions (company_id, account, amount_cents, text, category, booked_at, created_by) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - $6::int, $7)`,
      [cid, account, usd * 100, text, category, daysAgo, ids.buero],
    );
  }
  for (const [who, h, len] of [['mechanik', 30, 300], ['leitung', 28, 360], ['abschlepp', 26, 240], ['mechanik', 6, 280], ['abschlepp', 5, 200]] as const) {
    await q.query(
      `INSERT INTO duty_sessions (company_id, user_id, started_at, ended_at) VALUES ($1, $2, now() - make_interval(hours => $3), now() - make_interval(hours => $3) + make_interval(mins => $4))`,
      [cid, ids[who], h, len],
    );
  }
  await q.query('INSERT INTO duty_sessions (company_id, user_id, started_at) VALUES ($1, $2, now() - interval \'95 minutes\'), ($1, $3, now() - interval \'40 minutes\')', [cid, ids.mechanik, ids.abschlepp]);
  await seedModules(q, cid, ids, Object.fromEntries(groups.map((g) => [g.name, g.id])), cust, veh);
  await seedMore(q, cid, ids, Object.fromEntries(groups.map((g) => [g.name, g.id])), cust, veh);
  await q.query("INSERT INTO announcements (title, body, tone) VALUES ('Willkommen bei Pitstop', 'Das ist der Demo-Modus. Alle Daten sind erfunden und lassen sich im Benutzermenü zurücksetzen.', 'info')");
}

export async function wipeAll(q: PoolClient): Promise<void> {
  await q.query('TRUNCATE race_entries, race_events, dyno_runs, course_progress, courses, payslips, shifts, parts, announcements, audit_log, duty_sessions, transactions, bills, callouts, orders, vehicles, customers, permission_exceptions, group_members, groups, memberships, companies, sessions, users CASCADE');
}
