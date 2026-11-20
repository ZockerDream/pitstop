// Rechtemodell der Firma (CONCEPT.md Abschnitt 3): Bereiche mit Stufen, Sonderrechte, Gruppen, Ausnahmen.
// Der Server prüft damit jede Route (auth/guards.ts), die Oberfläche blendet nur zusätzlich aus.

/** Stufe je Bereich: x = gesperrt, 0 = nicht gesetzt, 1 = sehen, 2 = bearbeiten, 3 = verwalten. */
export type Level = 'x' | '0' | '1' | '2' | '3';
export const LEVELS: Level[] = ['x', '0', '1', '2', '3'];
export const LEVEL_LABEL: Record<Level, string> = { x: 'Gesperrt', 0: '–', 1: 'Sehen', 2: 'Bearbeiten', 3: 'Verwalten' };

export type ModuleId = 'werkstatt' | 'abschlepp' | 'tuning' | 'racing' | 'kunden' | 'personal' | 'schulungen' | 'finanzen' | 'firma';
export const MODULES: { id: ModuleId; name: string; desc: string; optional: boolean }[] = [
  { id: 'werkstatt', name: 'Werkstatt', desc: 'Auftragstafel mit Status, Zuteilung und Fortschritt; Lager.', optional: true },
  { id: 'abschlepp', name: 'Abschleppdienst', desc: 'Leitstelle mit Karte und Einsätze.', optional: true },
  { id: 'tuning', name: 'Tuning', desc: 'Konfigurator, Pakete und Preise, Prüfstand, Builds.', optional: true },
  { id: 'racing', name: 'Racing', desc: 'Rennkalender, Starter, Rundenzeiten und Bestenliste, Kunden-Trackdays.', optional: true },
  { id: 'kunden', name: 'Kunden', desc: 'Kundenakten und Fahrzeuge.', optional: true },
  { id: 'personal', name: 'Personal', desc: 'Mitarbeiter, Stempeluhr, Dienstplan, Lohn und Provision.', optional: true },
  { id: 'schulungen', name: 'Schulungen', desc: 'Kurse mit Lektionen und Test, Praxisprüfung, Nachweise mit Ablaufdatum.', optional: true },
  { id: 'finanzen', name: 'Finanzen', desc: 'Rechnungen, Buchungen und Kasse.', optional: true },
  { id: 'firma', name: 'Firma', desc: 'Firmendaten, Mitglieder, Gruppen und Rechte.', optional: false },
];

export type Area =
  | 'auftraege'
  | 'lager'
  | 'hallenplan'
  | 'werkzeug'
  | 'leitstelle'
  | 'fuhrpark'
  | 'tuning'
  | 'racing'
  | 'kunden'
  | 'fahrzeuge'
  | 'vertraege'
  | 'nachrichten'
  | 'mitarbeiter'
  | 'dienstzeiten'
  | 'dienstplan'
  | 'lohn'
  | 'raenge'
  | 'bewerbungen'
  | 'schulungen'
  | 'rechnungen'
  | 'buchungen'
  | 'firma'
  | 'zugaenge'
  | 'gruppen'
  | 'module'
  | 'preisliste'
  | 'regelwerk'
  | 'pinnwand'
  | 'protokoll';

export interface AreaDef {
  id: Area;
  module: ModuleId;
  label: string;
  /** Text für „nur eigene“, wenn der Bereich darauf begrenzt werden kann. */
  own?: string;
}

export const AREAS: AreaDef[] = [
  { id: 'auftraege', module: 'werkstatt', label: 'Auftragstafel', own: 'nur eigene Aufträge' },
  { id: 'lager', module: 'werkstatt', label: 'Lager & Bestellungen' },
  { id: 'hallenplan', module: 'werkstatt', label: 'Hallenplan' },
  { id: 'werkzeug', module: 'werkstatt', label: 'Werkzeug' },
  { id: 'leitstelle', module: 'abschlepp', label: 'Leitstelle & Einsätze', own: 'nur eigene Einsätze' },
  { id: 'fuhrpark', module: 'abschlepp', label: 'Fuhrpark' },
  { id: 'tuning', module: 'tuning', label: 'Tuning (Konfigurator, Preise, Prüfstand)' },
  { id: 'racing', module: 'racing', label: 'Racing (Events, Team, Setups, Trackdays)' },
  { id: 'kunden', module: 'kunden', label: 'Kundenakten' },
  { id: 'fahrzeuge', module: 'kunden', label: 'Fahrzeuge' },
  { id: 'vertraege', module: 'kunden', label: 'Rahmenverträge' },
  { id: 'nachrichten', module: 'kunden', label: 'Nachrichten an Kunden' },
  { id: 'mitarbeiter', module: 'personal', label: 'Mitarbeiter' },
  { id: 'dienstzeiten', module: 'personal', label: 'Dienstzeiten', own: 'nur eigene Dienstzeiten' },
  { id: 'dienstplan', module: 'personal', label: 'Dienstplan', own: 'nur eigene Schichten' },
  { id: 'lohn', module: 'personal', label: 'Lohn & Provision', own: 'nur eigene Abrechnungen' },
  { id: 'raenge', module: 'personal', label: 'Ränge' },
  { id: 'bewerbungen', module: 'personal', label: 'Bewerbungen' },
  { id: 'schulungen', module: 'schulungen', label: 'Kurse, Termine, Nachweise und Lizenzen aller' },
  { id: 'rechnungen', module: 'finanzen', label: 'Rechnungen', own: 'nur selbst erstellte' },
  { id: 'buchungen', module: 'finanzen', label: 'Konten, Buchungen, Kasse & Auswertung' },
  { id: 'firma', module: 'firma', label: 'Firmendaten' },
  { id: 'zugaenge', module: 'firma', label: 'Mitglieder & Zugänge' },
  { id: 'gruppen', module: 'firma', label: 'Gruppen & Rechte' },
  { id: 'module', module: 'firma', label: 'Module' },
  { id: 'preisliste', module: 'firma', label: 'Preisliste' },
  { id: 'regelwerk', module: 'firma', label: 'Regelwerk' },
  { id: 'pinnwand', module: 'firma', label: 'Pinnwand' },
  { id: 'protokoll', module: 'firma', label: 'Protokoll' },
];
export const AREA_IDS = AREAS.map((a) => a.id);

export type SpecialKey = 'zuteilen' | 'kundensperre' | 'kundenloeschen' | 'storno' | 'auszahlung' | 'lohnzahlung' | 'einladen' | 'export';
export interface SpecialDef {
  key: SpecialKey;
  label: string;
  module: ModuleId;
  /** usd = mit Betragsgrenze in Dollar (Wert in ganzen Dollar). */
  kind: 'bool' | 'usd';
}
export const SPECIALS: SpecialDef[] = [
  { key: 'zuteilen', label: 'Einsätze Fahrern zuteilen', module: 'abschlepp', kind: 'bool' },
  { key: 'kundensperre', label: 'Kunden sperren und entsperren', module: 'kunden', kind: 'bool' },
  { key: 'kundenloeschen', label: 'Kunden endgültig löschen', module: 'kunden', kind: 'bool' },
  { key: 'storno', label: 'Rechnungen stornieren', module: 'finanzen', kind: 'bool' },
  { key: 'auszahlung', label: 'Ausgaben buchen', module: 'finanzen', kind: 'usd' },
  { key: 'lohnzahlung', label: 'Löhne auszahlen', module: 'personal', kind: 'bool' },
  { key: 'einladen', label: 'Leute in die Firma aufnehmen', module: 'firma', kind: 'bool' },
  { key: 'export', label: 'Daten exportieren (CSV)', module: 'firma', kind: 'bool' },
];

export interface GroupRights {
  isOwner: boolean;
  levels: Partial<Record<string, Level>>;
  own: Partial<Record<string, boolean>>;
  specials: Partial<Record<string, boolean | number>>;
}
export interface ExceptionRight {
  area: string;
  level: Level;
  until: string | null;
}

/** Effektives Recht eines Bereichs: Stufe 0–3 (0 = kein Zugriff), ob gesperrt, ob nur eigene, und woher. */
export interface AreaRight {
  level: number;
  locked: boolean;
  own: boolean;
  source: string;
}
export interface Rights {
  owner: boolean;
  /** Server-Admin mit Support-Freigabe der Firma: alles nur lesen. */
  support: boolean;
  areas: Record<Area, AreaRight>;
  specials: Partial<Record<SpecialKey, boolean | number>>;
}

/**
 * Rechnet Gruppen und Ausnahmen zu effektiven Rechten zusammen.
 * Reihenfolge: Inhaber hat alles → Ausnahme der Person → „Gesperrt“ (wenn lockWins) → höchste Stufe → Sperre.
 * Gleich hohe Stufen ohne „nur eigene“ gewinnen gegen solche mit.
 */
export function computeRights(
  groups: (GroupRights & { name: string })[],
  exceptions: ExceptionRight[],
  lockWins: boolean,
  today: string,
  modules: string[],
): Rights {
  const owner = groups.some((g) => g.isOwner);
  const areas = {} as Record<Area, AreaRight>;
  for (const def of AREAS) {
    const moduleOn = def.module === 'firma' || modules.includes(def.module);
    let right: AreaRight;
    if (!moduleOn) right = { level: 0, locked: false, own: false, source: 'Modul aus' };
    else if (owner) right = { level: 3, locked: false, own: false, source: 'Inhaber' };
    else right = areaRight(def.id, groups, exceptions, lockWins, today);
    areas[def.id] = right;
  }
  const specials: Partial<Record<SpecialKey, boolean | number>> = {};
  for (const s of SPECIALS) {
    if (owner) {
      specials[s.key] = s.kind === 'usd' ? Number.MAX_SAFE_INTEGER : true;
      continue;
    }
    for (const g of groups) {
      const v = g.specials[s.key];
      if (v === undefined || v === false) continue;
      if (s.kind === 'usd') specials[s.key] = Math.max(Number(specials[s.key] ?? 0), Number(v === true ? 0 : v));
      else specials[s.key] = true;
    }
  }
  return { owner, support: false, areas, specials };
}

function areaRight(area: Area, groups: (GroupRights & { name: string })[], exceptions: ExceptionRight[], lockWins: boolean, today: string): AreaRight {
  const ex = exceptions.find((e) => e.area === area && (!e.until || e.until >= today));
  if (ex) {
    return { level: ex.level === 'x' ? 0 : Number(ex.level), locked: ex.level === 'x', own: false, source: ex.until ? `Ausnahme bis ${ex.until}` : 'Ausnahme' };
  }
  const lock = groups.find((g) => g.levels[area] === 'x');
  if (lock && lockWins) return { level: 0, locked: true, own: false, source: lock.name };
  let best: AreaRight | null = null;
  for (const g of groups) {
    const l = g.levels[area];
    if (!l || l === 'x' || l === '0') continue;
    const own = !!g.own[area];
    const n = Number(l);
    if (!best || n > best.level || (n === best.level && best.own && !own)) best = { level: n, locked: false, own, source: g.name };
  }
  if (best) return best;
  if (lock) return { level: 0, locked: true, own: false, source: lock.name };
  return { level: 0, locked: false, own: false, source: groups.length ? 'in keiner Gruppe erlaubt' : 'keine Gruppe' };
}

/** Alles lesen, nichts ändern – für Server-Admins mit Support-Freigabe. */
export function supportRights(modules: string[]): Rights {
  const areas = {} as Record<Area, AreaRight>;
  for (const def of AREAS) {
    const on = def.module === 'firma' || modules.includes(def.module);
    areas[def.id] = { level: on ? 1 : 0, locked: false, own: false, source: on ? 'Support-Zugriff' : 'Modul aus' };
  }
  return { owner: false, support: true, areas, specials: {} };
}

export function canArea(r: Rights, area: Area, min: 1 | 2 | 3 = 1): boolean {
  return r.areas[area].level >= min;
}

export function hasSpecial(r: Rights, key: SpecialKey): boolean {
  const v = r.specials[key];
  return v !== undefined && v !== false;
}

/** Gruppenvorlagen für neue Firmen. */
export const GROUP_TEMPLATES: { name: string; color: string; description: string; levels: Partial<Record<Area, Level>>; own?: Partial<Record<Area, boolean>>; specials?: Partial<Record<SpecialKey, boolean | number>> }[] = [
  {
    name: 'Leitung', color: '#4fc3ff', description: 'Führt den Betrieb, wenn der Inhaber nicht da ist.',
    levels: { auftraege: '3', lager: '3', hallenplan: '3', werkzeug: '3', leitstelle: '3', fuhrpark: '3', tuning: '3', racing: '3', kunden: '3', fahrzeuge: '3', vertraege: '3', nachrichten: '3', mitarbeiter: '2', dienstzeiten: '3', dienstplan: '3', lohn: '1', raenge: '1', bewerbungen: '2', schulungen: '3', rechnungen: '3', buchungen: '2', firma: '1', zugaenge: '2', protokoll: '1', preisliste: '2', regelwerk: '2', pinnwand: '3' },
    specials: { zuteilen: true, kundensperre: true, storno: true, auszahlung: 5000, einladen: true, export: true },
  },
  {
    name: 'Mechanik', color: '#ff7a1a', description: 'Arbeitet an Aufträgen, sieht keine Firmenfinanzen.',
    levels: { auftraege: '2', lager: '2', hallenplan: '2', werkzeug: '2', fuhrpark: '1', tuning: '2', racing: '1', kunden: '1', fahrzeuge: '2', vertraege: '1', nachrichten: '2', mitarbeiter: '1', dienstzeiten: '1', dienstplan: '1', lohn: '1', rechnungen: '2', buchungen: 'x', firma: '1', preisliste: '1', regelwerk: '1', pinnwand: '2' },
    own: { dienstzeiten: true, lohn: true, rechnungen: true },
  },
  {
    name: 'Abschleppdienst', color: '#34d69a', description: 'Leitstelle und eigene Einsätze.',
    levels: { leitstelle: '2', fuhrpark: '2', werkzeug: '1', kunden: '1', fahrzeuge: '1', vertraege: '1', nachrichten: '2', mitarbeiter: '1', dienstzeiten: '1', dienstplan: '1', lohn: '1', rechnungen: '2', firma: '1', preisliste: '1', regelwerk: '1', pinnwand: '2' },
    own: { leitstelle: true, dienstzeiten: true, lohn: true, rechnungen: true },
  },
  {
    name: 'Büro & Finanzen', color: '#c792ea', description: 'Rechnungen, Buchungen und Kasse.',
    levels: { auftraege: '1', lager: '1', kunden: '2', fahrzeuge: '1', vertraege: '3', nachrichten: '2', mitarbeiter: '1', dienstzeiten: '2', dienstplan: '1', lohn: '3', raenge: '1', bewerbungen: '1', rechnungen: '3', buchungen: '3', firma: '1', protokoll: '1', preisliste: '3', regelwerk: '1', pinnwand: '2' },
    specials: { storno: true, auszahlung: 20000, lohnzahlung: true, export: true },
  },
  {
    name: 'Gäste', color: '#9aa7bd', description: 'Externe: alles gesperrt, außer Firmendaten, Regelwerk und Pinnwand.',
    levels: { auftraege: 'x', lager: 'x', hallenplan: 'x', werkzeug: 'x', leitstelle: 'x', fuhrpark: 'x', tuning: 'x', racing: 'x', kunden: 'x', fahrzeuge: 'x', vertraege: 'x', nachrichten: 'x', mitarbeiter: 'x', dienstzeiten: 'x', dienstplan: 'x', lohn: 'x', raenge: 'x', bewerbungen: 'x', schulungen: 'x', rechnungen: 'x', buchungen: 'x', firma: '1', preisliste: 'x', regelwerk: '1', pinnwand: '1' },
  },
];
