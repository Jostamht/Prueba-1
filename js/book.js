// Motor del libro pop-up (three.js). Libro abierto de dos páginas, visto en perspectiva.
// Escena: libro cerrado sobre un escritorio -> la tapa se abre hacia la izquierda -> el escritorio desaparece.
// Cada vista doble tiene: una lámina en las dos páginas (A), un respaldo de papel de pie al fondo (B),
// una figura de pie (C) y una tarjeta de texto que se levanta de la página izquierda.
// Al pasar la página, la hoja derecha se curva sobre el lomo mientras la escena saliente se pliega
// y la entrante se levanta.
import * as THREE from '../vendor/three.module.min.js';
import { renderCard } from './cards.js';

const PAGE_W = 0.888, PAGE_H = 1.0;
const BLOCK_H = 0.062, BOARD_H = 0.022, COVER_T = 0.016, LEAF_LIFT = 0.006, CURL_MAX = 0.72;
const CARD_ELEV = 0.34;          // inclinación de la tarjeta sobre la página (rad)
const TURN_MS = 1500, OPEN_MS = 3400, CLOSE_MS = 2200, RISE_WIN = 0.26;
const SEG = 56;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t) => { const c = 1.34; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const LAYER_DELAY = { background: 0, mid: 0.04, foreground: 0.08, card: 0.1 };

// Punto a distancia s del lomo de una hoja que se curva sobre un cilindro y gira phi alrededor del lomo.
function curlPoint(s, phi, kappa, out) {
  let x, y;
  if (kappa < 1e-5) { x = s; y = 0; }
  else { const R = 1 / kappa, a = s / R; x = R * Math.sin(a); y = R * (1 - Math.cos(a)); }
  const c = Math.cos(phi), sn = Math.sin(phi);
  out[0] = x * c - y * sn; out[1] = x * sn + y * c;
}

function loadImage(src) {
  return new Promise((res) => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => {
      console.warn('No se pudo cargar la imagen:', src);
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      g.fillStyle = '#f2d9d9'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#9b1c24'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 492);
      g.beginPath(); g.moveTo(10, 10); g.lineTo(502, 502); g.moveTo(502, 10); g.lineTo(10, 502); g.stroke();
      g.fillStyle = '#9b1c24'; g.font = '28px sans-serif'; g.textAlign = 'center'; g.fillText(src, 256, 256);
      res(c);
    };
    im.src = src;
  });
}
const imgSize = (im) => ({ w: im.naturalWidth || im.width, h: im.naturalHeight || im.height });
function makeTex(source, aniso) { const t = new THREE.Texture(source); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.needsUpdate = true; return t; }

// Rectángulo visible (alfa > 0.42) de una imagen recortada, en coordenadas 0..1
function alphaBounds(im) {
  const { w, h } = imgSize(im);
  const s = Math.min(1, 256 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] >= 108) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  return { x0: Math.max(0, (x0 - 1) / c.width), y0: Math.max(0, (y0 - 1) / c.height), x1: Math.min(1, (x1 + 2) / c.width), y1: Math.min(1, (y1 + 2) / c.height) };
}
// Reverso de una figura: la misma silueta en color papel
function silhouette(im, color = '#ddd3bd') {
  const { w, h } = imgSize(im);
  const s = Math.min(1, 256 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const rng = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

function woodTexture() {
  const t = canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3b2414'); gr.addColorStop(0.5, '#4d311d'); gr.addColorStop(1, '#35210f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 380; i++) {
      const y = r() * h; g.strokeStyle = `rgba(${r() < 0.5 ? '20,10,4' : '110,72,40'},${0.05 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 * r()); g.stroke();
    }
    g.strokeStyle = 'rgba(10,5,2,0.7)'; g.lineWidth = 3; for (let y = 0; y < h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function shadowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function gutterTexture() {
  return canvasTex(256, 16, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(60,40,20,0)'); gr.addColorStop(0.5, 'rgba(60,40,20,0.38)'); gr.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function coverTexture(meta) {
  const w = 800, h = Math.round(800 * PAGE_H / PAGE_W);
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#121010'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(255,255,255,${0.01 + r() * 0.03})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    const gold = g.createLinearGradient(0, 0, w, h); gold.addColorStop(0, '#d9b768'); gold.addColorStop(0.5, '#a67c2e'); gold.addColorStop(1, '#e6c97e');
    g.strokeStyle = gold; g.lineWidth = 6; g.strokeRect(40, 40, w - 80, h - 80); g.lineWidth = 2; g.strokeRect(58, 58, w - 116, h - 116);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = gold;
    g.font = '150px "Great Vibes", cursive'; g.fillText(meta.novios[0], w / 2, h * 0.28);
    g.font = '90px "Great Vibes", cursive'; g.fillText('&', w / 2, h * 0.42);
    g.font = '150px "Great Vibes", cursive'; g.fillText(meta.novios[1], w / 2, h * 0.56);
    const d = new Date(meta.fecha);
    g.font = '600 34px "Cormorant Garamond", serif';
    const txt = `${String(d.getDate()).padStart(2, '0')} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getFullYear()}`;
    let x = w / 2 - (txt.length * 15) / 2; g.textAlign = 'left';
    for (const ch of txt) { g.fillText(ch, x, h * 0.70); x += 15 + g.measureText(ch).width * 0.2; }
    g.textAlign = 'center';
    g.fillStyle = '#8f1620'; g.beginPath(); g.arc(w / 2, h * 0.83, 46, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d9b768'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h * 0.83, 36, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#e6c97e'; g.font = '44px "Great Vibes", cursive'; g.fillText('J&R', w / 2, h * 0.83 + 2);
  });
}

const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, ...o });

/** Figura o tarjeta de papel: pivote en la base visible; rotation.x: -PI/2 plana ... finalX de pie. */
class Rig {
  constructor(book, o) {
    const { map, backMap, w, h, x, z, finalX, cut, support, shadowD, shadowW } = o;
    this.w = w; this.h = h; this.finalX = finalX; this.home = new THREE.Vector3(x, 0.003, z);
    this.q = 0; this._shown = false; this.idle = null;
    this.group = new THREE.Group(); this.group.position.copy(this.home);
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    this.fm = std({ map, transparent: true, alphaTest: cut ? 0.42 : 0 });
    this.bm = std({ map: backMap || null, color: backMap ? 0xffffff : 0xe6dcc6, transparent: true, alphaTest: cut ? 0.42 : 0, side: THREE.BackSide });
    this.front = new THREE.Mesh(geo, this.fm); this.back = new THREE.Mesh(geo, this.bm);
    this.rig = new THREE.Group(); this.rig.add(this.front, this.back); this.group.add(this.rig);
    this.sm = new THREE.MeshBasicMaterial({ map: book.shadowTex, transparent: true, depthWrite: false, opacity: 0 });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.sm);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(x, 0.0035, z - (shadowD || 0.2) * 0.12);
    this.shadow.scale.set(shadowW || w * 1.2, shadowD || Math.max(0.12, w * 0.4), 1);
    // soporte plegado detrás de la figura (dos paneles unidos en una rodilla)
    this.supports = [];
    if (support) {
      this.supGroup = new THREE.Group(); this.supGroup.position.copy(this.home);
      const offs = w > 1 ? [-0.3 * w, 0.3 * w] : [0];
      this.supMat = std({ color: 0xd9cfb6, side: THREE.DoubleSide });
      for (const ox of offs) {
        const pair = [0, 1].map(() => {
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); g.setIndex([0, 1, 2, 2, 1, 3]);
          const m = new THREE.Mesh(g, this.supMat); m.frustumCulled = false; m.visible = false; this.supGroup.add(m); return m;
        });
        this.supports.push({ ox, pair });
      }
      book.scene.add(this.supGroup);
      this.maxBack = support.maxBack ?? 0.9 * h;
    }
    book.scene.add(this.group, this.shadow);
    this.set(0, true);
  }
  set(q, rising = true) {
    q = clamp(q); this.q = q;
    const vis = q > 0.001;
    this.group.visible = vis; this.shadow.visible = vis;
    if (!vis) { this.supports.forEach((s) => s.pair.forEach((m) => (m.visible = false))); return; }
    const e = rising ? backOut(q) : smooth(q);
    this.baseX = lerp(-Math.PI / 2, this.finalX, e);
    this.rig.rotation.x = this.baseX;
    const o = clamp(q * 3);
    for (const m of [this.fm, this.bm]) { m.opacity = o; m.transparent = o < 0.999; }
    this.sm.opacity = clamp(q * 1.4) * 0.9;
    if (this.supports.length) this._support(e);
  }
  _support(e) {
    const th = this.rig.rotation.x, h = this.h;
    const top = { y: h * Math.cos(th), z: h * Math.sin(th) };
    const base = { y: 0.004, z: -Math.min(h * 0.9, this.maxBack) };
    const dy = top.y - base.y, dz = top.z - base.z, d = Math.hypot(dy, dz);
    const reach = Math.sqrt(Math.max(0, (h * 0.5) ** 2 - (d * d) / 4));
    const knee = { y: (top.y + base.y) / 2 + (reach * dz) / Math.max(d, 1e-4), z: (top.z + base.z) / 2 - (reach * dy) / Math.max(d, 1e-4) };
    const pw = Math.min(this.w * 0.2, 0.09);
    const shown = th < -0.1 && e > 0.45;
    for (const s of this.supports) {
      this._panel(s.pair[0], s.ox, top, knee, pw); this._panel(s.pair[1], s.ox, knee, base, pw);
      s.pair[0].visible = s.pair[1].visible = shown;
    }
  }
  _panel(mesh, ox, a, b, w) {
    const p = mesh.geometry.attributes.position;
    p.setXYZ(0, ox - w / 2, a.y, a.z); p.setXYZ(1, ox + w / 2, a.y, a.z); p.setXYZ(2, ox - w / 2, b.y, b.z); p.setXYZ(3, ox + w / 2, b.y, b.z);
    p.needsUpdate = true;
  }
  dispose() {
    for (const o of [this.group, this.shadow, this.supGroup]) o?.parent?.remove(o);
    this.front.geometry.dispose(); [this.fm, this.bm].forEach((m) => { m.map?.dispose?.(); m.dispose(); });
    this.shadow.geometry.dispose(); this.sm.dispose();
    this.supports.forEach((s) => s.pair.forEach((m) => m.geometry.dispose())); this.supMat?.dispose();
  }
}

export class Book {
  constructor(canvas, data, hooks = {}) {
    this.canvas = canvas; this.data = data; this.hooks = hooks;
    this.n = data.spreads.length; this.cur = 0; this.stage = 'closed'; this.busy = false;
    this.anims = new Set(); this.raf = 0; this.mixOpen = 0; this.mixRead = 0; this.spreads = []; this.ptr = null;
    this.pitch = 0.98; this.yaw = -0.2; this.read = false;
    this.autoRead = true; this.phone = false; this._readTok = 0; this._autoT = 0; this.drag = null;
    this.date = new Date(data.meta.fecha);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.dur = this.reduced ? 0.45 : 1; this._last = 0;
  }

  async init() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.setClearColor(0x0a0807, 1);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.aniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    this.shadowTex = shadowTexture();
    this.raycaster = new THREE.Raycaster();
    this._stage();
    this.spreads = this.data.spreads.map((spec, i) => ({ spec, i, ready: null, tex: null, items: [], card: null, cardData: null, timer: 0 }));
    await this.ensure(0);
    this._applyPages(0);
    this._events();
    this.resize();
    (async () => { for (let i = 1; i < this.n; i++) { try { await this.ensure(i); } catch (e) { console.warn(e); } } })();
  }

  // ---------------- escenario ----------------
  _stage() {
    const S = this.scene;
    S.add(new THREE.HemisphereLight(0xfff6e6, 0xb09a78, 2.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-1.2, 2.4, 1.6); S.add(sun);

    this.deskMat = new THREE.MeshBasicMaterial({ map: woodTexture(), transparent: true });
    this.desk = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), this.deskMat);
    this.desk.rotation.x = -Math.PI / 2; this.desk.position.y = -(BLOCK_H + BOARD_H) - 0.003; S.add(this.desk);

    this.boardMat = std({ color: 0x6f2a25, roughness: 0.82 });
    this.pageEdgeMat = std({ color: 0xe9dfc4 });
    this.root = new THREE.Group(); S.add(this.root);
    this.leftStack = new THREE.Group(); this.leftStack.visible = false; this.root.add(this.leftStack);
    for (const side of [-1, 1]) {
      const parent = side < 0 ? this.leftStack : this.root;
      const block = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W, BLOCK_H, PAGE_H), this.pageEdgeMat);
      block.position.set(side * PAGE_W / 2, -BLOCK_H / 2, 0);
      const board = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.018, BOARD_H, PAGE_H + 0.018), this.boardMat);
      board.position.set(side * PAGE_W / 2, -BLOCK_H - BOARD_H / 2, 0);
      parent.add(block, board);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.052, BLOCK_H + BOARD_H, PAGE_H + 0.016), this.boardMat);
    spine.position.set(0, -(BLOCK_H + BOARD_H) / 2, 0); this.root.add(spine);

    // páginas fijas (la lámina de cada vista doble se reparte entre las dos)
    const surf = (side) => {
      const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? 0.5 * uv.getX(i) : 0.5 + 0.5 * uv.getX(i));
      g.translate(side * PAGE_W / 2, 0.001, 0);
      const m = new THREE.Mesh(g, std({ color: 0xf1e8d2 })); m.renderOrder = 1; this.root.add(m); return m;
    };
    this.leftSurface = surf(-1); this.rightSurface = surf(1); this.leftSurface.visible = false;
    // sombra suave en el lomo
    this.gutterMat = new THREE.MeshBasicMaterial({ map: gutterTexture(), transparent: true, depthWrite: false });
    const gut = new THREE.Mesh(new THREE.PlaneGeometry(0.24, PAGE_H), this.gutterMat); gut.rotation.x = -Math.PI / 2; gut.position.y = 0.0018; gut.renderOrder = 2; this.gutter = gut; gut.visible = false; this.root.add(gut);

    this.leaves = [];
    this._buildCover();
  }

  _makeLeaf() {
    const pos = new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3);
    const mk = (flip) => {
      const g = new THREE.BufferGeometry(); const uv = new Float32Array((SEG + 1) * 2 * 2), idx = [];
      for (let j = 0; j <= SEG; j++) {
        const u = j / SEG, ux = flip ? 0.5 * (1 - u) : 0.5 + 0.5 * u;
        uv.set([ux, 1, ux, 0], j * 4);
        if (j < SEG) { const a = 2 * j, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, c, b, d); }
      }
      g.setAttribute('position', pos); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
    };
    const front = new THREE.Mesh(mk(false), std({ color: 0xffffff }));
    const back = new THREE.Mesh(mk(true), std({ color: 0xffffff, side: THREE.BackSide }));
    for (const m of [front, back]) { m.frustumCulled = false; m.renderOrder = 3; }
    const group = new THREE.Group(); group.position.y = LEAF_LIFT; group.add(front, back); group.visible = false;
    this.root.add(group);
    const leaf = { pos, front, back, group };
    this._curl(leaf, 0);
    return leaf;
  }
  /** Hoja que gira sobre el lomo. Se crean a demanda: un salto de varias páginas usa varias a la vez. */
  _getLeaf(j) {
    if (this.leaves[j]) return this.leaves[j];
    const pos = new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3);
    const mk = (flip) => {
      const g = new THREE.BufferGeometry(); const uv = new Float32Array((SEG + 1) * 2 * 2), idx = [];
      for (let k = 0; k <= SEG; k++) {
        const u = k / SEG, ux = flip ? 0.5 * (1 - u) : 0.5 + 0.5 * u;
        uv.set([ux, 1, ux, 0], k * 4);
        if (k < SEG) { const a = 2 * k, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, c, b, d); }
      }
      g.setAttribute('position', pos); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
    };
    const front = new THREE.Mesh(mk(false), std({ color: 0xffffff }));
    const back = new THREE.Mesh(mk(true), std({ color: 0xffffff, side: THREE.BackSide }));
    for (const m of [front, back]) { m.frustumCulled = false; m.renderOrder = 3; }
    const group = new THREE.Group(); group.position.y = LEAF_LIFT; group.add(front, back); group.visible = false;
    this.root.add(group);
    const leaf = { pos, front, back, group };
    this._curl(leaf, 0);
    return (this.leaves[j] = leaf);
  }

  _curl(leaf, p) {
    const phi = Math.PI * p, kappa = CURL_MAX * Math.pow(Math.sin(Math.PI * clamp(p)), 2), o = [0, 0];
    for (let j = 0; j <= SEG; j++) {
      curlPoint((j / SEG) * PAGE_W, phi, kappa, o);
      leaf.pos.setXYZ(2 * j, o[0], o[1], -PAGE_H / 2); leaf.pos.setXYZ(2 * j + 1, o[0], o[1], PAGE_H / 2);
    }
    leaf.pos.needsUpdate = true;
    leaf.front.geometry.computeVertexNormals(); leaf.back.geometry.computeVertexNormals();
  }

  _buildCover() {
    this.cover = new THREE.Group(); this.cover.position.y = LEAF_LIFT; this.root.add(this.cover);
    this.coverMats = [];
    const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H); g.rotateX(-Math.PI / 2); g.translate(PAGE_W / 2, 0, 0);
    const uvIn = g.clone(); const uv = uvIn.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 0.5 * (1 - uv.getX(i)));
    this.coverOut = new THREE.Mesh(g, std({ map: coverTexture(this.data.meta), transparent: true }));
    this.coverIn = new THREE.Mesh(uvIn, std({ color: 0xf1e8d2, side: THREE.BackSide, transparent: true }));
    const board = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.018, COVER_T, PAGE_H + 0.018), std({ color: 0x14100e, transparent: true }));
    board.position.set(PAGE_W / 2, -COVER_T / 2 - 0.0005, 0);
    this.cover.add(this.coverOut, this.coverIn, board);
    this.coverMats = [this.coverOut.material, this.coverIn.material, board.material];
  }

  // ---------------- cámara ----------------
  _solve(points, target, elev, yaw, limits) {
    const cam = this.camera, v = new THREE.Vector3();
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
    let d = 1;
    for (; d < 40; d += 0.04) {
      cam.position.copy(target).addScaledVector(dir, d); cam.lookAt(target); cam.updateMatrixWorld(true);
      let ok = true;
      for (const p of points) { v.copy(p).project(cam); if (Math.abs(v.x) > limits.x || v.y > limits.top || v.y < limits.bottom) { ok = false; break; } }
      if (ok) break;
    }
    return { pos: cam.position.clone(), target: target.clone() };
  }

  _cams() {
    const V = (x, y, z) => new THREE.Vector3(x, y, z), W = PAGE_W, H = PAGE_H / 2;
    const lim = { x: 0.95, top: 0.9, bottom: -0.68 };
    const open = [V(-W, -0.09, H + 0.02), V(W, -0.09, H + 0.02), V(-W, 0, -H), V(W, 0, -H), V(-0.85, 1.0, -0.22), V(0.85, 1.0, -0.22)];
    this.camOpen = this._solve(open, V(0, 0.2, 0.05), this.pitch, this.yaw, lim);
    const closed = [V(0, -0.09, H + 0.02), V(W, -0.09, H + 0.02), V(0, 0.02, -H), V(W, 0.02, -H)];
    this.camClosed = this._solve(closed, V(W / 2, 0, 0), 1.05, -0.12, { x: 0.9, top: 0.9, bottom: -0.68 });
    const read = [V(-W, -0.09, H + 0.02), V(0, -0.09, H + 0.02), V(-W, 0, -H), V(0, 0, -H), V(-W / 2, 0.38, -0.2)];
    this.camRead = this._solve(read, V(-W / 2, 0.08, 0.1), 1.2, 0, { x: 0.94, top: 0.9, bottom: -0.68 });
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this._cams(); this._applyCam(); this.kick();
    this.phone = Math.min(w, h) < 600;
    if (!this.phone && this.read) this.setRead(false);
    this.hooks.onAspect?.(w / h, this.phone);
  }

  _applyCam() {
    if (!this.camOpen) return;
    const a = this.camClosed, b = this.camOpen, c = this.camRead;
    const pos = new THREE.Vector3().lerpVectors(a.pos, b.pos, this.mixOpen).lerp(c.pos, this.mixRead);
    const tgt = new THREE.Vector3().lerpVectors(a.target, b.target, this.mixOpen).lerp(c.target, this.mixRead);
    this.camera.position.copy(pos); this.camera.lookAt(tgt);
  }

  /** Toma de lectura: la cámara se acerca de frente a la tarjeta (solo en teléfonos). */
  setRead(on) {
    on = !!on && this.phone;
    if (on === this.read && this.mixRead === (on ? 1 : 0)) return;
    this.read = on; this.hooks.onRead?.(on);
    const from = this.mixRead, to = on ? 1 : 0, tok = ++this._readTok;
    this.anim(on ? 850 : 650, (t) => { if (tok === this._readTok) this.mixRead = lerp(from, to, smooth(t)); });
  }
  /** Acerca la cámara a la tarjeta ya, sin esperar a que termine la animación (se llama cuando la hoja está por caer). */
  _autoReadNow() { if (this.autoRead && this.phone && !this.read && (this.stage === 'open' || this.stage === 'opening')) this.setRead(true); }
  _cancelAuto() { clearTimeout(this._autoT); this._autoT = 0; }
  /** Cuando la escena termina de levantarse, tras un instante la cámara se acerca sola a la tarjeta. */
  _afterSettle() {
    this._cancelAuto();
    if (!this.autoRead || !this.phone || this.stage !== 'open') return;
    this._autoT = setTimeout(() => { this._autoT = 0; if (this.stage === 'open' && !this.busy && !this.read) this.setRead(true); }, 250);
  }

  // ---------------- páginas ----------------
  ensure(i) { const s = this.spreads[i]; if (!s.ready) s.ready = this._build(s); return s.ready; }

  async _build(s) {
    const spec = s.spec;
    const [artIm, ...ims] = await Promise.all([loadImage(spec.art), ...spec.items.map((it) => loadImage(it.src))]);
    s.tex = makeTex(artIm, this.aniso);
    spec.items.forEach((it, k) => {
      const im = ims[k], bb = alphaBounds(im), { w: iw, h: ih } = imgSize(im);
      const bw = (bb.x1 - bb.x0) * iw, bh = (bb.y1 - bb.y0) * ih, sc = Math.min(it.maxWidth / bw, it.maxHeight / bh);
      const map = makeTex(im, this.aniso); map.repeat.set(bb.x1 - bb.x0, bb.y1 - bb.y0); map.offset.set(bb.x0, 1 - bb.y1);
      const back = new THREE.CanvasTexture(silhouette(im)); back.colorSpace = THREE.SRGBColorSpace; back.repeat.copy(map.repeat); back.offset.copy(map.offset);
      const w = bw * sc, h = bh * sc, x = it.anchor[0], z = it.anchor[1];
      const rig = new Rig(this, { map, backMap: back, w, h, x, z, finalX: -0.06, cut: true, support: { maxBack: Math.max(0.08, z + PAGE_H / 2 - 0.03) }, shadowW: w * 1.25, shadowD: Math.max(0.1, Math.min(0.4, w * 0.45)) });
      rig.layer = it.layer || 'mid';
      rig.idle = rig.layer === 'foreground' ? { amp: 0.035, period: 3.4, phase: s.i * 0.9 + k } : null;   // vaivén suave (~2°) de las figuras C, de atrás hacia adelante
      rig.late = Math.abs(x) < PAGE_W * 0.2 && w > 0.9 || x < 0;   // lo que cae bajo la hoja que gira, sube al final
      s.items.push(rig);
    });
    const cd = s.cardData = renderCard(spec.card, { date: this.date, expirado: this.data.meta.expiradoTexto }, () => { if (s.card) { s.card.cardTex.needsUpdate = true; this.kick(); } });
    const ct = new THREE.CanvasTexture(cd.canvas); ct.colorSpace = THREE.SRGBColorSpace; ct.anisotropy = this.aniso;
    const cw = 0.76, ch = cw * cd.canvas.height / cd.canvas.width;
    s.card = new Rig(this, { map: ct, w: cw, h: ch, x: -PAGE_W / 2, z: PAGE_H / 2 - 0.05, finalX: -Math.PI / 2 + CARD_ELEV, cut: false, shadowW: cw * 1.1, shadowD: ch * Math.cos(CARD_ELEV) + 0.12 });
    s.card.shadow.position.z = PAGE_H / 2 - 0.05 - (ch * Math.cos(CARD_ELEV)) / 2;
    s.card.cardTex = ct; s.card.layer = 'card'; s.card.late = true; s.loaded = true;
    this.kick();
    return s;
  }

  _applyPages(i) { const t = this.spreads[i].tex; this.leftSurface.material.map = t; this.rightSurface.material.map = t; this.leftSurface.material.color.set(0xffffff); this.rightSurface.material.color.set(0xffffff); this.leftSurface.material.needsUpdate = this.rightSurface.material.needsUpdate = true; }
  _setMap(mesh, tex) { mesh.material.map = tex; mesh.material.color.set(0xffffff); mesh.material.needsUpdate = true; }

  _all(s) { return [...s.items, s.card].filter(Boolean); }
  _fold(s, q) { this._all(s).forEach((r) => r.set(q, false)); }
  _riseAt(s, t, base, baseLate) {
    for (const r of this._all(s)) {
      const start = (r.late ? baseLate : base) + (LAYER_DELAY[r.layer] || 0);
      r.set(clamp((t - start) / RISE_WIN), true);
    }
  }

  // ---------------- animación ----------------
  anim(ms, fn) { return new Promise((res) => { this.anims.add({ t0: performance.now(), ms: ms * this.dur, fn, res }); this.kick(); }); }
  kick() { if (!this.raf && this.renderer) this.raf = requestAnimationFrame(this._tick); }
  _idleOn() { return this.stage === 'open' && !this.reduced; }
  _idleUpdate(t) {
    for (const sp of this.spreads) for (const r of sp.items) {
      if (!r.idle || !r.group.visible) continue;
      const f = smooth(clamp((r.q - 0.9) / 0.1));
      r.rig.rotation.x = r.baseX + f * r.idle.amp * Math.sin((2 * Math.PI * t) / r.idle.period + r.idle.phase);   // adelante y atrás
    }
  }
  _tick = (now) => {
    this.raf = 0;
    const animating = this.anims.size > 0, idle = this._idleOn();
    if (!animating && idle && now - this._last < 30) { this.kick(); return; }   // en reposo, ~30 cuadros por segundo
    this._last = now;
    for (const a of [...this.anims]) { const t = clamp((now - a.t0) / a.ms); a.fn(t); if (t >= 1) { this.anims.delete(a); a.res(); } }
    if (this._idleOn()) this._idleUpdate(now / 1000);
    this._applyCam(); this.renderer.render(this.scene, this.camera);
    if (this.anims.size || this._idleOn()) this.kick();
  };

  async open() {
    if (this.stage !== 'closed') return;
    this.stage = 'opening';
    const s = await this.ensure(0);
    this._setMap(this.coverIn, s.tex); this.coverIn.material.map = s.tex;
    this.rightSurface.visible = true; this.gutter.visible = true;
    let early = false;
    await this.anim(OPEN_MS, (t) => {
      if (!early && t > 0.9) { early = true; this._autoReadNow(); }
      const e = easeInOut(clamp(t / 0.5));
      this.cover.rotation.z = Math.PI * e;
      this.leftStack.visible = e > 0.5;
      this.mixOpen = smooth(clamp((t - 0.25) / 0.6));
      this.deskMat.opacity = 1 - clamp((t - 0.35) / 0.45);
      this._riseAt(s, t, 0.56, 0.62);
    });
    this._all(s).forEach((r) => r.set(1, true));
    this.desk.visible = false;
    this.leftSurface.visible = true; this._applyPages(0); this.cover.visible = false;
    this.stage = 'open'; this.cur = 0; this._live(0); this.hooks.onTurn?.(0); this._afterSettle();
  }

  _live(i) {
    this.spreads.forEach((s) => { if (s.timer) { clearInterval(s.timer); s.timer = 0; } });
    const s = this.spreads[i];
    if (s?.cardData?.live) s.timer = setInterval(() => { s.cardData.redraw(); s.card.cardTex.needsUpdate = true; this.kick(); }, 1000);
  }

  /** Cierra el libro (solo desde la primera vista): la tapa vuelve a cubrir las páginas y reaparece el escritorio. */
  async close() {
    if (this.stage !== 'open' || this.busy || this.cur !== 0) return;
    this.busy = true; this.stage = 'closing'; this._live(-1); this._cancelAuto();
    const s = this.spreads[0], m0 = this.mixRead;
    this._readTok++; if (this.read) { this.read = false; this.hooks.onRead?.(false); }
    this.desk.visible = true; this.cover.visible = true; this.deskMat.opacity = 0;
    this._setMap(this.coverIn, s.tex);
    await this.anim(CLOSE_MS, (t) => {
      this._fold(s, 1 - easeInOut(clamp(t / 0.25)));
      const e = easeInOut(clamp((t - 0.2) / 0.5));
      this.cover.rotation.z = Math.PI * (1 - e);
      this.leftStack.visible = this.leftSurface.visible = e < 0.5;
      this.mixOpen = 1 - smooth(clamp((t - 0.3) / 0.6));
      this.mixRead = lerp(m0, 0, smooth(clamp(t / 0.4)));
      this.deskMat.opacity = clamp((t - 0.35) / 0.45);
    });
    this.gutter.visible = false; this.read = false; this.mixRead = 0;
    this.stage = 'closed'; this.busy = false; this.kick();
    this.hooks.onClosed?.();
  }

  go(dir) { return this.goTo(this.cur + dir); }

  /** Pasa a la vista n. Si está lejos, varias hojas giran en cadena (una tras otra, superpuestas). */
  async goTo(n) {
    if (this.busy || this.stage !== 'open' || n === this.cur || n < 0 || n >= this.n) return;
    const cur = this.cur, dir = n > cur ? 1 : -1, k = Math.abs(n - cur);
    this.busy = true; this._live(-1); this._cancelAuto(); if (this.read) this.setRead(false);   // al pasar la hoja vuelve la toma general
    const idx = []; for (let i = Math.min(cur, n); i <= Math.max(cur, n); i++) idx.push(i);
    await Promise.all(idx.map((i) => this.ensure(i)));
    const from = this.spreads[cur], to = this.spreads[n], leaves = [];
    for (let j = 0; j < k; j++) {
      const leaf = this._getLeaf(j);
      if (dir > 0) { this._setMap(leaf.front, this.spreads[cur + j].tex); this._setMap(leaf.back, this.spreads[cur + j + 1].tex); }
      else { this._setMap(leaf.front, this.spreads[cur - j - 1].tex); this._setMap(leaf.back, this.spreads[cur - j].tex); }
      this._curl(leaf, dir > 0 ? 0 : 1); leaf.group.visible = true; leaves.push(leaf);
    }
    if (dir > 0) this._setMap(this.rightSurface, to.tex); else this._setMap(this.leftSurface, to.tex);
    const D = k === 1 ? 1620 : 1200, ST = 190, T0 = 45, lastStart = T0 + (k - 1) * ST, T = lastStart + D * 1.17;
    let early = false;
    await this.anim(T, (t) => {
      if (!early && t > 0.78) { early = true; this._autoReadNow(); }   // el zoom empieza mientras las figuras terminan de subir
      const ms = t * T;
      this._fold(from, 1 - easeInOut(clamp(ms / 330)));                       // la escena que sale se pliega rápido
      leaves.forEach((leaf, j) => {
        const v = clamp((ms - T0 - j * ST) / D), e = easeInOut(v);
        this._curl(leaf, dir > 0 ? e : 1 - e);
        leaf.group.position.y = LEAF_LIFT + lerp(k - 1 - j, j, smooth(v)) * 0.0009;   // pila ordenada, sin parpadeos
      });
      this._riseAt(to, clamp(0.03 + 0.83 * ((ms - lastStart) / D)), 0.36, 0.62);   // sube antes de que caiga la última hoja
    });
    this._all(to).forEach((r) => r.set(1, true));
    if (dir > 0) this._setMap(this.leftSurface, to.tex); else this._setMap(this.rightSurface, to.tex);
    leaves.forEach((l) => { l.group.visible = false; l.group.position.y = LEAF_LIFT; });
    this.cur = n; this._live(n); this.busy = false;
    this.hooks.onTurn?.(n); this.kick(); this._afterSettle();
  }

  // ---- la hoja sigue al dedo ----
  _dragStart(dir) {
    const cur = this.cur, n = cur + dir, from = this.spreads[cur], to = this.spreads[n];
    this.busy = true; this._live(-1); this._cancelAuto(); if (this.read) this.setRead(false);
    const leaf = this._getLeaf(0);
    if (dir > 0) { this._setMap(leaf.front, from.tex); this._setMap(leaf.back, to.tex); this._setMap(this.rightSurface, to.tex); }
    else { this._setMap(leaf.front, to.tex); this._setMap(leaf.back, from.tex); this._setMap(this.leftSurface, to.tex); }
    this._curl(leaf, dir > 0 ? 0 : 1); leaf.group.visible = true; leaf.group.position.y = LEAF_LIFT;
    this.drag = { dir, n, from, to, leaf, param: 0.03 };
  }
  /** param 0..1 es el mismo reloj de la animación normal: la hoja va de 0.03 a 0.86 y la escena nueva sigue subiendo hasta 1. */
  _dragApply(param) {
    const d = this.drag; if (!d) return;
    d.param = param;
    const v = clamp((param - 0.03) / 0.83);
    this._curl(d.leaf, d.dir > 0 ? v : 1 - v);
    this._fold(d.from, 1 - easeInOut(clamp(v / 0.27)));
    this._riseAt(d.to, param, 0.36, 0.62);
    this.kick();
  }
  async _dragEnd(commit) {
    const d = this.drag; if (!d) return;
    const p0 = d.param;
    if (commit) {
      let early = false;
      await this.anim(Math.max(260, (1 - p0) * 1700), (t) => { if (!early && t > 0.55) { early = true; this._autoReadNow(); } this._dragApply(lerp(p0, 1, 1 - (1 - t) * (1 - t))); });
      this._all(d.to).forEach((r) => r.set(1, true));
      if (d.dir > 0) this._setMap(this.leftSurface, d.to.tex); else this._setMap(this.rightSurface, d.to.tex);
      d.leaf.group.visible = false; this.cur = d.n; this.drag = null; this._live(d.n); this.busy = false;
      this.hooks.onTurn?.(d.n); this.kick(); this._afterSettle();
    } else {
      await this.anim(Math.max(200, p0 * 700), (t) => this._dragApply(lerp(p0, 0.03, easeInOut(t))));
      this._all(d.from).forEach((r) => r.set(1, true)); this._all(d.to).forEach((r) => r.set(0, true));
      if (d.dir > 0) this._setMap(this.rightSurface, d.from.tex); else this._setMap(this.leftSurface, d.from.tex);
      d.leaf.group.visible = false; this.drag = null; this._live(this.cur); this.busy = false;
      this.kick(); this._afterSettle();
    }
  }

  /** Vuelve hasta la portada: pasa las hojas hacia atrás y cierra el libro. */
  async toCover() {
    if (this.stage !== 'open' || this.busy) return;
    if (this.cur !== 0) await this.goTo(0);
    await this.close();
  }

  // ---------------- entrada ----------------
  _events() {
    const c = this.canvas;
    const span = () => Math.min(c.clientWidth * 0.55, 520);   // recorrido del dedo para pasar la hoja completa
    c.addEventListener('pointerdown', (e) => {
      this.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, ly: e.clientY, orbit: false, drag: false, dir: 0, samples: [[performance.now(), e.clientX]] };
      try { c.setPointerCapture(e.pointerId); } catch {}
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.ptr; if (!p || p.id !== e.pointerId || this.stage !== 'open') return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.samples.push([performance.now(), e.clientX]); if (p.samples.length > 6) p.samples.shift();
      if (!p.orbit && !p.drag) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.3) p.orbit = true;
        else if (!p.noFollow && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          const dir = dx < 0 ? 1 : -1, n = this.cur + dir;
          if (!this.busy && n >= 0 && n < this.n && this.spreads[n].loaded) { p.drag = true; p.dir = dir; this._dragStart(dir); } else p.noFollow = true;
        }
      }
      if (p.orbit) { this.pitch = clamp(this.pitch + (e.clientY - p.ly) * 0.003, 0.55, 1.35); p.ly = e.clientY; this._cams(); this.kick(); }
      if (p.drag) { const along = (p.dir > 0 ? -dx : dx) - 10; this._dragApply(0.03 + 0.83 * clamp(along / span())); }
    });
    c.addEventListener('pointerup', (e) => {
      const p = this.ptr; if (!p || p.id !== e.pointerId) return; this.ptr = null;
      if (p.drag) {
        const sm = p.samples, a = sm[0], z = sm[sm.length - 1], vx = (z[1] - a[1]) / Math.max(1, z[0] - a[0]);
        const v = clamp((this.drag.param - 0.03) / 0.83), fling = (p.dir > 0 ? -vx : vx) > 0.45;
        this._dragEnd(v > 0.33 || (fling && v > 0.05)); return;
      }
      if (p.orbit) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.15) { if (this.stage === 'open') { if (dx > 0 && this.cur === 0) this.hooks.onCloseRequest?.(); else this.go(dx < 0 ? 1 : -1); } else if (this.stage === 'closed') this.hooks.onOpenRequest?.(); }
      else if (Math.hypot(dx, dy) < 10) this._tap(e);
    });
    c.addEventListener('pointercancel', () => { const p = this.ptr; this.ptr = null; if (p?.drag) this._dragEnd(false); });
    let wheelAt = 0;
    c.addEventListener('wheel', (e) => { const now = performance.now(); if (now - wheelAt < 900 || Math.abs(e.deltaY) < 20) return; wheelAt = now; this.go(e.deltaY > 0 ? 1 : -1); }, { passive: true });
    c.addEventListener('webglcontextlost', (e) => e.preventDefault());
    c.addEventListener('webglcontextrestored', () => this.kick());
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(c);
  }

  _tap(e) {
    if (this.stage === 'closed') { this.hooks.onOpenRequest?.(); return; }
    if (this.stage !== 'open' || this.busy) return;
    const s = this.spreads[this.cur]; if (!s?.card) return;
    const r = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.raycaster.intersectObject(s.card.front, false)[0];
    if (!hit?.uv) return;
    const cd = s.cardData, x = hit.uv.x * cd.canvas.width, y = (1 - hit.uv.y) * cd.canvas.height;
    const reg = cd.regions.find((q) => x >= q.x - 10 && x <= q.x + q.w + 10 && y >= q.y - 10 && y <= q.y + q.h + 10);
    if (reg) this.hooks.onAction?.(reg.action);
  }

  dispose() {
    this._ro?.disconnect(); cancelAnimationFrame(this.raf);
    this.spreads.forEach((s) => { clearInterval(s.timer); this._all(s).forEach((g) => g.dispose()); s.tex?.dispose(); });
    this.renderer?.dispose();
  }
}
