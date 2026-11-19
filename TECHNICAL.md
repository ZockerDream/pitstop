# Pitstop – Technische Sicht

Ergänzt [CONCEPT.md](CONCEPT.md) um das *Wie*. Betrieb (Setup, Update, Backup, Löschen) steht in [README.md](README.md). Stand: 2026-11-19, **umgesetzt** (Version 0.1). Wird etwas anders gebaut als hier beschrieben, wird diese Datei angepasst, nicht der Code an die Datei.

## 1. Überblick

```
Browser ──HTTP──▶ app (Docker, Node 24)                          ──SQL──▶ db (Docker, postgres:18-alpine)
                  ├─ /api/*   Fastify-REST-API (Login, Rechte, Daten)       Daten in ./db
                  └─ /*       ausgelieferte React-SPA (dist/client)
                  Logs ./logs/app · Daten ./data · Betreiberdateien ./conf (nur lesend)
```

- **Eine** App-Instanz liefert SPA und API am selben Ursprung aus (keine CORS-Probleme, Cookies einfach).
- Die SPA lädt nach dem Login einen Gesamtstand (`GET /api/bootstrap`), bereits nach Rolle gefiltert, und hält ihn in einem Client-Store. Schreibende Aktionen gehen an die API; die Antwort enthält den gespeicherten Datensatz, der in den Store übernommen wird.
- **Rechte prüft der Server**, bei jeder Route und bei jedem Feld (z. B. Stundensatz). Die Oberfläche blendet zusätzlich aus.

## 2. Stack

| Schicht | Wahl | Anmerkung |
|---|---|---|
| Laufzeit (Image) | `node:24-alpine` | Node 24 LTS; lokal reicht Node 22 (vorhanden: 22.23.2) |
| Datenbank | `postgres:18-alpine` | Neueste stabile Hauptversion (19 ist am 2026-11-19 erst RC). Tag auf die Hauptversion gepinnt, **nie `latest`** |
| Server | Fastify 5, TypeScript | `@fastify/static`, `@fastify/cookie`, `@fastify/rate-limit`, `@fastify/helmet` |
| DB-Zugriff | `pg` mit handgeschriebenem SQL | Migrationen als nummerierte `.sql`-Dateien, eigener kleiner Runner |
| Validierung | `zod` | Request-Bodies und Umgebungsvariablen |
| Passwörter | `node:crypto` `scrypt` | Keine native Abhängigkeit |
| Logs | pino (in Fastify) + `pino-roll` | stdout und `./logs/app`, täglich rotiert, 14 Dateien |
| Client-Build | Vite 8, React 19, TypeScript 6.0 strict | Root `src/client`. **Nicht TypeScript 7:** typescript-eslint unterstützt es noch nicht (`<6.1`) |
| Styling | Tailwind CSS **v4** über `@tailwindcss/vite` | Konfiguration in CSS (`@theme`), kein `tailwind.config.js` |
| Icons, Diagramme, Schrift | `lucide-react`, `recharts`, `@fontsource-variable/inter` | Schrift lokal gebündelt |
| Markdown | `marked` | Nur für `conf/datenschutz.md` |
| Server-Build | `esbuild` (bündelt `src/server` → `dist/server/main.js`) | `tsc` nur zur Typprüfung |
| Dev-Server | `tsx watch` (Server), `vite` (Client mit Proxy `/api`) | |

Bewusst **nicht** verwendet: ORM, react-router, State-Bibliotheken, UI-Kits, Redis, eigener Reverse-Proxy. Jede weitere Abhängigkeit nur nach Rückfrage.

`dependencies` enthält nur, was der Server zur Laufzeit braucht (Fastify, pg, zod, pino). Alle Client-Bibliotheken (React, recharts, lucide-react, marked, Inter) stehen in `devDependencies`, weil Vite sie einbündelt; so bleibt das Image nach `npm prune --omit=dev` klein.

Installierte Versionen (2026-11-19):

| Paket | Version | | Paket | Version |
|---|---|---|---|---|
| vite | 8.3 | | fastify | 5.12 |
| react | 19.3 | | pg | 8.23 |
| typescript | 6.0 | | zod | 4.6 |
| tailwindcss | 4.3 | | esbuild | 0.28 |
| recharts | 3.11 | | lucide-react | 1.76 |

## 3. Repository-Struktur

```
pitstop/
├── README.md  AGENTS.md  CLAUDE.md  CONCEPT.md  TECHNICAL.md
├── .env-example  .impressum-example  .gitignore  .dockerignore
├── docker-compose.yml          # Produktion: Dienste app + db
├── compose.dev.yml             # nur lokal: Postgres-Port auf 127.0.0.1:5432
├── Dockerfile                  # Multi-Stage: build → runtime
├── docker/
│   ├── entrypoint.sh           # Ordner anlegen, chown, Rechte abgeben (su-exec node)
│   └── pitstop                 # CLI-Wrapper: `pitstop reset-password <email>`
├── package.json  package-lock.json  vite.config.ts  eslint.config.js
├── tsconfig.json  tsconfig.client.json  tsconfig.server.json
├── scripts/build-server.mjs    # esbuild-Bündelung des Servers + Migrationen kopieren
├── tests/e2e/                  # Browser-Drehbücher (Playwright im Container), run.sh
└── src/
    ├── shared/                 # von Client UND Server genutzt, ohne DOM und ohne Node-APIs
    │   ├── types.ts            # Domänentypen, API-Typen
    │   ├── money.ts  dates.ts  format.ts  labels.ts
    │   ├── catalog.ts          # Positionsvorlagen (Rechnungsformular und Demo-Seed)
    │   ├── permissions.ts      # can(role, permission)
    │   └── selectors.ts        # abgeleitete Werte (KPIs, Status, Resturlaub, Aufgaben)
    ├── server/
    │   ├── main.ts             # Start: Konfiguration, Logger, Erststart, HTTP-Server, Shutdown
    │   ├── app.ts              # Fastify, Plugins, Fehlerformat, Routen, Static
    │   ├── errors.ts           # HttpError, parseBody (zod, deutsch), Schema-Bausteine
    │   ├── config.ts           # Umgebungsvariablen lesen und prüfen (zod)
    │   ├── logger.ts           # pino: stdout + logs/app
    │   ├── cli.ts              # reset-password
    │   ├── db/
    │   │   ├── pool.ts         # pg-Pool, Typ-Parser, tx()-Helfer
    │   │   ├── migrate.ts      # Runner mit Advisory-Lock
    │   │   ├── init.ts         # Erststart: Admin aus .env, Demo-Seed, Marker data/.initialized
    │   │   └── migrations/     # 001_init.sql, 002_….sql
    │   ├── auth/               # password.ts, sessions.ts, guards.ts (requireUser, requirePermission)
    │   ├── repo/               # SQL je Bereich: customers (inkl. Kontakte, Notizen), invoices, expenses,
    │   │                       # employees (inkl. Stunden), absences, tasks, settings, users, sql.ts (Teil-Updates)
    │   ├── routes/             # auth, bootstrap, public (Rechtsseiten, Logo, Health), customers,
    │   │                       # finance (Rechnungen, Ausgaben), people (Mitarbeiter, Abwesenheiten, Aufgaben),
    │   │                       # admin (Firmendaten, Benutzer), demo, util.ts
    │   └── demo/               # seed.ts, templates.ts, random.ts
    └── client/
        ├── index.html  main.tsx  App.tsx  index.css
        ├── lib/                # api.ts (fetch-Wrapper), router.ts, modals.tsx (Modal-Host), storage.ts, cx.ts
        ├── store/              # AppStore.tsx, reducer.ts, mutations.ts (useActions, useRun)
        └── components/
            ├── layout/   Sidebar TopBar (inkl. „+ Neu“ und Benutzermenü) CommandPalette ModalHost NoAccess Splash
            ├── ui/       Button Badge Card (PageHeader, Stat) KpiCard Modal Drawer Tabs Field (Input, Select, …)
            │             Combobox feedback (Toasts, Bestätigungsdialog) misc (Avatar, EmptyState, Menu, table …)
            ├── auth/     LoginPage ForcePasswordChange ChangePasswordModal PasswordForm
            ├── legal/    ImpressumPage DatenschutzPage
            ├── dashboard/ DashboardView RevenueExpenseChart TaskList AbsenceThisWeek
            ├── crm/      CustomerListView CustomerDrawer CustomerFormModal ContactCards NoteTimeline NoteComposer
            ├── finance/  FinanceView InvoiceTable InvoiceDrawer InvoiceFormModal LineItemsEditor
            │             ExpenseTable ExpenseFormModal ExpenseCategoryBreakdown
            ├── hr/       HrView EmployeeDirectory EmployeeDrawer EmployeeFormModal
            │             LeaveTable LeaveRequestModal SickNoteModal HoursChart TimesheetModal
            └── settings/ SettingsView CompanySettings UserAccounts UserFormModal PasswordRevealModal
```

Regeln:
- Eine Komponente pro Datei, Dateiname = Komponentenname; Dateien über ca. 300 Zeilen aufteilen.
- `shared/` importiert nichts aus `client/` oder `server/`. Module unter `client/components/` importieren nur aus `ui/`, `lib/`, `store/` und `shared/`, nie quer. Modulübergreifende Modals laufen über den Modal-Host in `App.tsx`.
- Importe ohne Dateiendung. Beide Seiten nutzen `moduleResolution: "bundler"`; Vite bzw. esbuild bündeln.

## 4. Docker

### 4.1 `docker-compose.yml` (Auszug, maßgeblich ist die Datei)

```yaml
name: pitstop
services:
  db:
    image: postgres:18-alpine
    pull_policy: always            # holt bei jedem `up` die neueste 18.x (Sicherheitsupdates)
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-pitstop}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD in .env setzen}
      POSTGRES_DB: ${POSTGRES_DB:-pitstop}
      TZ: ${TZ:-Europe/Berlin}
    # Log-Ordner gehört sonst root; erst chown, dann das normale Entrypoint (gibt Rechte ab)
    entrypoint: ["sh", "-c", "mkdir -p /var/log/postgresql && chown postgres:postgres /var/log/postgresql && exec docker-entrypoint.sh postgres -c logging_collector=on -c log_directory=/var/log/postgresql -c log_filename=postgresql-%a.log -c log_truncate_on_rotation=on -c log_rotation_age=1d"]
    volumes:
      - ./db:/var/lib/postgresql             # ab PG 18: NICHT …/data (siehe Fallstricke)
      - ./logs/postgres:/var/log/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 12

  app:
    build: .
    image: pitstop-app:local
    pull_policy: build             # `docker compose up -d` baut immer (Cache) → Update = git pull + up
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - path: .env
        required: true
      - path: .impressum
        required: false
    environment:                   # pg liest PG*-Variablen selbst; Passwort nie in eine URL bauen
      PGHOST: db
      PGPORT: "5432"
      PGUSER: ${POSTGRES_USER:-pitstop}
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: ${POSTGRES_DB:-pitstop}
    ports:
      - "${PITSTOP_PORT:-8080}:3000"
    volumes:
      - ./data:/app/data
      - ./logs/app:/app/logs
      - ./conf:/app/conf:ro
```

`compose.dev.yml` ergänzt nur `db.ports: ["127.0.0.1:5432:5432"]` und wird ausschließlich lokal mit `-f docker-compose.yml -f compose.dev.yml` genutzt. **Kein** `docker-compose.override.yml`, weil Compose das automatisch auch in Produktion laden würde.

### 4.2 Dockerfile (maßgeblich ist die Datei)

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev     # vite build + esbuild + Migrationen nach dist/server/migrations

FROM node:24-alpine
RUN apk add --no-cache su-exec tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/pitstop /usr/local/bin/pitstop
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "entrypoint.sh"]
CMD ["node", "dist/server/main.js"]
```

`entrypoint.sh`: `mkdir -p /app/data/backups /app/logs`, `chown -R node:node /app/data /app/logs`, dann `exec su-exec node "$@"`. `docker/pitstop` ruft `su-exec node node /app/dist/server/cli.js "$@"` auf. `.dockerignore`: `node_modules`, `dist`, `db`, `data`, `logs`, `conf`, `.env`, `.impressum`, `.git`.

### 4.3 Start der App (`server/db/init.ts`)

1. Auf die Datenbank warten (Retry mit Backoff, max. 60 s).
2. Migrationen anwenden (`pg_advisory_lock`, jede Datei in einer Transaktion, Tabelle `schema_migrations`).
3. Gibt es **keinen** Benutzer:
   - Existiert `data/.initialized`, **abbrechen** mit Log-Fehler „Datenbank leer, aber Pitstop war schon eingerichtet – siehe README, Abschnitt Update/Sonderfall“. Das schützt vor dem stillen Neuanlegen nach einem Postgres-Hauptversionswechsel oder einem verlorenen `./db`.
   - Sonst den Admin aus `ADMIN_EMAIL`/`ADMIN_PASSWORD` anlegen (`must_change_password = true`). Fehlen die Werte, mit klarer Meldung abbrechen.
   - Bei `DEMO_MODE=true` zusätzlich den Demo-Seed einspielen (Abschnitt 9).
4. `data/.initialized` schreiben, falls nicht vorhanden (auch nach einem Restore auf einem neuen Server).
5. HTTP-Server auf `0.0.0.0:3000` starten.

### 4.4 Update-Mechanik (warum `git pull` + `docker compose up -d` reicht)

- `app` hat `pull_policy: build`: Jedes `up` baut das Image neu; ohne Codeänderung kommt alles aus dem Cache. Hat sich das Image geändert, wird nur `app` neu erstellt.
- `db` hat `pull_policy: always` mit dem Tag `18-alpine`: Unterversionen kommen automatisch. Ein Wechsel der Hauptversion geschieht nur über eine Änderung in `docker-compose.yml` und folgt dem Sonderablauf in der README.
- Schemaänderungen laufen als Migration beim App-Start. Migrationen sind **nur vorwärts** und müssen zum alten Code kompatibel sein, solange beide kurz parallel laufen könnten (praktisch: Spalten hinzufügen statt umbenennen).

## 5. Konfiguration (`server/config.ts`)

Alle Variablen und ihre Bedeutung: [README.md](README.md) Abschnitt Konfiguration. Im Code:
- Mit `zod` beim Start prüfen; bei Fehlern eine deutsche Meldung mit Variablennamen ausgeben und mit Exit-Code 1 beenden.
- `PUBLIC_URL` → `origin` für die Origin-Prüfung, `secureCookies = startsWith('https://')`.
- Pfade: `DATA_DIR`, `LOGS_DIR`, `CONF_DIR` stehen per Default auf `<cwd>/data`, `<cwd>/logs` und `<cwd>/conf`, im Container also `/app/…`, lokal der Projektordner. Keine eigene Umgebungsvariable nötig.
- DB: `PGHOST` (Default `localhost`), `PGUSER`/`PGDATABASE` (Fallback `POSTGRES_USER`/`POSTGRES_DB`, dann `pitstop`), `PGPASSWORD` (Fallback `POSTGRES_PASSWORD`). Lokal reicht damit die `.env`.
- Impressum: alle `IMPRESSUM_*` einsammeln und leere weglassen.

## 6. Datenbank

### 6.1 Konventionen
- Primärschlüssel `uuid default gen_random_uuid()`. Zeitpunkte `timestamptz`, Kalenderdaten `date`, Geld `integer` in Cent, Mengen und Stunden `numeric(10,2)`.
- Aufzählungen als `text` mit `CHECK (… IN (…))`, mit denselben Werten wie die Union-Typen in `shared/types.ts`.
- Rechnungs- und Kundennummern aus Sequenzen: `invoice_number_seq` (Start 1001), `customer_number_seq` (Start 10001, angezeigt als `KD-10001`).
- **Typ-Parser in `pool.ts`:** `date` (OID 1082) bleibt String `YYYY-MM-DD`, `numeric` (1700) → `Number`, `int8` (20) → `Number` (z. B. aus `count(*)`/`sum()`).
- Eine angewendete Migration wird nie geändert; Korrekturen kommen als neue Datei.

### 6.2 Schema (Überblick, maßgeblich sind die Migrationen)

```
users(id, email unique (klein geschrieben), display_name, password_hash, role[admin|employee],
      employee_id unique null → employees, active, must_change_password, created_at, last_login_at)
sessions(token_hash pk, user_id → users on delete cascade, remember, created_at, last_seen_at, expires_at)
settings(key pk, value jsonb)                               -- 'company': Firmendaten für den Rechnungskopf

employees(id, personnel_number unique, first_name, last_name, job_title, department, email, phone,
          hourly_rate_cents, contract_type, weekly_hours, entry_date, probation_end_date, fixed_term_end_date,
          manager_id → employees, vacation_days_per_year, carry_over_days, active)
timesheets(employee_id → employees, month char(7), target_hours, worked_hours, pk(employee_id, month))
absences(id, employee_id → employees, kind[vacation|sick], from_date, to_date, status[requested|approved|rejected],
         comment, decision_note, requested_at, decided_at, decided_by_user_id, seen_by_requester)

customers(id, number unique default nextval, name, kind, status, street, zip, city, phone, email, vat_id,
          payment_term_days, owner_employee_id → employees, tags text[], created_at)
contacts(id, customer_id → customers on delete cascade, name, position, phone, email, is_primary)
vehicles(id, customer_id → customers on delete cascade, plate, make, model, variant, vin, first_registration, mileage,
         next_inspection, fuel[petrol|diesel|electric|hybrid|lpg], power_kw, notes, created_at)      -- Migration 002
notes(id, customer_id → customers on delete cascade, kind, text, author_user_id → users null, created_at)

invoices(id, number unique default nextval, customer_id → customers on delete restrict, vehicle_id → vehicles null, mileage, issue_date, due_date,
         vat_rate, status[open|paid], paid_at, dunning_level 0–3, last_reminded_at, created_by_user_id, created_at)
invoice_items(id, invoice_id → invoices on delete cascade, position, description, quantity, unit, unit_price_cents)
expenses(id, date, supplier, category, description, net_cents, vat_rate[0|7|19], paid, created_by_user_id, created_at)
tasks(id, title, done, due_date, for_role, created_at)
schema_migrations(version pk, applied_at)
```

Indizes auf alle Fremdschlüssel sowie auf `invoices(status, due_date)`, `absences(employee_id, from_date)` und `lower(vehicles.plate)`.

**Migration 002 (`002_werkstatt.sql`):** Umstellung auf Kfz-Werkstatt – Kundenart `property_mgmt` → `fleet`, Abteilungen `installation`/`planning`/`warehouse` → `workshop`/`tuning`/`parts`, Einheit `liter`, Tabelle `vehicles`, `invoices.vehicle_id` und `invoices.mileage`. Bestehende Daten werden mit umgeschrieben.

## 7. Server

### 7.1 Anmeldung und Sitzungen
- Passwort-Hash: `scrypt` (N=32768, r=8, p=1, 16 Byte Salt, 64 Byte Schlüssel), gespeichert als `scrypt$N$r$p$salt$hash`, Vergleich mit `timingSafeEqual`. Mindestlänge 12 Zeichen.
- Login erzeugt ein zufälliges Token (32 Byte, base64url) im Cookie `pitstop_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` bei https). In der DB liegt nur `sha256(token)`.
- Ablauf: 8 Stunden ohne Aktivität, mit „Angemeldet bleiben“ 30 Tage. `last_seen_at` höchstens einmal pro Minute schreiben.
- Login-Schutz: `@fastify/rate-limit` auf `/api/auth/login` (10 Versuche / 15 min je IP). Fehlermeldung immer gleich: „E-Mail oder Passwort falsch“. Gesperrte (`active = false`) Benutzer kommen nicht hinein, ihre Sitzungen werden beim Sperren gelöscht.
- `must_change_password`: Alle Routen außer `auth/*` antworten mit 403 und dem Code `PASSWORD_CHANGE_REQUIRED`; der Client zeigt dann nur das Passwort-Formular.
- CSRF: `SameSite=Lax` plus Pflicht `Content-Type: application/json` für schreibende Methoden plus Prüfung des `Origin`-Headers gegen `PUBLIC_URL` (sofern vorhanden).
- `trustProxy` für Loopback und private Netze, damit Rate-Limit und Logs hinter einem Reverse-Proxy die echte IP sehen.
- `@fastify/helmet` mit strikter CSP: `script-src 'self'`; `style-src 'self' 'unsafe-inline'` (Recharts setzt Inline-Styles); `img-src 'self' data:`.

### 7.2 Rechte
`shared/permissions.ts` enthält eine Tabelle `Record<Permission, Role[]>`. Server-Guards `requirePermission('finance:view')` als `preHandler`. Feldfilter in den Serialisierern: `serializeEmployee(emp, viewer)` lässt Stundensatz und Vertragsdaten weg, außer für Admin oder die eigene Akte. Absences anderer werden für Mitarbeiter ohne `comment` und `decision_note` ausgeliefert.

Rechte (`bereich:aktion`): `finance:view`, `customer:edit`, `customer:viewInvoices`, `employee:edit`, `employee:viewRate`, `employee:viewFile:any`, `absence:decide`, `absence:createForOthers`, `absence:reportSick`, `task:manage`, `settings:manage`, `users:manage`. Matrix: [CONCEPT.md](CONCEPT.md) Abschnitt 3.

### 7.3 API

Alle Routen unter `/api`, JSON. Fehlerformat `{ "error": { "code": "VALIDATION", "message": "…", "fields": { "items.0.quantity": "Menge muss größer 0 sein" } } }`, Meldungen deutsch. Status: 400 Validierung, 401 nicht angemeldet, 403 keine Berechtigung, 404, 409 Konflikt, 429 Rate-Limit.

| Methode und Pfad | Recht | Wirkung |
|---|---|---|
| `GET /health` | öffentlich | `{ ok, db }` für den Healthcheck |
| `GET /public/legal` | öffentlich | Impressum-Felder und Datenschutz-Markdown, Flag `demoMode` |
| `GET /public/logo` | öffentlich | Logo aus `conf/` oder 404 |
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | – | Sitzung. `/auth/me` antwortet ohne Sitzung mit 200 und `user: null` (kein 401, damit die Browser-Konsole sauber bleibt) |
| `POST /auth/password` | angemeldet | Eigenes Passwort ändern (altes Passwort nötig) |
| `GET /bootstrap` | angemeldet | Gesamtstand für die Rolle (Abschnitt 8.2) |
| `POST /customers` · `PATCH /customers/:id` | `customer:edit` | Anlegen, Stammdaten oder Status ändern |
| `POST /customers/:id/contacts` | `customer:edit` | Ansprechpartner |
| `POST /customers/:id/vehicles` · `PATCH /vehicles/:id` | `customer:edit` | Fahrzeug anlegen bzw. ändern (Kennzeichen groß, FIN 17 Zeichen ohne I/O/Q) |
| `POST /customers/:id/notes` | angemeldet | Notiz (Autor = Sitzung) |
| `POST /invoices` | `finance:view` | Rechnung anlegen; Nummer aus der Sequenz. Optional `vehicleId` (muss zum Kunden gehören) und `mileage`; ein höherer km-Stand wird am Fahrzeug fortgeschrieben (Antwort enthält dann auch `vehicle`) |
| `POST /invoices/:id/pay` · `POST /invoices/:id/remind` | `finance:view` | Bezahlt; Mahnstufe + Systemnotiz in **einer** Transaktion |
| `POST /expenses` | `finance:view` | Ausgabe |
| `POST /employees` · `PATCH /employees/:id` | `employee:edit` | Mitarbeiter anlegen und bearbeiten |
| `PUT /employees/:id/timesheets/:month` | `employee:edit` | Soll/Ist-Stunden eines Monats |
| `POST /absences` | angemeldet (für andere: `absence:createForOthers`; `sick`: `absence:reportSick`) | Antrag bzw. Krankmeldung |
| `POST /absences/:id/decide` | `absence:decide` | Genehmigen/Ablehnen |
| `DELETE /absences/:id` | Antragsteller, nur `requested` | Zurückziehen |
| `POST /absences/:id/seen` | Antragsteller | Hinweis gelesen |
| `POST /tasks` · `POST /tasks/:id/toggle` | `task:manage` | Manuelle Aufgaben |
| `GET /settings/company` · `PUT /settings/company` | `settings:manage` | Firmendaten |
| `GET /users` · `POST /users` · `PATCH /users/:id` · `POST /users/:id/reset-password` | `users:manage` | Benutzerkonten; der letzte aktive Admin kann nicht gesperrt oder herabgestuft werden |
| `POST /demo/login` · `POST /demo/reset` | nur bei `DEMO_MODE=true`, sonst 404 | Ein-Klick-Login als Persona; alles zurücksetzen und neu seeden |

### 7.4 Logs
pino schreibt JSON auf stdout (`docker compose logs`) und über `pino-roll` nach `logs/app/pitstop.JJJJ-MM-TT.N.log` (täglich rotiert, 14 Dateien). Fastifys eigenes Request-Logging ist über `LogController` abgeschaltet (zur Laufzeit vorhanden, aber nicht typisiert, daher per `createRequire`); stattdessen ein kurzer `onResponse`-Eintrag je API-Aufruf. Request-Logs ohne Cookies und Bodies. Passwörter und Tokens nie loggen (`redact`).

### 7.5 CLI (`server/cli.ts`)
`pitstop reset-password <email>`: erzeugt ein zufälliges Startpasswort (16 Zeichen), setzt `must_change_password`, löscht alle Sitzungen des Benutzers und gibt das Passwort auf stdout aus.

## 8. Client

### 8.1 Routing (`client/lib/router.ts`, Hash-basiert)

| Hash | Ansicht | Hinweis |
|---|---|---|
| `#/login` | Anmeldung | Einzige Seite ohne Sitzung, neben den Rechtsseiten |
| `#/impressum` · `#/datenschutz` | Rechtsseiten | Öffentlich |
| `#/` bzw. `#/dashboard` | Dashboard | |
| `#/kunden` · `#/kunden/:id` | Kundenliste · mit Drawer | |
| `#/finanzen/rechnungen[/:id]` · `#/finanzen/ausgaben` | Finanzen | `finance:view` |
| `#/personal` · `#/personal/:id` · `#/personal/urlaub` | Personal | |
| `#/einstellungen/firma` · `#/einstellungen/benutzer` | Einstellungen | `settings:manage` / `users:manage` |

`useRoute()` hört auf `hashchange`, `navigate(path)` setzt den Hash. Unbekannte Route → Dashboard; fehlendes Recht → `<NoAccess/>`; keine Sitzung → `#/login?weiter=<ziel>`.

### 8.2 Daten im Client (`client/store/`)
- `GET /api/bootstrap` liefert `AppData`: `me`, `company`, `demoMode`, `customers`, `contacts`, `notes`, `invoices`, `expenses`, `employees`, `absences`, `timesheets`, `tasks`. Für Mitarbeiter fehlen `invoices` und `expenses` (leere Arrays), Mitarbeiterfelder sind gefiltert.
- `reducer.ts` kennt nur `loaded`, `upsert` (`collection`, `item`), `remove`, `contacts/replace` (alle Kontakte eines Kunden) und `company`. Fachlogik steckt nicht im Reducer.
- `mutations.ts` stellt je Aktion eine Funktion bereit (`createInvoice`, `decideAbsence`, …): API aufrufen, Antwort per `upsert` übernehmen, Toast zeigen, Fehler am Formular anzeigen. Betrifft eine Aktion mehrere Datensätze (Mahnen: Rechnung **und** Notiz), liefert die API beide zurück.
- Abgleich mit anderen Nutzern: erneuter Bootstrap beim Zurückkehren in den Tab (`visibilitychange`) und alle 60 Sekunden (nur bei sichtbarem Tab). Für einen Kleinbetrieb reicht das. Ab einigen tausend Rechnungen werden Listen auf seitenweise Endpunkte umgestellt (offener Punkt in AGENTS.md).
- Abgeleitete Werte nur über `shared/selectors.ts`, nie in Komponenten nachrechnen.

### 8.3 Overlays und Tastatur
- **Modal-Host** in `App.tsx`: `useModals().open('invoice', { customerId })`, `'customer'`, `'expense'`, `'absence'`, `'sick'`, `'employee'`, `'timesheet'`, `'user'`, `'password'`.
- **Toasts** über `useToast().show({ title, action? })`.
- **Befehlspalette:** `keydown` auf `window`, `(metaKey || ctrlKey) && key === 'k'`, `preventDefault()`. Suche über `search()` aus `shared/selectors.ts`; max. 5 Treffer je Gruppe; Kleinschreibung und Umlaute normalisiert.
- Modal und Drawer: Esc schließt, Fokus aufs erste Feld, `role="dialog"`, `aria-modal`, `aria-labelledby`.

## 9. Demo-Modus und Seed (`server/demo/`)

- Nur bei `DEMO_MODE=true` und nur bei leerer Datenbank (Erststart) oder über `POST /api/demo/reset`.
- `seed.ts` schreibt den Demo-Betrieb aus [CONCEPT.md](CONCEPT.md) Abschnitt 2 und 11 in die Datenbank: Stammdaten von Hand definiert, Bewegungsdaten mit seedbarem PRNG (`random.ts`, mulberry32, Seed aus dem Datum), **relativ zu heute**. Sequenzen danach per `setval` auf das Maximum setzen.
- Demo-Benutzer: `katrin.lindner@lindner-motorsport.example` (Admin) und `jonas.weber@lindner-motorsport.example` (Mitarbeiter), verknüpft mit den Demo-Mitarbeitern. Ihre Passwörter sind zufällig; angemeldet wird über `POST /api/demo/login`. Der Admin aus der `.env` existiert zusätzlich.
- Fahrzeuge: je Kunde aus `templates.ts`, dazu 140 erzeugte Laufkunden mit Alltagsautos (`walkInCustomers`). Kennzeichen und FIN zufällig, km-Stand aus Alter × Jahreslaufleistung je Kundenart, nächste HU zwischen −25 und +700 Tagen.
- Aufträge: Größe (klein/mittel/groß) und Leistung gewichtet (`JOBS[].weight`), Kunde gewichtet nach passenden Fahrzeugen. `JOBS[].vehicles` filtert (`combustion`, `electric`, `sporty` = Verbrenner ab 180 kW). Inspektion, HU, Klima, Zahnriemen, Kupplung, Motor und Umbauten höchstens einmal je Fahrzeug (`ONCE_PER_VEHICLE`).
- Reset: alle Fachtabellen und Sitzungen leeren (`TRUNCATE … RESTART IDENTITY CASCADE`), Seed und Admin neu anlegen, alle Clients landen auf der Anmeldeseite.

## 10. Berechnungen (`shared/`)

| Thema | Regel | Ort |
|---|---|---|
| Zeilensumme | `Math.round(quantity * unitPriceCents)` | `money.ts` |
| Netto | Summe der Zeilensummen | `money.ts` |
| MwSt | `Math.round(net * vatRate / 100)` auf die Netto-Summe, nicht je Zeile | `money.ts` |
| Brutto | Netto + MwSt | `money.ts` |
| Euro-Eingabe | `"1.234,56"` → 123456; Punkt = Tausender, Komma = Dezimal; ungültig → `null` | `money.ts` `parseEuroInput` |
| Überfällig | `status === 'open' && dueDate < today` | `selectors.ts` |
| Aufgabe „mahnen“ | überfällig **und** `dunningLevel < 3` **und** (`lastRemindedAt` fehlt oder liegt über 14 Tage zurück) | `selectors.ts` |
| Aufgabe „HU anbieten“ | Fahrzeug eines aktiven Kunden, `nextInspection` zwischen heute − 7 und heute + 14 Tagen (`INSPECTION_NOTICE_DAYS`) | `selectors.ts` |
| HU-Status am Fahrzeug | überfällig (rot), ≤ 60 Tage (gelb), sonst grün (`inspectionState`) | `selectors.ts` |
| Kennzeichen-Suche | Kleinschreibung, ohne Leer- und Bindestriche (`normalizePlate`): „rjw182“ findet „R-JW 182“ | `selectors.ts` |
| km-Stand aus Rechnung | Nur nach oben fortschreiben (`raiseMileage`) | `server/repo/vehicles.ts` |
| Mitarbeiterstatus | Krank, falls eine `sick`-Abwesenheit heute abdeckt; sonst Urlaub, falls eine genehmigte `vacation` heute abdeckt; sonst Im Dienst | `selectors.ts` |
| Arbeitstage | Montag bis Freitag zwischen `from` und `to` inklusive | `dates.ts` `workdaysBetween` |
| Resturlaub | Anspruch + Übertrag − genehmigte Urlaubstage im Kalenderjahr (beantragte separat) | `selectors.ts` |
| Überstundensaldo | Σ(worked − target) über alle Monate | `selectors.ts` |
| Monatsumsatz | Netto der Rechnungen mit `issueDate` im laufenden Monat; Vormonat bis zum selben Tag | `selectors.ts` |

Der Server rechnet Summen nicht nach, sondern speichert Positionen; angezeigt wird immer, was `money.ts` aus den Positionen errechnet. `today()` in `dates.ts` ist die einzige Stelle, die das aktuelle Datum liest (Client: Browserzeit; Server: `TZ`).

## 11. Domänentypen (`shared/types.ts`, Auszug)

Konventionen: Code englisch, Oberfläche deutsch (Zuordnung in `labels.ts`, Glossar in [CLAUDE.md](CLAUDE.md)). Geld in Cent (`…Cents`), Kalenderdaten `YYYY-MM-DD`, Zeitpunkte als ISO-String. API-Felder in camelCase; die Umwandlung von snake_case übernehmen die Repos.

```ts
export type Role = 'admin' | 'employee';
export interface User { id: string; email: string; displayName: string; role: Role; employeeId: string | null; active: boolean; mustChangePassword: boolean }
export type CustomerStatus = 'active' | 'lead' | 'inactive';
export type CustomerKind = 'private' | 'business' | 'fleet' | 'public';
export type NoteKind = 'note' | 'call' | 'email' | 'meeting' | 'system';
export type Unit = 'hours' | 'piece' | 'liter' | 'meter' | 'flat';
export type InvoiceStatus = 'open' | 'paid';                         // 'overdue' nur berechnet
export type ExpenseCategory = 'material' | 'vehicles' | 'rent' | 'payroll' | 'tools' | 'insurance' | 'office' | 'other';
export type Department = 'management' | 'office' | 'service' | 'workshop' | 'tuning' | 'parts';
export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'lpg';
export type ContractType = 'full_time' | 'part_time' | 'apprentice' | 'minijob';
export type AbsenceKind = 'vacation' | 'sick';
export type AbsenceStatus = 'requested' | 'approved' | 'rejected';
export type EmployeeStatus = 'on_duty' | 'vacation' | 'sick';         // nur berechnet

export interface Vehicle {
  id: string; customerId: string; plate: string; make: string; model: string; variant: string; vin: string;
  firstRegistration: string | null; mileage: number | null; nextInspection: string | null; // HU/AU
  fuel: FuelType; powerKw: number | null; notes: string; createdAt: string;
}
export interface Invoice {
  id: string; number: number; customerId: string; vehicleId: string | null; mileage: number | null; issueDate: string; dueDate: string;
  items: InvoiceItem[]; vatRate: 19; status: InvoiceStatus; paidAt?: string;
  dunningLevel: 0 | 1 | 2 | 3; lastRemindedAt?: string; createdByUserId: string;
}
export interface Employee {
  id: string; personnelNumber: string; firstName: string; lastName: string;
  jobTitle: string;                                                  // NICHT 'role'
  department: Department; email: string; phone: string;
  hourlyRateCents?: number;                                          // fehlt, wenn der Betrachter es nicht sehen darf
  contractType?: ContractType; weeklyHours?: number; entryDate?: string; /* … */
  vacationDaysPerYear?: number; carryOverDays?: number; active: boolean;
}
// Customer, ContactPerson, Note (authorUserId), InvoiceItem, Expense, Absence (decidedByUserId),
// TimesheetMonth, Task, CompanySettings, AppData: vollständig in der Datei.
```

## 12. Gestaltung (Tailwind v4)

`src/client/index.css`:
```css
@import "tailwindcss";
@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --color-brand-50:  #eef2ff;
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;   /* Primärknöpfe, aktive Zustände */
  --color-brand-700: #4338ca;
}
```

| Element | Klassen-Richtung |
|---|---|
| App-Hintergrund | `bg-zinc-50`, Text `text-zinc-900` |
| Seitenleiste | `bg-zinc-950 text-zinc-400`, aktiver Eintrag `bg-white/10 text-white`, Breite 240 px |
| Karten | `bg-white border border-zinc-200 rounded-xl`, kaum Schatten |
| Primärknopf | `bg-brand-600 hover:bg-brand-700 text-white rounded-lg h-9 px-3 text-sm font-medium` |
| Sekundärknopf | `bg-white border border-zinc-200 hover:bg-zinc-50` |
| Tabellen | Kopf `text-xs uppercase tracking-wide text-zinc-500`, Zeilen `hover:bg-zinc-50`, Zahlen `tabular-nums text-right` |
| Badges | `rounded-full px-2 py-0.5 text-xs font-medium` + `bg-<farbe>-50 text-<farbe>-700 ring-1 ring-<farbe>-600/20` |
| Fokus | `focus-visible:ring-2 ring-brand-500 ring-offset-2` |
| Anmeldeseite | zentrierte Karte auf `bg-zinc-950`, Logo, Links zu Impressum und Datenschutz |

Badge-Farben: emerald = bezahlt, aktiv, im Dienst, genehmigt · amber = offen, Lead, beantragt · rose = überfällig, krank · sky = Urlaub · zinc = inaktiv, abgelehnt. Zentral in `shared/labels.ts`. Recharts braucht Hex-Werte, keine Tailwind-Klassen (Umsatz `#4f46e5`, Ausgaben `#d4d4d8`).

## 13. Lokale Entwicklung

```bash
cp .env-example .env                  # PUBLIC_URL=http://localhost:5173, Passwörter setzen
docker compose -f docker-compose.yml -f compose.dev.yml up -d db
npm install
npm run dev:server                    # tsx watch, Port 3000; config.ts liest .env und .impressum selbst (außer NODE_ENV=production)
npm run dev:client                    # Vite auf 5173, Proxy /api → http://localhost:3000
```

| Skript | Zweck |
|---|---|
| `dev:server` / `dev:client` | Entwicklung (beide im Hintergrund laufen lassen) |
| `build` | `vite build` + `esbuild` Server + Migrationen nach `dist/server/migrations` kopieren |
| `typecheck` | `tsc -p tsconfig.client.json --noEmit && tsc -p tsconfig.server.json --noEmit` |
| `lint` | ESLint |
| `start` | `node dist/server/main.js` (so läuft es im Container) |

Lokal teilen sich Entwicklung und ein per `docker compose up -d` gestartetes Pitstop auf diesem Rechner denselben `./db`-Ordner. Nach `npm run build` liefert auch `dev:server` den gebauten Client unter http://localhost:3000 aus.

## 14. Testen und Abnahme

| Stufe | Vorgehen | Wann |
|---|---|---|
| Typen, Lint | `npm run typecheck`, `npm run lint` | Nach jeder Datei-Gruppe |
| Build | `npm run build`, `docker compose build` | Ende jeder Phase |
| API | Pro Route: angemeldet/abgemeldet, Admin/Mitarbeiter, ungültige Eingaben (`curl` oder kleines Skript). Jede 5xx-Antwort ist ein Fehler | Ab Phase 3 |
| Konsole | Browser-Konsole ohne Fehler und React-Warnungen | Ende jeder Phase |
| Abnahme | Demo-Drehbuch und Echtbetrieb-Drehbuch aus [CONCEPT.md](CONCEPT.md) Abschnitt 13, automatisiert in `tests/e2e/` | Schlussphase und vor jedem Release |
| README-Test | In `/tmp` frisch klonen und **genau** die README-Schritte ausführen: Setup, Update, Backup, Restore, Löschen. Mit `docker compose -p pitstop-test` und anderem `PITSTOP_PORT` | Schlussphase |

**Browser-Drehbücher** (`tests/e2e/`): `demo.mjs` spielt CONCEPT.md 13.1 durch (braucht `DEMO_MODE=true` und frisch zurückgesetzte Demo-Daten), `echtbetrieb.mjs` die Schritte 1–8 von 13.2 (braucht einen frischen Stack mit `DEMO_MODE=false`, `IMPRESSUM_NAME="Test Haustechnik GmbH"` und `ADMIN_EMAIL`/`ADMIN_PASSWORD` als Umgebungsvariablen). Start mit `tests/e2e/run.sh demo.mjs http://localhost:8080`; Chromium kommt aus dem Image `mcr.microsoft.com/playwright:v1.49.1-noble`, Screenshots landen in `tests/e2e/shots/`. Ergebnis 2026-11-19: beide grün, Konsole ohne Fehler.

## 15. Fallstricke

- **`npm create vite … --overwrite` im Ordner `pitstop/` löscht die Doku.** In `/tmp` scaffolden und nur die benötigten Dateien übernehmen (Struktur weicht ohnehin ab: Client liegt unter `src/client`).
- **Postgres ab 18 im Docker-Image:** Volume auf `/var/lib/postgresql` mounten, **nicht** auf `/var/lib/postgresql/data`. Die Daten liegen dann in `./db/18/docker`. Dadurch landet ein Hauptversionswechsel sauber in `./db/19/…`.
- **Nie `postgres:latest`** oder ein Tag ohne Hauptversion: Ein automatischer Sprung auf eine neue Hauptversion startet nicht mit den alten Daten.
- **`pull_policy: build` bei `app` nicht entfernen:** Ohne die Einstellung nimmt `docker compose up -d` das alte Image, und ein Update per `git pull` hätte keine Wirkung.
- **`POSTGRES_PASSWORD` wirkt nur beim ersten Start** (leeres `./db`). Spätere Änderungen in der `.env` führen zu `password authentication failed`.
- **DB-Passwort nie in eine Verbindungs-URL bauen** (Sonderzeichen); `pg` liest `PG*`-Variablen.
- **Bind-Mounts gehören root:** Die App läuft als `node` (UID 1000) und braucht `entrypoint.sh` mit `chown` und `su-exec`. Postgres braucht für das Log-Verzeichnis das `chown` im überschriebenen Entrypoint, sonst startet es mit `logging_collector` nicht.
- **`pg` liefert `int8` und `numeric` als String und `date` als `Date`** (Zeitzonen-Versatz). Typ-Parser in `pool.ts` setzen.
- **Migrationen müssen ins Image:** esbuild bündelt keine `.sql`-Dateien; `build` kopiert sie nach `dist/server/migrations`.
- **Compose-Projektname ist fest `pitstop`:** Ein Test-Klon auf demselben Rechner ersetzt sonst die laufenden Container. Für Tests `-p pitstop-test` verwenden.
- **Demo-Endpunkte** müssen bei `DEMO_MODE=false` mit 404 antworten, nicht mit 403 (keine Hinweise nach außen).
- **Leere DB mit vorhandenem `data/.initialized`:** Der Startabbruch ist ein gewollter Schutz, kein Fehler im Code. Nicht „reparieren“, indem der Admin trotzdem angelegt wird.
- **Tailwind v4 ist nicht v3:** kein `npx tailwindcss init`, kein `tailwind.config.js`, kein `@tailwind base;`.
- **Recharts `ResponsiveContainer`** braucht einen Elterncontainer mit fester Höhe (z. B. `h-72`).
- **`verbatimModuleSyntax`:** Reine Typen mit `import type { … }` importieren.
- **`new Date('2026-11-19')`** ist UTC-Mitternacht. Für Kalenderdaten nur die Helfer aus `dates.ts`; Vergleiche als String.
- **Geld nie als Float.** Immer Cent-Ganzzahlen.
- **`role` ist doppelt belegt:** `User.role` = Berechtigung, `Employee.jobTitle` = Beruf.
- **Strg+K** belegt im Browser die Adressleisten-Suche: Listener auf `window` mit `preventDefault()`.
- **Secure-Cookie über http:** Steht `PUBLIC_URL` auf https, aber der Aufruf kommt per http, setzt der Browser das Cookie nicht, und der Login scheint wirkungslos.
- **WSL2:** Projekt im Linux-Dateisystem lassen, nicht nach `/mnt/c`, sonst sind Datei-Watching und Bind-Mounts unzuverlässig.
- **TypeScript 7** (nativer Compiler) wird von typescript-eslint noch nicht unterstützt; bei `typescript@~6.0` bleiben, bis typescript-eslint es erlaubt.
- **Euro-Beträge enthalten ein geschütztes Leerzeichen** (U+00A0 vor „€“, von `Intl`). Tests und Textvergleiche per Regex auf die Zahl, nicht auf „45,00 €“ mit normalem Leerzeichen.
- **Breite von Eingabefeldern:** `Input`/`Select` setzen `w-full`, außer `className` enthält selbst eine `w-…`-Klasse. Sonst entscheidet die CSS-Reihenfolge zwischen `w-full` und z. B. `w-auto`.
- **`pkill -f <muster>` trifft die eigene Shell,** wenn das Muster im Befehl steht. Mit Zeichenklasse arbeiten: `pkill -f 'src/server/main[.]ts'`.
- **`cp` ist auf dem Entwicklungsrechner ein Alias für `cp -i`** und überschreibt ohne Eingabe nichts. In Skripten `command cp -f` verwenden.
- **`.gitignore`-Muster für Laufzeitordner an der Wurzel verankern** (`/db/`, `/data/` …): Ein Muster `db/` ignoriert sonst auch `src/server/db/` mit allen Migrationen – ein Klon ließe sich nicht bauen.
- **firewalld aus einer anderen WSL-Distribution** (nftables-Tabelle `inet firewalld`) gilt für alle Distributionen und weist Verkehr zwischen Containern ab (`EHOSTUNREACH`, App findet `db` nicht). Prüfen mit `nft list tables`; firewalld dort beenden oder Docker-Bridges freigeben (`iifname "br-*" accept`).
- **Docker-Build dauert unter WSL2 3–5 Minuten,** sobald sich Code ändert (Vite + esbuild im Container). Ohne Codeänderung wenige Sekunden (Cache).
