#!/bin/sh
# Führt fivem/pitstop/server.lua mit nachgebauten FiveM-Funktionen gegen einen laufenden Pitstop (Demo-Modus, Port 3100) aus.
#   tests/fivem/run.sh <pg_schlüssel> <rechnungsnummer> <offener_betrag_in_cent>
# Voraussetzung: Schlüssel unter Firmendaten → Spielserver, Spiel-ID „license:abc123“ bei Jamal Carter.
set -e
DIR=$(cd "$(dirname "$0")/../.." && pwd)
docker run --rm --network host -v "$DIR/fivem/pitstop":/res:ro -v "$DIR/tests/fivem":/t:ro alpine:3.20 \
  sh -c "apk add -q lua5.4 lua5.4-cjson curl >/dev/null 2>&1 && lua5.4 /t/run.lua $1 $2 $3"
