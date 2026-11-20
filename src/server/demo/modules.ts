// Demo-Daten für die Module ab 0.3 (Lager, Dienstplan, Lohn, Schulungen, Tuning, Racing).
import type { PoolClient } from 'pg';
import { insertRow } from '../repo/records';

export const DEMO_PARTS: [string, string, number, number, string, number, string][] = [
  ['OEL-530', 'Motoröl 5W-30', 34, 20, 'l', 15, 'A1'], ['TRB-01', 'Turbolader Sport', 2, 2, 'Stk', 4200, 'Schrank 1'], ['BRK-S', 'Bremsscheiben Sport (Satz)', 5, 3, 'Satz', 650, 'B2'],
  ['FOL-MS', 'Folie Mattschwarz', 0, 2, 'Rolle', 380, 'Lackraum'], ['BAT-70', 'Batterie 70 Ah', 6, 4, 'Stk', 180, 'A3'], ['RF-SP', 'Sportreifen 19"', 12, 8, 'Stk', 240, 'Reifenlager'],
  ['NEON-B', 'Neon-Kit Blau', 3, 1, 'Kit', 900, 'Schrank 2'], ['ABS-SEIL', 'Abschleppseil', 4, 2, 'Stk', 60, 'Halle 2'],
];

export const DEMO_COURSES = [
  {
    name: 'Firmenregeln & Kundenumgang', category: 'Allgemein', passPct: 70, validMonths: 0, practical: false, groups: ['alle'],
    lessons: [['Unsere Regeln', 'Pünktlich, freundlich, ehrlich. Preise nur laut Preisliste.'], ['Umgang mit Kunden', 'Erst zuhören, dann erklären. Nichts versprechen, was die Werkstatt nicht halten kann.'], ['Was tun bei Ärger', 'Ruhig bleiben, Leitung holen, nichts eskalieren.']],
    questions: [['Ein Kunde ist laut und beleidigend. Was tust du?', ['Zurückschreien', 'Ruhig bleiben, Leitung holen', 'Auftrag abbrechen und gehen'], 1], ['Wer darf Rabatt über 10 % geben?', ['Jeder', 'Nur mit Freigabe der Leitung', 'Niemand'], 1]],
  },
  {
    name: 'Abschleppschein', category: 'Abschleppdienst', passPct: 80, validMonths: 12, practical: true, groups: ['Abschleppdienst'],
    lessons: [['Sicherheit am Einsatzort', 'Warnblinker, Absicherung, Warnweste.'], ['Fahrzeug richtig aufladen', 'Gurte über Kreuz, Räder sichern.'], ['Funk und Leitstelle', 'Bei Ankunft und Abfahrt melden.'], ['Abrechnung', 'Gebühren laut Preisliste, Rechnung direkt vor Ort.']],
    questions: [['Was machst du zuerst am Unfallort?', ['Fahrzeug sofort aufladen', 'Warnblinker und Absicherung', 'Rechnung schreiben'], 1], ['Wann meldest du dich bei der Leitstelle?', ['Bei Ankunft und Abfahrt', 'Nur wenn es Probleme gibt', 'Gar nicht'], 0], ['Was kostet Abschleppen in der Stadt?', ['$150', '$350', '$900'], 1]],
  },
  {
    name: 'Tuning I', category: 'Tuning', passPct: 70, validMonths: 0, practical: false, groups: ['Mechanik'],
    lessons: [['Motor und Leistung', 'Stufen 1–4, was sie bringen und kosten.'], ['Fahrwerk', 'Tiefer ist nicht immer schneller.'], ['Prüfstand bedienen', 'Vorher und nachher messen, Werte eintragen.']],
    questions: [['Wann misst du auf dem Prüfstand?', ['Nur nachher', 'Vorher und nachher', 'Gar nicht'], 1], ['Was multipliziert den Tuning-Preis?', ['Die Fahrzeugklasse', 'Die Uhrzeit', 'Der Kundenname'], 0]],
  },
] as const;

/** Legt die Moduldaten für eine Firma an. ids: Rollen-Schlüssel → Benutzer-ID. */
export async function seedModules(q: PoolClient, cid: string, ids: Record<string, string>, groupIds: Record<string, string>, customers: string[], vehicles: string[]): Promise<void> {
  for (const [sku, name, qty, minQty, unit, usd, location] of DEMO_PARTS) await insertRow(q, 'parts', cid, { sku, name, qty, minQty, unit, priceCents: usd * 100, location });

  // Dienstplan: diese und nächste Woche, Abendschichten
  const people = Object.values(ids);
  for (let day = 0; day < 10; day++) {
    for (let i = 0; i < people.length; i++) {
      if ((day + i) % 3 === 0) continue;
      const start = 16 + ((day + i) % 2) * 2;
      await q.query(
        `INSERT INTO shifts (company_id, user_id, starts_at, ends_at, role, created_by)
         VALUES ($1, $2, date_trunc('day', now()) + make_interval(days => $3, hours => $4), date_trunc('day', now()) + make_interval(days => $3, hours => $4 + 5), $5, $2)`,
        [cid, people[i], day - 1, start, i % 2 ? 'Werkstatt' : 'Abschlepp'],
      );
    }
  }

  // Lohn: Stundenlohn und Provision
  const wages: [string, number, number][] = [['leitung', 120, 5], ['mechanik', 90, 10], ['abschlepp', 80, 15], ['buero', 85, 0]];
  for (const [k, usd, pct] of wages) if (ids[k]) await q.query('UPDATE memberships SET wage_cents = $3, commission_pct = $4 WHERE company_id = $1 AND user_id = $2', [cid, ids[k], usd * 100, pct]);

  // Schulungen
  const courseIds: string[] = [];
  for (const c of DEMO_COURSES) {
    const req = c.groups.map((g) => (g === 'alle' ? 'alle' : groupIds[g])).filter(Boolean);
    const r = await q.query<{ id: string }>(
      `INSERT INTO courses (company_id, name, category, lessons, questions, pass_pct, valid_months, practical, required_groups, trainer_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [cid, c.name, c.category, JSON.stringify(c.lessons.map(([title, text]) => ({ title, text }))), JSON.stringify(c.questions.map(([qq, options, correct]) => ({ q: qq, options, correct }))),
        c.passPct, c.validMonths, c.practical, JSON.stringify(req), ids.leitung ?? null],
    );
    courseIds.push(r.rows[0].id);
  }
  const prog: [number, string, number, number | null, boolean, number | null][] = [
    [0, 'mechanik', 3, 100, false, -40], [0, 'abschlepp', 3, 80, false, -60], [1, 'abschlepp', 4, 93, true, -350], [2, 'mechanik', 1, null, false, null],
  ];
  for (const [ci, who, done, score, prac, passedDaysAgo] of prog) {
    if (!ids[who]) continue;
    await q.query(
      `INSERT INTO course_progress (company_id, course_id, user_id, lessons_done, score, practical_ok, passed_at) VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::int IS NULL THEN NULL ELSE current_date + $7::int END)`,
      [cid, courseIds[ci], ids[who], done, score, prac, passedDaysAgo],
    );
  }

  // Tuning: Prüfstand
  const runs: [number, string, number, number][] = [[4, 'Serie', 268, 310], [4, 'Stufe 2 + Turbo', 362, 455], [6, 'Serie', 340, 390], [6, 'Stufe 3', 448, 520]];
  for (const [vi, label, hp, torque] of runs) if (vehicles[vi]) await insertRow(q, 'dyno', cid, { vehicleId: vehicles[vi], label, hp, torque, createdBy: ids.mechanik ?? null });

  // Racing
  const events: [string, string, number, string, number, number, number, number, string][] = [
    ['Vinewood Sprint', 'rennen', 3, 'Stadtkurs Vinewood', 3, 2500, 20000, 20, 'offen'],
    ['Sandy Shores Endurance', 'teamstart', 10, 'Wüstenkurs', 0, 4000, 15000, 0, 'offen'],
    ['Trackday Port of LS', 'trackday', 14, 'Hafenkurs', 0, 1800, 0, 12, 'planung'],
    ['Herbstpokal', 'rennen', -12, 'Stadtkurs Vinewood', 3, 2000, 10000, 16, 'fertig'],
  ];
  const ev: string[] = [];
  for (const [name, kind, inDays, track, laps, fee, prize, max, status] of events) {
    const r = await q.query<{ id: string }>(
      `INSERT INTO race_events (company_id, name, kind, starts_at, track, laps, fee_cents, prize_cents, max_entries, status) VALUES ($1, $2, $3, date_trunc('day', now()) + make_interval(days => $4, hours => 20), $5, $6, $7, $8, $9, $10) RETURNING id`,
      [cid, name, kind, inDays, track, laps, fee * 100, prize * 100, max, status],
    );
    ev.push(r.rows[0].id);
  }
  const entries: [number, string, string, string, boolean, number | null, number | null, number | null][] = [
    [3, 'Tessa Nguyen', 'Pfister Comet', '23', false, 131470, 1, 5], [3, 'Lamar Davis', 'Karin Kuruma', '4', false, 134620, 2, 3], [3, 'Franklin Clinton', 'Bravado Banshee', '11', false, 133050, 3, null],
    [0, 'Tessa Nguyen', 'Pfister Comet', '23', false, null, null, 5], [0, 'Vinewood Racing Club', 'Annis Elegy RH8', '7', true, null, null, 8], [0, 'Marco Rossi', 'Grotti Turismo', '88', false, null, null, 7],
  ];
  for (const [ei, driver, car, startNo, team, lapMs, position, ci] of entries) {
    await insertRow(q, 'entries', cid, { eventId: ev[ei], driver, car, startNo, team, lapMs, position, customerId: ci === null ? null : (customers[ci] ?? null), paid: ei === 3 });
  }
}
