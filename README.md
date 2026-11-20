# Pitstop

Pitstop ist die selbst gehostete Verwaltung für Werkstätten auf einem **Roleplay-Server** (GTA V / FiveM): Werkstatt mit Lager, Abschleppdienst, Tuning, Racing, Kunden, Personal mit Dienstplan und Lohn, Schulungen und Finanzen in **einer** Oberfläche für PC, Tablet und Handy. Mehrere Firmen teilen sich einen Server; jede Firma vergibt ihre Rechte selbst. Geld ist Spielwährung ($, ohne Steuern). Es läuft mit Docker Compose und speichert alles in PostgreSQL.

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

| Bereich | Inhalt |
|---|---|
| **Übersicht** | Cockpit und weitere benannte Arbeitsflächen mit Widgets (pro Konto), Live-Feed, Kalender; Tabs mit „Seite daneben“; Suche mit Strg+K (auch Kennzeichen-Abgleich), Meldungen, „Neu“-Menü |
| **Werkstatt** | Auftragstafel (Angenommen → In Arbeit → Wartet auf Teile → Fertig → Abgeholt) mit Kunde, Fahrzeug, Zuständigem, Preis und Fortschritt; daraus Rechnung stellen. Fahrzeugannahme mit Schadensskizze, Fotos und Checkliste, Hallenplan, Lager mit Bestellungen und Inventur, Werkzeugausgabe |
| **Abschleppdienst** | Leitstelle mit Karte (Zoom per Mausrad, eigenes Kartenbild mit Zwei-Punkt-Kalibrierung), Einsätze mit Spielkoordinaten, Fahrer, Status; abrechnen; Einsatzliste mit Kennzahlen; Fuhrpark mit Fahrtenbuch |
| **Tuning** | Konfigurator (Stufen je Teil, Fahrzeugklasse, Pakete, Kundenrabatt) → Tuning-Auftrag, Builds, Prüfstand, eigene Preisliste |
| **Racing** | Rennkalender mit Startplätzen, Startgeld und Meisterschaft; Team & Rennwagen (Verschleiß, Budget), Setups & Telemetrie (Sektoren), Bestenliste, Kunden-Trackdays mit Paketen |
| **Kunden** | Kundenakten, Fahrzeugakten (Tuningstand, Vorschäden, gestohlen gemeldet), Rahmenverträge, Nachrichten an Kunden mit Vorlagen |
| **Personal** | Mitarbeiter mit Rang, Stempeluhr, Dienstzeiten, Dienstplan mit Abwesenheiten und Stempel-Nachträgen, Lohn & Provision (Stundenlohn, Provision, Fixum) mit Lohnlauf und Auszahlung, Ränge, Bewerbungen |
| **Schulungen** | Kurse mit Lektionen und Test (auch Freitext), Prüfungen & Termine, Praxisprüfung, Pflichtkurse je Gruppe, Nachweise und Lizenzen mit Ablaufdatum |
| **Finanzen** | Vier Konten (Firmenkonto, Kasse, Trinkgeld, Rennteam), Rechnungen und Angebote, Mahnen, Storno, Buchungen mit Betragsgrenzen, Kasse mit Tagesabschluss, Daueraufträgen und Trinkgeld-Verteilung, Ziele, Auswertung |
| **Firma** | Firmendaten, Mitglieder aufnehmen, **Gruppen & Rechte** (Stufe je Bereich, „nur eigene“, Sonderrechte, Ausnahmen pro Person), Module an/aus, Protokoll, CSV-Export, Preisliste mit Nachweis-Pflicht, Regelwerk zum Bestätigen, Pinnwand mit Umfragen, Webhooks (Discord), Vorschau als Person |
| **Serververwaltung** | Für Server-Admins (eigene Rolle pro Konto): Firmen, Benutzerkonten, Sicherungen mit Wiederherstellen (auch automatisch täglich), Export, Anbindungen mit API-Schlüsseln, Spielserver-Anbindung für FiveM (Dienst, Notrufe, Zahlungen, Rundenzeiten, Fahndung), Anmeldung mit Discord, Einstellungen (Wartungsmodus, Standard-Module), Server-Protokoll, Ankündigungen. Firmendaten nur mit Support-Freigabe der Firma |
| **Persönlich** | Konto mit angemeldeten Geräten, Zwei-Faktor-Anmeldung, Discord-Verknüpfung, Darstellung pro Konto (6 Themes, Dichte, Schriftgröße, Startseite), Neuigkeiten für alle |

Die Anmeldung läuft über E-Mail und Passwort. Der erste Admin aus der `.env` ist Server-Admin. Impressum und Datenschutzerklärung sind auf der Anmeldeseite erreichbar.

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

**Firma und Leute anlegen:** Als Server-Admin unter *Serververwaltung → Benutzerkonten* Konten anlegen (Startpasswort wird einmal angezeigt) und unter *Firmen* eine Firma mit Inhaber anlegen. Der Inhaber nimmt danach unter *Firma → Mitglieder & Zugänge* weitere Leute auf und vergibt Gruppen. Beim ersten Anmelden ist ein eigenes Passwort fällig.

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
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | nein | – | Anmeldung mit Discord, siehe [Discord-Anmeldung](#discord-anmeldung). Leer = aus |

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

Mit `DEMO_MODE=true` legt Pitstop beim **ersten Start** die Firma „Demo Motorsport“ mit Kunden, Fahrzeugen, Aufträgen, Einsätzen, Rechnungen, Schichten, Lager, Dienstplan, Löhnen, Kursen, Prüfstandsmessungen, Rennen und allen Bereichen ab 0.4 (Hallenplan, Werkzeug, Fuhrpark, Rennteam, Verträge, Nachrichten, Ränge, Bewerbungen, Kasse, Preisliste, Regelwerk, Pinnwand) an. Die Anmeldeseite bietet dann die Anmeldung mit einem Klick als Inhaber, Leitung, Mechanik, Abschleppfahrerin oder Büro; unter *Mein Konto* gibt es „Demo-Daten zurücksetzen“. Der Admin aus der `.env` ist Server-Admin und nicht Mitglied der Demo-Firma.

**Nicht für echte Daten verwenden.** Im Demo-Modus kann jeder, der die Seite erreicht, sich mit einem Klick als Admin anmelden. Um von der Demo auf echten Betrieb zu wechseln: `DEMO_MODE=false` setzen und mit leerer Datenbank neu beginnen (siehe [Löschen](#löschen), Daten löschen, danach wieder `docker compose up -d`).

### Discord-Anmeldung

1. Unter https://discord.com/developers/applications eine Anwendung anlegen.
2. Bei *OAuth2* als Redirect `<PUBLIC_URL>/api/auth/discord/callback` eintragen (z. B. `https://pitstop.example.de/api/auth/discord/callback`).
3. Client-ID und Client-Secret in die `.env` (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`), dann `docker compose up -d`.

Die Anmeldeseite zeigt danach „Mit Discord anmelden“. Discord legt **keine** Konten an: Jede Person meldet sich zuerst mit E-Mail an und verknüpft unter *Mein Konto → Discord* ihr Discord-Konto. Konten mit Zwei-Faktor-Anmeldung melden sich weiter mit E-Mail, Passwort und Code an.

### Zwei-Faktor-Anmeldung

Jede Person kann unter *Mein Konto → Zwei-Faktor-Anmeldung* eine Authenticator-App (Google Authenticator, Aegis, 1Password …) einrichten. Die Konten-Liste der Serververwaltung markiert Server-Admins ohne Zwei-Faktor. Handy verloren: `docker compose exec app pitstop disable-2fa person@example.de` schaltet es ab und meldet alle Sitzungen ab.

### Spielserver (FiveM)

Die Ressource liegt im Repository unter `fivem/pitstop` (Anleitung dort in der `README.md`). Kurz: In Pitstop unter *Firma → Firmendaten → Spielserver* einen Schlüssel erstellen, den Ordner in die `resources` des FiveM-Servers kopieren, `pitstop_url`, `pitstop_key` und `ensure pitstop` in die `server.cfg` und bei den Mitgliedern die Spiel-ID (z. B. `license:…`) eintragen. Danach gibt es `/dienst`, `/notruf`, `/kennzeichen` und Exports für Bank-, Renn- und Polizei-Skripte. Der Spielserver muss Pitstop über `PUBLIC_URL` erreichen.

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

**In der App:** Serververwaltung → Sicherungen → „Jetzt sichern“ legt eine komplette Sicherung aller Firmen und Konten als `data/backups/pitstop-JJJJ-MM-TT-hhmmss.json.gz` an. Von dort lässt sie sich herunterladen und wiederherstellen (vorher sichert Pitstop den jetzigen Stand automatisch; alle werden abgemeldet). Kartenbilder unter `data/maps` und Fotos unter `data/photos` sind nicht enthalten – die Komplettsicherung des Ordners (unten) enthält alles. Außerdem sichert Pitstop **automatisch einmal am Tag** (Standard ab 4 Uhr Serverzeit, 14 Stück aufbewahren; einstellbar unter Serververwaltung → Einstellungen). Gelöscht werden dabei nur ältere automatische Sicherungen, nie von Hand erstellte.

> **Update von 0.4 auf 0.5:** Die Migration 006 fügt nur Spalten und Tabellen hinzu (Zwei-Faktor, Discord-Verknüpfung, Spiel-ID, Fotos, Spielserver-Schlüssel). Für die Discord-Anmeldung `DISCORD_CLIENT_ID` und `DISCORD_CLIENT_SECRET` in die `.env` eintragen (optional). Fotos liegen in `data/photos`.

> **Update von 0.3 auf 0.4:** Die Migration 005 fügt nur Tabellen und Spalten hinzu; vorhandene Daten bleiben. Gruppen mit den Vorlagen-Namen bekommen Stufen für die neuen Bereiche (Hallenplan, Werkzeug, Fuhrpark, Rahmenverträge, Nachrichten, Ränge, Bewerbungen, Preisliste, Regelwerk, Pinnwand); eigene Gruppen musst du unter *Gruppen & Rechte* freigeben. Neu ist eine **automatische Sicherung** täglich ab 4 Uhr (Serverzeit), die 14 automatische Sicherungen in `data/backups` behält; Uhrzeit, Anzahl oder Abschalten unter *Serververwaltung → Einstellungen*. Alle bisherigen Sitzungen bleiben gültig.

> **Update von 0.2 auf 0.3:** Die Migration 004 fügt nur Tabellen und Spalten hinzu; vorhandene Daten bleiben. Bestehende Firmen bekommen die Module Tuning, Racing und Schulungen eingeschaltet (unter *Firma → Module* abschaltbar), und Gruppen mit den Vorlagen-Namen (Leitung, Mechanik, Abschleppdienst, Büro & Finanzen, Gäste) bekommen Stufen für die neuen Bereiche. Eigene Gruppen sehen die neuen Bereiche erst, wenn man sie unter *Gruppen & Rechte* freigibt.

> **Update von 0.1 auf 0.2:** Die Migration 003 ersetzt die Fachdaten von 0.1 (Kunden, Rechnungen mit MwSt., Personal). Vorher einen Datenbank-Dump machen. Konten bleiben; bisherige Admins werden Server-Admins.


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
| Zwei-Faktor einer Person abschalten (Handy verloren) | `docker compose exec app pitstop disable-2fa admin@example.de` |
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
