-- Pitstop-Anbindung (Serverseite). Alle Aufrufe gehen an die Spielserver-API von Pitstop (/api/game/*).
local function log(msg) print(('^3[pitstop]^7 %s'):format(msg)) end

if Config.Key == '' then
  log('Kein Schlüssel gesetzt: set pitstop_key "pg_…" in der server.cfg eintragen.')
end

--- HTTP-Aufruf an Pitstop. cb(ok, daten, status)
local function request(method, path, body, cb)
  local headers = { ['Authorization'] = 'Bearer ' .. Config.Key, ['Content-Type'] = 'application/json' }
  PerformHttpRequest(Config.Url .. path, function(status, text)
    local data = nil
    if text and text ~= '' then data = json.decode(text) end
    local ok = status >= 200 and status < 300
    if not ok then
      local msg = (data and data.error and data.error.message) or ('HTTP ' .. tostring(status))
      log(('%s %s → %s'):format(method, path, msg))
    end
    if cb then cb(ok, data, status) end
  end, method, body and json.encode(body) or '', headers)
end

--- Spiel-ID eines Spielers (muss in Pitstop beim Mitglied eingetragen sein oder das Discord-Konto verknüpft)
local function playerId(src)
  return GetPlayerIdentifierByType(src, Config.IdType)
end

local function say(src, msg)
  if src and src > 0 then TriggerClientEvent('chat:addMessage', src, { args = { 'Pitstop', msg } }) else log(msg) end
end

local function errorText(data, status)
  return (data and data.error and data.error.message) or ('Fehler ' .. tostring(status))
end

-- ---------------------------------------------------------------------------
-- Exports für andere Ressourcen
-- ---------------------------------------------------------------------------

--- Dienst setzen. on = true/false oder nil (umschalten). cb(ok, { onDuty, name, changed })
exports('Dienst', function(src, on, cb)
  local id = playerId(src)
  if not id then if cb then cb(false, { error = { message = 'Keine Spiel-ID' } }) end return end
  request('POST', '/duty', { player = id, on = on }, cb)
end)

--- Notruf → Einsatz. data = { location, x, y, requester, vehicle, feeCents }. cb(ok, { number, label })
exports('Notruf', function(data, cb) request('POST', '/callouts', data, cb) end)

--- Rechnung im Spiel bezahlen. bill = 1042 oder 'R-1042', amountCents muss dem offenen Betrag entsprechen.
exports('Zahlung', function(bill, amountCents, account, payer, cb)
  request('POST', '/payments', { bill = bill, amountCents = amountCents, account = account or 'firma', payer = payer or '' }, cb)
end)

--- Kontostand { firma, kasse } in Cent
exports('Kontostand', function(cb) request('GET', '/balance', nil, cb) end)

--- Rundenzeit mit Sektoren in Millisekunden. data = { track, driver, car, session, s1, s2, s3 }
exports('Runde', function(data, cb) request('POST', '/laps', data, cb) end)

--- Fahrzeug abfragen. cb(ok, { known, model, owner, stolen, openOrders })
exports('Fahrzeug', function(plate, cb) request('GET', '/vehicles/' .. plate:gsub('%s+$', ''):gsub(' ', '%%20'), nil, cb) end)

--- Fahndung setzen oder aufheben (z. B. aus dem Polizei-MDT)
exports('Fahndung', function(plate, stolen, by, cb)
  request('POST', '/vehicles/' .. plate:gsub('%s+$', ''):gsub(' ', '%%20') .. '/stolen', { stolen = stolen, by = by or '' }, cb)
end)

--- Wer ist im Dienst? cb(ok, { company, onDuty = { { name, gameId } }, openCallouts })
exports('Status', function(cb) request('GET', '/status', nil, cb) end)

-- ---------------------------------------------------------------------------
-- Chat-Befehle
-- ---------------------------------------------------------------------------
if Config.Commands.dienst then
  RegisterCommand('dienst', function(src)
    exports.pitstop:Dienst(src, nil, function(ok, data, status)
      if ok then say(src, data.onDuty and ('Dienst begonnen, ' .. data.name .. '.') or 'Dienst beendet.')
      else say(src, errorText(data, status)) end
    end)
  end, false)
end

if Config.Commands.notruf then
  RegisterCommand('notruf', function(src, args)
    local text = table.concat(args, ' ')
    if text == '' then say(src, 'Benutzung: /notruf <was ist passiert, wo>') return end
    local x, y = nil, nil
    if src > 0 then
      local c = GetEntityCoords(GetPlayerPed(src))
      x, y = math.floor(c.x + 0.5), math.floor(c.y + 0.5)
    end
    exports.pitstop:Notruf({ location = text, x = x, y = y, requester = src > 0 and GetPlayerName(src) or 'Konsole' }, function(ok, data, status)
      if ok then say(src, 'Notruf aufgenommen: ' .. data.label) else say(src, errorText(data, status)) end
    end)
  end, false)
end

if Config.Commands.kennzeichen then
  RegisterCommand('kennzeichen', function(src, args)
    local plate = table.concat(args, ' ')
    if plate == '' then say(src, 'Benutzung: /kennzeichen <Kennzeichen>') return end
    exports.pitstop:Fahrzeug(plate, function(ok, d, status)
      if not ok then say(src, errorText(d, status)) return end
      if not d.known then say(src, plate .. ': bei uns unbekannt, nicht als gestohlen gemeldet.') return end
      local msg = ('%s: %s, Halter %s'):format(d.plate, d.model ~= '' and d.model or 'Modell unbekannt', d.owner or 'unbekannt')
      if d.stolen then msg = msg .. ' – ACHTUNG: als gestohlen gemeldet!' end
      if #d.openOrders == 1 then msg = msg .. ' – 1 offener Auftrag'
      elseif #d.openOrders > 1 then msg = msg .. (' – %d offene Aufträge'):format(#d.openOrders) end
      say(src, msg)
    end)
  end, false)
end

if Config.DutyOffOnDrop then
  AddEventHandler('playerDropped', function()
    local src = source
    local id = playerId(src)
    if id then request('POST', '/duty', { player = id, on = false }) end
  end)
end

-- Verbindung beim Start prüfen
CreateThread(function()
  Wait(2000)
  if Config.Key == '' then return end
  request('GET', '/status', nil, function(ok, data)
    if ok then log(('Verbunden mit %s (%d im Dienst, %d offene Einsätze).'):format(data.company, #data.onDuty, data.openCallouts)) end
  end)
end)
