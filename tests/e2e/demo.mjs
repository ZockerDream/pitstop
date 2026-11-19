// Demo-Drehbuch (CONCEPT.md 13.1) automatisiert, mit Screenshots.
// Braucht DEMO_MODE=true und frisch zurückgesetzte Demo-Daten (Benutzermenü → „Demo-Daten zurücksetzen“).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = '/work/shots/demo';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
let failures = 0;
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const step = async (name, fn) => {
  try {
    await fn();
    console.log('OK   ', name);
  } catch (e) {
    failures++;
    console.log('FAIL ', name, '→', e.message.split('\n')[0]);
    await shot(`fail-${name.replace(/[^a-z0-9]+/gi, '-')}`);
    for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  }
};
const toast = (text) => page.locator('[aria-live="polite"]').getByText(text).first().waitFor({ timeout: 5000 });
const userMenu = () => page.locator('header button[aria-haspopup="menu"]').last();

await page.goto(BASE);
await page.getByRole('heading', { name: 'Anmelden' }).waitFor();
await shot('01-login');

await step('1 Demo-Login als Admin, Dashboard mit KPIs und Aufgaben', async () => {
  await page.getByRole('button', { name: /Als Admin ansehen/ }).click();
  await page.getByText('Aufgaben & Freigaben').waitFor();
  await page.getByText('Urlaubsantrag von Max Mustermann genehmigen').waitFor();
  await page.getByText('Überfällige Rechnung #1042 mahnen').waitFor();
  await page.locator('.recharts-bar-rectangle').first().waitFor();
});
await page.waitForTimeout(600);
await shot('02-dashboard-admin');

await step('2 Urlaub Max genehmigen', async () => {
  const row = page.locator('li', { hasText: 'Urlaubsantrag von Max Mustermann genehmigen' });
  await row.getByRole('button', { name: 'Genehmigen' }).click();
  await toast('Urlaubsantrag genehmigt');
  await row.waitFor({ state: 'detached' });
});

await step('3 Rechnung #1042 mahnen', async () => {
  const row = page.locator('li', { hasText: 'Überfällige Rechnung #1042 mahnen' });
  await row.getByRole('button', { name: 'Mahnen' }).click();
  await toast('Mahnung Stufe 1 zu #1042');
  await row.waitFor({ state: 'detached' });
});
await shot('03-dashboard-nach-aktionen');

await step('4 Strg+K „Sommer“, Drawer, Anruf-Notiz', async () => {
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Suche und Aktionen' }).getByRole('textbox').fill('Sommer');
  await page.waitForTimeout(200);
  await shot('04-befehlspalette');
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('heading', { name: 'Mietwagen Sommer & Partner GmbH' }).waitFor();
  await shot('05-kunden-drawer');
  await drawer.getByRole('button', { name: 'Notiz', exact: true }).first().click();
  await drawer.getByText(/Mahnung Stufe 1 zu Rechnung #1042/).waitFor();
  await drawer.locator('button[aria-pressed]', { hasText: 'Anruf' }).click();
  await drawer.getByLabel('Neuer Eintrag').fill('Rückruf Frau Sommer: Zahlung der Rechnung #1042 bis Freitag zugesagt.');
  await drawer.getByRole('button', { name: 'Speichern' }).click();
  await toast('Eintrag gespeichert');
  await drawer.getByText('Rückruf Frau Sommer').waitFor();
  await shot('06-historie');
});

await step('4b Suche nach Kennzeichen öffnet den Kunden, Tab Fahrzeuge', async () => {
  await page.keyboard.press('Escape');
  const boot = await page.evaluate(async () => (await fetch('/api/bootstrap')).json());
  const owner = boot.customers.find((c) => c.name === 'Martin Brandstetter');
  const plate = boot.vehicles.find((v) => v.customerId === owner.id).plate;
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Suche und Aktionen' }).getByRole('textbox').fill(plate.replace(/[\s-]/g, '').toLowerCase());
  await page.getByRole('option', { name: new RegExp(plate) }).first().waitFor();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('heading', { name: 'Martin Brandstetter' }).waitFor();
  await drawer.getByRole('tab', { name: /Fahrzeuge/ }).click();
  await drawer.getByText('BMW M3 Competition xDrive').waitFor();
  await shot('06b-fahrzeuge');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Suche und Aktionen' }).getByRole('textbox').fill('Sommer');
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('heading', { name: 'Mietwagen Sommer & Partner GmbH' }).waitFor();
});

let invoiceNumber = null;
await step('5 Rechnung aus dem Drawer: Fahrzeug, Vorlage + 2,5 Std., Summen prüfen', async () => {
  await page.getByRole('button', { name: 'Rechnung erstellen' }).click();
  const modal = page.getByRole('dialog', { name: 'Neue Rechnung' });
  await modal.waitFor();
  const customerValue = await modal.locator('input[role="combobox"]').inputValue();
  if (!customerValue.includes('Sommer')) throw new Error(`Kunde nicht vorausgewählt: „${customerValue}“`);
  await modal.getByLabel('Fahrzeug').selectOption({ index: 1 });
  await modal.getByLabel('km-Stand bei Auftrag').waitFor();
  await modal.getByLabel('Vorlage einfügen').selectOption('tires');
  await modal.getByRole('button', { name: 'Position hinzufügen' }).click();
  await modal.getByLabel('Beschreibung Position 2').fill('Arbeitszeit Kfz-Mechatroniker');
  await modal.getByLabel('Menge Position 2').fill('2,5');
  await modal.getByLabel('Einzelpreis Position 2').fill('112,00');
  await modal.getByText(/403,41/).waitFor(); // 59 + 280 = 339,00 netto + 64,41 MwSt.
  await modal.getByText(/64,41/).waitFor();
  await shot('07-neue-rechnung');
  await modal.getByRole('button', { name: 'Rechnung erstellen' }).click();
  const t = page.locator('[aria-live="polite"]').getByText(/Rechnung #\d+ erstellt/).first();
  await t.waitFor();
  invoiceNumber = (await t.textContent()).match(/#(\d+)/)[1];
  await page.getByRole('dialog').getByRole('tab', { name: /Rechnungen/ }).click();
  await page.getByRole('dialog').getByText(`#${invoiceNumber}`).waitFor();
  await shot('08-drawer-rechnungen');
});

await step('5b Rechnung in Finanzen als Offen, Vorschau', async () => {
  await page.goto(`${BASE}/#/finanzen/rechnungen`);
  const row = page.locator('tr', { hasText: `#${invoiceNumber}` });
  await row.getByText('Offen').waitFor();
  await row.click();
  await page.getByRole('dialog').getByText('Rechnungsbetrag').waitFor();
  await page.getByRole('dialog').getByText(/403,41/).first().waitFor();
  await page.getByRole('dialog').getByText('Kennzeichen').waitFor();
  await shot('09-rechnungsvorschau');
  await page.keyboard.press('Escape');
});

await step('5c #1042 zeigt M1, Liste', async () => {
  await page.goto(`${BASE}/#/finanzen/rechnungen`);
  const row = page.locator('tr', { hasText: '#1042' });
  await row.getByText('M1').waitFor();
  await shot('10-rechnungsliste');
});

await step('6 Ausgabe anlegen', async () => {
  await page.goto(`${BASE}/#/finanzen/ausgaben`);
  await page.getByRole('button', { name: 'Neue Ausgabe' }).click();
  const modal = page.getByRole('dialog', { name: 'Neue Ausgabe' });
  await modal.getByLabel('Lieferant').fill('Großhandel Test KG');
  await modal.getByLabel('Betrag netto').fill('1.234,56');
  await modal.getByText(/Brutto: 1\.469,13/).waitFor();
  await modal.getByRole('button', { name: 'Ausgabe erfassen' }).click();
  await toast('Ausgabe „Großhandel Test KG“ erfasst');
  await page.locator('tr', { hasText: 'Großhandel Test KG' }).waitFor();
  await shot('11-ausgaben');
});

await step('7 Neuer Kunde als Lead, Filter Lead', async () => {
  await page.goto(`${BASE}/#/kunden`);
  await page.getByRole('button', { name: 'Neuer Kunde' }).click();
  const modal = page.getByRole('dialog', { name: 'Neuer Kunde' });
  await modal.getByLabel('Name').first().fill('Familie Testkunde');
  await modal.getByLabel('PLZ').fill('93047');
  await modal.getByLabel('Ort').fill('Regensburg');
  await modal.getByRole('button', { name: 'Kunde anlegen' }).click();
  await toast('Kunde „Familie Testkunde“ angelegt');
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('heading', { name: 'Familie Testkunde' }).waitFor();
  await drawer.getByRole('tab', { name: /Fahrzeuge/ }).click();
  await drawer.getByRole('button', { name: 'Fahrzeug hinzufügen' }).click();
  const v = page.getByRole('dialog', { name: 'Fahrzeug hinzufügen' });
  await v.getByLabel('Kennzeichen').fill('R-TK 911');
  await v.getByLabel('Marke').fill('Porsche');
  await v.getByLabel('Modell').fill('Cayman');
  await v.getByLabel('Leistung (kW)').fill('220');
  await v.getByRole('button', { name: 'Fahrzeug anlegen' }).click();
  await toast('Fahrzeug R-TK 911 angelegt');
  await drawer.getByText('Porsche Cayman').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('button[aria-pressed]', { hasText: 'Lead' }).click();
  await page.locator('tr', { hasText: 'Familie Testkunde' }).waitFor();
  await shot('12-kunden-leads');
});

await step('8 Als Mitarbeiter ansehen: kein Finanzen, Antrag stellen', async () => {
  await userMenu().click();
  await page.getByRole('menuitem', { name: 'Als Mitarbeiter ansehen' }).click();
  await page.getByText('Mein Resturlaub').waitFor();
  if (await page.locator('nav').getByText('Finanzen').count()) throw new Error('Finanzen in der Seitenleiste sichtbar');
  await page.getByText(/Dein Urlaubsantrag .* wurde genehmigt/).waitFor();
  await shot('13-dashboard-mitarbeiter');
  await page.goto(`${BASE}/#/finanzen`);
  await page.getByText('Kein Zugriff').waitFor();
  await shot('14-kein-zugriff');
  await page.goto(`${BASE}/#/personal`);
  await page.getByText('Stundensatz').first().waitFor({ state: 'detached', timeout: 1500 }).catch(() => {
    throw new Error('Stundensatz für Mitarbeiter sichtbar');
  });
  await page.getByRole('button', { name: 'Neu' }).click();
  await page.getByRole('menuitem', { name: 'Urlaubsantrag' }).click();
  const modal = page.getByRole('dialog', { name: 'Urlaub beantragen' });
  await modal.getByLabel('Kommentar').fill('Kurzurlaub');
  await shot('15-urlaubsantrag');
  await modal.getByRole('button', { name: 'Antrag stellen' }).click();
  await toast('Urlaubsantrag gestellt');
});

await step('9 Zurück zu Admin, Antrag von Jonas ablehnen', async () => {
  await page.goto(`${BASE}/#/dashboard`);
  await userMenu().click();
  await page.getByRole('menuitem', { name: 'Als Admin ansehen' }).click();
  const row = page.locator('li', { hasText: 'Urlaubsantrag von Jonas Weber genehmigen' });
  await row.waitFor();
  await row.getByRole('button', { name: 'Ablehnen' }).click();
  const dlg = page.getByRole('dialog', { name: 'Urlaubsantrag ablehnen?' });
  await dlg.getByRole('textbox').fill('Projektabschluss Kreisklinik, bitte eine Woche später.');
  await dlg.getByRole('button', { name: 'Ablehnen' }).click();
  await toast('Urlaubsantrag abgelehnt');
  await row.waitFor({ state: 'detached' });
});

await step('10 Neu laden: Daten bleiben', async () => {
  await page.reload();
  await page.getByText('Aufgaben & Freigaben').waitFor();
  if (await page.getByText('Urlaubsantrag von Max Mustermann genehmigen').count()) throw new Error('Genehmigung nach Reload verloren');
  await page.goto(`${BASE}/#/finanzen/rechnungen`);
  await page.locator('tr', { hasText: '#1042' }).getByText('M1').waitFor();
});

// Weitere Ansichten für die Sichtprüfung
await step('Ansichten: Personal, Akte, Urlaub, Einstellungen, Impressum', async () => {
  await page.goto(`${BASE}/#/personal`);
  await page.getByText('Max Mustermann').first().waitFor();
  await shot('16-personal');
  await page.getByText('Max Mustermann').first().click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Urlaub' }).click();
  await page.getByRole('dialog').getByText(/Resturlaub/).first().waitFor();
  await shot('17-personalakte-urlaub');
  await page.getByRole('dialog').getByRole('tab', { name: 'Stunden' }).click();
  await page.waitForTimeout(400);
  await shot('18-personalakte-stunden');
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/#/personal/urlaub`);
  await page.waitForTimeout(300);
  await shot('19-urlaub');
  await page.goto(`${BASE}/#/kunden`);
  await page.waitForTimeout(300);
  await shot('20-kunden');
  await page.goto(`${BASE}/#/einstellungen/benutzer`);
  await page.getByText('Zugang anlegen').waitFor();
  await shot('21-benutzer');
  await page.goto(`${BASE}/#/einstellungen/firma`);
  await page.waitForTimeout(300);
  await shot('22-firmendaten');
  await page.goto(`${BASE}/#/impressum`);
  await page.getByRole('heading', { name: 'Impressum' }).waitFor();
  await shot('23-impressum');
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto(`${BASE}/#/dashboard`);
  await page.getByText('Aufgaben & Freigaben').waitFor();
  await page.waitForTimeout(500);
  await shot('24-tablet-dashboard');
});

await browser.close();
console.log(`\n${failures} Fehler im Drehbuch`);
console.log(problems.length ? `Konsole:\n${[...new Set(problems)].join('\n')}` : 'Konsole: keine Fehler/Warnungen');
process.exitCode = failures ? 1 : 0;
