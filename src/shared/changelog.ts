// Änderungen für die Seite „Neuigkeiten“ (für alle sichtbar). Neueste Version oben.
export interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  items: ['neu' | 'besser' | 'fix', string][];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.0.0',
    date: '2026-11-20',
    title: 'Erstes Release',
    items: [
      ['neu', 'Pitstop 1.0: alle Bereiche aus dem Mockup – Werkstatt, Abschleppdienst, Tuning, Racing, Kunden, Personal, Schulungen, Finanzen, Firma und Serververwaltung'],
      ['besser', 'Kartenränder passen ab Werk zu einem 8K-Kartenbild (X −5600 bis 6700, Y −4100 bis 8400)'],
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-20',
    title: 'Anbindungen',
    items: [
      ['neu', 'Zwei-Faktor-Anmeldung mit Authenticator-App (Mein Konto)'],
      ['neu', 'Mit Discord anmelden, wenn der Server-Betreiber es einrichtet (nur verknüpfte Konten)'],
      ['neu', 'Fotos bei der Fahrzeugannahme und an jedem Auftrag'],
      ['neu', 'Spielserver-Anbindung für FiveM: Dienst per /dienst, Notrufe → Einsätze, Rechnungen im Spiel bezahlen, Rundenzeiten, Kennzeichen-Abfrage und Fahndung'],
      ['neu', 'Spiel-ID je Mitglied und Spielserver-Schlüssel unter Firmendaten'],
      ['besser', 'Konten-Liste zeigt Server-Admins ohne Zwei-Faktor'],
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-20',
    title: 'Das ganze Mockup',
    items: [
      ['neu', 'Werkstatt: Fahrzeugannahme mit Kennzeichen-Abgleich, Schadensskizze und Checkliste; Hallenplan mit Plätzen und Buchungen; Werkzeugausgabe mit Wartung; Lager-Bestellungen, Inventur und Verbrauch'],
      ['neu', 'Abschleppdienst: Einsätze als Liste mit Kennzahlen, Fuhrpark mit Ausgabe, Rückgabe, Tanken, Schaden und Fahrtenbuch'],
      ['neu', 'Racing: Team & Rennwagen mit Verschleiß und Budget, Setups & Telemetrie mit Sektoren, Meisterschaft, Kunden-Trackdays mit Paketen und Rechnung'],
      ['neu', 'Kunden: Rahmenverträge (Rabatt gilt im Konfigurator), Nachrichten an Kunden mit Vorlagen, Fahrzeugakten mit Tuning-Verlauf'],
      ['neu', 'Personal: Ränge mit Lohnmodell und Befördern, Bewerbungen mit Einstellen, Abwesenheiten, Stempel-Nachträge, Fixum im Lohnlauf'],
      ['neu', 'Schulungen: Prüfungen & Termine, Freitext-Fragen mit Bewertung durch Trainer, Lizenzen'],
      ['neu', 'Finanzen: Übersicht mit vier Konten und Zielen, Kasse mit Tagesabschluss, Daueraufträgen und Trinkgeld-Verteilung, Auswertung, Angebote und Mahnungen, Umbuchungen'],
      ['neu', 'Firma: Preisliste mit Nachweis-Pflicht, Regelwerk zum Bestätigen, Pinnwand mit Umfragen, Webhooks für Discord'],
      ['neu', 'Live-Feed, Suche mit Strg+K (auch Kennzeichen), Meldungen, „Neu“-Menü, mehrere benannte Arbeitsflächen, Vorschau als Person'],
      ['neu', 'Serververwaltung: Einstellungen (Wartungsmodus, Standard-Module, automatische Sicherung), Anbindungen mit API-Schlüsseln und öffentlicher Nur-Lese-API'],
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-20',
    title: 'Alle Module',
    items: [
      ['neu', 'Lager: Bestand, Mindestbestand, Zugang (auf Wunsch als Ausgabe gebucht) und Entnahme'],
      ['neu', 'Dienstplan pro Woche und Lohn & Provision: Stundenlohn, Lohnlauf aus der Stempeluhr, Provision auf eigene Aufträge und Einsätze, Auszahlung als Buchung'],
      ['neu', 'Schulungen: Kurse mit Lektionen und Test (wertet der Server), Praxisprüfung, Pflichtkurse je Gruppe, Nachweise mit Ablaufdatum'],
      ['neu', 'Tuning: Konfigurator mit Preis je Fahrzeugklasse und Paketen, Builds, Prüfstand, eigene Preisliste der Firma'],
      ['neu', 'Racing: Rennkalender mit Startern, Startgeld in die Kasse, Rundenzeiten und Bestenliste'],
      ['neu', 'Kalender mit Schichten, Events, fälligen Rechnungen und ablaufenden Nachweisen'],
      ['neu', 'Cockpit als eigene Arbeitsfläche: Widgets hinzufügen, verschieben, Größe ändern'],
      ['neu', 'Tabs: Doppelklick in der Seitenleiste öffnet einen neuen Tab, zwei Seiten nebeneinander'],
      ['neu', 'Karte: eigenes Kartenbild mit zwei Punkten kalibrieren'],
      ['besser', 'Schriften aus dem Mockup (Chakra Petch, Manrope, JetBrains Mono)'],
      ['besser', 'Export nur für Bereiche, die man ganz sehen darf'],
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-19',
    title: 'RP-Plattform',
    items: [
      ['neu', 'Mehrere Firmen pro Server, Serververwaltung getrennt von der Firma, Server-Admin als eigene Rolle pro Konto'],
      ['neu', 'Gruppen & Rechte: Stufen pro Bereich, „nur eigene“, Sonderrechte mit Grenzen, Ausnahmen pro Person mit Ablaufdatum'],
      ['neu', 'Auftragstafel, Leitstelle mit Karte (Zoom, eigenes Kartenbild), Kunden und Fahrzeuge'],
      ['neu', 'Rechnungen und Buchungen in $ ohne Steuern, Kasse und Firmenkonto, Storno'],
      ['neu', 'Stempeluhr und Dienstzeiten'],
      ['neu', 'Sicherungen mit Wiederherstellen, CSV-Export, Server-Protokoll, Ankündigungen'],
      ['neu', 'Darstellung pro Konto: Theme, Dichte, Seitenleiste, Schriftgröße, Startseite'],
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-19',
    title: 'Erste Version',
    items: [['neu', 'Anmeldung, Docker-Betrieb, Sicherung per pg_dump']],
  },
];
