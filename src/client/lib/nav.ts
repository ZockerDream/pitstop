// Seiten der App mit Gruppe, Symbol und dem Bereich, der sie freischaltet (shared/permissions.ts).
import type { Area, ModuleId } from '../../shared/permissions';

export interface PageDef {
  id: string;
  label: string;
  icon: string;
  group: string;
  /** Bereich, der mindestens „Sehen“ braucht; fehlt = jede Person in der Firma. */
  area?: Area;
  module?: ModuleId;
  /** Server-Seiten: nur für Server-Admins, ohne Firmenkontext. */
  server?: boolean;
  /** Persönliche Seiten: unabhängig von der Firma. */
  personal?: boolean;
  /** Braucht „Bearbeiten“ im Bereich (z. B. Annahme legt Aufträge an). */
  write?: boolean;
}

export const PAGES: PageDef[] = [
  { id: 'cockpit', label: 'Cockpit', icon: 'gauge', group: 'Übersicht' },
  { id: 'feed', label: 'Live-Feed', icon: 'pulse', group: 'Übersicht' },
  { id: 'kalender', label: 'Kalender', icon: 'cal', group: 'Übersicht' },
  { id: 'auftraege', label: 'Auftragstafel', icon: 'kanban', group: 'Werkstatt', area: 'auftraege', module: 'werkstatt' },
  { id: 'annahme', label: 'Fahrzeugannahme', icon: 'clip', group: 'Werkstatt', area: 'auftraege', module: 'werkstatt', write: true },
  { id: 'hallenplan', label: 'Hallenplan', icon: 'grid', group: 'Werkstatt', area: 'hallenplan', module: 'werkstatt' },
  { id: 'lager', label: 'Lager & Bestellungen', icon: 'box', group: 'Werkstatt', area: 'lager', module: 'werkstatt' },
  { id: 'werkzeug', label: 'Werkzeug', icon: 'wrench', group: 'Werkstatt', area: 'werkzeug', module: 'werkstatt' },
  { id: 'leitstelle', label: 'Leitstelle', icon: 'radar', group: 'Abschleppdienst', area: 'leitstelle', module: 'abschlepp' },
  { id: 'einsaetze', label: 'Einsätze', icon: 'truck', group: 'Abschleppdienst', area: 'leitstelle', module: 'abschlepp' },
  { id: 'fuhrpark', label: 'Fuhrpark', icon: 'car', group: 'Abschleppdienst', area: 'fuhrpark', module: 'abschlepp' },
  { id: 'konfigurator', label: 'Konfigurator', icon: 'sliders', group: 'Tuning', area: 'tuning', module: 'tuning' },
  { id: 'pruefstand', label: 'Prüfstand', icon: 'gauge', group: 'Tuning', area: 'tuning', module: 'tuning' },
  { id: 'builds', label: 'Builds & Showcars', icon: 'star', group: 'Tuning', area: 'tuning', module: 'tuning' },
  { id: 'pakete', label: 'Pakete & Preise', icon: 'tag', group: 'Tuning', area: 'tuning', module: 'tuning' },
  { id: 'rennkalender', label: 'Rennkalender', icon: 'flag', group: 'Racing', area: 'racing', module: 'racing' },
  { id: 'team', label: 'Team & Rennwagen', icon: 'helmet', group: 'Racing', area: 'racing', module: 'racing' },
  { id: 'telemetrie', label: 'Setups & Telemetrie', icon: 'chart', group: 'Racing', area: 'racing', module: 'racing' },
  { id: 'bestenliste', label: 'Bestenlisten', icon: 'trophy', group: 'Racing', area: 'racing', module: 'racing' },
  { id: 'trackdays', label: 'Kunden-Trackdays', icon: 'ticket', group: 'Racing', area: 'racing', module: 'racing' },
  { id: 'kunden', label: 'Kundenakten', icon: 'folder', group: 'Kunden', area: 'kunden', module: 'kunden' },
  { id: 'fahrzeuge', label: 'Fahrzeugakten', icon: 'car', group: 'Kunden', area: 'fahrzeuge', module: 'kunden' },
  { id: 'vertraege', label: 'Rahmenverträge', icon: 'doc', group: 'Kunden', area: 'vertraege', module: 'kunden' },
  { id: 'nachrichten', label: 'Nachrichten', icon: 'chat', group: 'Kunden', area: 'nachrichten', module: 'kunden' },
  { id: 'mitarbeiter', label: 'Mitarbeiter', icon: 'users', group: 'Personal', area: 'mitarbeiter', module: 'personal' },
  { id: 'dienstzeiten', label: 'Dienstzeiten', icon: 'clock', group: 'Personal', area: 'dienstzeiten', module: 'personal' },
  { id: 'dienstplan', label: 'Dienstplan', icon: 'cal', group: 'Personal', area: 'dienstplan', module: 'personal' },
  { id: 'lohn', label: 'Lohn & Provision', icon: 'cash', group: 'Personal', area: 'lohn', module: 'personal' },
  { id: 'raenge', label: 'Ränge', icon: 'badge', group: 'Personal', area: 'raenge', module: 'personal' },
  { id: 'bewerbungen', label: 'Bewerbungen', icon: 'inbox', group: 'Personal', area: 'bewerbungen', module: 'personal' },
  { id: 'lernen', label: 'Mein Lernen', icon: 'book', group: 'Schulungen', module: 'schulungen' },
  { id: 'kurse', label: 'Kurse', icon: 'list', group: 'Schulungen', area: 'schulungen', module: 'schulungen' },
  { id: 'pruefungen', label: 'Prüfungen & Termine', icon: 'clip', group: 'Schulungen', module: 'schulungen' },
  { id: 'nachweise', label: 'Nachweise & Lizenzen', icon: 'badge', group: 'Schulungen', area: 'schulungen', module: 'schulungen' },
  { id: 'finanzen', label: 'Übersicht', icon: 'coins', group: 'Finanzen', area: 'buchungen', module: 'finanzen' },
  { id: 'rechnungen', label: 'Rechnungen & Angebote', icon: 'file', group: 'Finanzen', area: 'rechnungen', module: 'finanzen' },
  { id: 'buchungen', label: 'Buchungen', icon: 'list', group: 'Finanzen', area: 'buchungen', module: 'finanzen' },
  { id: 'kasse', label: 'Kasse', icon: 'register', group: 'Finanzen', area: 'buchungen', module: 'finanzen' },
  { id: 'auswertung', label: 'Auswertung', icon: 'pie', group: 'Finanzen', area: 'buchungen', module: 'finanzen' },
  { id: 'firma', label: 'Firmendaten', icon: 'building', group: 'Firma', area: 'firma' },
  { id: 'zugaenge', label: 'Mitglieder & Zugänge', icon: 'users', group: 'Firma', area: 'zugaenge' },
  { id: 'gruppen', label: 'Gruppen & Rechte', icon: 'shield', group: 'Firma', area: 'gruppen' },
  { id: 'preisliste', label: 'Preisliste', icon: 'tag', group: 'Firma', area: 'preisliste' },
  { id: 'regelwerk', label: 'Regelwerk', icon: 'book', group: 'Firma', area: 'regelwerk' },
  { id: 'pinnwand', label: 'Pinnwand', icon: 'pin', group: 'Firma', area: 'pinnwand' },
  { id: 'module', label: 'Module', icon: 'puzzle', group: 'Firma', area: 'module' },
  { id: 'protokoll', label: 'Protokoll', icon: 'history', group: 'Firma', area: 'protokoll' },
  { id: 'konto', label: 'Mein Konto', icon: 'user', group: 'Persönlich', personal: true },
  { id: 'darstellung', label: 'Darstellung', icon: 'palette', group: 'Persönlich', personal: true },
  { id: 'neuigkeiten', label: 'Neuigkeiten', icon: 'star', group: 'Persönlich', personal: true },
  { id: 'srv', label: 'Server-Übersicht', icon: 'server', group: 'Server', server: true },
  { id: 'srv-firmen', label: 'Firmen', icon: 'building', group: 'Server', server: true },
  { id: 'srv-konten', label: 'Benutzerkonten', icon: 'users', group: 'Server', server: true },
  { id: 'srv-backup', label: 'Sicherungen', icon: 'history', group: 'Server', server: true },
  { id: 'srv-export', label: 'Export', icon: 'file', group: 'Server', server: true },
  { id: 'srv-anbind', label: 'Anbindungen', icon: 'plug', group: 'Server', server: true },
  { id: 'srv-einst', label: 'Einstellungen', icon: 'sliders', group: 'Server', server: true },
  { id: 'srv-log', label: 'Server-Protokoll', icon: 'list', group: 'Server', server: true },
];

/** Benannte Arbeitsflächen des Kontos (prefs.boards) als zusätzliche Seiten. */
let boardPages: PageDef[] = [];
export function setBoards(boards: { id: string; name: string }[]): void {
  boardPages = boards.map((b) => ({ id: b.id, label: b.name, icon: 'grid', group: 'Arbeitsflächen' }));
}
export const boardList = () => boardPages;

export const pageById = (id: string) => PAGES.find((p) => p.id === id) ?? boardPages.find((p) => p.id === id);
export const SKINS: [string, string, string, [string, string, string]][] = [
  ['auto', 'Automatisch', 'Folgt hell/dunkel des Geräts', ['#0b0d11', '#151920', '#ff7a1a']],
  ['boxengasse', 'Boxengasse', 'Graphit mit Signalorange', ['#0b0d11', '#151920', '#ff7a1a']],
  ['nacht', 'Nachtrennen', 'Tiefblau mit Neon-Cyan', ['#070a14', '#0f1528', '#3be2ff']],
  ['racinggreen', 'Racing Green', 'Dunkelgrün mit Gold', ['#08110d', '#102019', '#d9b45a']],
  ['hell', 'Werkstatt hell', 'Hell, ruhig, Orange', ['#eef0f3', '#ffffff', '#e85f00']],
  ['lemans', 'Le Mans', 'Himmelblau mit Orange', ['#e9f2f8', '#fbfdff', '#f05f0c']],
];
