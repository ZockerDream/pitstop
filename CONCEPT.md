# Pitstop – Konzept (Version 0.5)

Pitstop ist die Verwaltung für Werkstätten auf einem **Roleplay-Server** (GTA V / FiveM): Werkstatt mit Lager, Abschleppdienst, Tuning, Racing, Kunden, Personal mit Dienstplan und Lohn, Schulungen und Finanzen an einem Ort, im Browser auf PC, Tablet und Handy. Geld ist Spielwährung **$ ohne Steuern**. Gestaltung und Bedienung folgen dem bestätigten Mockup (Artifact „Pitstop Prototyp“, Version 10). Technik: [TECHNICAL.md](TECHNICAL.md), Betrieb: [README.md](README.md), Arbeitsstand: [AGENTS.md](AGENTS.md).

Version 0.1 (Werkstatt-ERP mit Mehrwertsteuer) ist durch 0.2 ersetzt. 0.3 ergänzt die Module, die in 0.2 noch fehlten; 0.4 setzt die restlichen Seiten und Funktionen des Mockups um; 0.5 ergänzt Fotos, Zwei-Faktor, Discord-Anmeldung und die Spielserver-Anbindung (FiveM).

## 1. Ziel und Abgrenzung

- Ein Pitstop-Server kann **mehrere Firmen** beherbergen. Konten gelten serverweit; in welche Firma jemand gehört und was er dort darf, regelt jede Firma selbst.
- **Serververwaltung und Firmenverwaltung sind getrennt.** Ein Server-Admin verwaltet Konten, Firmen, Sicherungen und Exporte, sieht aber keine Firmendaten, solange die Firma keinen Support-Zugriff erlaubt.
- Aus dem Mockup ist alles umgesetzt. Ideen ohne Umsetzung stehen unter Serververwaltung → Anbindungen als „Idee“ mit „Will ich haben“ (Discord-Rollen → Gruppen, Ingame-Tablet, txAdmin, EMS, Stadtverwaltung, Kalender-Abo, Stream-Overlay).
- **Spielserver:** Eine FiveM-Ressource (`fivem/pitstop`) meldet mit einem Schlüssel der Firma Dienst, Notrufe, Zahlungen, Rundenzeiten und Fahndungen und fragt Kennzeichen ab. Spieler werden über die Spiel-ID am Mitglied oder das verknüpfte Discord-Konto erkannt.
- **Anmeldung:** E-Mail und Passwort, optional Zwei-Faktor-Code (TOTP) und – wenn der Betreiber es einrichtet – Discord für verknüpfte Konten. Discord legt keine Konten an.

## 2. Begriffe

| Begriff | Bedeutung |
|---|---|
| Konto | Anmeldung mit E-Mail und Passwort, gilt für den ganzen Server |
| Server-Admin | Eigene Rolle **pro Konto**, unabhängig von Firmen. Verwaltet den Server |
| Firma | Werkstatt auf dem Server, mit Modulen, Gruppen und Mitgliedern |
| Mitglied | Konto, das in einer Firma aufgenommen ist (mit Rang, Telefon, gesperrt ja/nein) |
| Gruppe | Von der Firma frei angelegte Rechte-Sammlung (z. B. Mechanik, Büro, Gäste) |
| Inhaber | Feste Gruppe jeder Firma, hat immer alle Rechte, nicht einschränkbar |
| Ausnahme | Recht nur für eine Person in einem Bereich, optional befristet, mit Grund |
| Support-Zugriff | Freigabe des Inhabers: Server-Admins dürfen die Firma lesend ansehen; jeder Zugriff wird protokolliert |
| Lohnlauf | Abrechnung eines Zeitraums: Stunden aus der Stempeluhr × Stundenlohn + Provision |
| Nachweis | Bestandener Kurs einer Person, optional mit Ablaufdatum |
| Build | Tuning-Auftrag (Auftrag der Art „Tuning“), meist aus dem Konfigurator |
| Arbeitsfläche | Cockpit oder weitere, benannte Seite mit eigenen Widgets, pro Konto gespeichert |
| Annahme | Fahrzeug, Zustand (Schadensskizze, km, Tank, Checkliste) und Auftrag in einem Schritt, mit Kennzeichen-Abgleich |
| Kennzeichen-Abgleich | Warnung, wenn ein Fahrzeug als gestohlen gemeldet ist (bei Annahme und in der Suche) |
| Nachweis-Pflicht | Leistung der Preisliste, die nur Leute mit bestandenem Kurs übernehmen dürfen |
| Rang | Hierarchie und Lohnmodell (Stundenlohn, Provision, Fixum); beim Befördern werden Gruppen vorgeschlagen, Rechte bleiben in den Gruppen |
| Konten | Firmenkonto, Kasse, Trinkgeldkasse, Rennteam; Umbuchungen zählen nicht als Einnahme oder Ausgabe |
| Spiel-ID | Kennung einer Person im Spiel (z. B. `license:…`), je Firma eindeutig; ordnet Spielserver-Meldungen dem Mitglied zu |
| Spielserver-Schlüssel | Geheimer Schlüssel `pg_…` einer Firma für die FiveM-Ressource; widerrufbar |
| Vorschau als Person | Navigation und Knöpfe mit den Rechten eines Mitglieds ansehen; ändern ist dabei gesperrt |

## 3. Rechte

Maßgeblich: `src/shared/permissions.ts` (Server und Oberfläche nutzen dieselbe Funktion `computeRights`). Der Server prüft jede Route; die Oberfläche blendet nur zusätzlich aus.

**Bereiche** (je Seite): Auftragstafel (auch Annahme), Lager & Bestellungen, Hallenplan, Werkzeug, Leitstelle & Einsätze, Fuhrpark, Tuning, Racing (Events, Team, Setups, Trackdays), Kundenakten, Fahrzeuge, Rahmenverträge, Nachrichten an Kunden, Mitarbeiter, Dienstzeiten, Dienstplan, Lohn & Provision, Ränge, Bewerbungen, Kurse/Termine/Nachweise/Lizenzen aller, Rechnungen, Konten/Buchungen/Kasse/Auswertung, Firmendaten, Mitglieder & Zugänge, Gruppen & Rechte, Module, Preisliste, Regelwerk, Pinnwand, Protokoll. Bereiche eines ausgeschalteten Moduls sind für alle aus. „Mein Lernen“, „Prüfungen & Termine“, Live-Feed, Arbeitsflächen und der Kalender brauchen kein eigenes Recht: Jede Person lernt für sich (außer eine Gruppe sperrt „Kurse und Nachweise“, z. B. Gäste), Kalender und Live-Feed zeigen nur, was man ohnehin sehen darf (der Feed lässt Bereiche mit „nur eigene“ ganz weg). Abwesenheiten und Stempel-Nachträge beantragt jede Person für sich.

**Stufen:** Gesperrt · nicht gesetzt · Sehen · Bearbeiten · Verwalten (zusätzlich löschen und Einstellungen).

**„Nur eigene“:** Auftragstafel (zugeteilt oder selbst angelegt), Leitstelle (eigene und noch freie Einsätze), Dienstzeiten, Dienstplan (eigene Schichten), Lohn (eigene Abrechnungen), Rechnungen (selbst gestellt).

**Sonderrechte:** Einsätze zuteilen · Kunden sperren · Kunden löschen · Rechnungen stornieren · Ausgaben buchen (mit Betragsgrenze in $) · Löhne auszahlen · Leute aufnehmen · Daten exportieren.

**Feste Regeln der Module:** Lagerzugang als Ausgabe buchen braucht „Buchungen“ Bearbeiten und das Sonderrecht „Ausgaben buchen“ (Grenze gilt). Lohnlauf und Lohnangaben brauchen „Lohn“ Verwalten, Auszahlen zusätzlich „Löhne auszahlen“. Testfragen sieht nur, wer Kurse bearbeiten darf; ausgewertet wird auf dem Server. Die Praxisprüfung nimmt ab, wer Kurse bearbeiten darf oder als Trainer eingetragen ist, nie bei sich selbst. Der Tuning-Preis wird auf dem Server berechnet. Ein Export braucht das Sonderrecht und den Bereich ganz (nicht nur eigene).

**Feste Regeln ab 0.5:** Fotos lädt hoch, wer den Auftrag bearbeiten darf (bei „nur eigene“ nur eigene Aufträge), höchstens 20 je Auftrag, je 10 MB; löschen eigene Fotos oder „Auftragstafel“ Verwalten. Spielserver-Schlüssel verwaltet, wer „Firmendaten“ verwaltet; ein Schlüssel wirkt nur in seiner Firma und nur für Dienst, Notruf, Zahlung (Betrag muss genau stimmen), Runden, Kennzeichen, Fahndung, Kontostand und Status. Zwei-Faktor schaltet jede Person für sich ein und aus (aus nur mit Passwort und Code); ein Code gilt nur einmal.

**Feste Regeln ab 0.4:** Die Annahme legt einen Auftrag an („Auftragstafel“ Bearbeiten); ein neues Fahrzeug braucht „Fahrzeuge“ Bearbeiten, ein neuer Kunde „Kundenakten“ Bearbeiten, ein Platz im Hallenplan „Hallenplan“ Bearbeiten. Gestohlen gemeldete Kennzeichen und gesperrte Kunden blockieren die Annahme (gestohlen: mit ausdrücklicher Bestätigung möglich, steht dann im Protokoll). Leistungen mit Nachweis-Pflicht lassen sich nur Leuten mit gültig bestandenem Kurs zuteilen. Ein Platz im Hallenplan lässt sich nicht doppelt buchen. Der Trackday-Preis kommt aus dem Paket der Firma. Der Tuning-Rabatt ist der größte aus Paket, Kundenrabatt und aktivem Rahmenvertrag. Befördern braucht „Mitglieder & Zugänge“ Bearbeiten, das Übernehmen der Gruppen zusätzlich „Gruppen & Rechte“ Bearbeiten, das des Lohnmodells „Lohn“ Verwalten. Einstellen aus Bewerbungen braucht „Bewerbungen“ und „Mitglieder & Zugänge“ Bearbeiten und das Sonderrecht „Leute aufnehmen“. Abwesenheiten genehmigt, wer den Dienstplan verwaltet, Nachträge, wer Dienstzeiten verwaltet – nie die eigenen (außer Inhaber). Freitext-Antworten bewertet, wer Kurse bearbeitet oder Trainer ist, nie die eigenen. Umbuchungen, Trinkgeld-Verteilung und Tanken/Wareneingang als Ausgabe brauchen „Ausgaben buchen“ (mit Grenze). Anheften auf der Pinnwand braucht „Pinnwand“ Verwalten; eigene Beiträge darf man ändern und löschen. Webhooks richtet ein, wer „Firmendaten“ verwaltet. Die Vorschau als Person braucht Sicht auf „Gruppen & Rechte“ oder „Mitglieder & Zugänge“.

**Zusammenrechnen** (in dieser Reihenfolge):
1. Inhaber → alles.
2. Gültige Ausnahme der Person für den Bereich → gilt.
3. „Gesperrt“ in einer Gruppe → gesperrt, wenn die Firma „Gesperrt gewinnt“ eingestellt hat (Standard); sonst nur, wenn keine Gruppe den Bereich erlaubt.
4. Sonst die höchste Stufe aller Gruppen; bei gleicher Stufe gewinnt die ohne „nur eigene“.

Weitere Regeln: Gruppen zuweisen braucht „Mitglieder & Zugänge“ und „Gruppen & Rechte“ mindestens Bearbeiten. Inhaber kann nur ein Server-Admin übertragen. Den Inhaber kann man nicht sperren oder entfernen. Der letzte aktive Server-Admin kann die Rolle nicht abgeben. Gesperrte Mitglieder kommen nicht mehr in die Firma, gesperrte Konten gar nicht mehr auf den Server.

**Gruppenvorlagen** für neue Firmen: Leitung, Mechanik, Abschleppdienst, Büro & Finanzen, Gäste. Beim Update auf 0.3 und 0.4 bekommen gleichnamige Gruppen bestehender Firmen Stufen für die neuen Bereiche, wo noch nichts gesetzt ist.

## 4. Oberfläche

- **Seitenleiste** mit Gruppen nach Modulen, gefiltert nach Rechten. Oben der Wechsler: eigene Firmen und (für Server-Admins) die Serververwaltung, die eine eigene Navigation hat.
- **Kopfzeile:** Brotkrumen, Tabs, Suche, Stempeluhr („Dienst beginnen/beenden“), Meldungen, „Neu“, Darstellung.
- **Suche (Strg+K):** Seiten, Kunden, Fahrzeuge, Aufträge, Einsätze, Rechnungen und Leute; ein Kennzeichen wird sofort abgeglichen (gestohlen / bekannt / unbekannt).
- **Meldungen:** was die Person gerade erledigen sollte (wie „Braucht dich“): zuzuteilende Einsätze und Aufträge, überfällige Rechnungen, Lager, Pflichtkurse, ungelesene Kundennachrichten, Pinnwand, zu bestätigendes Regelwerk, Anträge zum Genehmigen, Prüfungen, Bewerbungen, Werkzeug- und Fuhrpark-Fälligkeiten, Daueraufträge.
- **Arbeitsflächen:** Neben dem Cockpit beliebig viele benannte Arbeitsflächen (bis 12) mit eigenen Widgets, in der Seitenleiste unter „Arbeitsflächen“, auch als Tab.
- **Vorschau als Person** (aus „Mitglieder & Zugänge“): Hinweisbalken oben, „Vorschau beenden“.
- **Tabs:** Klick in der Seitenleiste ersetzt den aktiven Tab, Doppelklick öffnet die Seite in einem neuen Tab. Ein Tab lässt sich „daneben“ öffnen (zwei Seiten nebeneinander, „Tauschen“). Tabs merkt sich das Gerät.
- **Handy:** Leiste unten mit Cockpit, Auftragstafel, Leitstelle, Kunden und „Alle“.
- **Darstellung pro Konto** (auf jedem Gerät gleich): Theme (Automatisch, Boxengasse, Nachtrennen, Racing Green, Werkstatt hell, Le Mans), Dichte, Seitenleiste breit/schmal, Schriftgröße, Bewegung, Startseite.
- Detailansichten als Seitenpanel, Formulare als Dialog; Rückmeldungen als Hinweis unten.

## 5. Seiten

| Seite | Inhalt |
|---|---|
| Cockpit, Arbeitsflächen | Widgets nach Wahl, pro Konto: Kennzahlen, Braucht dich, Schnell anlegen, Im Dienst, Als Nächstes, Lager, Nächstes Rennen, Bestenliste, Meine Schulungen, Builds, Live-Feed, Hallenplan jetzt, Pinnwand, Fuhrpark, Werkzeug, Konten, Kundennachrichten. „Anpassen“: hinzufügen, verschieben, Größe (3–12 Spalten), entfernen, Standard; weitere Arbeitsflächen umbenennen und löschen. Nur Widgets aus erlaubten Bereichen |
| Live-Feed | Protokoll der Firma in Echtzeit, gefiltert nach Bereich; „Heute in Zahlen“ |
| Kalender | Monat und „Als Nächstes“: Schichten, Events, fällige Rechnungen, ablaufende Nachweise; „Nur meins“ oder „Alles“ |
| Fahrzeugannahme | Fotos hinzufügen; Kennzeichen (mit Abgleich und Vorschlägen), Modell, Halter oder neuer Kunde, km, Tank; Schadensskizze zum Antippen; Checkliste; Stichworte, Leistung aus der Preisliste, Kundenwunsch, Zuständig (mit Nachweis-Prüfung), Preis, Platz im Hallenplan → Auftrag |
| Hallenplan | Plätze (Hebebühnen, Lackierkabine, Prüfstand, Waschplatz) als Zeitleiste für gestern/heute/morgen; Buchung mit Auftrag; Auslastung, freie Plätze |
| Lager & Bestellungen | Teile mit Bestand, Mindestbestand, Preis, Lagerort; Zugang (optional als Ausgabe), Entnahme (nicht unter 0), Inventur; Bestellungen (bestellt → geliefert bucht Bestand und optional Ausgabe); Verbrauch 30 Tage |
| Werkzeug | Ausgeben an eine Person, Zurücknehmen, Wartung mit Grund, nächste Prüfung |
| Einsätze | Liste je Monat mit Status, Fahrer, Gebühr; Kennzahlen (Anzahl, Ø Dauer, bezahlt, ohne Fahrer); öffnet den Einsatz in der Leitstelle |
| Fuhrpark | Eigene Fahrzeuge mit km, Tank, Service, Fahrer; Ausgabe, Rückgabe (km, Tank), Tanken (optional als Ausgabe), Schaden (legt eiligen Werkstattauftrag an), wieder bereit; Fahrtenbuch |
| Konfigurator | Kunde, Fahrzeug, Klasse (Preisfaktor), Paket oder einzelne Stufen; Angebot live; „Als Auftrag anlegen“ (Rabatt: Paket oder Kunde, der größere) |
| Builds, Prüfstand | Tuning-Aufträge mit Fortschritt und PS; Messungen je Fahrzeug mit Zuwachs |
| Pakete & Preise | Preise je Stufe, Faktor je Klasse, Rabatt je Paket; Vorgabe wiederherstellen |
| Rennkalender, Bestenliste | Events (Rennen, Teamstart, Trackday, Meet) mit Startplätzen, Startgeld, Preisgeld; Starter mit Platz, bester Runde und Rennwagen; Startgeld kassieren (Kasse); Meisterschaftstabelle je Saison; Stand Konto Rennteam; Bestenliste je Strecke (inkl. Trainingsrunden) |
| Team & Rennwagen | Rennwagen mit Startnummer, Stammfahrer, Zustand, km seit Revision, Verschleiß (Motor, Bremsen, Reifen, Getriebe), Budget; Starts und Siege; Ergebnisse der Saison |
| Setups & Telemetrie | Runden mit drei Sektoren je Strecke; Rundenvergleich als Abstand zur Bestzeit nach Sektoren; beste Sektoren, ideale Runde; Setup je Wagen und Strecke als Wertekarten mit Notiz |
| Kunden-Trackdays | Pakete der Firma (Name, Preis, Leistungen); Buchungen mit Kunde, Fahrzeug, Event, Transport, Status; daraus Rechnung |
| Dienstplan | Woche mit Schichten je Person, Abwesenheiten in der Woche, Soll (geplant) / Ist (gestempelt); Stempeluhr jetzt; Abwesenheiten beantragen und genehmigen; Stempel-Nachträge beantragen und genehmigen |
| Lohn & Provision | Stundenlohn, Provision und Fixum je Person; Lohnlauf (Fixum nur, wer im Zeitraum gearbeitet oder Umsatz gebracht hat); Bonus; Auszahlen bucht eine Ausgabe vom Firmenkonto |
| Ränge | Ränge von oben nach unten mit Lohnmodell und vorgeschlagenen Gruppen; Befördern mit Bestätigung |
| Bewerbungen | Bewerbung mit Rolle, Kontakt, Text, Ersteindruck; Gespräch planen, Absagen, Einstellen (Konto mit Startpasswort, Rang, Gruppen) |
| Mein Lernen, Kurse, Nachweise & Lizenzen | Pflichtkurse je Gruppe; Lektionen der Reihe nach, dann Test (Auswahl- und Freitextfragen); Kurse mit Lektionen, Fragen, Bestehensgrenze, Gültigkeit, Praxisprüfung, Trainer; Übersicht aller Nachweise mit Praxisprüfung; Lizenzen der Firma und von Personen mit Ablauf |
| Prüfungen & Termine | Termine (Praxis, Einführung, Test) mit Trainer und Teilnehmern, an- und abmelden; Praxisprüfungen abnehmen; Freitext-Antworten als richtig oder falsch bewerten |
| Auftragstafel | Spalten Angenommen · In Arbeit · Wartet auf Teile · Fertig · Abgeholt; Auftrag mit Kunde, Fahrzeug, Zuständigem, Preis, Fortschritt, Eilig, Annahme-Daten und Fotos; daraus Rechnung stellen |
| Leitstelle | Karte (nachgezeichnet oder eigenes Kartenbild der Firma), Zoom per Mausrad/zwei Fingern, Ort per Klick; Einsätze mit Status Offen · Unterwegs · Vor Ort · Erledigt; „Ich fahre“; erledigte Einsätze abrechnen |
| Kundenakten, Fahrzeugakten | Suche auch nach Kennzeichen; Filter „Offene Posten“; Kundenakte mit Rahmenvertrag, Nachrichten, Fahrzeugen, Aufträgen, Rechnungen, offenem Betrag; Sperren/Löschen nur mit Sonderrecht. Fahrzeugakte mit km und Vorschäden aus der Annahme, Tuningstand, Prüfstand, Werkstatt-Verlauf, „als gestohlen melden“ |
| Rahmenverträge | Je Kunde: Rabatt Werkstatt und Tuning, Regeln, Abrechnung, Laufzeit, Status, Umsatz des Jahres |
| Nachrichten | Unterhaltungen je Kunde wie per Handy; Antworten des Kunden lassen sich eintragen; Textvorlagen; ungelesen-Zähler |
| Mitarbeiter, Dienstzeiten | Karten mit Rang, Status, Wochenstunden; Schichten aus der Stempeluhr |
| Rechnungen & Angebote | Angebote (annehmen → Rechnung mit Zahlungsziel) und Rechnungen; Leistung aus der Preisliste (Rahmenvertrag-Rabatt wird abgezogen); Zahlungsziel aus den Firmeneinstellungen; Mahnen (Zähler, Nachricht an den Kunden); Bezahlt bucht eine Einnahme; Storno einer bezahlten Rechnung bucht zurück |
| Finanzen (Übersicht) | Vier Konten mit Wochenveränderung, Einnahmen und Ausgaben je Woche, Herkunft der Einnahmen, offene Posten, letzte Buchungen, Ziele mit Fortschrittsring, Umbuchung |
| Buchungen | Alle Bewegungen auf allen Konten mit Filter, Einnahmen und Ausgaben des Monats (ohne Umbuchungen); Ausgaben nur mit Sonderrecht und bis zur Grenze; Export |
| Kasse | Tagesabschluss (Soll laut Buchungen, gezählt, Differenz wird gebucht), heute bar, Daueraufträge (werden am Fälligkeitstag automatisch gebucht), Trinkgeld nach gestempelten Stunden verteilen, letzte Abschlüsse |
| Auswertung | Woche/Monat/Quartal/Jahr: Gewinn, Ø Auftragswert, offene Posten, neue Kunden, Umsatz je Mitarbeiter, Top-Leistungen, Gewinn je Woche |
| Firmendaten | Stammdaten, Support-Freigabe (nur Inhaber), Kartenbild mit Zwei-Punkt-Kalibrierung oder Ränder von Hand, CSV-Export, Zahlungsziel, Rechnungsfuß, Standorte, „Öffentliche Daten“ für die API, Webhooks (Discord oder JSON, je Bereich, mit Test), Spielserver-Schlüssel (FiveM) |
| Mitglieder & Zugänge | Spiel-ID je Mitglied; Aufnehmen (neues Konto bekommt ein einmal angezeigtes Startpasswort), Gruppen, Rang, Sperren, Entfernen, Ausnahmen, „Was … am Ende darf“ |
| Gruppen & Rechte | Gruppen anlegen, kopieren, löschen; Stufe je Bereich und „Alle“ je Modul; „nur eigene“; Sonderrechte mit Grenze; Vergleich aller Gruppen; Regel bei mehreren Gruppen |
| Preisliste | Leistungen mit Bereich, Grundpreis, Preisen je Fahrzeugklasse (Faktor aus „Pakete & Preise“) und nötigem Nachweis |
| Regelwerk | Dokumente mit Version; jede Person liest und bestätigt; neue Fassung = alle bestätigen neu; wer noch fehlt |
| Pinnwand | Beiträge (anheften), Umfragen mit Ende, anonym gezählt; „x von y gelesen“ |
| Module | Werkstatt, Abschleppdienst, Tuning, Racing, Kunden, Personal, Schulungen, Finanzen an/aus (Daten bleiben) |
| Protokoll | Wer hat wann was geändert |
| Mein Konto, Darstellung, Neuigkeiten | Profil, Passwort, Zwei-Faktor (einrichten mit Schlüssel/otpauth-Link, ausschalten), Discord verknüpfen/trennen, angemeldete Geräte (abmelden), eigene Firmen und Rechte; Darstellung; Changelog für alle und Ankündigungen der Server-Admins |
| Serververwaltung | Übersicht, Firmen (anlegen mit Inhaber, pausieren, Inhaber übertragen), Benutzerkonten (anlegen, Server-Admin-Schalter, sperren, Startpasswort), Sicherungen (erstellen, laden, wiederherstellen), Export (Server-Daten; Firmendaten nur mit Support-Freigabe), Anbindungen (Katalog mit Status und „Will ich haben“, API-Schlüssel für die öffentliche Nur-Lese-API), Einstellungen (Wartungsmodus, Standard-Module neuer Firmen, automatische Sicherung mit Uhrzeit und Aufbewahrung), Server-Protokoll |

## 6. Demo-Modus

Mit `DEMO_MODE=true` legt der Erststart die Firma „Demo Motorsport“ an (mit Lager, Dienstplan, Löhnen, vier Kursen, Prüfstand, vier Events und den Daten ab 0.4: Hallenplan, Werkzeug, Fuhrpark, Rennwagen, Setups, Runden, Trackdays, Rahmenverträge, Nachrichten, Ränge, Bewerbungen, Abwesenheiten, Lizenzen, Daueraufträge, Ziele, Preisliste, Regelwerk, Pinnwand). Auf der Anmeldeseite meldet man sich mit einem Klick als Inhaber, Leitung, Mechanik (zusätzlich Abschleppdienst), Abschleppfahrerin oder Büro an. Der Admin aus der `.env` ist Server-Admin und nicht Mitglied der Demo-Firma.

## 7. Drehbuch (Abnahme)

1. Als Inhaber anmelden: alle Seiten erreichbar.
2. Auftrag anlegen → Rechnung stellen → „Bezahlt, bar in die Kasse“ → Einnahme steht unter Buchungen.
3. Leitstelle: zoomen, „Ort auf Karte“, Einsatz anlegen → Pin auf der Karte.
4. Darstellung „Werkstatt hell“ → gilt nach neuer Anmeldung auch auf anderem Gerät.
5. Als Mechanik anmelden: keine Buchungen in Navigation und API (403), Stempeluhr funktioniert.
6. Gruppe Mechanik: Auftragstafel sperren → Mechanik sieht keine Aufträge; Ausnahme „Bearbeiten“ → wieder sichtbar.
7. Konfigurator: Paket wählen, „Als Auftrag anlegen“ → Auftrag auf der Tafel mit Server-Preis. Lager: Zugang buchen. Kurs lesen, Test bestehen → Nachweis. Cockpit anpassen (Widget entfernen, bleibt nach Neuladen). Doppelklick in der Seitenleiste → neuer Tab, „daneben öffnen“. Kartenbild hochladen und mit zwei Punkten kalibrieren.
8. Als Büro: Lohnlauf → Abrechnungen; Auszahlen → Ausgabe unter Buchungen; Leitung (Lohn nur Sehen) darf nicht auszahlen.
9. Ab 0.4: Fahrzeugannahme mit Schaden → Auftrag auf der Tafel; Suche nach einem Kennzeichen; Meldungen; neue Arbeitsfläche (bleibt nach Neuladen); Vorschau als Mechanik (ohne Buchungen); Umfrage abstimmen; Tagesabschluss der Kasse. Auf dem Handy kein seitliches Scrollen.
10. Ab 0.5: Foto an einen Auftrag hängen; Zwei-Faktor einrichten (Schlüssel erscheint); Spielserver-Schlüssel erstellen. Per API: Anmeldung nur mit Code, Discord-Verknüpfung und -Anmeldung (Attrappe), Spielserver-Aufrufe.
11. Als Server-Admin: Firmendaten ohne Support-Freigabe 403; nach Freigabe nur lesend; Konto anlegen, Server-Admin-Schalter, Firma anlegen, Sicherung erstellen und wiederherstellen, Export.

Automatisiert: `tests/api/rechte.mjs` (API), Browser-Drehbuch siehe TECHNICAL.md Abschnitt 14.

## 8. Entscheidungen des Auftraggebers

Siehe [AGENTS.md](AGENTS.md), Abschnitt „Entscheidungen des Auftraggebers“. Für 0.5 (2026-11-20): „mach alles“ – auch Fotos, Zwei-Faktor, Discord-Anmeldung und FiveM-Anbindung bauen, committen und pushen. Für 0.4 (2026-11-20): alle noch fehlenden Seiten und Funktionen des Mockups („ja“ auf den Vorschlag 0.4). Für 0.3 (2026-11-20): alle Module aus dem Mockup-Bericht umsetzen („setz alles um“), Mockup-Schriften als neue Pakete erlaubt. Für 0.2 zusätzlich (2026-11-19): Roleplay-Server, $ ohne Steuern; dunkles Motorsport-Design mit mehreren Themes; Firmen- und Serververwaltung getrennt; Admin-Rolle extra pro Konto; frei anlegbare Gruppen mit vollständigem Rechtesystem; Darstellung pro Nutzer; Sicherung, Export und Changelog für alle.
