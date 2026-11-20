# Pitstop – Technische Sicht

Ergänzt [CONCEPT.md](CONCEPT.md) um das *Wie*. Betrieb (Setup, Update, Backup, Löschen) steht in [README.md](README.md). Stand: 2026-11-20, **Version 0.5 (RP-Plattform, ganzes Mockup, Anbindungen)**. Wird etwas anders gebaut als hier beschrieben, wird diese Datei angepasst, nicht der Code an die Datei.

## 1. Überblick

```
Browser ──HTTP──▶ app (Docker, Node 24)                          ──SQL──▶ db (Docker, postgres:18-alpine)
                  ├─ /api/*   Fastify-REST-API (Login, Rechte, Daten)       Daten in ./db
                  └─ /*       ausgelieferte React-SPA (dist/client)
                  Logs ./logs/app · Daten ./data · Betreiberdateien ./conf (nur lesend)
```

- **Eine** App-Instanz liefert SPA und API am selben Ursprung aus (keine CORS-Probleme, Cookies einfach).
- Die SPA lädt nach dem Login `GET /api/me` (Konto, Firmen) und für die gewählte Firma `GET /api/c/:companyId/bootstrap` – bereits nach den Rechten der Person gefiltert. Nach jeder schreibenden Aktion lädt sie den Firmenstand neu (außerdem alle 60 s und beim Zurückkehren in den Tab).
- **Rechte prüft der Server** bei jeder Route über den Firmenkontext (`auth/guards.ts → companyCtx`). Die Oberfläche blendet nur zusätzlich aus.

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
| Styling | Eigenes CSS aus dem bestätigten Mockup (`src/client/index.css`) | Themes über `html[data-skin]`, Dichte, Seitenleiste, Schrift, Bewegung über weitere `data-*`-Attribute. Kein CSS-Framework (Tailwind ist seit 0.3 entfernt) |
| Icons, Schrift | Eigene SVG-Symbole (`client/lib/icons.tsx`); Mockup-Schriften lokal gebündelt: `@fontsource/chakra-petch` (Überschriften, 500–700), `@fontsource-variable/manrope` (Text), `@fontsource-variable/jetbrains-mono` (Zahlen) | Keine Google-Fonts-Anfragen; vom Auftraggeber am 2026-11-20 freigegeben. `conf/datenschutz.md` wird als Text angezeigt (kein Markdown-Paket) |
| Server-Build | `esbuild` (bündelt `src/server` → `dist/server/main.js`) | `tsc` nur zur Typprüfung |
| Dev-Server | `tsx watch` (Server), `vite` (Client mit Proxy `/api`) | |

Bewusst **nicht** verwendet: ORM, react-router, State-Bibliotheken, UI-Kits, Redis, eigener Reverse-Proxy. Jede weitere Abhängigkeit nur nach Rückfrage.

`dependencies` enthält nur, was der Server zur Laufzeit braucht (Fastify, pg, zod, pino). Alle Client-Bibliotheken (React, Schriften) stehen in `devDependencies`, weil Vite sie einbündelt; so bleibt das Image nach `npm prune --omit=dev` klein.

Installierte Versionen (2026-11-20):

| Paket | Version | | Paket | Version |
|---|---|---|---|---|
| vite | 8.3 | | fastify | 5.12 |
| react | 19.3 | | pg | 8.23 |
| typescript | 6.0 | | zod | 4.6 |
| @fontsource/* | 5.3 | | esbuild | 0.28 |

## 3. Repository-Struktur

```
src/
  shared/            Client + Server, ohne DOM und Node-APIs
    permissions.ts   Bereiche, Stufen, Sonderrechte, computeRights(), Gruppenvorlagen
    types.ts         Domänentypen und API-Antworten
    format.ts        $-Beträge, Datum, Dauer, Nummern (W-, E-, R-, K-)
    dates.ts         today() und Datumsrechnung
    tuning.ts        Tuning-Preisliste (Vorgabe) und quoteTuning()
    feed.ts          Protokollbereich → Rechtebereich und Filtergruppe (Live-Feed, Webhook-Ereignisse)
    integrations.ts  Katalog der Anbindungen (Serververwaltung)
    changelog.ts     Inhalt der Seite „Neuigkeiten“
    version.ts       APP_VERSION
  server/
    main.ts, app.ts, config.ts, logger.ts, errors.ts, cli.ts
    settings.ts      Server-Einstellungen (settings 'server', im Speicher zwischengespeichert), Merker
    hooks.ts         Webhooks: Versand aus audit(), Prüfung der Adresse (nur https, nichts Internes)
    auth/            password.ts (scrypt), sessions.ts, guards.ts (requireUser, requireServerAdmin, companyCtx), totp.ts (RFC 6238 mit node:crypto)
    db/              pool.ts, migrate.ts, init.ts, migrations/001–006
    repo/            users.ts, companies.ts (Firmen, Mitglieder, Gruppen, Ausnahmen, Rechte, Protokoll), records.ts (Fachdaten generisch)
    routes/          auth.ts (+ /me, /me/sessions), company.ts, work.ts, modules.ts (Lager, Dienstplan, Lohn, Schulungen, Tuning, Racing),
                     crud.ts (generisches Anlegen/Ändern/Löschen), more.ts (alles ab 0.4), platform.ts (Server-Einstellungen, Anbindungen,
                     API-Schlüssel, /api/v1, Hintergrundjobs), discord.ts (OAuth), game.ts (Spielserver-API + Schlüssel), photos.ts (Fotos), server.ts, export.ts, public.ts, demo.ts, util.ts
    demo/            seed.ts (Demo-Firma „Demo Motorsport“), modules.ts (Moduldaten 0.3), more.ts (Daten ab 0.4)
  client/
    main.tsx, App.tsx (Anmeldung, Passwortwechsel), index.css (Mockup-Gestaltung)
    lib/             api.ts, app.tsx (Zustand), nav.ts (Seiten), icons.tsx, mapdata.ts, storage.ts
    components/      Shell.tsx, ui.tsx (Bausteine, FormModal, Drawer …)
      pages/         Cockpit (Arbeitsflächen, Widgets, todo()), Calendar, Orders, Lager, Leitstelle + MapView, Tuning, Racing, Customers (+ Fahrzeugakte),
                     Staff, Plan (Dienstplan, Abwesenheit, Nachtrag, Lohn), Training (Schulungen, Prüfungen, Lizenzen), Finance (Rechnungen, Angebote, Buchungen),
                     Company (inkl. Kalibrierung), Personal (Konto, Geräte), Server (inkl. Anbindungen, Einstellungen), helpers,
                     ab 0.4: Werkstatt (Annahme, Hallenplan, Werkzeug), Abschlepp (Einsätze, Fuhrpark), RacingTeam (Team, Telemetrie, Trackdays),
                     Kunden (Verträge, Nachrichten), People (Ränge, Bewerbungen), Money (Finanzen, Kasse, Auswertung), Firma (Preisliste, Regelwerk,
                     Pinnwand, Live-Feed, Firmeneinstellungen, Webhooks)
fivem/pitstop/       FiveM-Ressource (fxmanifest.lua, config.lua, server.lua, README.md)
tests/
  api/rechte.mjs     API-Rechtetest (Demo-Modus)
  api/anbindungen.mjs  0.5: Zwei-Faktor, Discord (mit eigener Attrappe auf Port 3199), Fotos, Spielserver-API
  fivem/             run.sh + run.lua: die FiveM-Ressource mit nachgebauten Natives gegen einen echten Pitstop
  e2e/               Browser-Drehbuch demo.mjs + run.sh (Playwright im Container)
```

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
- Laufende Nummern aus Sequenzen, serverweit: `customer_no_seq` (K-1001), `order_no_seq` (W-1001), `callout_no_seq` (E-201), `bill_no_seq` (R-1001).
- Jede Fachtabelle hat `company_id`; jede Abfrage in `repo/records.ts` ist daran gebunden.
- **Typ-Parser in `pool.ts`:** `date` (OID 1082) bleibt String `YYYY-MM-DD`, `numeric` (1700) → `Number`, `int8` (20) → `Number` (z. B. aus `count(*)`/`sum()`).
- Eine angewendete Migration wird nie geändert; Korrekturen kommen als neue Datei.

### 6.2 Schema (Überblick, maßgeblich sind die Migrationen; 003 ersetzt die Fachtabellen von 0.1, 004 ergänzt die Module von 0.3, 005 das restliche Mockup in 0.4)

```
users(id, email, display_name, password_hash, is_server_admin, active, must_change_password, prefs jsonb, discord, is_demo, …)
sessions(token_hash pk, user_id, remember, last_seen_at, expires_at)
settings(key pk, value jsonb)                                   -- frei für Server-Einstellungen
companies(id, name, short, status[active|paused], modules text[], lock_wins, support_access, info jsonb, map_bounds jsonb, tuning jsonb)
memberships(company_id, user_id, rank, phone, locked, wage_cents, commission_pct)   -- pk (company_id, user_id)
groups(id, company_id, name, color, description, is_owner, levels jsonb, own jsonb, specials jsonb, position)
group_members(group_id, user_id)
permission_exceptions(id, company_id, user_id, area, level[x|1|2|3], until date, reason)   -- unique (company, user, area)
customers(id, company_id, number, name, kind[privat|firma|fraktion|racing], phone, note, discount, blocked)
vehicles(id, company_id, customer_id, plate, model, note)
orders(id, company_id, number, title, kind, status[neu|arbeit|wartet|fertig|abgeholt], priority, customer_id, vehicle_id,
       assignee_id → users, amount_cents, progress, note, created_by)
callouts(id, company_id, number, location, x, y, requester, vehicle, status[offen|unterwegs|vorort|erledigt], driver_id, truck,
         fee_cents, created_by, done_at)
bills(id, company_id, number, customer_id, order_id, callout_id, title, amount_cents, status[offen|bezahlt|storniert], due_date, paid_at, created_by)
transactions(id, company_id, account[firma|kasse], amount_cents (+/−), text, category, bill_id, booked_at, created_by)
duty_sessions(id, company_id, user_id, started_at, ended_at)     -- höchstens eine offene Schicht pro Person und Firma
audit_log(id, company_id null = Server, user_id, area, action, created_at)
announcements(id, title, body, tone, author_id, created_at)
-- ab 004
parts(id, company_id, sku, name, unit, qty ≥ 0, min_qty, price_cents, location, note)
shifts(id, company_id, user_id, starts_at, ends_at > starts_at, role, note, created_by)
payslips(id, company_id, user_id, period_from, period_to, minutes, wage_cents, commission_cents, bonus_cents, total_cents,
         status[offen|bezahlt], paid_at, transaction_id)          -- unique (company, user, period_from, period_to)
courses(id, company_id, name, category, lessons jsonb [{title,text}], questions jsonb [{q,options,correct}], pass_pct,
        valid_months, practical, required_groups jsonb [group-id | 'alle'], trainer_id)
course_progress(company_id, course_id, user_id, lessons_done, score, practical_ok, practical_by, passed_at)   -- pk (course, user)
dyno_runs(id, company_id, vehicle_id, label, hp, torque, note, created_by)
race_events(id, company_id, name, kind[rennen|teamstart|trackday|meet], starts_at, track, laps, fee_cents, prize_cents, max_entries,
            status[planung|offen|fertig|abgesagt], note)
race_entries(id, company_id, event_id, driver, car, start_no, customer_id, team, paid, lap_ms, position, car_id → race_cars)
-- ab 005 (Änderungen an bestehenden Tabellen)
sessions.user_agent · transactions.account + trinkgeld|rennteam · bills.kind[rechnung|angebot], reminders, reminded_at
companies.extra jsonb (payDays, footer, locations, templates, trackdayPackages, publicData) · orders.intake jsonb, service_id → services
vehicles.stolen · memberships.fixed_cents · payslips.fixed_cents · course_progress.answers/review jsonb, choice_right
-- ab 005 (neue Tabellen, alle mit company_id außer api_keys/integration_votes)
part_moves(part_id, delta, note) · part_orders(part_id, qty, supplier, cost_cents, expected, status[bestellt|geliefert|storniert])
bays(name, kind, position) · bay_bookings(bay_id, order_id, title, starts_at, ends_at)        -- keine Überschneidung je Platz (Server prüft)
tools(name, info, location, status[frei|ausgegeben|wartung], holder_id, since, check_due)
fleet(name, model, plate, km, fuel, status[frei|einsatz|werkstatt], driver_id, service_due) · fleet_log(fleet_id, user_id, action, km, fuel, cost_cents)
race_cars(number, car, driver_id, status, km, wear jsonb, budget_cents) · championship(season, team, points, own)
setups(car_id, track, vals jsonb)  -- unique (car_id, track) · laps(car_id, driver, track, s1, s2, s3, session)
trackday_bookings(event_id, customer_id, vehicle_id, package, price_cents, transport, status, bill_id)
contracts(customer_id, title, workshop_pct, tuning_pct, rules, billing, valid_until, status) · messages(customer_id, dir[in|out], text, user_id, read)
ranks(name, position, wage_cents, commission_pct, fixed_cents, groups jsonb) · applications(name, role, contact, text, rating, status, interview_at)
absences(user_id, date_from, date_to, kind, status, decided_by) · duty_corrections(user_id, duty_id, started_at, ended_at, reason, status)
course_sessions(course_id, starts_at, kind, trainer_id, participants jsonb) · licenses(name, holder_id, valid_until)
cash_closings(expected_cents, counted_cents) · standing_orders(text, amount_cents ±, account, every[woche|monat|jahr], next_date, active)
goals(name, target_cents, account, deadline) · services(name, area, price_cents, course_id)
rule_docs(title, body, version) · rule_acks(doc_id, user_id, version) · posts(author_id, title, body, pinned, poll jsonb)
post_reads(post_id, user_id) · poll_votes(post_id, user_id, option) · webhooks(name, url, kind[discord|json], events jsonb, last_status, fails)
api_keys(name, prefix, hash sha256, revoked, last_used_at) · integration_votes(key, user_id)
-- ab 006
users.totp_secret, totp_enabled, totp_last_step (verbrauchter Zeitschritt), discord_id (unique) · memberships.game_id (unique je Firma, wenn gesetzt)
oauth_states(state pk, purpose[login|link], user_id, remember)   -- 10 Minuten gültig, einmalig
order_photos(order_id, ext[jpg|png|webp], size, note, created_by)  -- Datei data/photos/<firma>/<id>.<ext>
game_keys(company_id, name, prefix, hash sha256 unique, last_used_at, revoked)
```

jsonb-Spalten schreibt `repo/records.ts` als JSON-Text (`toDb()`): pg würde JS-Listen sonst als Postgres-Array schicken. `BACKUP_TABLES` in `routes/server.ts` ist nach Fremdschlüsseln sortiert (z. B. `courses` und `services` vor `orders`).

Migration 005 ergänzt Vorlagengruppen gleichnamig um die neuen Bereiche (wie 004). Migration 004 schaltet in bestehenden Firmen die Module `tuning`, `racing`, `schulungen` ein und ergänzt in Gruppen mit den Vorlagen-Namen (Leitung, Mechanik, …) die Stufen der neuen Bereiche, wo noch nichts gesetzt ist (`jsonb ||` mit den bestehenden Werten zuletzt).

## 7. Server

### 7.1 Anmeldung und Sitzungen
- Passwort-Hash: `scrypt` (N=32768, r=8, p=1, 16 Byte Salt, 64 Byte Schlüssel), gespeichert als `scrypt$N$r$p$salt$hash`, Vergleich mit `timingSafeEqual`. Mindestlänge 12 Zeichen.
- Login erzeugt ein zufälliges Token (32 Byte, base64url) im Cookie `pitstop_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` bei https). In der DB liegt nur `sha256(token)`.
- Ablauf: 8 Stunden ohne Aktivität, mit „Angemeldet bleiben“ 30 Tage. `last_seen_at` höchstens einmal pro Minute schreiben.
- Login-Schutz: `@fastify/rate-limit` auf `/api/auth/login` (10 Versuche / 15 min je IP). Fehlermeldung immer gleich: „E-Mail oder Passwort falsch“. Gesperrte (`active = false`) Benutzer kommen nicht hinein, ihre Sitzungen werden beim Sperren gelöscht.
- `must_change_password`: Alle Routen außer `auth/*` antworten mit 403 und dem Code `PASSWORD_CHANGE_REQUIRED`; der Client zeigt dann nur das Passwort-Formular.
- CSRF: `SameSite=Lax` plus Pflicht `Content-Type: application/json` für schreibende Methoden plus Prüfung des `Origin`-Headers gegen `PUBLIC_URL` (sofern vorhanden).
- `trustProxy` für Loopback und private Netze, damit Rate-Limit und Logs hinter einem Reverse-Proxy die echte IP sehen.
- **Zwei-Faktor (TOTP):** `auth/totp.ts` (SHA-1, 6 Stellen, 30 s, ±1 Schritt). Geheimnis nur im Server; `totp_last_step` verhindert, dass ein Code zweimal gilt. Login ohne Code bei aktivem 2FA → 401 `TOTP_REQUIRED`, die Anmeldeseite zeigt dann das Code-Feld. Notfall: CLI `pitstop disable-2fa <email>`.
- **Discord-Anmeldung** (`routes/discord.ts`): nur mit `DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET`. `GET /auth/discord/start?mode=login|link` legt einen `state` an und leitet zu `<DISCORD_API>/oauth2/authorize` (Scope `identify`); `/auth/discord/callback` tauscht den Code, holt `/users/@me`, prüft den `state` (einmalig, 10 min) und verknüpft bzw. meldet an (nur verknüpfte, aktive Konten ohne 2FA; Wartungsmodus gilt). Ergebnis als `/?discord=<code>` zurück in die App. `DISCORD_API` lässt sich für Tests auf eine Attrappe umstellen.
- Angemeldete Geräte (`GET/DELETE /me/sessions`): Kennung = die ersten 16 Zeichen von `sha256(token)`, nie das Token; die eigene aktuelle Sitzung lässt sich so nicht abmelden.
- **Wartungsmodus** (`settings.ts`): Login und alle API-Aufrufe außer `auth/logout`, `auth/me`, `public/*` und `health` antworten Nicht-Admins mit 503 `MAINTENANCE`.
- `@fastify/helmet` mit strikter CSP: `script-src 'self'`; `style-src 'self' 'unsafe-inline'` (React setzt Inline-Styles); `img-src 'self' data:`.

### 7.2 Rechte

Fachlich: [CONCEPT.md](CONCEPT.md) Abschnitt 3. Technisch: Jede Firmenroute ruft `companyCtx(req, cfg)`; das lädt Firma und Mitgliedschaft, rechnet mit `computeRights()` (Gruppen der Person, gültige Ausnahmen, `lock_wins`, Module) die effektiven Rechte und liefert `need(area, min)`, `needSpecial(key)` und `ownOnly(area)`. Ohne Mitgliedschaft (oder gesperrt) gibt es 403 – außer für Server-Admins bei `support_access`: dann `supportRights()` (alles Stufe 1, keine Sonderrechte). Pausierte Firmen erreichen nur Inhaber und Server-Admins. Bei „nur eigene“ filtert der Bootstrap die Listen, und Änderungen an fremden Einträgen ergeben 403. Verknüpfte IDs (Kunde, Fahrzeug, Mitglied) werden auf dieselbe Firma geprüft.

### 7.3 API

Alle Routen unter `/api`, JSON. Fehlerformat `{ "error": { "code", "message", "fields" } }`, Meldungen deutsch. Status: 400, 401, 403, 404, 409, 429.

| Pfad | Zugriff | Wirkung |
|---|---|---|
| `GET /health`, `GET /public/legal`, `GET /public/logo` | öffentlich | wie 0.1 |
| `POST /auth/login`, `/auth/logout`, `GET /auth/me`, `POST /auth/password` | – | Sitzung, Passwort |
| `GET /me`, `PATCH /me` | angemeldet | Konto, Firmen, Version; Profil und Darstellung (`prefs`, inkl. `widgets` der Arbeitsfläche) |
| `GET /c/:cid/bootstrap` | Mitglied / Support | Firma, Rechte, Mitglieder, Gruppen, Ausnahmen, Fachdaten – gefiltert |
| `PATCH /c/:cid/settings` · `PUT /c/:cid/modules` | firma 2 (Support-Freigabe nur Inhaber) · module 2 | Firmendaten, Regel bei mehreren Gruppen, Kartenränder; Module |
| `POST/PATCH/DELETE /c/:cid/members[/:userId]` | zugaenge 2 + einladen · zugaenge 2 (Gruppen zusätzlich gruppen 2) · zugaenge 3 | Aufnehmen (legt ggf. Konto mit Startpasswort an), ändern, entfernen |
| `POST/PUT/DELETE /c/:cid/groups[/:id]` | gruppen 2 / 3 | Gruppen; Inhaber-Gruppe unveränderlich |
| `PUT /c/:cid/exceptions`, `DELETE /c/:cid/exceptions/:id` | gruppen 2 | Ausnahme setzen/ersetzen, löschen |
| `GET /c/:cid/audit` | protokoll 1 | Firmen-Protokoll |
| `PUT/GET/DELETE /c/:cid/map` | firma 2 (GET: Mitglied) | Kartenbild als Rohdaten (`image/jpeg|png|webp`, bis 60 MB) in `data/maps/<cid>.*` |
| `GET /c/:cid/export/:set` | Sonderrecht export **und** der Bereich des Datensatzes ganz (nicht „nur eigene“) | CSV (Sätze in `routes/export.ts`, Bereich in `EXPORT_AREA` in `routes/company.ts`) |
| `POST/PATCH/DELETE /c/:cid/customers[/:id]` | kunden 2; `blocked` braucht kundensperre; löschen kundenloeschen | Kunden |
| `POST/PATCH/DELETE /c/:cid/vehicles[/:id]` | fahrzeuge 2 / 3 | Fahrzeuge |
| `POST/PATCH/DELETE /c/:cid/orders[/:id]` | auftraege 2 / 3 | Aufträge |
| `POST/PATCH /c/:cid/callouts[/:id]` | leitstelle 2; anderen zuteilen braucht zuteilen | Einsätze; freie Einsätze darf man sich selbst nehmen |
| `POST /c/:cid/bills`, `/bills/:id/pay`, `/bills/:id/cancel` | rechnungen 2; Storno braucht storno | Rechnung; bezahlt (bucht Einnahme in einer Transaktion); Storno (bucht bezahlte zurück) |
| `POST /c/:cid/transactions` | buchungen 2; Ausgaben brauchen auszahlung (Grenze in $) | Buchung |
| `POST /c/:cid/duty/start`, `/duty/stop`, `DELETE /c/:cid/duty/:id` | Mitglied · dienstzeiten 3 | Stempeluhr |
| `POST/PATCH/DELETE /c/:cid/parts[/:id]`, `POST /c/:cid/parts/:id/move` | lager 2 / 3; `move` mit `book` zusätzlich buchungen 2 + auszahlung (Grenze) | Lager; Zugang/Entnahme (nie unter 0), optional Ausgabe buchen – eine Transaktion |
| `POST/PATCH/DELETE /c/:cid/shifts[/:id]` | dienstplan 2; „nur eigene“ nur für sich | Dienstplan |
| `PATCH /c/:cid/wages/:userId` | lohn 3 | Stundenlohn, Provision |
| `POST /c/:cid/payslips/run`, `PATCH/DELETE /c/:cid/payslips/:id`, `POST /c/:cid/payslips/:id/pay` | lohn 3; auszahlen zusätzlich lohnzahlung | Lohnlauf (Stempeluhr × Stundenlohn + Provision auf bezahlte Rechnungen eigener Aufträge/Einsätze; doppelte Zeiträume übersprungen), Bonus, löschen (nur offen), auszahlen (Ausgabe Firmenkonto) |
| `POST/PATCH/DELETE /c/:cid/courses[/:id]` | schulungen 2 / 3 | Kurse |
| `POST /c/:cid/courses/:id/lesson`, `/test` | Mitglied (Modul an, nicht Support) | Lernfortschritt; Test wertet der Server, Lösungen gehen nur an schulungen ≥ 2 |
| `POST /c/:cid/courses/:id/practical` | schulungen 2 oder Trainer des Kurses; nie bei sich selbst | Praxisprüfung |
| `PUT/DELETE /c/:cid/tuning` | tuning 3 | Preisliste setzen / auf Vorgabe (`shared/tuning.ts`) |
| `POST /c/:cid/tuning/order` | tuning 2 | Konfigurator → Auftrag „tuning“; Preis mit `quoteTuning()` auf dem Server |
| `POST/DELETE /c/:cid/dyno[/:id]` | tuning 2 / 3 | Prüfstand |
| `POST/PATCH/DELETE /c/:cid/events[/:id]`, `POST /c/:cid/events/:id/entries`, `PATCH/DELETE /c/:cid/entries/:id`, `POST /c/:cid/entries/:id/pay` | racing 2 (löschen Event 3) | Events, Starter (Startplätze begrenzt), Startgeld in die Kasse |
| **ab 0.4** generisches CRUD (`routes/crud.ts`): `POST /c/:cid/<pfad>`, `PATCH/DELETE …/:id` | Bereich 2 / 3 (siehe Spalte) | bays (hallenplan 3), bookings (hallenplan 2, Überschneidung → 409), tools (werkzeug), fleet (fuhrpark), race-cars, championship, laps, trackdays (racing; Preis aus Paket), contracts (vertraege), ranks (raenge 3), applications (bewerbungen), course-sessions, licenses (schulungen), standing (buchungen 3), goals (buchungen), services (preisliste), webhooks (firma 3; nur https, nichts Internes) |
| `POST /c/:cid/intake` | auftraege 2 (+ fahrzeuge 2 / kunden 2 / hallenplan 2 je nach Inhalt) | Annahme → Fahrzeug, ggf. Kunde, Auftrag mit `intake`, ggf. Buchung; gestohlen → 409 außer `confirmStolen` |
| `POST /c/:cid/vehicles/:id/stolen` | fahrzeuge 2 | Kennzeichen-Abgleich setzen |
| `POST /c/:cid/tools/:id/issue|return|maintenance` · `POST /c/:cid/fleet/:id/issue|return|fuel|damage|service` | werkzeug 2 · fuhrpark 2 (+ buchungen 2/auszahlung beim Buchen) | Ausgabe, Rückgabe, Wartung; Fahrtenbuch, Schaden legt Werkstattauftrag an |
| `POST /c/:cid/parts/:id/orders`, `POST /c/:cid/part-orders/:id/deliver|cancel`, `POST /c/:cid/parts/:id/count` | lager 2 | Bestellung, Wareneingang (optional Ausgabe), Inventur; alle Bewegungen in `part_moves` |
| `PUT /c/:cid/setups` · `POST /c/:cid/trackdays/:id/bill` | racing 2 · racing 2 + rechnungen 2 | Setup je Wagen/Strecke; Trackday-Rechnung |
| `POST /c/:cid/messages`, `/messages/read` | nachrichten 2 | Nachricht (aus/ein), gelesen |
| `POST /c/:cid/ranks/:id/assign` · `POST /c/:cid/applications/:id/hire` | zugaenge 2 (+ gruppen 2 / lohn 3) · bewerbungen 2 + zugaenge 2 + einladen | Befördern · Einstellen (Konto, Startpasswort) |
| `POST /c/:cid/absences`, `/absences/:id/decide`, `DELETE …/:id` · `POST /c/:cid/corrections`, `/corrections/:id/decide` | Mitglied für sich (andere: dienstplan 2) · entscheiden dienstplan 3 bzw. dienstzeiten 3, nie eigene | Abwesenheit, Stempel-Nachtrag (genehmigt → Dienstzeit) |
| `POST /c/:cid/course-sessions/:id/join` · `POST /c/:cid/courses/:id/review` | Lernende für sich · schulungen 2 oder Trainer, nie eigene | Termin an-/abmelden · Freitext bewerten (danach neu werten) |
| `POST /c/:cid/transfers`, `/closings`, `/standing/run`, `/tips` | buchungen 2 (+ auszahlung) | Umbuchung, Tagesabschluss (Differenz wird gebucht), fällige Daueraufträge, Trinkgeld (Vorschau mit `preview`) |
| `POST /c/:cid/bills/:id/accept`, `/remind` | rechnungen 2 | Angebot → Rechnung; Mahnung (+ Nachricht, wenn nachrichten 2) |
| `POST/PATCH/DELETE /c/:cid/rules[/:id]`, `POST …/:id/ack` | regelwerk 2 / 3 · regelwerk 1 | Regelwerk, neue Fassung, bestätigen |
| `POST/PATCH/DELETE /c/:cid/posts[/:id]`, `POST …/:id/read`, `/vote` | pinnwand 2 (anheften 3, fremde 3) · pinnwand 1 | Pinnwand, gelesen, Umfrage |
| `PATCH /c/:cid/extra` · `POST /c/:cid/webhooks/:id/test` | je Schlüssel: firma 2, Vorlagen nachrichten 3, Trackday-Pakete racing 3 · firma 3 | Firmeneinstellungen · Webhook testen |
| `GET /c/:cid/feed` · `GET /c/:cid/rights/:userId` · `PATCH /c/:cid/wages/:userId/fixed` | Mitglied (Bereiche ohne „nur eigene“) · gruppen 1 oder zugaenge 1 · lohn 3 | Live-Feed · Vorschau als Person · Fixum |
| `GET/PATCH /server/settings` · `GET /server/integrations`, `POST …/:key/vote` · `GET/POST /server/api-keys`, `POST …/:id/revoke` | Server-Admin | Einstellungen · Wünsche · API-Schlüssel (nur einmal im Klartext) |
| `GET /v1/companies`, `/v1/companies/:id/prices|events|leaderboard` | `Authorization: Bearer ps_…`; nur Firmen mit `extra.publicData` | Öffentliche Nur-Lese-API |
| **ab 0.5** `POST /me/totp/setup`, `/me/totp/enable`, `/me/totp/disable` | angemeldet | Zwei-Faktor einrichten (Schlüssel + otpauth-Link), mit Code einschalten, mit Passwort + Code ausschalten |
| `GET /auth/discord/start`, `/auth/discord/callback`, `POST /me/discord/unlink` | öffentlich (link: angemeldet) | Discord-Anmeldung und -Verknüpfung |
| `PUT /c/:cid/orders/:id/photos` (Rohdaten `image/jpeg|png|webp`, bis 10 MB), `GET/DELETE /c/:cid/photos/:id` | auftraege 2 (bei „nur eigene“ nur eigene Aufträge) · auftraege 1 · Hochladende oder auftraege 3 | Fotos zum Auftrag |
| `GET/POST /c/:cid/game-keys`, `POST …/:id/revoke` | firma 3 | Spielserver-Schlüssel (nur einmal im Klartext) |
| `GET /game/status`, `POST /game/duty`, `/game/callouts`, `/game/payments`, `GET /game/balance`, `POST /game/laps`, `GET /game/vehicles/:plate`, `POST /game/vehicles/:plate/stolen` | `Authorization: Bearer pg_…` (Firma des Schlüssels; Module müssen an sein; 300/min) | Dienst ein/aus (Spieler über `game_id` oder Discord-ID), Notruf → Einsatz, Zahlung (Betrag genau) → Rechnung bezahlt + Einnahme, Kontostand, Runde, Kennzeichen, Fahndung (unbekanntes Kennzeichen wird angelegt) |
| `GET /server/overview`, `/server/accounts`, `/server/companies`, `/server/backups`, `/server/log` | Server-Admin | Serververwaltung |
| `POST /server/accounts`, `PATCH /server/accounts/:id`, `POST /server/accounts/:id/reset-password` | Server-Admin | Konto anlegen (Startpasswort), Server-Admin/Sperre (letzter Admin geschützt), Startpasswort |
| `POST /server/companies`, `PATCH /server/companies/:id`, `POST /server/companies/:id/owner` | Server-Admin | Firma mit Inhaber-Gruppe und Vorlagen; pausieren; Inhaber übertragen |
| `POST /server/backups`, `GET /server/backups/:name`, `POST /server/backups/:name/restore` | Server-Admin | Sicherung (JSON.gz in `data/backups`), Download, Wiederherstellen (Bestätigung `WIEDERHERSTELLEN`, vorher automatische Sicherung, gleiche Migrationen nötig) |
| `GET /server/export/:set[?company=]` | Server-Admin; Firmendaten nur bei Support-Freigabe | CSV |
| `GET /announcements`, `POST/DELETE /announcements[/:id]` | angemeldet · Server-Admin | Ankündigungen |
| `GET /demo/personas`, `POST /demo/login`, `POST /demo/reset` | nur `DEMO_MODE` | Demo |

**Hintergrundjobs** (`startJobs` in `routes/platform.ts`, alle 10 Minuten): fällige Daueraufträge buchen (verpasste Termine einzeln, höchstens 24); einmal am Tag ab `backupHour` eine Sicherung, ältere *automatische* Sicherungen über `backupKeep` hinaus löschen (Liste im Merker `backup_auto`, manuelle bleiben).

**Webhooks:** `audit()` ruft `dispatchWebhooks()`; passende aktive Webhooks der Firma (Ereignis = Protokollbereich, leer = alle) bekommen per `setImmediate` einen POST (Discord: `{content}`, sonst JSON), 5 s Zeitlimit, keine Weiterleitungen. Ergebnis in `last_status`/`fails`.

### 7.4 Logs
pino schreibt JSON auf stdout (`docker compose logs`) und über `pino-roll` nach `logs/app/pitstop.JJJJ-MM-TT.N.log` (täglich rotiert, 14 Dateien). Fastifys eigenes Request-Logging ist über `LogController` abgeschaltet (zur Laufzeit vorhanden, aber nicht typisiert, daher per `createRequire`); stattdessen ein kurzer `onResponse`-Eintrag je API-Aufruf. Request-Logs ohne Cookies und Bodies. Passwörter und Tokens nie loggen (`redact`).

### 7.5 CLI (`server/cli.ts`)
`pitstop reset-password <email>`: erzeugt ein zufälliges Startpasswort (16 Zeichen), setzt `must_change_password`, löscht alle Sitzungen des Benutzers und gibt das Passwort auf stdout aus.

## 8. Client

- **Routing:** Hash `#<seite>` (Liste in `client/lib/nav.ts`). Ohne Hash öffnet die Startseite aus `prefs.start`. Ein Seitenwechsel schließt offene Panels und Dialoge.
- **Zustand** (`client/lib/app.tsx`, `useApp()`): `me`, aktuelle Firma (gemerkt in `localStorage`), Firmenstand `data`, `act(fn, text)` (API-Aufruf, Neuladen, Hinweis), `overlay(node)` für Panel/Dialog, `can(area, min)`, `special(key)`, `c(path)` für Firmenpfade, `setPrefs()`.
- **Sichtbarkeit:** `visible()` in `Shell.tsx` – Server-Seiten nur für Server-Admins, Firmenseiten nach Modul und Bereich. In der Serververwaltung zeigt die Seitenleiste nur Server- und persönliche Seiten.
- **Formulare:** `FormModal` in `components/ui.tsx` aus einer Feldliste (Text, Zahl, $-Betrag, Auswahl, Datum, Häkchen) mit Feldfehlern der API. `$`-Felder werden als Cent gesendet.
- **Darstellung:** `applyPrefs()` setzt `data-skin`, `data-density`, `data-nav`, `data-text`, `data-motion` auf `<html>`; gespeichert pro Konto über `PATCH /me`.
- **Arbeitsflächen** (`pages/Cockpit.tsx`): Widgets in `WIDGETS` (Titel, Standardgröße, `ok()` = darf die Person es sehen, `render()`); Cockpit als `prefs.widgets = ["todo:8", …]` (Id:Spalten von 12), weitere als `prefs.boards = [{ id: "b-…", name, widgets }]`. `setBoards()` in `lib/nav.ts` meldet sie als Seiten an (Gruppe „Arbeitsflächen“, `BoardPage`), damit Tabs und Navigation sie kennen.
- **Suche** (`Search` in `Shell.tsx`, Strg+K), **Meldungen** (`Bell`, Liste aus `todo()` in `Cockpit.tsx`), **„Neu“** (`NewMenu`).
- **Vorschau als Person:** `app.setViewAs(userId)` holt `GET /c/:cid/rights/:userId` und ersetzt in `app.data` nur `rights`; `act()` lehnt in der Vorschau jede Änderung ab. Die Fachdaten bleiben die der angemeldeten Person (steht im Hinweisbalken).
- **Formularfelder** ab 0.4 zusätzlich `datetime` (Ortszeit ↔ ISO) und `multi` (Chips, Liste von Werten).
- **Tabs** (`useTabs` in `Shell.tsx`, `localStorage` `pitstop.tabs`): Hashwechsel ersetzt den aktiven Tab; `onDoubleClick` auf einem Link holt den eben ersetzten Tab zurück und hängt die Seite an. Kommt der Doppelklick vor dem Hashwechsel an, merkt `pending` die Seite und der Wechsel legt den neuen Tab an. „Daneben“ rendert eine zweite Seite in `.panes`.
- **Kalibrierung** (`calibrate()` in `pages/Company.tsx`): zwei Klicks im Bild (gemessen mit den aktuellen Rändern) plus ihre echten Spielkoordinaten → Bildanteil je Punkt → Breite/Höhe und Ränder. Punkte unter 5 % Abstand je Achse werden abgelehnt.
- **Karte** (`pages/MapView.tsx`): SVG in Spielkoordinaten (svg-y = −Spiel-Y), Ausschnitt per `viewBox`; Mausrad zoomt um den Mauszeiger, Ziehen verschiebt, Klick wählt (bei „Ort auf Karte“) Koordinaten. Marker skalieren gegenläufig, Linien mit `vector-effect: non-scaling-stroke`. Eigenes Kartenbild als `<image>` mit den Kartenrändern der Firma.

## 9. Demo-Modus und Seed (`server/demo/seed.ts`)

Firma „Demo Motorsport“ mit fünf festen Personen (Inhaber, Leitung, Mechanik + Abschleppdienst, Abschlepp, Büro), 10 Kunden, 11 Fahrzeugen, 8 Aufträgen, 5 Einsätzen mit Koordinaten, Rechnungen, Buchungen und Schichten. Moduldaten aus `server/demo/modules.ts` (`seedModules`): 8 Lagerteile, Dienstplan über 10 Tage, Stundenlöhne, 3 Kurse mit Fortschritt, 4 Prüfstandsmessungen, 4 Events mit Startern und Zeiten. Ab 0.4 `server/demo/more.ts` (`seedMore`): Firmeneinstellungen, 6 Plätze mit Buchungen, 6 Werkzeuge, Verbrauch und 2 Bestellungen, 4 Fuhrpark-Fahrzeuge mit Fahrtenbuch, 2 Rennwagen, Meisterschaft, Setups, 5 Runden, 4 Trackday-Buchungen, 3 Rahmenverträge, Nachrichten, 6 Ränge, 3 Bewerbungen, Abwesenheiten, Nachtrag, ein Kurs mit offener Freitext-Antwort, 2 Termine, 3 Lizenzen, Trinkgeld, Rennteam-Budget, Kassenabschluss, 4 Daueraufträge, 2 Ziele, 10 Leistungen, 2 Regelwerke, 3 Pinnwand-Beiträge mit Umfrage. Demo-Konten haben `is_demo = true`; die Anmeldung läuft nur über `/demo/login`. `/demo/reset` leert alle Tabellen, spielt den Seed neu ein und legt den Admin aus der `.env` wieder an.

## 10. Berechnungen

Effektive Rechte: `computeRights()` in `shared/permissions.ts` (Server und Client). Salden, offene Beträge und Wochenstunden rechnet der Client aus dem Firmenstand; nichts davon wird gespeichert. Gespeichert und auf dem Server gerechnet werden: Tuning-Preis (`quoteTuning`: Summe der Stufen × Klassenfaktor × (100 − Rabatt) %, Rabatt = max(Paket, Kunde)), Lohnabrechnung (Minuten abgeschlossener Schichten mit Beginn im Zeitraum × Stundenlohn / 60, Provision = Prozent × bezahlte Rechnungen im Zeitraum, deren Auftrag/Einsatz der Person gehört), Testergebnis (richtige / alle, gerundet; bestes Ergebnis bleibt; Freitext zählt erst nach Bewertung, bestanden erst ohne offene Freitexte), Trackday-Preis (aus dem Paket), Kassendifferenz (gezählt − Saldo Kasse), Trinkgeld (Saldo Trinkgeldkasse × Minuten der Person / alle Minuten im Zeitraum, abgerundet; Rest-Cents an die mit den meisten Minuten), Fixum im Lohnlauf (nur bei Minuten oder Umsatz im Zeitraum). Tuning-Rabatt ab 0.4: max(Paket, Kunde, aktiver Rahmenvertrag).

## 11. Domänentypen

Siehe `src/shared/types.ts` (`User`, `Company`, `Member`, `Group`, `PermissionException`, `Customer`, `Vehicle`, `Order`, `Callout`, `Bill`, `Transaction`, `DutySession`, `CompanyData`, `MeData`, `ServerAccount`, `ServerCompany`, `BackupFile`, ab 0.3 `Part`, `Shift`, `Wage`, `Payslip`, `Course`, `CourseProgress`, `DynoRun`, `RaceEvent`, `RaceEntry`; ab 0.4 `Board`, `CompanyExtra`, `Intake`, `PartOrder`, `PartUse`, `Bay`, `BayBooking`, `Tool`, `FleetCar`, `FleetLog`, `RaceCar`, `ChampRow`, `Setup`, `Lap`, `TrackdayBooking`, `Contract`, `Message`, `Rank`, `Application`, `Absence`, `DutyCorrection`, `CourseSession`, `License`, `CashClosing`, `StandingOrder`, `Goal`, `Service`, `RuleDoc`, `Post`, `Poll`, `Webhook`, `FeedItem`, `ServerSettings`, `ApiKey`, `ACCOUNTS`; Tuning-Preisliste `TuningConfig` in `shared/tuning.ts`).

## 12. Gestaltung

`src/client/index.css` ist das CSS des bestätigten Mockups (Variablen je Theme unter `html[data-skin=…]`, Container-Queries, Handy-Leiste unten ab 720 px). Schriften wie im Mockup: Chakra Petch (`--font-display`), Manrope (`--font-body`), JetBrains Mono (`--font-data`). Klassen für 0.3 am Ende der Datei (Dienstplan `.roster/.shift`, Kurse `.lesson/.quiz`, Konfigurator `.tune-row`, Kalender `.ev-*`, Kalibrierung `.calib`, Arbeitsfläche `.wgrid/.w/.wbar/.wadd`, Tabs `.wtabs/.wt`, `.panes`). 0.4 nutzt die Mockup-Klassen `.gantt` (Hallenplan), `.carzone` (Schadensskizze), `.chat/.msg`, `.feed`, `.vabar`, `.tiles`, `.pal-*`; am Dateiende kommen die Handy-Kopfzeile und `a.btn` dazu.

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

**API-Rechtetest:** `node tests/api/rechte.mjs http://localhost:PORT` gegen einen Pitstop mit `DEMO_MODE=true` (setzt die Demo zurück; erwartet das Admin-Startpasswort `admin-passwort-123` oder `ADMIN_PASSWORD`). Prüft Rechte je Rolle, Sperre und Ausnahme, Support-Zugriff, Export, letzten Admin, Sicherung und Wiederherstellen, ab 0.3 auch Lager, Dienstplan, Lohnlauf und Auszahlung, Kurse (Lösungen nur für Bearbeiter, Test serverseitig, Praxisprüfung), Tuning-Preis vom Server, Racing, Module aus, Export je Bereich, Widgets in `prefs`; ab 0.4 Rechte der neuen Bereiche, Annahme mit Kennzeichen-Abgleich, Nachweis-Pflicht, Doppelbuchung, Abwesenheit/Nachtrag (nie selbst genehmigen), Trackday-Preis und -Rechnung, Freitext-Bewertung, Regelwerk, Umfrage, Angebot → Rechnung, Mahnung, Kassenabschluss, Trinkgeld centgenau, Befördern, Einstellen, Live-Feed ohne „nur eigene“-Bereiche, Vorschau, Geräte, Webhook-Adressen, Wartungsmodus, API-Schlüssel und `/api/v1` (140 Prüfungen).

**Browser-Drehbuch:** `ADMIN_EMAIL=… ADMIN_PASSWORD=… tests/e2e/run.sh demo.mjs http://localhost:PORT` spielt CONCEPT.md Abschnitt 7 durch (Demo-Modus). Chromium aus `mcr.microsoft.com/playwright:v1.49.1-noble`, Screenshots in `tests/e2e/shots/`. Ab 0.3 zusätzlich: alle neuen Seiten, Konfigurator → Auftrag, Lagerzugang, Kurs mit Test, Arbeitsfläche anpassen und Neuladen, Doppelklick-Tab und „daneben“, Kartenbild hochladen und mit zwei Punkten kalibrieren. Das Skript ändert das Admin-Passwort; für einen zweiten Lauf das Startpasswort wieder setzen (oder Demo-DB neu anlegen). Ab 0.5: Foto am Auftrag, Zwei-Faktor einrichten, Discord-Knopf, Spielserver-Schlüssel. Ab 0.4: alle neuen Seiten, Annahme → Auftrag, Suche mit Kennzeichen, Meldungen, neue Arbeitsfläche (bleibt nach Neuladen), Vorschau als Person, Umfrage, Tagesabschluss, Handy ohne seitliches Scrollen auf fünf neuen Seiten. Ergebnis 2026-11-20 (0.4): beide Tests grün, Konsole ohne Fehler.

## 15. Fallstricke

- **Migration 003 löscht die Fachdaten von 0.1** (Kunden, Rechnungen, Personal mit MwSt.). Vor dem Update von 0.1 auf 0.2 sichern (README, Backup).
- **Wiederherstellen einer Sicherung** beendet alle Sitzungen (auch die eigene) und klappt nur mit denselben Migrationen wie beim Sichern.
- **Kartenbilder** liegen unter `data/maps/` und sind nicht in der JSON-Sicherung; die Komplettsicherung des Ordners (README) enthält sie.
- **Neue Tabellen in `BACKUP_TABLES`** (`routes/server.ts`) in Abhängigkeitsreihenfolge eintragen (Eltern zuerst), sonst schlägt das Wiederherstellen an Fremdschlüsseln fehl. Neue Sequenzen in `SEQUENCES`.
- **`prefs` wird mit zod geprüft:** Neue Felder in `profileSchema` (`routes/auth.ts`) ergänzen, sonst verwirft der Server sie stillschweigend.
- **jsonb-Arrays als Parameter** (Kurs-Lektionen, Fragen) mit `JSON.stringify` übergeben: `pg` macht aus einem JS-Array sonst ein Postgres-Array.
- **Zeitvergleiche von ISO-Strings** mit unterschiedlichem Offset (`…+01:00` vs. `…Z`) sind falsch; `Date.parse` verwenden.
- **Playwright `text=…`** trifft auch Fließtext, der die Wörter enthält (z. B. Hilfetext neben einem Knopf). Für Knöpfe `button:has-text("…")`.

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
- **`verbatimModuleSyntax`:** Reine Typen mit `import type { … }` importieren.
- **`new Date('2026-11-19')`** ist UTC-Mitternacht. Für Kalenderdaten nur die Helfer aus `dates.ts`; Vergleiche als String.
- **Geld nie als Float.** Immer Cent-Ganzzahlen.
- **`role` ist doppelt belegt:** `User.role` = Berechtigung, `Employee.jobTitle` = Beruf.
- **Strg+K** belegt im Browser die Adressleisten-Suche: Listener auf `window` mit `preventDefault()`.
- **Secure-Cookie über http:** Steht `PUBLIC_URL` auf https, aber der Aufruf kommt per http, setzt der Browser das Cookie nicht, und der Login scheint wirkungslos.
- **WSL2:** Projekt im Linux-Dateisystem lassen, nicht nach `/mnt/c`, sonst sind Datei-Watching und Bind-Mounts unzuverlässig.
- **TypeScript 7** (nativer Compiler) wird von typescript-eslint noch nicht unterstützt; bei `typescript@~6.0` bleiben, bis typescript-eslint es erlaubt.
- **Euro-Beträge enthalten ein geschütztes Leerzeichen** (U+00A0 vor „€“, von `Intl`). Tests und Textvergleiche per Regex auf die Zahl, nicht auf „45,00 €“ mit normalem Leerzeichen.
- **`pkill -f <muster>` trifft die eigene Shell,** wenn das Muster im Befehl steht. Mit Zeichenklasse arbeiten: `pkill -f 'src/server/main[.]ts'`.
- **`cp` ist auf dem Entwicklungsrechner ein Alias für `cp -i`** und überschreibt ohne Eingabe nichts. In Skripten `command cp -f` verwenden.
- **`.gitignore`-Muster für Laufzeitordner an der Wurzel verankern** (`/db/`, `/data/` …): Ein Muster `db/` ignoriert sonst auch `src/server/db/` mit allen Migrationen – ein Klon ließe sich nicht bauen.
- **firewalld aus einer anderen WSL-Distribution** (nftables-Tabelle `inet firewalld`) gilt für alle Distributionen und weist Verkehr zwischen Containern ab (`EHOSTUNREACH`, App findet `db` nicht). Prüfen mit `nft list tables`; firewalld dort beenden oder Docker-Bridges freigeben (`iifname "br-*" accept`).
- **Docker-Build dauert unter WSL2 3–5 Minuten,** sobald sich Code ändert (Vite + esbuild im Container). Ohne Codeänderung wenige Sekunden (Cache).
- **jsonb und Listen (0.4):** `pg` schickt JS-Arrays als Postgres-Array (`{a,b}`), nicht als JSON. Für jsonb-Spalten immer `JSON.stringify` – `repo/records.ts → toDb()` macht das für Objekte und Listen automatisch.
- **`values` ist ein reserviertes Wort** in Postgres; die Setup-Werte heißen deshalb `setups.vals`.
- **Prop namens `ref`:** In React 19 ist `ref` auch bei Funktionskomponenten eine normale Prop-Weiterleitung für Refs – nie als fachlichen Prop-Namen verwenden (Telemetrie: `best`).
- **Feed und „nur eigene“:** Ein Bereich mit „nur eigene“ hat Stufe ≥ 1, darf aber fremde Einträge nicht zeigen. Der Live-Feed lässt solche Bereiche ganz weg (sonst sähe man z. B. Lohnauszahlungen anderer).
- **Kopfzeile auf dem Handy:** Suche, Stempeluhr, Meldungen und „Neu“ füllen 390 px fast aus; jedes weitere Symbol dort braucht `hide-sm`, sonst scrollt die Seite seitlich (Browser-Drehbuch prüft das).
- **Sicherung und Fremdschlüssel:** Neue Tabellen in `BACKUP_TABLES` in Fremdschlüssel-Reihenfolge eintragen (Wiederherstellen fügt der Reihe nach ein).
- **Anmeldedrossel in Tests:** `/auth/login` erlaubt 10 Versuche je 15 Minuten und IP, `/demo/reset` 5 je Minute (im Speicher). Mehrere Testskripte hintereinander → vorher den Test-Server neu starten, sonst 429.
- **Fotos und Kartenbilder** liegen als Dateien in `data/` und sind nicht in der App-Sicherung (JSON) enthalten; nach dem Wiederherstellen einer alten Sicherung können Fotozeilen auf fehlende Dateien zeigen (404 mit Hinweis).

**Weitere Tests ab 0.5:** `node tests/api/anbindungen.mjs http://localhost:3100` (49 Prüfungen; Server mit `DISCORD_CLIENT_ID=123456789`, `DISCORD_CLIENT_SECRET=attrappe`, `DISCORD_API=http://localhost:3199/api` starten). `tests/fivem/run.sh <pg_schlüssel> <rechnungsnr> <betrag_cent>` führt die FiveM-Ressource in einem Alpine-Container (Lua 5.4, cjson, curl) mit nachgebauten Natives gegen den Server aus.
- **Kein fester Image-Name für `app`:** Compose benennt das Image je Projekt (`<projekt>-app`). Mit einem festen Namen teilen sich zwei Installationen auf einem Rechner (z. B. `-p pitstop-test`) ein Image, und `docker compose down --rmi local` der einen entfernt es der anderen (beim Klon-Test 2026-11-20 aufgefallen).
