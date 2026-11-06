/* =========================================================
   HERO POP-UP 3D (estilo libro de papel)
   - Se desactiva solo si SITE_CONFIG.hero.enabled === false
   - Si Three.js no carga, degrada a una tarjeta de papel CSS
   - Respeta prefers-reduced-motion
   ========================================================= */
(async function () {
  const mount = document.getElementById("popup-book");
  if (!mount) return;

  const C = window.SITE_CONFIG;
  if (!C || !C.hero || !C.hero.enabled || C.hero.type !== "popup-book") return;

  let THREE;
  try {
    THREE = await import("three");
  } catch (err) {
    mount.classList.add("is-fallback");  // CSS muestra tarjeta de papel
    return;
  }

  const scene = C.hero.scene || {};
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Renderer ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    mount.classList.add("is-fallback");   // sin WebGL: tarjeta de papel CSS
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const sceneObj = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 2.5, 4.8);
  camera.lookAt(0, 0.35, 0);

  /* ---------- Luces ---------- */
  sceneObj.add(new THREE.HemisphereLight(0xfffaf0, 0x8a7f6b, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(-3.5, 6, 4.5);
  key.castShadow = true;
  key.shadow.bias = -0.0004;        // evita el moteado ("shadow acne") en las piezas tumbadas
  key.shadow.normalBias = 0.02;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera;
  sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5; sc.near = 0.5; sc.far = 20;
  sceneObj.add(key);

  /* ---------- Materiales papel ---------- */
  const paper = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.96, metalness: 0.0, side: THREE.DoubleSide
  });

  /* ---------- Libro ---------- */
  const W = 2.35, D = 1.9;
  const book = new THREE.Group();
  book.rotation.x = 0.0;
  sceneObj.add(book);

  // Base del libro abierto
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W * 2, 0.09, D),
    paper(scene.bookColor || "#e8dfcf")
  );
  base.position.y = -0.045;
  base.receiveShadow = true;
  book.add(base);

  // Página derecha (suelo impreso)
  const groundGeo = new THREE.PlaneGeometry(W, D);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, paper(scene.groundColor || "#f6f1e7"));
  ground.position.set(W / 2, 0.004, 0);
  ground.receiveShadow = true;
  book.add(ground);

  // Página izquierda (contraportada)
  const left = ground.clone();
  left.position.x = -W / 2;
  book.add(left);

  /* ---------- Piezas pop-up ----------
     Cada pieza es un plano con el pivote en su base.
     rotation.x: -PI/2 (tumbada)  →  0 (de pie)
  ------------------------------------------- */
  const risers = [];

  function addPiece({ w, h, color, x, z, delay = 0 }) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);            // pivote en la base
    const m = new THREE.Mesh(g, paper(color));
    m.position.set(x, 0.006, z);
    m.rotation.x = -Math.PI / 2;         // tumbada
    m.castShadow = true;
    m.receiveShadow = true;
    book.add(m);
    risers.push({ mesh: m, delay });
    return m;
  }

  if (scene.backdrop) {
    addPiece({ ...scene.backdrop, delay: 0 });
  }
  (scene.standees || []).forEach((s, i) => {
    addPiece({ ...s, delay: 0.12 + i * 0.10 });
  });

  /* ---------- Hoja que gira ---------- */
  const leafGeo = new THREE.PlaneGeometry(W * 0.98, D * 0.98);
  leafGeo.rotateX(-Math.PI / 2);
  leafGeo.translate(W / 2, 0, 0);        // se extiende 0 → W en X
  const leaf = new THREE.Mesh(leafGeo, paper(scene.bookColor || "#e8dfcf"));
  leaf.position.y = 0.02;
  leaf.castShadow = true;
  book.add(leaf);

  /* ---------- Estado de animación ---------- */
  let progress = 0;          // 0 = cerrado · 1 = abierto
  let target   = 0;
  let userTurned = false;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function applyProgress(p) {
    // La hoja gira de 0 a PI alrededor del lomo (eje Z)
    leaf.rotation.z = p * Math.PI;

    risers.forEach(r => {
      const local = clamp((p - r.delay) / Math.max(0.001, 1 - r.delay), 0, 1);
      const e = easeOutCubic(local);
      // -PI/2 (tumbada) → 0 (de pie)
      r.mesh.rotation.x = -Math.PI / 2 + (Math.PI / 2) * e;
      // Crecen mientras se levantan: así, con el libro cerrado, no sobresalen de la página
      r.mesh.scale.y = Math.max(e, 0.001);
      r.mesh.visible = e > 0.001;
    });
  }

  /* ---------- Interacción: arrastrar para orbitar ---------- */
  let dragging = false, lastX = 0, lastY = 0;
  let rotY = 0, rotX = 0, idleSway = !reduceMotion;

  const el = renderer.domElement;
  el.style.touchAction = "pan-y";
  el.style.cursor = "grab";

  el.addEventListener("pointerdown", (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
    idleSway = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    rotY += (e.clientX - lastX) * 0.008;
    rotX = clamp(rotX + (e.clientY - lastY) * 0.005, -0.35, 0.5);
    lastX = e.clientX; lastY = e.clientY;
  });
  const stop = () => { dragging = false; el.style.cursor = "grab"; };
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
  el.addEventListener("pointerleave", stop);

  /* ---------- Disparadores de apertura ---------- */
  function openBook() {
    if (userTurned) return;
    userTurned = true;
    target = 1;
  }

  // El canvas es decorativo (el contenedor está aria-hidden); el botón
  // "Abrir invitación" es el control accesible.
  el.addEventListener("click", openBook);

  const btn = document.getElementById("hero-open");
  if (btn) btn.addEventListener("click", openBook);

  // Se abre automáticamente al entrar en viewport (una vez)
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { setTimeout(openBook, 650); io.disconnect(); }
      });
    }, { threshold: 0.55 });
    io.observe(mount);
  } else if (reduceMotion) {
    target = 1; progress = 1; applyProgress(1);
  }

  /* ---------- Resize ---------- */
  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Aleja la cámara lo necesario para que el libro completo quepa a lo ancho
    const baseZ = 4.8, baseY = 2.5;
    const needZ = (W * 1.08) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect) + D / 2;
    const z = Math.max(baseZ, needZ);
    camera.position.set(0, baseY * z / baseZ, z);
    camera.lookAt(0, 0.35, 0);
    camera.updateProjectionMatrix();
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(mount);
  window.addEventListener("resize", resize);
  resize();

  /* ---------- Loop ---------- */
  const clock = new THREE.Clock();
  let visible = true;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);

    // Interpolación suave hacia el objetivo
    progress += (target - progress) * Math.min(1, dt * 3.2);
    applyProgress(progress);

    // Rotación del libro
    // Vaivén suave en lugar de giro continuo (así nunca se ve la parte de atrás)
    const sway = idleSway ? Math.sin(clock.elapsedTime * 0.5) * 0.35 : 0;
    book.rotation.y += (rotY + sway - book.rotation.y) * Math.min(1, dt * 6);
    book.rotation.x += (rotX - book.rotation.x) * Math.min(1, dt * 6);

    // Flotación sutil
    if (!reduceMotion) {
      book.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.025;
    }

    if (visible) renderer.render(sceneObj, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Pausa el render cuando no está visible (ahorro de batería)
  if ("IntersectionObserver" in window) {
    const vis = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        visible = en.isIntersecting;
      });
    }, { threshold: 0 });
    vis.observe(mount);
  }
})();