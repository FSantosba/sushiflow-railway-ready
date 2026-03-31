@echo off
chcp 65001 > nul
title SushiFlow — Servidor Local
color 0A

echo.
echo  ============================================
echo   SushiFlow Local Server — Inicializando...
echo  ============================================
echo.

cd /d "%~dp0.."
node server/api_server.js

if %errorlevel% neq 0 (
  echo.
  echo  [ERRO] Servidor encerrou com erro. Verifique acima.
  pause
)
