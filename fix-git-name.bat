@echo off
rem Pure ASCII on purpose - Cyrillic mixed with plain commands has been
rem observed to break cmd.exe's own parser on some codepages.
rem One-time fix: sets git identity for this folder only (not global),
rem so "update.bat" can save local changes before updating.
setlocal
for %%I in ("%~dp0.") do set "SELFDIR=%%~fI"
cd /d "%SELFDIR%"

git config user.name "soz1959"
git config user.email "soz1959@users.noreply.github.com"

echo Done. You can close this window.
pause
