@echo off
title RED SOFTWARE TEAM - AI SOFTWARE BUILDER (WINDOWS)
cd /d "%~dp0"

echo Стартирам сървъра на RED SOFTWARE TEAM...
start "" cmd /k "node server.js"
timeout /t 2 /nobreak >nul

set PORT_URL=http://127.0.0.1:3000/software-builder.html
if not "%PORT%"=="" set PORT_URL=http://127.0.0.1:%PORT%/software-builder.html

echo Отварям %PORT_URL%
start "" "%PORT_URL%"
