# Pitstop – Arbeitsstand für KI-Agenten

Diese Datei ist das **Übergabeprotokoll**. Läuft das Limit einer Sitzung ab, macht die nächste Sitzung genau hier weiter. [CLAUDE.md](CLAUDE.md) lädt diese Datei automatisch mit. Fachliches steht in [CONCEPT.md](CONCEPT.md), Technisches in [TECHNICAL.md](TECHNICAL.md), Betrieb in [README.md](README.md).

## ▶ Aktueller Stand

| | |
|---|---|
| **Zuletzt aktualisiert** | 2026-11-19 |
| **Phase** | 0 abgeschlossen (Doku inklusive README), Phase 1 nicht begonnen |
| **Aktiver Schritt** | – |
| **Nächster Schritt** | **1.1** Projektgerüst anlegen (TECHNICAL.md Abschnitt 3 und 13) |
| **Halbfertige Dateien** | keine |
| **Laufende Dienste** | keine (weder Dev-Server noch Container) |
| **Blocker / Fragen an den Auftraggeber** | keine. Die Defaults in CONCEPT.md Abschnitt 14 gelten, solange nichts anderes gesagt wird. |
| **Git** | `origin` = `git@github.com:ZockerDream/pitstop.git` (öffentlich lesbar über https), Branch `main`. Autor: `ZockerDream <69266888+ZockerDream@users.noreply.github.com>` (repo-lokal gesetzt) |

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
- [ ] 1.1 `.gitignore` (`node_modules`, `dist`, `.env`, `.impressum`, `data/`, `logs/`, `db/`, `conf/`), `.dockerignore`
- [ ] 1.2 Vite-`react-ts` in `/tmp/pitstop-scaffold` erzeugen; nur die benötigten Teile übernehmen und auf `src/client`, `src/server`, `src/shared` umbauen (Vite `root: 'src/client'`, `outDir: '../../dist/client'`, Proxy `/api`)
- [ ] 1.3 Abhängigkeiten nach TECHNICAL.md Abschnitt 2 installieren; Tailwind v4, Inter; installierte Versionen in TECHNICAL.md eintragen
- [ ] 1.4 tsconfigs (client, server; strict, `moduleResolution: bundler`), Skripte `dev:server`, `dev:client`, `build` (vite + esbuild + Migrationen kopieren), `typecheck`, `lint`, `start`
- [ ] 1.5 `.env-example` und `.impressum-example` mit allen Variablen aus der README (inklusive Kommentaren)
- **Fertig wenn:** `npm run build` und `npm run typecheck` grün; `npm run dev:client` zeigt eine Seite mit Tailwind-Klasse und Inter-Schrift.

### Phase 2 – Server, Datenbank, Docker
- [ ] 2.1 `server/config.ts` (zod, deutsche Fehlermeldungen), `logger.ts` (stdout + `logs/app`)
- [ ] 2.2 `db/pool.ts` (Typ-Parser), `db/migrate.ts`, `migrations/001_init.sql` (komplettes Schema nach TECHNICAL.md 6.2)
- [ ] 2.3 `db/init.ts` (Warten auf die DB, Migrationen, Admin aus `.env`, Marker `data/.initialized`, Schutz bei leerer DB)
- [ ] 2.4 `main.ts`: Fastify, helmet, cookie, Static für `dist/client`, `GET /api/health`, Fehlerformat
- [ ] 2.5 `Dockerfile`, `docker/entrypoint.sh`, `docker/pitstop`, `docker-compose.yml`, `compose.dev.yml`
- [ ] 2.6 `cli.ts` (`reset-password`)
- **Fertig wenn:** Aus einem frischen Klon in `/tmp` startet `docker compose -p pitstop-test up -d` (mit eigenem Port) beide Dienste `healthy`; `./db`, `./data`, `./logs` werden befüllt; ein zweites `up -d` ohne Änderung erstellt nichts neu; nach einer Codeänderung baut `up -d` neu.

### Phase 3 – Anmeldung und Konto
- [ ] 3.1 `auth/password.ts` (scrypt), `auth/sessions.ts`, `auth/guards.ts`, Origin-Prüfung, Rate-Limit
- [ ] 3.2 Routen `auth/login`, `logout`, `me`, `password`; Pflicht zum Passwortwechsel
- [ ] 3.3 `shared/permissions.ts`, `shared/types.ts` (vollständig)
- [ ] 3.4 Client: `lib/api.ts`, `lib/router.ts`, `LoginPage`, `ChangePasswordModal`, Weiterleitung bei 401/403
- [ ] 3.5 Rechtsseiten: `GET /api/public/legal`, `ImpressumPage`, `DatenschutzPage`; `GET /api/public/logo`
- **Fertig wenn:** Login, Logout, erzwungener Passwortwechsel und „Angemeldet bleiben“ funktionieren; falsche Logins werden gedrosselt; Impressum zeigt die `.impressum`-Werte.

### Phase 4 – Fundament Daten und Oberfläche
- [ ] 4.1 `shared/`: `money`, `dates`, `format`, `labels`, `selectors`
- [ ] 4.2 `server/repo/*` und `GET /api/bootstrap` mit Rollenfilter und Feldfiltern
- [ ] 4.3 Client-Store (`AppStore`, `reducer`, `mutations`), Abgleich bei Tab-Fokus und alle 60 s
- [ ] 4.4 `components/ui/*` Basisbausteine
- [ ] 4.5 Layout: `Sidebar`, `TopBar`, `UserMenu`, `NoAccess`, Modal-Host, Toasts, Routen-Switch mit leeren Modulansichten
- [ ] 4.6 Demo-Modus: `server/demo/` (templates, random, seed), `POST /api/demo/login`, `POST /api/demo/reset`, Demo-Knöpfe und Banner
- **Fertig wenn:** Mit `DEMO_MODE=true` ein-Klick-Login als beide Personas; Navigation zwischen allen Modulen; als Mitarbeiter fehlen Finanzen und Einstellungen, auch im Bootstrap; `typecheck` grün.

### Phase 5 – Dashboard
- [ ] 5.1 KPI-Karten Admin/Mitarbeiter (CONCEPT.md 6.1/6.2)
- [ ] 5.2 Diagramm Umsatz vs. Ausgaben bzw. „Abwesend diese Woche“
- [ ] 5.3 Aufgaben & Freigaben inklusive manueller Aufgaben (API `tasks`)
- [ ] 5.4 „Erste Schritte“ im Echtbetrieb
- **Fertig wenn:** Drehbuch 13.1 Schritt 1 stimmt; die Aktionen in der Liste funktionieren, sobald die jeweiligen APIs aus Phase 6–8 stehen.

### Phase 6 – Kundenakten (CRM)
- [ ] 6.1 API `customers`, `contacts`, `notes`
- [ ] 6.2 Kundenliste mit Suche, Statusfilter mit Zählern, Kundenart-Filter, Sortierung
- [ ] 6.3 Kunden-Drawer mit Tabs; Notiz anlegen; Statuswechsel und Bearbeiten (Admin)
- [ ] 6.4 Modal „Neuer Kunde“
- **Fertig wenn:** Drehbuch 13.1 Schritte 4 und 7.

### Phase 7 – Finanzen (ERP)
- [ ] 7.1 API `invoices` (anlegen, bezahlt, mahnen mit Systemnotiz in einer Transaktion), `expenses`
- [ ] 7.2 Rechnungstabelle, Filter, Zeilenaktionen, Rechnungsvorschau mit Firmendaten
- [ ] 7.3 Modal „Neue Rechnung“ (Kunden-Combobox, Positionseditor, Vorlagen, Live-Summen, Validierung)
- [ ] 7.4 Ausgabentabelle, Kategorie-Aufteilung, Modal „Neue Ausgabe“
- **Fertig wenn:** Drehbuch 13.1 Schritte 3, 5 und 6; Netto + 19 % = Brutto in drei Stichproben centgenau; Mitarbeiter erhalten 403 auf allen Finanz-Routen.

### Phase 8 – Personal (HR)
- [ ] 8.1 API `employees` (anlegen, bearbeiten, Monatsstunden), `absences` (anlegen, entscheiden, zurückziehen, gesehen)
- [ ] 8.2 Verzeichnis (Karten und Tabelle), Status, Filter; Modal „Neuer Mitarbeiter“
- [ ] 8.3 Personalakte mit drei Tabs; Kontaktkarte für Mitarbeiter; Modal „Stunden erfassen“
- [ ] 8.4 Urlaub & Abwesenheiten; Modals „Urlaub beantragen“ und „Krank melden“
- **Fertig wenn:** Drehbuch 13.1 Schritte 2, 8 und 9.

### Phase 9 – Einstellungen und globale Funktionen
- [ ] 9.1 Einstellungen → Firmendaten (API `settings/company`)
- [ ] 9.2 Einstellungen → Benutzer (API `users`, Startpasswort einmal anzeigen, Schutz des letzten Admins)
- [ ] 9.3 Befehlspalette (Strg/⌘+K)
- [ ] 9.4 „+ Neu“-Menü nach Rolle, Toasts mit „Öffnen“
- **Fertig wenn:** Drehbuch 13.2 Schritte 2–8.

### Phase 10 – Abnahme
- [ ] 10.1 Leere Zustände, Hover- und Fokuszustände, Tablet-Breite (768 px)
- [ ] 10.2 `typecheck`, `lint`, `build` grün; Konsole ohne Fehler und Warnungen; API-Rechtetest je Route (Admin, Mitarbeiter, ohne Sitzung)
- [ ] 10.3 Drehbuch 13.1 (Demo) komplett; Ergebnis ins Protokoll
- [ ] 10.4 README-Test in `/tmp` mit `-p pitstop-test`: Setup, Update, Backup, Wiederherstellen, Postgres-Hauptversions-Ablauf (soweit ohne PG 19 möglich), Löschen; Drehbuch 13.2 komplett
- [ ] 10.5 README von „in Entwicklung“ auf den echten Stand bringen; CLAUDE.md-Graph auf den Ist-Stand (alle Knoten ✅)
- [ ] 10.6 Pitstop per `docker compose up -d` starten und dem Auftraggeber die URL nennen
- **Fertig wenn:** Der Auftraggeber kann sich unter `http://localhost:8080` anmelden und durchklicken.

## Offene Punkte für später (nicht in der ersten Version)

- Rechnungs-Storno, Bearbeiten von Ausgaben, PDF-Export, E-Rechnung
- E-Mail-Versand (Passwort vergessen, Einladungen), 2FA
- Seitenweise Listen-Endpunkte, falls die Datenmenge wächst (ab einigen tausend Rechnungen)
- Fertige Images in einer Registry statt Bauen auf dem Server
- Bayerische Feiertage in der Urlaubsberechnung

## Protokoll

Neueste Einträge oben. Format: `JJJJ-MM-TT · Schritt · Ergebnis`.

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
