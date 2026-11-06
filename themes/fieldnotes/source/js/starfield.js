/* A quiet starfield behind the voyage pages, as if reading from a ship's window: three depth
   layers drift slowly sideways, shift a little as you scroll, twinkle, and now and then a
   meteor slips past. Static under reduced motion; paused while the tab is hidden. */
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('voyage-space')) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'starfield';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // Per layer: how many stars, their radius range (CSS px), drift (px/s), scroll parallax, brightness.
  const LAYERS = [
    {count: 230, size: [0.35, 0.8], drift: 2.5, parallax: 0.03, light: 0.55},
    {count: 110, size: [0.7, 1.3], drift: 5, parallax: 0.07, light: 0.8},
    {count: 34, size: [1.1, 2], drift: 10, parallax: 0.14, light: 1}
  ];
  const TINTS = ['#ffffff', '#dbe7ff', '#bfe9ff', '#ffe9c7', '#eadcff'];
  const sprites = TINTS.map(tint => glow(tint));
  let stars = [];
  let width = 0;
  let height = 0;
  let ratio = 1;
  let frame = 0;
  let last = 0;
  let drawn = 0;
  let meteor = null;
  let nextMeteor = performance.now() + 9000 + Math.random() * 12000;

  function glow(tint) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 32;
    const g = sprite.getContext('2d');
    const gradient = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, tint);
    gradient.addColorStop(0.22, tint);
    gradient.addColorStop(0.45, 'rgba(255,255,255,.18)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 32, 32);
    return sprite;
  }

  function seed() {
    const area = (width * height) / (1440 * 900);
    stars = LAYERS.flatMap((layer, depth) => Array.from({length: Math.round(layer.count * Math.max(0.45, Math.min(1.4, area)))}, () => ({
      depth,
      x: Math.random() * width,
      y: Math.random() * height,
      r: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
      sprite: sprites[Math.random() < 0.6 ? 0 : 1 + Math.floor(Math.random() * (sprites.length - 1))],
      phase: Math.random() * Math.PI * 2,
      pace: 0.4 + Math.random() * 1.4
    })));
  }

  function resize() {
    ratio = Math.min(2, window.devicePixelRatio || 1);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    seed();
    draw(performance.now(), 0);
  }

  function draw(now, dt) {
    ctx.clearRect(0, 0, width, height);
    const scroll = window.scrollY;
    const time = now / 1000;
    for (const star of stars) {
      const layer = LAYERS[star.depth];
      star.x -= layer.drift * dt / 1000;
      if (star.x < -4) star.x += width + 8;
      const y = ((star.y - scroll * layer.parallax) % height + height) % height;
      const twinkle = reduce.matches ? 1 : 0.72 + 0.28 * Math.sin(time * star.pace + star.phase);
      ctx.globalAlpha = layer.light * twinkle;
      const size = star.r * 6;
      ctx.drawImage(star.sprite, star.x - size / 2, y - size / 2, size, size);
    }
    if (meteor) drawMeteor(now);
    ctx.globalAlpha = 1;
  }

  // A meteor: a thin streak with a fading tail, crossing a corner of the sky in about a second.
  function launchMeteor(now) {
    const fromRight = Math.random() < 0.5;
    meteor = {
      start: now,
      life: 1100 + Math.random() * 500,
      x: width * (fromRight ? 0.6 + Math.random() * 0.35 : 0.05 + Math.random() * 0.35),
      y: height * Math.random() * 0.35,
      dx: (fromRight ? -1 : 1) * (0.45 + Math.random() * 0.25),
      dy: 0.32 + Math.random() * 0.15,
      length: 140 + Math.random() * 120
    };
    nextMeteor = now + 16000 + Math.random() * 24000;
  }
  function drawMeteor(now) {
    const t = (now - meteor.start) / meteor.life;
    if (t >= 1) { meteor = null; return; }
    const travel = t * Math.hypot(width, height) * 0.45;
    const norm = Math.hypot(meteor.dx, meteor.dy);
    const ux = meteor.dx / norm;
    const uy = meteor.dy / norm;
    const hx = meteor.x + ux * travel;
    const hy = meteor.y + uy * travel;
    const tail = ctx.createLinearGradient(hx, hy, hx - ux * meteor.length, hy - uy * meteor.length);
    tail.addColorStop(0, 'rgba(230,250,255,.9)');
    tail.addColorStop(0.3, 'rgba(110,231,255,.35)');
    tail.addColorStop(1, 'rgba(110,231,255,0)');
    ctx.globalAlpha = Math.sin(Math.PI * t);
    ctx.strokeStyle = tail;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - ux * meteor.length, hy - uy * meteor.length);
    ctx.stroke();
  }

  // About 30 fps is plenty for drifting stars and keeps long reads light on battery.
  function loop(now) {
    frame = requestAnimationFrame(loop);
    if (now - drawn < 32) return;
    const dt = Math.min(100, now - last);
    last = drawn = now;
    if (!meteor && now > nextMeteor) launchMeteor(now);
    draw(now, dt);
  }
  function start() {
    if (frame || reduce.matches || document.hidden) return;
    last = drawn = performance.now();
    frame = requestAnimationFrame(loop);
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  resize();
  window.addEventListener('resize', resize);
  // Under reduced motion the sky stays still, but still follows the page as it scrolls.
  window.addEventListener('scroll', () => { if (!frame) draw(performance.now(), 0); }, {passive: true});
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduce.addEventListener?.('change', () => (reduce.matches ? (stop(), draw(performance.now(), 0)) : start()));
  start();
})();
