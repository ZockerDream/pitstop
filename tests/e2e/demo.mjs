// Browser-Drehbuch für Pitstop 0.2 im Demo-Modus (CONCEPT.md Abschnitt 7).
// Start: tests/e2e/run.sh demo.mjs http://localhost:8080 – braucht DEMO_MODE=true sowie ADMIN_EMAIL/ADMIN_PASSWORD des
// Server-Admins (Startpasswort; das Skript ändert es auf ADMIN_PASSWORD + '-neu'). Die Demo-Daten werden zurückgesetzt.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
mkdirSync('shots', { recursive: true });
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++; };
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push('console ' + m.text()));
  await p.request.post(BASE + '/api/demo/login', { data: { persona: 'inhaber' } });
  await p.request.post(BASE + '/api/demo/reset');
  await p.goto(BASE + '/');
  await p.waitForSelector('text=Demo: als');
  console.log('Discord-Knopf auf der Anmeldeseite:', !!(await p.$('a:has-text("Mit Discord anmelden")')));
  await p.screenshot({ path: 'shots/login.png' });
  await p.click('text=Vince Moretti');
  await p.waitForSelector('.side');
  await p.waitForTimeout(500);
  const nav = async (pg) => (await pg.$$eval('.nav a', (e) => e.map((x) => x.textContent.trim()))).join(', ');
  console.log('Inhaber Nav:', await nav(p));
  await p.screenshot({ path: 'shots/cockpit.png' });
  for (const pg of ['auftraege', 'leitstelle', 'kunden', 'fahrzeuge', 'mitarbeiter', 'dienstzeiten', 'rechnungen', 'buchungen', 'firma', 'zugaenge', 'gruppen', 'module', 'protokoll', 'konto', 'darstellung', 'neuigkeiten']) {
    await p.goto(BASE + '/#' + pg);
    await p.waitForTimeout(350);
    const h = await p.$eval('.ph h1', (e) => e.textContent).catch(() => '??');
    if (['auftraege', 'leitstelle', 'gruppen', 'rechnungen', 'zugaenge'].includes(pg)) await p.screenshot({ path: `shots/${pg}.png` });
    console.log(' ', pg, '->', h);
  }
  // --- Module ab 0.3 ---------------------------------------------------------
  for (const pg of ['kalender', 'lager', 'konfigurator', 'builds', 'pruefstand', 'pakete', 'rennkalender', 'bestenliste', 'dienstplan', 'lohn', 'lernen', 'kurse', 'nachweise']) {
    await p.goto(BASE + '/#' + pg);
    await p.waitForTimeout(350);
    const h = await p.$eval('.ph h1', (e) => e.textContent).catch(() => '??');
    await p.screenshot({ path: `shots/${pg}.png` });
    ok(h !== '??' && !h.startsWith('Kein Zugriff'), `Seite ${pg} → ${h}`);
  }
  // Konfigurator → Tuning-Auftrag
  await p.goto(BASE + '/#konfigurator');
  await p.waitForTimeout(300);
  await p.click('.chip:has-text("Track")');
  await p.click('text=Als Auftrag anlegen');
  await p.waitForTimeout(700);
  ok(!!(await p.$('.toast:has-text("W-")')), 'Konfigurator legt Tuning-Auftrag an');
  // Lager-Zugang
  await p.goto(BASE + '/#lager');
  await p.waitForTimeout(300);
  await p.click('tr:has-text("Folie Mattschwarz") >> text=+ Zugang');
  await p.fill('#ff-n', '3');
  await p.click('.modal button[type=submit]');
  await p.waitForTimeout(600);
  ok(!!(await p.$('tr:has-text("Folie Mattschwarz") >> text=3 Rolle')), 'Lager: Zugang eingebucht');
  // Kurs durcharbeiten und Test bestehen
  await p.goto(BASE + '/#lernen');
  await p.waitForTimeout(300);
  await p.click('text=Firmenregeln & Kundenumgang');
  for (let i = 0; i < 3; i++) { await p.click('text=Gelesen, weiter'); await p.waitForTimeout(450); }
  await p.check('input[name=q0] >> nth=1');
  await p.check('input[name=q1] >> nth=1');
  await p.click('text=Test abgeben');
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'shots/kurs.png' });
  ok(!!(await p.$('text=Bestanden – der Nachweis ist eingetragen')), 'Kurs: Test bestanden');
  await p.keyboard.press('Escape');
  // Arbeitsfläche anpassen: Widget entfernen, bleibt nach Neuladen weg, dann Standard
  await p.goto(BASE + '/#cockpit');
  await p.waitForTimeout(400);
  const w0 = (await p.$$('.wgrid .w')).length;
  await p.click('text=Anpassen');
  await p.screenshot({ path: 'shots/arbeitsflaeche.png' });
  await p.click('.w >> nth=0 >> button[aria-label="Entfernen"]');
  await p.click('text=Fertig');
  await p.waitForTimeout(500);
  await p.reload();
  await p.waitForSelector('.wgrid');
  await p.waitForTimeout(400);
  ok((await p.$$('.wgrid .w')).length === w0 - 1, `Widget entfernt und gespeichert (${w0} → ${w0 - 1})`);
  await p.click('text=Anpassen');
  await p.click('text=Standard');
  await p.click('text=Fertig');
  await p.waitForTimeout(400);
  ok((await p.$$('.wgrid .w')).length === w0, 'Arbeitsfläche auf Standard zurückgesetzt');
  // Tabs: Klick ersetzt, Doppelklick öffnet neuen Tab, Seite daneben
  await p.click('.nav a[href="#auftraege"]');
  await p.waitForTimeout(300);
  await p.dblclick('.nav a[href="#lager"]');
  await p.waitForTimeout(400);
  const tabs = await p.$$eval('.wt a span', (e) => e.map((x) => x.textContent));
  ok(tabs.includes('Auftragstafel') && tabs.some((t) => t.startsWith('Lager')), `Doppelklick öffnet neuen Tab (${tabs.join(', ')})`);
  await p.click('.wt:has-text("Auftragstafel") button[title="Daneben öffnen"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/daneben.png' });
  ok((await p.$$('.pane')).length === 2, 'Zwei Seiten nebeneinander');
  await p.click('button[aria-label="Ansicht daneben schließen"]');
  await p.click('.wt:has-text("Lager") button[title="Tab schließen"]');
  await p.waitForTimeout(300);
  // Kartenbild hochladen und mit zwei Punkten kalibrieren
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');
  const cid = (await (await p.request.get(`${BASE}/api/me`)).json()).companies[0].id;
  const up = await p.request.put(`${BASE}/api/c/${cid}/map`, { headers: { 'Content-Type': 'image/png', Origin: BASE }, data: png });
  ok(up.ok(), `Kartenbild hochgeladen (${up.status()})`);
  await p.goto(BASE + '/#firma');
  await p.reload();
  await p.waitForSelector('.ph h1');
  await p.waitForTimeout(500);
  await p.click('button:has-text("Mit 2 Punkten kalibrieren")');
  await p.waitForTimeout(300);
  await p.setViewportSize({ width: 1440, height: 2200 });
  const box = await (await p.$('.calib .map svg')).boundingBox();
  await p.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.2);
  await p.waitForTimeout(200);
  await p.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.7);
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/kalibrierung.png' });
  await p.click('text=Übernehmen und speichern');
  await p.waitForTimeout(600);
  ok(!!(await p.$('.toast:has-text("Karte kalibriert")')), 'Karte mit zwei Punkten kalibriert');
  await p.setViewportSize({ width: 1440, height: 950 });
  await p.request.fetch(`${BASE}/api/c/${cid}/map`, { method: 'DELETE', headers: { Origin: BASE } });

  await p.goto(BASE + '/#auftraege');
  await p.waitForTimeout(300);
  await p.click('.ph button:has-text("Auftrag")');
  await p.fill('#ff-title', 'Testauftrag Browser');
  await p.fill('#ff-amountCents', '1.250');
  await p.click('.modal button[type=submit]');
  await p.waitForTimeout(600);
  ok(!!(await p.$('text=Testauftrag Browser')), 'Auftrag angelegt');
  await p.click('text=Testauftrag Browser');
  await p.waitForTimeout(300);
  await p.click('.drawer >> text=Rechnung stellen');
  await p.waitForTimeout(700);
  console.log('Nach Rechnung auf Seite:', await p.$eval('.ph h1', (e) => e.textContent));
  await p.click('tr:has-text("Testauftrag Browser") >> text=Bezahlt');
  await p.click('text=Bar in die Kasse');
  await p.waitForTimeout(600);
  await p.goto(BASE + '/#buchungen');
  await p.waitForTimeout(400);
  ok(!!(await p.$('text=Testauftrag Browser')), 'Rechnung bezahlt, Buchung in der Kasse');
  await p.goto(BASE + '/#leitstelle');
  await p.waitForTimeout(400);
  const svg = await (await p.$('.map svg')).boundingBox();
  await p.mouse.move(svg.x + svg.width * 0.5, svg.y + svg.height * 0.5);
  for (let i = 0; i < 3; i++) await p.mouse.wheel(0, -200);
  await p.waitForTimeout(200);
  console.log('viewBox nach Zoom:', await p.$eval('.map svg', (e) => e.getAttribute('viewBox')));
  await p.click('text=Ort auf Karte');
  await p.mouse.click(svg.x + svg.width * 0.3, svg.y + svg.height * 0.4);
  await p.waitForTimeout(300);
  await p.fill('#ff-location', 'Browser-Testort');
  await p.click('.modal button[type=submit]');
  await p.waitForTimeout(600);
  ok(!!(await p.$('text=Browser-Testort')) && (await p.$$('.map svg [data-pin]')).length === 5, 'Einsatz per Karte angelegt, Pin sichtbar');
  await p.goto(BASE + '/#darstellung');
  await p.waitForTimeout(300);
  await p.click('.skin:has-text("Werkstatt hell")');
  await p.waitForTimeout(400);
  ok((await p.evaluate(() => document.documentElement.dataset.skin)) === 'hell', 'Theme umgeschaltet');
  await p.click('.skin:has-text("Boxengasse")');
  await p.waitForTimeout(300);

  const p2 = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p2.on('pageerror', (e) => errors.push('p2 ' + e.message));
  await p2.goto(BASE + '/');
  await p2.click('text=Jamal Carter');
  await p2.waitForSelector('.side');
  await p2.waitForTimeout(400);
  console.log('Mechanik Nav:', await nav(p2));
  await p2.goto(BASE + '/#buchungen');
  await p2.waitForTimeout(300);
  ok((await p2.$eval('.content h2', (e) => e.textContent).catch(() => '')).startsWith('Kein Zugriff'), 'Mechanik: Buchungen gesperrt');
  ok(!(await nav(p2)).includes('Buchungen'), 'Mechanik: Buchungen nicht in der Navigation');
  await p2.click('.clock button');
  await p2.waitForTimeout(500);
  console.log('Stempeluhr:', await p2.$eval('.clock .t', (e) => e.textContent));

  const p3 = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  p3.on('pageerror', (e) => errors.push('p3 ' + e.message));
  await p3.goto(BASE + '/');
  await p3.fill('#l-mail', ADMIN_EMAIL);
  await p3.fill('#l-pw', ADMIN_PASSWORD);
  await p3.click('button[type=submit]');
  await p3.waitForTimeout(700);
  console.log('Admin nach Login:', await p3.$eval('h1', (e) => e.textContent));
  await p3.fill('#p-cur', ADMIN_PASSWORD);
  await p3.fill('#p-new', ADMIN_PASSWORD + '-neu');
  await p3.click('button[type=submit]');
  await p3.waitForTimeout(800);
  for (const pg of ['srv', 'srv-firmen', 'srv-konten', 'srv-backup', 'srv-export', 'srv-anbind', 'srv-einst', 'srv-log']) {
    await p3.goto(BASE + '/#' + pg);
    await p3.waitForTimeout(400);
    console.log(' ', pg, '->', await p3.$eval('.ph h1', (e) => e.textContent).catch(() => '??'));
    if (pg === 'srv-konten') await p3.screenshot({ path: 'shots/srv-konten.png' });
  }
  await p3.goto(BASE + '/#srv-backup');
  await p3.waitForTimeout(300);
  await p3.click('text=Jetzt sichern');
  await p3.waitForTimeout(900);
  ok((await p3.$$('tbody tr')).length >= 1, 'Sicherung erstellt');

  // --- Restliches Mockup ab 0.4 ------------------------------------------------
  await p.setViewportSize({ width: 1440, height: 950 });
  for (const pg of ['feed', 'annahme', 'hallenplan', 'werkzeug', 'einsaetze', 'fuhrpark', 'team', 'telemetrie', 'trackdays', 'vertraege', 'nachrichten', 'raenge', 'bewerbungen', 'pruefungen', 'finanzen', 'kasse', 'auswertung', 'preisliste', 'regelwerk', 'pinnwand']) {
    await p.goto(BASE + '/#' + pg);
    await p.waitForTimeout(400);
    const h = await p.$eval('.ph h1', (e) => e.textContent).catch(() => '??');
    await p.screenshot({ path: `shots/${pg}.png` });
    ok(h !== '??' && !h.startsWith('Kein Zugriff'), `Seite ${pg} → ${h}`);
  }
  // Fahrzeugannahme mit Schadensskizze → Auftrag
  await p.goto(BASE + '/#annahme');
  await p.waitForTimeout(400);
  await p.fill('#an-plate', 'E2E 1');
  await p.fill('#an-model', 'Dinka Jester');
  await p.click('rect[aria-label="Heck"]');
  await p.click('.chk:has-text("Fahrzeugschein geprüft")');
  await p.click('.chip:has-text("Inspektion")');
  await p.click('text=Auftrag anlegen');
  await p.waitForTimeout(900);
  ok(p.url().endsWith('#auftraege') && !!(await p.$('.job:has-text("Inspektion")')), 'Annahme legt Auftrag an und öffnet die Tafel');
  // Suche mit Kennzeichen-Abgleich
  await p.keyboard.press('Control+k');
  await p.fill('.pal-in input', 'LSPD 12');
  await p.waitForTimeout(300);
  ok(!!(await p.$('.alert.ok:has-text("nicht gestohlen")')), 'Suche: Kennzeichen-Abgleich');
  await p.screenshot({ path: 'shots/suche.png' });
  await p.keyboard.press('Escape');
  await p.click('.scrim').catch(() => undefined);
  // Meldungen
  await p.click('button[aria-label^="Meldungen"]');
  await p.waitForTimeout(300);
  ok(!!(await p.$('.modal:has-text("bestätigen")')), 'Meldungen zeigen offene Bestätigungen');
  await p.click('.modal button[aria-label="Schließen"]');
  // Benannte Arbeitsfläche
  await p.goto(BASE + '/#cockpit');
  await p.waitForTimeout(400);
  await p.click('.nav button.add');
  await p.waitForTimeout(700);
  ok(/#b-/.test(p.url()) && !!(await p.$('.nav a:has-text("Arbeitsfläche 1")')), 'Neue Arbeitsfläche angelegt');
  await p.reload();
  await p.waitForTimeout(800);
  ok(!!(await p.$('.ph h1:has-text("Arbeitsfläche 1")')) && !!(await p.$('.card:has-text("Live-Feed")')), 'Arbeitsfläche bleibt nach Neuladen, mit Live-Feed');
  await p.screenshot({ path: 'shots/arbeitsflaeche.png' });
  // Vorschau als Person
  await p.goto(BASE + '/#zugaenge');
  await p.waitForTimeout(400);
  await p.click('.content >> text=Jamal Carter');
  await p.waitForTimeout(300);
  await p.click('text=Vorschau als Jamal');
  await p.waitForTimeout(700);
  ok(!!(await p.$('.vabar')) && !(await p.$('.nav a:has-text("Buchungen")')), 'Vorschau als Mechanik: ohne Buchungen in der Navigation');
  await p.screenshot({ path: 'shots/vorschau.png' });
  await p.click('.vabar >> text=Vorschau beenden');
  await p.waitForTimeout(300);
  ok(!!(await p.$('.nav a:has-text("Buchungen")')), 'Vorschau beendet');
  // Pinnwand: abstimmen; Kasse: Tagesabschluss
  await p.goto(BASE + '/#pinnwand');
  await p.waitForTimeout(400);
  await p.click('button.card:has-text("Kartbahn")');
  await p.waitForTimeout(600);
  ok(!!(await p.$('button.card:has-text("✓ Kartbahn")')), 'Umfrage: Stimme gezählt');
  await p.goto(BASE + '/#kasse');
  await p.waitForTimeout(400);
  await p.click('text=Stimmt genau');
  await p.click('text=Abschluss buchen');
  await p.click('.modal >> text=Abschluss buchen');
  await p.waitForTimeout(700);
  ok(!!(await p.$('.card:has-text("Letzte Abschlüsse")')), 'Kasse: Tagesabschluss gebucht');
  // --- 0.5: Fotos, Zwei-Faktor, Spielserver ---------------------------------------
  await p.setViewportSize({ width: 1440, height: 950 });
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.goto(BASE + '/#auftraege');
  await p.waitForTimeout(400);
  await p.click('.job:has-text("Inspektion")');
  await p.waitForTimeout(300);
  await p.setInputFiles('.drawer input[type=file]', { name: 'schaden.png', mimeType: 'image/png', buffer: pixel });
  await p.waitForTimeout(900);
  ok(!!(await p.$('.drawer img[alt="Foto"]')), 'Auftrag: Foto hochgeladen und angezeigt');
  await p.screenshot({ path: 'shots/foto.png' });
  await p.keyboard.press('Escape');
  await p.click('.scrim').catch(() => undefined);
  await p.goto(BASE + '/#konto');
  await p.waitForTimeout(400);
  await p.click('.card:has-text("Zwei-Faktor") >> text=Einrichten');
  await p.waitForTimeout(400);
  ok(!!(await p.$('.card:has-text("Zwei-Faktor") .reveal')), 'Mein Konto: Zwei-Faktor-Schlüssel wird angezeigt');
  ok(!!(await p.$('.card:has-text("Discord") >> text=Discord verknüpfen')), 'Mein Konto: Discord verknüpfen');
  await p.screenshot({ path: 'shots/konto.png' });
  await p.goto(BASE + '/#firma');
  await p.waitForTimeout(400);
  await p.click('.card:has-text("Spielserver") >> text=+ Schlüssel');
  await p.fill('#ff-name', 'FiveM Browser-Test');
  await p.click('.modal button[type=submit]');
  await p.waitForTimeout(700);
  ok(!!(await p.$('.drawer .reveal:has-text("pg_")')), 'Firmendaten: Spielserver-Schlüssel erstellt');
  await p.screenshot({ path: 'shots/spielserver.png' });
  await p.click('.drawer button[aria-label="Schließen"]');

  await p.setViewportSize({ width: 390, height: 844 });
  for (const pg of ['annahme', 'hallenplan', 'finanzen', 'nachrichten', 'telemetrie']) {
    await p.goto(BASE + '/#' + pg);
    await p.waitForTimeout(350);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `Handy ${pg}: kein seitliches Scrollen`);
  }

  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(BASE + '/#auftraege');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/mobil.png' });
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'Handy: kein seitliches Scrollen');
  ok(!errors.length, `Konsole ohne Fehler ${errors.join(' | ')}`);
  await b.close();
  console.log(fails ? `\n${fails} Fehler` : '\nAlles grün');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
