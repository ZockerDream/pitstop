# Pitstop – Konzept

Arbeitstitel: **Pitstop – Business OS**. Selbst gehostetes All-in-One-ERP/CRM für kleine und mittlere Betriebe. Diese Datei beschreibt das *Was* (Fachlichkeit, Bildschirme, Regeln). Das *Wie* steht in [TECHNICAL.md](TECHNICAL.md), Betrieb und Installation in [README.md](README.md), der Arbeitsstand in [AGENTS.md](AGENTS.md), die Projektkarte in [CLAUDE.md](CLAUDE.md).

Stand: 2026-11-19, vor Beginn der Umsetzung. Grundlage ist der Auftrag (Abschnitt 15). Wo er offen war, wurde ein Default gewählt und in Abschnitt 14 festgehalten.

## 1. Ziel und Abgrenzung

**Ziel:** Mitarbeiter, Personal (HR), Finanzen und Kundenakten in *einer* Oberfläche, so klar, dass man sich ohne Schulung zurechtfindet. Pitstop läuft per Docker Compose auf einem eigenen Server, speichert in PostgreSQL und hat eine echte Anmeldung mit den Rollen Admin und Mitarbeiter. Ein zuschaltbarer **Demo-Modus** füllt die App mit realistischen Beispieldaten, damit man sich sofort durchklicken kann.

**Erfolgskriterien:**
- Beide Drehbücher (Abschnitt 13) laufen vollständig durch, ohne toten Knopf, Platzhaltertext oder Konsolenfehler.
- Installation, Update, Backup, Wiederherstellung und Löschen funktionieren genau wie in der README beschrieben; das Update besteht nur aus `git pull` und `docker compose up -d`.

**Nicht Teil der ersten Version:**
- Kein E-Mail-Versand. Passwörter setzt der Admin zurück (oder die Kommandozeile, siehe README).
- Keine Zwei-Faktor-Anmeldung, kein SSO.
- Keine PDF-Rechnungen, kein E-Rechnungsformat (XRechnung/ZUGFeRD), kein Mahnschreiben-Druck, keine DATEV- oder Bankanbindung.
- Rechnungen werden nicht bearbeitet oder gelöscht (GoBD); eine Storno-Funktion folgt später. Ausgaben werden in der ersten Version ebenfalls nur angelegt.
- Keine Belege oder Datei-Uploads, keine Zeiterfassung per Stempeluhr (nur Monatsstunden), keine Mehrmandantenfähigkeit, nur Deutsch.
- Desktop zuerst (ab 1280 px); Tablet (ab 768 px) benutzbar, Smartphone „bricht nicht“.

## 2. Betriebsarten und Demo-Betrieb

| | Echtbetrieb (`DEMO_MODE=false`, Default) | Demo-Modus (`DEMO_MODE=true`) |
|---|---|---|
| Daten beim ersten Start | Leer, nur der Admin aus der `.env` | Demo-Betrieb (unten) plus Admin aus der `.env` |
| Anmeldeseite | E-Mail und Passwort | zusätzlich „Als Admin ansehen“ / „Als Mitarbeiter ansehen“ |
| Benutzermenü | Passwort ändern, Abmelden | zusätzlich Rollenwechsel und „Demo-Daten zurücksetzen“ |
| Hinweis | – | Banner „Demo – alle Daten sind erfunden“ in der Seitenleiste |

Der Demo-Modus ist **nicht für echte Daten** gedacht: Jeder, der die Seite erreicht, kann sich mit einem Klick als Admin anmelden.

**Demo-Betrieb:** ein erfundener mittelständischer Handwerksbetrieb.

| Feld | Wert |
|---|---|
| Firma | Lindner Haustechnik GmbH |
| Branche | Sanitär, Heizung, Klima (SHK), Wärmepumpen, Badsanierung, Kundendienst |
| Sitz | Gewerbering 14, 93055 Regensburg |
| Größe | 18 Mitarbeitende, rund 150.000 € Netto-Umsatz im Monat |
| Abteilungen | Geschäftsführung, Verwaltung, Kundendienst, Montage, Planung, Lager |
| Kundenarten | Privat, Gewerbe, Hausverwaltung, Öffentliche Hand |

**Feste Demo-Figuren** (auf sie verweisen Aufgaben und Drehbuch, deshalb nicht umbenennen):

| Person | Rolle im Betrieb | Rolle in der App |
|---|---|---|
| Katrin Lindner | Geschäftsführerin | Demo-Benutzer **Admin** |
| Jonas Weber | Anlagenmechaniker SHK, Kundendienst | Demo-Benutzer **Mitarbeiter** |
| Max Mustermann | Kundendiensttechniker | Hat einen offenen Urlaubsantrag |
| Sabine Huber | Buchhaltung, Verwaltung | Autorin vieler Kundennotizen |

**Feste Demo-Datensätze:**
- Rechnung **#1042** an „Hausverwaltung Sommer & Partner GmbH“, seit über 20 Tagen überfällig, Mahnstufe 0.
- Ein offener Urlaubsantrag von **Max Mustermann** über 5 Arbeitstage in drei Wochen.
- Zwei weitere offene Urlaubsanträge, ein abgelehnter, mehrere genehmigte.
- Ein Mitarbeiter ist heute krank, zwei sind heute im Urlaub.
- Mindestens ein Lead, der seit über 14 Tagen nicht kontaktiert wurde.

Umfang der übrigen Demo-Daten: Abschnitt 11.

## 3. Rollen und Berechtigungen

Jeder Benutzer hat genau eine Rolle. Ein Benutzer mit der Rolle Mitarbeiter ist immer mit einem Mitarbeiter-Datensatz verknüpft; ein Admin kann verknüpft sein. **Der Server prüft jede Aktion**, die Oberfläche blendet zusätzlich aus, was die Rolle nicht darf.

| Bereich / Aktion | Admin | Mitarbeiter |
|---|---|---|
| Dashboard: Finanz-KPIs und Umsatzdiagramm | ja | nein, stattdessen eigene KPIs (6.2) |
| Dashboard: Aufgaben & Freigaben | alle, manuelle Aufgaben anlegen | nur eigene |
| Kunden ansehen, suchen, filtern | ja | ja |
| Kunde anlegen, bearbeiten, Status ändern, Ansprechpartner | ja | nein |
| Notiz zu einem Kunden anlegen | ja | ja |
| Rechnungen eines Kunden im Kunden-Drawer | ja | ausgeblendet |
| Modul Finanzen (Rechnungen, Ausgaben) | ja | nicht in der Seitenleiste; direkter Aufruf zeigt „Kein Zugriff“ |
| Mitarbeiterverzeichnis | ja, mit Stundensatz | ja, ohne Stundensatz |
| Mitarbeiter anlegen und bearbeiten, Monatsstunden erfassen | ja | nein |
| Personalakte | alle | nur die eigene; bei anderen nur die Kontaktkarte |
| Urlaubsanträge ansehen | alle | eigene; bei anderen nur genehmigte Zeiträume ohne Kommentar |
| Urlaub beantragen | für beliebige Mitarbeitende | für sich selbst |
| Urlaubsantrag genehmigen oder ablehnen | ja | nein |
| Eigenen offenen Antrag zurückziehen | ja | ja |
| Krankmeldung erfassen | ja | nein |
| Einstellungen: Firmendaten, Benutzerkonten | ja | nein |
| Eigenes Passwort ändern | ja | ja |
| Globale Suche findet Rechnungen | ja | nein |
| „+ Neu“ | Kunde, Rechnung, Ausgabe, Mitarbeiter, Urlaubsantrag | Urlaubsantrag |

Grundregel für die Oberfläche: Was die Rolle nicht darf, wird **ausgeblendet**, nicht nur deaktiviert. Ruft jemand eine gesperrte Seite direkt auf, erscheint „Kein Zugriff – diese Ansicht ist der Geschäftsführung vorbehalten“ mit dem Knopf „Zum Dashboard“.

## 4. Anmeldung, Konto und Rechtsseiten

### 4.1 Anmeldeseite
Zentrierte Karte auf dunklem Grund mit Logo und Firmenname. Felder E-Mail und Passwort, Häkchen „Angemeldet bleiben“ (30 Tage statt 8 Stunden), Knopf „Anmelden“. Bei Fehlern immer dieselbe Meldung „E-Mail oder Passwort falsch“; nach zu vielen Versuchen „Zu viele Versuche, bitte in einigen Minuten erneut versuchen“. Unten Links zu Impressum und Datenschutz. Im Demo-Modus zusätzlich zwei große Knöpfe „Als Admin ansehen“ und „Als Mitarbeiter ansehen“.

### 4.2 Erste Anmeldung und Passwortwechsel
Der erste Admin kommt aus der `.env`. Neue Zugänge bekommen ein Startpasswort. In beiden Fällen ist beim ersten Anmelden ein neues Passwort Pflicht (mindestens 12 Zeichen, zweimal eingeben). Vorher ist nichts anderes erreichbar.

### 4.3 Benutzermenü (oben rechts)
Avatar (Initialen), Name und Rolle. Einträge: „Passwort ändern“ (altes und neues Passwort), „Abmelden“. Im Demo-Modus zusätzlich „Als Mitarbeiter ansehen“ bzw. „Als Admin ansehen“ (Wechsel auf den anderen Demo-Benutzer, danach Dashboard) und „Demo-Daten zurücksetzen“ (mit Bestätigung; setzt für alle zurück).

### 4.4 Rechtsseiten
- **Impressum** (`#/impressum`): öffentlich, Angaben aus der Datei `.impressum`, leere Felder entfallen. Fehlt die Datei, steht dort ein Hinweis für den Betreiber.
- **Datenschutz** (`#/datenschutz`): öffentlich, Inhalt aus `conf/datenschutz.md`. Fehlt die Datei, steht dort ein Hinweis für den Betreiber. Pitstop liefert keinen Mustertext.
- Pitstop setzt nur ein technisch notwendiges Sitzungs-Cookie und bindet keine externen Dienste ein (Schrift lokal); ein Cookie-Banner ist daher nicht vorgesehen.
- Die Links stehen auf der Anmeldeseite und unten in der Seitenleiste.

## 5. Layout und globale Elemente

### 5.1 Grundgerüst
- **Seitenleiste links, dunkel** (fast schwarz, helle Schrift): Logo (aus `conf/`, sonst Initialen) und Firmenname aus den Firmendaten (Fallback „Pitstop“). Darunter die Module mit Icon: Dashboard, Kunden, Finanzen, Personal, für Admin zusätzlich Einstellungen. Der aktive Eintrag ist hervorgehoben. Unten die Links Impressum und Datenschutz, im Demo-Modus das Demo-Banner.
- **Top-Bar** (hell, mit unterer Linie): links der Seitentitel mit Breadcrumb, in der Mitte die Suche, rechts „+ Neu“ und das Benutzermenü.
- **Inhaltsbereich** hell, Karten mit dezentem Rahmen und kleinem Radius, kaum Schatten. Vorbilder: Linear, Notion, Stripe.

### 5.2 Globale Suche (Cmd+K-Optik)
- Das Suchfeld sieht aus wie ein Eingabefeld mit Kürzel-Hinweis „⌘K“ (Mac) bzw. „Strg K“. Klick oder Tastenkürzel öffnet eine **Befehlspalette** als Overlay.
- Treffergruppen: Kunden (Name, Kundennummer, Ort, Ansprechpartner), Rechnungen (Nummer, Kunde; nur Admin), Mitarbeitende (Name, Rolle, Abteilung), Aktionen („Neue Rechnung“, „Neuer Kunde“, „Urlaub beantragen“, „Zu Finanzen wechseln“ …), jeweils nach Rolle gefiltert.
- Pfeiltasten, Enter öffnet (Kunde und Mitarbeiter im Drawer, Rechnung in der Vorschau), Esc schließt. Ohne Eingabe: Aktionen und zuletzt geöffnete Datensätze.

### 5.3 „+ Neu“
Knopf mit Dropdown, Einträge nach Rolle (Abschnitt 3). Jeder Eintrag öffnet das passende Modal. Nach dem Speichern erscheint ein Toast, z. B. „Rechnung #1187 erstellt“, mit dem Link „Öffnen“.

### 5.4 Rückmeldungen
- Toasts unten rechts für jede schreibende Aktion, nach etwa 4 Sekunden ausgeblendet. Fehler vom Server als roter Toast bzw. am Formularfeld.
- Leere Zustände mit Icon, einem Satz und, wo sinnvoll, einem Knopf („Noch keine Notizen. Erste Notiz anlegen“).
- Bestätigungsdialog bei Ablehnen eines Urlaubsantrags, Kundenstatus „Inaktiv“, Sperren eines Zugangs, Passwort zurücksetzen und „Demo-Daten zurücksetzen“.
- Sitzung abgelaufen: Hinweis und Weiterleitung zur Anmeldung; nach dem Anmelden geht es zurück zur vorherigen Seite.

## 6. Modul Dashboard

### 6.1 KPI-Karten (Admin)

| Karte | Definition | Zusatzzeile |
|---|---|---|
| Offene Rechnungen | Summe **brutto** aller Rechnungen mit Status offen oder überfällig | „davon X € überfällig“ (rot, wenn > 0) |
| Monatsumsatz | Summe **netto** aller Rechnungen mit Rechnungsdatum im laufenden Monat | Veränderung zum Vormonat in % (bis zum selben Tag) |
| Aktive Kunden | Anzahl Kunden mit Status Aktiv | „+N Leads“ |
| Anwesend heute | Aktive Mitarbeitende ohne Abwesenheit heute / alle aktiven | „X Urlaub, Y krank“ |

### 6.2 KPI-Karten (Mitarbeiter)
Aktive Kunden, Anwesend heute, **Mein Resturlaub** (Tage), **Meine Überstunden** (Saldo in Stunden).

### 6.3 Umsatz vs. Ausgaben (nur Admin)
Gruppiertes Balkendiagramm der letzten 6 Monate inklusive des laufenden. Umsatz = Netto der Rechnungen nach Rechnungsdatum, Ausgaben = Netto der Ausgaben nach Belegdatum. Tooltip mit Euro-Beträgen und Differenz, Monatsnamen kurz, laufender Monat mit „(lfd.)“. Die Mitarbeiter-Ansicht zeigt hier **„Abwesend diese Woche“** (Name, Art, Zeitraum).

### 6.4 Aufgaben & Freigaben
Größtenteils **aus den Daten abgeleitet** und dadurch immer aktuell:

| Quelle | Aufgabe | Aktion in der Zeile | Sichtbar für |
|---|---|---|---|
| Urlaubsantrag „beantragt“ | „Urlaubsantrag von Max Mustermann genehmigen (12.–16.01., 5 Tage)“ | Genehmigen / Ablehnen | Admin |
| Rechnung überfällig, Mahnstufe < 3, letzte Mahnung fehlt oder ist über 14 Tage alt | „Überfällige Rechnung #1042 mahnen (Hausverwaltung Sommer & Partner, 2.380,00 €, 23 Tage)“ | Mahnen | Admin |
| Lead ohne Kontakt seit > 14 Tagen | „Lead Bäckerei Hartl nachfassen“ | Öffnen (Kunden-Drawer) | Admin und zuständiger Mitarbeiter |
| Eigener Antrag entschieden | „Dein Urlaubsantrag (02.–06.03.) wurde genehmigt“ | Erledigt | Antragsteller |
| Manuelle Aufgabe | z. B. „Quartalsmeldung Berufsgenossenschaft prüfen“ | Abhaken | Admin; anlegen über ein Eingabefeld am Ende der Liste |

Sortierung: Freigaben, dann überfällige Rechnungen (älteste zuerst), dann der Rest. Erledigte verschwinden mit kurzer Animation; der Kartenkopf zeigt die Anzahl offener Aufgaben.

### 6.5 Erste Schritte (Echtbetrieb)
Solange Firmendaten, Mitarbeitende oder Kunden fehlen, zeigt das Dashboard dem Admin oben eine Checkliste: Firmendaten eintragen → Mitarbeitende anlegen → Zugänge anlegen → ersten Kunden anlegen → erste Rechnung schreiben. Jeder Punkt verlinkt direkt, erledigte sind abgehakt. Die Checkliste verschwindet, wenn alles erledigt ist, oder über „Ausblenden“.

## 7. Modul Kundenakten (CRM)

### 7.1 Kundenliste
- Tabelle: Kunde (Name und Kundenart), Kundennummer, Ort, Hauptansprechpartner, Status-Badge, offener Betrag (nur Admin), letzter Kontakt (relativ, z. B. „vor 3 Tagen“).
- **Suche** über Name, Kundennummer, Ort und Ansprechpartner, sofort beim Tippen.
- **Statusfilter** als Segment-Schalter mit Anzahl: Alle · Aktiv · Lead · Inaktiv. Zusätzlicher Filter Kundenart. Sortierung per Klick auf Name, Ort und letzten Kontakt.
- „Neuer Kunde“ (nur Admin).

### 7.2 Kunden-Drawer
Ein Klick auf eine Zeile öffnet einen Drawer von rechts (etwa 640 px; die Liste bleibt sichtbar, URL direkt aufrufbar). Kopf: Name, Kundennummer, Status-Badge (für Admin als Dropdown), Schnellaktionen „Rechnung erstellen“ (Kunde vorausgewählt) und „Notiz“. Tabs:

1. **Übersicht:** Anschrift, Telefon, E-Mail, USt-IdNr. (Gewerbe), Kundenart, Zahlungsziel, Kunde seit, zuständiger Mitarbeiter, Tags; Admin kann bearbeiten. Kennzahlen (nur Admin): Umsatz gesamt, offen, Anzahl Rechnungen.
2. **Ansprechpartner:** Karten mit Name, Funktion, Telefon, E-Mail; Hauptkontakt markiert. Admin kann hinzufügen.
3. **Historie:** Zeitleiste mit Notizen, Anrufen, E-Mails, Terminen und Systemeinträgen (z. B. „Mahnung Stufe 1 zu #1042“), neueste oben. Oben ein Eingabefeld mit Typauswahl (Notiz, Anruf, E-Mail, Termin) und „Speichern“ (Strg+Enter). Autor ist der angemeldete Benutzer.
4. **Rechnungen** (nur Admin): alle Rechnungen des Kunden mit Nummer, Datum, Brutto und Status, Summenzeile. Ein Klick öffnet die Rechnungsvorschau.

### 7.3 Neuer Kunde (Modal)
Pflicht: Name, Kundenart, Status (Default Lead), PLZ und Ort. Optional: Straße, Telefon, E-Mail, USt-IdNr., Zahlungsziel (Default aus den Firmendaten, sonst 14 Tage), zuständiger Mitarbeiter, erster Ansprechpartner. Die Kundennummer wird automatisch vergeben. Nach dem Speichern öffnet sich der Drawer des neuen Kunden.

## 8. Modul Finanzen (ERP)

Zwei Tabs: **Rechnungen** und **Ausgaben**, jeweils mit drei kleinen Summen im Kopf (z. B. offen, überfällig, bezahlt in diesem Monat).

### 8.1 Rechnungsliste
- Spalten: Nummer (#1042), Kunde, Rechnungsdatum, fällig am, Netto, Brutto, Status-Badge, Aktionen.
- **Status:** *Bezahlt* (grün), *Offen* (gelb), *Überfällig* (rot, „seit X Tagen“). „Überfällig“ wird berechnet (offen und Fälligkeit vor heute). Mahnstufe als Zusatz „M1“ bis „M3“.
- Filter Alle · Offen · Überfällig · Bezahlt; Suche nach Nummer oder Kunde; Zeitraum (dieser Monat, letzte 3 Monate, alle).
- Zeilenaktionen: „Als bezahlt markieren“ (Datum heute), „Mahnen“ (nur überfällig; Mahnstufe +1 bis 3, Systemeintrag in der Kundenhistorie), „Kunde öffnen“.
- **Rechnungsvorschau** im Drawer: Briefkopf aus den Firmendaten, Empfänger, Positionen, Summen, Zahlungsziel, Bankverbindung, Fußtext, Status-Historie. Rein lesend.

### 8.2 Neue Rechnung (Modal)
- **Kunde:** durchsuchbare Auswahl (Aktiv und Lead). Aus dem Kunden-Drawer vorausgewählt.
- **Rechnungsdatum** (Default heute), **Zahlungsziel** in Tagen (Default vom Kunden), daraus „fällig am“.
- **Positionen** als editierbare Tabelle: Beschreibung, Menge (Dezimalkomma, z. B. 2,5), Einheit (Std., Stk., m, pauschal), Einzelpreis netto, Zeilensumme. „Position hinzufügen“, Zeile entfernen (mindestens eine bleibt). Vorlagen-Dropdown mit typischen Positionen (z. B. „Arbeitszeit Monteur, Std., 68,00 €“, „Anfahrtspauschale, pauschal, 45,00 €“).
- **Summenblock** live: Netto, zzgl. 19 % MwSt., **Brutto**.
- Validierung: Kunde gewählt, jede Position mit Beschreibung, Menge > 0, Preis ≥ 0, Brutto > 0. Fehler am Feld; „Speichern“ erst danach aktiv. Der Server prüft dasselbe noch einmal.
- Speichern vergibt die nächste Rechnungsnummer, Status Offen. Die Rechnung ist sofort sichtbar in der Liste, im Kunden-Drawer, in „Offene Rechnungen“ und je nach Datum im Monatsumsatz und Diagramm.

### 8.3 Ausgaben
- Spalten: Belegdatum, Lieferant, Kategorie (farbiges Badge), Beschreibung, Netto, MwSt.-Satz, Brutto, bezahlt.
- Kategorien: Material, Fahrzeuge, Miete & Nebenkosten, Löhne & Gehälter, Werkzeug & Maschinen, Versicherungen, Büro & IT, Sonstiges.
- Filter nach Kategorie und Zeitraum, Suche nach Lieferant, kleine Aufteilung „Ausgaben nach Kategorie“.
- **Neue Ausgabe** (Modal): Datum, Lieferant, Kategorie, Beschreibung, Netto, MwSt.-Satz (19 %, 7 %, 0 %), bezahlt; Brutto wird angezeigt.

## 9. Modul Mitarbeiter & Personal (HR)

Zwei Tabs: **Verzeichnis** und **Urlaub & Abwesenheiten**.

### 9.1 Mitarbeiterverzeichnis
- Kartenraster (Default) oder Tabelle. Karte: **Foto-Platzhalter** (Kreis mit Initialen, Farbe fest aus dem Namen), Name, Rolle, Abteilung, Stundensatz (nur Admin), Status-Badge *Im Dienst* (grün), *Urlaub* (blau), *Krank* (rot).
- Der Status wird aus den Abwesenheiten **berechnet**: Krankmeldung heute → Krank; sonst genehmigter Urlaub heute → Urlaub; sonst Im Dienst.
- Suche nach Name oder Rolle, Filter nach Abteilung und Status; ausgeschiedene Mitarbeitende nur mit „Ausgeschiedene anzeigen“.
- **Neuer Mitarbeiter** (Admin, Modal): Vorname, Nachname, Rolle/Position, Abteilung, E-Mail, Telefon, Vertragsart, Wochenstunden, Stundensatz, Eintrittsdatum, Urlaubsanspruch, Übertrag, Probezeit bis, befristet bis, Vorgesetzte(r). Die Personalnummer wird automatisch vergeben.

### 9.2 Digitale Personalakte (Drawer)
Kopf: Avatar, Name, Rolle, Abteilung, Status, Personalnummer, Hinweis „Zugang: aktiv (E-Mail)“ bzw. „kein Zugang“. Aktionen (Admin): Bearbeiten, Krank melden, Urlaub eintragen, Stunden erfassen, Ausgeschieden markieren. Tabs:

1. **Stammdaten & Vertrag:** E-Mail, Telefon, Eintritt, Betriebszugehörigkeit, Vertragsart, Wochenstunden, Stundensatz, Probezeit bis, befristet bis, Vorgesetzte(r).
2. **Urlaub:** Jahresanspruch, Übertrag, genommen, geplant (genehmigt, Zukunft), beantragt, **Resturlaub**, Fortschrittsbalken, alle Anträge des Jahres.
3. **Stunden:** Soll und Ist des laufenden Monats, Überstundensaldo, Balkendiagramm Soll/Ist der letzten 6 Monate. Admin erfasst Soll und Ist je Monat; das Soll ist mit Wochenstunden × Arbeitstage / 5 vorbelegt.

Mitarbeiter sehen bei Kollegen nur die **Kontaktkarte** (Name, Rolle, Abteilung, Telefon, E-Mail, Status).

### 9.3 Urlaub & Abwesenheiten
- Liste: Mitarbeiter, Art (Urlaub, Krank), Zeitraum, Arbeitstage, Kommentar, beantragt am, Status-Badge (*Beantragt* gelb, *Genehmigt* grün, *Abgelehnt* grau). Filter nach Status, Beantragte zuerst.
- Admin: **„Genehmigen“** und **„Ablehnen“** (mit optionaler Begründung). Wirkt sofort auf Badge, Resturlaub, Status im Verzeichnis (wenn der Zeitraum heute einschließt), Dashboard-Aufgaben und „Anwesend heute“.
- **Urlaub beantragen** (Modal): Mitarbeiter (nur Admin wählbar), von, bis, Kommentar. Angezeigt: Arbeitstage (Mo–Fr) und Resturlaub danach. Validierung: „bis“ nicht vor „von“, mindestens ein Arbeitstag, keine Überschneidung mit eigenen genehmigten oder beantragten Zeiträumen; Warnung (kein Fehler), wenn der Resturlaub nicht reicht.
- **Krank melden** (Admin): von, bis (Default heute), sofort gültig.
- Nice-to-have: kompakte Monats-Zeitleiste aller Abwesenheiten.

## 10. Einstellungen (nur Admin)

### 10.1 Firmendaten
Firmenname, Anschrift, Telefon, E-Mail, Website, USt-IdNr., Steuernummer, Bank, IBAN, BIC, Standard-Zahlungsziel, Fußtext für Rechnungen. Verwendet in Seitenleiste, Rechnungsvorschau und als Default für neue Kunden. Das Logo kommt aus `conf/` (siehe README).

### 10.2 Benutzer
- Liste: Name, E-Mail, Rolle, verknüpfter Mitarbeiter, Status (aktiv, gesperrt, Passwortwechsel offen), letzte Anmeldung.
- **Zugang anlegen** (Modal): Mitarbeiter verknüpfen (Pflicht für die Rolle Mitarbeiter, E-Mail und Name werden übernommen), E-Mail, Anzeigename, Rolle. Pitstop erzeugt ein Startpasswort und zeigt es **einmal** zum Kopieren an.
- Aktionen: Rolle ändern, sperren/entsperren (beendet alle Sitzungen), Passwort zurücksetzen (neues Startpasswort, einmal sichtbar).
- Der letzte aktive Admin kann weder gesperrt noch zum Mitarbeiter gemacht werden.

## 11. Demo-Daten (nur Demo-Modus)

| Bereich | Umfang | Hinweise |
|---|---|---|
| Mitarbeitende | 18 | GF 1, Verwaltung 3, Kundendienst 4, Montage 6, Planung 2, Lager 1, dazu 1 Auszubildender in der Montage. Stundensätze 15–48 € |
| Kunden | 32 | 20 Aktiv, 7 Leads, 5 Inaktiv; Privat, Gewerbe, Hausverwaltung und Öffentliche Hand im Raum Regensburg |
| Ansprechpartner | 1–3 je Gewerbe- oder Verwaltungskunde | Privatkunden: die Person selbst |
| Notizen | 2–8 je Kunde | Realistisch („Angebot Wärmepumpe besprochen, Rückruf KW 48“) |
| Rechnungen | ca. 20–30 je Monat über 6 Monate | Ab #1001; ältere fast alle bezahlt, jüngere offen, einige überfällig |
| Ausgaben | ca. 15–25 je Monat | Löhne monatlich als Sammelposten, Material häufig, Miete und Leasing fix |
| Abwesenheiten | ca. 25 | Vergangene genehmigte Urlaube, 3 beantragte, 1 abgelehnter, aktuelle Krankmeldung |
| Stunden | 6 Monate je Mitarbeitendem | Ist schwankt um das Soll von −8 bis +15 Stunden |
| Manuelle Aufgaben | 3–5 | Für Admin |
| Firmendaten | vollständig | Lindner Haustechnik GmbH mit Beispiel-Bankverbindung |

**Typische Rechnungsinhalte** (auch für die Positionsvorlagen): Heizungswartung (180–450 €), Notdienst Rohrbruch (300–1.200 €), Austausch Therme (6.000–12.000 €), Badsanierung (8.000–25.000 €), Wärmepumpe inklusive Montage (18.000–35.000 €), Wartungsvertrag Hausverwaltung (Pauschale je Objekt). Gewerbe- und Verwaltungskunden zahlen eher spät, Privatkunden eher pünktlich.

**Regeln:**
- Alles erfunden: keine echten Firmen, Personen, IBANs oder Steuernummern; offensichtliche Beispielwerte (USt-IdNr. `DE123456789`, Domains auf `.example`).
- Zeitbezogene Daten liegen **relativ zum Tag des Seeds** und sind deterministisch (gleicher Tag, gleiche Daten).
- Plausible Kennzahlen: Monatsumsatz netto 120.000–180.000 €, Ausgaben meist 10–25 % darunter; ein Verlustmonat ist erlaubt.

## 12. Sprache, Formate, Ton

- Oberfläche vollständig deutsch mit echten Umlauten. Möglichst ohne Anrede („Rechnung erstellen“, „Noch keine Notizen“); wo nötig, in der Du-Form.
- Beträge in de-DE: `1.234,56 €`. Datum `19.11.2026`, in Listen auch relativ („vor 3 Tagen“). Kalenderwochen nach ISO.
- Zahlen in Tabellen rechtsbündig mit Tabellenziffern.
- Statusfarben überall gleich: Grün = gut/erledigt, Gelb = offen/wartend, Rot = Problem, Blau = Info/Urlaub, Grau = inaktiv.

## 13. Drehbücher (Abnahmetests)

### 13.1 Demo-Modus
Voraussetzung: `DEMO_MODE=true`, frisch gestartet.

1. Anmeldeseite → „Als Admin ansehen“. Dashboard mit 4 KPIs, dem Diagramm über 6 Monate und den Aufgaben, darunter Max Mustermanns Urlaubsantrag und die überfällige Rechnung #1042.
2. Beim Urlaubsantrag „Genehmigen“ klicken: Die Aufgabe verschwindet, ein Toast erscheint. Unter Personal → Urlaub steht der Antrag auf Genehmigt, in Max' Personalakte ist der Resturlaub um 5 Tage kleiner.
3. Bei #1042 „Mahnen“ klicken: Die Aufgabe verschwindet, die Rechnung zeigt M1. In der Historie von „Hausverwaltung Sommer & Partner GmbH“ steht der Systemeintrag.
4. Strg+K, „Sommer“, Enter: Der Kunden-Drawer öffnet sich. Eine Notiz vom Typ Anruf anlegen; sie steht oben in der Historie.
5. Im Drawer „Rechnung erstellen“: Der Kunde ist vorausgewählt. Zwei Positionen anlegen (eine per Vorlage, eine mit Menge 2,5) und die Summen prüfen (Netto + 19 % = Brutto, centgenau). Nach dem Speichern steht die Rechnung im Drawer-Tab, in Finanzen → Rechnungen als Offen, und „Offene Rechnungen“ ist gestiegen.
6. Finanzen → Ausgaben: eine Ausgabe im laufenden Monat anlegen; der Ausgaben-Balken im Dashboard wächst.
7. Kunden → „Neuer Kunde“ als Lead anlegen, Filter „Lead“ prüfen.
8. Benutzermenü → „Als Mitarbeiter ansehen“ (Jonas Weber): Finanzen und Einstellungen fehlen, `#/finanzen` zeigt „Kein Zugriff“, Stundensätze sind ausgeblendet, das Dashboard zeigt die Mitarbeiter-KPIs. „+ Neu → Urlaubsantrag“ für nächste Woche stellen.
9. Zurück zu Admin: Der Antrag von Jonas steht in den Aufgaben. Mit Begründung ablehnen.
10. Seite neu laden und in einem zweiten Browser öffnen: Alle Änderungen sind da. „Demo-Daten zurücksetzen“ stellt den Ausgangszustand wieder her.

### 13.2 Echtbetrieb
Voraussetzung: frischer Klon, Installation genau nach README mit `DEMO_MODE=false`.

1. Die Anmeldeseite zeigt keine Demo-Knöpfe; das Impressum zeigt die Angaben aus `.impressum`, die Datenschutzseite den Hinweis (keine `conf/datenschutz.md`).
2. Anmelden mit `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Der Passwortwechsel ist Pflicht; danach erscheint das leere Dashboard mit „Erste Schritte“.
3. Firmendaten eintragen; der Firmenname steht in der Seitenleiste.
4. Mitarbeiter anlegen, dann unter Einstellungen → Benutzer einen Zugang (Rolle Mitarbeiter) anlegen und das Startpasswort kopieren.
5. Kunden anlegen, Rechnung schreiben. Die Vorschau zeigt Firmendaten und Bankverbindung.
6. In einem privaten Fenster als Mitarbeiter anmelden, Passwort wechseln. Finanzen fehlt, `GET /api/bootstrap` enthält keine Rechnungen und keine Stundensätze. Urlaub beantragen.
7. Als Admin genehmigen; beim Mitarbeiter erscheint „Dein Urlaubsantrag wurde genehmigt“.
8. Admin sperrt den Zugang; die nächste Aktion des Mitarbeiters führt zur Anmeldeseite.
9. `docker compose exec app pitstop reset-password <admin-email>` liefert ein Startpasswort, das funktioniert.
10. Backup ziehen, Daten ändern, Backup zurückspielen: Der Stand des Backups ist wieder da.
11. Update: eine kleine Änderung committen, auf dem Server `git pull` und `docker compose up -d`. Die Änderung ist sichtbar, die Daten sind erhalten.
12. Löschen nach README: Danach ist Pitstop vollständig entfernt bzw. startet wie neu.

## 14. Offene Entscheidungen (mit gewähltem Default)

| # | Frage | Default / Entscheidung |
|---|---|---|
| E1 | Branche der Demo-Daten: SHK-Betrieb oder z. B. Kfz-Werkstatt (passt zum Namen „Pitstop“)? | SHK-Betrieb „Lindner Haustechnik GmbH“ |
| E2 | Produktname in der Oberfläche | Seitenleiste: Firmenname aus den Firmendaten (Fallback „Pitstop“); Fenstertitel „Pitstop – Business OS“ |
| E3 | Detailansichten als Drawer oder eigene Seite? | Drawer, per URL direkt aufrufbar |
| E4 | Netto oder brutto für den Monatsumsatz? | Netto (Umsatz); offene Posten brutto (Forderung) |
| E5 | Feiertage bei der Urlaubsberechnung? | Nein, nur Mo–Fr; bayerische Feiertage als Nice-to-have |
| E6 | Git-Repository und Remote | **Entschieden 2026-11-19:** `https://github.com/ZockerDream/pitstop.git` (Push per SSH). Commit und Push nur auf Anweisung |
| E7 | Betrieb per Docker? | **Entschieden 2026-11-19:** ja, Docker Compose mit `app` und `db` |
| E8 | Anmeldung | **Entschieden 2026-11-19:** echte App mit Login; Demo-Daten und Rollenwechsel nur im Demo-Modus |
| E9 | Datenbank | **Entschieden 2026-11-19:** neueste PostgreSQL, derzeit 18 (19 ist noch RC) |
| E10 | Standard für `DEMO_MODE` in `.env-example` | `false` (sicher für echte Daten); die README erklärt den Demo-Modus |
| E11 | HTTPS | Nicht in Pitstop; Reverse-Proxy des Betreibers (README) |
| E12 | Rechnungen korrigieren | Erste Version ohne Bearbeiten/Löschen; Storno als spätere Ausbaustufe |
| E13 | Datenschutzerklärung | Betreiber legt `conf/datenschutz.md` ab; kein Mustertext von Pitstop |

Entscheidet der Auftraggeber anders, wird die Tabelle aktualisiert und die Änderung in [AGENTS.md](AGENTS.md) protokolliert.

## 15. Auftrag (Kurzfassung und Verlauf)

- **2026-11-19, Ausgangsauftrag:** Modernes, interaktives Frontend für ein All-in-One-ERP/CRM „Business OS“ mit React, Vite, TypeScript, Tailwind CSS, `lucide-react` und `recharts`. Realistische deutsche Dummy-Daten eines mittelständischen Handwerks- oder Dienstleistungsbetriebs; Anlegen von Kunden, Rechnungen und Urlaubsanträgen funktioniert live. Helles, cleanes Design im Stil von Linear, Notion oder Stripe mit dunkler Seitenleiste; Top-Bar mit Cmd+K-Suche, „+ Neu“ und Profilwechsel Admin/Mitarbeiter. Vier Module wie in den Abschnitten 6–9. Ordnerstruktur mit `components/`, `data/mockData.ts` (jetzt `server/demo/`) und `types/` (jetzt `shared/types.ts`); keine Platzhalter im Code; am Ende läuft die App.
- **2026-11-19, Erweiterung:** Betrieb per Docker Compose, Datenbank ist die neueste PostgreSQL. Setup über `git clone`, `.env-example` → `.env`, `.impressum-example` → `.impressum`, `docker compose up -d`; Update nur über `git pull` und `docker compose up -d`. Daten unter `./data`, `./logs`, `./db` und `./conf`. README mit Projektbeschreibung und Anleitung für Setup, Update, Backup und Löschen. Echte Anmeldung statt simuliertem Rollenwechsel.
