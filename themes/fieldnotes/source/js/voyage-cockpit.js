/* Cockpit overlay for the voyage: a helmet-visor frame, a glass dash and a flight HUD driven
   by the flight controller in planets.js. Decorative only, so it is hidden from assistive tech. */

const repeat = (count, make) => Array.from({length: count}, (_, i) => make(i)).join('');

// A soft vignette and a thin rounded visor edge with corner marks, instead of a solid
// canopy: the view stays open and the frame matches the site's glass UI.
const VISOR = `<div class="cockpit-visor">
  <span class="visor-glass"></span>
  <span class="visor-edge"></span>
  <i class="visor-corner is-tl"></i><i class="visor-corner is-tr"></i><i class="visor-corner is-bl"></i><i class="visor-corner is-br"></i>
</div>
<div class="cockpit-dash">
  <span class="dash-bars">${repeat(8, i => `<i style="animation-delay:${(-i * 0.13).toFixed(2)}s"></i>`)}</span>
  <span class="dash-core"><span class="dash-lights">${repeat(7, i => `<i style="animation-delay:${(-i * 0.37).toFixed(2)}s"></i>`)}</span><small>WARP DRIVE · 曲速引擎</small></span>
  <span class="dash-radar"><i></i></span>
</div>`;

const HUD = `<div class="cockpit-hud">
  <div class="hud-horizon" data-hud-horizon><i></i><i></i></div>
  <div class="hud-reticle"><span></span></div>
  <div class="hud-heading"><small>航向</small><b data-hud-heading>000°</b></div>
  <div class="hud-gauge is-speed"><small>速度</small><b data-hud-speed>0.00 c</b><span class="hud-bar"><i data-hud-speed-bar></i></span></div>
  <div class="hud-gauge is-range"><small>距离</small><b data-hud-range>—</b><span class="hud-bar"><i data-hud-range-bar></i></span></div>
  <p class="hud-phase"><span data-hud-phase></span><em data-hud-target></em></p>
</div>`;

const formatSpeed = c => c < 1 ? c.toFixed(2) + ' c' : '光速 ×' + Math.round(c).toLocaleString('zh-CN');
export const formatRange = ly => ly >= 10000 ? (ly / 10000).toFixed(1) + ' 万光年' : ly >= 0.5 ? ly.toFixed(1) + ' 光年' : Math.round(ly * 63241) + ' 天文单位';

export function createCockpit(stage) {
  const root = document.createElement('div');
  root.className = 'voyage-cockpit';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = VISOR + HUD;
  stage.append(root);
  const field = name => root.querySelector('[data-hud-' + name + ']');
  const text = {phase: field('phase'), target: field('target'), speed: field('speed'), range: field('range'), heading: field('heading')};
  const speedBar = field('speed-bar');
  const rangeBar = field('range-bar');
  const horizon = field('horizon');
  const shown = {};
  let startRange = 1;
  // Only touch the DOM when a readout actually changes.
  const write = (key, value) => {
    if (shown[key] === value) return;
    shown[key] = value;
    text[key].textContent = value;
  };

  return {
    show(on, {target = '', range = 1, top = 0, height = 0} = {}) {
      if (on) {
        write('target', target);
        startRange = range || 1;
        root.style.top = top + 'px';
        root.style.height = height ? height + 'px' : '';
        root.style.bottom = height ? 'auto' : '';
      }
      stage.classList.toggle('is-cockpit', on);
    },
    update({phase, speed = 0, range = 0, heading = 0, roll = 0, shake = 0, power = 0}) {
      if (phase) write('phase', phase);
      write('speed', formatSpeed(speed));
      write('range', formatRange(range));
      write('heading', String(Math.round(heading) % 360).padStart(3, '0') + '°');
      speedBar.style.transform = 'scaleY(' + Math.min(1, power).toFixed(3) + ')';
      rangeBar.style.transform = 'scaleY(' + Math.min(1, range / startRange).toFixed(3) + ')';
      horizon.style.transform = 'rotate(' + roll.toFixed(4) + 'rad)';
      root.style.setProperty('--power', Math.min(1, power).toFixed(3));
      root.style.transform = shake ? 'translate(' + ((Math.random() - 0.5) * shake).toFixed(1) + 'px,' + ((Math.random() - 0.5) * shake).toFixed(1) + 'px)' : '';
    }
  };
}
