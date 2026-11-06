(function () {
  const C = window.SITE_CONFIG;
  if (!C) return;

  /* ---------- Utilidades ---------- */
  const $  = (s, r = document) => r.querySelector(s);
  const PH = /\[[A-Z0-9_ÁÉÍÓÚÑ]+\]/;

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  /** Escapa y marca visualmente los placeholders */
  const txt = (v) => {
    const s = String(v ?? "");
    if (!s) return "";
    return s.split(/(\[[A-Z0-9_ÁÉÍÓÚÑ]+\])/g)
      .map(part => PH.test(part) && /^\[.*\]$/.test(part)
        ? `<span class="ph">${esc(part)}</span>`
        : esc(part))
      .join("");
  };

  const isPH = (v) => !v || PH.test(String(v));
  const on   = (k) => !!(C.sections[k] && C.sections[k].enabled);

  /* ---------- Tema ---------- */
  function applyTheme() {
    const r = document.documentElement.style;
    Object.entries(C.theme.colors).forEach(([k, v]) =>
      r.setProperty(`--c-${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`, v));
    r.setProperty("--font-heading", C.theme.fonts.heading);
    r.setProperty("--font-body", C.theme.fonts.body);
    document.documentElement.lang = C.meta.lang || "es";
    document.title = C.meta.title || "Invitación";
    const d = $('meta[name="description"]');
    if (d) d.setAttribute("content", C.meta.description || "");
  }

  /* ---------- Nav ---------- */
  function renderNav() {
    const nav = $("#site-nav");
    if (!nav) return;
    const items = C.nav.filter(i => on(i.key || i.id));
    if (!items.length) { nav.hidden = true; return; }
    nav.hidden = false;
    nav.innerHTML = `
      <nav class="nav" aria-label="Navegación principal">
        <ul class="nav__list">
          ${items.map(i => `<li><a href="#${esc(i.id)}">${txt(i.label)}</a></li>`).join("")}
        </ul>
      </nav>`;
  }

  /* ---------- Hero (opcional) ---------- */
  function renderHero() {
    const hero = $("#hero");
    if (!hero || !C.hero || !C.hero.enabled) { if (hero) hero.hidden = true; return; }
    hero.hidden = false;
    hero.innerHTML = `
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero__book" id="popup-book" aria-hidden="true"></div>
        <div class="hero__text">
          <p class="eyebrow">${txt(C.hero.eyebrow)}</p>
          <h1 id="hero-title">${txt(C.hero.title)}</h1>
          <p class="hero__sub">${txt(C.hero.subtitle)}</p>
          <button class="btn btn--primary" id="hero-open" type="button">
            ${txt(C.hero.buttonLabel)}
          </button>
        </div>
      </section>`;
  }

  /* ---------- Secciones ---------- */
  function section(id, label, inner) {
    return `<section class="section" id="${id}" aria-labelledby="${id}-t">
      <div class="section__inner">
        ${label ? `<h2 class="section__title" id="${id}-t">${txt(label)}</h2>` : ""}
        ${inner}
      </div>
    </section>`;
  }

  const S = {
    welcome() {
      const s = C.sections.welcome;
      const h = C.hero && C.hero.enabled ? "h2" : "h1";
      return `<section class="section section--welcome" id="bienvenida">
        <div class="section__inner paper-card">
          <${h} class="welcome__title">${txt(s.title)}</${h}>
          <p class="welcome__phrase">${txt(s.phrase)}</p>
          <p class="welcome__names">${txt(s.names)}</p>
        </div>
      </section>`;
    },

    date() {
      const s = C.sections.date;
      return section("fecha", s.title, `
        <div class="date-block paper-card">
          <span class="date-block__weekday">${txt(s.weekday)}</span>
          <span class="date-block__day">${txt(s.day)}</span>
          <span class="date-block__month">${txt(s.month)} ${txt(s.year)}</span>
        </div>
        <p class="center"><a class="btn btn--ghost" href="${esc(s.ctaTarget)}">${txt(s.ctaLabel)}</a></p>
      `);
    },

    saveTheDate() {
      const s = C.sections.saveTheDate;
      const year  = parseInt(s.year, 10);
      const month = parseInt(s.month, 10);
      const day   = parseInt(s.highlightDay, 10);
      return section("savedate", s.title, `
        ${calendarHTML(year, month, day)}
        <p class="center muted">${txt(s.caption)}</p>
      `);
    },

    families() {
      const s = C.sections.families;
      return section("familias", s.title, `
        <div class="grid grid--2">
          ${s.groups.map(g => `
            <div class="paper-card mini">
              <h3>${txt(g.label)}</h3>
              <ul class="plain">
                ${g.names.map(n => `<li>${txt(n)}</li>`).join("")}
              </ul>
            </div>`).join("")}
        </div>`);
    },

    countdown() {
      const s = C.sections.countdown;
      return section("cuenta", s.title, `
        <div class="countdown" id="countdown" role="timer">
          ${["días", "horas", "min", "seg"].map(u =>
            `<div class="countdown__unit"><span class="countdown__num">--</span><span class="countdown__lbl">${u}</span></div>`
          ).join("")}
        </div>
        <p class="center muted" id="countdown-note"></p>`);
    },

    ceremony() {
      const s = C.sections.ceremony;
      return section("ceremonia", s.title, `
        <div class="grid grid--2">
          ${s.items.map(it => `
            <article class="paper-card">
              <h3 class="card__kind">${txt(it.kind)}</h3>
              <dl class="facts">
                <dt>Hora</dt><dd>${txt(it.time)}</dd>
                <dt>Lugar</dt><dd>${txt(it.place)}</dd>
                <dt>Dirección</dt><dd>${txt(it.address)}</dd>
              </dl>
              ${isPH(it.mapUrl) ? "" :
                `<a class="btn btn--ghost" href="${esc(it.mapUrl)}" target="_blank" rel="noopener">Ver mapa</a>`}
            </article>`).join("")}
        </div>`);
    },

    dressCode() {
      const s = C.sections.dressCode;
      return section("vestimenta", s.title, `
        <p class="center lead">${txt(s.general)}</p>
        <div class="grid grid--2">
          <div class="paper-card mini"><h3>Ellas</h3><p>${txt(s.her)}</p></div>
          <div class="paper-card mini"><h3>Ellos</h3><p>${txt(s.him)}</p></div>
        </div>`);
    },

    timeline() {
      const s = C.sections.timeline;
      return section("cronograma", s.title, `
        <ol class="timeline">
          ${s.items.map(i => `
            <li class="timeline__item">
              <span class="timeline__time">${txt(i.time)}</span>
              <span class="timeline__label">${txt(i.label)}</span>
            </li>`).join("")}
        </ol>`);
    },

    gallery() {
      const s = C.sections.gallery;
      return section("galeria", s.title, `
        <div class="gallery">
          ${s.photos.map(p => `
            <figure class="gallery__item">
              ${isPH(p.src)
                ? `<div class="gallery__ph" role="img" aria-label="${esc(p.alt)}"></div>`
                : `<img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async">`}
            </figure>`).join("")}
        </div>`);
    },

    gifts() {
      const s = C.sections.gifts;
      return section("regalos", s.title, `
        <div class="paper-card center-card">
          <p class="lead">${txt(s.message)}</p>
          <p>${txt(s.note)}</p>
          ${isPH(s.qrImage) ? "" :
            `<img class="qr" src="${esc(s.qrImage)}" alt="Código QR de mesa de regalos" loading="lazy">`}
          ${isPH(s.linkUrl) ? "" :
            `<p><a class="btn btn--primary" href="${esc(s.linkUrl)}" target="_blank" rel="noopener">${txt(s.linkLabel)}</a></p>`}
        </div>`);
    },

    streaming() {
      const s = C.sections.streaming;
      return section("streaming", s.title, `
        <div class="paper-card center-card">
          <dl class="facts facts--center">
            <dt>Hora</dt><dd>${txt(s.time)}</dd>
            <dt>ID de reunión</dt><dd>${txt(s.meetingId)}</dd>
            <dt>Contraseña</dt><dd>${txt(s.passcode)}</dd>
          </dl>
          ${isPH(s.url) ? "" :
            `<a class="btn btn--primary" href="${esc(s.url)}" target="_blank" rel="noopener">${txt(s.urlLabel)}</a>`}
        </div>`);
    },

    rsvp() {
      const s = C.sections.rsvp;
      return section("rsvp", s.title, `
        <div class="paper-card center-card">
          <p class="lead">${txt(s.message)}</p>
          ${isPH(s.url)
            ? `<span class="btn btn--primary is-disabled" aria-disabled="true">${txt(s.buttonLabel)}</span>`
            : `<a class="btn btn--primary" href="${esc(s.url)}" target="_blank" rel="noopener">${txt(s.buttonLabel)}</a>`}
        </div>`);
    }
  };

  /* ---------- Calendario ---------- */
  function calendarHTML(year, month, day) {
    const valid = Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12;
    const y = valid ? year : 2026;
    const m = valid ? month - 1 : 5;
    const first = new Date(y, m, 1);
    const start = first.getDay();               // 0 = domingo
    const days  = new Date(y, m + 1, 0).getDate();
    const names = ["enero","febrero","marzo","abril","mayo","junio",
                   "julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const heads = ["D","L","M","M","J","V","S"];

    let cells = "";
    for (let i = 0; i < start; i++) cells += `<span class="cal__cell is-empty"></span>`;
    for (let d = 1; d <= days; d++) {
      const hit = Number.isFinite(day) && d === day;
      cells += `<span class="cal__cell${hit ? " is-marked" : ""}"${hit ? ' aria-current="date"' : ""}>${d}</span>`;
    }

    return `<div class="paper-card cal">
      <p class="cal__title">${valid ? names[m] : "[MES]"} ${valid ? y : "[AÑO]"}</p>
      <div class="cal__heads" aria-hidden="true">
        ${heads.map(h => `<span class="cal__head">${h}</span>`).join("")}
      </div>
      <div class="cal__grid" role="group" aria-label="Calendario del evento">${cells}</div>
    </div>`;
  }

  /* ---------- Cuenta regresiva ---------- */
  function initCountdown() {
    const box = $("#countdown");
    if (!box) return;
    const note = $("#countdown-note");
    const iso = C.event.dateTimeISO;

    if (isPH(iso)) {
      box.innerHTML = `<p class="ph-block">[CUENTA_REGRESIVA — define event.dateTimeISO]</p>`;
      return;
    }
    const target = new Date(iso).getTime();
    if (Number.isNaN(target)) { box.innerHTML = `<p class="ph-block">[FECHA INVÁLIDA]</p>`; return; }

    const nums = [...box.querySelectorAll(".countdown__num")];
    const pad = (n) => String(n).padStart(2, "0");

    let timer;

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        nums.forEach(n => n.textContent = "00");
        if (note) note.textContent = C.sections.countdown.expiredText || "";
        clearInterval(timer);
        return;
      }
      const s = Math.floor(diff / 1000);
      const vals = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
      nums.forEach((n, i) => n.textContent = i === 0 ? String(vals[i]) : pad(vals[i]));
    }
    tick();
    timer = setInterval(tick, 1000);
  }

  /* ---------- Render ---------- */
  function renderMain() {
    const main = $("#main");
    if (!main) return;
    const order = ["welcome","date","saveTheDate","families","countdown",
                   "ceremony","dressCode","timeline","gallery","gifts",
                   "streaming","rsvp"];
    const html = order
      .filter(k => on(k) && S[k])
      .map(k => S[k]())
      .join("");
    main.innerHTML = html || `<section class="section"><p class="ph-block">[SIN SECCIONES ACTIVAS]</p></section>`;
  }

  function renderClosing() {
    const foot = $("#site-footer");
    if (!foot || !on("closing")) return;
    const s = C.sections.closing;
    foot.hidden = false;
    foot.innerHTML = `
      <div class="closing">
        <p class="closing__msg">${txt(s.message)}</p>
        <p class="closing__names">${txt(s.names)}</p>
        <p class="closing__date">${txt(s.date)}</p>
      </div>`;
  }

  /* ---------- Arranque ---------- */
  function init() {
    applyTheme();
    renderHero();
    renderNav();
    renderMain();
    renderClosing();
    initCountdown();

    // El botón del hero hace scroll a la bienvenida (o a la primera sección)
    const openBtn = $("#hero-open");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        const go = () => {
          const target = document.getElementById("bienvenida")
            || document.querySelector(".section");
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        // Con el libro 3D, espera a que termine de abrirse antes de bajar
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const has3D  = C.hero.type === "popup-book";
        setTimeout(go, reduce || !has3D ? 0 : 1100);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();