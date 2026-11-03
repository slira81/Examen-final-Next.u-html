/* =====================================================================
   Partículas: billboards instanciados en dos capas (normal y aditiva),
   simulados en la CPU. Formas generadas en el shader (sin texturas):
     0 círculo suave   1 bocanada de humo   2 estela (estirada según la
     velocidad)   3 anillo en el suelo   4 cruz (curación)   5 rombo (copo,
     esquirla)   6 chispa estrellada
   Respetan la niebla de guerra (solo se ven en zonas visibles).
   ===================================================================== */
import * as THREE from 'three';
import { GLOBAL, NOISE_GLSL } from './shaderlib.js';
import { Q } from './quality.js';

const VERT = /* glsl */`
attribute vec4 iPos; attribute vec4 iCol; attribute vec4 iMisc; attribute vec4 iVel;
uniform sampler2D uFogTex; uniform vec2 uMapSize; uniform float uFogOn;
varying vec2 vUv; varying vec4 vCol; varying float vKind; varying float vFog; varying float vSeed;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec2 c = position.xy; float r = iMisc.x, kind = iMisc.y; vUv = c + 0.5; vKind = kind; vSeed = iMisc.z;
  vec3 wp;
  if (kind > 2.5 && kind < 3.5) wp = iPos.xyz + vec3(c.x, 0.0, c.y) * iPos.w;
  else if (kind > 1.5 && kind < 2.5) {
    vec3 a = iVel.xyz; float l = length(a); a = l > 1e-4 ? a / l : up;
    vec3 side = normalize(cross(a, cameraPosition - iPos.xyz));
    wp = iPos.xyz + a * c.y * iPos.w * iVel.w + side * c.x * iPos.w * 0.35;
  } else {
    vec2 rc = vec2(c.x * cos(r) - c.y * sin(r), c.x * sin(r) + c.y * cos(r));
    wp = iPos.xyz + (right * rc.x + up * rc.y) * iPos.w;
  }
  vCol = iCol;
  float v = texture(uFogTex, iPos.xz / uMapSize).r;
  vFog = uFogOn < 0.5 ? 1.0 : smoothstep(0.55, 0.95, v);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const FRAG = /* glsl */`
varying vec2 vUv; varying vec4 vCol; varying float vKind; varying float vFog; varying float vSeed;
uniform float uAdd; uniform float uTime;
${NOISE_GLSL}
void main() {
  vec2 p = vUv - 0.5; float d = length(p) * 2.0, a;
  if (vKind < 0.5) a = pow(clamp(1.0 - d, 0.0, 1.0), 1.4);
  else if (vKind < 1.5) { float n = pe_noise(vUv * 3.5 + vSeed * 17.0) * 0.6 + pe_noise(vUv * 7.0 - vSeed * 9.0) * 0.4; a = smoothstep(1.0, 0.25, d + (0.5 - n) * 0.55); }
  else if (vKind < 2.5) a = pow(clamp(1.0 - abs(p.x) * 2.0, 0.0, 1.0), 1.5) * smoothstep(0.5, 0.2, abs(p.y));
  else if (vKind < 3.5) a = smoothstep(0.72, 0.86, d) * smoothstep(1.0, 0.9, d);
  else if (vKind < 4.5) { vec2 q = abs(p); a = (q.x < 0.12 && q.y < 0.42) || (q.y < 0.12 && q.x < 0.42) ? 1.0 : 0.0; a *= smoothstep(0.5, 0.35, max(q.x, q.y)); }
  else if (vKind < 5.5) { vec2 q = abs(p); a = smoothstep(0.5, 0.38, q.x + q.y); }
  else { vec2 q = abs(p); a = clamp(0.04 / (q.x * q.y + 0.01) - 0.25, 0.0, 1.0) * smoothstep(0.5, 0.2, d * 0.5) + pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 2.0); }
  a *= vCol.a * vFog;
  if (a < 0.004) discard;
  gl_FragColor = uAdd > 0.5 ? vec4(vCol.rgb * a, a) : vec4(vCol.rgb, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const MAX = 3000;
class Layer {
  constructor(scene, additive) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(MAX * 4); this.col = new Float32Array(MAX * 4); this.misc = new Float32Array(MAX * 4); this.vel = new Float32Array(MAX * 4);
    for (const [k, a] of [['iPos', this.pos], ['iCol', this.col], ['iMisc', this.misc], ['iVel', this.vel]]) { const at = new THREE.InstancedBufferAttribute(a, 4); at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, at); }
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
      uniforms: Object.assign({ uAdd: { value: additive ? 1 : 0 } }, GLOBAL),
    });
    if (additive) { this.mat.blendSrc = THREE.OneFactor; this.mat.blendDst = THREE.OneFactor; this.mat.blendEquation = THREE.AddEquation; }
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 6 : 5;
    this.geo = g; this.list = []; scene.add(this.mesh);
  }
  dispose(scene) { scene.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); }
}

const P = { normal: null, add: null, scene: null, rnd: Math.random };
function initParticles(scene) { P.scene = scene; P.normal = new Layer(scene, false); P.add = new Layer(scene, true); }
function disposeParticles() { if (P.normal) { P.normal.dispose(P.scene); P.add.dispose(P.scene); P.normal = P.add = null; } }
const _c0 = new THREE.Color(), _c1 = new THREE.Color();
const R = (a, b) => a + (b - a) * Math.random();
/**
 * Emite n partículas. o: x y z, sx sy sz (dispersión), vx vy vz, vs (dispersión de velocidad), up (velocidad vertical extra),
 * life [min, max], size [inicio, fin], c0 c1 (hex), alpha, grav, drag, kind, add (capa aditiva), spin, stretch.
 */
function emit(n, o) {
  const L = o.add ? P.add : P.normal; if (!L) return;
  if (Q.particles < 1 && !o.keep) { const f = n * Q.particles; n = Math.floor(f) + (Math.random() < f % 1 ? 1 : 0); if (!n) return; }
  _c0.set(o.c0 || '#ffffff'); _c1.set(o.c1 || o.c0 || '#ffffff');
  for (let i = 0; i < n; i++) {
    if (L.list.length >= MAX) L.list.shift();
    const vs = o.vs || 0, life = o.life ? R(o.life[0], o.life[1]) : 1;
    L.list.push({
      x: o.x + (Math.random() - 0.5) * (o.sx || 0), y: o.y + (Math.random() - 0.5) * (o.sy || 0), z: o.z + (Math.random() - 0.5) * (o.sz || 0),
      vx: (o.vx || 0) + (Math.random() - 0.5) * vs, vy: (o.vy || 0) + (Math.random() - 0.5) * vs * (o.vsy ?? 1) + (o.up ? Math.random() * o.up : 0), vz: (o.vz || 0) + (Math.random() - 0.5) * vs,
      t: 0, life, s0: (o.size ? o.size[0] : 0.2) * R(0.8, 1.2), s1: o.size ? o.size[1] : 0.2,
      r0: _c0.r, g0: _c0.g, b0: _c0.b, r1: _c1.r, g1: _c1.g, b1: _c1.b, a: o.alpha ?? 1,
      grav: o.grav || 0, drag: o.drag || 0, kind: o.kind || 0, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * (o.spin || 0), stretch: o.stretch || 3, seed: Math.random(), fadeIn: o.fadeIn ?? 0.08, ground: o.ground,
    });
  }
}
function stepLayer(L, dt) {
  const out = L.list; let n = 0;
  const pos = L.pos, col = L.col, misc = L.misc, vel = L.vel;
  for (let i = 0; i < out.length; i++) {
    const p = out[i]; p.t += dt; if (p.t >= p.life) continue;
    const k = p.t / p.life, dr = Math.max(0, 1 - p.drag * dt);
    p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
    if (p.ground !== undefined && p.y < p.ground) { p.y = p.ground; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
    out[n++] = p;
    const j = (n - 1) * 4, fade = Math.min(1, k / p.fadeIn) * (1 - k * k);
    pos[j] = p.x; pos[j + 1] = p.y; pos[j + 2] = p.z; pos[j + 3] = p.s0 + (p.s1 - p.s0) * k;
    col[j] = p.r0 + (p.r1 - p.r0) * k; col[j + 1] = p.g0 + (p.g1 - p.g0) * k; col[j + 2] = p.b0 + (p.b1 - p.b0) * k; col[j + 3] = p.a * fade;
    misc[j] = p.rot; misc[j + 1] = p.kind; misc[j + 2] = p.seed; misc[j + 3] = 0;
    vel[j] = p.vx; vel[j + 1] = p.vy; vel[j + 2] = p.vz; vel[j + 3] = p.stretch;
  }
  out.length = n; L.geo.instanceCount = n;
  if (n) for (const k of ['iPos', 'iCol', 'iMisc', 'iVel']) { const a = L.geo.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
}
function stepParticles(dt) { if (!P.normal) return; stepLayer(P.normal, dt); stepLayer(P.add, dt); }
function particleCount() { return P.normal ? P.normal.list.length + P.add.list.length : 0; }

// ------------------------------------------------------------ efectos predefinidos
const FX = {
  blood(x, y, z) { emit(7, { x, y, z, sx: 0.08, sy: 0.08, sz: 0.08, vs: 1.4, up: 1.2, life: [0.35, 0.6], size: [0.06, 0.04], c0: '#c0202a', c1: '#6a0e14', grav: 6, ground: y - 0.35 }); },
  dust(x, y, z, k = 1) { emit(Math.round(8 * k), { x, y, z, sx: 0.4 * k, sz: 0.4 * k, vs: 0.9 * k, up: 0.5, life: [0.6, 1.2], size: [0.18 * k, 0.5 * k], c0: '#b9a07a', c1: '#8a7a64', alpha: 0.55, drag: 2.5, kind: 1 }); },
  smoke(x, y, z, k = 1) { emit(Math.round(4 * k), { x, y, z, sx: 0.3, sz: 0.3, vs: 0.3, vy: 0.6, up: 0.4, life: [1.6, 2.6], size: [0.3 * k, 0.9 * k], c0: '#5a5550', c1: '#9a948c', alpha: 0.5, drag: 0.6, kind: 1 }); },
  explosion(x, y, z, k = 1) {
    emit(Math.round(14 * k), { add: true, x, y: y + 0.2, z, sx: 0.3 * k, sy: 0.2, sz: 0.3 * k, vs: 2.2 * k, up: 1.5, life: [0.3, 0.6], size: [0.35 * k, 0.8 * k], c0: '#fff2b0', c1: '#ff5a10', drag: 4, kind: 1 });
    emit(Math.round(16 * k), { add: true, x, y: y + 0.2, z, vs: 5 * k, up: 3, life: [0.3, 0.7], size: [0.05, 0.02], c0: '#ffe08a', c1: '#ff7020', grav: 5, kind: 2, stretch: 4 });
    emit(Math.round(8 * k), { x, y: y + 0.4, z, sx: 0.5 * k, sz: 0.5 * k, vs: 0.8, vy: 0.8, up: 0.6, life: [1.4, 2.4], size: [0.4 * k, 1.2 * k], c0: '#3a3430', c1: '#7a746c', alpha: 0.6, drag: 1, kind: 1 });
    emit(1, { add: true, x, y: y + 0.05, z, life: [0.45, 0.45], size: [0.2, 1.6 * k], c0: '#ffd08a', c1: '#ff6a2a', alpha: 0.8, kind: 3 });
  },
  fire(x, y, z, k = 1) { emit(Math.round(3 * k), { add: true, x, y, z, sx: 0.15 * k, sz: 0.15 * k, vy: 0.9, up: 0.5, vs: 0.2, life: [0.4, 0.8], size: [0.22 * k, 0.05], c0: '#ffd36a', c1: '#ff3a10', drag: 1, kind: 0 }); },
  magic(x, y, z) { emit(14, { add: true, x, y, z, vs: 2.2, up: 0.5, life: [0.3, 0.7], size: [0.12, 0.02], c0: '#e0b0ff', c1: '#6a40ff', drag: 3, kind: 6, spin: 4 }); emit(1, { add: true, x, y: y - 0.25, z, life: [0.4, 0.4], size: [0.1, 0.8], c0: '#c890ff', alpha: 0.7, kind: 3 }); },
  heal(x, y, z) { emit(6, { add: true, x, y, z, sx: 0.3, sz: 0.3, sy: 0.2, vy: 0.7, vs: 0.2, life: [0.7, 1.1], size: [0.12, 0.08], c0: '#9aff9a', c1: '#40e070', kind: 4 }); },
  frost(x, y, z) { emit(12, { add: true, x, y, z, vs: 2.2, up: 0.6, life: [0.4, 0.8], size: [0.1, 0.03], c0: '#e8fbff', c1: '#7ad0ff', grav: 2, kind: 5, spin: 6 }); emit(4, { x, y, z, sx: 0.4, sz: 0.4, vs: 0.4, life: [0.8, 1.3], size: [0.3, 0.7], c0: '#dff4ff', c1: '#bfe0f4', alpha: 0.45, kind: 1 }); },
  levelup(x, y, z) { emit(18, { add: true, x, y: y + 0.1, z, sx: 0.35, sz: 0.35, vy: 1.0, up: 0.8, vs: 0.2, life: [0.8, 1.3], size: [0.1, 0.03], c0: '#fff2a0', c1: '#ffb020', kind: 6, spin: 3 }); emit(1, { add: true, x, y: y + 0.03, z, life: [0.6, 0.6], size: [0.2, 0.9], c0: '#ffe070', alpha: 0.9, kind: 3 }); },
  lightning(x, y, z) { emit(1, { add: true, x, y: y + 0.05, z, life: [0.3, 0.3], size: [0.2, 1.2], c0: '#d8e8ff', alpha: 1, kind: 3 }); emit(10, { add: true, x, y: y + 0.3, z, vs: 3, up: 1, life: [0.15, 0.35], size: [0.06, 0.02], c0: '#ffffff', c1: '#80b0ff', kind: 2 }); },
  splash(x, y, z) { emit(10, { x, y, z, vs: 1.2, up: 2.0, life: [0.4, 0.7], size: [0.06, 0.03], c0: '#e8f6ff', c1: '#9ad0f0', grav: 7, kind: 0 }); },
  stomp(x, y, z) { emit(1, { x, y: y + 0.04, z, life: [0.6, 0.6], size: [0.3, 3.2], c0: '#d8c8a8', alpha: 0.8, kind: 3 }); FX.dust(x, y, z, 2.2); emit(10, { x, y, z, sx: 1, sz: 1, vs: 1.5, up: 2.5, life: [0.5, 0.9], size: [0.07, 0.07], c0: '#7a6a58', grav: 8, kind: 5, spin: 8, ground: y }); },
  build(x, y, z) { emit(5, { x, y, z, vs: 1.2, up: 1.2, life: [0.4, 0.7], size: [0.05, 0.04], c0: '#d8b070', c1: '#a07840', grav: 6, kind: 5, spin: 10, ground: y - 0.3 }); },
  /** Rayo encadenado entre dos puntos (zigzag de estelas). */
  beam(x0, y0, z0, x1, y1, z1) {
    const n = 8; let px = x0, py = y0, pz = z0;
    for (let i = 1; i <= n; i++) {
      const t = i / n, j = i < n ? 0.18 : 0, nx = x0 + (x1 - x0) * t + (Math.random() - 0.5) * j, ny = y0 + (y1 - y0) * t + (Math.random() - 0.5) * j, nz = z0 + (z1 - z0) * t + (Math.random() - 0.5) * j;
      const dx = nx - px, dy = ny - py, dz = nz - pz, l = Math.hypot(dx, dy, dz) || 1;
      emit(1, { add: true, x: (px + nx) / 2, y: (py + ny) / 2, z: (pz + nz) / 2, vx: dx / l * 1e-3, vy: dy / l * 1e-3, vz: dz / l * 1e-3, life: [0.22, 0.28], size: [0.07, 0.05], stretch: l / 0.07, c0: '#f4f8ff', c1: '#7aa8ff', kind: 2 });
      px = nx; py = ny; pz = nz;
    }
  },
  /** Relámpago del cielo al suelo. */
  bolt(x, y, z) { FX.beam(x + (Math.random() - 0.5) * 2, y + 9, z - 2, x, y, z); FX.beam(x + (Math.random() - 0.5) * 2, y + 9, z - 2, x, y, z); FX.lightning(x, y, z); FX.dust(x, y, z, 1.4); },
};
export { P as PARTICLES, initParticles, disposeParticles, emit, stepParticles, particleCount, FX };
