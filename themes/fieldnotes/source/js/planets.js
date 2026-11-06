/* Interstellar voyage: a god's-eye map of knowledge galaxies, a first-person flight from
   the cockpit to the chosen one, and its planet on arrival. The destination tabs and panels
   work without WebGL; the 3D flight is an enhancement. */
import {createCockpit, formatRange} from './voyage-cockpit.js';

// Engine start: how long the button spools up, and what it counts down.
const IGNITION = 1300;
const COUNTDOWN = [[0, '引擎点火'], [350, '3'], [650, '2'], [950, '1']];

const host = document.querySelector('[data-planets]');
if (host) setup(host);

function setup(root) {
  const stage = root.closest('[data-cinema-stage]') || root.parentElement;
  const canvas = stage.querySelector('[data-voyage-canvas]');
  const status = root.querySelector('[data-voyage-status]');
  const tabs = [...root.querySelectorAll('[data-planet-tab]')];
  const panels = [...root.querySelectorAll('[data-planet-panel]')];
  const engages = [...root.querySelectorAll('[data-voyage-engage]')];
  const returns = [...root.querySelectorAll('[data-voyage-return]')];
  const items = tabs.map(tab => ({name: tab.dataset.name || tab.textContent.trim(), type: tab.dataset.planet, count: tab.querySelector('small')?.textContent || ''}));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 0;
  let voyage = null;
  let refocus = false;
  let igniting = false;
  const busy = () => igniting || root.dataset.state === 'warp';

  const say = text => { if (status) status.textContent = text; };
  function setState(state, index) {
    root.dataset.state = state;
    stage.classList.toggle('is-warping', state === 'warp');
    stage.classList.toggle('is-landed', state === 'planet');
    engages.forEach(button => { button.hidden = !voyage || state !== 'map'; });
    returns.forEach(button => { button.hidden = !voyage || state !== 'planet'; });
    const name = items[index]?.name || '';
    if (state === 'map') say('星图 · 已锁定「' + items[selected].name + '」，点「启动跃迁」出发');
    if (state === 'warp') say('跃迁中 · 目的地「' + name + '」');
    if (state === 'planet') say('已抵达「' + name + '」· 拖动可以旋转星球');
    // The pressed button hides during the flight; hand focus to its counterpart on arrival.
    if (refocus && state !== 'warp') {
      refocus = false;
      panels[selected].querySelector(state === 'map' ? '[data-voyage-engage]' : '[data-voyage-return]')?.focus({preventScroll: true});
    }
  }
  function select(index, focusTab) {
    selected = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      const on = i === selected;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle('is-active', on);
    });
    panels.forEach((panel, i) => { panel.hidden = i !== selected; });
    root.dataset.planet = tabs[selected].dataset.planet;
    if (focusTab) tabs[selected].focus();
    if (!voyage) return;
    if (root.dataset.state === 'planet') voyage.jump(selected);
    else if (root.dataset.state === 'map') { voyage.target(selected); setState('map', selected); }
  }
  // The button spools up and counts down while the ship rumbles, then the warp begins.
  function ignite() {
    if (!voyage || busy() || root.dataset.state !== 'map') return;
    refocus = true;
    if (reduce.matches) { voyage.engage(selected); return; }
    const button = panels[selected].querySelector('[data-voyage-engage]');
    const label = button.querySelector('[data-engage-label]');
    const idle = label.textContent;
    igniting = true;
    button.classList.add('is-igniting');
    stage.classList.add('is-igniting');
    say('引擎点火 · 目的地「' + items[selected].name + '」');
    voyage.charge(selected, IGNITION);
    COUNTDOWN.forEach(([at, text]) => setTimeout(() => { label.textContent = text; }, at));
    setTimeout(() => {
      igniting = false;
      button.classList.remove('is-igniting');
      stage.classList.remove('is-igniting');
      label.textContent = idle;
      voyage.engage(selected);
    }, IGNITION);
  }
  const keys = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => { if (!busy()) select(i); });
    tab.addEventListener('keydown', event => {
      if (busy()) return;
      if (event.key in keys) { event.preventDefault(); select(selected + keys[event.key], true); }
      else if (event.key === 'Home') { event.preventDefault(); select(0, true); }
      else if (event.key === 'End') { event.preventDefault(); select(tabs.length - 1, true); }
    });
  });
  root.addEventListener('click', event => {
    if (event.target.closest('[data-voyage-engage]')) ignite();
    else if (event.target.closest('[data-voyage-return]') && voyage) { refocus = true; voyage.home(); }
  });

  import('../vendor/three/three.module.min.js').then(THREE => {
    voyage = createVoyage(THREE, {
      canvas,
      stage,
      labels: stage.querySelector('[data-voyage-labels]'),
      flash: stage.querySelector('[data-voyage-flash]'),
      focus: root.querySelector('[data-voyage-focus]'),
      items,
      pick(index) {
        if (root.dataset.state !== 'map' || igniting) return;
        if (index === selected) ignite();
        else select(index);
      },
      state: setState
    });
    root.dataset.ready = 'true';
    voyage.target(selected);
    setState('map', selected);
  }).catch(error => {
    root.dataset.fallback = 'true';
    console.warn('Voyage unavailable:', error.message);
  });
}

function createVoyage(T, {canvas, stage, labels, flash, focus, items, pick, state: report}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const idleStill = () => document.documentElement.classList.contains('cinema-paused') || reduce.matches;
  const renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(MAP_FOV, 1, 0.1, 1500);
  scene.add(camera);
  scene.add(new T.AmbientLight(0x8899ff, 0.14));
  const sun = new T.DirectionalLight(0xffffff, 2.8);
  // Light from the side so every world shows a terminator.
  sun.position.set(...SUN);
  scene.add(sun);
  const rim = new T.DirectionalLight(0x6ee7ff, 0.7);
  rim.position.set(6, -1, -5);
  scene.add(rim);
  scene.add(deepSky(T));

  const universe = new T.Group();
  scene.add(universe);
  const density = Math.min(1, Math.max(0.45, (innerWidth * innerHeight) / (1440 * 900)));
  const galaxies = items.map((item, index) => buildGalaxy(T, item.type, index, density));
  galaxies.forEach(galaxy => universe.add(galaxy.group));
  const backdrop = nebulae(T);
  const foreground = nearStars(T);
  universe.add(backdrop, foreground);
  const route = buildRoute(T);
  const beacon = shipBeacon(T);
  universe.add(route.object, beacon);

  const system = new T.Group();
  system.visible = false;
  scene.add(system);
  const pivot = new T.Group();
  system.add(pivot);
  const planets = new Map();
  const planetAt = index => {
    if (!planets.has(index)) planets.set(index, lightOnly(T, buildPlanet(T, items[index].type || 'ocean', index)));
    return planets.get(index);
  };
  let landed = null;
  function showPlanet(index) {
    if (landed) pivot.remove(landed);
    landed = planetAt(index);
    pivot.add(landed);
    pivot.rotation.set(0, 0, 0);
  }

  const streaks = warpStreaks(T);
  camera.add(streaks.object);
  const cockpit = createCockpit(stage);
  lightOnly(T, scene);

  // HTML labels follow the projected galaxy centres; the tabs remain the accessible controls.
  const labelEls = items.map((item, index) => {
    const label = document.createElement('div');
    label.className = 'voyage-label';
    label.innerHTML = '<span class="planet-dot is-' + item.type + '"></span><span></span><small></small>';
    label.children[1].textContent = item.name;
    label.children[2].textContent = item.count;
    label.addEventListener('click', () => pick(index));
    labels.append(label);
    return label;
  });
  const reticle = document.createElement('span');
  reticle.className = 'voyage-reticle';
  const shipLabel = document.createElement('div');
  shipLabel.className = 'voyage-label is-ship';
  shipLabel.textContent = '当前位置';
  const routeLabel = document.createElement('div');
  routeLabel.className = 'voyage-route-label';
  labels.append(reticle, shipLabel, routeLabel);

  const view = {width: 1, height: 1, fx: 0, fy: 0, cx: 0, cy: 0, axis: 0, squeeze: 1, mapDistance: 60, planetUnit: 7};
  const look = new T.Vector3();
  const temp = new T.Vector3();
  const pa = new T.Vector3();
  const pb = new T.Vector3();
  const right = new T.Vector3();
  const pointer = {x: 0, y: 0, sx: 0, sy: 0, motion: 0};
  // The map camera eases toward a goal pose chosen for the current route.
  const cam = {pos: new T.Vector3(), look: new T.Vector3(), goalPos: new T.Vector3(), goalLook: new T.Vector3()};
  const forward = new T.Vector3();
  const across = new T.Vector3();
  const lift = new T.Vector3();
  const UP = new T.Vector3(0, 1, 0);
  // A scratch camera for trying out viewpoints.
  const probe = new T.PerspectiveCamera(MAP_FOV, 1, 0.1, 1500);
  let mode = 'map';
  let targetIndex = 0;
  let hereIndex = -1;
  let flight = null;
  let charge = null;
  let visible = true;
  let frame = 0;
  let last = performance.now();
  let dirty = true;
  let clock = 0;
  const drag = {active: false, x: 0, y: 0, vx: 0, vy: 0};

  // A low, slightly raised viewpoint looks across the map, so galaxies stack in depth.
  const mapPose = (distance = view.mapDistance) => new T.Vector3(0, Math.sin(MAP_ELEVATION) * distance, Math.cos(MAP_ELEVATION) * distance);
  // Ringed worlds ask for a wider frame so their rings stay on screen.
  const planetPose = () => {
    const distance = view.planetUnit * (landed?.userData.frame || 2.6);
    return new T.Vector3(0, distance * 0.03, distance);
  };
  const galaxyCentre = index => galaxies[index].group.getWorldPosition(new T.Vector3());
  function placeCamera(position, lookAt, fov) {
    camera.position.copy(position);
    look.copy(lookAt);
    camera.lookAt(look);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  // The optical axis sits on the focus box on the map and on arrival, and slides to the
  // middle of the visible screen for the first-person flight, under the cockpit HUD.
  function setAxis(amount) {
    view.axis = amount;
    const x = view.fx + (view.cx - view.fx) * amount;
    const y = view.fy + (view.cy - view.fy) * amount;
    camera.setViewOffset(view.width, view.height, view.width / 2 - x, view.height / 2 - y, view.width, view.height);
    flash?.style.setProperty('--fx', x.toFixed(0) + 'px');
    flash?.style.setProperty('--fy', y.toFixed(0) + 'px');
  }
  // The stage can be taller than the window on phones: fly in the part that is on screen.
  function enterCockpit(target, range) {
    const box = canvas.getBoundingClientRect();
    const top = Math.max(0, -box.top);
    const bottom = Math.min(box.height, innerHeight - box.top);
    view.cx = box.width / 2;
    view.cy = bottom > top ? (top + bottom) / 2 : box.height / 2;
    cockpit.show(true, {target, range, top, height: bottom > top ? bottom - top : box.height});
  }

  function screenOf(galaxy) {
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    galaxy.group.getWorldPosition(pa);
    pb.copy(pa).addScaledVector(right, galaxy.radius);
    pa.project(camera);
    pb.project(camera);
    return {
      x: (pa.x * 0.5 + 0.5) * view.width,
      y: (-pa.y * 0.5 + 0.5) * view.height,
      r: Math.hypot((pb.x - pa.x) * view.width, (pb.y - pa.y) * view.height) / 2,
      behind: pa.z > 1
    };
  }

  // Galaxy depths are a share of the camera distance, so near-big / far-small reads the
  // same on every screen. The distance itself is solved so the map fits around the focus box.
  function placeMap(distance) {
    // Raising each galaxy by its depth times the camera's tilt cancels the depth-only shift on
    // screen, so the framing scales cleanly with distance and the fit converges.
    const rise = distance * Math.tan(MAP_ELEVATION);
    galaxies.forEach(galaxy => {
      galaxy.group.position.set(galaxy.x * view.squeeze, galaxy.y + galaxy.depth * rise, galaxy.depth * distance);
    });
    backdrop.scale.setScalar(distance / 50);
    foreground.scale.setScalar(distance / 50);
    beacon.scale.setScalar(distance / 50);
    universe.updateMatrixWorld(true);
  }
  function fitMap(area) {
    // Leave the floating header pill clear at the top.
    const room = {side: Math.min(view.fx, view.width - view.fx) * 0.94, top: Math.min(view.fy - 96, area.height * 0.85), bottom: area.height * 0.5 + (view.width < 720 ? -6 : 10)};
    view.room = {left: view.fx - room.side, right: view.fx + room.side, top: view.fy - room.top, bottom: view.fy + room.bottom};
    // On tall, narrow screens the map stacks more vertically so galaxies can stay large.
    view.squeeze = Math.max(0.55, Math.min(1, (room.side * 2) / (room.top + room.bottom)));
    const rest = universe.rotation.clone();
    universe.rotation.set(0, 0, 0);
    let distance = 60;
    for (let pass = 0; pass < 4; pass++) {
      placeMap(distance);
      placeCamera(mapPose(distance), temp.set(0, 0, 0), MAP_FOV);
      let need = 0;
      galaxies.forEach(galaxy => {
        const {x, y, r} = screenOf(galaxy);
        const dx = x - view.fx;
        const dy = y - view.fy;
        need = Math.max(need, (Math.abs(dx) + r) / room.side, (r - dy) / room.top, (dy + r * 0.7 + 34) / room.bottom);
      });
      distance = Math.max(20, Math.min(600, distance * need));
    }
    view.mapDistance = distance;
    placeMap(distance);
    // Far galaxies sit a little dimmer, which helps the eye read depth.
    galaxies.forEach(galaxy => galaxy.setDim(Math.max(0.55, Math.min(1, 1.3 - 0.45 * galaxy.group.getWorldPosition(pa).distanceTo(camera.position) / distance))));
    universe.rotation.copy(rest);
    universe.updateMatrixWorld(true);
  }

  function layout() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    view.width = width;
    view.height = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const box = canvas.getBoundingClientRect();
    const area = focus.getBoundingClientRect();
    view.fx = area.left - box.left + area.width / 2;
    view.fy = area.top - box.top + area.height / 2;
    const size = Math.max(160, Math.min(area.width, area.height));
    view.planetUnit = (height / 2) / (size * 0.5 * Math.tan(T.MathUtils.degToRad(16)));
    // Re-solving the map mid-flight would move the destination; catch up after landing.
    if (flight || charge) {
      view.stale = true;
      setAxis(view.axis);
      return kick();
    }
    view.stale = false;
    setAxis(0);
    fitMap(area);
    target(targetIndex, false);
    if (mode === 'map') placeCamera(cam.pos, cam.look, MAP_FOV);
    else if (mode === 'planet') placeCamera(planetPose(), temp.set(0, 0, 0), 32);
    kick();
  }

  function flashOnce() {
    if (!flash) return;
    flash.classList.remove('is-on');
    void flash.offsetWidth;
    flash.classList.add('is-on');
  }
  function setMode(next, index) {
    mode = next;
    labels.classList.toggle('is-hidden', next !== 'map');
    report(next, index);
  }
  function scenery(which) {
    universe.visible = which === 'universe';
    system.visible = which === 'system';
  }

  function target(index, animate = true) {
    targetIndex = index;
    galaxies.forEach((galaxy, i) => {
      galaxy.focus(i === index);
      labelEls[i].classList.toggle('is-active', i === index);
    });
    plotRoute(index, animate);
    kick();
  }

  // Where the ship is parked: the home beacon at first, then beside the last galaxy visited.
  function shipLocal(out) {
    if (hereIndex < 0) return out.set(HOME[0] * view.squeeze, HOME[1] + HOME[2] * view.mapDistance * Math.tan(MAP_ELEVATION), HOME[2] * view.mapDistance);
    const galaxy = galaxies[hereIndex];
    return out.copy(galaxy.group.position).add(lift.set(0, -galaxy.radius * 0.7, galaxy.radius * 0.3));
  }
  const routeLight = () => route.curve ? lightYears(route.curve.getLength()) : 0;
  // Distances read the same on every screen: the map is scaled to a 50-unit camera distance.
  const lightYears = units => 20000 + units * 50 / view.mapDistance * 4500;

  // Like a star chart: plot a route from the ship to the destination, then move the camera to
  // the best viewpoint for it, scored by how clearly the route reads on screen while every
  // galaxy and label stays inside the map's room.
  function plotRoute(index, animate) {
    const draw = animate && !idleStill();
    const from = shipLocal(new T.Vector3());
    beacon.position.copy(from);
    const same = index === hereIndex;
    if (same) route.hide();
    else route.set(from, galaxies[index].group.position, draw);
    routeLabel.textContent = same ? '' : '航线 · ' + formatRange(routeLight());
    universe.updateMatrixWorld(true);
    const ends = same ? null : [0, 0.5, 1].map(u => universe.localToWorld(route.curve.getPoint(u)));
    probe.aspect = camera.aspect;
    probe.setViewOffset(view.width, view.height, view.width / 2 - view.fx, view.height / 2 - view.fy, view.width, view.height);
    probe.updateProjectionMatrix();
    const pos = new T.Vector3();
    const aim = new T.Vector3();
    let best = -Infinity;
    for (const turn of [-0.32, -0.16, 0, 0.16, 0.32]) {
      for (const rise of [0, 0.1]) {
        for (const shift of same ? [0] : [0, 0.25, 0.4]) {
          const azimuth = turn * view.squeeze;
          const elevation = MAP_ELEVATION + rise;
          if (ends) aim.copy(ends[1]).multiplyScalar(shift);
          else aim.set(0, 0, 0);
          pos.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(view.mapDistance * (shift ? 1.04 : 1)).add(aim);
          const score = scoreView(pos, aim, ends) - Math.abs(turn) * 60 - rise * 100;
          if (score > best) { best = score; cam.goalPos.copy(pos); cam.goalLook.copy(aim); }
        }
      }
    }
    if (!draw) { cam.pos.copy(cam.goalPos); cam.look.copy(cam.goalLook); }
  }
  function scoreView(position, aim, ends) {
    probe.position.copy(position);
    probe.lookAt(aim);
    probe.updateMatrixWorld();
    right.setFromMatrixColumn(probe.matrixWorld, 0);
    const toScreen = point => {
      const p = pa.copy(point).project(probe);
      return [(p.x * 0.5 + 0.5) * view.width, (-p.y * 0.5 + 0.5) * view.height];
    };
    const room = view.room;
    // Before the canvas has a size there is no room yet; layout() re-plots once it does.
    if (!room) return 0;
    const outside =(x, y, r, below) => Math.max(0, x + r - room.right) + Math.max(0, room.left - x + r) + Math.max(0, room.top - y + r) + Math.max(0, y + below - room.bottom);
    let score = 0;
    if (ends) {
      const [a, m, b] = ends.map(toScreen);
      score += Math.hypot(m[0] - a[0], m[1] - a[1]) + Math.hypot(b[0] - m[0], b[1] - m[1]);
      score -= (outside(a[0], a[1], 0, 30) + outside(b[0], b[1], 0, 0)) * 5;
    }
    galaxies.forEach(galaxy => {
      galaxy.group.getWorldPosition(pb);
      const [x, y] = toScreen(pb);
      const [ex, ey] = toScreen(pb.addScaledVector(right, galaxy.radius));
      const r = Math.hypot(ex - x, ey - y);
      score -= outside(x, y, r, r * 0.7 + 34) * 3;
    });
    return score;
  }
  function land(index) {
    showPlanet(index);
    hereIndex = index;
    scenery('system');
  }

  const rangeTo = index => index === targetIndex && route.curve ? routeLight() : lightYears(galaxyCentre(index).distanceTo(camera.position));
  function heading() {
    camera.getWorldDirection(temp);
    return (Math.atan2(temp.x, -temp.z) * 180 / Math.PI + 402) % 360;
  }

  // On the map the camera drifts slowly and leans toward the pointer, so near and far
  // galaxies slide past each other.
  function steerMap(dt, coasting) {
    const ease = 1 - Math.exp(-dt / 500);
    const still = idleStill();
    pointer.motion += ((still ? 0 : 1) - pointer.motion) * ease;
    pointer.sx += ((still ? 0 : pointer.x) - pointer.sx) * ease;
    pointer.sy += ((still ? 0 : pointer.y) - pointer.sy) * ease;
    const d = view.mapDistance;
    const glide = still ? 1 : 1 - Math.exp(-dt / 600);
    cam.pos.lerp(cam.goalPos, glide);
    cam.look.lerp(cam.goalLook, glide);
    const sideways = Math.sin(clock * 0.13) * 0.035 * pointer.motion + pointer.sx * 0.08;
    const upward = Math.sin(clock * 0.09 + 1.3) * 0.02 * pointer.motion - pointer.sy * 0.05;
    forward.subVectors(cam.look, cam.pos).normalize();
    across.crossVectors(forward, UP).normalize();
    lift.crossVectors(across, forward);
    camera.position.copy(cam.pos).addScaledVector(across, sideways * d).addScaledVector(lift, upward * d);
    if (charge) camera.position.add(temp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(charge.rumble * d));
    look.copy(cam.look);
    camera.lookAt(look);
    // A dragged map settles back into its composition.
    if (!drag.active && !coasting && !still) {
      const settle = Math.exp(-dt / 1600);
      universe.rotation.x *= settle;
      universe.rotation.y *= settle;
    }
  }

  // Engine spool-up before an engage: the hull rumbles, streaks stir, the target brightens,
  // and the cockpit closes in just before launch.
  function stepCharge(dt) {
    charge.t += dt;
    const p = Math.min(1, charge.t / charge.duration);
    charge.rumble = p * p * 0.003;
    streaks.speed = p * p * 0.06;
    galaxies[charge.index].boost(p);
    if (p > 0.8 && !charge.cockpit) {
      charge.cockpit = true;
      enterCockpit('目的地 · ' + items[charge.index].name, rangeTo(charge.index));
    }
    cockpit.update({phase: '引擎点火', speed: 0.01 * p, range: rangeTo(charge.index), heading: heading(), power: p * 0.25, shake: p * 1.5});
  }

  // A flight: align the nose (banking into the turn), thrust into the warp, a flash, then
  // drop out of warp and slow into orbit (or back over the map). The camera only ever
  // moves forward, matching the streaks.
  function fly(kind, index) {
    if (flight) return;
    const charged = charge?.cockpit;
    charge = null;
    if (reduce.matches) {
      if (kind === 'home') { scenery('universe'); target(index, false); placeCamera(cam.pos, cam.look, MAP_FOV); setMode('map', index); }
      else { land(index); placeCamera(planetPose(), temp.set(0, 0, 0), 32); setMode('planet', index); }
      return kick();
    }
    const start = camera.position.clone();
    let aim;
    let leaveTo;
    let alignTo = null;
    // Engage follows the plotted route: dive to the ship, then fly the arc.
    const path = kind === 'engage' ? route.worldCurve(universe) : null;
    if (path) {
      alignTo = path.getPoint(0).add(lift.set(0, 0.5, 0));
      aim = path.getPoint(0.05);
      leaveTo = path.getPoint(1);
    } else if (kind === 'engage') {
      aim = galaxyCentre(index);
      leaveTo = aim.clone().add(start.clone().sub(aim).normalize().multiplyScalar(1.2));
    } else {
      const d = camera.position.length();
      aim = new T.Vector3(d * 1.2, -d * 0.05, 0);
      leaveTo = start.clone().add(aim.clone().sub(start).normalize().multiplyScalar(d * 2.2));
    }
    camera.updateMatrixWorld();
    const side = temp.copy(aim).applyMatrix4(camera.matrixWorldInverse).x;
    const name = kind === 'home' ? '星图' : items[index].name;
    const range = kind === 'engage' ? rangeTo(index) : kind === 'home' ? 26000 : 4.2;
    flight = {
      kind, index, t: 0, duration: path ? 4200 : kind === 'engage' ? 3400 : 2900, start, aim, leaveTo, path,
      align: path ? 0.26 : 0.18, alignTo: alignTo || start.clone().lerp(leaveTo, 0.03), startLook: look.clone(), startFov: camera.fov,
      bank: side >= 0 ? -1 : 1, name, range, swapped: false, hidden: false
    };
    if (!charged) enterCockpit((kind === 'home' ? '返航 · ' : '目的地 · ') + name, range);
    setMode('warp', index);
    kick();
  }

  function arrive(f) {
    flashOnce();
    if (f.kind === 'home') {
      scenery('universe');
      target(f.index, false);
      f.arriveTo = cam.goalPos.clone();
      f.arriveLook = cam.goalLook.clone();
      f.arriveFrom = f.arriveLook.clone().add(f.arriveTo.clone().sub(f.arriveLook).multiplyScalar(2.8));
      f.endFov = MAP_FOV;
      f.arrivalRange = 2.4;
    } else {
      land(f.index);
      f.arriveTo = planetPose();
      f.arriveFrom = f.arriveTo.clone().multiplyScalar(7);
      f.endFov = 32;
      f.arrivalRange = 0.0006;
      landed.scale.setScalar(0.3);
    }
  }

  function stepFlight(dt) {
    const f = flight;
    f.t = Math.min(1, f.t + dt / f.duration);
    const ALIGN = f.align;
    const SWAP = 0.58;
    const reading = {};
    let speed;
    let roll = 0;
    if (f.t < ALIGN) {
      const p = easeInOut(f.t / ALIGN);
      camera.position.lerpVectors(f.start, f.alignTo, p);
      look.lerpVectors(f.startLook, f.aim, p);
      camera.fov = f.startFov - 4 * p;
      setAxis(p);
      roll = f.bank * Math.sin(p * Math.PI) * 0.2;
      speed = 0.06;
      // The parked-ship beacon would fill the screen as we dive onto it.
      beacon.userData.fade(1 - p);
      Object.assign(reading, {phase: '对准「' + f.name + '」', speed: 0.02 + p * 0.08, range: f.range, power: 0.25});
    } else if (f.t < SWAP) {
      const p = (f.t - ALIGN) / (SWAP - ALIGN);
      const e = easeIn(p);
      if (f.path) {
        const u = e * 0.96;
        f.path.getPoint(u, camera.position).add(lift.set(0, 0.5 * (1 - e), 0));
        f.path.getPoint(Math.min(1, u + 0.05), look);
        // Bank into the arc's turns.
        f.path.getTangent(u, pa);
        f.path.getTangent(Math.min(1, u + 0.1), pb);
        roll = Math.max(-0.3, Math.min(0.3, (pa.z * pb.x - pa.x * pb.z) * 3));
        route.fade(1 - p * 2);
      } else {
        camera.position.lerpVectors(f.alignTo, f.leaveTo, e);
        look.copy(f.aim);
      }
      camera.fov = f.startFov - 4 + (108 - f.startFov) * e;
      setAxis(1);
      roll += Math.sin(clock * 9) * 0.012 * p;
      speed = 0.06 + e * 0.94;
      Object.assign(reading, {phase: p < 0.45 ? '加速' : '跃迁', speed: p < 0.35 ? 0.1 + p / 0.35 * 0.9 : Math.pow(10, (p - 0.35) / 0.65 * 3.6), range: f.range * (1 - e), power: 0.25 + p * 0.75});
    } else {
      if (!f.swapped) { f.swapped = true; arrive(f); }
      const q = (f.t - SWAP) / (1 - SWAP);
      const e = easeOut(q);
      camera.position.lerpVectors(f.arriveFrom, f.arriveTo, e);
      if (f.arriveLook) look.copy(f.arriveLook);
      else look.set(0, 0, 0);
      camera.fov = 104 + (f.endFov - 104) * e;
      setAxis(1 - smoothstep(0.4, 1, q));
      speed = 1 - e;
      if (f.kind !== 'home') landed.scale.setScalar(0.3 + 0.7 * e);
      Object.assign(reading, {phase: q < 0.5 ? '脱离跃迁' : f.kind === 'home' ? '回到星图' : '进入轨道', speed: Math.pow(10, 3.6 - q * 5.6), range: f.arrivalRange * Math.pow(1 - q, 2), power: 1 - e});
      if (q > 0.62 && !f.hidden) { f.hidden = true; cockpit.show(false); }
    }
    // The hull shakes harder the faster we go.
    const shake = speed > 0.55 ? (speed - 0.55) * 0.004 * camera.position.length() : 0;
    if (shake) camera.position.add(temp.set(Math.random() - 0.5, Math.random() - 0.5, 0).multiplyScalar(shake));
    camera.lookAt(look);
    if (roll) camera.rotateZ(roll);
    camera.updateProjectionMatrix();
    streaks.speed = speed;
    cockpit.update({...reading, heading: heading(), roll, shake: speed > 0.55 ? (speed - 0.55) * 8 : 0});
    if (f.t >= 1) {
      flight = null;
      streaks.speed = 0;
      setAxis(0);
      cockpit.show(false);
      beacon.userData.fade(1);
      route.fade(1);
      if (f.kind === 'home') { placeCamera(cam.pos, cam.look, MAP_FOV); setMode('map', f.index); }
      else { landed.scale.setScalar(1); placeCamera(planetPose(), temp.set(0, 0, 0), 32); setMode('planet', f.index); }
      if (view.stale) layout();
    }
  }

  function placeLabels() {
    galaxies.forEach((galaxy, i) => {
      const {x, y, r, behind} = screenOf(galaxy);
      const radius = Math.max(28, r * 0.8);
      labelEls[i].style.transform = 'translate(' + x.toFixed(1) + 'px,' + (y + radius * 0.85 + 6).toFixed(1) + 'px) translate(-50%, 0)';
      labelEls[i].style.opacity = behind ? '0' : '';
      if (i === targetIndex) {
        reticle.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%, -50%)';
        reticle.style.width = reticle.style.height = (radius * 1.6).toFixed(0) + 'px';
      }
    });
    beacon.getWorldPosition(pa).project(camera);
    shipLabel.style.transform = 'translate(' + ((pa.x * 0.5 + 0.5) * view.width).toFixed(1) + 'px,' + ((-pa.y * 0.5 + 0.5) * view.height + 14).toFixed(1) + 'px) translate(-50%, 0)';
    const plotted = route.curve && route.drawn() > 0.6;
    routeLabel.classList.toggle('is-on', Boolean(plotted));
    if (plotted) {
      universe.localToWorld(route.curve.getPoint(0.5, pb)).project(camera);
      routeLabel.style.transform = 'translate(' + ((pb.x * 0.5 + 0.5) * view.width).toFixed(1) + 'px,' + ((-pb.y * 0.5 + 0.5) * view.height - 10).toFixed(1) + 'px) translate(-50%, -100%)';
    }
  }

  function loop(now) {
    frame = 0;
    const dt = Math.min(64, now - last);
    last = now;
    const idle = visible && !idleStill();
    if (idle || flight || charge) {
      clock += dt * 0.001;
      if (landed && system.visible) landed.userData.update(dt);
    }
    const subject = mode === 'map' ? universe : pivot;
    if (!drag.active && (Math.abs(drag.vx) > 0.0001 || Math.abs(drag.vy) > 0.0001)) {
      subject.rotation.y += drag.vx;
      subject.rotation.x = Math.max(-0.4, Math.min(0.4, subject.rotation.x + drag.vy));
      drag.vx *= 0.92;
      drag.vy *= 0.92;
      dirty = true;
    }
    const coasting = Math.abs(drag.vx) > 0.0001 || Math.abs(drag.vy) > 0.0001;
    if (charge) stepCharge(dt);
    if (flight) stepFlight(dt);
    else if (mode === 'map') steerMap(dt, coasting);
    streaks.update(dt);
    if (idle || flight || charge || dirty || coasting) {
      if (universe.visible) {
        const scale = renderer.domElement.height * 0.5 / Math.tan(T.MathUtils.degToRad(camera.fov / 2));
        galaxies.forEach(galaxy => galaxy.update(clock, scale, 56 * renderer.getPixelRatio()));
        route.update(idle ? dt : 1000, clock, renderer.getPixelRatio());
        beacon.userData.update(clock);
      }
      renderer.render(scene, camera);
      if (mode === 'map') placeLabels();
      dirty = false;
    }
    if ((idle || flight || charge || coasting || drag.active) && visible) frame = requestAnimationFrame(loop);
  }
  function kick() {
    dirty = true;
    if (!frame) { last = performance.now(); frame = requestAnimationFrame(loop); }
  }

  canvas.addEventListener('pointerdown', event => {
    if (flight || charge) return;
    drag.active = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.vx = drag.vy = 0;
    canvas.setPointerCapture(event.pointerId);
    kick();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag.active) return;
    const subject = mode === 'map' ? universe : pivot;
    drag.vx = (event.clientX - drag.x) * (mode === 'map' ? 0.003 : 0.006);
    drag.vy = (event.clientY - drag.y) * 0.003;
    drag.x = event.clientX;
    drag.y = event.clientY;
    subject.rotation.y += drag.vx;
    subject.rotation.x = Math.max(-0.4, Math.min(0.4, subject.rotation.x + drag.vy));
    kick();
  });
  const release = () => { drag.active = false; kick(); };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  // Mouse parallax over the whole stage (touch scrolls the page instead).
  stage.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const box = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - box.left) / box.width) * 2 - 1;
    pointer.y = ((event.clientY - box.top) / box.height) * 2 - 1;
  });
  stage.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(layout);
    observer.observe(canvas);
    observer.observe(focus);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) kick(); }).observe(canvas);
  }
  new MutationObserver(kick).observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  setMode('map', 0);
  layout();

  // Build planets while the browser is idle so a landing never waits on texture painting.
  const idleCallback = window.requestIdleCallback || (callback => setTimeout(callback, 300));
  const warm = index => { if (index < items.length) idleCallback(() => { planetAt(index); warm(index + 1); }); };
  setTimeout(() => warm(0), 1500);

  return {
    target,
    charge(index, duration) {
      if (mode !== 'map' || flight) return;
      charge = {index, t: 0, duration, rumble: 0, cockpit: false};
      target(index);
      kick();
    },
    engage: index => { if (mode === 'map') fly('engage', index); },
    jump: index => { if (mode === 'planet' && index !== hereIndex) fly('jump', index); },
    home: () => { if (mode === 'planet') fly('home', hereIndex); }
  };
}

// Additive glows must add light without making the transparent canvas opaque; otherwise
// dim, oversized points punch dark holes in the page background behind the canvas.
// Each glow writes its light premultiplied, with alpha equal to its brightness: alpha only
// grows as much as light is added, and colour never exceeds alpha. (Light with zero alpha
// is invalid on a premultiplied canvas, and current browsers drop it, so the map vanished.)
const LIGHT_ONLY = `
  gl_FragColor.rgb *= gl_FragColor.a;
  gl_FragColor.a = clamp(max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)), 0.0, 1.0);
}`;
function lightOnly(T, root) {
  root.traverse(node => {
    [].concat(node.material || []).forEach(material => {
      if (material.blending !== T.AdditiveBlending) return;
      Object.assign(material, {blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneFactor});
      material.onBeforeCompile = shader => {
        const end = shader.fragmentShader.lastIndexOf('}');
        shader.fragmentShader = shader.fragmentShader.slice(0, end) + LIGHT_ONLY + shader.fragmentShader.slice(end + 1);
      };
    });
  });
  return root;
}

const easeIn = t => t * t * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smoothstep = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

/* ---------- universe ---------- */

// Each knowledge region gets its own kind of galaxy. The archive is an old, armless
// elliptical: a quiet place where the early notes live.
const GALAXY_KINDS = {
  ocean: {arms: 2, pitch: 0.17, bar: 0, colors: ['#fff6e0', '#ffe1b3', '#7dd3fc', '#2563eb'], knots: '#f472b6', dust: '#0b0614'},
  gas: {arms: 2, pitch: 0.2, bar: 0.28, colors: ['#fff1f8', '#fbcfe8', '#c084fc', '#4c1d95'], knots: '#f0abfc', dust: '#0c0418'},
  desert: {arms: 4, pitch: 0.26, bar: 0, flocculent: true, colors: ['#fff4dc', '#fed7aa', '#fb923c', '#9a3412'], knots: '#fda4af', dust: '#140703'},
  ice: {arms: 0, colors: ['#fffaf0', '#f3e3c3', '#cbd5e1', '#475569']},
  lava: {arms: 3, pitch: 0.22, bar: 0.18, colors: ['#fffbe6', '#fde68a', '#f97316', '#991b1b'], knots: '#fb7185', dust: '#140303'}
};
// Map composition: [x, y, depth, tilt, roll]. Depth is a share of the camera distance
// (positive is nearer), so near galaxies read big and far ones small on any screen.
// Tilt turns a disk toward the camera; roll turns it within the frame.
const GALAXY_SPOTS = [
  [-4.55, -1.05, 0.3, 0.95, 0.3],
  [7.5, 3.5, 0, 0.5, -0.55],
  [1.55, 14.7, -0.55, 0.14, 0.4],
  [13.5, -6.75, -0.35, 0.6, 0.2],
  [0, -8.1, 0.1, 0.75, -0.25]
];
const MAP_FOV = 50;
const MAP_ELEVATION = 0.22;
const GALAXY_RADIUS = 6;

const STAR_VERTEX = `
uniform float uTime; uniform float uSpin; uniform float uPhase; uniform float uScale; uniform float uMax;
attribute vec4 aStar; attribute vec4 aColor;
varying vec3 vColor; varying float vFade;
void main() {
  float angle = aStar.y + uPhase + uTime * uSpin + 0.03 * sin(uTime * 0.4 + aColor.w);
  vec4 mv = modelViewMatrix * vec4(cos(angle) * aStar.x, aStar.z, sin(angle) * aStar.x, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.001);
  float px = aStar.w * uScale / depth;
  gl_PointSize = clamp(px, 1.5, uMax);
  vColor = aColor.rgb * min(1.0, px / 1.5) * (0.84 + 0.16 * sin(uTime * 1.9 + aColor.w * 3.0));
  vFade = smoothstep(0.2, 1.6, depth);
}`;
const STAR_FRAGMENT = `
uniform float uOpacity;
varying vec3 vColor; varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  float a = (exp(-d * 7.0) + exp(-d * 2.0) * 0.16) * (1.0 - smoothstep(0.7, 1.0, d)) * uOpacity * vFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

// Shader output skips three's colour management, so colours stay in display (sRGB) space.
const srgb = value => hex(value).map(channel => channel / 255);
const tintAt = (stops, t) => {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
};

let glowMap = null;
function glowTexture(T) {
  if (glowMap) return glowMap;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,.5)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  glowMap = new T.CanvasTexture(canvas);
  glowMap.colorSpace = T.SRGBColorSpace;
  return glowMap;
}

// A galaxy is a painted disk of diffuse light (arms, bar, dust lanes, knots) with a
// cloud of shader-driven stars on top for sparkle and depth during the warp.
function buildGalaxy(T, type, index, density) {
  const kind = GALAXY_KINDS[type] || GALAXY_KINDS.ocean;
  const noise = makeNoise(31 + index * 17);
  const rand = noise.rand;
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-6)) * Math.cos(Math.PI * 2 * rand());
  const R = GALAXY_RADIUS;
  const stops = kind.colors.map(srgb);
  const knots = kind.knots ? srgb(kind.knots) : stops[0];
  const arms = kind.arms;
  const start = kind.bar ? kind.bar * R : R * 0.12;
  const winding = 1 / Math.tan((kind.pitch || 0.3) * Math.PI / 2);
  const armAngle = (k, r) => k * Math.PI * 2 / arms + Math.log(Math.max(r, start) / start) * winding;
  // Angular distance (as arc length) from a point to the nearest arm.
  const armGap = (r, angle) => {
    let best = Infinity;
    for (let k = 0; k < arms; k++) {
      let d = angle - armAngle(k, r);
      d -= Math.round(d / 6.283) * 6.283;
      best = Math.min(best, Math.abs(d) * r);
    }
    return best;
  };
  const stars = [];
  const star = (r, angle, height, size, rgb, bright) => stars.push(r, angle, height, size, rgb[0] * bright, rgb[1] * bright, rgb[2] * bright, rand() * 6.283);
  const total = Math.round(14000 * density);

  if (!arms) {
    // Elliptical: a smooth, slightly flattened swarm with a few globular clusters.
    for (let i = 0; i < total * 0.9; i++) {
      const r = Math.min(R, -Math.log(rand() || 1e-6) * R * 0.22);
      star(r, rand() * 6.283, gauss() * r * 0.5, 0.05 + rand() * 0.08, tintAt(stops, r / R * 1.1), 0.22 + rand() * 0.4);
    }
    for (let c = 0; c < 16; c++) {
      const cr = R * (0.45 + rand() * 0.65), ca = rand() * 6.283, ch = gauss() * R * 0.3;
      for (let i = 0; i < 26; i++) star(cr + gauss() * 0.06, ca + gauss() * 0.06 / cr, ch + gauss() * 0.06, 0.05 + rand() * 0.05, stops[1], 0.6 + rand() * 0.4);
    }
  } else {
    for (let i = 0; i < total * 0.16; i++) {
      const r = Math.abs(gauss()) * R * 0.12;
      star(r, rand() * 6.283, gauss() * R * 0.05, 0.05 + rand() * 0.08, tintAt(stops, r / R * 1.6), 0.35 + rand() * 0.45);
    }
    const armStars = [];
    for (let i = 0; i < total * 0.6; i++) {
      const k = i % arms;
      const r = start + Math.pow(rand(), 0.85) * (R - start);
      const along = (r - start) / (R - start);
      // Cubic scatter keeps a dense crest with long, thin wings.
      const offset = Math.pow(rand(), 2) * (rand() < 0.5 ? -1 : 1) * R * (0.1 + along * 0.2) * (kind.flocculent ? 1.4 : 1);
      const angle = armAngle(k, r) + offset / r + (kind.flocculent ? noise.noise(r * 1.4, k, 0.5) * 0.6 : 0);
      const young = Math.exp(-Math.pow(offset / (R * 0.03), 2));
      const rgb = mix(tintAt(stops, 0.3 + along * 0.7), [0.88, 0.94, 1], young * 0.4);
      star(r, angle, gauss() * R * 0.018, 0.045 + rand() * 0.06, rgb, 0.3 + rand() * 0.5 + young * 0.25);
      if (i % 11 === 0 && along > 0.2 && along < 0.9) armStars.push([r, angle]);
    }
    for (let i = 0; i < total * 0.12; i++) {
      const r = R * Math.pow(rand(), 0.75);
      star(r, rand() * 6.283, gauss() * R * 0.025, 0.04 + rand() * 0.04, tintAt(stops, r / R), 0.1 + rand() * 0.2);
    }
    for (let c = 0; c < 30 && armStars.length; c++) {
      const [cr, ca] = armStars[Math.floor(rand() * armStars.length)];
      const rgb = rand() < 0.7 ? knots : [0.8, 0.9, 1];
      for (let i = 0; i < 10; i++) star(cr + gauss() * 0.06, ca + gauss() * 0.06 / cr, gauss() * 0.03, 0.09 + rand() * 0.13, rgb, 0.6 + rand() * 0.5);
    }
  }
  for (let i = 0; i < total * 0.05; i++) {
    const r = R * (0.2 + rand() * 1.05);
    star(r, rand() * 6.283, gauss() * R * 0.35, 0.04 + rand() * 0.04, tintAt(stops, 0.5), 0.1 + rand() * 0.18);
  }

  const uniforms = {
    uTime: {value: 0},
    // About one turn a minute: slow, but visibly alive.
    uSpin: {value: (0.06 + rand() * 0.04) * (rand() < 0.5 ? -1 : 1)},
    uPhase: {value: rand() * 6.283},
    uScale: {value: 600},
    uMax: {value: 48},
    uOpacity: {value: 0.65}
  };
  const count = stars.length / 8;
  const starAttr = new Float32Array(count * 4);
  const colorAttr = new Float32Array(count * 4);
  const position = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const o = i * 8;
    starAttr.set(stars.slice(o, o + 4), i * 4);
    colorAttr.set(stars.slice(o + 4, o + 8), i * 4);
    position.set([Math.cos(stars[o + 1]) * stars[o], stars[o + 2], Math.sin(stars[o + 1]) * stars[o]], i * 3);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(position, 3));
  geometry.setAttribute('aStar', new T.BufferAttribute(starAttr, 4));
  geometry.setAttribute('aColor', new T.BufferAttribute(colorAttr, 4));
  const points = new T.Points(geometry, new T.ShaderMaterial({uniforms, vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
  points.frustumCulled = false;

  const group = new T.Group();
  const spin = new T.Group();
  group.add(spin);
  let disk = null;
  if (arms) {
    disk = new T.Mesh(new T.PlaneGeometry(R * 2.5, R * 2.5), new T.MeshBasicMaterial({map: paintDisk(T, kind, noise, stops, knots, R, start, armGap), transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending}));
    disk.rotation.x = -Math.PI / 2;
    spin.add(disk);
  }
  const glows = (arms
    ? [[R * 2.4, stops[2], 0.14], [R * 0.9, stops[1], 0.45], [R * 0.3, stops[0], 0.9]]
    : [[R * 2.6, stops[2], 0.2], [R * 1.4, stops[1], 0.5], [R * 0.45, stops[0], 0.9]]
  ).map(([size, rgb, opacity]) => {
    const sprite = new T.Sprite(new T.SpriteMaterial({map: glowTexture(T), color: new T.Color().setRGB(rgb[0], rgb[1], rgb[2], T.SRGBColorSpace), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending}));
    sprite.scale.setScalar(size);
    sprite.userData.opacity = opacity;
    group.add(sprite);
    return sprite;
  });
  group.add(points);
  const [x, y, depth, tilt, roll] = GALAXY_SPOTS[index % GALAXY_SPOTS.length];
  group.position.set(x, y, 0);
  group.rotation.set(tilt, 0, roll);
  let focused = false;
  let dim = 1;
  let boost = 0;
  const apply = () => {
    const level = (focused ? Math.max(dim, 0.85) : 0.75 * dim) * (1 + boost * 0.4);
    uniforms.uOpacity.value = level;
    if (disk) disk.material.opacity = level * (focused ? 0.95 : 0.85);
    glows.forEach(sprite => { sprite.material.opacity = sprite.userData.opacity * level * (focused ? 1.15 : 1) * (1 + boost * 0.5); });
  };
  return {
    group,
    radius: R,
    x,
    y,
    depth,
    focus(on) { focused = on; boost = 0; apply(); },
    setDim(value) { dim = value; apply(); },
    // Engine spool-up: the locked-on galaxy brightens as the charge builds.
    boost(value) { boost = value; apply(); },
    update(time, scale, max) {
      uniforms.uTime.value = time;
      uniforms.uScale.value = scale;
      uniforms.uMax.value = max;
      // Stars advance their angle in the shader; the painted disk turns with them.
      spin.rotation.y = -(uniforms.uPhase.value + time * uniforms.uSpin.value);
    }
  };
}

// Top-down painting of a spiral's diffuse light. Canvas x/y map to the disk's x/z, so
// angles match the star cloud's.
function paintDisk(T, kind, noise, stops, knots, R, start, armGap) {
  const size = 320;
  const span = R * 2.5;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const dustShift = R * 0.055;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px / size - 0.5) * span, z = (py / size - 0.5) * span;
      const r = Math.hypot(x, z);
      const k = (py * size + px) * 4;
      if (r > R * 1.2) { image.data[k + 3] = 0; continue; }
      const angle = Math.atan2(z, x);
      const along = clamp01((r - start) / (R - start));
      const width = R * (0.06 + along * 0.09) * (kind.flocculent ? 1.4 : 1);
      // Ragged edges, a wide soft glow, and pink star-forming knots along the crest.
      const gap = Math.max(0, armGap(r, angle) + noise.fbm(x * 1.4, z * 1.4, 2.2, 3) * width * 1.1);
      const arm = Math.exp(-Math.pow(gap / width, 2)) + Math.exp(-Math.pow(gap / (width * 2.8), 2)) * 0.3;
      const knot = arm > 0.5 ? clamp01((noise.noise(x * 5.5, z * 5.5, 6.1) - 0.28) * 4) * arm : 0;
      const lane = Math.exp(-Math.pow((armGap(r, angle - dustShift / Math.max(r, 0.3)) - 0) / (width * 0.35), 2));
      const clumps = 0.65 + 0.7 * clamp01(noise.fbm(x * 0.9, z * 0.9, 4.2, 3) + 0.5);
      const patch = kind.flocculent ? clamp01(0.4 + noise.fbm(x * 0.6, z * 0.6, 8.1, 3) * 2) : 1;
      const fade = 1 - Math.pow(clamp01(r / (R * 1.15)), 3);
      let light = Math.exp(-r / (R * 0.62)) * (0.16 + arm * 1.15 * clumps * patch) * fade;
      if (r > start * 0.8) light *= 1 - lane * 0.7;
      const bulge = Math.exp(-Math.pow(r / (R * 0.13), 2)) * 1.3;
      const bar = kind.bar ? Math.exp(-Math.pow(Math.abs(x) / start, 4)) * Math.exp(-Math.pow(z / (R * 0.05), 2)) * 0.7 : 0;
      let rgb = tintAt(stops, 0.2 + r / R * 0.9);
      if (knot > 0) { rgb = mix(rgb, knots, clamp01(knot)); light += knot * 0.35 * fade; }
      rgb = mix(rgb, stops[0], clamp01(bulge + bar));
      const value = clamp01(light + bulge + bar);
      image.data[k] = rgb[0] * 255; image.data[k + 1] = rgb[1] * 255; image.data[k + 2] = rgb[2] * 255;
      image.data[k + 3] = Math.round(Math.pow(value, 0.7) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

// Soft, domain-warped clouds painted once into small textures and hung behind the map.
function nebulaTexture(T, seed, from, to) {
  const size = 192;
  const n = makeNoise(seed);
  const a = hex(from), b = hex(to);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * 2 - 1, v = y / size * 2 - 1;
      const falloff = Math.pow(clamp01(1 - Math.hypot(u, v)), 1.5);
      const q = n.fbm(u * 1.5, v * 1.5, 0.3, 4);
      const d = clamp01((n.fbm(u * 2.2 + q * 2, v * 2.2 + q * 2, 1.7, 5) + 0.18) * 1.7) * falloff;
      const rgb = mix(a, b, clamp01(0.5 + q * 1.8));
      const k = (y * size + x) * 4;
      image.data[k] = rgb[0]; image.data[k + 1] = rgb[1]; image.data[k + 2] = rgb[2];
      image.data[k + 3] = Math.round(Math.pow(d, 1.3) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

function nebulae(T) {
  const group = new T.Group();
  [
    [11, '#6d28d9', '#ec4899', [-16, 5, -26], 46, 0.5],
    [12, '#1d4ed8', '#22d3ee', [18, -4, -22], 50, 0.42],
    [13, '#9d174d', '#f97316', [4, 9, -36], 40, 0.3],
    [14, '#0f766e', '#6366f1', [-14, -10, 6], 34, 0.18]
  ].forEach(([seed, from, to, at, size, opacity]) => {
    const cloud = new T.Sprite(new T.SpriteMaterial({map: nebulaTexture(T, seed, from, to), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending}));
    cloud.position.set(...at);
    cloud.scale.setScalar(size);
    cloud.material.rotation = seed;
    group.add(cloud);
  });
  // Far-off galaxies: tiny tilted smudges that give the map depth.
  const noise = makeNoise(77);
  for (let i = 0; i < 26; i++) {
    const u = noise.rand() * 2 - 1, a = noise.rand() * 6.283, s = Math.sqrt(1 - u * u), r = 55 + noise.rand() * 60;
    const smudge = new T.Sprite(new T.SpriteMaterial({map: glowTexture(T), color: ['#fde68a', '#bfdbfe', '#f5d0fe', '#fecaca'][i % 4], transparent: true, opacity: 0.35 + noise.rand() * 0.4, depthWrite: false, blending: T.AdditiveBlending}));
    smudge.position.set(Math.cos(a) * s * r, u * r * 0.6, Math.sin(a) * s * r);
    const w = 1.2 + noise.rand() * 2.4;
    smudge.scale.set(w, w * (0.3 + noise.rand() * 0.5), 1);
    smudge.material.rotation = noise.rand() * 3.14;
    group.add(smudge);
  }
  return group;
}

// Loose stars scattered between the galaxies at many depths. They slide fastest when the
// camera drifts, which is what makes the map read as deep space instead of a backdrop.
function nearStars(T) {
  const noise = makeNoise(91);
  const count = 520;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions.set([(noise.rand() - 0.5) * 90, (noise.rand() - 0.5) * 56, -40 + noise.rand() * 62], i * 3);
    const bright = 0.35 + noise.rand() * 0.65;
    const warm = noise.rand();
    colors.set([bright * (0.85 + warm * 0.15), bright * 0.92, bright * (1 - warm * 0.15)], i * 3);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  return new T.Points(geometry, new T.PointsMaterial({size: 0.24, map: glowTexture(T), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
}

// The far sky: scattered stars plus a dense Milky Way band, shared by the map and planets.
function deepSky(T) {
  const noise = makeNoise(5);
  const positions = [];
  const colors = [];
  const tilt = new T.Euler(1.05, 0, 0.42);
  const v = new T.Vector3();
  const push = (x, y, z, bright, warm) => {
    v.set(x, y, z).applyEuler(tilt);
    positions.push(v.x, v.y, v.z);
    colors.push(bright * (0.85 + warm * 0.15), bright * 0.9, bright * (1 - warm * 0.2));
  };
  for (let i = 0; i < 1800; i++) {
    const u = noise.rand() * 2 - 1, a = noise.rand() * 6.283, s = Math.sqrt(1 - u * u), r = 420 + noise.rand() * 120;
    push(Math.cos(a) * s * r, u * r, Math.sin(a) * s * r, 0.5 + noise.rand() * 0.5, noise.rand());
  }
  for (let i = 0; i < 7000; i++) {
    const a = noise.rand() * 6.283;
    const thick = 0.07 + Math.max(0, noise.noise(Math.cos(a) * 2, Math.sin(a) * 2, 0.5)) * 0.18;
    const lat = (noise.rand() + noise.rand() + noise.rand() - 1.5) * thick;
    const r = 430 + noise.rand() * 60;
    push(Math.cos(a) * Math.cos(lat) * r, Math.sin(lat) * r, Math.sin(a) * Math.cos(lat) * r, 0.25 + noise.rand() * 0.55, noise.rand());
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const sky = new T.Group();
  sky.add(new T.Points(geometry, new T.PointsMaterial({size: 1.5, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false})));
  // A faint glow along the band.
  const haze = nebulaTexture(T, 40, '#312e81', '#93c5fd');
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.283 + 0.4;
    const glow = new T.Sprite(new T.SpriteMaterial({map: haze, color: i % 2 ? '#c4b5fd' : '#bae6fd', transparent: true, opacity: 0.3, depthWrite: false, blending: T.AdditiveBlending}));
    glow.position.set(Math.cos(a) * 460, 0, Math.sin(a) * 460).applyEuler(tilt);
    glow.scale.setScalar(340);
    glow.material.rotation = a;
    sky.add(glow);
  }
  return sky;
}

// The ship's home beacon on the map: [x, y, depth share], like the galaxy spots.
const HOME = [1.3, -5.7, 0.12];
const ROUTE_POINTS = 160;
const ROUTE_VERTEX = `
uniform float uDraw; uniform float uTime; uniform float uPixel;
attribute float aAlong;
varying float vAlpha; varying float vHead;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float pulse = pow(0.5 + 0.5 * sin(aAlong * 46.0 - uTime * 5.0), 8.0);
  vHead = (1.0 - step(1.0, uDraw)) * smoothstep(0.05, 0.0, abs(aAlong - uDraw));
  vAlpha = step(aAlong, uDraw) * (0.45 + 0.55 * pulse) + vHead;
  gl_PointSize = (2.0 + pulse * 1.6 + vHead * 5.0) * uPixel;
}`;
const ROUTE_FRAGMENT = `
uniform vec3 uColor; uniform float uFade;
varying float vAlpha; varying float vHead;
void main() {
  float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5)) * vAlpha * uFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), vHead) * a, 1.0);
}`;
const ROUTE_LINE_VERTEX = `
uniform float uDraw;
attribute float aAlong;
varying float vDrawn;
void main() { vDrawn = step(aAlong, uDraw); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ROUTE_LINE_FRAGMENT = `
uniform vec3 uTrail; uniform float uFade;
varying float vDrawn;
void main() { float a = vDrawn * 0.4 * uFade; if (a < 0.01) discard; gl_FragColor = vec4(uTrail * a, 1.0); }`;

// The navigation route: a dotted arc from the ship to the destination that draws itself
// in, then keeps pulsing toward the target. It is drawn over the galaxies like a chart.
function buildRoute(T) {
  const positions = new Float32Array(ROUTE_POINTS * 3);
  const along = Float32Array.from({length: ROUTE_POINTS}, (_, i) => i / (ROUTE_POINTS - 1));
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('aAlong', new T.BufferAttribute(along, 1));
  const uniforms = {
    uDraw: {value: 1}, uTime: {value: 0}, uFade: {value: 1}, uPixel: {value: 1},
    uColor: {value: new T.Vector3(...srgb('#c6ff3d'))}, uTrail: {value: new T.Vector3(...srgb('#6ee7ff'))}
  };
  const material = (vertexShader, fragmentShader) => new T.ShaderMaterial({uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending});
  const line = new T.Line(geometry, material(ROUTE_LINE_VERTEX, ROUTE_LINE_FRAGMENT));
  const dots = new T.Points(geometry, material(ROUTE_VERTEX, ROUTE_FRAGMENT));
  line.frustumCulled = dots.frustumCulled = false;
  line.renderOrder = dots.renderOrder = 3;
  const object = new T.Group();
  object.add(line, dots);
  object.visible = false;
  let curve = null;
  return {
    object,
    get curve() { return curve; },
    set(from, to, animate) {
      const rise = new T.Vector3(0, from.distanceTo(to) * 0.22, 0);
      curve = new T.CubicBezierCurve3(from.clone(), from.clone().lerp(to, 0.3).add(rise), from.clone().lerp(to, 0.7).add(rise), to.clone());
      curve.getPoints(ROUTE_POINTS - 1).forEach((point, i) => positions.set([point.x, point.y, point.z], i * 3));
      geometry.attributes.position.needsUpdate = true;
      uniforms.uDraw.value = animate ? 0 : 1;
      uniforms.uFade.value = 1;
      object.visible = true;
    },
    hide() { curve = null; object.visible = false; },
    fade(value) { uniforms.uFade.value = Math.max(0, value); },
    drawn: () => uniforms.uDraw.value,
    update(dt, time, pixel) {
      uniforms.uDraw.value = Math.min(1, uniforms.uDraw.value + dt / 900);
      uniforms.uTime.value = time;
      uniforms.uPixel.value = pixel;
    },
    worldCurve(parent) {
      if (!curve) return null;
      parent.updateMatrixWorld(true);
      const [a, b, c, d] = [curve.v0, curve.v1, curve.v2, curve.v3].map(point => point.clone().applyMatrix4(parent.matrixWorld));
      return new T.CubicBezierCurve3(a, b, c, d);
    }
  };
}

// The parked ship: a pulsing lime beacon with a cyan halo.
function shipBeacon(T) {
  const sprite = (color, size, opacity) => {
    const glow = new T.Sprite(new T.SpriteMaterial({map: glowTexture(T), color, transparent: true, opacity, depthWrite: false, depthTest: false, blending: T.AdditiveBlending}));
    glow.scale.setScalar(size);
    glow.renderOrder = 4;
    return glow;
  };
  const halo = sprite('#6ee7ff', 3.6, 0.35);
  const core = sprite('#e4ff9e', 1.2, 1);
  const group = new T.Group();
  group.add(halo, core);
  let level = 1;
  group.userData.fade = value => { level = Math.max(0, value); };
  group.userData.update = time => {
    const beat = 0.5 + 0.5 * Math.sin(time * 3);
    core.material.opacity = level;
    halo.material.opacity = level * (0.2 + beat * 0.25);
    halo.scale.setScalar(3 + beat * 1.4);
  };
  return group;
}

// Warp streaks live in camera space: points rush toward the viewer and stretch into
// lines as speed rises, which reads as first-person travel at any camera position.
function warpStreaks(T) {
  const count = 420;
  const positions = new Float32Array(count * 6);
  const stars = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() * 9;
    stars.push({x: Math.cos(angle) * r, y: Math.sin(angle) * r, z: -Math.random() * 160});
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const material = new T.LineBasicMaterial({color: '#cfe8ff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending});
  const object = new T.LineSegments(geometry, material);
  object.frustumCulled = false;
  object.visible = false;
  const api = {
    object,
    speed: 0,
    update(dt) {
      if (api.speed < 0.01) { object.visible = false; return; }
      object.visible = true;
      material.opacity = Math.min(1, api.speed * 1.3);
      const length = 0.4 + api.speed * 26;
      stars.forEach((star, i) => {
        star.z += dt * api.speed * 0.32;
        if (star.z > -0.5) star.z = -160 - Math.random() * 40;
        positions.set([star.x, star.y, star.z, star.x, star.y, star.z - length], i * 6);
      });
      geometry.attributes.position.needsUpdate = true;
    }
  };
  return api;
}

/* ---------- planets ---------- */

const PALETTES = {
  ocean: {atmosphere: '#6ee7ff', glow: '#6ee7ff', tilt: 0.35},
  gas: {atmosphere: '#d8b4fe', glow: '#e9d5ff', tilt: 0.42, halo: [1.76, 2.2]},
  desert: {atmosphere: '#ffc98a', glow: '#fde68a', tilt: 0.3},
  ice: {atmosphere: '#bfdbfe', glow: '#93c5fd', tilt: 0.5},
  lava: {atmosphere: '#f97316', glow: '#fb923c', tilt: 0.15}
};

function buildPlanet(T, type, index) {
  const recipe = PALETTES[type] || PALETTES.ocean;
  const group = new T.Group();
  group.rotation.z = recipe.tilt;
  const updates = [];
  const surface = paintSurface(type, 700 + index * 31);
  const material = new T.MeshStandardMaterial({map: texture(T, surface.color), roughness: type === 'ice' ? 0.6 : 0.92, metalness: 0});
  if (surface.glow) {
    material.emissiveMap = texture(T, surface.glow);
    material.emissive = new T.Color(0xffffff);
    material.emissiveIntensity = type === 'lava' ? 1.4 : 0.9;
    // Lava glows everywhere; city lights and knowledge nodes only show on the night side.
    if (type !== 'lava') nightOnly(material);
  }
  const body = new T.Mesh(new T.SphereGeometry(1.6, 96, 64), material);
  group.add(body);
  updates.push(dt => { body.rotation.y += dt * 0.00012; });
  const [haloRadius, haloPower] = recipe.halo || [1.8, 1.8];
  group.add(atmosphere(T, recipe.atmosphere, haloRadius, haloPower));

  if (type === 'ocean') {
    addClouds(T, group, updates, 91);
    addMoon(T, group, updates, {radius: 0.22, color: '#9ca3af', orbit: 2.55, tilt: 0.45, speed: 0.00035, phase: 1});
    addDataRing(T, group, updates, {radius: 2.2, color: recipe.glow, count: 280, tilt: 1.25, speed: 0.00009});
  } else if (type === 'gas') {
    // A high haze layer drifts a little faster than the bands beneath it.
    const haze = new T.Mesh(new T.SphereGeometry(1.615, 96, 64), new T.MeshStandardMaterial({map: texture(T, paintHaze(53)), transparent: true, depthWrite: false, roughness: 1}));
    group.add(haze);
    updates.push(dt => { haze.rotation.y += dt * 0.00005; });
    addRings(T, group, {inner: 2.05, outer: 3.5, tilt: -1.15});
    addMoon(T, group, updates, {radius: 0.16, color: '#e2e8f0', orbit: 4, tilt: -0.22, speed: 0.00028, phase: 0.6});
    addMoon(T, group, updates, {radius: 0.09, color: '#d6c7b8', orbit: 4.5, tilt: 0.26, speed: 0.0002, phase: 3.4});
    group.userData.frame = 3.25;
  } else if (type === 'desert') {
    addClouds(T, group, updates, 47);
    addStation(T, group, updates, {orbit: 2.55, tilt: 0.42, speed: 0.00022});
    addSatellite(T, group, updates, {orbit: 2.1, tilt: -0.95, speed: 0.0006, phase: 0.8});
    addSatellite(T, group, updates, {orbit: 2.35, tilt: 1.15, speed: 0.00045, phase: 2.6});
  } else if (type === 'ice') {
    addBelt(T, group, updates, {inner: 2.05, outer: 2.85, count: 260, tilt: 0.28});
  } else if (type === 'lava') {
    addMoon(T, group, updates, {radius: 0.17, color: '#57534e', orbit: 2.5, tilt: 0.6, speed: 0.0004, phase: 2});
    addDataRing(T, group, updates, {radius: 2.3, color: recipe.glow, count: 200, tilt: 0.95, speed: -0.00012});
  }
  group.userData.update = dt => updates.forEach(update => update(dt));
  return group;
}

function addClouds(T, group, updates, seed) {
  const clouds = new T.Mesh(new T.SphereGeometry(1.63, 64, 48), new T.MeshStandardMaterial({map: texture(T, paintClouds(seed)), transparent: true, depthWrite: false, roughness: 1}));
  group.add(clouds);
  updates.push(dt => { clouds.rotation.y += dt * 0.00018; });
}

// Fade emissive light out on the sunlit side, so lights read as a night-side glow.
function nightOnly(material) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    #if NUM_DIR_LIGHTS > 0
      totalEmissiveRadiance *= 1.0 - smoothstep(-0.25, 0.15, dot(normal, directionalLights[0].direction));
    #endif`);
  };
}

function texture(T, canvas) {
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

// Atmosphere: a back-face halo that fades from the limb out to nothing, plus a thin
// rim on the disc. Both brighten on the side facing the sun.
const SUN = [-6, 2.5, 3.5];
const ATMOSPHERE_VERTEX = 'uniform vec3 uSun; varying vec3 vNormal; varying vec3 vView; varying vec3 vSun; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); vSun = normalize((viewMatrix * vec4(uSun, 0.0)).xyz); gl_Position = projectionMatrix * mv; }';
function atmosphere(T, color, radius, power) {
  const body = 1.6;
  const uniforms = {glow: {value: new T.Color(color)}, uSun: {value: new T.Vector3(...SUN).normalize()}, uEdge: {value: Math.sqrt(1 - Math.pow(body / radius, 2))}, power: {value: power}};
  const shared = {uniforms, vertexShader: ATMOSPHERE_VERTEX, transparent: true, blending: T.AdditiveBlending, depthWrite: false};
  const lit = 'float lit = 0.18 + 0.82 * smoothstep(-0.35, 0.65, dot(normalize(vNormal), vSun));';
  const halo = new T.Mesh(new T.SphereGeometry(radius, 64, 48), new T.ShaderMaterial({
    ...shared,
    side: T.BackSide,
    fragmentShader: 'uniform vec3 glow; uniform float uEdge; uniform float power; varying vec3 vNormal; varying vec3 vView; varying vec3 vSun; void main() { ' + lit + ' float t = clamp(-dot(normalize(vNormal), normalize(vView)) / uEdge, 0.0, 1.0); gl_FragColor = vec4(glow, pow(t, power) * lit * 0.9); }'
  }));
  const rim = new T.Mesh(new T.SphereGeometry(body * 1.004, 64, 48), new T.ShaderMaterial({
    ...shared,
    fragmentShader: 'uniform vec3 glow; varying vec3 vNormal; varying vec3 vView; varying vec3 vSun; void main() { ' + lit + ' float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 3.0); gl_FragColor = vec4(glow, f * lit * 0.55); }'
  }));
  const group = new T.Group();
  group.add(halo, rim);
  return group;
}

function orbitPivot(T, group, tilt, phase) {
  const orbit = new T.Group();
  orbit.rotation.x = tilt;
  orbit.rotation.y = phase || 0;
  group.add(orbit);
  return orbit;
}

function addMoon(T, group, updates, {radius, color, orbit, tilt, speed, phase}) {
  const geometry = new T.IcosahedronGeometry(radius, 3);
  const noise = makeNoise(Math.round(radius * 1000));
  const position = geometry.attributes.position;
  const v = new T.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const n = v.clone().normalize();
    v.addScaledVector(n, noise.fbm(n.x * 3, n.y * 3, n.z * 3, 3) * radius * 0.35);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  const moon = new T.Mesh(geometry, new T.MeshStandardMaterial({color, roughness: 1, flatShading: true}));
  moon.position.x = orbit;
  const holder = orbitPivot(T, group, tilt, phase);
  holder.add(moon);
  updates.push(dt => { holder.rotation.y += dt * speed; moon.rotation.y += dt * 0.0006; });
}

function addDataRing(T, group, updates, {radius, color, count, tilt, speed}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * 0.08;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.04;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const ring = new T.Points(geometry, new T.PointsMaterial({color, size: 0.035, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending}));
  const holder = orbitPivot(T, group, tilt, 0);
  holder.add(ring);
  updates.push(dt => { holder.rotation.y += dt * speed; });
}

function addRings(T, group, {inner, outer, tilt}) {
  const geometry = new T.RingGeometry(inner, outer, 256, 1);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  // Radial profile modelled on Saturn: faint inner ring, bright broad ring, a dark
  // division, a dimmer outer ring with a thin gap, and a narrow ring at the edge.
  const strip = document.createElement('canvas');
  strip.width = 1024;
  strip.height = 4;
  const ctx = strip.getContext('2d');
  const noise = makeNoise(5);
  const cream = hex('#f3d9c0'), lilac = hex('#b9a0f0'), dusk = hex('#6f58b0');
  for (let x = 0; x < 1024; x++) {
    const t = x / 1023;
    let density = 0;
    let rgb = cream;
    if (t < 0.2) { density = 0.1 + t * 0.9; rgb = dusk; }
    else if (t < 0.56) { density = 0.72 + 0.22 * Math.sin((t - 0.2) / 0.36 * Math.PI); rgb = mix(lilac, cream, (t - 0.2) / 0.36); }
    else if (t < 0.615) { density = 0.03; rgb = dusk; }
    else if (t < 0.93) { density = 0.58 - (t - 0.615) * 0.5; rgb = mix(cream, lilac, (t - 0.615) / 0.315); }
    else if (t > 0.955 && t < 0.963) { density = 0.55; }
    if (t > 0.86 && t < 0.868) density *= 0.1;
    density *= 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(t * 280 + noise.noise(t * 40, 0.2, 0.9) * 5));
    density *= 0.85 + noise.noise(t * 140, 1.1, 0.4) * 0.45;
    ctx.fillStyle = 'rgb(' + rgb.map(Math.round).join(',') + ')';
    ctx.globalAlpha = clamp01(density);
    ctx.fillRect(x, 0, 1, 4);
  }
  const map = texture(T, strip);
  const material = new T.MeshStandardMaterial({map, emissiveMap: map, emissive: new T.Color(0xffffff), emissiveIntensity: 0.32, transparent: true, side: T.DoubleSide, depthWrite: false, roughness: 1});
  const mesh = new T.Mesh(geometry, material);
  mesh.rotation.x = tilt;
  group.add(mesh);
}

function addStation(T, group, updates, {orbit, tilt, speed}) {
  const metal = new T.MeshStandardMaterial({color: '#cbd5e1', metalness: 0.8, roughness: 0.32});
  const station = new T.Group();
  station.add(new T.Mesh(new T.TorusGeometry(0.34, 0.045, 12, 48), metal));
  station.add(new T.Mesh(new T.TorusGeometry(0.34, 0.012, 6, 48), new T.MeshBasicMaterial({color: '#6ee7ff'})).translateZ(0.05));
  station.add(new T.Mesh(new T.SphereGeometry(0.08, 16, 12), metal));
  for (let i = 0; i < 4; i++) {
    const spoke = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.68, 6), metal);
    spoke.rotation.z = (i * Math.PI) / 4;
    station.add(spoke);
  }
  station.position.x = orbit;
  station.rotation.y = Math.PI / 2;
  const holder = orbitPivot(T, group, tilt, 0.6);
  holder.add(station);
  updates.push(dt => { holder.rotation.y += dt * speed; station.rotation.x += dt * 0.0012; });
}

function addSatellite(T, group, updates, {orbit, tilt, speed, phase}) {
  const satellite = new T.Group();
  satellite.add(new T.Mesh(new T.BoxGeometry(0.08, 0.08, 0.12), new T.MeshStandardMaterial({color: '#e5e7eb', metalness: 0.7, roughness: 0.3})));
  const panel = new T.MeshStandardMaterial({color: '#1d4ed8', emissive: '#1e3a8a', emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.4, side: T.DoubleSide});
  for (const side of [-1, 1]) {
    const wing = new T.Mesh(new T.PlaneGeometry(0.22, 0.07), panel);
    wing.position.x = side * 0.16;
    satellite.add(wing);
  }
  satellite.position.x = orbit;
  const holder = orbitPivot(T, group, tilt, phase);
  holder.add(satellite);
  updates.push(dt => { holder.rotation.y += dt * speed; });
}

function addBelt(T, group, updates, {inner, outer, count, tilt}) {
  const rocks = new T.InstancedMesh(new T.IcosahedronGeometry(0.045, 0), new T.MeshStandardMaterial({color: '#94a3b8', roughness: 1, flatShading: true}), count);
  const matrix = new T.Matrix4();
  const quaternion = new T.Quaternion();
  const euler = new T.Euler();
  const scale = new T.Vector3();
  const position = new T.Vector3();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = inner + Math.random() * (outer - inner);
    position.set(Math.cos(angle) * r, (Math.random() - 0.5) * 0.12, Math.sin(angle) * r);
    quaternion.setFromEuler(euler.set(Math.random() * 3, Math.random() * 3, Math.random() * 3));
    scale.setScalar(0.4 + Math.random() * 1.4);
    rocks.setMatrixAt(i, matrix.compose(position, quaternion, scale));
  }
  rocks.instanceMatrix.needsUpdate = true;
  const holder = orbitPivot(T, group, tilt, 0);
  holder.add(rocks);
  updates.push(dt => { holder.rotation.y += dt * 0.00006; });
}

/* ---------- procedural textures ---------- */

function makeNoise(seed) {
  const p = new Uint8Array(512);
  const perm = Array.from({length: 256}, (_, i) => i);
  let state = (seed * 2654435761) >>> 0 || 1;
  const rand = () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (hash, x, y, z) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  };
  function noise(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w
    );
  }
  function fbm(x, y, z, octaves = 5) {
    let sum = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) { sum += amp * noise(x * freq, y * freq, z * freq); freq *= 2; amp *= 0.5; }
    return sum;
  }
  return {noise, fbm, rand};
}

const hex = value => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = t => Math.max(0, Math.min(1, t));
const ramp = (stops, t) => {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
};

// Paint an equirectangular map from 3D noise sampled on the unit sphere, so the
// texture has no seam at the date line and no pinching at the poles.
function paint(width, height, shade, withGlow) {
  const color = document.createElement('canvas');
  color.width = width;
  color.height = height;
  const colorData = color.getContext('2d').createImageData(width, height);
  let glow = null;
  let glowData = null;
  if (withGlow) {
    glow = document.createElement('canvas');
    glow.width = width;
    glow.height = height;
    glowData = glow.getContext('2d').createImageData(width, height);
  }
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    const lat = (0.5 - (y + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width) * Math.PI * 2;
      out[3] = 0;
      shade(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon), lat, out);
      const k = (y * width + x) * 4;
      colorData.data[k] = out[0]; colorData.data[k + 1] = out[1]; colorData.data[k + 2] = out[2]; colorData.data[k + 3] = 255;
      if (glowData) {
        glowData.data[k] = out[4] * out[3]; glowData.data[k + 1] = out[5] * out[3]; glowData.data[k + 2] = out[6] * out[3]; glowData.data[k + 3] = 255;
      }
    }
  }
  color.getContext('2d').putImageData(colorData, 0, 0);
  if (glow) glow.getContext('2d').putImageData(glowData, 0, 0);
  return {color, glow};
}

function paintSurface(type, seed) {
  const n = makeNoise(seed);
  const set = (out, rgb) => { out[0] = rgb[0]; out[1] = rgb[1]; out[2] = rgb[2]; };
  const glowColor = (out, rgb) => { out[4] = rgb[0]; out[5] = rgb[1]; out[6] = rgb[2]; };
  if (type === 'gas') {
    // Banded giant: many belts of varying width and tone, sheared at their edges, one
    // large oval storm whose bands swirl inside it, and a string of small white ovals.
    const tones = ['#2d1b4e', '#4a2f72', '#6b4b93', '#8f6fb0', '#b597c7', '#d4bcd6', '#e9d6d8', '#d9ae96'].map(hex);
    const stormCore = hex('#f6c3a2'), stormEye = hex('#fff1e6'), pearl = hex('#fbf7ff');
    const storm = {lat: -0.42, lon: 2.3};
    const pearls = [0, 1, 2, 3, 4].map(i => ({lat: 0.6, lon: -2.6 + i * 0.62}));
    const offset = (lon, lat, p, w, h) => {
      let dLon = lon - p.lon;
      dLon -= Math.round(dLon / 6.283) * 6.283;
      return [dLon * Math.cos(lat) / w, (lat - p.lat) / h];
    };
    // Belts come from noise along latitude, so widths and tones never repeat evenly.
    const band = sy => ramp(tones, 0.12 + 0.76 * clamp01(0.5 + n.fbm(sy * 5.2, 3.1, 0.4, 5) * 0.95 + Math.exp(-sy * sy / 0.02) * 0.1));
    return paint(1024, 512, (x, y, z, lat, out) => {
      const lon = Math.atan2(z, x);
      // Large swirls, mid-size eddies along belt edges, and fine filaments.
      let sy = y + n.fbm(x * 1.4, y * 1.4, z * 1.4, 4) * 0.05 + n.fbm(x * 4, y * 18, z * 4, 3) * 0.03 + n.fbm(x * 9, y * 34, z * 9, 2) * 0.012;
      const [ex, ey] = offset(lon, lat, storm, 0.3, 0.14);
      const d = Math.hypot(ex, ey);
      if (d < 1.8) {
        const spin = Math.pow(1 - d / 1.8, 2) * 3.4;
        sy = Math.sin(storm.lat + (ex * Math.sin(spin) + ey * Math.cos(spin)) * 0.14) + n.fbm(x * 6, y * 6, z * 6, 3) * 0.012;
      }
      let rgb = band(sy);
      if (d < 1.15) rgb = mix(rgb, mix(stormCore, stormEye, clamp01(1 - d * 1.5)), clamp01((1.15 - d) * 1.4) * 0.85);
      if (d > 0.95 && d < 1.3) rgb = mix(rgb, tones[1], (1 - Math.abs(d - 1.12) / 0.18) * 0.3);
      for (const p of pearls) {
        const [px, py] = offset(lon, lat, p, 0.075, 0.045);
        const q = px * px + py * py;
        if (q < 1) rgb = mix(rgb, pearl, (1 - q) * 0.75);
      }
      rgb = mix(rgb, tones[5], clamp01(n.noise(x * 4, y * 90, z * 4) * 1.4) * 0.16);
      rgb = mix(rgb, tones[0], Math.pow(Math.abs(y), 5) * 0.85);
      set(out, rgb);
    });
  }
  if (type === 'desert') {
    // A warm, lived-in world: teal seas, green valleys and golden grassland, amber autumn
    // forest on the hills, rivers, and city lights that come on along the night side.
    const deep = hex('#0b3b5c'), sea = hex('#0e7490'), shallow = hex('#2dd4bf'), beach = hex('#f3dcae');
    const meadow = hex('#5aa83f'), lush = hex('#2f7d32'), grass = hex('#d8b25a'), forest = hex('#c9802f'), ember = hex('#a3612c');
    const rock = hex('#7a6250'), snow = hex('#f6f1e7'), lamp = hex('#ffd58a');
    return paint(768, 384, (x, y, z, lat, out) => {
      if (Math.abs(lat) > 1.22 + n.noise(x * 4, y * 4, z * 4) * 0.12) { set(out, snow); return; }
      const e = n.fbm(x * 1.5 + 2, y * 1.5, z * 1.5, 5) + n.fbm(x * 5, y * 5, z * 5, 3) * 0.12;
      if (e < 0.02) {
        const t = clamp01((e + 0.3) / 0.32);
        set(out, t > 0.85 ? mix(sea, shallow, (t - 0.85) / 0.15) : mix(deep, sea, t / 0.85));
        return;
      }
      const h = clamp01((e - 0.02) / 0.34);
      const wet = n.fbm(x * 2.2 + 9, y * 2.2, z * 2.2, 4);
      const green = mix(meadow, lush, clamp01(wet * 2 + 0.5));
      let rgb = mix(grass, green, clamp01(wet * 2.4 + 0.55));
      rgb = mix(rgb, mix(forest, ember, clamp01(n.noise(x * 9, y * 9, z * 9) + 0.5)), smoothstep(0.45, 0.72, h) * 0.85);
      rgb = mix(rgb, rock, smoothstep(0.8, 0.95, h));
      if (h < 0.05) rgb = mix(beach, rgb, h / 0.05);
      const river = 1 - Math.abs(n.fbm(x * 3.2 + 4, y * 3.2, z * 3.2, 4) * 2);
      if (river > 0.965 && h < 0.6) rgb = mix(rgb, shallow, (river - 0.965) / 0.035 * 0.9);
      set(out, rgb);
      // Towns cluster in the lowlands; faint roads run between them.
      const town = n.noise(x * 26, y * 26, z * 26);
      if (h < 0.4 && town > 0.4) { out[3] = clamp01((town - 0.4) * 5); glowColor(out, lamp); }
      else if (h < 0.45 && Math.abs(n.noise(x * 14 + 3, y * 14, z * 14)) < 0.012) { out[3] = 0.35; glowColor(out, lamp); }
    }, true);
  }
  if (type === 'ice') {
    const dark = hex('#64748b'), light = hex('#e2e8f0'), crack = hex('#60a5fa');
    const craters = Array.from({length: 60}, () => {
      const u = n.rand() * 2 - 1, a = n.rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      return {x: Math.cos(a) * s, y: u, z: Math.sin(a) * s, r: 0.004 + Math.pow(n.rand(), 2.5) * 0.03};
    });
    return paint(640, 320, (x, y, z, lat, out) => {
      let rgb = mix(dark, light, clamp01(n.fbm(x * 2, y * 2, z * 2, 5) + 0.6));
      const ridge = 1 - Math.abs(n.fbm(x * 5 + 3, y * 5, z * 5, 3) * 2);
      if (ridge > 0.9) rgb = mix(rgb, crack, clamp01((ridge - 0.9) / 0.1) * 0.7);
      for (const c of craters) {
        const d = 1 - (x * c.x + y * c.y + z * c.z);
        if (d < c.r) {
          const t = d / c.r;
          rgb = mix(rgb, t > 0.85 ? light : dark, t > 0.85 ? 0.12 : (1 - t) * 0.3);
        }
      }
      set(out, rgb);
    });
  }
  if (type === 'lava') {
    const crust = hex('#1c1917'), ash = hex('#44403c'), hot = hex('#f97316'), core = hex('#fde047');
    return paint(640, 320, (x, y, z, lat, out) => {
      let rgb = mix(crust, ash, clamp01(n.fbm(x * 2.4, y * 2.4, z * 2.4, 5) + 0.5));
      const ridge = 1 - Math.abs(n.fbm(x * 3.5 + 11, y * 3.5, z * 3.5, 4) * 2);
      if (ridge > 0.82) {
        const t = clamp01((ridge - 0.82) / 0.18);
        rgb = mix(hot, core, t);
        out[3] = 0.4 + t * 0.6;
        glowColor(out, mix(hot, core, t));
      }
      set(out, rgb);
    }, true);
  }
  // Ocean world: glowing "knowledge" nodes scattered over the continents.
  const deep = hex('#071a4a'), shallow = hex('#1565c0'), beach = hex('#d9c79a'), low = hex('#1f9e74'), high = hex('#5f7a52'), ice = hex('#eef6ff'), node = hex('#6ee7ff');
  return paint(640, 320, (x, y, z, lat, out) => {
    const e = n.fbm(x * 1.6 + 3, y * 1.6, z * 1.6, 5) + n.fbm(x * 6, y * 6, z * 6, 3) * 0.15;
    if (Math.abs(lat) > 1.18 + n.noise(x * 4, y * 4, z * 4) * 0.12) { set(out, ice); return; }
    if (e > 0.06) {
      const t = clamp01((e - 0.06) / 0.32);
      set(out, t < 0.08 ? beach : mix(low, high, t));
      if (n.noise(x * 70, y * 70, z * 70) > 0.56) { out[3] = 1; glowColor(out, node); }
    } else {
      set(out, mix(deep, shallow, Math.pow(clamp01((e + 0.35) / 0.41), 2)));
    }
  }, true);
}

function paintHaze(seed) {
  const n = makeNoise(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(512, 256);
  for (let y = 0; y < 256; y++) {
    const lat = (0.5 - (y + 0.5) / 256) * Math.PI;
    for (let x = 0; x < 512; x++) {
      const lon = ((x + 0.5) / 512) * Math.PI * 2;
      const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
      const streak = n.fbm(px * 2, py * 32, pz * 2, 4);
      const k = (y * 512 + x) * 4;
      image.data[k] = 246; image.data[k + 1] = 240; image.data[k + 2] = 255;
      image.data[k + 3] = Math.round(clamp01((streak - 0.08) * 2.4) * 50 * (1 - py * py));
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function paintClouds(seed) {
  const n = makeNoise(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(512, 256);
  for (let y = 0; y < 256; y++) {
    const lat = (0.5 - (y + 0.5) / 256) * Math.PI;
    for (let x = 0; x < 512; x++) {
      const lon = ((x + 0.5) / 512) * Math.PI * 2;
      const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
      const c = n.fbm(px * 2.5 + 10, py * 2.5, pz * 2.5, 5);
      const k = (y * 512 + x) * 4;
      image.data[k] = image.data[k + 1] = image.data[k + 2] = 255;
      image.data[k + 3] = Math.round(clamp01((c - 0.02) / 0.3) * 210);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
