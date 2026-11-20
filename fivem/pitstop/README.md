# Pitstop für FiveM

Diese Ressource verbindet einen FiveM-Server mit **einer** Firma in Pitstop.

| Funktion | Befehl / Export | Pitstop |
|---|---|---|
| Dienst beginnen/beenden | `/dienst`, `exports.pitstop:Dienst(src, on, cb)` | Stempeluhr der Person |
| Notruf → Einsatz | `/notruf <Text>` (mit Standort), `exports.pitstop:Notruf({...}, cb)` | offener Einsatz in der Leitstelle |
| Rechnung bezahlen | `exports.pitstop:Zahlung(bill, amountCents, account, payer, cb)` | Rechnung bezahlt + Einnahme (Betrag muss stimmen) |
| Kontostand | `exports.pitstop:Kontostand(cb)` | Firmenkonto und Kasse in Cent |
| Rundenzeit | `exports.pitstop:Runde({ track, driver, car, session, s1, s2, s3 }, cb)` | Setups & Telemetrie, Bestenliste |
| Kennzeichen abfragen | `/kennzeichen <KZ>`, `exports.pitstop:Fahrzeug(plate, cb)` | bekannt, Halter, gestohlen, offene Aufträge |
| Fahndung | `exports.pitstop:Fahndung(plate, stolen, by, cb)` | Kennzeichen-Abgleich bei Annahme und Suche |
| Status | `exports.pitstop:Status(cb)` | wer ist im Dienst, offene Einsätze |

## Einrichten

1. In Pitstop: **Firma → Firmendaten → Spielserver → + Schlüssel** (braucht „Firmendaten“ Verwalten). Der Schlüssel `pg_…` wird nur einmal angezeigt.
2. Ordner `pitstop` in den `resources`-Ordner des FiveM-Servers kopieren.
3. In die `server.cfg`:
   ```
   set pitstop_url "https://DEINE-PITSTOP-ADRESSE/api/game"
   set pitstop_key "pg_…"
   set pitstop_id_type "license"
   ensure pitstop
   ```
4. In Pitstop bei jedem Mitglied unter **Mitglieder & Zugänge → Rang, Telefon, Spiel-ID** die Spiel-ID eintragen (z. B. `license:abc123…`, steht in der FiveM-Konsole bzw. txAdmin). Alternativ `pitstop_id_type "discord"` setzen; dann erkennt Pitstop die Person über ihr unter „Mein Konto“ verknüpftes Discord-Konto.

Beim Start schreibt die Ressource „Verbunden mit …“ in die Server-Konsole. Fehler (falscher Schlüssel, unbekannte Spiel-ID, Modul aus) erscheinen dort und als Chat-Nachricht.

**Hinweis:** Die Ressource ist gegen die Pitstop-API getestet, nicht auf einem laufenden FiveM-Server. Sie nutzt nur Standard-Natives (`PerformHttpRequest`, `GetPlayerIdentifierByType`, `GetEntityCoords`), kein Framework (ESX/QBCore). Für Bank- oder Polizei-Skripte die Exports aufrufen.
