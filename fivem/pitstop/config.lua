-- Einstellungen. Adresse und Schlüssel kommen bevorzugt aus der server.cfg:
--   set pitstop_url "https://pitstop.example.de/api/game"
--   set pitstop_key "pg_…"            (Pitstop: Firma → Firmendaten → Spielserver → + Schlüssel)
--   set pitstop_id_type "license"      (license oder discord; muss zur Spiel-ID in Pitstop passen)
Config = {}

Config.Url = GetConvar('pitstop_url', 'http://localhost:7077/api/game')
Config.Key = GetConvar('pitstop_key', '')
Config.IdType = GetConvar('pitstop_id_type', 'license')

-- Chat-Befehle (auf false setzen, wenn ein eigenes Skript die Exports nutzt)
Config.Commands = {
  dienst = true,       -- /dienst            Dienst beginnen oder beenden
  notruf = true,       -- /notruf <Text>     Einsatz mit Standort anlegen
  kennzeichen = true,  -- /kennzeichen <KZ>  Fahrzeug abfragen
}

-- Beim Verlassen des Servers den Dienst automatisch beenden
Config.DutyOffOnDrop = true
