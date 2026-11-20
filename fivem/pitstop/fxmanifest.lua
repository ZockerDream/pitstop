-- Pitstop-Anbindung für FiveM: Dienst, Notrufe, Zahlungen, Rundenzeiten, Kennzeichen und Fahndung.
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'pitstop'
description 'Verbindet den Spielserver mit Pitstop (Werkstatt-Verwaltung)'
version '0.5.0'

server_scripts {
  'config.lua',
  'server.lua',
}
