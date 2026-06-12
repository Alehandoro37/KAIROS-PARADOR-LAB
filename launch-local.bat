@echo off
REM KAIROS PARADOR - Linear Station Lab
REM Lanzador local para Windows. Doble clic en el Explorador o ejecuta launch-local.bat
REM Sirve el repo en http://localhost:8080 y abre el navegador en el lab.
REM Requiere Python (python o py) o, en su defecto, Node (npx).

setlocal
cd /d "%~dp0"
set PORT=8080
set URL=http://localhost:%PORT%/web/

echo --------------------------------------------------
echo  KAIROS PARADOR - servidor local
echo  Carpeta : %cd%
echo  URL     : %URL%
echo  Engine  : http://localhost:%PORT%/geometry-engine/v2/
echo  Detener : Ctrl + C
echo --------------------------------------------------

REM Abre el navegador (el server arranca a continuacion y bloquea la consola).
start "" "%URL%"

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python -m http.server %PORT%
  goto :end
)

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py -m http.server %PORT%
  goto :end
)

where npx >nul 2>&1
if %ERRORLEVEL%==0 (
  npx --yes http-server . -p %PORT% -c-1
  goto :end
)

echo ERROR: necesitas Python o Node (npx) instalado.
pause

:end
endlocal
