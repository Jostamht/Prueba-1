import { Book } from './book.js';
import { loadFonts } from './cards.js';
import { openRSVP } from './rsvp.js';
import { buildFallback } from './fallback.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function main() {
  const res = await fetch('data/book.json');
  const data = await res.json();
  document.title = data.meta.title;

  const handleAction = (a) => {
    if (!a) return;
    if (a.url) window.open(data.enlaces[a.url] || a.url, '_blank', 'noopener');
    else if (a.rsvp) openRSVP(data);
    else if (a.whatsapp) {
      const nombre = prompt('¿Cuál es tu nombre?') || '';
      const msg = encodeURIComponent(data.whatsapp.mensaje.replace('{nombre}', nombre));
      window.open(`https://wa.me/${data.whatsapp.telefono || ''}?text=${msg}`, '_blank', 'noopener');
    }
  };

  const goSimple = () => { $('loader').hidden = true; buildFallback(data, { onAction: handleAction }); };
  if (params.has('simple') || !hasWebGL()) return goSimple();

  await loadFonts();
  const live = $('live'), counter = $('counter'), dots = $('dots'), hint = $('hint');
  const n = data.spreads.length;
  dots.innerHTML = '<i></i>'.repeat(n);

  // música (solo suena tras tocar "Abrir invitación")
  const audio = new Audio(data.musica); audio.loop = true; audio.volume = 0.6; audio.preload = 'none';
  let muted = false, started = false;
  const mute = $('muteBtn');
  const syncAudio = () => { if (!started) return; if (muted || document.hidden) audio.pause(); else audio.play().catch(() => {}); };
  mute.addEventListener('click', () => { muted = !muted; mute.setAttribute('aria-pressed', String(muted)); mute.setAttribute('aria-label', muted ? 'Activar música' : 'Silenciar música'); syncAudio(); });
  document.addEventListener('visibilitychange', syncAudio);

  let portrait = false, isOpen = false;
  const readBtn = $('readBtn');
  const syncRead = () => { readBtn.hidden = !(portrait && isOpen); };
  readBtn.addEventListener('click', () => { const on = readBtn.getAttribute('aria-pressed') !== 'true'; readBtn.setAttribute('aria-pressed', String(on)); readBtn.textContent = on ? 'Ver libro' : 'Leer'; book.setRead(on); });
  const book = new Book($('stage'), data, {
    onAspect: (a) => { portrait = a < 1; syncRead(); if (!portrait && readBtn.getAttribute('aria-pressed') === 'true') readBtn.click(); },
    onAction: handleAction,
    onOpenRequest: () => open(),
    onTurn: (i) => {
      counter.textContent = `${i + 1} / ${n}`;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
      $('prevBtn').disabled = i === 0; $('nextBtn').disabled = i === n - 1;
      const s = data.spreads[i];
      live.textContent = s.titulo + '. ' + s.card.blocks.filter((b) => b.text).map((b) => b.text).join(' ');
      if (i > 0) hint.classList.add('off');
    }
  });

  try { await book.init(); } catch (e) { console.error(e); return goSimple(); }
  $('loader').hidden = true; $('gate').hidden = false;
  book.kick();

  let opening = false;
  async function open() {
    if (opening) return; opening = true;
    $('gate').hidden = true;
    started = true; audio.play().catch(() => {});
    mute.hidden = false;
    await book.open();
    isOpen = true; syncRead();
    $('hud').hidden = false; hint.hidden = false;
    setTimeout(() => hint.classList.add('off'), 6000);
  }
  $('openBtn').addEventListener('click', open);
  $('prevBtn').addEventListener('click', () => book.go(-1));
  $('nextBtn').addEventListener('click', () => book.go(1));
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') book.go(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') book.go(-1);
    else if ((e.key === 'Enter' || e.key === ' ') && book.stage === 'closed') open();
  });
}

main().catch((e) => { console.error(e); document.getElementById('loader').textContent = 'No se pudo cargar la invitación.'; });
