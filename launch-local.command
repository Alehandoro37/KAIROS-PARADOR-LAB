#!/bin/bash
# KAIROS PARADOR — Linear Station Lab
# Lanzador local para macOS. Doble clic desde Finder o ejecuta ./launch-local.command
# Sirve el repo en http://localhost:8080 y abre el navegador en el lab.
# Requiere python3 (preinstalado en macOS) o, en su defecto, Node (npx).

set -e
cd "$(dirname "$0")"

PORT=8080
URL="http://localhost:${PORT}/web/"

echo "──────────────────────────────────────────────"
echo " KAIROS PARADOR — servidor local"
echo " Carpeta : $(pwd)"
echo " URL     : ${URL}"
echo " Engine  : http://localhost:${PORT}/geometry-engine/v2/"
echo " Detener : Ctrl + C"
echo "──────────────────────────────────────────────"

# Abre el navegador 1.5 s después (cuando el server ya escucha).
( sleep 1.5; open "${URL}" ) >/dev/null 2>&1 &

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "${PORT}"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes http-server . -p "${PORT}" -c-1
else
  echo "ERROR: necesitas python3 o Node (npx) instalado." >&2
  read -r -n 1 -p "Pulsa una tecla para cerrar…"
  exit 1
fi
