@echo off
rem Thin, stable launcher. Pure ASCII on purpose (no Cyrillic anywhere in
rem this file) - Cyrillic text mixed with plain commands has been observed
rem to break cmd.exe's own parser on some codepages. All real logic and all
rem Russian text live in update-worker.ps1, which this file copies to a temp
rem location and runs via PowerShell (safe for Unicode, and safe to let git
rem overwrite the original copy mid-run since we already run from the copy).
setlocal
set "SELFDIR=%~dp0"
set "REPO=%~1"
set "EXE=%~2"
set "MODE=%~3"
if "%REPO%"=="" set "REPO=%SELFDIR%"
if "%MODE%"=="" set "MODE=pull"
if "%EXE%"=="" (
  for %%F in ("%SELFDIR%*.exe") do set "EXE=%%~fF"
)

set "WORKER=%SELFDIR%update-worker.ps1"
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
