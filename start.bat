@echo off
title SimpleTickets
cd /d "%~dp0"

if not exist dist\index.js (
    echo The bot isn't set up yet, run install.bat first.
    pause
    exit /b 1
)

node dist/index.js
pause
