-- Nachgebaute FiveM-Umgebung: führt fivem/pitstop/server.lua gegen einen echten Pitstop aus (Start: tests/fivem/run.sh).
local cjson = require('cjson')
json = { encode = cjson.encode, decode = cjson.decode }
local KEY, BILL, AMOUNT = arg[1], tonumber(arg[2]), tonumber(arg[3])
local convars = { pitstop_url = 'http://localhost:3100/api/game', pitstop_key = KEY, pitstop_id_type = 'license' }
function GetConvar(k, d) return convars[k] or d end
local function sh(s) return "'" .. s:gsub("'", "'\\''") .. "'" end
function PerformHttpRequest(url, cb, method, body, headers)
  local h = ''
  for k, v in pairs(headers or {}) do h = h .. ' -H ' .. sh(k .. ': ' .. v) end
  local f = io.open('/tmp/req.json', 'w'); f:write(body or ''); f:close()
  local cmd = ('curl -s -o /tmp/res.json -w "%%{http_code}" -X %s%s %s %s'):format(method, h, (body and body ~= '') and '--data-binary @/tmp/req.json' or '', sh(url))
  local p = io.popen(cmd); local status = tonumber(p:read('*a')); p:close()
  local r = io.open('/tmp/res.json'); local text = r and r:read('*a') or ''; if r then r:close() end
  cb(status, text, {})
end
local exported, commands, events, threads = {}, {}, {}, {}
function exports(name, fn) exported[name] = fn end
exports = setmetatable({}, { __call = function(_, name, fn) exported[name] = fn end, __index = function(_, res) return setmetatable({}, { __index = function(_, fname) return function(_, ...) return exported[fname](...) end end }) end })
function RegisterCommand(n, fn) commands[n] = fn end
function AddEventHandler(n, fn) events[n] = fn end
function CreateThread(fn) threads[#threads + 1] = fn end
function Wait() end
function TriggerClientEvent(_, src, msg) print(('[Chat an %d] %s'):format(src, msg.args[2])) end
function GetPlayerIdentifierByType(src, t) return src == 1 and 'license:abc123' or 'license:unbekannt' end
function GetPlayerPed(src) return src end
function GetEntityCoords() return { x = 215.4, y = -810.2, z = 30.7 } end
function GetPlayerName() return 'Spieler Eins' end
source = 1

dofile('/res/config.lua')
dofile('/res/server.lua')
for _, t in ipairs(threads) do t() end
local function check(cond, msg) print((cond and 'OK  ' or 'FEHL') .. ' ' .. msg); if not cond then FAILED = true end end

check(commands.dienst and commands.notruf and commands.kennzeichen, 'Befehle registriert')
commands.dienst(1, {})
commands.dienst(1, {})
commands.dienst(2, {})
commands.notruf(1, { 'Unfall', 'Legion', 'Square' })
commands.kennzeichen(1, { 'LSPD', '12' })
commands.kennzeichen(1, { 'XX', '000' })
exports.pitstop:Zahlung(BILL, AMOUNT - 1, 'kasse', 'Test', function(ok) check(not ok, 'Zahlung mit falschem Betrag abgelehnt') end)
exports.pitstop:Zahlung(BILL, AMOUNT, 'kasse', 'Test', function(ok, d) check(ok and d.bill == 'R-' .. BILL, 'Zahlung angenommen') end)
exports.pitstop:Runde({ track = 'Stadtkurs Vinewood', driver = 'Jamal Carter', car = '7', s1 = 41000, s2 = 46000, s3 = 43000 }, function(ok, d) check(ok and d.lapMs == 130000, 'Runde übertragen') end)
exports.pitstop:Fahndung('QQ 1', true, 'LSPD', function(ok) check(ok, 'Fahndung gesetzt') end)
exports.pitstop:Fahrzeug('QQ 1', function(ok, d) check(ok and d.stolen == true, 'Fahrzeug als gestohlen gemeldet') end)
exports.pitstop:Kontostand(function(ok, d) check(ok and math.type(d.firma) ~= nil, 'Kontostand gelesen') end)
exports.pitstop:Status(function(ok, d) check(ok and d.company == 'Demo Motorsport', 'Status gelesen') end)
events.playerDropped()
if FAILED then os.exit(1) end
