// Demo-Daten ab 0.4: Hallenplan, Werkzeug, Lager-Bestellungen, Fuhrpark, Rennteam, Setups, Runden, Trackdays, Verträge,
// Nachrichten, Ränge, Bewerbungen, Abwesenheiten, Schulungstermine, Lizenzen, Kasse, Ziele, Preisliste, Regelwerk, Pinnwand.
import type { PoolClient } from 'pg';
import type { CompanyExtra } from '../../shared/types';
import { insertRow } from '../repo/records';

const at = (days: number, hour: number, min = 0) => { const d = new Date(); d.setHours(hour, min, 0, 0); d.setDate(d.getDate() + days); return d.toISOString(); };
const day = (days: number) => at(days, 12).slice(0, 10);

export const DEMO_EXTRA: CompanyExtra = {
  payDays: 3,
  footer: 'Danke für deinen Besuch!',
  locations: [{ name: 'Halle Strawberry', note: '6 Plätze · Hauptsitz' }, { name: 'Renngarage Vinewood', note: 'Box 4 · nur Racing' }],
  templates: ['Dein Fahrzeug ist fertig und kann abgeholt werden.', 'Die Teile sind bestellt, wir melden uns.', 'Der Abschlepper ist unterwegs.', 'Deine Rechnung ist noch offen.'],
  trackdayPackages: [
    { name: 'Bronze', priceCents: 180000, items: ['Fahrzeug-Check vor dem Event', 'Reifendruck und Betankung'] },
    { name: 'Silber', priceCents: 350000, items: ['Alles aus Bronze', 'Transport im Renntransporter', 'Boxencrew am Renntag'] },
    { name: 'Gold', priceCents: 650000, items: ['Alles aus Silber', 'Setup auf dem Prüfstand', 'Rundenzeit-Analyse', 'Ersatzreifen-Satz'] },
  ],
  publicData: false,
};

export async function seedMore(q: PoolClient, cid: string, ids: Record<string, string>, groupIds: Record<string, string>, cust: string[], veh: string[]): Promise<void> {
  const by = (sql: string, ...p: unknown[]) => q.query<{ id: string }>(sql, [cid, ...p]).then((r) => r.rows[0]?.id ?? null);
  await q.query('UPDATE companies SET extra = $2 WHERE id = $1', [cid, JSON.stringify(DEMO_EXTRA)]);

  // Hallenplan: Plätze und heutige Buchungen zu Aufträgen
  const bays: string[] = [];
  for (const [i, [name, kind]] of ([['Hebebühne 1', 'hebebuehne'], ['Hebebühne 2', 'hebebuehne'], ['Hebebühne 3', 'hebebuehne'], ['Lackierkabine', 'lack'], ['Prüfstand', 'pruefstand'], ['Waschplatz', 'wasch']] as const).entries()) {
    bays.push((await insertRow(q, 'bays', cid, { name, kind, position: i + 1 })).id);
  }
  const order = (title: string) => by('SELECT id FROM orders WHERE company_id = $1 AND title = $2', title);
  const bookings: [number, string | null, string, number, number, number, number][] = [
    [0, 'Motor-Tuning Stufe 3', 'Motor-Tuning TN 23', 0, 16, 0, 22],
    [1, 'Bremsen vorne neu', 'Bremsen LSPD 31', 0, 17, 0, 20],
    [1, null, 'Reifen CAB 22', 0, 21, 0, 23],
    [2, 'Unfallschaden Front', 'Unfall LD 404', 0, 18, 0, 22],
    [3, 'Folierung Mattschwarz', 'Folie GS 777 (wartet auf Teile)', 0, 16, 0, 24],
    [4, null, 'Messung TN 23', 0, 22, 0, 23],
    [5, null, 'Aufbereitung MR 88', 0, 19, 0, 20],
    [0, 'Inspektion und Ölwechsel', 'Inspektion LSPD 12', 1, 17, 0, 19],
  ];
  for (const [b, o, title, d, h0, , h1] of bookings) {
    await insertRow(q, 'bookings', cid, { bayId: bays[b], orderId: o ? await order(o) : null, title, startsAt: at(d, h0), endsAt: at(d, Math.min(h1, 23), h1 === 24 ? 59 : 0), createdBy: ids.leitung });
  }

  // Werkzeug
  const tools: [string, string, string, 'frei' | 'ausgegeben' | 'wartung', string | null, number | null, string][] = [
    ['Diagnosegerät OBD', 'Prüfung 03/2027', 'Schrank 1', 'ausgegeben', 'mechanik', 300, ''],
    ['Schlagschrauber Akku 2', 'Akku 80 %', 'Wand Halle 1', 'ausgegeben', 'leitung', 120, ''],
    ['Lackierpistole HVLP', 'Düse 1,3 mm', 'Lackraum', 'frei', null, null, ''],
    ['Motorkran', 'Tragkraft 1 t', 'Halle 2', 'wartung', null, 2880, 'Hydraulik undicht, Ersatzteil bestellt'],
    ['Drehmomentschlüssel 40–200 Nm', 'kalibriert 10/2026', 'Schrank 1', 'frei', null, null, ''],
    ['Abschlepp-Kit (Gurte, Ketten)', 'im Abschlepper 1', 'Abschlepper 1', 'ausgegeben', 'abschlepp', 95, ''],
  ];
  for (const [name, info, location, status, who, minAgo, note] of tools) {
    await q.query(
      `INSERT INTO tools (company_id, name, info, location, status, holder_id, since, check_due, note) VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::int IS NULL THEN NULL ELSE now() - make_interval(mins => $7::int) END, $8, $9)`,
      [cid, name, info, location, status, who ? ids[who] : null, minAgo, name.startsWith('Abschlepp') ? day(5) : name.startsWith('Diagnose') ? day(130) : null, note],
    );
  }

  // Lager: Verbrauch der letzten Wochen und offene Bestellungen
  const part = (sku: string) => by('SELECT id FROM parts WHERE company_id = $1 AND sku = $2', sku);
  for (const [sku, delta, daysAgo, note] of [['OEL-530', -12, 3, 'W-Inspektionen'], ['OEL-530', -9, 11, 'Ölwechsel'], ['BRK-S', -2, 6, 'Bremsen LSPD'], ['TRB-01', -1, 9, 'Tuning TN 23'], ['RF-SP', -8, 14, 'Reifenwechsel'], ['FOL-MS', -3, 4, 'Folierung GS 777'], ['BAT-70', -2, 20, 'Batterien']] as const) {
    const pid = await part(sku);
    if (pid) await q.query("INSERT INTO part_moves (company_id, part_id, delta, note, created_by, created_at) VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6))", [cid, pid, delta, note, ids.mechanik, daysAgo]);
  }
  for (const [sku, qty, supplier, usd, inDays] of [['FOL-MS', 4, 'Großhandel LS', 1520, 2], ['TRB-01', 2, 'Tuningteile Vinewood', 8400, 4]] as const) {
    const pid = await part(sku);
    if (pid) await insertRow(q, 'partOrders', cid, { partId: pid, qty, supplier, costCents: usd * 100, expected: day(inDays), createdBy: ids.leitung });
  }

  // Fuhrpark mit Fahrtenbuch
  const fleet: [string, string, string, number, number, 'frei' | 'einsatz' | 'werkstatt', string | null, number | null, string][] = [
    ['Abschlepper 1', 'MTL Flatbed', 'DM T1', 48210, 62, 'einsatz', 'abschlepp', 21, ''],
    ['Abschlepper 2', 'Vapid Towtruck', 'DM T2', 91340, 85, 'frei', null, 3, ''],
    ['Servicewagen', 'Vapid Speedo', 'DM S1', 30480, 40, 'werkstatt', null, null, 'Steinschlag Frontscheibe'],
    ['Renntransporter', 'MTL Packer', 'DM R1', 12900, 100, 'frei', null, 60, ''],
  ];
  for (const [name, model, plate, km, fuel, status, who, svc, note] of fleet) {
    const f = await insertRow(q, 'fleet', cid, { name, model, plate, km, fuel, serviceDue: svc === null ? null : day(svc), note });
    await q.query('UPDATE fleet SET status = $2, driver_id = $3 WHERE id = $1', [f.id, status, who ? ids[who] : null]);
    await q.query("INSERT INTO fleet_log (company_id, fleet_id, user_id, action, km, fuel, cost_cents, note, created_at) VALUES ($1, $2, $3, 'tanken', $4, 100, 12000, '', now() - interval '3 days')", [cid, f.id, ids.abschlepp, km - 220]);
    if (status === 'einsatz') await q.query("INSERT INTO fleet_log (company_id, fleet_id, user_id, action, km, note, created_at) VALUES ($1, $2, $3, 'ausgabe', $4, '', now() - interval '40 minutes')", [cid, f.id, ids.leitung, km]);
    if (status === 'werkstatt') await q.query("INSERT INTO fleet_log (company_id, fleet_id, user_id, action, note, created_at) VALUES ($1, $2, $3, 'schaden', $4, now() - interval '1 day')", [cid, f.id, ids.mechanik, note]);
  }

  // Racing: Rennwagen, Meisterschaft, Setups, Runden, Trackday-Buchungen
  const car7 = (await insertRow(q, 'raceCars', cid, { number: '7', car: 'Annis Elegy RH8', driverId: ids.mechanik, status: 'bereit', km: 842, wear: { Motor: 34, Bremsen: 45, Reifen: 20, Getriebe: 28 }, budgetCents: 2200000 })).id;
  const car23 = (await insertRow(q, 'raceCars', cid, { number: '23', car: 'Pfister Comet S2 GT', driverId: ids.leitung, status: 'wartung', km: 1630, wear: { Motor: 71, Bremsen: 90, Reifen: 66, Getriebe: 40 }, budgetCents: 1200000, note: 'Bremsen vor dem Vinewood Sprint tauschen.' })).id;
  await q.query("UPDATE race_entries SET car_id = $2, team = true WHERE company_id = $1 AND start_no = '7'", [cid, car7]);
  const year = new Date().getFullYear();
  for (const [team, points, own] of [['Vapid Racing', 162, false], ['Demo Motorsport', 148, true], ['Pegasus Team', 131, false], ['Grove St. Customs', 97, false]] as const) {
    await insertRow(q, 'championship', cid, { season: year, team, points, own });
  }
  const setup = { 'Höhe v/h': '−35 / −30 mm', 'Federn v/h': '9 / 8', 'Stabi v/h': '6 / 4', Bremsbalance: '58 % vorn', Reifendruck: '2,0 / 1,9 bar', Übersetzung: 'kurz', Abtrieb: '7 / 10', Sperre: '45 %' };
  await q.query('INSERT INTO setups (company_id, car_id, track, vals, note) VALUES ($1, $2, $3, $4, $5), ($1, $6, $3, $7, $8)', [
    cid, car7, 'Stadtkurs Vinewood', JSON.stringify(setup), 'Untersteuert in der Haarnadel. Stabi vorn eins weicher getestet: −0,3 s in S2.',
    car23, JSON.stringify({ ...setup, 'Höhe v/h': '−30 / −30 mm', Bremsbalance: '56 % vorn', Abtrieb: '6 / 10' }), 'Stabil, aber im letzten Sektor langsamer. Mehr Abtrieb hinten probieren.',
  ]);
  const laps: [string, string, number, number, number, string, number][] = [
    [car7, 'Jamal Carter', 41120, 46900, 43020, 'Training', 2], [car7, 'Jamal Carter', 41040, 47220, 43210, 'Training', 2], [car7, 'Jamal Carter', 40980, 46580, 42830, 'Quali', 1],
    [car23, 'Dana Brooks', 41510, 47400, 43900, 'Training', 2], [car23, 'Dana Brooks', 41390, 47120, 43620, 'Training', 1],
  ];
  for (const [carId, driver, s1, s2, s3, session, daysAgo] of laps) {
    await q.query("INSERT INTO laps (company_id, car_id, driver, track, s1, s2, s3, session, created_at) VALUES ($1, $2, $3, 'Stadtkurs Vinewood', $4, $5, $6, $7, now() - make_interval(days => $8))", [cid, carId, driver, s1, s2, s3, session, daysAgo]);
  }
  const td = await by("SELECT id FROM race_events WHERE company_id = $1 AND kind = 'trackday'");
  for (const [ci, vi, pkg, transport, status] of [[5, 6, 'Gold', true, 'bestaetigt'], [3, 4, 'Silber', true, 'bestaetigt'], [8, 9, 'Gold', true, 'angefragt'], [7, 8, 'Bronze', false, 'bestaetigt']] as const) {
    const price = DEMO_EXTRA.trackdayPackages!.find((p) => p.name === pkg)!.priceCents;
    await insertRow(q, 'trackdays', cid, { eventId: td, customerId: cust[ci], vehicleId: veh[vi], package: pkg, priceCents: price, transport, status });
  }

  // Kunden: Rahmenverträge und Nachrichten
  await insertRow(q, 'contracts', cid, { customerId: cust[0], title: 'Wartung Streifenwagen', workshopPct: 20, tuningPct: 10, rules: 'Vorrang bei Einsätzen, keine Optik-Änderungen an Dienstwagen', billing: '$1.500 Wartungspauschale im Monat', validUntil: day(130), status: 'aktiv' });
  await insertRow(q, 'contracts', cid, { customerId: cust[1], title: 'Einsatzfahrzeuge', workshopPct: 15, tuningPct: 15, rules: 'Einsatzfahrzeuge innerhalb von 2 Stunden', billing: 'nach Aufwand', validUntil: day(220), status: 'aktiv' });
  await insertRow(q, 'contracts', cid, { customerId: cust[2], title: 'Taxiflotte', workshopPct: 10, tuningPct: 0, rules: 'Sammelrechnung monatlich', billing: 'Zahlungsziel 14 Tage', validUntil: day(-2), status: 'pruefen' });
  const msgs: [number, 'in' | 'out', string, number, boolean][] = [
    [3, 'in', 'Hey, wann ist mein Kuruma fertig? Brauch ihn heute Nacht noch.', 50, true], [3, 'out', 'Frontschaden ist fast durch, gleich noch Lack. Danach ist er abholbereit.', 45, true],
    [3, 'in', 'Perfekt. Kann ich bar zahlen?', 12, false], [0, 'in', 'Bitte LSPD 31 bis Donnerstag fertig, der Wagen wird gebraucht.', 180, true],
    [0, 'out', 'Steht heute ab 17 Uhr auf Hebebühne 2, Donnerstag passt.', 170, true], [5, 'in', 'Startgeld für den Vinewood Sprint ist raus 👍', 25, false],
  ];
  for (const [ci, dir, text, minAgo, read] of msgs) {
    await q.query('INSERT INTO messages (company_id, customer_id, dir, text, user_id, read, created_at) VALUES ($1, $2, $3, $4, $5, $6, now() - make_interval(mins => $7))', [cid, cust[ci], dir, text, ids.leitung, read, minAgo]);
  }

  // Personal: Ränge, Bewerbungen, Abwesenheiten, Nachtrag
  const g = (n: string) => groupIds[n];
  const ranks: [string, number, number, number, string[]][] = [
    ['Werkstattleitung', 120, 5, 0, ['Leitung']], ['Mechaniker', 90, 10, 0, ['Mechanik']], ['Abschleppfahrerin', 80, 15, 0, ['Abschleppdienst']],
    ['Büro & Finanzen', 85, 0, 0, ['Büro & Finanzen']], ['Azubi', 45, 2, 0, ['Mechanik']],
  ];
  for (const [i, [name, usd, pct, fix, groups]] of ranks.entries()) await insertRow(q, 'ranks', cid, { name, position: i + 1, wageCents: usd * 100, commissionPct: pct, fixedCents: fix * 100, groups: groups.map(g).filter(Boolean) });
  await q.query("INSERT INTO ranks (company_id, name, position, fixed_cents) VALUES ($1, 'Inhaber', 0, 400000)", [cid]);
  for (const [name, role, contact, text, rating, status, interview] of [
    ['Franklin Clinton', 'Mechaniker', 'franklin@example.ls', 'Erfahrung bei einer Werkstatt in Strawberry. Kann schweißen, will Tuning lernen.', 4, 'gespraech', at(1, 19)],
    ['Kevin Park', 'Abschleppfahrer', 'Discord: kpark', 'Hat Führerschein Klasse C, noch keinen Abschleppschein.', 3, 'neu', null],
    ['Ashley Brooks', 'Büro', '555-0199', 'Hat eine andere Stelle angenommen.', 2, 'abgesagt', null],
  ] as const) {
    await insertRow(q, 'applications', cid, { name, role, contact, text, rating, status, interviewAt: interview });
  }
  await insertRow(q, 'absences', cid, { userId: ids.buero, dateFrom: day(3), dateTo: day(6), kind: 'urlaub', status: 'genehmigt', decidedBy: ids.inhaber, note: '' });
  await insertRow(q, 'absences', cid, { userId: ids.abschlepp, dateFrom: day(2), dateTo: day(2), kind: 'schule', status: 'beantragt', note: 'Prüfung Abschleppschein' });
  await insertRow(q, 'corrections', cid, { userId: ids.abschlepp, startedAt: at(-3, 19), endedAt: at(-3, 23, 30), reason: 'Einsatz Paleto Bay, Stempeln vergessen', status: 'beantragt' });

  // Schulungen: Kurs mit Freitext, offene Antwort, Termine, Lizenzen
  const kc = await q.query<{ id: string }>(
    `INSERT INTO courses (company_id, name, category, lessons, questions, pass_pct, trainer_id, required_groups) VALUES ($1, 'Kundenkommunikation', 'Allgemein', $2, $3, 50, $4, '[]') RETURNING id`,
    [cid, JSON.stringify([{ title: 'Am Telefon', text: 'Name der Firma nennen, zuhören, Rückruf zusagen und einhalten.' }]),
      JSON.stringify([{ q: 'Wie meldest du dich am Telefon?', kind: 'choice', options: ['Hallo?', 'Mit Firmenname und eigenem Namen'], correct: 1 }, { q: 'Ein Kunde beschwert sich über den Preis. Was sagst du?', kind: 'text', options: [], correct: -1 }]), ids.leitung],
  );
  await q.query(`INSERT INTO course_progress (company_id, course_id, user_id, lessons_done, score, choice_right, answers) VALUES ($1, $2, $3, 1, 50, 1, $4)`, [
    cid, kc.rows[0].id, ids.mechanik, JSON.stringify({ 1: 'Ich erkläre, was im Preis steckt, und zeige die Preisliste. Rabatt nur mit Freigabe der Leitung.' }),
  ]);
  const course = (n: string) => by('SELECT id FROM courses WHERE company_id = $1 AND name = $2', n);
  await insertRow(q, 'sessions', cid, { courseId: await course('Abschleppschein'), startsAt: at(2, 19), kind: 'praxis', trainerId: ids.leitung, participants: [ids.abschlepp] });
  await insertRow(q, 'sessions', cid, { courseId: await course('Tuning I'), startsAt: at(6, 19), kind: 'einfuehrung', trainerId: ids.leitung, participants: [ids.mechanik] });
  await insertRow(q, 'licenses', cid, { name: 'Gewerbelizenz', validUntil: day(260) });
  await insertRow(q, 'licenses', cid, { name: 'Abschlepplizenz (Firma)', validUntil: day(75) });
  await insertRow(q, 'licenses', cid, { name: 'Rennlizenz', holderId: ids.mechanik, validUntil: day(8), note: 'verlängern vor dem Vinewood Sprint' });

  // Finanzen: Trinkgeld, Rennteam-Budget, Kassenabschluss, Daueraufträge, Ziele
  for (const [account, usd, text, cat, daysAgo] of [
    ['trinkgeld', 180, 'Trinkgeld Lamar Davis', 'Trinkgeld', 2], ['trinkgeld', 240, 'Trinkgeld LSPD', 'Trinkgeld', 1], ['trinkgeld', 200, 'Trinkgeld Tessa Nguyen', 'Trinkgeld', 0],
    ['firma', -20000, 'Saisonbudget Rennteam', 'Umbuchung', 25], ['rennteam', 20000, 'Saisonbudget Rennteam', 'Umbuchung', 25], ['rennteam', -4500, 'Rennreifen Slick', 'Racing', 9], ['rennteam', 3000, 'Preisgeld Herbstpokal', 'Racing', 12],
  ] as const) {
    await q.query('INSERT INTO transactions (company_id, account, amount_cents, text, category, booked_at, created_by) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - $6::int, $7)', [cid, account, usd * 100, text, cat, daysAgo, ids.buero]);
  }
  const kasse = Number((await q.query<{ s: string }>("SELECT coalesce(sum(amount_cents), 0) AS s FROM transactions WHERE company_id = $1 AND account = 'kasse'", [cid])).rows[0].s);
  await q.query("INSERT INTO cash_closings (company_id, expected_cents, counted_cents, created_by, created_at) VALUES ($1, $2, $2, $3, now() - interval '1 day')", [cid, kasse, ids.buero]);
  for (const [text, usd, account, every, inDays] of [['Miete Halle Strawberry', -3500, 'firma', 'monat', 5], ['Strom und Wasser', -420, 'firma', 'monat', 5], ['Wartungsvertrag LSPD', 1500, 'firma', 'monat', 11], ['Versicherung Fuhrpark', -2400, 'firma', 'jahr', 40]] as const) {
    await insertRow(q, 'standing', cid, { text, amountCents: usd * 100, account, every, nextDate: day(inDays), category: usd < 0 ? 'Fixkosten' : 'Einnahme' });
  }
  await insertRow(q, 'goals', cid, { name: 'Zweite Lackierkabine', targetCents: 9000000, account: 'firma', deadline: day(90) });
  await insertRow(q, 'goals', cid, { name: 'Rennteam Saison', targetCents: 2500000, account: 'rennteam' });

  // Preisliste mit Nachweisen
  const tow = await course('Abschleppschein');
  const tun = await course('Tuning I');
  for (const [name, area, usd, courseId] of [
    ['Inspektion', 'Werkstatt', 450, null], ['Ölwechsel inkl. Filter', 'Werkstatt', 180, null], ['Bremsen vorn erneuern', 'Werkstatt', 650, null], ['Unfallinstandsetzung je Bauteil', 'Karosserie', 420, null],
    ['Abschleppen Stadt', 'Abschlepp', 350, tow], ['Abschleppen Land', 'Abschlepp', 900, tow], ['Pannenhilfe vor Ort', 'Abschlepp', 250, null],
    ['Motor-Tuning Stufe 1', 'Tuning', 1800, tun], ['Prüfstand-Messung', 'Tuning', 250, null], ['Vollfolierung', 'Karosserie', 4800, null],
  ] as const) {
    await insertRow(q, 'services', cid, { name, area, priceCents: usd * 100, courseId });
  }

  // Regelwerk und Pinnwand
  const r1 = await q.query<{ id: string }>("INSERT INTO rule_docs (company_id, title, body, version) VALUES ($1, 'Dienstverordnung', $2, 3) RETURNING id", [cid, 'Vor Dienstbeginn stempeln, Arbeitskleidung tragen.\nAufträge nur über Pitstop annehmen.\nVor „Fertig“ eine Probefahrt machen.']);
  await q.query("INSERT INTO rule_docs (company_id, title, body) VALUES ($1, 'Preis- und Rabattrichtlinie', 'Festpreise laut Preisliste je Fahrzeugklasse. Rabatte über 10 % nur mit Freigabe der Leitung. Rahmenverträge gelten automatisch.')", [cid]);
  for (const k of ['leitung', 'buero']) await q.query('INSERT INTO rule_acks (doc_id, user_id, version) VALUES ($1, $2, 3)', [r1.rows[0].id, ids[k]]);
  const p1 = await q.query<{ id: string }>("INSERT INTO posts (company_id, author_id, title, body, pinned, created_at) VALUES ($1, $2, 'Neue Öffnungszeiten ab Dezember', 'Ab 1. Dezember öffnen wir täglich 15–24 Uhr. Bitte tragt euch im Dienstplan ein. Der Renntransporter bleibt sonntags für das Team reserviert.', true, now() - interval '2 hours') RETURNING id", [cid, ids.inhaber]);
  await q.query("INSERT INTO posts (company_id, author_id, title, body, created_at) VALUES ($1, $2, 'Lager aufgeräumt', 'Turbolader und Steuergeräte liegen jetzt im abgeschlossenen Schrank 1. Schlüssel bei mir.', now() - interval '1 day')", [cid, ids.leitung]);
  const poll = await q.query<{ id: string }>("INSERT INTO posts (company_id, author_id, title, poll, created_at) VALUES ($1, $2, 'Wohin geht die Weihnachtsfeier?', $3, now() - interval '5 hours') RETURNING id", [
    cid, ids.inhaber, JSON.stringify({ question: 'Wohin geht die Weihnachtsfeier?', options: ['Bahama Mamas', 'Grillabend am Strand', 'Kartbahn + Diner'], endsAt: at(4, 23) }),
  ]);
  for (const [k, opt] of [['leitung', 1], ['buero', 2], ['abschlepp', 1]] as const) { await q.query('INSERT INTO poll_votes (post_id, user_id, option) VALUES ($1, $2, $3)', [poll.rows[0].id, ids[k], opt]); await q.query('INSERT INTO post_reads (post_id, user_id) VALUES ($1, $2)', [poll.rows[0].id, ids[k]]); }
  for (const k of ['inhaber', 'leitung', 'buero', 'abschlepp']) await q.query('INSERT INTO post_reads (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [p1.rows[0].id, ids[k]]);
}
