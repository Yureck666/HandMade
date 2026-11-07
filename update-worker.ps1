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
    # Ошибка — держим окно открытым, чтобы можно было сфотографировать и
    # написать разработчику.
    Read-Host "Нажмите Enter, чтобы закрыть это окно"
  } else {
    # Всё хорошо — админка уже открывается, окно терминала само закроется
    # через пару секунд, никуда нажимать не нужно.
    Start-Sleep -Seconds 2
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
  # Ждём закрытия максимум 10 секунд — раньше ждали бесконечно, и если
  # процесс зависал (например, за ним осталось открытым окно системной
  # ошибки), всё обновление вставало намертво без единой подсказки.
  $waited = 0
  while ((Get-Process -Name $exeName -ErrorAction SilentlyContinue) -and ($waited -lt 10000)) {
    Start-Sleep -Milliseconds 300
    $waited += 300
  }
  Get-Process -Name $exeName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

try {
  Set-Location -LiteralPath $Repo -ErrorAction Stop
} catch {
  Say "Не получилось открыть папку с сайтом."
  Say "Сфотографируйте это окно и напишите разработчику."
  RelaunchAndExit 1
}

# Админка.exe при каждом запуске распаковывает себя во временную папку, и
# антивирус иногда удаляет оттуда ffmpeg.dll (ложное срабатывание) — тогда
# Windows пишет "ffmpeg.dll не найден". В папке репозитория лежит запасная
# копия (copy-to-root.js), а здесь один раз добавляем эту папку в PATH
# пользователя, чтобы Windows сама её нашла, если основная копия пропадёт.
try {
  $repoFull = (Resolve-Path -LiteralPath $Repo).ProviderPath.TrimEnd('\')
  $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
  $already = $userPath -split ";" | Where-Object { $_.TrimEnd('\') -ieq $repoFull }
  if (-not $already) {
    $newPath = if ($userPath) { "$userPath;$repoFull" } else { $repoFull }
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
  }
  if ($env:PATH -notlike "*$repoFull*") { $env:PATH = "$repoFull;$env:PATH" }
} catch {}

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "master" }

# На некоторых компьютерах git вообще не настроен (нет user.name/user.email),
# и тогда "git commit" ниже падает с "unable to auto-detect email address".
# Выставляем identity локально для этого репозитория (не трогая глобальные
# настройки), только если её ещё нет.
if (-not (git config user.email 2>$null)) {
  git config user.email "update@cozy-corner.local" *> $null
}
if (-not (git config user.name 2>$null)) {
  git config user.name "soz1959" *> $null
}

git add -A *> $null
git commit -m "Локальные изменения перед обновлением" *> $null

if ($Mode -eq "push") {
  # При отправке больше не подтягиваем чужие изменения перед этим — только
  # свои. Раньше здесь всегда делали fetch+merge, и это иногда порождало
  # конфликты слияния прямо посреди "Отправить на сайт".
  Say "Отправляю изменения на сайт..."
  git push
  if ($LASTEXITCODE -ne 0) {
    Say "Не получилось отправить изменения на сайт."
    Say "Возможно, кто-то ещё отправлял изменения раньше вас — нажмите «Обновить», а затем попробуйте «Отправить на сайт» ещё раз."
    Say "Если не поможет, сфотографируйте это окно и напишите разработчику."
    RelaunchAndExit 1
  }
} else {
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
}

Say "Готово! Запускаю админку..."
RelaunchAndExit 0
