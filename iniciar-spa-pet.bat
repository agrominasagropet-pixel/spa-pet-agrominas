
@echo off
cd /d "C:\Projetos\agrominas"

REM Se o sistema ja estiver ativo, abre imediatamente
powershell -NoProfile -WindowStyle Hidden -Command "foreach ($p in @(3000,3001)) { try { $c = [System.Net.Sockets.TcpClient]::new(); $c.Connect('localhost',$p); $c.Close(); Start-Process ('http://localhost:' + $p); exit } catch {} }; Start-Process 'http://localhost:3000'; Start-Process 'cmd.exe' -ArgumentList '/c','cd /d C:\Projetos\agrominas && npm run dev' -WindowStyle Hidden"

exit
