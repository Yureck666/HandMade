@echo off
rem Thin, stable launcher. Pure ASCII on purpose (no Cyrillic anywhere in
rem this file) - Cyrillic text mixed with plain commands has been observed
rem to break cmd.exe's own parser on some codepages. All real logic and all
rem Russian text live in update-worker.ps1, which this file copies to a temp
rem location and runs via PowerShell (safe for Unicode, and safe to let git
rem overwrite the original copy mid-run since we already run from the copy).
setlocal
rem %~dp0 always ends with a trailing backslash. A path quoted as "...\"
rem has that backslash escape the closing quote instead of ending the
rem string (classic Windows command-line parsing gotcha) - this silently
rem corrupted the -Repo argument passed to PowerShell. The "%~dp0." trick
rem below resolves the same folder without the trailing backslash.
for %%I in ("%~dp0.") do set "SELFDIR=%%~fI"
set "REPO=%~1"
set "EXE=%~2"
set "MODE=%~3"
if "%REPO%"=="" set "REPO=%SELFDIR%"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"
if "%MODE%"=="" set "MODE=pull"
rem Note: if EXE is empty, we do NOT try to find it here with a plain
rem "for" loop - cmd.exe's FOR variables go through the console's OEM
rem codepage, which corrupts a Cyrillic filename like "Админка.exe" into
rem garbage bytes (confirmed: Start-Process then fails with "file not
rem found"). PowerShell handles Unicode paths correctly, so the worker
rem script does that lookup itself when -Exe is blank.

set "WORKER=%SELFDIR%\update-worker.ps1"
set "TEMPWORKER=%TEMP%\cozy-corner-update-worker.ps1"

if not exist "%WORKER%" (
  echo update-worker.ps1 not found next to this file.
  echo Please contact the developer.
  pause
  exit /b 1
)

copy /y "%WORKER%" "%TEMPWORKER%" >nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMPWORKER%" -Repo "%REPO%" -Exe "%EXE%" -Mode "%MODE%"
endlocal
rem Force the console window closed no matter how it was opened - "start"
rem launching a .bat file can end up using "cmd /k" on some systems, which
rem leaves an interactive prompt sitting open instead of closing the window.
exit
