const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const { pathToFileURL } = require("url");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);
const http = require("http");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

let previewServer = null;
let previewPort = null;
let previewRepoRoot = null;

function startPreviewServer(repoRoot) {
  if (previewServer && previewRepoRoot === repoRoot) {
    return Promise.resolve(previewPort);
  }
  if (previewServer) {
    previewServer.close();
    previewServer = null;
  }
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      const filePath = path.join(repoRoot, urlPath);
      if (!filePath.startsWith(path.resolve(repoRoot))) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Не найдено: " + urlPath);
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      previewServer = server;
      previewRepoRoot = repoRoot;
      previewPort = server.address().port;
      resolve(previewPort);
    });
    server.on("error", reject);
  });
}

// Подтягивает актуальный PATH из реестра Windows — нужно, чтобы увидеть
// Git сразу после установки, не перезапуская программу.
function refreshPathFromRegistry() {
  return new Promise((resolve) => {
    exec(
      "powershell -NoProfile -Command \"[System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')\"",
      { windowsHide: true },
      (err, stdout) => {
        if (!err && stdout && stdout.trim()) process.env.PATH = stdout.trim();
        resolve();
      }
    );
  });
}

// ---------------- Конфиг (помнит, где лежит папка с сайтом) ----------------
// Хранится в userData, а не в самой папке сайта — чтобы .exe можно было
// запускать откуда угодно и один раз указать/склонировать нужную папку.

const CONFIG_FILE = path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

function isValidRepo(folder) {
  if (!folder) return false;
  try {
    return fs.statSync(path.join(folder, ".git")).isDirectory();
  } catch {
    return false;
  }
}

function getRepoRoot() {
  const cfg = readConfig();
  return isValidRepo(cfg.repoPath) ? cfg.repoPath : null;
}

function ensureDataFiles(repoRoot) {
  const dataDir = path.join(repoRoot, "data");
  const dataFile = path.join(dataDir, "products.json");
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]\n", "utf-8");
  fs.mkdirSync(path.join(repoRoot, "images"), { recursive: true });
}

// ---------------- Окно ----------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1040,
    height: 740,
    minWidth: 780,
    minHeight: 560,
    backgroundColor: "#F7F1E6",
    title: "Админка — Уютный уголок",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------------- Установка Git ----------------

ipcMain.handle("git:checkInstalled", async () => {
  await refreshPathFromRegistry();
  try {
    const { stdout } = await execAsync("git --version", { windowsHide: true });
    return { ok: true, version: stdout.trim() };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("git:install", async () => {
  try {
    await execAsync("winget --version", { windowsHide: true });
  } catch {
    return {
      ok: false,
      error: "Не нашла winget (устанавливалка программ Windows), автоматически поставить не получится.",
      manualUrl: "https://git-scm.com/download/win",
    };
  }

  try {
    await execAsync(
      "winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements",
      { windowsHide: true, timeout: 10 * 60 * 1000 }
    );
  } catch (err) {
    return {
      ok: false,
      error: (err.stderr || err.stdout || err.message || "Не получилось установить Git автоматически.")
        .toString()
        .trim(),
      manualUrl: "https://git-scm.com/download/win",
    };
  }

  await refreshPathFromRegistry();
  try {
    await execAsync("git --version", { windowsHide: true });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Git вроде установился, но программа пока его не видит. Попробуйте закрыть и открыть Админку заново.",
      manualUrl: "https://git-scm.com/download/win",
    };
  }
});

ipcMain.handle("shell:openExternal", (event, url) => {
  shell.openExternal(url);
});

// ---------------- Настройка подключения к папке/репозиторию ----------------

ipcMain.handle("setup:getState", () => {
  const repoRoot = getRepoRoot();
  if (repoRoot) ensureDataFiles(repoRoot);
  return { configured: !!repoRoot, repoRoot };
});

ipcMain.handle("dialog:pickFolder", async (event, title) => {
  const result = await dialog.showOpenDialog({
    title: title || "Выберите папку",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("setup:useExistingFolder", (event, folder) => {
  if (!isValidRepo(folder)) {
    return { ok: false, error: "В этой папке не найден git-репозиторий (папка .git). Нужна папка с уже склонированным сайтом." };
  }
  const cfg = readConfig();
  cfg.repoPath = folder;
  writeConfig(cfg);
  ensureDataFiles(folder);
  return { ok: true, repoRoot: folder };
});

ipcMain.handle("setup:cloneRepo", async (event, { url, parentFolder, folderName }) => {
  if (!url || !parentFolder) return { ok: false, error: "Не хватает ссылки или папки." };
  const name = (folderName && folderName.trim()) ||
    (url.split("/").pop() || "site").replace(/\.git$/i, "") || "site";
  const dest = path.join(parentFolder, name);

  if (fs.existsSync(dest)) {
    if (isValidRepo(dest)) {
      const cfg = readConfig();
      cfg.repoPath = dest;
      writeConfig(cfg);
      ensureDataFiles(dest);
      return { ok: true, repoRoot: dest, output: "Папка уже существует и это готовый репозиторий — использую её." };
    }
    return { ok: false, error: `Папка "${dest}" уже существует и это не git-репозиторий. Выберите другое место или имя.` };
  }

  try {
    const { stdout, stderr } = await execAsync(`git clone "${url}" "${name}"`, {
      cwd: parentFolder,
      windowsHide: true,
    });
    const cfg = readConfig();
    cfg.repoPath = dest;
    writeConfig(cfg);
    ensureDataFiles(dest);
    return { ok: true, repoRoot: dest, output: [stdout, stderr].filter(Boolean).join("\n") };
  } catch (err) {
    return { ok: false, error: (err.stderr || err.message || "Не получилось склонировать репозиторий").trim() };
  }
});

ipcMain.handle("setup:getRemote", async () => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, error: "Папка с сайтом ещё не выбрана." };
  try {
    const { stdout } = await execAsync("git remote get-url origin", { cwd: repoRoot, windowsHide: true });
    return { ok: true, url: stdout.trim() };
  } catch {
    return { ok: true, url: "" };
  }
});

ipcMain.handle("setup:setRemote", async (event, url) => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, error: "Папка с сайтом ещё не выбрана." };
  try {
    await execAsync("git remote get-url origin", { cwd: repoRoot, windowsHide: true });
    await execAsync(`git remote set-url origin "${url}"`, { cwd: repoRoot, windowsHide: true });
  } catch {
    try {
      await execAsync(`git remote add origin "${url}"`, { cwd: repoRoot, windowsHide: true });
    } catch (err) {
      return { ok: false, error: (err.stderr || err.message || "").trim() };
    }
  }
  return { ok: true };
});

ipcMain.handle("setup:testConnection", async () => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, error: "Папка с сайтом ещё не выбрана." };
  try {
    const { stdout, stderr } = await execAsync("git ls-remote --heads origin", {
      cwd: repoRoot,
      windowsHide: true,
      timeout: 60000,
    });
    return { ok: true, output: [stdout, stderr].filter(Boolean).join("\n") || "Связь с GitHub есть." };
  } catch (err) {
    return { ok: false, error: (err.stderr || err.message || "").trim() };
  }
});

// ---------------- Products ----------------

function readProducts(repoRoot) {
  try {
    const raw = fs.readFileSync(path.join(repoRoot, "data", "products.json"), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProducts(repoRoot, products) {
  const dataFile = path.join(repoRoot, "data", "products.json");
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(products, null, 2) + "\n", "utf-8");
}

ipcMain.handle("products:list", () => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, error: "Папка с сайтом не выбрана." };
  const products = readProducts(repoRoot);
  return {
    ok: true,
    products: products.map((p) => ({
      ...p,
      imageUrl: p.image ? pathToFileURL(path.join(repoRoot, p.image)).href : null,
    })),
  };
});

ipcMain.handle("products:save", (event, product, newImagePath) => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, error: "Папка с сайтом не выбрана." };

  const products = readProducts(repoRoot);
  let entry = products.find((p) => p.id === product.id);
  if (!entry) {
    entry = { id: product.id || randomUUID(), visible: true, order: products.length + 1 };
    products.push(entry);
  }

  entry.category = product.category;
  entry.name = product.name;
  entry.price = product.price;
  entry.description = product.description;
  if (typeof product.visible === "boolean") entry.visible = product.visible;

  if (newImagePath) {
    const ext = path.extname(newImagePath) || ".jpg";
    const destDir = path.join(repoRoot, "images", entry.category);
    fs.mkdirSync(destDir, { recursive: true });
    const destFile = path.join(destDir, `${entry.id}${ext}`);
    fs.copyFileSync(newImagePath, destFile);
    entry.image = `images/${entry.category}/${entry.id}${ext}`;
  }

  writeProducts(repoRoot, products);
  return {
    ok: true,
    product: { ...entry, imageUrl: entry.image ? pathToFileURL(path.join(repoRoot, entry.image)).href : null },
  };
});

ipcMain.handle("products:delete", (event, id) => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, error: "Папка с сайтом не выбрана." };
  const next = readProducts(repoRoot).filter((p) => p.id !== id);
  writeProducts(repoRoot, next);
  return { ok: true };
});

ipcMain.handle("products:setVisible", (event, id, visible) => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, error: "Папка с сайтом не выбрана." };
  const products = readProducts(repoRoot);
  const entry = products.find((p) => p.id === id);
  if (entry) entry.visible = visible;
  writeProducts(repoRoot, products);
  return { ok: true };
});

// ---------------- Файлы / диалоги ----------------

ipcMain.handle("dialog:pickImage", async () => {
  const result = await dialog.showOpenDialog({
    title: "Выберите фото товара",
    properties: ["openFile"],
    filters: [{ name: "Изображения", extensions: ["jpg", "jpeg", "png", "webp"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("fs:toFileUrl", (event, absolutePath) => {
  try {
    return pathToFileURL(absolutePath).href;
  } catch {
    return null;
  }
});

// ---------------- Git (обновить / отправить) ----------------

function runGit(repoRoot, args) {
  return execAsync(`git ${args}`, { cwd: repoRoot, windowsHide: true }).then(
    ({ stdout, stderr }) => ({ ok: true, output: [stdout, stderr].filter(Boolean).join("\n").trim() }),
    (err) => ({ ok: false, output: (err.stderr || err.message || "").trim() })
  );
}

ipcMain.handle("git:pull", async () => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, output: "Папка с сайтом не выбрана." };
  return runGit(repoRoot, "pull");
});

ipcMain.handle("git:push", async (event, message) => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, output: "Папка с сайтом не выбрана." };

  const safeMessage = String(message || "Обновление ассортимента").replace(/"/g, "'");

  const add = await runGit(repoRoot, "add -A");
  if (!add.ok) return add;

  const commit = await runGit(repoRoot, `commit -m "${safeMessage}"`);
  if (!commit.ok) {
    if (/nothing to commit/i.test(commit.output)) {
      return { ok: true, output: "Изменений нет — публиковать нечего." };
    }
    return commit;
  }

  return runGit(repoRoot, "push");
});

ipcMain.handle("git:status", async () => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, output: "Папка с сайтом не выбрана." };
  return runGit(repoRoot, "status --short");
});

ipcMain.handle("app:getRepoRoot", () => getRepoRoot());

// ---------------- Предпросмотр сайта (локальный сервер) ----------------

ipcMain.handle("preview:open", async () => {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return { ok: false, error: "Папка с сайтом не выбрана." };
  try {
    const port = await startPreviewServer(repoRoot);
    const url = `http://127.0.0.1:${port}/`;
    shell.openExternal(url);
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err.message || "Не получилось открыть предпросмотр." };
  }
});

app.on("before-quit", () => {
  if (previewServer) previewServer.close();
});
