# Pitstop – Arbeitsstand für KI-Agenten

Diese Datei ist das **Übergabeprotokoll**. Läuft das Limit einer Sitzung ab, macht die nächste Sitzung genau hier weiter. [CLAUDE.md](CLAUDE.md) lädt diese Datei automatisch mit. Fachliches steht in [CONCEPT.md](CONCEPT.md), Technisches in [TECHNICAL.md](TECHNICAL.md), Betrieb in [README.md](README.md).

## ▶ Aktueller Stand

| | |
|---|---|
| **Zuletzt aktualisiert** | 2026-11-20 |
| **Phase** | **Phase 15 – Version 0.5 (Anbindungen, Rest)**. Auftrag „mach alles“ 2026-11-20 schließt Commit + Push ein |
| **Aktiver Schritt** | 15.5 Docker :7077, Winchester-Prüfung, Commit + Push, Klon-Test, Graphify |
| **Nächster Schritt** | Rückmeldung des Auftraggebers. Nicht gebaut (bewusst, steht unter Anbindungen als geplant/Idee): Fotos bei der Annahme, Discord-Login, Zwei-Faktor, FiveM-Anbindungen |
| **Halbfertige Dateien** | keine |
| **Laufende Dienste** | Docker-Stack `pitstop` auf http://localhost:7077 (Version 0.5, `DEMO_MODE=false`). Testdaten Winchester Motorsport per `/root/testdaten-winchester/seed-pitstop-0.2.mjs` + `seed-pitstop-0.3.mjs` + `seed-pitstop-0.4.mjs` (außerhalb des Repos; Sicherungen vor 0.3/0.4/0.5: `/root/pitstop-backups/vor-0.3-2026-11-20.dump`, `vor-0.4-…`, `vor-0.5-…`); automatische Sicherung täglich ab 4 Uhr in `data/backups`; alle @winchester-group.com-Konten gemeinsames Testpasswort (steht in den Seed-Skripten, nicht im Repo), Derrik ist Server-Admin und Inhaber. Test-Datenbank `pitstop_dev` im selben Postgres (nur für Dev-Server/Tests, Port 3100, derzeit gestoppt) |
| **Blocker / Fragen an den Auftraggeber** | keine. Die Defaults in CONCEPT.md Abschnitt 14 gelten, solange nichts anderes gesagt wird. |
| **Git** | `origin` = `git@github.com:ZockerDream/pitstop.git` (öffentlich lesbar über https). **Hauptbranch `develop`** (Code und Doku); `main` enthält nur den ersten Doku-Commit. Autor: `ZockerDream <69266888+ZockerDream@users.noreply.github.com>` (repo-lokal gesetzt) |

## Regeln für diese Datei

1. **Vor** Beginn eines Schritts: „Aktiver Schritt“ setzen und notieren, was genau geplant ist.
2. **Nach** jedem abgeschlossenen Schritt sofort abhaken, „Nächster Schritt“ setzen und eine Zeile ins Protokoll schreiben. Nicht bis zum Phasenende warten, das Limit kann jederzeit kommen.
3. Ist eine Datei halb fertig, unter „Halbfertige Dateien“ eintragen, mit dem fehlenden Teil (z. B. „`server/demo/seed.ts`: Kunden fertig, Rechnungen fehlen“).
4. Neue Fallstricke kommen nach [TECHNICAL.md](TECHNICAL.md) Abschnitt 15, neue Dateien in den Graph in [CLAUDE.md](CLAUDE.md).
5. Kurz halten: Das Protokoll hält fest, was passiert ist, nicht wie (das zeigt der Code).

## Einstieg in eine neue Sitzung

1. „Aktueller Stand“ oben lesen.
2. Den echten Stand prüfen, nicht nur dieser Datei glauben: `git status -sb` und `git log --oneline -5` (sobald ein Repository existiert), `ls src/*`, `npm run typecheck`.
3. Was läuft? `docker compose ps` und `ss -ltn | grep -E ':(3000|5173|8080|5432)'`.
4. Weicht der Code von dieser Datei ab (z. B. weil die letzte Sitzung mitten im Schritt endete), zuerst diese Datei korrigieren, dann weitermachen.
5. Im Phasenplan den nächsten offenen Schritt nehmen.

## Arbeitsweise

- **Nur in `/opt/docker/pitstop` arbeiten.** Andere Ordner unter `/opt/docker` (z. B. `Portainer`, `budget-manager`) nicht lesen, nicht als Vorlage nehmen, nicht ändern und in der Doku nicht erwähnen. Pitstop ist ein eigenständiges Projekt. Ausnahme: prüfen, ob ein Port frei ist.
- Mit dem Auftraggeber **auf Deutsch** kommunizieren; Oberfläche und Doku deutsch mit echten Umlauten, Code-Bezeichner englisch (Glossar in CLAUDE.md).
- Keine Platzhalter im Code („TODO: hier Code einfügen“, Lorem ipsum, tote Knöpfe). Was fehlt, steht im Phasenplan, nicht im Code.
- Keine Abhängigkeiten außer denen in TECHNICAL.md Abschnitt 2, ohne vorher zu fragen.
- Rechte immer **serverseitig** prüfen; die Oberfläche blendet nur zusätzlich aus.
- Bei Funktionsänderungen mitpflegen: CONCEPT.md, TECHNICAL.md, README.md (wenn Betrieb oder Konfiguration betroffen sind), CLAUDE.md (Graph) und diese Datei.
- `.env` und `.impressum` enthalten Zugangsdaten bzw. echte Angaben und werden nie committet; Änderungen nur in `.env-example` und `.impressum-example`.
- Git: Commit und Push nur auf Anweisung.
- Ergebnisse ehrlich berichten: Was nicht getestet wurde, wird so genannt.

## Phasenplan

Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt. **Fertig wenn** = Abnahmekriterium der Phase.

### Phase 0 – Doku ✅
- [x] 0.1 CONCEPT.md, TECHNICAL.md, AGENTS.md, CLAUDE.md
- [x] 0.2 README.md (Projekt, Setup, Update, Backup, Wiederherstellen, Löschen); Architektur auf Server, Postgres, Docker und Login umgestellt
- [x] 0.3 Git-Repository verbunden, Doku initial gepusht

### Phase 1 – Projektgerüst
- [x] 1.1 `.gitignore` (`node_modules`, `dist`, `.env`, `.impressum`, `data/`, `logs/`, `db/`, `conf/`), `.dockerignore`
- [x] 1.2 Vite-`react-ts` in `/tmp/pitstop-scaffold` erzeugen; nur die benötigten Teile übernehmen und auf `src/client`, `src/server`, `src/shared` umbauen (Vite `root: 'src/client'`, `outDir: '../../dist/client'`, Proxy `/api`)
- [x] 1.3 Abhängigkeiten nach TECHNICAL.md Abschnitt 2 installieren; Tailwind v4, Inter; installierte Versionen in TECHNICAL.md eintragen
- [x] 1.4 tsconfigs (client, server; strict, `moduleResolution: bundler`), Skripte `dev:server`, `dev:client`, `build` (vite + esbuild + Migrationen kopieren), `typecheck`, `lint`, `start`
- [x] 1.5 `.env-example` und `.impressum-example` mit allen Variablen aus der README (inklusive Kommentaren)
- **Fertig wenn:** `npm run build` und `npm run typecheck` grün; `npm run dev:client` zeigt eine Seite mit Tailwind-Klasse und Inter-Schrift.

### Phase 2 – Server, Datenbank, Docker
- [x] 2.1 `server/config.ts` (zod, deutsche Fehlermeldungen), `logger.ts` (stdout + `logs/app`)
- [x] 2.2 `db/pool.ts` (Typ-Parser), `db/migrate.ts`, `migrations/001_init.sql` (komplettes Schema nach TECHNICAL.md 6.2)
- [x] 2.3 `db/init.ts` (Warten auf die DB, Migrationen, Admin aus `.env`, Marker `data/.initialized`, Schutz bei leerer DB)
- [x] 2.4 `main.ts`: Fastify, helmet, cookie, Static für `dist/client`, `GET /api/health`, Fehlerformat
- [x] 2.5 `Dockerfile`, `docker/entrypoint.sh`, `docker/pitstop`, `docker-compose.yml`, `compose.dev.yml`
- [x] 2.6 `cli.ts` (`reset-password`)
- **Fertig wenn:** Aus einem frischen Klon in `/tmp` startet `docker compose -p pitstop-test up -d` (mit eigenem Port) beide Dienste `healthy`; `./db`, `./data`, `./logs` werden befüllt; ein zweites `up -d` ohne Änderung erstellt nichts neu; nach einer Codeänderung baut `up -d` neu.

### Phase 3 – Anmeldung und Konto
- [x] 3.1 `auth/password.ts` (scrypt), `auth/sessions.ts`, `auth/guards.ts`, Origin-Prüfung, Rate-Limit
- [x] 3.2 Routen `auth/login`, `logout`, `me`, `password`; Pflicht zum Passwortwechsel
- [x] 3.3 `shared/permissions.ts`, `shared/types.ts` (vollständig)
- [x] 3.4 Client: `lib/api.ts`, `lib/router.ts`, `LoginPage`, `ChangePasswordModal`, Weiterleitung bei 401/403
- [x] 3.5 Rechtsseiten: `GET /api/public/legal`, `ImpressumPage`, `DatenschutzPage`; `GET /api/public/logo`
- **Fertig wenn:** Login, Logout, erzwungener Passwortwechsel und „Angemeldet bleiben“ funktionieren; falsche Logins werden gedrosselt; Impressum zeigt die `.impressum`-Werte.

### Phase 4 – Fundament Daten und Oberfläche
- [x] 4.1 `shared/`: `money`, `dates`, `format`, `labels`, `selectors`
- [x] 4.2 `server/repo/*` und `GET /api/bootstrap` mit Rollenfilter und Feldfiltern
- [x] 4.3 Client-Store (`AppStore`, `reducer`, `mutations`), Abgleich bei Tab-Fokus und alle 60 s
- [x] 4.4 `components/ui/*` Basisbausteine
- [x] 4.5 Layout: `Sidebar`, `TopBar`, `UserMenu`, `NoAccess`, Modal-Host, Toasts, Routen-Switch mit leeren Modulansichten
- [x] 4.6 Demo-Modus: `server/demo/` (templates, random, seed), `POST /api/demo/login`, `POST /api/demo/reset`, Demo-Knöpfe und Banner
- **Fertig wenn:** Mit `DEMO_MODE=true` ein-Klick-Login als beide Personas; Navigation zwischen allen Modulen; als Mitarbeiter fehlen Finanzen und Einstellungen, auch im Bootstrap; `typecheck` grün.

### Phase 5 – Dashboard
- [x] 5.1 KPI-Karten Admin/Mitarbeiter (CONCEPT.md 6.1/6.2)
- [x] 5.2 Diagramm Umsatz vs. Ausgaben bzw. „Abwesend diese Woche“
- [x] 5.3 Aufgaben & Freigaben inklusive manueller Aufgaben (API `tasks`)
- [x] 5.4 „Erste Schritte“ im Echtbetrieb
- **Fertig wenn:** Drehbuch 13.1 Schritt 1 stimmt; die Aktionen in der Liste funktionieren, sobald die jeweiligen APIs aus Phase 6–8 stehen.

### Phase 6 – Kundenakten (CRM)
- [x] 6.1 API `customers`, `contacts`, `notes`
- [x] 6.2 Kundenliste mit Suche, Statusfilter mit Zählern, Kundenart-Filter, Sortierung
- [x] 6.3 Kunden-Drawer mit Tabs; Notiz anlegen; Statuswechsel und Bearbeiten (Admin)
- [x] 6.4 Modal „Neuer Kunde“
- **Fertig wenn:** Drehbuch 13.1 Schritte 4 und 7.

### Phase 7 – Finanzen (ERP)
- [x] 7.1 API `invoices` (anlegen, bezahlt, mahnen mit Systemnotiz in einer Transaktion), `expenses`
- [x] 7.2 Rechnungstabelle, Filter, Zeilenaktionen, Rechnungsvorschau mit Firmendaten
- [x] 7.3 Modal „Neue Rechnung“ (Kunden-Combobox, Positionseditor, Vorlagen, Live-Summen, Validierung)
- [x] 7.4 Ausgabentabelle, Kategorie-Aufteilung, Modal „Neue Ausgabe“
- **Fertig wenn:** Drehbuch 13.1 Schritte 3, 5 und 6; Netto + 19 % = Brutto in drei Stichproben centgenau; Mitarbeiter erhalten 403 auf allen Finanz-Routen.

### Phase 8 – Personal (HR)
- [x] 8.1 API `employees` (anlegen, bearbeiten, Monatsstunden), `absences` (anlegen, entscheiden, zurückziehen, gesehen)
- [x] 8.2 Verzeichnis (Karten und Tabelle), Status, Filter; Modal „Neuer Mitarbeiter“
- [x] 8.3 Personalakte mit drei Tabs; Kontaktkarte für Mitarbeiter; Modal „Stunden erfassen“
- [x] 8.4 Urlaub & Abwesenheiten; Modals „Urlaub beantragen“ und „Krank melden“
- **Fertig wenn:** Drehbuch 13.1 Schritte 2, 8 und 9.

### Phase 9 – Einstellungen und globale Funktionen
- [x] 9.1 Einstellungen → Firmendaten (API `settings/company`)
- [x] 9.2 Einstellungen → Benutzer (API `users`, Startpasswort einmal anzeigen, Schutz des letzten Admins)
- [x] 9.3 Befehlspalette (Strg/⌘+K)
- [x] 9.4 „+ Neu“-Menü nach Rolle, Toasts mit „Öffnen“
- **Fertig wenn:** Drehbuch 13.2 Schritte 2–8.

### Phase 15 – Version 0.5: Anbindungen und Rest ⏳
Auftrag 2026-11-20 („mach alles“ auf die Liste der offenen Punkte nach 0.4).
- [x] 15.1 Migration 006: Fotos je Auftrag (Dateien in `data/photos`), Zwei-Faktor (TOTP, ohne neue Pakete), Discord-Verknüpfung (`users.discord_id`), Spiel-ID je Mitglied, Spielserver-Schlüssel je Firma
- [x] 15.2 Server: Foto-Upload/-Abruf, 2FA (einrichten, bestätigen, abschalten, Login mit Code, CLI), Discord-OAuth (Login nur für verknüpfte Konten, `DISCORD_*` in `.env`), Spielserver-API `/api/game/*` (Dienst, Notruf → Einsatz, Zahlung → Rechnung, Runden, Fahrzeugabfrage)
- [x] 15.3 Client: Fotos bei Annahme/Auftrag, 2FA und Discord unter Mein Konto, Login mit Code/Discord, Spielserver-Schlüssel und Spiel-ID unter Firma
- [x] 15.4 FiveM-Ressource `fivem/pitstop` (Lua), Doku
- [ ] 15.5 Tests (API inkl. Discord-Attrappe, Browser), Auto-Sicherung über Tageswechsel, Login-Prüfung Winchester, Docker :7077, Commit + Push, README-Test aus frischem Klon von GitHub, Graphify voll

### Phase 14 – Version 0.4: restliches Mockup ✅
Auftrag 2026-11-20 („ja“ auf: alle 21 fehlenden Mockup-Seiten plus Querschnitt als 0.4). Vergleich Mockup-Navigation ↔ `lib/nav.ts`.
- [x] 14.1 Migration 005 (Tabellen für alles unten; Konten Trinkgeld/Rennteam; Angebote; Annahme-Daten am Auftrag; Fixum; Freitextfragen), neue Bereiche in `shared/permissions.ts` (werkzeug, hallenplan, fuhrpark, vertraege, nachrichten, bewerbungen, raenge, preisliste, regelwerk, pinnwand), Vorlagengruppen nachziehen
- [x] 14.2 Server: generisches CRUD (`routes/crud.ts`) + Fachrouten (`routes/more.ts`): Annahme → Auftrag, Hallenplan, Werkzeug, Fuhrpark + Fahrtenbuch, Rennwagen, Meisterschaft, Setups, Runden/Sektoren, Trackday-Buchungen, Rahmenverträge (Rabatt im Konfigurator), Nachrichten, Ränge (Befördern mit Gruppen/Lohn), Bewerbungen (Einstellen → Konto), Abwesenheiten, Stempel-Nachträge, Schulungstermine, Freitext-Bewertung, Lizenzen, Kassenabschluss, Daueraufträge, Trinkgeld, Finanzziele, Preisliste (Nachweis-Pflicht am Auftrag), Regelwerk mit Bestätigung, Pinnwand mit Umfrage, Live-Feed (Protokoll nach Rechten), Lager-Bestellungen/Verbrauch, Angebote/Mahnung, Webhooks (Discord), Server: Einstellungen (Wartungsmodus, Standard-Module, Sicherungsplan), Anbindungen (Katalog, Wünsche, API-Schlüssel, öffentliche API `/api/v1`)
- [x] 14.3 Client-Seiten: feed, annahme, hallenplan, werkzeug, einsaetze, fuhrpark, team, telemetrie, trackdays, vertraege, nachrichten, raenge, bewerbungen, pruefungen, finanzen, kasse, auswertung, preisliste, regelwerk, pinnwand, srv-anbind, srv-einst
- [x] 14.4 Querschnitt: mehrere benannte Arbeitsflächen, Vorschau als Person, Suche (Strg+K, Kennzeichen-Abgleich), Meldungen, Widgets
- [x] 14.5 Demo-Seed, Tests (API + Browser), Doku, Docker :7077 (vorher sichern), Winchester-Daten, Graphify

### Phase 13 – Version 0.3: restliche Module ✅
Auftrag 2026-11-20 („setz alles um“): alle offenen Punkte aus dem Abschlussbericht 0.2.
- [x] 13.1 Aufräumen: `tests/e2e/echtbetrieb.mjs` löschen, ungenutzte Pakete raus (lucide-react, recharts, marked, Tailwind), Mockup-Schriften (Chakra Petch, Manrope, JetBrains Mono über @fontsource)
- [x] 13.2 Migration 004 + Server: Lager, Dienstplan, Lohn (Stundenlohn, Provision, Lohnlauf → Buchung), Schulungen (Kurse, Test serverseitig gewertet, Nachweise), Tuning (Preisliste/Pakete, Konfigurator → Auftrag, Prüfstand), Racing (Events, Starter, Zeiten, Bestenliste)
- [x] 13.3 Client-Seiten dazu + Kalender (Schichten, Events, Fälligkeiten, ablaufende Nachweise)
- [x] 13.4 Karte: Zwei-Punkt-Kalibrierung
- [x] 13.5 Tabs (Klick ersetzt, Doppelklick öffnet neuen) und Arbeitsfläche/Widgets im Cockpit (pro Konto)
- [x] 13.6 Demo-Seed, Tests, Doku, Docker :7077, Winchester-Daten ergänzen, Graphify aktualisieren

### Phase 12 – RP-Plattform (Version 0.2) ✅
Auftrag 2026-11-19: Mockup bestätigt, echtes Frontend und Backend bauen, „nur das Wichtigste“. Zielbild: CONCEPT.md Abschnitt 0 (neu). Version 0.1 (Werkstatt-ERP mit MwSt.) wird ersetzt; Infrastruktur (Docker, Login, Sitzungen, Migrationen) bleibt. Sicherung der alten DB: `/root/pitstop-backups/vor-0.2-*.dump` (außerhalb des Repos).
- [x] 12.1 Migration 003 (alte Fachtabellen raus; Firmen, Mitgliedschaften, Gruppen, Ausnahmen, Kunden, Fahrzeuge, Aufträge, Einsätze, Rechnungen, Buchungen, Dienstzeiten, Protokoll, Ankündigungen; `users.is_server_admin`, `users.prefs`); `shared/permissions.ts` (Bereiche, Stufen, Sonderrechte, effektive Rechte)
- [x] 12.2 Server-Kern: Guards mit Firmenkontext (`/api/c/:companyId/...`), Rechteprüfung pro Bereich, `me`/`prefs`, Bootstrap pro Firma, Firma: Mitglieder, Gruppen, Ausnahmen, Firmendaten, Module, Protokoll
- [x] 12.3 Server-Fachbereiche: Kunden, Fahrzeuge, Aufträge, Einsätze (Koordinaten), Rechnungen ($, ohne Steuer), Buchungen/Kasse, Stempeluhr, Kartenbild-Upload
- [x] 12.4 Serververwaltung: Konten (Server-Admin-Schalter, sperren), Firmen, Sicherungen (JSON.gz in `data/backups`), CSV-Export (Firmendaten nur mit Support-Freigabe), Ankündigungen
- [x] 12.5 Client-Grundgerüst nach Mockup: Themes, Seitenleiste nach Rechten, Firmen-/Serverwechsel, Login, Darstellung pro Konto, Neuigkeiten
- [x] 12.6 Client-Seiten: Cockpit, Aufträge (Tafel), Kunden/Fahrzeuge, Leitstelle mit Karte + Einsätze, Rechnungen, Buchungen/Kasse, Mitarbeiter/Stempeluhr, Gruppen & Rechte, Mitglieder, Firmendaten/Module/Protokoll, Server-Seiten
- [x] 12.7 Demo-Seed neu, Tests (typecheck, lint, build, API-Rechtetest, Browser), Doku (CONCEPT, TECHNICAL, README, CLAUDE), Graphify-Karte
- **Später (nicht in 0.2):** Tuning (Konfigurator, Prüfstand, Builds), Racing, Schulungen, Arbeitsflächen/Widgets, Tabs/Seite daneben, Lager, Werkzeug, Dienstplan, Lohn, Kalender, Bewerbungen, Anbindungen, Rahmenverträge, Nachrichten.
- **Fertig wenn:** Admin legt Firma an, lädt Leute ein, vergibt Gruppen; ein Mitarbeiter sieht nur seine Bereiche (auch die API antwortet 403); Auftrag → Rechnung → Zahlung → Buchung läuft durch; Einsatz erscheint auf der Karte; Sicherung und Export funktionieren.

### Phase 11 – Kfz-Werkstatt & Tuning (E1) ✅
- [x] 11.1 Migration 002: Kundenart `fleet`, Abteilungen `workshop`/`tuning`/`parts`, Einheit `liter`, Tabelle `vehicles`, `invoices.vehicle_id`/`mileage`
- [x] 11.2 API Fahrzeuge, Rechnung mit Fahrzeug und km-Stand (fortschreiben), Bootstrap mit Fahrzeugen
- [x] 11.3 Client: Tab Fahrzeuge, Fahrzeugformular, Kennzeichen-Element, Fahrzeug im Rechnungsformular/-liste/-vorschau, Kennzeichen-Suche, Aufgabe „HU anbieten“
- [x] 11.4 Demo-Seed: Lindner Motorsport GmbH, Werkstatt-Personal, Fuhrpark-/Tuning-/Privatkunden, 140 Laufkunden, ~210 Fahrzeuge, Werkstatt-Aufträge passend zum Fahrzeug
- [x] 11.5 Doku und `tests/e2e/demo.mjs` angepasst; Drehbuch grün

### Phase 10 – Abnahme
- [x] 10.1 Leere Zustände, Hover- und Fokuszustände, Tablet-Breite (768 px)
- [x] 10.2 `typecheck`, `lint`, `build` grün; Konsole ohne Fehler und Warnungen; API-Rechtetest je Route (Admin, Mitarbeiter, ohne Sitzung)
- [x] 10.3 Drehbuch 13.1 (Demo) komplett; Ergebnis ins Protokoll
- [x] 10.4 README-Test mit `-p pitstop-test` (Kopie des Arbeitsstands, weil GitHub noch nur die Doku hat): Setup, Update (nur `app` neu gebaut, `db` unverändert; zweites `up` ohne Änderung erstellt nichts neu), Backup, Wiederherstellen, CLI-Passwort-Reset, Löschen, Schutz bei leerem `./db`; Drehbuch 13.2 Schritte 1–8 im Browser grün. **Nicht getestet:** Postgres-Hauptversionswechsel (PG 19 gibt es nur als RC), echter `git clone` von GitHub, HTTPS hinter Reverse-Proxy
- [x] 10.5 README, CONCEPT, TECHNICAL und CLAUDE.md-Graph auf den Ist-Stand gebracht
- [x] 10.6 Pitstop per `docker compose up -d` gestartet; Drehbuch 13.1 gegen http://localhost:8080 grün, danach Demo-Daten zurückgesetzt
- **Fertig wenn:** Der Auftraggeber kann sich unter `http://localhost:8080` anmelden und durchklicken.

## Offene Punkte für später (nicht in der ersten Version)

- Rechnungs-Storno, Bearbeiten von Ausgaben, PDF-Export, E-Rechnung
- E-Mail-Versand (Passwort vergessen, Einladungen), 2FA
- Seitenweise Listen-Endpunkte, falls die Datenmenge wächst (ab einigen tausend Rechnungen)
- Fertige Images in einer Registry statt Bauen auf dem Server
- Bayerische Feiertage in der Urlaubsberechnung
- Client-Bundle ist ~880 kB (gzip 256 kB) in einer Datei; bei Bedarf Module per `import()` nachladen
- Bootstrap-Abgleich alle 60 s kann eine eben gespeicherte Änderung kurz überschreiben, falls die Antwort älter ist (selten; danach korrekt)
- Smartphone-Ansicht nur „bricht nicht“; Tabellen scrollen horizontal

## Protokoll

Neueste Einträge oben. Format: `JJJJ-MM-TT · Schritt · Ergebnis`.

- 2026-11-20 · 15.1–15.4 · Migration 006, `auth/totp.ts`, `routes/discord.ts`, `routes/photos.ts`, `routes/game.ts`, Client (Login mit Code/Discord, Mein Konto, Fotos, Spielserver-Karte, Spiel-ID), FiveM-Ressource `fivem/pitstop` + `tests/fivem`. Tests: `rechte.mjs` grün, neues `anbindungen.mjs` (49) grün (Discord mit eigener Attrappe), FiveM-Ressource mit nachgebauten Natives gegen den Server grün, Browser-Drehbuch grün. Automatische Sicherung über Tageswechsel simuliert (Merker auf gestern, behalten 2): neue Sicherung, älteste automatische gelöscht, manuelle unberührt. Doku auf 0.5, Version 0.5.0.

- 2026-11-20 · 14.5 · Nachgezogen: Lager-Seite mit Bestellungen, Inventur, Verbrauch (Server war schon da); „Mein Konto“ mit angemeldeten Geräten (`sessions.user_agent` in 005, `GET/DELETE /me/sessions`; in `pitstop_dev` per Hand ergänzt, weil 005 dort schon lief). Tests erneut grün (API 142 Prüfungen, Browser inkl. Handy). Doku auf 0.4 (CONCEPT, TECHNICAL inkl. Fallstricke, README inkl. automatischer Sicherung und Update 0.3→0.4, CLAUDE-Karte). :7077 gesichert (`vor-0.4-2026-11-20.dump`), neu gebaut, Migration 005 gelaufen, Winchester per `seed-pitstop-0.4.mjs` ergänzt (inkl. genehmigter Stempel-Nachträge → Lohnlauf Vorwoche 4 Abrechnungen). Rechte geprüft für Derrik, Marcus, Tyler; Jenny/Rico/Kim/Sam nicht per Login geprüft (Login-Drossel 10/15 min nach dem Seed), deren Gruppen haben laut DB die neuen Stufen. Graphify `update .`: 1163 Knoten. Dev-Server gestoppt. **Nicht getestet:** README-Gesamttest aus frischem Klon, echter Discord-Webhook (nur Adressprüfung und Fehlerfall), automatische Sicherung über einen Tageswechsel (nur erster Lauf), Kalibrierung mit echtem GTA-Kartenbild.

- 2026-11-20 · 14.3–14.5 (Teil) · Client: neue Seiten in `pages/Werkstatt.tsx`, `Abschlepp.tsx`, `RacingTeam.tsx`, `Kunden.tsx`, `People.tsx`, `Money.tsx`, `Firma.tsx`, dazu Erweiterungen in Training, Plan, Finance, Customers, Orders, Racing, Server, Cockpit (benannte Arbeitsflächen, neue Widgets), Shell (Suche Strg+K, Meldungen, „Neu“, Vorschau als Person). Demo-Seed `demo/more.ts`. `tests/api/rechte.mjs` um 0.4 erweitert (140 Prüfungen grün), `tests/e2e/demo.mjs` um 0.4 erweitert (grün, Konsole ohne Fehler, Handy ohne seitliches Scrollen). Beim Testen behoben: Live-Feed zeigte Einträge aus Bereichen mit „nur eigene“ (z. B. Lohn anderer); Kopfzeile auf dem Handy zu breit. Version 0.4.0.

- 2026-11-20 · 14.1–14.2 · Migration 005, neue Bereiche (werkzeug, hallenplan, fuhrpark, vertraege, nachrichten, raenge, bewerbungen, preisliste, regelwerk, pinnwand), `routes/crud.ts` (generisches CRUD), `routes/more.ts` (Fachrouten), `routes/platform.ts` (Server-Einstellungen, Anbindungen, API-Schlüssel, `/api/v1`, Jobs), `server/hooks.ts` (Webhooks aus `audit()`), `server/settings.ts` (Wartungsmodus), `shared/feed.ts`, `shared/integrations.ts`. Bootstrap erweitert. `tsc` (Server) grün, gegen DB noch ungetestet.

- 2026-11-20 · 13.6 · `tests/api/rechte.mjs` um die Module erweitert (Lager, Dienstplan, Lohnlauf/Auszahlung, Kurse inkl. Lösungen nur für Bearbeiter und Praxisprüfung, Tuning-Preis vom Server, Racing, Module aus, Export je Bereich, Widgets, Sicherung mit Moduldaten) – grün. `tests/e2e/demo.mjs` um alle neuen Seiten, Konfigurator, Lager, Kurs, Arbeitsfläche, Doppelklick-Tab, „daneben“, Kartenkalibrierung erweitert – grün, Konsole ohne Fehler. Behoben beim Testen: Doppelklick kam vor dem Seitenwechsel an (jetzt `pending`); „Mein Lernen“ war trotz gesperrter Schulungen offen (Gäste). Doku auf 0.3 (CONCEPT, TECHNICAL, README, CLAUDE), Version 0.3.0. :7077 gesichert (`vor-0.3-2026-11-20.dump`), neu gebaut, Migration 004 gelaufen, Winchester-Moduldaten eingespielt (Lohnlauf ergab 0 Abrechnungen, weil dort niemand gestempelt hat). Graphify per `graphify update .` (nur Code, ohne LLM): 884 Knoten; Gemeinschaftsnamen stammen noch vom Lauf 0.2. Dev-Server gestoppt. **Nicht getestet:** Handy-Ansicht der neuen Seiten im Detail (nur „kein seitliches Scrollen“ im Cockpit), README-Gesamttest aus frischem Klon, Kalibrierung mit einem echten GTA-Kartenbild (nur Testbild).

- 2026-11-20 · 13.1–13.5 · `echtbetrieb.mjs` gelöscht; lucide-react, recharts, marked, Tailwind (+ Vite-Plugin) und Inter entfernt; Mockup-Schriften über `@fontsource/chakra-petch`, `@fontsource-variable/manrope`, `@fontsource-variable/jetbrains-mono` (Auftraggeber: „setz alles um“). Migration 004 (parts, shifts, payslips, courses, course_progress, dyno_runs, race_events, race_entries; memberships.wage_cents/commission_pct; companies.tuning; neue Module in bestehenden Firmen an, Vorlagengruppen ergänzt). Server `routes/modules.ts`, Bootstrap erweitert, Export an Bereichsrecht gebunden, Sonderrecht `lohnzahlung`. Client: Lager, Dienstplan, Lohn, Mein Lernen/Kurse/Nachweise, Konfigurator/Builds/Prüfstand/Pakete, Rennkalender/Bestenliste, Kalender, Cockpit als Widget-Arbeitsfläche, Tabs mit „daneben öffnen“, Zwei-Punkt-Kalibrierung. typecheck/lint/build grün; noch ungetestet.

- 2026-11-19 · 12.7 · `typecheck`, `lint`, `build` grün. `tests/api/rechte.mjs` und neues `tests/e2e/demo.mjs` (Inhaber, Mechanik, Server-Admin, Handy) grün, Konsole ohne Fehler. Behoben: offene Panels blieben beim Seitenwechsel stehen; „Demo-Daten zurücksetzen“ unter Mein Konto ergänzt. Kartenbild-Upload per curl geprüft. Doku neu: CONCEPT.md (0.2), TECHNICAL.md (Struktur, Schema, Rechte, API, Client, Tests, Fallstricke), README (Funktionen, Demo, Backup, Update 0.1→0.2), CLAUDE.md (Projektkarte), Version 0.2.0. Graphify-Karte in `graphify-out/` (705 Knoten, 44 Gemeinschaften; in .gitignore). Stack :7077 auf 0.2 gebaut (Migration 003 gelaufen), Winchester-Testdaten neu eingespielt. **Nicht getestet:** README-Gesamttest aus frischem Klon, HTTPS hinter Proxy, sehr große Kartenbilder (> 20 MB).

- 2026-11-19 · 12.5–12.6 · Neuer Client nach Mockup: `index.css` (Mockup-CSS, Schrift Inter statt Google-Fonts – keine neuen Abhängigkeiten), `lib/app.tsx` (Zustand, act/toast/overlay, Rechte), `lib/nav.ts`, `lib/icons.tsx`, `lib/mapdata.ts`, `components/ui.tsx` (FormModal, Drawer, …), `Shell.tsx`, `App.tsx` (Login, Demo-Personen, Passwortwechsel), Seiten in `components/pages/` (Cockpit, Orders, Customers, Leitstelle+MapView, Finance, Staff, Company, Personal, Server), `shared/changelog.ts`, `shared/version.ts`. `tsc` grün; Build, Lint und Browser offen. Dev-Server: `/tmp/claude-0/pitstop-dev` (Symlinks auf src/node_modules), Env im Scratchpad `dev.env` (DB `pitstop_dev` im Container pitstop-db-1, Port 3100, DEMO_MODE=true, Admin admin@demo.pitstop).

- 2026-11-19 · 12.1–12.4 · Server der RP-Plattform: Migration 003, `shared/permissions.ts` (computeRights), Guards mit Firmenkontext, Routen `auth` (+ `/me`), `company`, `work`, `server`, `export`, `demo`; generisches SQL in `repo/records.ts`. Alter Fachcode (Kunden/Finanzen/Personal 0.1, alter Client) gelöscht. `tests/api/rechte.mjs` gegen Dev-Server (eigene DB `pitstop_dev`, Port 3100) grün: Rechte je Rolle, Sperre/Ausnahme, Support-Zugriff nur lesen, Export, letzter Admin, Sicherung + Wiederherstellen. Kartenbild-Upload noch ungetestet.

- 2026-11-19 · Git · Auf Anweisung Branch `develop` angelegt und mit dem kompletten Stand (Code, Docker, Tests, Doku) nach `origin/develop` gepusht.

- 2026-11-19 · 11 · Auf Wunsch des Auftraggebers Kfz-Werkstatt & Tuning statt SHK (E1). Fahrzeuge als neues Objekt der Kundenakte (Kennzeichen, FIN, km, HU, Umbauten), an Rechnungen gekoppelt; Suche nach Kennzeichen; HU-Erinnerungen. Demo: 176 Kunden, 214 Fahrzeuge, ~100 Rechnungen/Monat, Marge 18–27 %, keine doppelte HU/Inspektion je Fahrzeug, kein Öl am E-Auto. Drehbuch 13.1 (erweitert um Kennzeichen-Suche, Fahrzeug an Rechnung, Fahrzeug anlegen) 14/14 grün gegen :8080. Zwischenfall: firewalld-Tabelle (`inet firewalld`, aus anderer WSL-Distribution) blockierte kurz jeden Container-zu-Container-Verkehr (`EHOSTUNREACH`); verschwand von selbst, an der Firewall wurde nichts geändert (Fallstrick in TECHNICAL.md). Andere Projekte (budget-manager, Portainer) auf Wunsch per `docker stop` angehalten.

- 2026-11-19 · 10.4–10.6 · Docker-Gesamttest nach README bestanden (siehe Phase 10.4, inkl. Nicht-Getestetem). Drehbuch-Skripte nach `tests/e2e/` übernommen (`run.sh`, Playwright im Container). Pitstop läuft als Docker-Stack auf :8080 im Demo-Modus. Kleinkorrekturen: Mitarbeiterauswahl ohne leeren Trenner, `tests` in `.dockerignore`.

- 2026-11-19 · Client, 10.1–10.3 · Client komplett (Login, Dashboard, Kunden, Finanzen, Personal, Einstellungen, Befehlspalette, „+ Neu“, Rechtsseiten). `typecheck`, `lint`, `build` grün. Drehbuch 13.1 mit Playwright (Image `mcr.microsoft.com/playwright:v1.49.1-noble`, Skript im Scratchpad) 10/10 grün, Konsole ohne Fehler; Screenshots gesichtet. Korrigiert: `/auth/me` ohne Sitzung jetzt 200 mit `user: null` (sonst 401 in der Konsole), Breite von Auswahlfeldern, Dashboard-Höhen, Demo-Zahlen (Löhne ohne Zuschlag, mehr Großaufträge, Material 20–27 % → Marge 6–22 %). Diagrammfarben Indigo/Orange mit dem Dataviz-Validator geprüft.

- 2026-11-19 · 1–3, Server von 4–9 · Projektgerüst (TypeScript 6.0, weil typescript-eslint TS 7 noch nicht kann; Vite 8, React 19, Tailwind 4, Fastify 5, zod 4, pg). Server komplett: Migration 001, Erststart mit Marker, scrypt-Login, Sitzungen, Origin-Prüfung, Rate-Limit, alle API-Routen, Demo-Seed, CLI. Docker-Dateien geschrieben (noch nicht als Image gebaut). Per curl getestet: Login/Passwortwechsel, Rollenfilter im Bootstrap, 403 für Mitarbeiter auf Finanzen, Rechnung/Mahnung/Notiz/Genehmigung, Validierungsmeldungen, fremder Origin, text/plain, Rate-Limit (429), CLI. Routen liegen gebündelt in `routes/finance.ts`, `people.ts`, `admin.ts` (statt je Bereich eine Datei).

- 2026-11-19 · 0.3 · Git verbunden (`origin` per SSH), Doku als erster Commit nach `main` gepusht.
- 2026-11-19 · 0.2 · README.md angelegt; CONCEPT, TECHNICAL, AGENTS und CLAUDE auf echte App mit Login, Fastify-Server, Postgres 18 und Docker Compose umgestellt. Geprüft: `postgres:18-alpine` ist die neueste stabile Version (`postgres:alpine` = `18-alpine`, 19 nur als `19rc1`), Docker Compose v5.6.0 vorhanden, Port 8080 frei. Kein Code.
- 2026-11-19 · – · Alle Bezüge auf andere Ordner unter `/opt/docker` aus der Doku entfernt.
- 2026-11-19 · 0.1 · Doku angelegt (CONCEPT, TECHNICAL, AGENTS, CLAUDE). Kein Code. Node 22.23.2 und npm 10.9.8 vorhanden, Port 5173 frei. Graphify ist auf diesem Rechner nicht installiert.

## Entscheidungen des Auftraggebers

Getroffene Entscheidungen hier festhalten (mit Datum) und CONCEPT.md Abschnitt 14 anpassen.

- 2026-11-19 · Repository `https://github.com/ZockerDream/pitstop.git`; zuerst die Doku pushen, danach das Mockup bauen.
- 2026-11-19 · Echte App mit Login (statt reinem Frontend-Mockup); Demo-Daten und Rollenwechsel nur bei `DEMO_MODE=true`.
- 2026-11-19 · Betrieb per Docker Compose, Datenbank ist die neueste PostgreSQL. Setup: `git clone` → `.env` und `.impressum` aus den `-example`-Dateien → `docker compose up -d`. Update nur über `git pull` + `docker compose up -d`. Daten unter `./data`, `./logs`, `./db`, `./conf`.
- 2026-11-19 · Alle anderen Ordner unter `/opt/docker` ignorieren; Pitstop steht für sich.
- 2026-11-19 · Vor dem Code zuerst die Dokumentationsdateien. AGENTS.md dient als Übergabe bei Limit-Ende, CLAUDE.md als Projekt-Graph zum Wiedereinstieg und für Graphify.
