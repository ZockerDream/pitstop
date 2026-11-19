// Drehbuch Echtbetrieb (CONCEPT.md 13.2, Schritte 1–8). Braucht einen FRISCHEN Stack mit DEMO_MODE=false
// und IMPRESSUM_NAME="Test Haustechnik GmbH"; Zugangsdaten des ersten Admins über ADMIN_EMAIL/ADMIN_PASSWORD.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8091';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'chefin@test.example';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Startpasswort-123';
const OUT = '/work/shots/echtbetrieb';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
  const p = await ctx.newPage();
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`[${m.type()}] ${m.text()}`));
  p.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  return p;
};
const admin = await newPage();
let failures = 0;
const step = async (name, page, fn) => {
  try {
    await fn();
    console.log('OK   ', name);
  } catch (e) {
    failures++;
    console.log('FAIL ', name, '→', e.message.split('\n')[0]);
    await page.screenshot({ path: `${OUT}/fail-${name.replace(/[^a-z0-9]+/gi, '-')}.png` });
    for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  }
};
const toast = (page, text) => page.locator('[aria-live="polite"]').getByText(text).first().waitFor({ timeout: 5000 });

await step('1 Anmeldeseite ohne Demo, Impressum, Datenschutz-Hinweis', admin, async () => {
  await admin.goto(BASE);
  await admin.getByRole('heading', { name: 'Anmelden' }).waitFor();
  if (await admin.getByText('Als Admin ansehen').count()) throw new Error('Demo-Knöpfe sichtbar');
  await admin.screenshot({ path: `${OUT}/01-login.png` });
  await admin.getByRole('link', { name: 'Impressum' }).click();
  await admin.getByText('Test Haustechnik GmbH').waitFor();
  await admin.goto(`${BASE}/#/datenschutz`);
  await admin.getByText('Datenschutzerklärung fehlt noch').waitFor();
});

await step('2 Admin aus .env, Pflicht-Passwortwechsel, Erste Schritte', admin, async () => {
  await admin.goto(`${BASE}/#/dashboard`);
  await admin.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await admin.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await admin.getByRole('button', { name: 'Anmelden' }).click();
  await admin.getByRole('heading', { name: 'Neues Passwort festlegen' }).waitFor();
  await admin.getByLabel('Bisheriges Passwort').fill(ADMIN_PASSWORD);
  await admin.getByLabel('Neues Passwort', { exact: true }).fill('Chefin-Passwort-2026');
  await admin.getByLabel('Neues Passwort wiederholen').fill('Chefin-Passwort-2026');
  await admin.getByRole('button', { name: 'Passwort speichern' }).click();
  await admin.getByText('Erste Schritte').waitFor();
  await admin.screenshot({ path: `${OUT}/02-erste-schritte.png` });
});

await step('3 Firmendaten eintragen', admin, async () => {
  await admin.getByRole('button', { name: 'Firmendaten eintragen' }).click();
  await admin.getByLabel('Firmenname').fill('Test Haustechnik GmbH');
  await admin.getByLabel('Straße und Hausnummer').fill('Musterweg 1');
  await admin.getByLabel('PLZ').fill('93047');
  await admin.getByLabel('Ort').fill('Regensburg');
  await admin.getByLabel('IBAN').fill('DE89 3704 0044 0532 0130 00');
  await admin.getByRole('button', { name: 'Speichern' }).click();
  await toast(admin, 'Firmendaten gespeichert');
  await admin.locator('aside, .bg-zinc-950').getByText('Test Haustechnik GmbH').first().waitFor();
});

let startPassword = '';
await step('4 Mitarbeiter und Zugang anlegen', admin, async () => {
  await admin.getByRole('button', { name: 'Neu' }).click();
  await admin.getByRole('menuitem', { name: 'Mitarbeiter' }).click();
  const m = admin.getByRole('dialog', { name: 'Neuer Mitarbeiter' });
  await m.getByLabel('Vorname').fill('Erika');
  await m.getByLabel('Nachname').fill('Beispiel');
  await m.getByLabel('Stundensatz (€)').fill('25,00');
  await m.getByRole('button', { name: 'Mitarbeiter anlegen' }).click();
  await toast(admin, 'Erika Beispiel angelegt');
  await admin.goto(`${BASE}/#/einstellungen/benutzer`);
  await admin.getByRole('button', { name: 'Zugang anlegen' }).click();
  const u = admin.getByRole('dialog', { name: 'Zugang anlegen' });
  await u.getByLabel('Mitarbeiter').selectOption({ label: 'Erika Beispiel' });
  await u.getByLabel('E-Mail (Anmeldename)').fill('erika@test.example');
  await u.getByRole('button', { name: 'Zugang anlegen' }).click();
  const reveal = admin.getByRole('dialog', { name: 'Zugang angelegt' });
  startPassword = (await reveal.locator('code').textContent()).trim();
  await admin.screenshot({ path: `${OUT}/03-startpasswort.png` });
  await reveal.getByRole('button', { name: 'Fertig' }).click();
  if (startPassword.length !== 16) throw new Error(`Startpasswort unerwartet: ${startPassword}`);
});

await step('5 Kunde und Rechnung, Vorschau mit Firmendaten', admin, async () => {
  await admin.getByRole('button', { name: 'Neu' }).click();
  await admin.getByRole('menuitem', { name: 'Kunde' }).click();
  const k = admin.getByRole('dialog', { name: 'Neuer Kunde' });
  await k.getByLabel('Name').first().fill('Muster GmbH');
  await k.getByLabel('Kundenart').selectOption('business');
  await k.getByLabel('Status').selectOption('active');
  await k.getByLabel('PLZ').fill('93053');
  await k.getByLabel('Ort').fill('Regensburg');
  await k.getByRole('button', { name: 'Kunde anlegen' }).click();
  await admin.getByRole('dialog').getByRole('heading', { name: 'Muster GmbH' }).waitFor();
  await admin.getByRole('button', { name: 'Rechnung erstellen' }).click();
  const r = admin.getByRole('dialog', { name: 'Neue Rechnung' });
  await r.getByLabel('Vorlage einfügen').selectOption('inspection');
  await r.getByRole('button', { name: 'Rechnung erstellen' }).click();
  await admin.locator('[aria-live="polite"]').getByText(/Rechnung #1001 erstellt/).waitFor();
  await admin.goto(`${BASE}/#/finanzen/rechnungen`);
  await admin.locator('tr', { hasText: '#1001' }).click();
  await admin.getByRole('dialog').getByText(/IBAN DE89 3704/).waitFor();
  await admin.screenshot({ path: `${OUT}/04-rechnung.png` });
  await admin.keyboard.press('Escape');
});

const erika = await newPage();
await step('6 Mitarbeiterin: Passwortwechsel, keine Finanzen, Urlaub beantragen', erika, async () => {
  await erika.goto(BASE);
  await erika.getByLabel('E-Mail').fill('erika@test.example');
  await erika.getByLabel('Passwort').fill(startPassword);
  await erika.getByRole('button', { name: 'Anmelden' }).click();
  await erika.getByRole('heading', { name: 'Neues Passwort festlegen' }).waitFor();
  await erika.getByLabel('Bisheriges Passwort').fill(startPassword);
  await erika.getByLabel('Neues Passwort', { exact: true }).fill('Erikas-Passwort-2026');
  await erika.getByLabel('Neues Passwort wiederholen').fill('Erikas-Passwort-2026');
  await erika.getByRole('button', { name: 'Passwort speichern' }).click();
  await erika.getByText('Mein Resturlaub').waitFor();
  if (await erika.locator('nav').getByText('Finanzen').count()) throw new Error('Finanzen sichtbar');
  const boot = await erika.evaluate(async () => (await fetch('/api/bootstrap')).json());
  if (boot.invoices.length !== 0 || boot.expenses.length !== 0 || boot.users.length !== 0) throw new Error('Bootstrap enthält Finanz- oder Benutzerdaten');
  const status = await erika.evaluate(async () => (await fetch('/api/invoices/00000000-0000-0000-0000-000000000000/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status);
  if (status !== 403) throw new Error(`Finanz-Route liefert ${status} statt 403`);
  await erika.getByRole('button', { name: 'Neu' }).click();
  await erika.getByRole('menuitem', { name: 'Urlaubsantrag' }).click();
  await erika.getByRole('dialog', { name: 'Urlaub beantragen' }).getByRole('button', { name: 'Antrag stellen' }).click();
  await toast(erika, 'Urlaubsantrag gestellt');
  await erika.screenshot({ path: `${OUT}/05-mitarbeiterin.png` });
});

await step('7 Admin genehmigt, Mitarbeiterin sieht Hinweis', admin, async () => {
  await admin.goto(`${BASE}/#/dashboard`);
  await admin.reload();
  const row = admin.locator('li', { hasText: 'Urlaubsantrag von Erika Beispiel genehmigen' });
  await row.getByRole('button', { name: 'Genehmigen' }).click();
  await toast(admin, 'Urlaubsantrag genehmigt');
  await erika.reload();
  await erika.getByText(/Dein Urlaubsantrag .* wurde genehmigt/).waitFor();
});

await step('8 Admin sperrt Zugang, Mitarbeiterin fliegt raus', admin, async () => {
  await admin.goto(`${BASE}/#/einstellungen/benutzer`);
  await admin.getByRole('button', { name: 'Aktionen für Erika Beispiel' }).click();
  await admin.getByRole('menuitem', { name: 'Sperren' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Sperren' }).click();
  await toast(admin, 'Erika Beispiel gesperrt');
  await erika.goto(`${BASE}/#/kunden`);
  await erika.reload();
  await erika.getByRole('heading', { name: 'Anmelden' }).waitFor();
});

await browser.close();
console.log(`\n${failures} Fehler`);
console.log(problems.length ? `Konsole:\n${[...new Set(problems)].join('\n')}` : 'Konsole: keine Fehler/Warnungen');
process.exitCode = failures ? 1 : 0;
