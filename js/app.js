// Способы связи: id из data/contacts.json → как показать кнопку и как
// собрать ссылку из сырого значения (номер/логин), которое вводит админка.
const CONTACT_TYPES = {
  whatsapp: {
    label: "WhatsApp",
    cssClass: "btn-whatsapp",
    buildUrl: (value) => `https://wa.me/${value.replace(/\D/g, "")}`,
  },
  telegram: {
    label: "Telegram",
    cssClass: "btn-telegram",
    buildUrl: (value) => `https://t.me/${value.replace(/^@/, "")}`,
  },
  vk: {
    label: "VK",
    cssClass: "btn-vk",
    buildUrl: (value) => `https://vk.com/${value.replace(/^@/, "")}`,
  },
  max: {
    label: "MAX",
    cssClass: "btn-max",
    buildUrl: (value) => `https://max.ru/${value.replace(/^@/, "")}`,
  },
};

let whatsappNumber = "";

function askLink(productName) {
  if (!whatsappNumber) return "#contacts";
  const text = encodeURIComponent(`Здравствуйте! Интересует «${productName}»`);
  return `https://wa.me/${whatsappNumber}?text=${text}`;
}

function formatPrice(price) {
  if (price === null || price === undefined || price === "") return "";
  const num = Number(price);
  if (Number.isNaN(num)) return String(price);
  return num.toLocaleString("ru-RU") + " ₽";
}

function renderCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const photo = document.createElement("div");
  photo.className = "product-photo";
  const img = document.createElement("img");
  img.src = product.image || "";
  img.alt = product.name || "";
  img.loading = "lazy";
  photo.appendChild(img);

  const body = document.createElement("div");
  body.className = "product-body";

  const name = document.createElement("h3");
  name.textContent = product.name || "";

  const price = document.createElement("p");
  price.className = "price";
  price.textContent = formatPrice(product.price);

  const desc = document.createElement("p");
  desc.className = "description";
  desc.textContent = product.description || "";

  const ask = document.createElement("a");
  ask.className = "btn btn-ask";
  ask.href = askLink(product.name || "");
  ask.target = "_blank";
  ask.rel = "noopener";
  ask.textContent = "Спросить";

  body.append(name, price, desc, ask);
  card.append(photo, body);
  return card;
}

function renderEmptyNote(text) {
  const note = document.createElement("p");
  note.className = "empty-note";
  note.textContent = text;
  return note;
}

async function loadJson(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    return await res.json();
  } catch (err) {
    console.error(`Не удалось загрузить ${path}:`, err);
    return [];
  }
}

function renderNav(categories) {
  const nav = document.getElementById("mainNav");
  if (!nav) return;
  nav.innerHTML = "";
  for (const cat of categories) {
    const link = document.createElement("a");
    link.href = `#${cat.id}`;
    link.textContent = cat.label || cat.id;
    nav.appendChild(link);
  }
}

function renderCategorySections(categories, products) {
  const root = document.getElementById("categoriesRoot");
  if (!root) return;
  root.innerHTML = "";

  const visible = products.filter((p) => p.visible !== false);

  categories.forEach((cat, index) => {
    if (index > 0) {
      const divider = document.createElement("div");
      divider.className = "stitch-divider";
      divider.setAttribute("aria-hidden", "true");
      root.appendChild(divider);
    }

    const section = document.createElement("section");
    section.className = "category";
    section.id = cat.id;
    section.dataset.category = cat.id;

    const header = document.createElement("div");
    header.className = "category-header";
    const h2 = document.createElement("h2");
    h2.textContent = cat.label || cat.id;
    header.appendChild(h2);
    if (cat.caption) {
      const caption = document.createElement("p");
      caption.className = "category-caption";
      caption.textContent = cat.caption;
      header.appendChild(caption);
    }

    const grid = document.createElement("div");
    grid.className = "products-grid";
    grid.id = `grid-${cat.id}`;

    const items = visible
      .filter((p) => p.category === cat.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (items.length === 0) {
      grid.appendChild(renderEmptyNote("Скоро здесь появятся новые работы"));
    } else {
      for (const product of items) grid.appendChild(renderCard(product));
    }

    section.append(header, grid);
    root.appendChild(section);
  });
}

function renderContacts(contacts) {
  const container = document.getElementById("contactButtons");
  if (!container) return;
  container.innerHTML = "";
  for (const c of contacts) {
    if (!c.enabled || !c.value) continue;
    const type = CONTACT_TYPES[c.id];
    if (!type) continue;
    const link = document.createElement("a");
    link.href = type.buildUrl(c.value);
    link.className = `btn btn-contact ${type.cssClass}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = type.label;
    container.appendChild(link);
  }
}

async function loadProducts() {
  const [categories, products, contacts] = await Promise.all([
    loadJson("data/categories.json"),
    loadJson("data/products.json"),
    loadJson("data/contacts.json"),
  ]);

  const categoryList = Array.isArray(categories) ? categories : [];
  const productList = Array.isArray(products) ? products : [];
  const contactList = Array.isArray(contacts) ? contacts : [];

  const whatsapp = contactList.find((c) => c.id === "whatsapp" && c.enabled && c.value);
  whatsappNumber = whatsapp ? whatsapp.value.replace(/\D/g, "") : "";

  renderNav(categoryList);
  renderCategorySections(categoryList, productList);
  renderContacts(contactList);
}

document.addEventListener("DOMContentLoaded", loadProducts);
