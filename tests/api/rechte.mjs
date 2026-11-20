// API-Rechtetest gegen einen laufenden Pitstop im Demo-Modus: node tests/api/rechte.mjs [http://localhost:3100]
const BASE = process.argv[2] ?? 'http://localhost:3100';
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++; };

async function as(persona) {
  const r = await fetch(`${BASE}/api/demo/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona }) });
  const cookie = r.headers.get('set-cookie')?.split(';')[0];
  const call = async (method, path, body) => {
    const res = await fetch(`${BASE}/api${path}`, { method, headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data };
  };
  const me = (await call('GET', '/me')).data;
  const cid = me.companies[0]?.id;
  return { call, me, cid, c: (m, p, b) => call(m, `/c/${cid}${p}`, b) };
}

// Frischer Demo-Stand
await (await as('inhaber')).call('POST', '/demo/reset');
const chef = await as('inhaber');
ok(chef.cid, 'Inhaber hat eine Firma');
const boot = (await chef.c('GET', '/bootstrap')).data;
ok(boot.rights.owner && boot.orders.length >= 8 && boot.callouts.length === 5, `Inhaber sieht alles (Aufträge ${boot.orders.length}, Einsätze ${boot.callouts.length})`);

const mech = await as('mechanik');
const mb = (await mech.c('GET', '/bootstrap')).data;
ok(mb.transactions.length === 0 && mb.rights.areas.buchungen.locked, 'Mechanik: Buchungen gesperrt, keine Buchungen im Bootstrap');
ok((await mech.c('POST', '/transactions', { amountCents: 100, text: 'x' })).status === 403, 'Mechanik: Buchung anlegen → 403');
ok((await mech.c('POST', '/orders', { title: 'Testauftrag' })).status === 200, 'Mechanik: Auftrag anlegen → 200');
ok((await mech.c('POST', '/groups', { name: 'X', color: '#123456', description: '', levels: {}, own: {}, specials: {} })).status === 403, 'Mechanik: Gruppe anlegen → 403');
ok((await mech.c('PATCH', '/settings', { name: 'Hack' })).status === 403, 'Mechanik: Firmendaten ändern → 403');

const tow = await as('abschlepp');
const tb = (await tow.c('GET', '/bootstrap')).data;
ok(tb.orders.length === 0 && tb.rights.areas.auftraege.level === 0, 'Abschlepp: keine Aufträge');
ok(tb.rights.areas.leitstelle.own, 'Abschlepp: Leitstelle nur eigene');
const free = tb.callouts.find((x) => !x.driverId && x.status === 'offen');
ok((await tow.c('PATCH', `/callouts/${free.id}`, { driverId: tow.me.user.id, status: 'unterwegs' })).status === 200, 'Abschlepp: freien Einsatz selbst übernehmen → 200');
const other = boot.members.find((m) => m.displayName === 'Jamal Carter');
const free2 = tb.callouts.find((x) => !x.driverId && x.id !== free.id);
ok((await tow.c('PATCH', `/callouts/${free2.id}`, { driverId: other.userId })).status === 403, 'Abschlepp: jemand anderem zuteilen → 403 (Sonderrecht fehlt)');

const office = await as('buero');
const ob = (await office.c('GET', '/bootstrap')).data;
const open = ob.bills.find((b) => b.status === 'offen');
const before = ob.transactions.length;
ok((await office.c('POST', `/bills/${open.id}/pay`, { account: 'kasse' })).status === 200, 'Büro: Rechnung bezahlt → 200');
ok((await office.c('GET', '/bootstrap')).data.transactions.length === before + 1, 'Bezahlen bucht eine Einnahme');
ok((await office.c('POST', '/transactions', { amountCents: -2_500_000, text: 'Zu groß' })).status === 403, 'Büro: Ausgabe über Grenze ($20.000) → 403');
ok((await office.c('POST', '/transactions', { amountCents: -50_000, text: 'Teile' })).status === 200, 'Büro: Ausgabe unter Grenze → 200');
ok((await office.call('GET', '/server/accounts')).status === 403, 'Büro: Serververwaltung → 403');

// Gruppenrechte ändern wirkt sofort
const mg = boot.groups.find((g) => g.name === 'Mechanik');
ok((await chef.c('PUT', `/groups/${mg.id}`, { ...mg, levels: { ...mg.levels, auftraege: 'x' } })).status === 200, 'Inhaber: Mechanik-Auftragstafel sperren');
ok((await mech.c('GET', '/bootstrap')).data.orders.length === 0, 'Mechanik sieht danach keine Aufträge mehr');
ok((await chef.c('PUT', '/exceptions', { userId: mech.me.user.id, area: 'auftraege', level: '2', reason: 'Test' })).status === 200, 'Ausnahme für Jamal: Aufträge bearbeiten');
ok((await mech.c('GET', '/bootstrap')).data.orders.length > 0, 'Ausnahme geht vor Gruppensperre');

// Fremde Firma
const anon = await fetch(`${BASE}/api/c/${chef.cid}/bootstrap`);
ok(anon.status === 401, 'Ohne Anmeldung → 401');

// --- Module ab 0.3 -----------------------------------------------------------
{
  const b = (await chef.c('GET', '/bootstrap')).data;
  ok(b.parts.length === 8 && b.courses.length === 4 && b.events.length === 4 && b.shifts.length > 10 && b.dyno.length === 4, `Bootstrap mit Moduldaten (Teile ${b.parts.length}, Kurse ${b.courses.length}, Events ${b.events.length}, Schichten ${b.shifts.length})`);
  ok(b.courses[0].questions.every((q) => q.correct >= 0), 'Inhaber sieht Lösungen der Kurse');
  ok(mb.courses.length === 4 && mb.courses.every((c) => c.questions.every((q) => q.correct === -1)), 'Mechanik sieht Kurse ohne Lösungen');
  ok(mb.progress.every((p) => p.userId === mech.me.user.id), 'Mechanik sieht nur eigenen Lernstand');
  ok(mb.wages.length === 1 && mb.wages[0].userId === mech.me.user.id && mb.payslips.every((p) => p.userId === mech.me.user.id), 'Mechanik sieht nur eigenen Lohn');
  ok(mb.parts.length === 8 && mb.dyno.length === 4 && mb.events.length === 4, 'Mechanik sieht Lager, Prüfstand, Racing');

  // Lager: Entnahme unter 0 verboten, Zugang mit Buchung braucht Buchungsrecht
  const part = b.parts.find((p) => p.sku === 'BRK-S');
  ok((await mech.c('POST', `/parts/${part.id}/move`, { delta: -99 })).status === 409, 'Lager: Entnahme über Bestand → 409');
  ok((await mech.c('POST', `/parts/${part.id}/move`, { delta: -1, note: 'W-1001' })).status === 200, 'Mechanik: Entnahme → 200');
  ok((await mech.c('POST', `/parts/${part.id}/move`, { delta: 2, book: true })).status === 403, 'Mechanik: Zugang als Ausgabe buchen → 403');
  const before = (await chef.c('GET', '/bootstrap')).data.transactions.length;
  ok((await chef.c('POST', `/parts/${part.id}/move`, { delta: 2, book: true })).status === 200, 'Inhaber: Zugang mit Buchung → 200');
  const after = (await chef.c('GET', '/bootstrap')).data;
  ok(after.transactions.length === before + 1 && after.parts.find((p) => p.id === part.id).qty === part.qty + 1, 'Zugang hat Bestand erhöht und eine Ausgabe gebucht');
  ok((await mech.c('DELETE', `/parts/${part.id}`)).status === 403, 'Mechanik: Teil löschen → 403');

  // Dienstplan: Mechanik nur lesen
  const st = new Date(Date.now() + 86_400_000).toISOString(), en = new Date(Date.now() + 90_000_000).toISOString();
  ok((await mech.c('POST', '/shifts', { userId: mech.me.user.id, startsAt: st, endsAt: en })).status === 403, 'Mechanik: Schicht planen → 403 (nur Sehen)');
  const lead = await as('leitung');
  ok((await lead.c('POST', '/shifts', { userId: mech.me.user.id, startsAt: st, endsAt: en, role: 'Werkstatt' })).status === 200, 'Leitung: Schicht planen → 200');
  ok((await lead.c('POST', '/shifts', { userId: mech.me.user.id, startsAt: en, endsAt: st })).status === 400, 'Schicht mit Ende vor Beginn → 400');

  // Lohn: Lohnlauf, Auszahlung nur mit Sonderrecht
  ok((await mech.c('POST', '/payslips/run', { from: '2026-01-01', to: '2026-12-31' })).status === 403, 'Mechanik: Lohnlauf → 403');
  const office = await as('buero');
  const from = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10), to = new Date().toISOString().slice(0, 10);
  const run = await office.c('POST', '/payslips/run', { from, to });
  ok(run.status === 200 && run.data.created >= 2, `Büro: Lohnlauf → ${run.data.created} Abrechnungen`);
  const run2 = await office.c('POST', '/payslips/run', { from, to });
  ok(run2.data.created === 0, 'Zweiter Lohnlauf im selben Zeitraum legt nichts doppelt an');
  const slips = (await office.c('GET', '/bootstrap')).data.payslips;
  const mslip = slips.find((x) => x.userId === mech.me.user.id);
  ok(mslip && mslip.wageCents > 0, `Lohn Mechanik aus Stempeluhr: ${mslip?.minutes} Min → ${mslip?.wageCents} Cent`);
  ok((await lead.c('POST', `/payslips/${mslip.id}/pay`)).status === 403, 'Leitung (Lohn nur Sehen): Auszahlen → 403');
  ok((await office.c('POST', `/payslips/${mslip.id}/pay`)).status === 200, 'Büro: Lohn auszahlen → 200');
  ok((await office.c('GET', '/bootstrap')).data.transactions.some((t) => t.category === 'Lohn' && t.amountCents === -mslip.totalCents), 'Auszahlung als Ausgabe gebucht');
  ok((await office.c('POST', `/payslips/${mslip.id}/pay`)).status === 409, 'Zweimal auszahlen → 409');

  // Schulungen: Test wird serverseitig gewertet
  const tune = b.courses.find((c) => c.name === 'Tuning I');
  ok((await mech.c('POST', `/courses/${tune.id}/test`, { answers: [1, 0] })).status === 409, 'Test vor allen Lektionen → 409');
  await mech.c('POST', `/courses/${tune.id}/lesson`, { done: 3 });
  const bad = await mech.c('POST', `/courses/${tune.id}/test`, { answers: [0, 1] });
  ok(bad.status === 200 && bad.data.score === 0 && !bad.data.passed, 'Falsche Antworten → 0 %, nicht bestanden');
  const good = await mech.c('POST', `/courses/${tune.id}/test`, { answers: tune.questions.map((q) => q.correct) });
  ok(good.data.score === 100 && good.data.passed, 'Richtige Antworten → bestanden');
  ok((await mech.c('POST', '/courses', { name: 'Hack' })).status === 403, 'Mechanik: Kurs anlegen → 403');
  const tow = b.courses.find((c) => c.name === 'Abschleppschein');
  ok((await mech.c('POST', `/courses/${tow.id}/practical`, { userId: mech.me.user.id, ok: true })).status === 403, 'Praxisprüfung bei sich selbst → 403');
  ok((await lead.c('POST', `/courses/${tow.id}/practical`, { userId: mech.me.user.id, ok: true })).status === 200, 'Leitung nimmt Praxisprüfung ab → 200');

  // Tuning: Preis kommt vom Server
  const veh = b.vehicles[0];
  const ord = await mech.c('POST', '/tuning/order', { cls: 'Sport', sel: { motor: 2, turbo: 1 }, vehicleId: veh.id, customerId: veh.customerId, amountCents: 1 });
  const disc = b.customers.find((c) => c.id === veh.customerId)?.discount ?? 0;
  ok(ord.status === 200 && ord.data.amountCents === Math.round((3600 + 7500) * 1.25 * (100 - disc)), `Konfigurator: Auftrag mit Server-Preis ${ord.data.amountCents} Cent (Rabatt ${disc} %)`);
  ok((await mech.c('PUT', '/tuning', { parts: [], classes: {}, packages: [] })).status === 403, 'Mechanik: Preisliste ändern → 403');
  ok((await mech.c('POST', '/dyno', { hp: 300, vehicleId: veh.id })).status === 200, 'Mechanik: Prüfstandsmessung → 200');

  // Racing: Mechanik nur Sehen, Leitung trägt Starter ein, Startplätze begrenzt
  const ev = b.events.find((e) => e.name === 'Vinewood Sprint');
  ok((await mech.c('POST', `/events/${ev.id}/entries`, { driver: 'X' })).status === 403, 'Mechanik: Starter eintragen → 403');
  const entry = await lead.c('POST', `/events/${ev.id}/entries`, { driver: 'Lester C.', car: 'Dinka Blista', lapMs: 144110 });
  ok(entry.status === 200, 'Leitung: Starter eintragen → 200');
  ok((await lead.c('POST', `/entries/${entry.data.id}/pay`)).status === 200 && (await lead.c('POST', `/entries/${entry.data.id}/pay`)).status === 409, 'Startgeld kassieren, zweites Mal → 409');

  // Module aus → Bereich zu
  ok((await chef.c('PUT', '/modules', { modules: ['werkstatt', 'abschlepp', 'kunden', 'personal', 'finanzen', 'tuning', 'schulungen'] })).status === 200, 'Racing ausgeschaltet');
  ok((await lead.c('POST', '/events', { name: 'Y', startsAt: st })).status === 403, 'Racing aus → Event anlegen 403');
  await chef.c('PUT', '/modules', { modules: ['werkstatt', 'abschlepp', 'kunden', 'personal', 'finanzen', 'tuning', 'racing', 'schulungen'] });

  // Export an Bereich gebunden
  ok((await lead.c('GET', '/export/lohn')).status === 200, 'Leitung: Export Lohn (sieht alle) → 200');
  const tow2 = await as('abschlepp');
  ok((await tow2.c('GET', '/export/lohn')).status === 403, 'Abschlepp ohne Export-Recht → 403');

  // Widgets in den Einstellungen
  const pw = await mech.call('PATCH', '/me', { prefs: { widgets: ['todo:8', 'lager:4'] } });
  ok(pw.status === 200 && pw.data.user.prefs.widgets.length === 2, 'Arbeitsfläche wird im Konto gespeichert');
  ok((await mech.call('PATCH', '/me', { prefs: { widgets: ['<script>:4'] } })).status === 400, 'Ungültiges Widget → 400');
}

// --- Restliches Mockup ab 0.4 -------------------------------------------------
{
  const lead = await as('leitung');
  const B = (await chef.c('GET', '/bootstrap')).data;
  ok(B.bays.length === 6 && B.tools.length === 6 && B.fleet.length === 4 && B.raceCars.length === 2 && B.contracts.length === 3 && B.services.length === 10 && B.rules.length === 2 && B.posts.length === 3, 'Bootstrap 0.4: Plätze, Werkzeug, Fuhrpark, Rennwagen, Verträge, Preisliste, Regelwerk, Pinnwand');
  const M = (await mech.c('GET', '/bootstrap')).data;
  ok(M.applications.length === 0 && M.closings.length === 0 && M.webhooks.length === 0, 'Mechanik: keine Bewerbungen, Kassenabschlüsse, Webhooks im Bootstrap');
  ok((await office.c('POST', '/fleet', { name: 'X' })).status === 403, 'Büro: kein Fuhrpark → 403');
  ok((await mech.c('POST', '/services', { name: 'X' })).status === 403, 'Mechanik: Preisliste nur sehen → 403');
  ok((await mech.c('POST', '/applications', { name: 'X' })).status === 403, 'Mechanik: Bewerbungen → 403');
  ok((await mech.c('POST', '/closings', { countedCents: 1 })).status === 403, 'Mechanik: Kassenabschluss → 403');
  ok((await mech.c('POST', '/transfers', { from: 'kasse', to: 'firma', amountCents: 100 })).status === 403, 'Mechanik: Umbuchung → 403');
  ok((await mech.c('POST', '/contracts', { customerId: B.customers[0].id })).status === 403, 'Mechanik: Rahmenvertrag anlegen → 403');
  ok((await mech.c('POST', '/webhooks', { url: 'https://example.com/x' })).status === 403, 'Mechanik: Webhook → 403');
  const freeTool = M.tools.find((t) => t.status === 'frei');
  ok((await mech.c('POST', `/tools/${freeTool.id}/issue`, {})).status === 200, 'Mechanik: Werkzeug ausgeben → 200');
  ok((await mech.c('POST', `/tools/${freeTool.id}/issue`, {})).status === 409, 'Werkzeug doppelt ausgeben → 409');
  ok((await mech.c('POST', '/messages', { customerId: B.customers[3].id, text: 'Ist fertig' })).status === 200, 'Mechanik: Nachricht an Kunden → 200');

  // Annahme mit Kennzeichen-Abgleich
  const an = await mech.c('POST', '/intake', { plate: 'neu 1', model: 'Dinka Jester', title: 'Inspektion', damage: ['Heck'], checks: ['Fahrzeugschein geprüft'], km: 12000 });
  ok(an.status === 200 && an.data.intake.damage[0] === 'Heck', 'Annahme: neues Fahrzeug → Auftrag mit Schadensskizze');
  ok((await mech.c('GET', '/bootstrap')).data.vehicles.some((v) => v.plate === 'NEU 1'), 'Annahme legt das Fahrzeug an');
  const v0 = B.vehicles.find((v) => v.plate === 'GS 777');
  ok((await mech.c('POST', `/vehicles/${v0.id}/stolen`, { stolen: true })).status === 200, 'Fahrzeug als gestohlen melden');
  ok((await mech.c('POST', '/intake', { plate: 'gs 777', title: 'x' })).status === 409, 'Annahme: gestohlenes Kennzeichen → 409');
  ok((await mech.c('POST', '/intake', { plate: 'GS 777', title: 'x', confirmStolen: true })).status === 200, 'Annahme trotzdem mit Bestätigung');
  await mech.c('POST', `/vehicles/${v0.id}/stolen`, { stolen: false });

  // Preisliste: Nachweis-Pflicht
  const svc = B.services.find((x) => x.name === 'Abschleppen Stadt');
  const mechId = mech.me.user.id, towId = tow.me.user.id;
  const q1 = await chef.c('POST', '/orders', { title: 'Abschleppen', serviceId: svc.id, assigneeId: mechId });
  ok(q1.status === 400 && /Nachweis/.test(q1.data.error.message), 'Leistung mit Nachweis: ohne Abschleppschein → 400');
  ok((await chef.c('POST', '/orders', { title: 'Abschleppen', serviceId: svc.id, assigneeId: towId })).status === 200, 'Mit Abschleppschein → 200');

  // Hallenplan: Doppelbuchung
  const bk1 = B.bookings.find((b) => b.title.startsWith('Motor-Tuning'));
  ok((await mech.c('POST', '/bookings', { bayId: bk1.bayId, startsAt: bk1.startsAt, endsAt: bk1.endsAt, title: 'Doppelt' })).status === 409, 'Hallenplan: belegter Platz → 409');

  // Abwesenheit und Nachtrag
  const ab1 = await tow.c('POST', '/absences', { dateFrom: '2030-01-02', dateTo: '2030-01-03', kind: 'urlaub' });
  ok(ab1.status === 200 && ab1.data.status === 'beantragt', 'Abwesenheit wird beantragt');
  ok((await tow.c('POST', `/absences/${ab1.data.id}/decide`, { ok: true })).status === 403, 'Eigenen Antrag nicht selbst genehmigen');
  ok((await lead.c('POST', `/absences/${ab1.data.id}/decide`, { ok: true })).status === 200, 'Leitung genehmigt');
  const dutyBefore = (await lead.c('GET', '/bootstrap')).data.duty.length;
  const corr = await tow.c('POST', '/corrections', { startedAt: '2026-11-01T18:00:00.000Z', endedAt: '2026-11-01T22:00:00.000Z', reason: 'vergessen' });
  ok(corr.status === 200, 'Nachtrag beantragt');
  ok((await mech.c('POST', `/corrections/${corr.data.id}/decide`, { ok: true })).status === 403, 'Mechanik genehmigt keine Nachträge');
  ok((await lead.c('POST', `/corrections/${corr.data.id}/decide`, { ok: true })).status === 200, 'Leitung genehmigt Nachtrag');
  ok((await lead.c('GET', '/bootstrap')).data.duty.length >= dutyBefore, 'Nachtrag erzeugt eine Dienstzeit');

  // Trackday: Preis vom Server, Rechnung
  const td = await chef.c('POST', '/trackdays', { package: 'Gold', customerId: B.customers[5].id, priceCents: 1 });
  ok(td.status === 200 && td.data.priceCents === 650000, 'Trackday-Preis kommt aus dem Paket (nicht vom Browser)');
  const tdb = await chef.c('POST', `/trackdays/${td.data.id}/bill`);
  ok(tdb.status === 200 && tdb.data.amountCents === 650000, 'Trackday → Rechnung');
  ok((await chef.c('POST', `/trackdays/${td.data.id}/bill`)).status === 409, 'Trackday nicht doppelt abrechnen');

  // Freitext-Bewertung
  const kk = B.courses.find((c) => c.name === 'Kundenkommunikation');
  ok(kk.questions[1].kind === 'text' && kk.questions[0].correct === 1, 'Kurs mit Freitext (Bearbeiter sehen Lösungen)');
  ok(M.courses.find((c) => c.name === 'Kundenkommunikation').questions[0].correct === -1, 'Mechanik sieht keine Lösungen');
  ok((await mech.c('POST', `/courses/${kk.id}/review`, { userId: mechId, index: 1, ok: true })).status === 403, 'Eigene Freitext-Antwort nicht selbst bewerten');
  const rv = await lead.c('POST', `/courses/${kk.id}/review`, { userId: mechId, index: 1, ok: true });
  ok(rv.status === 200 && rv.data.passed && rv.data.score === 100, 'Trainer bewertet Freitext → bestanden');

  // Regelwerk, Pinnwand
  const rule = B.rules.find((r) => r.title === 'Dienstverordnung');
  ok((await mech.c('POST', `/rules/${rule.id}/ack`)).status === 200, 'Regelwerk bestätigen');
  ok((await mech.c('GET', '/bootstrap')).data.rules.find((r) => r.id === rule.id).ackedBy.includes(mechId), 'Bestätigung gespeichert');
  ok((await mech.c('PATCH', `/rules/${rule.id}`, { body: 'x' })).status === 403, 'Mechanik ändert kein Regelwerk');
  const pl = B.posts.find((p) => p.poll);
  ok((await mech.c('POST', `/posts/${pl.id}/vote`, { option: 0 })).status === 200, 'Umfrage: abstimmen');
  ok((await mech.c('POST', `/posts/${pl.id}/vote`, { option: 5 })).status === 400, 'Umfrage: unbekannte Antwort → 400');
  ok((await mech.c('POST', '/posts', { title: 'Hallo', pinned: true })).status === 403, 'Mechanik darf nicht anheften');

  // Finanzen: Angebot, Kasse, Trinkgeld, Umbuchung
  const off = await office.c('POST', '/bills', { title: 'Angebot Folie', amountCents: 480000, kind: 'angebot', customerId: B.customers[4].id });
  ok(off.status === 200 && off.data.kind === 'angebot', 'Angebot erstellt');
  ok((await office.c('POST', `/bills/${off.data.id}/pay`, { account: 'kasse' })).status === 409, 'Angebot nicht bezahlbar');
  const acc = await office.c('POST', `/bills/${off.data.id}/accept`);
  ok(acc.status === 200 && acc.data.kind === 'rechnung' && acc.data.dueDate, 'Angebot angenommen → Rechnung mit Zahlungsziel');
  const rem = await office.c('POST', `/bills/${off.data.id}/remind`);
  ok(rem.status === 200 && rem.data.sent, 'Mahnung mit Nachricht an den Kunden');
  const cl = await office.c('POST', '/closings', { countedCents: 0 });
  ok(cl.status === 200 && cl.data.expectedCents > 0, 'Kassenabschluss bucht Differenz');
  ok((await office.c('GET', '/bootstrap')).data.transactions.filter((t) => t.account === 'kasse').reduce((a, t) => a + t.amountCents, 0) === 0, 'Kasse danach = gezählt');
  const tips = await office.c('POST', '/tips', { from: '2026-01-01', to: '2030-12-31', preview: true });
  ok(tips.status === 200 && tips.data.pot === 62000 && tips.data.shares.reduce((a, s) => a + s.cents, 0) === 62000, 'Trinkgeld: centgenau nach Stunden verteilt');
  ok((await office.c('POST', '/transfers', { from: 'firma', to: 'firma', amountCents: 100 })).status === 400, 'Umbuchung aufs gleiche Konto → 400');

  // Ränge, Bewerbungen
  const rk = B.ranks.find((r) => r.name === 'Azubi');
  ok((await lead.c('POST', `/ranks/${rk.id}/assign`, { userId: mechId, groups: true })).status === 403, 'Leitung: Gruppen beim Befördern brauchen „Gruppen & Rechte“');
  ok((await chef.c('POST', `/ranks/${rk.id}/assign`, { userId: mechId, groups: true, wage: true })).status === 200, 'Inhaber befördert mit Gruppen und Lohn');
  const kevin = (await chef.c('GET', '/bootstrap')).data.applications.find((a) => a.name === 'Kevin Park');
  const hire = await chef.c('POST', `/applications/${kevin.id}/hire`, { email: 'kevin@demo.pitstop', rankId: rk.id });
  ok(hire.status === 200 && hire.data.startPassword, 'Bewerbung: einstellen legt Konto mit Startpasswort an');

  // Live-Feed nach Rechten, Vorschau
  const fm = (await mech.c('GET', '/feed')).data.items;
  const fc = (await chef.c('GET', '/feed')).data.items;
  ok(fc.some((x) => x.area === 'Kasse') && !fm.some((x) => x.area === 'Kasse' || x.area === 'Lohn'), 'Live-Feed: Mechanik sieht keine Kasse/Lohn-Einträge');
  const pv = await chef.c('GET', `/rights/${mechId}`);
  ok(pv.status === 200 && pv.data.rights.areas.buchungen.locked, 'Vorschau: Rechte der Mechanik');
  ok((await mech.c('GET', `/rights/${chef.me.user.id}`)).status === 403, 'Vorschau nur mit Recht auf Gruppen/Zugänge');

  // Angemeldete Geräte
  const ses = (await mech.call('GET', '/me/sessions')).data.sessions;
  ok(ses.some((x) => x.current) && ses.every((x) => /^[0-9a-f]{16}$/.test(x.id)), 'Mein Konto: angemeldete Geräte (ohne Token)');
  ok((await mech.call('DELETE', `/me/sessions/${ses.find((x) => x.current).id}`)).status === 200 && (await mech.call('GET', '/me')).status === 200, 'Eigene aktuelle Sitzung wird nicht abgemeldet');

  // Webhooks
  ok((await chef.c('POST', '/webhooks', { url: 'http://example.com/x' })).status === 400, 'Webhook nur mit https');
  ok((await chef.c('POST', '/webhooks', { url: 'https://localhost/x' })).status === 400, 'Webhook nicht an interne Adressen');
  ok((await chef.c('POST', '/webhooks', { url: 'https://discord.com/api/webhooks/1/abc', events: ['Abschleppdienst'] })).status === 200, 'Webhook angelegt');
}

// Server-Admin (Admin aus .env) – nicht Mitglied, ohne Support kein Zugang
const adminLogin = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@demo.pitstop', password: process.env.ADMIN_PASSWORD ?? 'admin-passwort-123' }) });
let ac = adminLogin.headers.get('set-cookie')?.split(';')[0];
const adm = async (method, path, body) => {
  const res = await fetch(`${BASE}/api${path}`, { method, headers: { Cookie: ac, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() };
};
await adm('POST', '/auth/password', { currentPassword: 'admin-passwort-123', newPassword: 'admin-passwort-neu-456' });
ok((await adm('GET', `/c/${chef.cid}/bootstrap`)).status === 403, 'Server-Admin ohne Support-Freigabe → 403 auf Firmendaten');
ok((await adm('GET', `/server/export/kunden?company=${chef.cid}`)).status === 400, 'Server-Admin: Kunden-Export ohne Freigabe → 400');
ok((await chef.c('PATCH', '/settings', { supportAccess: true })).status === 200, 'Inhaber erlaubt Support');
const sup = await adm('GET', `/c/${chef.cid}/bootstrap`);
ok(sup.status === 200 && sup.data.rights.support && sup.data.rights.areas.auftraege.level === 1, 'Server-Admin mit Support: nur lesen');
ok((await adm('POST', `/c/${chef.cid}/orders`, { title: 'x' })).status === 403, 'Support darf nichts anlegen');
const csv = await adm('GET', `/server/export/kunden?company=${chef.cid}`);
ok(csv.status === 200 && csv.data.includes('LSPD Fuhrpark'), 'Kunden-Export mit Freigabe');
const accs = (await adm('GET', '/server/accounts')).data.accounts;
ok(accs.length >= 6, `Konten: ${accs.length}`);
const self = accs.find((a) => a.email === 'admin@demo.pitstop');
ok((await adm('PATCH', `/server/accounts/${self.id}`, { isServerAdmin: false })).status === 400, 'Letzten Server-Admin nicht entziehbar');
const nc = await adm('POST', '/server/companies', { name: 'Zweite Firma', ownerId: accs.find((a) => a.email === 'leitung@demo.pitstop').id });
ok(nc.status === 200, 'Server-Admin legt Firma an');
const bk = await adm('POST', '/server/backups');
ok(bk.status === 200 && bk.data.size > 1000, `Sicherung erstellt (${bk.data.size} Bytes)`);
await chef.c('POST', '/orders', { title: 'Nach der Sicherung' });
const rs = await adm('POST', `/server/backups/${bk.data.name}/restore`, { confirm: 'WIEDERHERSTELLEN' });
ok(rs.status === 200, `Wiederherstellen → ${rs.status} ${JSON.stringify(rs.data).slice(0, 120)}`);
const again = await as('inhaber');
const ab = (await again.c('GET', '/bootstrap')).data;
ok(!ab.orders.some((o) => o.title === 'Nach der Sicherung') && ab.orders.length >= 9, 'Stand der Sicherung ist zurück');
ok(ab.parts.length === 8 && ab.courses.length === 4 && ab.entries.length >= 7 && ab.payslips.length >= 2, 'Sicherung enthält die Moduldaten');


// Server ab 0.4: Wartungsmodus, API-Schlüssel, öffentliche API (nach dem Wiederherstellen neu anmelden)
{
  const re = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@demo.pitstop', password: 'admin-passwort-neu-456' }) });
  ac = re.headers.get('set-cookie')?.split(';')[0];
  const m2 = await as('mechanik');
  ok((await adm('PATCH', '/server/settings', { maintenance: true })).status === 200, 'Wartungsmodus an');
  ok((await m2.call('GET', '/me')).status === 503, 'Wartung: normale Konten → 503');
  ok((await adm('GET', '/me')).status === 200, 'Wartung: Server-Admin arbeitet weiter');
  await adm('PATCH', '/server/settings', { maintenance: false });
  ok((await m2.call('GET', '/me')).status === 200, 'Wartungsmodus aus');
  const key = (await adm('POST', '/server/api-keys', { name: 'Test' })).data.key;
  const v1 = (path) => fetch(`${BASE}/api/v1${path}`, { headers: { Authorization: `Bearer ${key}` } }).then(async (r) => ({ status: r.status, data: await r.json() }));
  ok((await fetch(`${BASE}/api/v1/companies`)).status === 401, 'API ohne Schlüssel → 401');
  const c0 = await v1('/companies');
  ok(c0.status === 200 && !c0.data.companies.some((c) => c.id === again.cid), 'Firma ohne Freigabe nicht in der API');
  await again.c('PATCH', '/extra', { publicData: true });
  const pr = await v1(`/companies/${again.cid}/prices`);
  ok(pr.status === 200 && pr.data.prices.length === 10, 'API: Preisliste der freigegebenen Firma');
  ok((await v1(`/companies/${again.cid}/leaderboard`)).data.laps.length > 0, 'API: Bestenliste');
}

console.log(fails ? `\n${fails} Fehler` : '\nAlles grün');
process.exit(fails ? 1 : 0);
