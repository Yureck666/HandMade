const CATEGORIES = {
  ukrasheniya: { label: "Украшения", badgeClass: "badge-ukrasheniya" },
  igrushki: { label: "Игрушки", badgeClass: "badge-igrushki" },
  aksessuary: { label: "Аксессуары", badgeClass: "badge-aksessuary" },
};

const WHATSAPP_NUMBER = "70000000000"; // TODO: заменить на реальный номер

function askLink(productName) {
  const text = encodeURIComponent(`Здравствуйте! Интересует «${productName}»`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
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

async function loadProducts() {
  let products = [];
  try {
    const res = await fetch("data/products.json", { cache: "no-store" });
    products = await res.json();
  } catch (err) {
    console.error("Не удалось загрузить товары:", err);
    products = [];
  }

  const visible = products.filter((p) => p.visible !== false);

  for (const key of Object.keys(CATEGORIES)) {
    const grid = document.getElementById(`grid-${key}`);
    if (!grid) continue;

    const items = visible
      .filter((p) => p.category === key)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    grid.innerHTML = "";
    if (items.length === 0) {
      grid.appendChild(renderEmptyNote("Скоро здесь появятся новые работы"));
      continue;
    }
    for (const product of items) {
      grid.appendChild(renderCard(product));
    }
  }
}

document.addEventListener("DOMContentLoaded", loadProducts);
