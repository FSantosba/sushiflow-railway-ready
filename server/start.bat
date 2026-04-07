@echo off
chcp 65001 >nul
title SushiFlow - Servidor Local
color 0A
echo.
echo  ===================================================
echo   SushiFlow v3.1 - Servidor Local com Auto-Restart
echo  ===================================================
echo.
cd /d "%~dp0.."
set PORT=3001
set RESTART_COUNT=0
set MAX_RESTARTS=10
:START_SERVER
if %RESTART_COUNT% geq %MAX_RESTARTS% goto FATAL

:: Mata processos antigos na porta 3001 para evitar colisão
echo  [%time%] Limpando processos fantasmas na porta %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

echo  [%time%] Iniciando servidor na porta %PORT%... (tentativa %RESTART_COUNT%)
echo.
node server/api_server.js
set EXIT_CODE=%errorlevel%
if %EXIT_CODE% equ 0 goto CLEAN_EXIT
set /a RESTART_COUNT=%RESTART_COUNT%+1
color 0E
echo.
echo  ============================================
echo  [%time%] CRASH detectado! (cod %EXIT_CODE%)
echo  Reiniciando em 5 segundos... (%RESTART_COUNT%/%MAX_RESTARTS%)
echo  Pressione Ctrl+C para cancelar.
echo  ============================================
echo.
timeout /t 5 /nobreak >nul
color 0A
goto START_SERVER
:CLEAN_EXIT
echo.
echo  [%time%] Servidor encerrado normalmente.
pause
exit /b 0
:FATAL
color 0C
echo.
echo  [ERRO] Servidor crashou %MAX_RESTARTS% vezes seguidas.
echo  Verifique os logs acima.
echo.
pause
exit /b 1
