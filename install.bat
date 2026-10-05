@echo off
title SimpleTickets Setup
cd /d "%~dp0"

echo.
echo  SimpleTickets setup
echo  -------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js isn't installed. Get it from https://nodejs.org then run this again.
    goto end
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
    echo Your Node.js is too old, SimpleTickets needs version 20 or newer.
    goto end
)

echo Installing packages...
call npm install
if errorlevel 1 goto failed

if not exist .env (
    copy .env.example .env >nul
    echo.
    echo Created a .env file and opened it in Notepad.
    echo Paste your bot token right after DISCORD_TOKEN= then save and close Notepad.
    echo Come back here and press a key when that's done.
    echo.
    start "" notepad .env
    pause
)

findstr /r /c:"^DISCORD_TOKEN=[A-Za-z0-9]" .env >nul
if errorlevel 1 (
    echo.
    echo There's no bot token in .env yet. Add it and run install.bat again.
    goto end
)

echo.
echo Building...
call npm run build
if errorlevel 1 goto failed

echo.
echo Registering slash commands...
call npm run deploy
if errorlevel 1 goto failed

echo.
echo All done. Run start.bat to start the bot.
goto end

:failed
echo.
echo Something went wrong, check the error above.

:end
echo.
pause
