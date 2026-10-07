@echo off
cd /d C:\Projetos\agrominas

start "" /b npm run dev

:aguardar
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }"
if errorlevel 1 goto aguardar

start "" http://localhost:3000
exit