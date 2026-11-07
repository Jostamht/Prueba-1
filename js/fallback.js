// Versión simplificada: la misma invitación como página normal (sin WebGL). Se usa si el dispositivo
// no soporta 3D o si se abre con ?simple en la dirección.
import { countdownParts } from './cards.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function blockHTML(b, data) {
  switch (b.type) {
    case 'eyebrow': return `<p class="s-eyebrow">${esc(b.text)}</p>`;
    case 'title': return `<h2 class="s-title">${esc(b.text)}</h2>`;
    case 'heading': return `<h3>${esc(b.text)}</h3>`;
    case 'text': return `<p class="s-text${b.italic ? ' it' : ''}">${esc(b.text)}</p>`;
    case 'ornament': return '<div class="s-orn" aria-hidden="true"><i></i></div>';
    case 'list': return `<dl class="s-list">${b.rows.map((r) => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl>`;
    case 'kv': return `<p class="s-kv"><small>${esc(b.label)}</small><strong>${esc(b.value)}</strong></p>`;
    case 'button': {
      const a = b.action || {};
      if (a.url) return `<a class="btn${b.style === 'secondary' ? ' btn--ghost' : ''}" href="${esc(data.enlaces[a.url] || a.url)}" target="_blank" rel="noopener">${esc(b.label)}</a>`;
      return `<button class="btn${b.style === 'secondary' ? ' btn--ghost' : ''}" data-action="${a.rsvp ? 'rsvp' : 'whatsapp'}">${esc(b.label)}</button>`;
    }
    case 'countdown': return '<p class="s-count" data-count></p>';
    case 'image': return `<img class="s-qr" src="${esc(b.src)}" alt="Código QR para depósito" width="220" height="220">`;
    default: return '';
  }
}

export function buildFallback(data, { onAction } = {}) {
  document.body.classList.add('is-simple');
  const date = new Date(data.meta.fecha);
  const main = document.createElement('main'); main.className = 'simple';
  main.innerHTML = data.spreads.map((s, i) => `
    <section class="s-sec" aria-label="${esc(s.titulo)}">
      <img class="s-art" src="${esc(s.art)}" alt="" loading="${i ? 'lazy' : 'eager'}">
      <div class="s-card">${s.card.blocks.map((b) => blockHTML(b, data)).join('')}</div>
    </section>`).join('');
  document.body.appendChild(main);
  main.addEventListener('click', (e) => { const b = e.target.closest('[data-action]'); if (b) onAction?.({ [b.dataset.action]: true }); });
  const counters = main.querySelectorAll('[data-count]');
  const tick = () => {
    const p = countdownParts(date);
    counters.forEach((c) => { c.textContent = p ? `Faltan ${p.d} días, ${p.h} h, ${p.m} min y ${p.s} s` : data.meta.expiradoTexto; });
  };
  tick(); setInterval(tick, 1000);
}
