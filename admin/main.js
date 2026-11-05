const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const { pathToFileURL } = require("url");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

function getRepoRoot() {
  // Собранный .exe лежит прямо в корне клона репозитория — поэтому
  // корень репозитория это папка, где находится сам исполняемый файл.
  if (app.isPackaged) {
    return path.dirname(app.getPath("exe"));
  }
  // В режиме разработки admin/ лежит внутри корня репозитория.
  return path.resolve(__dirname, "..");
}

const REPO_ROOT = getRepoRoot();
const DATA_FILE = path.join(REPO_ROOT, "data", "products.json");
const IMAGES_DIR = path.join(REPO_ROOT, "images");

function readProducts() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeProducts(products) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2) + "\n", "utf-8");
}

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

// ---------------- Products ----------------

ipcMain.handle("products:list", () => {
  const products = readProducts();
  return products.map((p) => ({
    ...p,
    imageUrl: p.image ? pathToFileURL(path.join(REPO_ROOT, p.image)).href : null,
  }));
});

ipcMain.handle("products:save", (event, product, newImagePath) => {
  const products = readProducts();
  let entry = products.find((p) => p.id === product.id);
  const isNew = !entry;

  if (isNew) {
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
    const destDir = path.join(IMAGES_DIR, entry.category);
    fs.mkdirSync(destDir, { recursive: true });
    const destFile = path.join(destDir, `${entry.id}${ext}`);
    fs.copyFileSync(newImagePath, destFile);
    entry.image = `images/${entry.category}/${entry.id}${ext}`;
  }

  writeProducts(products);
  return { ...entry, imageUrl: entry.image ? pathToFileURL(path.join(REPO_ROOT, entry.image)).href : null };
});

ipcMain.handle("products:delete", (event, id) => {
  const products = readProducts();
  const next = products.filter((p) => p.id !== id);
  writeProducts(next);
  return true;
});

ipcMain.handle("products:setVisible", (event, id, visible) => {
  const products = readProducts();
  const entry = products.find((p) => p.id === id);
  if (entry) entry.visible = visible;
  writeProducts(products);
  return true;
});

// ---------------- Files / dialogs ----------------

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

// ---------------- Git ----------------

function runGit(args) {
  return execAsync(`git ${args}`, { cwd: REPO_ROOT, windowsHide: true }).then(
    ({ stdout, stderr }) => ({ ok: true, output: [stdout, stderr].filter(Boolean).join("\n").trim() }),
    (err) => ({ ok: false, output: (err.stderr || err.message || "").trim() })
  );
}

ipcMain.handle("git:pull", async () => runGit("pull"));

ipcMain.handle("git:push", async (event, message) => {
  const safeMessage = String(message || "Обновление ассортимента").replace(/"/g, "'");

  const add = await runGit("add -A");
  if (!add.ok) return add;

  const commit = await runGit(`commit -m "${safeMessage}"`);
  if (!commit.ok) {
    if (/nothing to commit/i.test(commit.output)) {
      return { ok: true, output: "Изменений нет — публиковать нечего." };
    }
    return commit;
  }

  const push = await runGit("push");
  return push;
});

ipcMain.handle("git:status", async () => runGit("status --short"));

ipcMain.handle("app:getRepoRoot", () => REPO_ROOT);
