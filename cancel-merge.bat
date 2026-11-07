@echo off
rem Pure ASCII on purpose - Cyrillic mixed with plain commands has been
rem observed to break cmd.exe's own parser on some codepages.
rem One-time fix: cancels a git merge that got stuck because the developer
rem corrected a commit on GitHub while this folder was mid-update, then
rem re-syncs with the correct version. Safe to run even if no merge is
rem stuck - the abort step just does nothing in that case.
setlocal
for %%I in ("%~dp0.") do set "SELFDIR=%%~fI"
cd /d "%SELFDIR%"

git merge --abort

git fetch origin
git merge --no-edit -X theirs origin/master

echo Done. You can close this window and open Admin.exe.
pause
