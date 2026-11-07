param(
  [string]$Repo,
  [string]$Exe,
  [string]$Mode = "pull"
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Say($text) {
  Write-Host $text
}

function RelaunchAndExit($code) {
  if ($Exe -and (Test-Path -LiteralPath $Exe)) {
    Start-Process -FilePath $Exe
  } else {
    Say "Не нашла файл программы, чтобы открыть его заново — откройте вручную."
  }
  if ($code -ne 0) {
    Read-Host "Нажмите Enter, чтобы закрыть это окно"
  }
  exit $code
}

Say "Обновляю админку, подождите..."

# Если путь к .exe не передали явно — находим его сами. Важно делать это
# именно здесь, в PowerShell: у cmd.exe/batch переменные идут через
# кодовую страницу консоли и портят кириллическое имя файла (проверено —
# из-за этого раньше Start-Process не находил "Админка.exe").
if (-not $Exe -or -not (Test-Path -LiteralPath $Exe)) {
  $found = Get-ChildItem -LiteralPath $Repo -Filter "*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $Exe = $found.FullName }
}

if ($Exe) {
  $exeName = [System.IO.Path]::GetFileNameWithoutExtension($Exe)
  while (Get-Process -Name $exeName -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 300
  }
}

try {
  Set-Location -LiteralPath $Repo -ErrorAction Stop
} catch {
  Say "Не получилось открыть папку с сайтом."
  Say "Сфотографируйте это окно и напишите разработчику."
  RelaunchAndExit 1
}

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "master" }

git add -A *> $null
git commit -m "Локальные изменения перед обновлением" *> $null

Say "Получаю изменения..."
git fetch origin
if ($LASTEXITCODE -ne 0) {
  Say "Не получилось получить изменения с сайта."
  Say "Сфотографируйте это окно и напишите разработчику."
  RelaunchAndExit 1
}

git merge --no-edit "origin/$branch"
if ($LASTEXITCODE -ne 0) {
  Say "Не получилось автоматически объединить изменения."
  Say "Сфотографируйте это окно и напишите разработчику."
  RelaunchAndExit 1
}

if ($Mode -eq "push") {
  Say "Отправляю изменения на сайт..."
  git push
  if ($LASTEXITCODE -ne 0) {
    Say "Изменения с сайта получены, но отправить ваши не получилось."
    Say "Когда админка откроется, попробуйте ещё раз кнопку «Отправить на сайт»."
    RelaunchAndExit 1
  }
}

Say "Готово! Запускаю админку..."
Start-Sleep -Seconds 1
RelaunchAndExit 0
