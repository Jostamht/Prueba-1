// Tarjetas de papel: se dibujan en un canvas y luego se usan como textura dentro del libro.
export const SERIF = '"Cormorant Garamond", Georgia, serif';
export const SCRIPT = '"Great Vibes", "Snell Roundhand", cursive';
export const COLORS = { paper: '#f7f1e3', ink: '#1c1714', gold: '#b08d3c', goldD: '#8a6a22', red: '#9b1c24', mute: '#4a4039' };
const C = COLORS;

export async function loadFonts() {
  const specs = ['500 30px "Cormorant Garamond"', '600 30px "Cormorant Garamond"', 'italic 500 30px "Cormorant Garamond"', '40px "Great Vibes"'];
  try { await Promise.all(specs.map((s) => document.fonts.load(s, 'Aáñ'))); } catch (e) { console.warn('Fuentes no disponibles', e); }
}

export function countdownParts(target) {
  const ms = target - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad2 = (n) => String(n).padStart(2, '0');

function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function spaced(g, text, cx, cy, sp) {
  let total = -sp;
  for (const ch of text) total += g.measureText(ch).width + sp;
  let x = cx - total / 2;
  g.textAlign = 'left';
  for (const ch of text) { g.fillText(ch, x, cy); x += g.measureText(ch).width + sp; }
  g.textAlign = 'center';
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/**
 * spec: { blocks: [...] }   ctx: { date: Date, links: {...}, expirado: string }
 * Devuelve { canvas, regions, redraw, live }
 */
export function renderCard(spec, ctx, onUpdate) {
  const CW = 900, PADX = 90, PADT = 100, PADB = 90, GAP = 18;
  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = 400;
  const g = cv.getContext('2d');
  const blocks = spec.blocks || [];
  const regions = [];
  const imgs = {};
  let layout = [];
  let H = 0;
  const live = blocks.some((b) => b.type === 'countdown');

  function wrap(text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function doLayout() {
    let y = PADT; layout = [];
    for (const b of blocks) {
      let h = 0, lines = null;
      switch (b.type) {
        case 'eyebrow': h = 40; break;
        case 'title': h = (b.size || 120) * 0.95; break;
        case 'heading': h = (b.size || 58) * 1.2; break;
        case 'text': { const sz = b.size || 38; g.font = `${b.italic ? 'italic ' : ''}500 ${sz}px ${SERIF}`; lines = wrap(b.text, CW - 2 * PADX); h = lines.length * sz * 1.32; break; }
        case 'ornament': h = 44; break;
        case 'list': h = b.rows.length * 64; break;
        case 'kv': h = 104; break;
        case 'button': h = 92; break;
        case 'countdown': h = 176; break;
        case 'image': h = (b.size || 280) + 30; break;
        case 'spacer': h = b.h || 20; break;
        default: h = 0;
      }
      layout.push({ b, y, h, lines });
      y += h + (b.gap ?? GAP);
    }
    H = Math.ceil(y - GAP + PADB);
    cv.height = H;
  }

  function getImg(src) {
    if (imgs[src]) return imgs[src];
    const rec = (imgs[src] = { im: new Image(), ok: false, fail: false });
    rec.im.onload = () => { rec.ok = true; draw(); onUpdate && onUpdate(); };
    rec.im.onerror = () => { rec.fail = true; draw(); onUpdate && onUpdate(); };
    rec.im.src = src;
    return rec;
  }

  function paper() {
    g.fillStyle = C.paper; g.fillRect(0, 0, CW, H);
    const r = rng(11);
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(120,95,60,${0.015 + r() * 0.04})`;
      g.fillRect(r() * CW, r() * H, 1 + r() * 2, 1 + r() * 2);
    }
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(160,130,80,0.10)');
    g.fillStyle = gr; g.fillRect(0, 0, CW, H);
    g.strokeStyle = C.gold; g.lineWidth = 3; g.strokeRect(26, 26, CW - 52, H - 52);
    g.lineWidth = 1.2; g.strokeRect(40, 40, CW - 80, H - 80);
    // listón rojo
    g.fillStyle = C.red;
    g.beginPath(); g.moveTo(CW - 150, 0); g.lineTo(CW - 106, 0); g.lineTo(CW - 106, 96); g.lineTo(CW - 128, 76); g.lineTo(CW - 150, 96); g.closePath(); g.fill();
  }

  function drawBlock({ b, y, h, lines }) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const cx = CW / 2;
    switch (b.type) {
      case 'eyebrow':
        g.font = `600 28px ${SERIF}`; g.fillStyle = C.goldD;
        spaced(g, b.text.toUpperCase(), cx, y + 20, 6); break;
      case 'title':
        g.font = `${b.size || 120}px ${SCRIPT}`; g.fillStyle = C.ink;
        g.fillText(b.text, cx, y + h / 2); break;
      case 'heading':
        g.font = `600 ${b.size || 58}px ${SERIF}`; g.fillStyle = C.ink;
        g.fillText(b.text, cx, y + h / 2); break;
      case 'text': {
        const sz = b.size || 38; const lh = sz * 1.32;
        g.font = `${b.italic ? 'italic ' : ''}500 ${sz}px ${SERIF}`; g.fillStyle = C.mute;
        lines.forEach((ln, i) => g.fillText(ln, cx, y + (i + 0.5) * lh)); break;
      }
      case 'ornament': {
        const cy = y + 22;
        g.strokeStyle = C.gold; g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx - 230, cy); g.lineTo(cx - 28, cy); g.moveTo(cx + 28, cy); g.lineTo(cx + 230, cy); g.stroke();
        g.fillStyle = C.red; g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx + 12, cy); g.lineTo(cx, cy + 12); g.lineTo(cx - 12, cy); g.closePath(); g.fill();
        break;
      }
      case 'list':
        b.rows.forEach((row, i) => {
          const cy = y + i * 64 + 32;
          g.textAlign = 'right'; g.font = `600 40px ${SERIF}`; g.fillStyle = C.goldD; g.fillText(row[0], cx - 26, cy);
          g.textAlign = 'left'; g.font = `500 40px ${SERIF}`; g.fillStyle = C.ink; g.fillText(row[1], cx + 26, cy);
          g.strokeStyle = 'rgba(176,141,60,0.45)'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(cx, cy - 22); g.lineTo(cx, cy + 22); g.stroke();
        });
        g.textAlign = 'center'; break;
      case 'kv':
        g.font = `600 26px ${SERIF}`; g.fillStyle = C.goldD; spaced(g, b.label.toUpperCase(), cx, y + 18, 5);
        g.font = `600 54px ${SERIF}`; g.fillStyle = C.ink; g.fillText(b.value, cx, y + 70); break;
      case 'button': {
        const w = b.w || 640, bh = 76, x = (CW - w) / 2, by = y + 8;
        const sec = b.style === 'secondary';
        roundRect(g, x, by, w, bh, 38);
        if (sec) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill(); g.strokeStyle = C.goldD; g.lineWidth = 2.5; g.stroke(); g.fillStyle = C.goldD; }
        else { g.fillStyle = C.ink; g.fill(); g.strokeStyle = C.gold; g.lineWidth = 3; g.stroke(); g.fillStyle = '#f3e7c4'; }
        g.font = `600 32px ${SERIF}`; spaced(g, b.label.toUpperCase(), cx, by + bh / 2 + 1, 4);
        regions.push({ x, y: by, w, h: bh, action: b.action });
        break;
      }
      case 'countdown': {
        const p = countdownParts(ctx.date);
        if (!p) { g.font = `600 56px ${SERIF}`; g.fillStyle = C.red; g.fillText(ctx.expirado || '¡Hoy es el gran día!', cx, y + h / 2); break; }
        const vals = [[p.d, 'Días'], [p.h, 'Horas'], [p.m, 'Min'], [p.s, 'Seg']];
        const bw = 162, gap = 24, x0 = (CW - (4 * bw + 3 * gap)) / 2;
        vals.forEach(([v, lb], i) => {
          const x = x0 + i * (bw + gap);
          roundRect(g, x, y + 6, bw, h - 12, 16); g.fillStyle = '#fffaf0'; g.fill(); g.strokeStyle = C.gold; g.lineWidth = 2.5; g.stroke();
          g.font = `600 70px ${SERIF}`; g.fillStyle = C.ink; g.fillText(i === 0 ? String(v) : pad2(v), x + bw / 2, y + 74);
          g.font = `600 24px ${SERIF}`; g.fillStyle = C.goldD; spaced(g, lb.toUpperCase(), x + bw / 2, y + 134, 3);
        });
        break;
      }
      case 'image': {
        const s = b.size || 280, x = (CW - s) / 2, iy = y + 10;
        const rec = getImg(b.src);
        g.fillStyle = '#fff'; g.fillRect(x - 12, iy - 12, s + 24, s + 24);
        g.strokeStyle = C.gold; g.lineWidth = 3; g.strokeRect(x - 12, iy - 12, s + 24, s + 24);
        if (rec.ok) g.drawImage(rec.im, x, iy, s, s);
        else { g.setLineDash([12, 10]); g.strokeStyle = C.goldD; g.strokeRect(x, iy, s, s); g.setLineDash([]); g.font = `600 44px ${SERIF}`; g.fillStyle = C.goldD; g.fillText('QR', cx, iy + s / 2); }
        break;
      }
      default: break;
    }
  }

  function draw() {
    regions.length = 0;
    paper();
    layout.forEach(drawBlock);
  }

  doLayout();
  draw();
  return { canvas: cv, regions, redraw: draw, live, get height() { return H; }, width: CW };
}
