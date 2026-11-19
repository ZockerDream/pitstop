# Pitstop – Business OS

Pitstop ist ein selbst gehostetes All-in-One-ERP/CRM für **Kfz-Werkstätten mit Tuning**. Kundenakten mit Fahrzeugen, Rechnungen, Ausgaben, Mitarbeitende und Urlaubsanträge liegen in **einer** Oberfläche. Es läuft mit Docker Compose und speichert alles in PostgreSQL.

## Inhalt

- [Funktionen](#funktionen)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [Ordner und Daten](#ordner-und-daten)
- [Update](#update)
- [Backup](#backup)
- [Wiederherstellen](#wiederherstellen)
- [Löschen](#löschen)
- [Betrieb und Fehlersuche](#betrieb-und-fehlersuche)
- [Für Entwickler](#für-entwickler)

## Funktionen

| Modul | Inhalt |
|---|---|
| **Dashboard** | Offene Rechnungen, Monatsumsatz, aktive Kunden, Anwesenheit heute; Umsatz und Ausgaben der letzten 6 Monate; Aufgaben & Freigaben (Urlaub genehmigen, überfällige Rechnungen mahnen, fällige HU anbieten) |
| **Kunden (CRM)** | Kundenliste mit Suche (auch nach Kennzeichen) und Filter (Aktiv, Lead, Inaktiv); Kundenakte mit Stammdaten, **Fahrzeugen** (Kennzeichen, FIN, km-Stand, HU-Termin, Umbauten), Ansprechpartnern, Kommunikationshistorie und allen Rechnungen |
| **Finanzen (ERP)** | Rechnungen mit Fahrzeug und km-Stand, Status (Offen, Überfällig, Bezahlt) und Mahnstufen; neue Rechnung mit Werkstatt-Positionsvorlagen und automatischer Berechnung von Netto, 19 % MwSt. und Brutto; Ausgaben nach Kategorien |
| **Personal (HR)** | Mitarbeiterverzeichnis mit Status (Im Dienst, Urlaub, Krank); digitale Personalakte mit Vertrag, Resturlaub und Stunden; Urlaubsanträge stellen, genehmigen und ablehnen |
| **Einstellungen** | Firmendaten für den Rechnungskopf, Benutzerkonten für Mitarbeitende |

Es gibt zwei Rollen: **Admin** (Geschäftsführung, sieht und darf alles) und **Mitarbeiter** (keine Finanzen, keine Stundensätze, nur die eigene Personalakte, eigene Urlaubsanträge). Die Anmeldung läuft über E-Mail und Passwort. Impressum und Datenschutzerklärung sind ohne Anmeldung erreichbar.

## Voraussetzungen

- Linux-Server (oder WSL2) mit **Docker Engine** und dem **Compose-Plugin ab Version 2.24** (`docker compose version`)
- **git**
- Etwa 1 GB freier Arbeitsspeicher und 2 GB Speicherplatz; der erste Start baut das App-Image und dauert ein paar Minuten
- Ein freier Port, standardmäßig **8080**
- Für den Zugriff aus dem Internet: eine Domain und ein Reverse-Proxy mit HTTPS (z. B. Caddy, Traefik oder Nginx Proxy Manager). Pitstop bringt keinen eigenen Proxy mit.

## Installation

```bash
git clone https://github.com/ZockerDream/pitstop.git pitstop
cd pitstop

cp .env-example .env
nano .env                 # Pflichtwerte setzen (siehe Konfiguration)

cp .impressum-example .impressum
nano .impressum           # Angaben fürs Impressum eintragen

docker compose up -d
```

Danach `http://<server>:8080` öffnen (bzw. die Adresse aus `PUBLIC_URL`) und mit `ADMIN_EMAIL` und `ADMIN_PASSWORD` aus der `.env` anmelden. Pitstop verlangt beim ersten Anmelden ein neues Passwort.

Ob alles läuft, zeigt `docker compose ps`: Beide Dienste (`app`, `db`) sollten `healthy` sein.

**Mitarbeitende anlegen:** unter *Personal* den Mitarbeiter erfassen, dann unter *Einstellungen → Benutzer* einen Zugang mit Startpasswort anlegen. Auch hier ist beim ersten Anmelden ein neues Passwort fällig.

## Konfiguration

### `.env`

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `POSTGRES_PASSWORD` | **ja** | – | Passwort der Datenbank. Lang und zufällig wählen, z. B. `openssl rand -hex 24`. Wirkt **nur beim allerersten Start** (siehe Hinweis unten). |
| `ADMIN_EMAIL` | **ja** | – | E-Mail des ersten Admins. Wird nur angelegt, solange es noch keinen Benutzer gibt. |
| `ADMIN_PASSWORD` | **ja** | – | Startpasswort des ersten Admins (mindestens 12 Zeichen). Muss beim ersten Anmelden geändert werden. |
| `PUBLIC_URL` | ja | `http://localhost:8080` | Adresse, unter der Pitstop im Browser erreichbar ist. Beginnt sie mit `https://`, setzt Pitstop sichere Cookies. |
| `PITSTOP_PORT` | nein | `8080` | Port auf dem Server |
| `TZ` | nein | `Europe/Berlin` | Zeitzone für Datum, „heute“ und Logs |
| `DEMO_MODE` | nein | `false` | `true` spielt beim ersten Start Demo-Daten ein (siehe unten) |
| `POSTGRES_USER` | nein | `pitstop` | Datenbank-Benutzer |
| `POSTGRES_DB` | nein | `pitstop` | Datenbank-Name |
| `LOG_LEVEL` | nein | `info` | `debug`, `info`, `warn` oder `error` |

> **Datenbank-Passwort später ändern:** Postgres übernimmt `POSTGRES_PASSWORD` nur beim Anlegen der Datenbank. Wer es später ändern will, ändert es zuerst in der Datenbank und dann in der `.env`:
> 1. `docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`
> 2. In psql `\password pitstop` eingeben (bzw. den Wert von `POSTGRES_USER`), das neue Passwort zweimal eintippen, mit `\q` beenden.
> 3. Dasselbe Passwort in der `.env` eintragen, dann `docker compose up -d`.

### `.impressum`

Die Datei enthält die Pflichtangaben für die öffentliche Seite *Impressum*. Leere Felder werden nicht angezeigt. Ohne die Datei startet Pitstop trotzdem, das Impressum zeigt dann einen Hinweis für den Betreiber. Für die rechtliche Richtigkeit ist der Betreiber verantwortlich.

| Variable | Beispiel |
|---|---|
| `IMPRESSUM_NAME` | Lindner Motorsport GmbH |
| `IMPRESSUM_VERTRETEN_DURCH` | Geschäftsführerin: Katrin Lindner |
| `IMPRESSUM_STRASSE` | Gewerbering 14 |
| `IMPRESSUM_PLZ_ORT` | 93055 Regensburg |
| `IMPRESSUM_TELEFON` | 0941 123456-0 |
| `IMPRESSUM_EMAIL` | info@example.de |
| `IMPRESSUM_REGISTER` | Amtsgericht Regensburg, HRB 12345 |
| `IMPRESSUM_UST_ID` | DE123456789 |
| `IMPRESSUM_VERANTWORTLICH` | Katrin Lindner, Anschrift wie oben |
| `IMPRESSUM_ZUSATZ` | Freitext in einer Zeile, z. B. Kfz-Meisterbetrieb, zuständige Handwerkskammer |

Werte mit Sonderzeichen (`#`, `"`, `$`) in einfache Anführungszeichen setzen. Nach einer Änderung: `docker compose up -d`.

### Datenschutzerklärung und Logo (`./conf`)

| Datei | Wirkung |
|---|---|
| `conf/datenschutz.md` | Wird als öffentliche Seite *Datenschutz* angezeigt (Markdown). Fehlt sie, zeigt die Seite einen Hinweis für den Betreiber. |
| `conf/logo.svg` oder `conf/logo.png` | Firmenlogo in der Seitenleiste und im Rechnungskopf |

Änderungen gelten nach `docker compose restart app`.

### Demo-Modus

Mit `DEMO_MODE=true` spielt Pitstop beim **ersten Start** Beispieldaten einer erfundenen Kfz-Werkstatt mit Tuning ein: 18 Mitarbeitende, rund 180 Kunden mit 210 Fahrzeugen, 6 Monate Rechnungen und Ausgaben, Urlaubsanträge. Die Anmeldeseite bietet dann „Als Admin ansehen“ und „Als Mitarbeiter ansehen“, das Benutzermenü einen Rollenwechsel und „Demo-Daten zurücksetzen“.

**Nicht für echte Daten verwenden.** Im Demo-Modus kann jeder, der die Seite erreicht, sich mit einem Klick als Admin anmelden. Um von der Demo auf echten Betrieb zu wechseln: `DEMO_MODE=false` setzen und mit leerer Datenbank neu beginnen (siehe [Löschen](#löschen), Daten löschen, danach wieder `docker compose up -d`).

### Zugriff über HTTPS

Pitstop spricht nur HTTP auf `PITSTOP_PORT`. Für den Zugriff aus dem Internet einen Reverse-Proxy davorschalten, der HTTPS übernimmt und auf `http://<server>:8080` weiterleitet. `PUBLIC_URL` auf die öffentliche `https://`-Adresse setzen, den Port 8080 in der Firewall nur für den Proxy freigeben, dann `docker compose up -d`.

## Ordner und Daten

Alle Daten liegen im Projektordner. Keiner dieser Ordner ist in Git; `git pull` lässt sie unangetastet.

| Pfad | Inhalt | Ins Backup? |
|---|---|---|
| `./db/` | Postgres-Datenverzeichnis (alle Kunden, Rechnungen, Mitarbeitende, Benutzer) | über Datenbank-Dump |
| `./data/` | Datenbank-Dumps (`data/backups/`) und interne Statusdateien der App | ja |
| `./conf/` | Eigene Dateien des Betreibers: Datenschutzerklärung, Logo | ja |
| `./logs/` | Logdateien der App (`logs/app/`) und von Postgres (`logs/postgres/`), werden nach 14 bzw. 7 Tagen überschrieben | nein |
| `.env` | Konfiguration und Zugangsdaten | **ja, sicher aufbewahren** |
| `.impressum` | Impressumsangaben | ja |

Docker legt fehlende Ordner beim ersten Start selbst an. Die Dateien in `./db` gehören dem Postgres-Benutzer des Containers; zum Kopieren oder Löschen braucht es deshalb `sudo`.

## Update

```bash
cd pitstop
git pull
docker compose up -d
```

Dabei passiert automatisch:
- Das App-Image wird aus dem neuen Code gebaut. Unveränderte Schritte kommen aus dem Cache, ohne Änderungen dauert das wenige Sekunden.
- Für Postgres wird die neueste Unterversion von Postgres 18 geladen (z. B. 18.4 → 18.5, mit Sicherheitsupdates).
- Nur geänderte Container werden neu gestartet. Datenbank-Migrationen laufen beim Start der App von selbst.

Empfohlen: vorher ein [Datenbank-Backup](#datenbank-dump-im-laufenden-betrieb) ziehen. Danach prüfen mit `docker compose ps` und `docker compose logs --tail 50 app`. Alte Images räumt gelegentlich `docker image prune -f` auf.

**Sonderfall: neue Postgres-Hauptversion** (z. B. 18 → 19). Ein Hauptversionswechsel braucht Dump und Restore, weil das Datenformat sich ändert. Er wird in den Release-Hinweisen angekündigt und läuft so:

```bash
# 1. Backup mit der alten Version (Ordner ist im Repo nicht enthalten, deshalb anlegen)
mkdir -p data/backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > data/backups/vor-upgrade.dump
# 2. Stoppen, neuen Stand holen, nur die neue Datenbank starten (sie beginnt leer in ./db/19/)
docker compose down
git pull
docker compose up -d db
# 3. Backup einspielen und alles starten
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < data/backups/vor-upgrade.dump
docker compose up -d
# 4. Wenn alles läuft: alte Daten löschen
sudo rm -rf db/18
```

Startet man versehentlich die App mit der neuen, leeren Datenbank, verweigert sie den Start mit einem Hinweis auf diesen Abschnitt, statt eine leere Firma anzulegen.

## Backup

### Datenbank-Dump im laufenden Betrieb

Der wichtigste Teil, da alle Geschäftsdaten in der Datenbank liegen. Läuft ohne Unterbrechung:

```bash
cd pitstop
mkdir -p data/backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > data/backups/pitstop-$(date +%F_%H%M).dump
```

Zusätzlich gehören `.env`, `.impressum` und `./conf` ins Backup. Alles zusammen auf einen anderen Rechner oder Speicher kopieren; ein Backup auf demselben Server schützt nicht vor einem Plattenausfall.

### Automatisch jede Nacht

Mit `crontab -e` (als Benutzer mit Docker-Rechten) einfügen, Pfad anpassen:

```cron
15 3 * * * cd /opt/docker/pitstop && mkdir -p data/backups && docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > data/backups/pitstop-$(date +\%F).dump && find data/backups -name '*.dump' -mtime +30 -delete
```

Das sichert jede Nacht um 03:15 und löscht Dumps, die älter als 30 Tage sind. In Crontabs muss `%` als `\%` geschrieben werden.

### Komplettsicherung des Ordners

Sichert alles inklusive des Datenverzeichnisses, braucht aber eine kurze Pause:

```bash
cd pitstop
docker compose down
sudo tar czf ../pitstop-komplett-$(date +%F).tar.gz .env .impressum data db conf
docker compose up -d
```

Ein solches Archiv lässt sich nur mit derselben Postgres-Hauptversion zurückspielen. Für Umzüge und Hauptversionswechsel ist der Datenbank-Dump die bessere Wahl.

## Wiederherstellen

### Dump in eine bestehende Installation einspielen

**Ersetzt alle aktuellen Daten** durch den Stand des Dumps:

```bash
cd pitstop
docker compose stop app
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < data/backups/DATEINAME.dump
docker compose up -d
```

### Umzug auf einen neuen Server

```bash
git clone https://github.com/ZockerDream/pitstop.git pitstop && cd pitstop
# .env, .impressum und conf/ vom alten Server hierher kopieren, Dump nach data/backups/
docker compose up -d db
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < data/backups/DATEINAME.dump
docker compose up -d
```

Wichtig: Vor dem Einspielen nur `db` starten, nicht `docker compose up -d`. Sonst legt die App in der leeren Datenbank schon einen Admin an.

### Komplettsicherung zurückspielen

```bash
mkdir pitstop && cd pitstop
git clone https://github.com/ZockerDream/pitstop.git .
sudo tar xzf ../pitstop-komplett-DATUM.tar.gz
docker compose up -d
```

## Löschen

| Ziel | Befehl (im Ordner `pitstop`) |
|---|---|
| Nur anhalten (Daten und Container bleiben) | `docker compose stop` |
| Container und Netzwerk entfernen, Daten behalten | `docker compose down` |
| Zusätzlich das gebaute App-Image entfernen | `docker compose down --rmi local` |
| **Alle Daten endgültig löschen** (danach startet Pitstop wie neu) | `docker compose down` und dann `sudo rm -rf db data logs` |
| **Alles entfernen**, inklusive Code und Konfiguration | `docker compose down --rmi local`, dann `cd .. && sudo rm -rf pitstop` |
| Postgres-Image entfernen (falls sonst niemand es nutzt) | `docker image rm postgres:18-alpine` |

Gelöschte Daten lassen sich nicht wiederherstellen. Vorher ein [Backup](#backup) ziehen.

## Betrieb und Fehlersuche

| Aufgabe | Befehl |
|---|---|
| Status | `docker compose ps` |
| Logs live verfolgen | `docker compose logs -f app` (oder `db`) |
| Logdateien | `logs/app/`, `logs/postgres/` |
| Neu starten | `docker compose restart app` |
| Passwort eines Benutzers zurücksetzen (z. B. Admin ausgesperrt) | `docker compose exec app pitstop reset-password admin@example.de` – gibt ein neues Startpasswort aus |
| Installierte Version | `git log -1 --oneline` |

Häufige Probleme:
- **`app` startet nicht, Log meldet „Datenbank leer, aber Pitstop war schon eingerichtet“:** Die App findet ihre Daten nicht (z. B. nach einem Postgres-Hauptversionswechsel oder wenn `./db` gelöscht wurde). Siehe [Update → Sonderfall](#update) bzw. [Wiederherstellen](#wiederherstellen). Ist eine neue, leere Firma wirklich gewollt, die Datei `data/.initialized` löschen.
- **`password authentication failed`:** `POSTGRES_PASSWORD` in der `.env` wurde nach dem ersten Start geändert, siehe Hinweis unter [Konfiguration](#env).
- **Anmeldung klappt, aber man ist sofort wieder abgemeldet:** `PUBLIC_URL` beginnt mit `https://`, aufgerufen wird aber per `http://`. Beides muss übereinstimmen.
- **Port belegt:** In der `.env` einen anderen `PITSTOP_PORT` wählen, dann `docker compose up -d`.
- **`Permission denied` beim Backup nach `data/backups`:** Der Ordner gehört dem App-Benutzer des Containers (UID 1000). Die Backup-Befehle als root ausführen (`sudo -s`) oder als Benutzer mit UID 1000.

## Für Entwickler

| Datei | Inhalt |
|---|---|
| [CONCEPT.md](CONCEPT.md) | Fachliches Konzept: Module, Rollen, Abläufe, Demo-Drehbuch |
| [TECHNICAL.md](TECHNICAL.md) | Architektur, Datenmodell, API, Docker-Aufbau, lokale Entwicklung |
| [AGENTS.md](AGENTS.md) | Aktueller Arbeitsstand und Phasenplan |
| [CLAUDE.md](CLAUDE.md) | Projektkarte: welche Datei wofür zuständig ist |

Lokal entwickeln: TECHNICAL.md Abschnitt 13. Browser-Tests der Drehbücher: `tests/e2e/run.sh demo.mjs http://localhost:8080` (braucht nur Docker).
