(() => {
  'use strict';
  // Motion (background videos and the particle sphere) starts only from script,
  // so reduced-motion visitors and visitors without JavaScript see a still frame.
  const root = document.documentElement;
  const videos = [...document.querySelectorAll('video[data-cinema-video]')];
  const canvas = document.querySelector('canvas[data-cinema-sphere]');
  const toggle = document.querySelector('[data-cinema-toggle]');
  const stage = document.querySelector('[data-cinema-stage]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'fieldnotes-cinema-paused';
  const inView = new Map(videos.map(video => [video, false]));
  let paused = false;
  try { paused = sessionStorage.getItem(storageKey) === '1'; } catch (_) {}
  const moving = () => !paused && !reduce.matches && !document.hidden;

  const shown = video => video.getClientRects().length > 0;
  function syncVideo(video) {
    if (moving() && inView.get(video) && shown(video)) {
      if (video.preload === 'none') video.preload = 'auto';
      video.muted = true;
      const playing = video.play();
      if (playing && typeof playing.catch === 'function') playing.catch(() => {});
    } else if (!video.paused) {
      video.pause();
    }
  }

  const sphere = canvas ? createSphere(canvas, moving) : null;
  function syncAll() {
    videos.forEach(syncVideo);
    root.classList.toggle('cinema-paused', !moving());
    sphere?.kick();
  }

  videos.forEach(video => { video.muted = true; video.defaultMuted = true; });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.target === canvas) sphere.setVisible(entry.isIntersecting);
      else { inView.set(entry.target, entry.isIntersecting); syncVideo(entry.target); }
    }), {rootMargin: '160px 0px'});
    videos.forEach(video => observer.observe(video));
    if (canvas) observer.observe(canvas);
  } else {
    videos.forEach(video => inView.set(video, true));
    sphere?.setVisible(true);
  }

  function renderToggle() {
    if (!toggle) return;
    toggle.hidden = (!videos.length && !sphere && !document.querySelector('[data-planets]')) || reduce.matches;
    toggle.setAttribute('aria-pressed', String(paused));
  }
  toggle?.addEventListener('click', () => {
    paused = !paused;
    try { sessionStorage.setItem(storageKey, paused ? '1' : '0'); } catch (_) {}
    renderToggle();
    syncAll();
  });
  reduce.addEventListener('change', () => { renderToggle(); syncAll(); });
  matchMedia('(max-width: 720px)').addEventListener('change', syncAll);
  document.addEventListener('visibilitychange', syncAll);
  renderToggle();
  syncAll();

  // Gentle pointer parallax on the stage, batched to one update per frame.
  if (stage && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      const still = reduce.matches;
      stage.style.setProperty('--mx', still ? '0' : x.toFixed(3));
      stage.style.setProperty('--my', still ? '0' : y.toFixed(3));
      sphere?.point(still ? 0 : x, still ? 0 : y);
    };
    stage.addEventListener('pointermove', event => {
      const box = stage.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
      if (!frame) frame = requestAnimationFrame(apply);
    });
    stage.addEventListener('pointerleave', () => { x = 0; y = 0; if (!frame) frame = requestAnimationFrame(apply); });
  }

  // A Fibonacci sphere of points with neighbour links and two orbit rings,
  // projected with a light perspective. Colours come from --sphere-a/--sphere-b.
  function createSphere(target, animate) {
    const count = 560;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const points = new Float32Array(count * 3);
    const projected = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      points[i * 3] = Math.cos(golden * i) * r;
      points[i * 3 + 1] = y;
      points[i * 3 + 2] = Math.sin(golden * i) * r;
    }
    const pairs = [];
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = points[i * 3] - points[j * 3];
        const dy = points[i * 3 + 1] - points[j * 3 + 1];
        const dz = points[i * 3 + 2] - points[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < 0.028) pairs.push(i * 3, j * 3);
      }
    }
    const rings = [{radius: 1.32, tilt: 1.18, speed: 1, count: 150, tone: 0}, {radius: 1.5, tilt: -0.52, speed: -0.7, count: 180, tone: 1}];
    const fallback = [[110, 231, 255], [167, 139, 250]];
    const parse = (value, index) => {
      const match = /^#([\da-f]{6})$/i.exec(String(value || '').trim());
      if (!match) return fallback[index];
      const n = parseInt(match[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    let colors = fallback;
    let rotation = 0.6;
    let tiltX = 0;
    let tiltY = 0;
    let goalX = 0;
    let goalY = 0;
    let visible = false;
    let frame = 0;
    const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';

    function draw() {
      frame = 0;
      const width = target.clientWidth;
      const height = target.clientHeight;
      if (!width || !height) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      if (target.width !== Math.round(width * ratio) || target.height !== Math.round(height * ratio)) {
        target.width = Math.round(width * ratio);
        target.height = Math.round(height * ratio);
        const style = getComputedStyle(target);
        colors = [parse(style.getPropertyValue('--sphere-a'), 0), parse(style.getPropertyValue('--sphere-b'), 1)];
      }
      const ctx = target.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const running = animate() && visible;
      tiltX += (goalX - tiltX) * 0.06;
      tiltY += (goalY - tiltY) * 0.06;
      if (running) rotation += 0.0024;
      const ry = rotation + tiltX * 0.9;
      const rx = -0.3 + tiltY * 0.45;
      const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      const radius = Math.min(width, height) * 0.25;
      const depth = 5.5;
      const midX = width / 2;
      const midY = height / 2;
      const [a, b] = colors;
      const project = (x, y, z) => {
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y1 = y * cx - z1 * sx;
        const z2 = y * sx + z1 * cx;
        const scale = depth / (depth + z2);
        return [midX + x1 * radius * scale, midY + y1 * radius * scale, z2];
      };

      const glow = ctx.createRadialGradient(midX, midY, 0, midX, midY, radius * 1.5);
      glow.addColorStop(0, rgba(b, 0.32));
      glow.addColorStop(0.45, rgba(a, 0.1));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < points.length; i += 3) {
        const p = project(points[i], points[i + 1], points[i + 2]);
        projected[i] = p[0]; projected[i + 1] = p[1]; projected[i + 2] = p[2];
      }
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = rgba(a, 0.14);
      ctx.beginPath();
      for (let k = 0; k < pairs.length; k += 2) {
        const i = pairs[k], j = pairs[k + 1];
        if (projected[i + 2] < 0.2 && projected[j + 2] < 0.2) {
          ctx.moveTo(projected[i], projected[i + 1]);
          ctx.lineTo(projected[j], projected[j + 1]);
        }
      }
      ctx.stroke();
      for (let i = 0; i < points.length; i += 3) {
        const near = (1 - projected[i + 2]) / 2;
        const mix = (points[i + 1] + 1) / 2;
        const tone = [0, 1, 2].map(c => Math.round(a[c] + (b[c] - a[c]) * mix));
        const size = 0.6 + near * 1.8;
        ctx.fillStyle = rgba(tone, 0.12 + near * 0.88);
        ctx.fillRect(projected[i] - size / 2, projected[i + 1] - size / 2, size, size);
      }
      rings.forEach(ring => {
        const ct = Math.cos(ring.tilt), st = Math.sin(ring.tilt);
        const color = colors[ring.tone];
        const place = angle => {
          const z0 = Math.sin(angle) * ring.radius;
          return project(Math.cos(angle) * ring.radius, -z0 * st, z0 * ct);
        };
        for (let k = 0; k < ring.count; k++) {
          const p = place((k / ring.count) * Math.PI * 2 + rotation * ring.speed * 3);
          const near = Math.max(0, Math.min(1, (1.6 - p[2]) / 3.2));
          ctx.fillStyle = rgba(color, 0.08 + near * 0.5);
          ctx.fillRect(p[0] - 0.6, p[1] - 0.6, 1.2, 1.2);
        }
        for (let k = 0; k < 3; k++) {
          const p = place(k * 2.094 + rotation * ring.speed * 11);
          ctx.fillStyle = rgba(color, 0.2);
          ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalCompositeOperation = 'source-over';

      const settling = Math.abs(goalX - tiltX) > 0.002 || Math.abs(goalY - tiltY) > 0.002;
      if (running || (settling && visible)) frame = requestAnimationFrame(draw);
    }
    const kick = () => { if (!frame) frame = requestAnimationFrame(draw); };
    if ('ResizeObserver' in window) new ResizeObserver(kick).observe(target);
    return {
      kick,
      setVisible(value) { visible = value; kick(); },
      point(x, y) { goalX = x; goalY = y; kick(); }
    };
  }
})();
