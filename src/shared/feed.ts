// Live-Feed und Webhooks: Protokollbereiche (audit_log.area) → Rechtebereich und Filtergruppe.
import type { Area } from './permissions';

/** Wer einen Protokolleintrag im Live-Feed sieht: mindestens „Sehen“ im zugeordneten Bereich. */
export const FEED_AREAS: Record<string, { area: Area; group: FeedGroup }> = {
  Werkstatt: { area: 'auftraege', group: 'Werkstatt' },
  Annahme: { area: 'auftraege', group: 'Werkstatt' },
  Lager: { area: 'lager', group: 'Werkstatt' },
  Hallenplan: { area: 'hallenplan', group: 'Werkstatt' },
  Werkzeug: { area: 'werkzeug', group: 'Werkstatt' },
  Tuning: { area: 'tuning', group: 'Werkstatt' },
  Abschleppdienst: { area: 'leitstelle', group: 'Abschlepp' },
  Fuhrpark: { area: 'fuhrpark', group: 'Abschlepp' },
  Racing: { area: 'racing', group: 'Racing' },
  Kunden: { area: 'kunden', group: 'Kunden' },
  Fahrzeuge: { area: 'fahrzeuge', group: 'Kunden' },
  Verträge: { area: 'vertraege', group: 'Kunden' },
  Nachrichten: { area: 'nachrichten', group: 'Kunden' },
  Finanzen: { area: 'rechnungen', group: 'Finanzen' },
  Kasse: { area: 'buchungen', group: 'Finanzen' },
  Lohn: { area: 'lohn', group: 'Personal' },
  Personal: { area: 'mitarbeiter', group: 'Personal' },
  Dienst: { area: 'dienstzeiten', group: 'Personal' },
  Dienstplan: { area: 'dienstplan', group: 'Personal' },
  Ränge: { area: 'raenge', group: 'Personal' },
  Bewerbungen: { area: 'bewerbungen', group: 'Personal' },
  Schulungen: { area: 'schulungen', group: 'Personal' },
  Preisliste: { area: 'preisliste', group: 'Firma' },
  Regelwerk: { area: 'regelwerk', group: 'Firma' },
  Pinnwand: { area: 'pinnwand', group: 'Firma' },
  Firma: { area: 'protokoll', group: 'Firma' },
  Module: { area: 'protokoll', group: 'Firma' },
  Zugänge: { area: 'protokoll', group: 'Firma' },
  Gruppen: { area: 'protokoll', group: 'Firma' },
  Export: { area: 'protokoll', group: 'Firma' },
};

export type FeedGroup = 'Werkstatt' | 'Abschlepp' | 'Racing' | 'Kunden' | 'Finanzen' | 'Personal' | 'Firma';
export const FEED_GROUPS: FeedGroup[] = ['Werkstatt', 'Abschlepp', 'Racing', 'Kunden', 'Finanzen', 'Personal', 'Firma'];

/** Ereignisse, die ein Webhook abonnieren kann (= Protokollbereiche). */
export const WEBHOOK_EVENTS = Object.keys(FEED_AREAS);
