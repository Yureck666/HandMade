const CATEGORIES = [
  { key: "ukrasheniya", label: "Украшения" },
  { key: "igrushki", label: "Игрушки" },
  { key: "aksessuary", label: "Аксессуары" },
];

let products = [];
let editingId = null;
let pickedImagePath = null;
let clonedParentFolder = null;

const el = (id) => document.getElementById(id);

// ================= Запуск: выясняем, подключена ли папка с сайтом =================

async function init() {
  const state = await window.api.getSetupState();
  if (state.configured) {
    showMainScreen(state.repoRoot);
  } else {
    showSetupScreen();
  }
}

function showSetupScreen() {
  el("setupScreen").classList.remove("hidden");
  el("mainScreen").classList.add("hidden");
}

async function showMainScreen(repoRoot) {
  el("setupScreen").classList.add("hidden");
  el("mainScreen").classList.remove("hidden");
  el("repoPath").textContent = `Папка: ${repoRoot}`;
  await refreshList();
}

// ================= Экран настройки подключения =================

function setSetupError(text) {
  el("setupError").textContent = text || "";
}

el("btnChooseFolder").onclick = async () => {
  setSetupError("");
  const folder = await window.api.pickFolder("Выберите папку с сайтом");
  if (!folder) return;
  const res = await window.api.useExistingFolder(folder);
  if (res.ok) {
    await showMainScreen(res.repoRoot);
  } else {
    setSetupError(res.error);
  }
};

el("btnPickParent").onclick = async () => {
  const folder = await window.api.pickFolder("Куда сохранить сайт");
  if (!folder) return;
  clonedParentFolder = folder;
  el("cloneParent").value = folder;
};

el("btnClone").onclick = async () => {
  setSetupError("");
  const url = el("cloneUrl").value.trim();
  if (!url) {
    setSetupError("Вставьте ссылку на репозиторий.");
    return;
  }
  if (!clonedParentFolder) {
    setSetupError("Сначала выберите, куда сохранить.");
    return;
  }
  const btn = el("btnClone");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Скачиваю...";
  try {
    const res = await window.api.cloneRepo({ url, parentFolder: clonedParentFolder });
    if (res.ok) {
      await showMainScreen(res.repoRoot);
    } else {
      setSetupError(res.error);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
};

// ================= Настройки (⚙) =================

el("btnSettings").onclick = async () => {
  const [rootState, remoteRes] = await Promise.all([window.api.getSetupState(), window.api.getRemote()]);
  el("settingsRepoPath").value = rootState.repoRoot || "";
  el("settingsRemote").value = remoteRes.ok ? remoteRes.url : "";
  el("settingsStatus").textContent = "";
  el("settingsOverlay").classList.remove("hidden");
};

el("btnCloseSettings").onclick = () => el("settingsOverlay").classList.add("hidden");

el("btnChangeFolder").onclick = async () => {
  const folder = await window.api.pickFolder("Выберите папку с сайтом");
  if (!folder) return;
  const res = await window.api.useExistingFolder(folder);
  if (res.ok) {
    el("settingsRepoPath").value = res.repoRoot;
    el("settingsStatus").textContent = "Папка подключена.";
    await showMainScreen(res.repoRoot);
  } else {
    el("settingsStatus").textContent = res.error;
  }
};

el("btnSaveRemote").onclick = async () => {
  const url = el("settingsRemote").value.trim();
  if (!url) return;
  const res = await window.api.setRemote(url);
  el("settingsStatus").textContent = res.ok ? "Сохранено." : res.error;
};

el("btnTestConnection").onclick = async () => {
  const btn = el("btnTestConnection");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Проверяю...";
  el("settingsStatus").textContent = "Если потребуется — сейчас откроется окно входа в GitHub...";
  try {
    const res = await window.api.testConnection();
    el("settingsStatus").textContent = res.ok ? "Связь с GitHub есть, всё в порядке." : res.error;
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
};

// ================= Список товаров =================

async function refreshList() {
  const res = await window.api.listProducts();
  products = res.ok ? res.products : [];
  renderCategories();
}

function renderCategories() {
  const container = el("categories");
  container.innerHTML = "";
  for (const cat of CATEGORIES) {
    const section = document.createElement("section");
    section.className = "cat-section";

    const header = document.createElement("h2");
    header.textContent = cat.label;
    section.appendChild(header);

    const items = products
      .filter((p) => p.category === cat.key)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const list = document.createElement("div");
    list.className = "item-list";

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-hint";
      empty.textContent = "Пока ничего нет";
      list.appendChild(empty);
    } else {
      for (const p of items) list.appendChild(renderItemRow(p));
    }

    section.appendChild(list);
    container.appendChild(section);
  }
}

function renderItemRow(p) {
  const row = document.createElement("div");
  row.className = "item-row" + (p.visible === false ? " item-hidden" : "");

  const thumb = document.createElement("img");
  thumb.className = "item-thumb";
  thumb.src = p.imageUrl || "";
  thumb.alt = p.name || "";

  const info = document.createElement("div");
  info.className = "item-info";
  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = p.name || "(без названия)";
  const price = document.createElement("div");
  price.className = "item-price";
  price.textContent = p.price ? `${p.price} ₽` : "";
  info.append(name, price);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const btnVisible = document.createElement("button");
  btnVisible.className = "btn btn-ghost btn-small";
  btnVisible.textContent = p.visible === false ? "Показать" : "Скрыть";
  btnVisible.onclick = async () => {
    await window.api.setVisible(p.id, p.visible === false);
    await refreshList();
  };

  const btnEdit = document.createElement("button");
  btnEdit.className = "btn btn-ghost btn-small";
  btnEdit.textContent = "Изменить";
  btnEdit.onclick = () => openModal(p);

  const btnDelete = document.createElement("button");
  btnDelete.className = "btn btn-ghost btn-small btn-danger";
  btnDelete.textContent = "Удалить";
  btnDelete.onclick = async () => {
    if (confirm(`Удалить «${p.name}»? Карточка исчезнет с сайта (фото в папке останется).`)) {
      await window.api.deleteProduct(p.id);
      await refreshList();
    }
  };

  actions.append(btnVisible, btnEdit, btnDelete);
  row.append(thumb, info, actions);
  return row;
}

// ================= Модалка добавления/редактирования =================

function openModal(product) {
  editingId = product ? product.id : null;
  pickedImagePath = null;
  el("modalTitle").textContent = product ? "Изменить товар" : "Новый товар";
  el("fieldCategory").value = product?.category || CATEGORIES[0].key;
  el("fieldName").value = product?.name || "";
  el("fieldPrice").value = product?.price ?? "";
  el("fieldDescription").value = product?.description || "";

  const preview = el("photoPreview");
  if (product?.imageUrl) {
    preview.src = product.imageUrl;
    preview.classList.remove("empty");
  } else {
    preview.src = "";
    preview.classList.add("empty");
  }

  el("modalOverlay").classList.remove("hidden");
  el("fieldName").focus();
}

function closeModal() {
  el("modalOverlay").classList.add("hidden");
}

el("btnAdd").onclick = () => openModal(null);
el("btnCancel").onclick = closeModal;

el("btnPickPhoto").onclick = async () => {
  const filePath = await window.api.pickImage();
  if (!filePath) return;
  pickedImagePath = filePath;
  const url = await window.api.toFileUrl(filePath);
  const preview = el("photoPreview");
  preview.src = url;
  preview.classList.remove("empty");
};

el("productForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = el("fieldName").value.trim();
  if (!name) {
    alert("Введите название товара");
    return;
  }
  const product = {
    id: editingId,
    category: el("fieldCategory").value,
    name,
    price: el("fieldPrice").value ? Number(el("fieldPrice").value) : null,
    description: el("fieldDescription").value.trim(),
  };
  await window.api.saveProduct(product, pickedImagePath);
  closeModal();
  await refreshList();
};

el("modalOverlay").addEventListener("click", (e) => {
  if (e.target === el("modalOverlay")) closeModal();
});
el("settingsOverlay").addEventListener("click", (e) => {
  if (e.target === el("settingsOverlay")) el("settingsOverlay").classList.add("hidden");
});

// ================= Git: обновить / отправить =================

function setStatus(text, kind) {
  const bar = el("statusBar");
  bar.textContent = text;
  bar.className = "status-bar" + (kind ? ` status-${kind}` : "");
}

function logOutput(text) {
  const out = el("logOutput");
  const time = new Date().toLocaleTimeString("ru-RU");
  out.textContent += `[${time}] ${text}\n`;
  out.scrollTop = out.scrollHeight;
}

async function withBusyButton(button, label, fn) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    await fn();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

el("btnPull").onclick = () =>
  withBusyButton(el("btnPull"), "Обновляю...", async () => {
    setStatus("Получаю изменения с сайта...", "busy");
    const res = await window.api.gitPull();
    logOutput(res.output || "(пусто)");
    if (res.ok) {
      setStatus("Готово: подтянула свежие изменения", "ok");
    } else {
      setStatus("Не получилось обновить — смотри журнал ниже", "error");
      el("logPanel").open = true;
    }
    await refreshList();
  });

el("btnPush").onclick = () =>
  withBusyButton(el("btnPush"), "Отправляю...", async () => {
    setStatus("Отправляю изменения на сайт...", "busy");
    const message = `Обновление ассортимента — ${new Date().toLocaleString("ru-RU")}`;
    const res = await window.api.gitPush(message);
    logOutput(res.output || "(пусто)");
    if (res.ok) {
      setStatus("Готово: изменения отправлены на сайт", "ok");
    } else {
      setStatus("Не получилось отправить — смотри журнал ниже", "error");
      el("logPanel").open = true;
    }
  });

init();
