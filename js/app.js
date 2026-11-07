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

// Без этого <video> показывает чёрный прямоугольник до запуска по двум причинам:
// 1) самый первый кадр записи часто и сам тёмный/чёрный (камера телефона ещё
//    не успела навестись), поэтому для обложки берём кадр чуть позже начала;
// 2) браузер реально красит этот кадр только когда видео хоть мгновение
//    проиграло — поэтому незаметно запускаем его (оно приглушено, так что
//    авто-запуск разрешён без клика пользователя) и останавливаем не сразу,
//    а когда он подтвердит, что кадр реально отрисован.
const VIDEO_POSTER_OFFSET = 0.4;

function ensureVideoFirstFrame(video) {
  const pauseAfterFramePainted = () => {
    let stopped = false;
    const stop = () => {
      // Если пользователь уже сам нажал "play" — не трогаем его просмотр.
      if (stopped || video.dataset.userControlled) return;
      stopped = true;
      video.pause();
    };
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(stop);
      // Страховка: если обработчик кадра по какой-то причине не сработал
      // (например, вкладка свёрнута), всё равно останавливаем видео.
      setTimeout(stop, 500);
    } else {
      // Нет requestVideoFrameCallback — даём видео чуть поиграть, чтобы
      // декодер успел подготовить и показать кадр, и только потом стопим.
      setTimeout(stop, 200);
    }
  };

  const showFrame = () => {
    const duration = video.duration;
    const offset = duration && Number.isFinite(duration) ? Math.min(VIDEO_POSTER_OFFSET, duration / 2) : VIDEO_POSTER_OFFSET;
    try {
      if (offset > 0) video.currentTime = offset;
    } catch {
      // игнорируем — например, видео ещё не готово к перемотке
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.then(pauseAfterFramePainted).catch(() => {});
    } else {
      pauseAfterFramePainted();
    }
  };

  if (video.readyState >= 1) showFrame();
  else video.addEventListener("loadedmetadata", showFrame, { once: true });
}

// Карточки без "media" (старые товары) показывают единственное фото из "image".
function getProductMedia(product) {
  if (Array.isArray(product.media) && product.media.length > 0) return product.media;
  if (product.image) return [{ type: "image", src: product.image }];
  return [];
}

function createMediaSlide(item) {
  const slide = document.createElement("div");
  slide.className = "media-slide";

  if (item.type === "video") {
    const video = document.createElement("video");
    video.src = item.src;
    video.muted = true;
    video.playsInline = true;
    if (item.poster) {
      // Есть готовое превью, выбранное в админке, — браузер покажет его сам
      // через атрибут poster, подбирать кадр через JS не нужно.
      video.poster = item.poster;
      video.preload = "metadata";
    } else {
      video.preload = "auto";
    }
    const playBadge = document.createElement("span");
    playBadge.className = "play-badge";
    playBadge.setAttribute("aria-hidden", "true");
    playBadge.textContent = "▶";
    slide.append(video, playBadge);
  } else {
    const img = document.createElement("img");
    img.src = item.src;
    img.alt = "";
    img.loading = "lazy";
    slide.appendChild(img);
  }

  return slide;
}

const DESCRIPTION_LIMIT = 100;

function appendDescription(desc, text) {
  if (text.length <= DESCRIPTION_LIMIT) {
    desc.textContent = text;
    return;
  }

  let cutAt = text.lastIndexOf(" ", DESCRIPTION_LIMIT);
  if (cutAt <= 0) cutAt = DESCRIPTION_LIMIT;
  const truncated = text.slice(0, cutAt).trimEnd() + "…";

  const textSpan = document.createElement("span");
  textSpan.className = "description-text";
  textSpan.textContent = truncated;

  const toggle = document.createElement("a");
  toggle.href = "#";
  toggle.className = "description-toggle";
  toggle.textContent = "Развернуть";

  let expanded = false;
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    expanded = !expanded;
    textSpan.textContent = expanded ? text : truncated;
    toggle.textContent = expanded ? "Скрыть" : "Развернуть";
  });

  desc.append(textSpan, " ", toggle);
}

function renderCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const media = getProductMedia(product);
  const photo = document.createElement("div");
  photo.className = "product-photo";

  const slides = media.map(createMediaSlide);
  slides.forEach((slide, i) => slide.classList.toggle("active", i === 0));
  const track = document.createElement("div");
  track.className = "carousel-track";
  slides.forEach((slide) => track.appendChild(slide));
  photo.appendChild(track);

  // Пока слайд скрыт (не active), браузер часто не рисует кадр видео даже
  // после play()+pause() — поэтому "показываем" кадр только когда слайд
  // реально становится видимым, а не заранее для всех слайдов сразу.
  function primeSlideVideo(slide) {
    const video = slide.querySelector("video");
    if (video && !video.poster && !video.dataset.primed) {
      video.dataset.primed = "1";
      ensureVideoFirstFrame(video);
    }
  }
  primeSlideVideo(slides[0]);

  let current = 0;
  let dots = [];

  function showSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle("active", i === current));
    dots.forEach((dot, i) => dot.classList.toggle("active", i === current));
    primeSlideVideo(slides[current]);
  }

  if (media.length > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "carousel-arrow carousel-prev";
    prevBtn.setAttribute("aria-label", "Предыдущее фото");
    prevBtn.textContent = "‹";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showSlide(current - 1);
    });

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "carousel-arrow carousel-next";
    nextBtn.setAttribute("aria-label", "Следующее фото");
    nextBtn.textContent = "›";
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showSlide(current + 1);
    });

    const dotsWrap = document.createElement("div");
    dotsWrap.className = "carousel-dots";
    dots = media.map((_, i) => {
      const dot = document.createElement("span");
      dot.className = "carousel-dot" + (i === 0 ? " active" : "");
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        showSlide(i);
      });
      dotsWrap.appendChild(dot);
      return dot;
    });

    photo.append(prevBtn, nextBtn, dotsWrap);
  }

  if (media.length > 0) {
    photo.classList.add("product-photo-clickable");
    photo.addEventListener("click", () => openLightbox(media, current));
  }

  const body = document.createElement("div");
  body.className = "product-body";

  const name = document.createElement("h3");
  name.textContent = product.name || "";

  const price = document.createElement("p");
  price.className = "price";
  price.textContent = formatPrice(product.price);

  const desc = document.createElement("p");
  desc.className = "description";
  appendDescription(desc, product.description || "");

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

// ================= Оверлей (лайтбокс) для фото и видео =================

let lightboxMedia = [];
let lightboxIndex = 0;

function renderLightboxSlide() {
  const content = document.getElementById("lightboxContent");
  if (!content) return;
  content.innerHTML = "";
  const item = lightboxMedia[lightboxIndex];
  if (!item) return;

  if (item.type === "video") {
    const video = document.createElement("video");
    video.src = item.src;
    video.playsInline = true;
    video.controls = false;
    if (item.poster) {
      video.poster = item.poster;
      video.preload = "metadata";
    } else {
      video.preload = "auto";
      ensureVideoFirstFrame(video);
    }

    const playBadge = document.createElement("button");
    playBadge.type = "button";
    playBadge.className = "play-badge play-badge-lightbox";
    playBadge.setAttribute("aria-label", "Воспроизвести видео");
    playBadge.textContent = "▶";

    const togglePlay = () => {
      video.dataset.userControlled = "1";
      if (video.paused) video.play();
      else video.pause();
    };
    video.addEventListener("click", togglePlay);
    playBadge.addEventListener("click", togglePlay);
    video.addEventListener("play", () => playBadge.classList.add("hidden"));
    video.addEventListener("pause", () => playBadge.classList.remove("hidden"));
    video.addEventListener("ended", () => playBadge.classList.remove("hidden"));

    content.append(video, playBadge);
  } else {
    const img = document.createElement("img");
    img.src = item.src;
    img.alt = "";
    content.appendChild(img);
  }

  renderLightboxDots();
  const multi = lightboxMedia.length > 1;
  document.querySelector(".lightbox-prev")?.classList.toggle("hidden", !multi);
  document.querySelector(".lightbox-next")?.classList.toggle("hidden", !multi);
}

function renderLightboxDots() {
  const dotsWrap = document.getElementById("lightboxDots");
  if (!dotsWrap) return;
  dotsWrap.innerHTML = "";
  if (lightboxMedia.length <= 1) return;
  lightboxMedia.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "carousel-dot" + (i === lightboxIndex ? " active" : "");
    dot.addEventListener("click", () => showLightboxSlide(i));
    dotsWrap.appendChild(dot);
  });
}

function showLightboxSlide(index) {
  lightboxIndex = (index + lightboxMedia.length) % lightboxMedia.length;
  renderLightboxSlide();
}

function openLightbox(media, startIndex) {
  if (!media.length) return;
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  lightboxMedia = media;
  lightboxIndex = startIndex;
  lightbox.classList.remove("hidden");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
  renderLightboxSlide();
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  lightbox.querySelector("video")?.pause();
  lightbox.classList.add("hidden");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");
}

function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  lightbox.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);
  lightbox.querySelector(".lightbox-prev")?.addEventListener("click", () => showLightboxSlide(lightboxIndex - 1));
  lightbox.querySelector(".lightbox-next")?.addEventListener("click", () => showLightboxSlide(lightboxIndex + 1));
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (lightbox.classList.contains("hidden")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showLightboxSlide(lightboxIndex - 1);
    if (e.key === "ArrowRight") showLightboxSlide(lightboxIndex + 1);
  });
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

function renderHero(site) {
  const el = document.getElementById("heroText");
  if (!el || !site || !site.heroText) return;
  el.textContent = site.heroText;
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
  const [categories, products, contacts, site] = await Promise.all([
    loadJson("data/categories.json"),
    loadJson("data/products.json"),
    loadJson("data/contacts.json"),
    loadJson("data/site.json"),
  ]);

  const categoryList = Array.isArray(categories) ? categories : [];
  const productList = Array.isArray(products) ? products : [];
  const contactList = Array.isArray(contacts) ? contacts : [];

  const whatsapp = contactList.find((c) => c.id === "whatsapp" && c.enabled && c.value);
  whatsappNumber = whatsapp ? whatsapp.value.replace(/\D/g, "") : "";

  renderHero(site);
  renderNav(categoryList);
  renderCategorySections(categoryList, productList);
  renderContacts(contactList);
}

document.addEventListener("DOMContentLoaded", () => {
  initLightbox();
  loadProducts();
});
