// Motor del libro pop-up (three.js). Escrito para esta invitación.
// Escena: libro cerrado sobre un escritorio -> se abre -> fondo oscuro -> cada página es una hoja
// que se voltea hacia arriba, con figuras de papel y una tarjeta de texto que se levantan de la página.
import * as THREE from '../vendor/three.module.min.js';
import { renderCard } from './cards.js';

const W = 3.2, D = 3.6, L = 2.6, LEAN = 0.2, CARD_ELEV = 0.3;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const backOut = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const DELAY = { back: 0, mid: 0.08, fore: 0.16, card: 0.27 };

function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => {
      console.warn('No se pudo cargar la imagen:', src);
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      g.fillStyle = '#f2d9d9'; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = '#9b1c24'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 492);
      g.beginPath(); g.moveTo(10, 10); g.lineTo(502, 502); g.moveTo(502, 10); g.lineTo(10, 502); g.stroke();
      g.fillStyle = '#9b1c24'; g.font = '28px sans-serif'; g.textAlign = 'center'; g.fillText(src, 256, 256);
      res(c);
    };
    im.src = src;
  });
}
const imgSize = (im) => ({ w: im.naturalWidth || im.width, h: im.naturalHeight || im.height });

function makeTex(source, maxAniso) {
  const t = new THREE.Texture(source);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.needsUpdate = true;
  return t;
}

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

// Silueta color papel para el reverso de una figura recortada
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
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function woodTexture() {
  const t = canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3b2414'); gr.addColorStop(0.5, '#4d311d'); gr.addColorStop(1, '#35210f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    let s = 5; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 380; i++) {
      const y = r() * h; g.strokeStyle = `rgba(${r() < 0.5 ? '20,10,4' : '110,72,40'},${0.05 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 * r()); g.stroke();
    }
    g.strokeStyle = 'rgba(10,5,2,0.7)'; g.lineWidth = 3;
    for (let y = 0; y < h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}

function pageTexture() {
  return canvasTex(512, 576, (g, w, h) => {
    g.fillStyle = '#f4ecd9'; g.fillRect(0, 0, w, h);
    let s = 3; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(120,95,60,${0.02 + r() * 0.05})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = '#b08d3c'; g.lineWidth = 3; g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 1; g.strokeRect(28, 28, w - 56, h - 56);
  });
}

function shadowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.65)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

function coverTexture(meta) {
  const w = 800, h = Math.round(800 * (D + 0.1) / (W + 0.2));
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#121010'; g.fillRect(0, 0, w, h);
    let s = 9; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(255,255,255,${0.01 + r() * 0.03})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    const gold = g.createLinearGradient(0, 0, w, h);
    gold.addColorStop(0, '#d9b768'); gold.addColorStop(0.5, '#a67c2e'); gold.addColorStop(1, '#e6c97e');
    g.strokeStyle = gold; g.lineWidth = 6; g.strokeRect(40, 40, w - 80, h - 80);
    g.lineWidth = 2; g.strokeRect(58, 58, w - 116, h - 116);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = gold;
    g.font = '150px "Great Vibes", cursive'; g.fillText(meta.novios[0], w / 2, h * 0.30);
    g.font = '90px "Great Vibes", cursive'; g.fillText('&', w / 2, h * 0.43);
    g.font = '150px "Great Vibes", cursive'; g.fillText(meta.novios[1], w / 2, h * 0.56);
    const d = new Date(meta.fecha);
    g.font = '600 34px "Cormorant Garamond", serif';
    const txt = `${String(d.getDate()).padStart(2, '0')} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getFullYear()}`;
    let x = w / 2 - (txt.length * 15) / 2; g.textAlign = 'left';
    for (const ch of txt) { g.fillText(ch, x, h * 0.70); x += 15 + g.measureText(ch).width * 0.2; }
    // sello rojo
    g.textAlign = 'center';
    g.fillStyle = '#8f1620'; g.beginPath(); g.arc(w / 2, h * 0.83, 46, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d9b768'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h * 0.83, 36, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#e6c97e'; g.font = '44px "Great Vibes", cursive'; g.fillText('J&R', w / 2, h * 0.83 + 2);
  });
}

class Rig {
  constructor(book, o) {
    const { map, backMap, w, h, x, z, delay, finalX, cut, shadowD } = o;
    this.delay = delay; this.finalX = finalX; this.w = w; this.h = h;
    this.group = new THREE.Group(); this.group.position.set(x, 0, z);
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    this.fm = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: cut ? 0.42 : 0, toneMapped: false });
    this.bm = new THREE.MeshBasicMaterial({ map: backMap || null, color: backMap ? 0xffffff : 0xe6dcc6, transparent: true, alphaTest: cut ? 0.42 : 0, side: THREE.BackSide, toneMapped: false });
    this.front = new THREE.Mesh(geo, this.fm); this.back = new THREE.Mesh(geo, this.bm);
    this.group.add(this.front, this.back);
    this.sm = new THREE.MeshBasicMaterial({ map: book.shadowTex, transparent: true, depthWrite: false, opacity: 0 });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.sm);
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.set(x, 0.006, z - shadowD * 0.1);
    this.shadow.scale.set(w * 1.12, shadowD, 1);
    book.scene.add(this.group, this.shadow);
    this.set(0);
  }
  set(r) {
    const q = clamp((r - this.delay) / 0.55);
    const vis = q > 0.001;
    this.group.visible = vis; this.shadow.visible = vis;
    if (!vis) return;
    const e = backOut(q);
    this.group.rotation.x = lerp(-Math.PI / 2, this.finalX, e);
    const o = clamp(q * 2.5);
    for (const m of [this.fm, this.bm]) { m.opacity = o; m.transparent = o < 0.999; }
    this.sm.opacity = clamp(q * 1.4) * 0.9;
  }
  dispose() {
    this.group.parent?.remove(this.group); this.shadow.parent?.remove(this.shadow);
    this.front.geometry.dispose();
    for (const m of [this.fm, this.bm]) { m.map?.dispose?.(); m.dispose(); }
    this.shadow.geometry.dispose(); this.sm.dispose();
  }
}

const SEG = 40;

export class Book {
  constructor(canvas, data, hooks = {}) {
    this.canvas = canvas; this.data = data; this.hooks = hooks;
    this.n = data.spreads.length; this.cur = 0; this.stage = 'closed'; this.busy = false;
    this.anims = new Set(); this.raf = 0; this.camMix = 0; this.spreads = []; this.ptr = null;
    this.date = new Date(data.meta.fecha);
    this.dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.45 : 1;
  }

  async init() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.setClearColor(0x0a0807, 1);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.aniso = Math.min(4, r.capabilities.getMaxAnisotropy());
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.shadowTex = shadowTexture();
    this.raycaster = new THREE.Raycaster();
    this._stage();
    this.spreads = this.data.spreads.map((spec, i) => ({ spec, i, ready: null, leaf: null, rigs: [], card: null, cardData: null, timer: 0 }));
    await this.ensure(0);
    this._events();
    this.resize();
    // precarga silenciosa del resto
    (async () => { for (let i = 1; i < this.n; i++) { try { await this.ensure(i); } catch (e) { console.warn(e); } } })();
  }

  _stage() {
    const S = this.scene;
    this.deskMat = new THREE.MeshBasicMaterial({ map: woodTexture(), transparent: true, toneMapped: false });
    this.desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), this.deskMat);
    this.desk.rotation.x = -Math.PI / 2; this.desk.position.y = -0.09; S.add(this.desk);

    const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.08, D + 0.1), new THREE.MeshBasicMaterial({ color: 0x14100e }));
    base.position.set(0, -0.04, D / 2 + 0.0); S.add(base);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ map: pageTexture(), toneMapped: false }));
    page.rotation.x = -Math.PI / 2; page.position.set(0, 0.002, D / 2); S.add(page);

    // tapa
    this.cover = new THREE.Group(); S.add(this.cover);
    this.coverMats = [
      new THREE.MeshBasicMaterial({ color: 0x14100e, transparent: true }),
      new THREE.MeshBasicMaterial({ map: coverTexture(this.data.meta), transparent: true, toneMapped: false })
    ];
    const box = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.08, D + 0.1), this.coverMats[0]);
    box.position.set(0, 0.04, D / 2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.2, D + 0.1), this.coverMats[1]);
    top.rotation.x = -Math.PI / 2; top.position.set(0, 0.0815, D / 2);
    this.cover.add(box, top);
  }

  // ---- cámara ----
  _solve(points, target, elev, limits) {
    const cam = this.camera; const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev)); const v = new THREE.Vector3();
    let d = 3;
    for (; d < 60; d += 0.12) {
      cam.position.copy(target).addScaledVector(dir, d); cam.lookAt(target); cam.updateMatrixWorld(true);
      let ok = true;
      for (const p of points) { v.copy(p).project(cam); if (Math.abs(v.x) > limits.x || v.y > limits.top || v.y < limits.bottom) { ok = false; break; } }
      if (ok) break;
    }
    return { pos: cam.position.clone(), target: target.clone() };
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const open = [V(-1.7, 0, D + 0.1), V(1.7, 0, D + 0.1), V(-1.7, 0, -0.1), V(1.7, 0, -0.1), V(-1.6, 2.65, -0.55), V(1.6, 2.65, -0.55)];
    this.camOpen = this._solve(open, V(0, 0.95, 1.7), 0.95, { x: 0.96, top: 0.8, bottom: -0.8 });
    const closed = [V(-1.7, 0.1, D + 0.1), V(1.7, 0.1, D + 0.1), V(-1.7, 0.1, -0.1), V(1.7, 0.1, -0.1)];
    this.camClosed = this._solve(closed, V(0, 0, D / 2), 1.15, { x: 0.9, top: 0.9, bottom: -0.72 });
    this._applyCam(); this.kick();
  }

  _applyCam() {
    const m = this.camMix, a = this.camClosed, b = this.camOpen; if (!a || !b) return;
    this.camera.position.lerpVectors(a.pos, b.pos, m);
    const t = new THREE.Vector3().lerpVectors(a.target, b.target, m);
    this.camera.lookAt(t);
  }

  // ---- construcción de una página ----
  ensure(i) {
    const s = this.spreads[i];
    if (!s.ready) s.ready = this._build(s);
    return s.ready;
  }

  async _build(s) {
    const spec = s.spec, i = s.i;
    const [artIm, ...itemIms] = await Promise.all([loadImage(spec.art), ...spec.items.map((it) => loadImage(it.src))]);
    s.leaf = this._makeLeaf(i, makeTex(artIm, this.aniso));
    spec.items.forEach((it, k) => {
      const im = itemIms[k]; const bb = alphaBounds(im); const { w: iw, h: ih } = imgSize(im);
      const bw = (bb.x1 - bb.x0) * iw, bh = (bb.y1 - bb.y0) * ih;
      const sc = Math.min(it.maxWidth / bw, it.maxHeight / bh);
      const map = makeTex(im, this.aniso); map.repeat.set(bb.x1 - bb.x0, bb.y1 - bb.y0); map.offset.set(bb.x0, 1 - bb.y1);
      const back = new THREE.CanvasTexture(silhouette(im)); back.colorSpace = THREE.SRGBColorSpace;
      back.repeat.copy(map.repeat); back.offset.copy(map.offset);
      s.rigs.push(new Rig(this, { map, backMap: back, w: bw * sc, h: bh * sc, x: it.anchor[0], z: it.anchor[1], delay: DELAY[it.layer] ?? 0.1, finalX: -0.1, cut: true, shadowD: 0.35 }));
    });
    const cd = s.cardData = renderCard(spec.card, { date: this.date, expirado: this.data.meta.expiradoTexto }, () => { if (s.card) { s.card.fm.map.needsUpdate = true; this.kick(); } });
    const ct = new THREE.CanvasTexture(cd.canvas); ct.colorSpace = THREE.SRGBColorSpace; ct.anisotropy = this.aniso;
    const cw = 2.95, ch = cw * cd.canvas.height / cd.canvas.width;
    s.card = new Rig(this, { map: ct, w: cw, h: ch, x: 0, z: D - 0.3, delay: DELAY.card, finalX: -Math.PI / 2 + CARD_ELEV, cut: false, shadowD: ch * Math.cos(CARD_ELEV) + 0.2 });
    s.card.shadow.position.z = D - 0.3 - (ch * Math.cos(CARD_ELEV)) / 2;
    s.card.cardTex = ct;
    this.kick();
    return s;
  }

  _makeLeaf(i, tex) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((SEG + 1) * 2 * 3), uv = new Float32Array((SEG + 1) * 2 * 2), idx = [];
    for (let j = 0; j <= SEG; j++) {
      const v = 1 - j / SEG;
      uv.set([0, v, 1, v], j * 4);
      if (j < SEG) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe9e0cb, side: THREE.BackSide, toneMapped: false }));
    front.frustumCulled = back.frustumCulled = false;
    const holder = new THREE.Group(); holder.add(front, back); holder.visible = false; this.scene.add(holder);
    const leaf = { i, geo, holder, front, back, tex, p: 0 };
    this._curl(leaf, 0);
    return leaf;
  }

  _curl(leaf, p) {
    leaf.p = p;
    const pos = leaf.geo.attributes.position;
    const phi0 = LEAN + (1.5 * Math.PI - LEAN) * smooth(p);
    const k = -1.4 * Math.pow(Math.sin(Math.PI * p), 2) / L;
    const Hy = L * Math.cos(LEAN), Hz = -L * Math.sin(LEAN) - leaf.i * 0.006;
    for (let j = 0; j <= SEG; j++) {
      const s = (j / SEG) * L; let dz, dy;
      if (Math.abs(k) < 1e-5) { dz = s * Math.sin(phi0); dy = -s * Math.cos(phi0); }
      else { dz = (Math.cos(phi0) - Math.cos(phi0 + k * s)) / k; dy = -(Math.sin(phi0 + k * s) - Math.sin(phi0)) / k; }
      const y = Hy + dy, z = Hz + dz;
      pos.setXYZ(j * 2, -W / 2, y, z); pos.setXYZ(j * 2 + 1, W / 2, y, z);
    }
    pos.needsUpdate = true;
  }

  _setRise(s, r) { s.rigs.forEach((g) => g.set(r)); s.card?.set(r); }

  // ---- animación ----
  anim(ms, fn) {
    return new Promise((res) => { this.anims.add({ t0: performance.now(), ms: ms * this.dur, fn, res }); this.kick(); });
  }
  kick() { if (!this.raf && this.renderer) this.raf = requestAnimationFrame(this._tick); }
  _tick = (now) => {
    this.raf = 0;
    for (const a of [...this.anims]) {
      const t = clamp((now - a.t0) / a.ms);
      a.fn(t);
      if (t >= 1) { this.anims.delete(a); a.res(); }
    }
    this._applyCam();
    this.renderer.render(this.scene, this.camera);
    if (this.anims.size) this.kick();
  };

  async open() {
    if (this.stage !== 'closed') return;
    this.stage = 'opening';
    const s = await this.ensure(0);
    const FLAT = Math.PI / 2 + LEAN;
    const lf = s.leaf; lf.holder.visible = true; lf.holder.rotation.x = FLAT; lf.holder.position.y = 0.012;
    await this.anim(3200, (t) => {
      this.cover.rotation.x = -Math.PI * ease(clamp(t / 0.5));
      const u = smooth(clamp((t - 0.4) / 0.4));
      lf.holder.rotation.x = FLAT * (1 - u); lf.holder.position.y = 0.012 * (1 - u);
      this.camMix = smooth(clamp((t - 0.3) / 0.6));
      this.deskMat.opacity = 1 - clamp((t - 0.35) / 0.45);
      const co = 1 - clamp((t - 0.55) / 0.2); this.coverMats.forEach((m) => (m.opacity = co));
      this._setRise(s, clamp((t - 0.72) / 0.28));
    });
    this.desk.visible = false; this.cover.visible = false;
    this.stage = 'open'; this.cur = 0; this._sync(); this._live(0); this.hooks.onTurn?.(0);
  }

  _sync() {
    this.spreads.forEach((s, i) => { if (s.leaf) s.leaf.holder.visible = s.leaf.p < 1 && i >= this.cur - 1 && i <= this.cur + 1; });
  }

  _live(i) {
    this.spreads.forEach((s) => { if (s.timer) { clearInterval(s.timer); s.timer = 0; } });
    const s = this.spreads[i];
    if (s?.cardData?.live) s.timer = setInterval(() => { s.cardData.redraw(); s.card.cardTex.needsUpdate = true; this.kick(); }, 1000);
  }

  async go(dir) {
    if (this.busy || this.stage !== 'open') return;
    const n = this.cur + dir; if (n < 0 || n >= this.n) return;
    this.busy = true;
    const to = await this.ensure(n); const from = this.spreads[this.cur];
    const flip = dir > 0 ? from.leaf : to.leaf;
    flip.holder.visible = true; to.leaf.holder.visible = true;
    this._live(-1);
    await this.anim(2300, (t) => {
      this._setRise(from, 1 - ease(clamp(t / 0.4)));
      const p = clamp((t - 0.1) / 0.62);
      this._curl(flip, dir > 0 ? p : 1 - p);
      this._setRise(to, clamp((t - 0.58) / 0.42));
    });
    this.cur = n; this._sync(); this._live(n); this.busy = false;
    this.hooks.onTurn?.(n); this.kick();
  }

  // ---- entrada ----
  _events() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => { this.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { c.setPointerCapture(e.pointerId); } catch {} });
    c.addEventListener('pointerup', (e) => {
      const p = this.ptr; if (!p || p.id !== e.pointerId) return; this.ptr = null;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.15) this.stage === 'open' ? this.go(dx < 0 ? 1 : -1) : this.hooks.onOpenRequest?.();
      else if (Math.hypot(dx, dy) < 10) this._tap(e);
    });
    c.addEventListener('pointercancel', () => (this.ptr = null));
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
    this.spreads.forEach((s) => { clearInterval(s.timer); s.rigs.forEach((g) => g.dispose()); s.card?.dispose(); s.leaf?.geo.dispose(); s.leaf?.tex.dispose(); });
    this.renderer?.dispose();
  }
}
