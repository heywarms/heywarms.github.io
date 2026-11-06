/* Starships for the "start here" route cards: each step flies a bigger ship, from a small
   scout to a cruiser to a heavy carrier. They are built from simple hard-surface parts with
   the same three.js as the star map, and one shared renderer paints each card's canvas.
   The CSS orb inside each slot stays as the fallback. Hovering a card turns its ship toward
   you and opens the throttle. */
const hosts = [...document.querySelectorAll('[data-ship]')];
if (hosts.length) start();

function start() {
  const begin = () => import('../vendor/three/three.module.min.js')
    .then(T => fleet(T, hosts))
    .catch(error => console.warn('Ships unavailable:', error.message));
  if (!('IntersectionObserver' in window)) return begin();
  // Wait until the cards come near the screen, so the star map loads first.
  const watch = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    watch.disconnect();
    begin();
  }, {rootMargin: '400px 0px'});
  hosts.forEach(host => watch.observe(host));
}

function fleet(T, hosts) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new T.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  scene.environment = studio(T, renderer);
  const camera = new T.PerspectiveCamera(24, 1, 0.1, 60);
  const key = new T.DirectionalLight(0xffffff, 2.6);
  key.position.set(-1, 5, 4);
  // The rim takes each card's accent, so the hull edges glow in the route's colour.
  const rim = new T.DirectionalLight(0xffffff, 3.2);
  rim.position.set(3, 1.2, -3);
  scene.add(key, rim);

  // A three-quarter view from behind and a little above, so the engines face the reader.
  const view = new T.Vector3(-0.55, 0.42, 1).normalize();
  const ships = hosts.map((host, index) => {
    const orb = host.querySelector('.deck-orb');
    const css = getComputedStyle(orb || host).getPropertyValue('--o1').trim() || '#6ee7ff';
    const accent = new T.Color(css);
    const build = SHIPS[host.dataset.ship] || SHIPS.scout;
    const parts = build(T, materials(T, accent));
    const fit = fitDistance(T, parts.group);
    const exhaust = engineLight(T, parts.exhausts, css);
    parts.group.add(exhaust.object);
    const ship = new T.Group();
    ship.add(parts.group);
    ship.visible = false;
    scene.add(ship);
    const canvas = document.createElement('canvas');
    host.append(canvas);
    const card = host.closest('.deck-card') || host;
    const state = {host, canvas, ctx: canvas.getContext('2d'), ship, parts, exhaust, accent, hover: 0, target: 0, phase: index * 1.9, visible: true, fit, view: parts.view ? new T.Vector3(...parts.view).normalize() : view};
    card.addEventListener('pointerenter', () => { state.target = 1; kick(); });
    card.addEventListener('pointerleave', () => { state.target = 0; kick(); });
    card.addEventListener('focusin', () => { state.target = 1; kick(); });
    card.addEventListener('focusout', () => { state.target = 0; kick(); });
    return state;
  });

  let width = 0, height = 0, ratio = 1;
  function resize() {
    const box = hosts[0].getBoundingClientRect();
    ratio = Math.min(2, devicePixelRatio || 1);
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    ships.forEach(s => { s.canvas.width = Math.round(width * ratio); s.canvas.height = Math.round(height * ratio); });
    kick();
  }

  function draw(s, time) {
    const h = s.hover;
    const t = reduce.matches ? 0 : time + s.phase;
    s.ship.visible = true;
    s.parts.group.rotation.set(
      Math.sin(t * 0.7) * 0.05 + h * 0.14,
      -0.12 + Math.sin(t * 0.33) * 0.08 - h * 0.28,
      0.06 + Math.sin(t * 0.5) * 0.03 + h * 0.05
    );
    s.parts.group.position.y = Math.sin(t * 1.1) * 0.05 + h * 0.04;
    s.exhaust.set(h, reduce.matches ? 1 : 0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 7.3), ratio * height * 1.5);
    rim.color.copy(s.accent);
    camera.position.copy(s.view).multiplyScalar(s.fit * (1 - h * 0.06));
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
    s.ctx.drawImage(renderer.domElement, 0, 0);
    s.ship.visible = false;
  }

  let frame = 0, last = 0, clock = 0, onScreen = true;
  function loop(now) {
    frame = 0;
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    if (now - last < 30) { frame = requestAnimationFrame(loop); return; }
    last = now;
    clock += dt;
    let busy = false;
    ships.forEach(s => {
      s.hover += (s.target - s.hover) * (1 - Math.exp(-dt * 6));
      if (Math.abs(s.target - s.hover) > 0.002) busy = true;
      if (s.visible) draw(s, clock);
    });
    if ((busy || !reduce.matches) && onScreen && !document.hidden) frame = requestAnimationFrame(loop);
  }
  function kick() { if (!frame) { last = performance.now() - 31; frame = requestAnimationFrame(loop); } }

  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver(entries => {
      entries.forEach(entry => { const s = ships.find(item => item.host === entry.target); if (s) s.visible = entry.isIntersecting; });
      onScreen = ships.some(s => s.visible);
      if (onScreen) kick();
    });
    hosts.forEach(host => seen.observe(host));
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  reduce.addEventListener?.('change', kick);
  addEventListener('resize', resize);
  resize();
  hosts.forEach(host => host.classList.add('is-ready'));
}

/* ---------- Look ---------- */
// A soft studio, so the metal has something to reflect: a bright box above, cool and warm strips.
function studio(T, renderer) {
  const env = new T.Scene();
  env.add(new T.Mesh(new T.SphereGeometry(10, 24, 12), new T.MeshBasicMaterial({color: 0x0a0f1c, side: T.BackSide})));
  const panel = (hex, power, w, h, x, y, z) => {
    const mesh = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({color: new T.Color(hex).multiplyScalar(power), side: T.DoubleSide}));
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  panel(0xffffff, 3.2, 9, 3, 0, 8, 2);
  panel(0xa5dcff, 1.6, 2, 7, -8, 1, 3);
  panel(0xffd7a8, 1.2, 2, 6, 8, 2, -3);
  panel(0x33405c, 0.8, 14, 5, 0, -8, 0);
  const pmrem = new T.PMREMGenerator(renderer);
  const map = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  return map;
}

function materials(T, accent) {
  return {
    hull: new T.MeshStandardMaterial({color: 0xaab3c4, metalness: 0.72, roughness: 0.3}),
    plating: new T.MeshStandardMaterial({color: 0x4a5466, metalness: 0.75, roughness: 0.38}),
    dark: new T.MeshStandardMaterial({color: 0x151a26, metalness: 0.8, roughness: 0.45}),
    glass: new T.MeshStandardMaterial({color: 0x050912, metalness: 0.95, roughness: 0.12, envMapIntensity: 0.55, emissive: accent.clone().multiplyScalar(0.3)}),
    light: new T.MeshBasicMaterial({color: accent.clone().multiplyScalar(1.9)})
  };
}

// Engine light: a hot core with a soft halo at each nozzle, and a plume that grows with
// thrust. Written premultiplied with alpha equal to brightness, so it stays light on the
// transparent canvas.
function engineLight(T, exhausts, css) {
  // Custom shaders skip colour management, so the accent goes in as its display value.
  const uniforms = {uColor: {value: new T.Vector3(...cssRgb(css))}, uThrust: {value: 0}, uFlicker: {value: 1}, uPixel: {value: 1}};
  const blend = {transparent: true, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneFactor, toneMapped: false};
  const group = new T.Group();
  const glowGeo = new T.BufferGeometry();
  glowGeo.setAttribute('position', new T.Float32BufferAttribute(exhausts.flatMap(e => [e.x - 0.02, e.y, e.z]), 3));
  glowGeo.setAttribute('aSize', new T.Float32BufferAttribute(exhausts.map(e => e.size), 1));
  const glow = new T.Points(glowGeo, new T.ShaderMaterial({uniforms, ...blend,
    vertexShader: 'attribute float aSize; uniform float uThrust; uniform float uFlicker; uniform float uPixel; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uPixel * (1.0 + 0.6 * uThrust) * uFlicker / -mv.z; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uThrust; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float halo = exp(-d * d * 4.5) * (0.55 + 0.45 * uThrust); float core = exp(-d * d * 40.0); vec3 c = uColor * halo + vec3(1.0) * core * 0.9; gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0)); }'
  }));
  glow.frustumCulled = false;
  group.add(glow);
  const plumeMaterial = new T.ShaderMaterial({uniforms, ...blend, side: T.DoubleSide,
    vertexShader: 'varying float vAlong; varying float vEdge; void main() { vAlong = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); vEdge = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uThrust; varying float vAlong; varying float vEdge; void main() { float fade = pow(1.0 - vAlong, 1.6) * pow(vEdge, 1.4) * (0.35 + 0.65 * uThrust); vec3 c = mix(uColor, vec3(1.0), 0.25) * fade; gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0)); }'
  });
  const plumes = exhausts.map(e => {
    const plume = new T.Mesh(new T.ConeGeometry(e.radius * 0.95, 1, 18, 1, true), plumeMaterial);
    // Cone tip points along -x, out of the nozzle.
    plume.rotation.z = Math.PI / 2;
    plume.position.set(e.x, e.y, e.z);
    plume.userData.x = e.x;
    plume.userData.length = e.radius * 5.5;
    group.add(plume);
    return plume;
  });
  return {
    object: group,
    set(thrust, flicker, pixel) {
      uniforms.uThrust.value = thrust;
      uniforms.uFlicker.value = flicker;
      uniforms.uPixel.value = pixel;
      plumes.forEach(plume => {
        const length = plume.userData.length * (0.55 + 0.75 * thrust) * flicker;
        plume.scale.set(1, length, 1);
        plume.position.x = plume.userData.x - length / 2;
      });
    }
  };
}
const cssRgb = css => {
  const hex = css.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
};

// Distance at which the ship's length fills the canvas width with a little margin.
function fitDistance(T, group) {
  const box = new T.Box3().setFromObject(group);
  const size = box.getSize(new T.Vector3());
  const span = Math.max(size.x, size.z * 0.8);
  return span * 1.72;
}

/* ---------- Parts ---------- */
// A flat part drawn from above (x forward, z to the side), with bevelled edges.
function plate(T, points, thickness, bevel = 0.018) {
  const shape = new T.Shape(points.map(([x, z]) => new T.Vector2(x, z)));
  const geo = new T.ExtrudeGeometry(shape, {depth: thickness, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6});
  geo.rotateX(Math.PI / 2);
  geo.translate(0, thickness / 2, 0);
  return geo;
}
// A slab drawn from the side (x forward, y up), extruded across the ship.
function profile(T, points, width, bevel = 0.03) {
  const shape = new T.Shape(points.map(([x, y]) => new T.Vector2(x, y)));
  const depth = Math.max(0.001, width - bevel * 2);
  const geo = new T.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6});
  geo.translate(0, 0, -depth / 2);
  return geo;
}
// A hull lofted nose to tail through chamfered cross-sections [x, halfWidth, top, bottom, chamfer].
// Flat shading keeps the armour facets crisp.
function loft(T, sections) {
  const rings = sections.map(([x, w, top, bottom, c]) => [
    [x, top, w - c], [x, top - c, w], [x, bottom + c, w], [x, bottom, w - c],
    [x, bottom, c - w], [x, bottom + c, -w], [x, top - c, -w], [x, top, c - w]
  ]);
  const points = [];
  const tri = (a, b, c) => points.push(...a, ...b, ...c);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < 8; k++) {
      const a = rings[i][k], b = rings[i][(k + 1) % 8], c = rings[i + 1][(k + 1) % 8], d = rings[i + 1][k];
      tri(a, c, b);
      tri(a, d, c);
    }
  }
  const capOf = ring => ring.reduce((sum, p) => sum.map((v, j) => v + p[j] / 8), [0, 0, 0]);
  const nose = rings[0], tail = rings[rings.length - 1];
  for (let k = 0; k < 8; k++) {
    tri(capOf(nose), nose[k], nose[(k + 1) % 8]);
    tri(capOf(tail), tail[(k + 1) % 8], tail[k]);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geo.computeVertexNormals();
  return geo;
}
// Mirror a half outline drawn on the +z side into a closed, symmetric one.
const mirror = half => [...half, ...half.slice().reverse().map(([x, z]) => [x, -z])];
const mesh = (T, geometry, material, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); return m; };
// A thin bar of light (or metal) between two points.
function bar(T, material, from, to, thickness = 0.014) {
  const a = new T.Vector3(...from), b = new T.Vector3(...to);
  const m = new T.Mesh(new T.BoxGeometry(a.distanceTo(b), thickness, thickness), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), b.clone().sub(a).normalize());
  return m;
}
// An engine pod along x, nozzle at the back; reports where its light goes.
function engine(T, kit, radius, length, x, y, z, exhausts, glow = 1) {
  const group = new T.Group();
  const body = new T.Mesh(new T.CylinderGeometry(radius * 1.12, radius, length, 24, 1), kit.plating);
  body.rotation.z = Math.PI / 2;
  const collar = new T.Mesh(new T.TorusGeometry(radius * 1.08, radius * 0.16, 8, 28), kit.dark);
  collar.rotation.y = Math.PI / 2;
  collar.position.x = -length / 2;
  const nozzle = new T.Mesh(new T.CircleGeometry(radius * 0.86, 24), kit.light);
  nozzle.rotation.y = -Math.PI / 2;
  nozzle.position.x = -length / 2 - 0.004;
  group.add(body, collar, nozzle);
  group.position.set(x, y, z);
  exhausts.push({x: x - length / 2, y, z, radius, size: radius * 13 * glow});
  return group;
}

const SHIPS = {
  // Step one: a quick interceptor with cranked delta wings, canards and twin tail fins.
  scout(T, kit) {
    const group = new T.Group();
    const exhausts = [];
    group.add(mesh(T, loft(T, [[1.18, 0.006, 0, -0.012, 0.002], [0.8, 0.07, 0.05, -0.05, 0.025], [0.4, 0.12, 0.1, -0.08, 0.04], [0, 0.15, 0.14, -0.1, 0.05], [-0.5, 0.16, 0.13, -0.1, 0.05], [-0.88, 0.14, 0.1, -0.08, 0.04]]), kit.hull));
    const canopy = mesh(T, new T.SphereGeometry(1, 28, 16), kit.glass, 0.2, 0.135, 0);
    canopy.scale.set(0.34, 0.075, 0.11);
    group.add(canopy);
    group.add(mesh(T, plate(T, mirror([[0.25, 0.13], [-0.25, 0.55], [-0.45, 0.92], [-0.62, 0.94], [-0.62, 0.13]]), 0.035), kit.hull, 0, -0.02, 0));
    group.add(mesh(T, plate(T, mirror([[0.05, 0.15], [-0.3, 0.5], [-0.46, 0.5], [-0.46, 0.15]]), 0.02), kit.plating, 0, 0.012, 0));
    group.add(mesh(T, plate(T, mirror([[0.62, 0.1], [0.42, 0.28], [0.35, 0.28], [0.4, 0.1]]), 0.02), kit.plating, 0, 0.03, 0));
    for (const s of [1, -1]) {
      const fin = mesh(T, profile(T, [[-0.45, 0.1], [-0.82, 0.1], [-0.94, 0.42], [-0.8, 0.42]], 0.025, 0.008), kit.plating, 0, 0, 0.12 * s);
      fin.rotation.x = -0.35 * s;
      group.add(fin);
      group.add(bar(T, kit.light, [0.25, 0.0, 0.135 * s], [-0.25, -0.0, 0.55 * s], 0.022));
      group.add(bar(T, kit.light, [-0.25, 0.0, 0.55 * s], [-0.45, -0.0, 0.92 * s], 0.022));
      group.add(mesh(T, new T.SphereGeometry(0.025, 10, 8), kit.light, -0.55, 0, 0.94 * s));
      const pod = mesh(T, new T.CylinderGeometry(0.025, 0.025, 0.6, 10), kit.dark, -0.1, -0.06, 0.48 * s);
      pod.rotation.z = Math.PI / 2;
      group.add(pod);
      group.add(engine(T, kit, 0.09, 0.45, -0.75, 0, 0.11 * s, exhausts));
    }
    group.add(bar(T, kit.light, [0.68, 0.068, 0], [-0.7, 0.16, 0], 0.014));
    return {group, exhausts};
  },
  // Step two: a cruiser with a sharp prow, armour belts, a two-tier bridge and engine nacelles.
  cruiser(T, kit) {
    const group = new T.Group();
    const exhausts = [];
    group.add(mesh(T, loft(T, [[1.32, 0.008, 0, -0.02, 0.004], [0.95, 0.12, 0.09, -0.08, 0.04], [0.35, 0.22, 0.13, -0.15, 0.06], [-0.5, 0.25, 0.15, -0.17, 0.07], [-1.18, 0.22, 0.14, -0.12, 0.06]]), kit.hull));
    group.add(mesh(T, profile(T, [[0.3, 0.1], [0.22, 0.24], [-0.5, 0.24], [-0.62, 0.12]], 0.36, 0.03), kit.hull));
    group.add(mesh(T, plate(T, mirror([[0.22, 0.16], [-0.52, 0.18]]), 0.035), kit.dark, 0, 0.255, 0));
    group.add(mesh(T, new T.BoxGeometry(0.26, 0.1, 0.24), kit.hull, -0.3, 0.32, 0));
    group.add(mesh(T, new T.BoxGeometry(0.16, 0.08, 0.3), kit.plating, -0.34, 0.41, 0));
    group.add(mesh(T, new T.BoxGeometry(0.02, 0.03, 0.28), kit.glass, -0.255, 0.41, 0));
    for (const z of [0.06, -0.06]) group.add(mesh(T, new T.CylinderGeometry(0.007, 0.007, 0.22, 6), kit.plating, -0.4, 0.54, z));
    group.add(mesh(T, new T.SphereGeometry(0.02, 10, 8), kit.light, -0.4, 0.66, 0.06));
    group.add(mesh(T, profile(T, [[-0.2, -0.14], [-0.8, -0.12], [-0.94, -0.32], [-0.55, -0.32]], 0.04, 0.012), kit.plating));
    for (const s of [1, -1]) {
      group.add(mesh(T, profile(T, [[0.72, -0.07], [0.2, 0.07], [-0.85, 0.1], [-1.0, -0.06], [-0.4, -0.14]], 0.06, 0.015), kit.plating, 0, 0, 0.255 * s));
      group.add(bar(T, kit.light, [0.6, 0.0, 0.29 * s], [-0.9, 0.04, 0.29 * s], 0.02));
      const pylon = mesh(T, plate(T, [[-0.25, 0.2], [-0.8, 0.2], [-0.86, 0.46], [-0.42, 0.46]], 0.03), kit.plating, 0, -0.02, 0);
      pylon.scale.z = s;
      group.add(pylon);
      const nacelle = mesh(T, new T.CylinderGeometry(0.1, 0.1, 0.95, 24), kit.plating, -0.5, -0.02, 0.5 * s);
      nacelle.rotation.z = Math.PI / 2;
      group.add(nacelle);
      const nose = mesh(T, new T.ConeGeometry(0.1, 0.32, 24), kit.hull, 0.13, -0.02, 0.5 * s);
      nose.rotation.z = -Math.PI / 2;
      group.add(nose);
      for (const x of [-0.18, -0.7]) {
        const ring = mesh(T, new T.TorusGeometry(0.106, 0.016, 8, 28), kit.light, x, -0.02, 0.5 * s);
        ring.rotation.y = Math.PI / 2;
        group.add(ring);
      }
      group.add(engine(T, kit, 0.1, 0.24, -1.08, -0.02, 0.5 * s, exhausts));
    }
    group.add(engine(T, kit, 0.12, 0.3, -1.26, 0.0, 0, exhausts, 1.2));
    return {group, exhausts};
  },
  // Step three: a wedge-shaped battle carrier with a raised spine, a T-shaped command tower,
  // glowing hangar strips and a cluster of five engines.
  carrier(T, kit) {
    const group = new T.Group();
    const exhausts = [];
    group.add(mesh(T, loft(T, [[1.5, 0.02, 0.02, -0.03, 0.01], [1.1, 0.2, 0.08, -0.1, 0.06], [0.5, 0.42, 0.12, -0.16, 0.1], [-0.4, 0.5, 0.14, -0.18, 0.12], [-1.3, 0.46, 0.13, -0.15, 0.1]]), kit.hull));
    group.add(mesh(T, loft(T, [[1.1, 0.02, 0.15, 0.08, 0.01], [0.6, 0.24, 0.2, 0.1, 0.05], [-1.0, 0.32, 0.22, 0.1, 0.06], [-1.15, 0.28, 0.2, 0.1, 0.05]]), kit.plating));
    group.add(mesh(T, loft(T, [[1.0, 0.02, -0.12, -0.16, 0.01], [0.4, 0.28, -0.12, -0.28, 0.06], [-1.0, 0.34, -0.12, -0.3, 0.08], [-1.15, 0.3, -0.12, -0.26, 0.06]]), kit.dark));
    group.add(mesh(T, profile(T, [[0.95, 0.2], [0.3, 0.27], [-0.9, 0.29], [-1.0, 0.2]], 0.12, 0.02), kit.dark));
    group.add(mesh(T, new T.BoxGeometry(0.36, 0.14, 0.26), kit.hull, -0.72, 0.31, 0));
    group.add(mesh(T, new T.BoxGeometry(0.22, 0.09, 0.4), kit.plating, -0.76, 0.43, 0));
    group.add(mesh(T, new T.BoxGeometry(0.02, 0.03, 0.38), kit.glass, -0.645, 0.43, 0));
    for (const z of [0.08, -0.08]) group.add(mesh(T, new T.CylinderGeometry(0.007, 0.007, 0.26, 6), kit.plating, -0.8, 0.6, z));
    group.add(mesh(T, new T.SphereGeometry(0.022, 10, 8), kit.light, -0.8, 0.74, 0.08));
    for (const s of [1, -1]) {
      group.add(bar(T, kit.light, [0.3, -0.02, 0.475 * s], [-1.0, -0.02, 0.49 * s], 0.035));
      group.add(bar(T, kit.light, [1.1, 0.16, 0.035 * s], [0.6, 0.205, 0.235 * s], 0.016));
      for (const x of [0.5, 0.05, -0.4]) group.add(mesh(T, new T.CylinderGeometry(0.045, 0.055, 0.05, 12), kit.dark, x, 0.24, 0.2 * s));
    }
    group.add(engine(T, kit, 0.13, 0.32, -1.38, 0.0, 0, exhausts, 1.2));
    for (const z of [0.2, -0.2, 0.36, -0.36]) group.add(engine(T, kit, 0.085, 0.28, -1.32, 0.0, z, exhausts));
    // Seen from higher up, so the wedge of the deck shows.
    return {group, exhausts, view: [-0.55, 0.72, 1]};
  }
};
