/* Topic planets: the topics page opens on a planet horizon. Each topic is a world drawn from
   scratch on the GPU: its surface (continents and oceans, gas bands and storms, craters and
   canyons) is baked once from layered noise into a texture, then lit with a real day and night
   side, sun glint on water, drifting clouds that cast shadows, an atmosphere on the limb and,
   for the gas giant, rings that shade the planet and are shaded by it. The featured topic
   fills the lower sky; the other two sit half-cropped at the screen edges and swap in on click. */
const host = document.querySelector('[data-topic-hero]');
if (host) {
  import('../vendor/three/three.module.min.js')
    .then(T => start(T, host))
    .catch(error => { host.dataset.fallback = 'true'; console.warn('Topic planets unavailable:', error.message); });
}

/* ---------- Shaders ---------- */
const NOISE = /* glsl */`
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 9; i++) {
    if (i >= octaves) break;
    sum += amp * snoise(p);
    norm += amp;
    p = p * 2.03 + vec3(1.7, 9.2, 4.3);
    amp *= 0.5;
  }
  return sum / norm;
}
// Sharp crests, for mountain chains.
float ridged(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0, prev = 1.0;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(snoise(p));
    n *= n;
    sum += n * amp * prev;
    norm += amp;
    prev = n;
    p = p * 2.1 + vec3(3.1, 1.3, 7.7);
    amp *= 0.5;
  }
  return sum / norm;
}
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
// Impact craters scattered on a 3D cell grid: a bowl inside, a raised rim around it.
float craters(vec3 p) {
  vec3 c = floor(p);
  vec3 f = fract(p);
  float h = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 r = hash3(c + o);
    if (r.z > 0.3) continue;
    float d = length(o + r * 0.8 + 0.1 - f);
    float rad = 0.16 + 0.3 * hash3(c + o + 3.1).x;
    float rim = (d - rad) / (rad * 0.24);
    h += -(1.0 - smoothstep(rad * 0.15, rad, d)) * 0.9 + exp(-rim * rim) * 0.5;
  }
  return h;
}`;

const QUAD_VERTEX = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Bakes one world into an equirectangular map: colour in rgb, height in alpha (clouds in red).
const BAKE_FRAGMENT = /* glsl */`
uniform int uKind; uniform int uLayer; uniform vec3 uSeed;
varying vec2 vUv;
${NOISE}
vec4 oceanWorld(vec3 dir, vec3 p, float lat) {
  vec3 w = vec3(fbm(p * 1.1 + 3.1, 4), fbm(p * 1.1 + 7.7, 4), fbm(p * 1.1 + 1.3, 4));
  float h = fbm(p * 1.5 + w * 0.7, 8);
  float m = ridged(p * 3.0 + w, 5);
  float sea = 0.05;
  float alat = abs(lat) / 1.5708;
  vec3 col; float height = 0.0;
  if (h < sea) {
    float depth = clamp((sea - h) / 0.45, 0.0, 1.0);
    col = mix(vec3(0.07, 0.34, 0.47), vec3(0.012, 0.06, 0.17), smoothstep(0.0, 0.5, depth));
    col = mix(col, vec3(0.12, 0.52, 0.56), (1.0 - smoothstep(0.0, 0.05, depth)) * 0.55);
  } else {
    float e = clamp((h - sea) / 0.5, 0.0, 1.0);
    float moist = fbm(p * 2.6 + 11.0, 5) * 0.5 + 0.5;
    float hot = 1.0 - alat;
    vec3 lush = vec3(0.09, 0.22, 0.07), grass = vec3(0.29, 0.35, 0.15), dry = vec3(0.68, 0.56, 0.36);
    vec3 tundra = vec3(0.42, 0.4, 0.33), rock = vec3(0.37, 0.32, 0.28);
    float dryness = smoothstep(0.42, 0.66, 1.0 - moist) * smoothstep(0.3, 0.75, hot);
    col = mix(mix(grass, lush, smoothstep(0.45, 0.75, moist * hot)), dry, dryness);
    col = mix(col, tundra, smoothstep(0.55, 0.85, alat));
    float mountain = smoothstep(0.35, 0.7, m) * smoothstep(0.04, 0.28, e);
    col = mix(col, rock, mountain * 0.85);
    col = mix(col, vec3(0.93, 0.95, 0.97), smoothstep(0.66, 0.84, m * smoothstep(0.1, 0.4, e) + alat * 0.45));
    col *= 0.86 + 0.28 * (fbm(p * 16.0, 4) * 0.5 + 0.5);
    height = 0.08 + e * 0.5 + mountain * 0.42;
  }
  float ice = smoothstep(1.2, 1.34, abs(lat) + fbm(p * 4.0, 4) * 0.12);
  col = mix(col, vec3(0.9, 0.94, 0.97), ice);
  return vec4(col, max(height, ice * 0.14));
}
vec4 gasWorld(vec3 dir, float lon, float lat) {
  vec3 q = dir * 2.2 + uSeed;
  float t = fbm(vec3(q.x * 1.4, q.y * 9.0, q.z * 1.4), 6);
  float y = dir.y + t * 0.05 + fbm(q * 4.0, 4) * 0.015;
  float b1 = 0.5 + 0.5 * sin(y * 19.0);
  float b2 = 0.5 + 0.5 * sin(y * 47.0 + fbm(q * 6.0, 3) * 2.0);
  vec3 cream = vec3(0.92, 0.87, 0.82), lav = vec3(0.71, 0.62, 0.86), vio = vec3(0.42, 0.32, 0.63);
  vec3 deep = vec3(0.18, 0.13, 0.32), rose = vec3(0.86, 0.66, 0.74);
  vec3 col = mix(vio, cream, smoothstep(0.25, 0.8, b1));
  col = mix(col, lav, b2 * 0.45);
  col = mix(col, rose, smoothstep(0.55, 0.9, fbm(vec3(q.x * 2.0, q.y * 14.0, q.z * 2.0), 4)) * 0.35);
  // A long-lived storm, swirled into the bands around it.
  float dl = (lat + 0.38) / 0.085;
  float dx = mod(lon - 1.1 + 3.14159, 6.28318) - 3.14159;
  float d = length(vec2(dx / 0.2, dl));
  col = mix(col, mix(rose, cream, 0.35), exp(-d * d * 1.4) * 0.9);
  float ring = (d - 1.05) / 0.28;
  col *= 1.0 - 0.2 * exp(-ring * ring);
  col = mix(col, deep, smoothstep(0.62, 0.97, abs(dir.y)) * 0.75);
  return vec4(col, 0.0);
}
vec4 rockWorld(vec3 dir, vec3 p, float lat) {
  vec3 q = p * 1.3;
  float big = fbm(q * 1.1 + 2.0, 5);
  float mid = fbm(q * 3.0, 6);
  float cr = craters(q * 5.0) * 0.6 + craters(q * 11.0 + 3.0) * 0.4;
  float canyon = 1.0 - abs(snoise(vec3(q.x * 2.2, q.y * 9.0, q.z * 2.2)));
  // One great canyon system, not a repeating pattern.
  canyon = pow(canyon, 26.0) * (1.0 - smoothstep(0.12, 0.35, abs(dir.y))) * smoothstep(0.25, 0.55, fbm(q * 0.6 + 8.0, 3));
  vec3 light = vec3(0.74, 0.44, 0.26), rust = vec3(0.5, 0.24, 0.13), dark = vec3(0.22, 0.11, 0.07);
  if (uKind == 3) { light = vec3(0.86, 0.9, 0.95); rust = vec3(0.62, 0.72, 0.82); dark = vec3(0.32, 0.4, 0.52); }
  if (uKind == 4) { light = vec3(0.35, 0.3, 0.28); rust = vec3(0.22, 0.18, 0.16); dark = vec3(0.08, 0.06, 0.06); }
  vec3 col = mix(light, rust, smoothstep(-0.25, 0.35, mid));
  col = mix(col, dark, smoothstep(0.05, 0.35, big) * 0.85);
  col *= 1.0 + cr * 0.18;
  col = mix(col, dark * 0.8, canyon * 0.8);
  col *= 0.88 + 0.24 * (fbm(q * 22.0, 3) * 0.5 + 0.5);
  float cap = smoothstep(1.24, 1.36, lat + fbm(q * 4.0, 3) * 0.08);
  col = mix(col, vec3(0.95, 0.9, 0.88), cap);
  return vec4(col, clamp(0.45 + mid * 0.25 + cr * 0.5 - canyon * 0.4, 0.0, 1.0));
}
float cloudLayer(vec3 p, float lat) {
  vec3 q = p + 5.0;
  vec3 w = vec3(fbm(q * 1.6, 4), fbm(q * 1.6 + 4.7, 4), fbm(q * 1.6 + 9.1, 4));
  float c = fbm(q * 2.3 + w * 1.1, 7);
  float streak = fbm(vec3(q.x * 1.2, q.y * 5.5, q.z * 1.2) + w * 0.8, 5);
  float belts = 0.5 + 0.5 * cos(lat * 6.0);
  float v = c * 0.65 + streak * 0.35 + (belts - 0.5) * 0.22;
  // Rocky worlds only carry thin, patchy dust, not banded weather.
  return uKind == 0 ? smoothstep(0.1, 0.5, v) * 0.92 : smoothstep(0.3, 0.75, c * 0.9 + 0.05) * 0.22;
}
void main() {
  float lon = (vUv.x - 0.5) * 6.2831853;
  float lat = (vUv.y - 0.5) * 3.1415926;
  vec3 dir = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  vec3 p = dir + uSeed;
  if (uLayer == 1) { gl_FragColor = vec4(cloudLayer(p, lat), 0.0, 0.0, 1.0); return; }
  if (uKind == 0) gl_FragColor = oceanWorld(dir, p, lat);
  else if (uKind == 1) gl_FragColor = gasWorld(dir, lon, lat);
  else gl_FragColor = rockWorld(dir, p, lat);
}`;

const RING_DENSITY = /* glsl */`
uniform float uRingIn; uniform float uRingOut;
float ringDensity(float r) {
  if (r < uRingIn || r > uRingOut) return 0.0;
  float x = (r - uRingIn) / (uRingOut - uRingIn);
  float d = 0.55 + 0.18 * sin(x * 90.0) + 0.14 * sin(x * 37.0 + 1.3) + 0.08 * sin(x * 211.0);
  d *= smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.9, 1.0, x));
  float gap = (x - 0.63) / 0.022;
  d *= 1.0 - 0.92 * exp(-gap * gap);
  d *= mix(0.45, 1.0, smoothstep(0.0, 0.3, x));
  return clamp(d, 0.0, 1.0);
}`;

const PLANET_VERTEX = /* glsl */`
varying vec3 vObj; varying vec3 vNormal; varying vec3 vPos;
void main() {
  vObj = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const PLANET_FRAGMENT = /* glsl */`
uniform sampler2D tSurface; uniform sampler2D tClouds; uniform mat3 normalMatrix;
uniform int uKind; uniform float uHasClouds; uniform float uRot; uniform float uCloudRot; uniform float uBump;
uniform float uAlpha; uniform float uRing; uniform float uRadius; uniform float uExposure;
uniform vec3 uSun; uniform vec3 uAtmo; uniform vec3 uCenter; uniform vec3 uRingNormal;
varying vec3 vObj; varying vec3 vNormal; varying vec3 vPos;
${RING_DENSITY}
// Equirectangular lookup without a seam: of two wrappings, use the one whose x does not jump.
vec2 equirect(float lon, float lat, float rot) {
  float x = (lon + rot) / 6.2831853 + 0.5;
  vec2 a = vec2(fract(x), lat / 3.1415926 + 0.5);
  vec2 b = vec2(fract(x + 0.5) - 0.5, a.y);
  return fwidth(a.x) <= fwidth(b.x) + 1e-6 ? a : b;
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 n = normalize(vObj);
  float lon = atan(n.z, n.x);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  vec2 uv = equirect(lon, lat, uRot);
  vec2 uvc = equirect(lon, lat, uCloudRot);
  vec4 s = texture(tSurface, uv);
  vec2 du = vec2(1.5 / 2048.0, 0.0), dv = vec2(0.0, 1.5 / 1024.0);
  float hx = texture(tSurface, uv + du).a - texture(tSurface, uv - du).a;
  float hy = texture(tSurface, uv + dv).a - texture(tSurface, uv - dv).a;
  vec3 east = vec3(-sin(lon), 0.0, cos(lon));
  vec3 north = vec3(-cos(lon) * sin(lat), cos(lat), -sin(lon) * sin(lat));
  vec3 N = normalize(normalMatrix * normalize(n - uBump * (hx * east + hy * north)));
  vec3 Ng = normalize(vNormal);
  vec3 L = normalize(uSun);
  vec3 V = vec3(0.0, 0.0, 1.0);
  float ndl = dot(N, L);
  float ndlg = dot(Ng, L);
  // Clouds, and their shadow a little way from the sun.
  vec3 Lobj = normalize(transpose(normalMatrix) * L);
  vec2 shift = vec2(dot(Lobj, east), dot(Lobj, north)) * 0.006;
  float cov = uHasClouds * texture(tClouds, uvc).r;
  float shade = uHasClouds * texture(tClouds, uvc - shift).r;

  vec3 albedo = pow(s.rgb, vec3(2.2));
  vec3 sun = vec3(1.0, 0.97, 0.92) * uExposure;
  float day = clamp((ndl + 0.04) / 1.04, 0.0, 1.0) * smoothstep(-0.15, 0.08, ndlg);
  vec3 col = albedo * sun * day;
  float ocean = uKind == 0 ? 1.0 - step(0.005, s.a) : 0.0;
  vec3 H = normalize(L + V);
  float nh = max(dot(Ng, H), 0.0);
  col += vec3(1.0, 0.93, 0.8) * (pow(nh, 90.0) * 1.6 + pow(nh, 14.0) * 0.08) * ocean * (1.0 - cov) * smoothstep(0.0, 0.2, ndlg);
  col *= 1.0 - shade * 0.5 * (1.0 - cov);
  vec3 cloudLit = vec3(0.95) * sun * clamp((ndlg + 0.08) / 1.08, 0.0, 1.0);
  col = mix(col, cloudLit, cov * 0.94);
  if (uKind == 1) col *= mix(0.42, 1.0, pow(max(dot(Ng, V), 0.0), 0.45));
  // The rings' shadow falls across the gas giant.
  if (uRing > 0.5) {
    float facing = dot(L, uRingNormal);
    if (abs(facing) > 1e-4) {
      float t = dot(uCenter - vPos, uRingNormal) / facing;
      if (t > 0.0) col *= 1.0 - ringDensity(length(vPos + L * t - uCenter) / uRadius) * 0.75;
    }
  }
  // Atmosphere: scattered light on the limb, brightest toward the sun, warm at the terminator.
  float fres = pow(1.0 - max(dot(Ng, V), 0.0), 2.6);
  vec3 atmo = pow(uAtmo, vec3(2.2));
  col += atmo * fres * smoothstep(-0.3, 0.55, ndlg) * 1.1;
  col = mix(col, atmo * day * 0.9, fres * 0.35 * smoothstep(-0.1, 0.4, ndlg));
  float edge = ndlg / 0.1;
  if (uKind == 0) col += vec3(1.0, 0.42, 0.18) * 0.08 * exp(-edge * edge) * (0.3 + fres);
  col += albedo * 0.004;
  gl_FragColor = vec4(pow(aces(col), vec3(1.0 / 2.2)), uAlpha);
}`;

// The outer glow: a back-face shell that fades from the limb to nothing, brighter sunward.
const HALO_VERTEX = /* glsl */`varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HALO_FRAGMENT = /* glsl */`
uniform vec3 uAtmo; uniform vec3 uSun; uniform float uEdge; uniform float uStrength; uniform float uAlpha;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  float t = clamp(-n.z / uEdge, 0.0, 1.0);
  float side = smoothstep(-0.5, 0.7, dot(normalize(n.xy + 1e-5), normalize(uSun.xy)));
  gl_FragColor = vec4(uAtmo * t * t * t * (0.25 + 0.75 * side) * uStrength * uAlpha, 1.0);
}`;

const RING_VERTEX = /* glsl */`varying vec3 vLocal; varying vec3 vPos; void main() { vLocal = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vPos = mv.xyz; gl_Position = projectionMatrix * mv; }`;
const RING_FRAGMENT = /* glsl */`
uniform vec3 uSun; uniform vec3 uCenter; uniform vec3 uRingNormal; uniform float uRadius; uniform float uAlpha;
varying vec3 vLocal; varying vec3 vPos;
${RING_DENSITY}
void main() {
  float r = length(vLocal.xy);
  float d = ringDensity(r);
  if (d < 0.01) discard;
  vec3 L = normalize(uSun);
  vec3 tint = mix(vec3(0.86, 0.8, 0.78), vec3(0.7, 0.62, 0.86), 0.5 + 0.5 * sin(r * 23.0));
  float lit = 0.3 + 0.7 * abs(dot(uRingNormal, L));
  // The planet's shadow falls across the rings.
  vec3 oc = vPos - uCenter;
  float b = dot(oc, L);
  float disc = b * b - (dot(oc, oc) - uRadius * uRadius);
  float shadow = disc > 0.0 && -b - sqrt(disc) > 0.0 ? 0.12 : 1.0;
  gl_FragColor = vec4(tint * lit * shadow, d * 0.85 * uAlpha);
}`;

// Deep space behind everything: a faint nebula and twinkling stars, in CSS pixels.
const SKY_FRAGMENT = /* glsl */`
uniform vec2 uRes; uniform float uTime;
varying vec2 vUv;
${NOISE}
float hash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float stars(vec2 p, float cell, float density, float size) {
  vec2 c = floor(p / cell);
  float r = hash(c);
  if (r < 1.0 - density) return 0.0;
  vec2 at = (c + vec2(hash(c + 1.3), hash(c + 7.1))) * cell;
  float twinkle = 0.7 + 0.3 * sin(uTime * (0.6 + 2.0 * hash(c + 9.7)) + r * 40.0);
  return (1.0 - smoothstep(0.0, size, length(p - at))) * (0.35 + 0.65 * hash(c + 3.3)) * twinkle;
}
void main() {
  vec2 p = vUv * uRes;
  vec3 col = mix(vec3(0.008, 0.012, 0.03), vec3(0.016, 0.02, 0.05), vUv.y);
  float neb = fbm(vec3(vUv * vec2(uRes.x / uRes.y, 1.0) * 1.6, 0.4), 5) * 0.5 + 0.5;
  col += vec3(0.16, 0.1, 0.32) * 0.09 * smoothstep(0.45, 0.85, neb);
  col += vec3(0.05, 0.16, 0.24) * 0.05 * smoothstep(0.5, 0.9, 1.0 - neb);
  col += vec3(stars(p, 5.0, 0.016, 1.2));
  col += vec3(0.85, 0.92, 1.0) * stars(p + 13.0, 47.0, 0.06, 2.2) * 1.2;
  gl_FragColor = vec4(col, 1.0);
}`;
const SKY_VERTEX = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/* ---------- Worlds ---------- */
const WORLDS = {
  ocean: {kind: 0, horizon: -1.42, clouds: true, atmo: [0.38, 0.68, 1.0], halo: 1.0, spin: 0.012, cloudSpin: 0.016, tilt: [0.62, 0, 0.32], bump: 1.4, exposure: 2.3},
  gas: {kind: 1, horizon: -0.5, clouds: false, atmo: [0.78, 0.68, 1.0], halo: 0.75, spin: 0.018, rings: true, tilt: [0.5, 0, -0.38], bump: 0, exposure: 2.0},
  desert: {kind: 2, horizon: -1.42, clouds: true, atmo: [1.0, 0.62, 0.38], halo: 0.55, spin: 0.009, cloudSpin: 0.011, tilt: [0.55, 0, 0.18], bump: 3.6, exposure: 1.55},
  ice: {kind: 3, horizon: -1.42, clouds: true, atmo: [0.7, 0.85, 1.0], halo: 0.6, spin: 0.008, cloudSpin: 0.01, tilt: [0.5, 0, 0.3], bump: 2.0, exposure: 1.6},
  lava: {kind: 4, horizon: -1.42, clouds: false, atmo: [1.0, 0.45, 0.2], halo: 0.6, spin: 0.007, tilt: [0.45, 0, 0.1], bump: 2.4, exposure: 1.8}
};
const SUN = [-0.62, 0.5, 0.62];
const HALO_SCALE = 1.06;

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const mixSlot = (a, b, t) => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: a.r + (b.r - a.r) * t, tilt: a.tilt + (b.tilt - a.tilt) * t});

function start(T, host) {
  const data = JSON.parse(host.querySelector('[data-topic-data]').textContent);
  if (data.length < 2) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = host.querySelector('[data-topic-sky]');
  const renderer = new T.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setClearColor(0x02040b, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const sunView = new T.Vector3(...SUN).normalize();

  // Bake each world's surface (and clouds) once.
  const bakeScene = new T.Scene();
  const bakeCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bakeMaterial = new T.ShaderMaterial({uniforms: {uKind: {value: 0}, uLayer: {value: 0}, uSeed: {value: new T.Vector3()}}, vertexShader: QUAD_VERTEX, fragmentShader: BAKE_FRAGMENT});
  const bakeQuad = new T.Mesh(new T.PlaneGeometry(2, 2), bakeMaterial);
  bakeQuad.frustumCulled = false;
  bakeScene.add(bakeQuad);
  const mapSize = innerWidth < 700 ? 1024 : 2048;
  function bake(world, seed, layer) {
    const size = layer ? mapSize / 2 : mapSize;
    const target = new T.WebGLRenderTarget(size, size / 2, {depthBuffer: false, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, wrapS: T.RepeatWrapping, wrapT: T.ClampToEdgeWrapping});
    bakeMaterial.uniforms.uKind.value = world.kind;
    bakeMaterial.uniforms.uLayer.value = layer;
    bakeMaterial.uniforms.uSeed.value.set(seed * 1.7, seed * 2.3, seed * 0.9);
    renderer.setRenderTarget(target);
    renderer.render(bakeScene, bakeCamera);
    renderer.setRenderTarget(null);
    return target.texture;
  }

  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(0, 1, 0, -1, 0.1, 30000);
  const sky = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({uniforms: {uRes: {value: new T.Vector2(1, 1)}, uTime: {value: 0}}, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, depthWrite: false, depthTest: false}));
  sky.renderOrder = -1;
  scene.add(sky);
  const sphere = new T.SphereGeometry(1, 160, 120);

  function makePlanet(type, seed) {
    const world = WORLDS[type] || WORLDS.ocean;
    const surface = bake(world, seed, 0);
    const clouds = world.clouds ? bake(world, seed, 1) : surface;
    const group = new T.Group();
    const spin = new T.Group();
    spin.rotation.set(...world.tilt);
    group.add(spin);
    const ringNormal = new T.Vector3();
    const uniforms = {
      tSurface: {value: surface}, tClouds: {value: clouds}, uKind: {value: world.kind}, uHasClouds: {value: world.clouds ? 1 : 0},
      uRot: {value: seed}, uCloudRot: {value: seed * 1.3}, uBump: {value: world.bump}, uAlpha: {value: 1}, uExposure: {value: world.exposure},
      uRing: {value: world.rings ? 1 : 0}, uRadius: {value: 1}, uRingIn: {value: 1.32}, uRingOut: {value: 2.25},
      uSun: {value: sunView}, uAtmo: {value: new T.Vector3(...world.atmo)}, uCenter: {value: new T.Vector3()}, uRingNormal: {value: ringNormal}
    };
    spin.add(new T.Mesh(sphere, new T.ShaderMaterial({uniforms, vertexShader: PLANET_VERTEX, fragmentShader: PLANET_FRAGMENT, transparent: true})));
    const haloUniforms = {uAtmo: {value: new T.Vector3(...world.atmo)}, uSun: {value: sunView}, uEdge: {value: Math.sqrt(1 - 1 / (HALO_SCALE * HALO_SCALE))}, uStrength: {value: world.halo}, uAlpha: {value: 1}};
    const halo = new T.Mesh(sphere, new T.ShaderMaterial({uniforms: haloUniforms, vertexShader: HALO_VERTEX, fragmentShader: HALO_FRAGMENT, side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
    halo.scale.setScalar(HALO_SCALE);
    group.add(halo);
    let ringUniforms = null;
    if (world.rings) {
      ringUniforms = {uSun: {value: sunView}, uCenter: uniforms.uCenter, uRingNormal: {value: ringNormal}, uRadius: uniforms.uRadius, uRingIn: uniforms.uRingIn, uRingOut: uniforms.uRingOut, uAlpha: {value: 1}};
      const ring = new T.Mesh(new T.RingGeometry(1.32, 2.25, 256, 4), new T.ShaderMaterial({uniforms: ringUniforms, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, side: T.DoubleSide, transparent: true, depthWrite: false}));
      ring.rotation.x = -Math.PI / 2;
      spin.add(ring);
    }
    scene.add(group);
    const quat = new T.Quaternion();
    return {
      world, group, uniforms, haloUniforms, ringUniforms, slot: {x: 0, y: 0, r: 1}, alpha: 1, hover: 0, hoverTarget: 0,
      place(slot, alpha) {
        const r = Math.max(0.001, slot.r * (1 + this.hover * 0.045));
        // On the horizon most worlds turn their pole away so the equator runs along the skyline;
        // the gas giant stays more upright so its rings cross the sky as a band.
        spin.rotation.x = slot.tilt !== undefined ? slot.tilt : slot.horizon ? world.horizon : world.tilt[0];
        group.position.set(slot.x, -slot.y, -r - 10 - (r > 400 ? 2000 : 0));
        group.scale.setScalar(r);
        uniforms.uCenter.value.copy(group.position);
        uniforms.uRadius.value = r;
        uniforms.uAlpha.value = haloUniforms.uAlpha.value = alpha;
        if (ringUniforms) ringUniforms.uAlpha.value = alpha * (slot.r > 400 ? 0.6 : 1);
        spin.updateMatrixWorld();
        ringNormal.set(0, 1, 0).applyQuaternion(spin.getWorldQuaternion(quat));
        group.visible = alpha > 0.002 && slot.r > 0.5;
      },
      spin(dt) {
        uniforms.uRot.value += dt * world.spin;
        uniforms.uCloudRot.value += dt * (world.cloudSpin || world.spin);
      }
    };
  }

  const shown = data.slice(0, 3);
  const planets = shown.map((topic, i) => makePlanet(topic.planet, 1.3 + i * 7.1));
  // Who sits where: the featured topic, and the left and right slots.
  const seat = {center: 0, left: 1, right: shown.length > 2 ? 2 : -1};

  const buttons = {left: host.querySelector('[data-slot="left"]'), right: host.querySelector('[data-slot="right"]')};
  const labels = {left: host.querySelector('[data-label="left"]'), right: host.querySelector('[data-label="right"]')};
  const cta = host.querySelector('.topic-hero-cta');
  const field = name => host.querySelector('[data-topic-' + name + ']');
  const slots = {};
  let width = 0, height = 0, phone = false;

  function layout() {
    width = host.clientWidth;
    height = host.clientHeight;
    phone = width < 580;
    renderer.setSize(width, height, false);
    camera.left = 0; camera.right = width; camera.top = 0; camera.bottom = -height;
    camera.updateProjectionMatrix();
    sky.scale.set(width, height, 1);
    sky.position.set(width / 2, -height / 2, -29000);
    sky.material.uniforms.uRes.value.set(width, height);
    const box = host.getBoundingClientRect();
    const row = cta.getBoundingClientRect();
    const rowY = row.top - box.top + row.height / 2;
    const small = phone ? Math.max(38, Math.min(52, width * 0.12)) : Math.max(56, Math.min(92, width * 0.055));
    slots.left = {x: small * 0.04, y: rowY, r: small};
    slots.right = {x: width - small * 0.1, y: rowY, r: small};
    const big = phone ? width * 1.35 : Math.max(width * 0.86, height * 1.25);
    const top = Math.max(rowY + small + (phone ? 96 : 64), height * (phone ? 0.7 : 0.66));
    slots.center = {x: width / 2, y: top + big, r: big, horizon: true};
    for (const side of ['left', 'right']) {
      const s = slots[side];
      const button = buttons[side];
      if (button) Object.assign(button.style, {left: s.x - s.r + 'px', top: s.y - s.r + 'px', width: s.r * 2 + 'px', height: s.r * 2 + 'px'});
      const label = labels[side];
      if (!label) continue;
      const gap = s.r + (phone ? 6 : 18);
      label.style.top = phone ? s.y + s.r + 16 + 'px' : s.y + 'px';
      label.style.left = side === 'left' ? (phone ? 12 : s.x + gap) + 'px' : '';
      label.style.right = side === 'right' ? (phone ? 12 : width - s.x + gap) + 'px' : '';
    }
    if (!motion) settle();
  }

  // Swap motion: the chosen planet rises from its slot into the horizon while the old one
  // sinks out of view, then pops into the empty slot.
  let motion = null;
  function settle() {
    planets.forEach((planet, i) => {
      const where = i === seat.center ? 'center' : i === seat.left ? 'left' : i === seat.right ? 'right' : null;
      if (where) planet.place(slots[where], 1); else planet.place({x: 0, y: 0, r: 0}, 0);
    });
  }
  function animate(now) {
    const t = Math.min(1, (now - motion.start) / motion.duration);
    const {rise, sink, side} = motion;
    const riser = planets[rise].world;
    planets[rise].place(mixSlot({...slots[side], tilt: riser.tilt[0]}, {...slots.center, tilt: riser.horizon}, ease(t)), 1);
    if (t < 0.45) {
      const k = ease(t / 0.45);
      planets[sink].place({...slots.center, y: slots.center.y + height * 0.6 * k, tilt: planets[sink].world.horizon}, 1 - k);
    } else {
      const k = (t - 0.45) / 0.55;
      planets[sink].place({...slots[side], r: slots[side].r * easeBack(k)}, Math.min(1, k * 3));
    }
    if (t >= 1) { motion = null; settle(); }
  }

  function write(index) {
    const topic = shown[index];
    const total = String(shown.length).padStart(2, '0');
    field('index').textContent = '专题 ' + String(index + 1).padStart(2, '0') + ' / ' + total;
    field('title').textContent = topic.title;
    field('lede').textContent = topic.description;
    field('meta').textContent = '共 ' + topic.count + ' 篇 · 约 ' + topic.minutes + ' 分钟';
    field('link').href = topic.path;
    for (const side of ['left', 'right']) {
      const i = seat[side];
      if (!buttons[side]) continue;
      buttons[side].hidden = i < 0;
      if (labels[side]) labels[side].textContent = i < 0 ? '' : shown[i].title;
      if (i >= 0) buttons[side].setAttribute('aria-label', '切换到「' + shown[i].title + '」');
    }
  }
  function choose(side) {
    const index = seat[side];
    if (index < 0 || motion) return;
    const sink = seat.center;
    seat.center = index;
    seat[side] = sink;
    host.classList.add('is-switching');
    setTimeout(() => { write(index); host.classList.remove('is-switching'); }, reduce.matches ? 0 : 260);
    if (reduce.matches) { settle(); kick(); return; }
    motion = {rise: index, sink, side, start: performance.now(), duration: 1300};
    kick();
  }
  for (const side of ['left', 'right']) {
    const button = buttons[side];
    if (!button) continue;
    button.addEventListener('click', () => choose(side));
    button.addEventListener('pointerenter', () => { const p = planets[seat[side]]; if (p) p.hoverTarget = 1; kick(); });
    button.addEventListener('pointerleave', () => { const p = planets[seat[side]]; if (p) p.hoverTarget = 0; kick(); });
  }

  let frame = 0, last = performance.now(), time = 0, onScreen = true;
  function loop(now) {
    frame = 0;
    if (now - last < 1000 / 45) { frame = requestAnimationFrame(loop); return; }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!reduce.matches) time += dt;
    sky.material.uniforms.uTime.value = time;
    let busy = Boolean(motion);
    planets.forEach(planet => {
      if (!reduce.matches) planet.spin(dt);
      planet.hover += (planet.hoverTarget - planet.hover) * (1 - Math.exp(-dt * 10));
      if (Math.abs(planet.hoverTarget - planet.hover) > 0.002) busy = true;
    });
    if (motion) animate(now); else settle();
    renderer.render(scene, camera);
    if ((busy || !reduce.matches) && onScreen && !document.hidden) frame = requestAnimationFrame(loop);
  }
  function kick() { if (!frame) { last = performance.now() - 30; frame = requestAnimationFrame(loop); } }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) kick(); }).observe(host);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  reduce.addEventListener?.('change', kick);
  addEventListener('resize', layout);
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(host);
  write(seat.center);
  layout();
  kick();
  host.classList.add('is-ready');
}
