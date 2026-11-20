// Katalog der Anbindungen (Serververwaltung → Anbindungen). Status = was Pitstop heute kann.
export type IntegrationStatus = 'verfügbar' | 'geplant' | 'Idee';

export interface Integration {
  key: string;
  group: string;
  name: string;
  desc: string;
  status: IntegrationStatus;
  /** Wo man es einrichtet, wenn es verfügbar ist */
  where?: string;
}

export const INTEGRATIONS: Integration[] = [
  { key: 'discord-webhook', group: 'Discord', name: 'Discord-Meldungen', desc: 'Ereignisse einer Firma (Einsätze, Dienstbeginn, Rechnungen …) als Nachricht in einen Kanal.', status: 'verfügbar', where: 'Firma → Firmendaten → Webhooks' },
  { key: 'webhook-json', group: 'Allgemein', name: 'Webhooks (JSON)', desc: 'Dieselben Ereignisse als JSON an eine eigene Adresse, z. B. für Google Sheets oder einen Bot.', status: 'verfügbar', where: 'Firma → Firmendaten → Webhooks' },
  { key: 'public-api', group: 'Allgemein', name: 'Öffentliche API (nur lesen)', desc: 'Preisliste, kommende Rennen und Bestenliste von Firmen, die das freigeben. Zugriff mit API-Schlüssel.', status: 'verfügbar', where: 'unten: API-Schlüssel' },
  { key: 'totp', group: 'Allgemein', name: 'Zwei-Faktor-Anmeldung', desc: 'Code aus einer Authenticator-App zusätzlich zum Passwort.', status: 'verfügbar', where: 'Mein Konto → Zwei-Faktor' },
  { key: 'discord-login', group: 'Discord', name: 'Mit Discord anmelden', desc: 'Konten mit Discord verknüpfen und darüber anmelden (keine neuen Konten über Discord).', status: 'verfügbar', where: '.env: DISCORD_CLIENT_ID und DISCORD_CLIENT_SECRET, dann Mein Konto → Discord verknüpfen' },
  { key: 'discord-roles', group: 'Discord', name: 'Discord-Rollen → Gruppen', desc: 'Rollen auf dem Discord-Server werden zu Gruppen in Pitstop.', status: 'Idee' },
  { key: 'fivem-duty', group: 'FiveM', name: 'Dienstzeiten aus dem Spiel', desc: 'Stempeluhr startet und endet mit dem Dienst im Spiel (/dienst oder Export).', status: 'verfügbar', where: 'FiveM-Ressource fivem/pitstop, Schlüssel unter Firmendaten → Spielserver' },
  { key: 'fivem-bank', group: 'FiveM', name: 'Ingame-Bank', desc: 'Rechnungen im Spiel bezahlen (Betrag wird geprüft) und Kontostand abfragen.', status: 'verfügbar', where: 'FiveM-Ressource fivem/pitstop' },
  { key: 'fivem-calls', group: 'FiveM', name: 'Notrufe → Einsätze', desc: 'Ein Notruf im Spiel legt einen Einsatz mit Koordinaten an.', status: 'verfügbar', where: 'FiveM-Ressource fivem/pitstop' },
  { key: 'fivem-vehicles', group: 'FiveM', name: 'Fahrzeugdaten', desc: 'Kennzeichen im Spiel abfragen: bekannt, Halter, gestohlen, offene Aufträge.', status: 'verfügbar', where: 'FiveM-Ressource fivem/pitstop' },
  { key: 'fivem-tablet', group: 'FiveM', name: 'Ingame-Tablet', desc: 'Kompakte Ansicht für Tablet und PC im Spiel.', status: 'Idee' },
  { key: 'fivem-laps', group: 'FiveM', name: 'Rennzeiten', desc: 'Runden und Sektoren aus dem Rennskript übernehmen.', status: 'verfügbar', where: 'FiveM-Ressource fivem/pitstop' },
  { key: 'txadmin', group: 'FiveM', name: 'txAdmin', desc: 'Serverstatus und Ankündigungen aus txAdmin.', status: 'Idee' },
  { key: 'lspd', group: 'Fraktionen', name: 'LSPD-Fahndung', desc: 'Die Polizei meldet Kennzeichen als gestohlen; Annahme und Suche warnen.', status: 'verfügbar', where: 'FiveM-Ressource fivem/pitstop (Export Fahndung)' },
  { key: 'ems', group: 'Fraktionen', name: 'EMS', desc: 'Einsatzfahrzeuge des Rettungsdienstes mit Vorrang.', status: 'Idee' },
  { key: 'city', group: 'Fraktionen', name: 'Stadtverwaltung', desc: 'Gewerbelizenzen und Steuern abgleichen.', status: 'Idee' },
  { key: 'calendar-feed', group: 'Allgemein', name: 'Kalender-Abo', desc: 'Schichten und Rennen als iCal-Feed für das Handy.', status: 'Idee' },
  { key: 'stream-overlay', group: 'Allgemein', name: 'Stream-Overlay', desc: 'Bestenliste und Rennergebnisse als Overlay für Streams.', status: 'Idee' },
];
