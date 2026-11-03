/* =====================================================================
   Render 3D (Three.js) que implementa el contrato de render/view.js.
   Cámara en perspectiva con ángulo fijo tipo AoE y zoom suave anclado
   al cursor, luz direccional cálida + ambiente con sombras acotadas a la
   cámara, niebla de guerra en shader, picking por rayo/proyección e
   interpolación entre pasos de la simulación (30 Hz → 60 fps).
   ===================================================================== */
import * as THREE from 'three';
import { T, BLD } from '../../data/data.js';
import { G, clamp, isAlly, isAnimal, tileOf, canPlace } from '../../sim/game.js';
import { exploredAt, visibleAt } from '../../world/world.js';
import { UI, placementTiles, roadTiles, canRoad } from '../../ui/ui.js';
import { GLOBAL } from './shaderlib.js';
import { TERR, buildTerrain, heightAt, footprintHeight, terrainTileChanged, disposeTerrain } from './terrain.js';
import { buildWater, disposeWater } from './water.js';
import { VIEWS, buildEntities, updateEntities, disposeEntities, lerpXY, bldHeight } from './entities.js';
import { initOverlay, resizeOverlay, drawOverlay } from './overlay.js';
import { initParticles, disposeParticles } from './particles.js';
import { updateEffects } from './effects.js';
import { modelIcon, modelFrameTo } from './portrait.js';
import { Q, PRESETS } from './quality.js';
import { titleFrame, disposeTitle } from './title3d.js';

const PITCH = 52 * Math.PI / 180, FOV = 34;
const E = {
  kind: 'three', renderer: null, scene: null, camera: null, dom: null, sun: null, hemi: null,
  dist: 20, tdist: 20, dmin: 7, dmax: 46, anchor: null, ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), v: new THREE.Vector3(),
  fogTex: null, fogData: null, ready: false, time: 0,
};

function initThree(dom) {
  E.dom = dom.canvas3d;
  E.renderer = new THREE.WebGLRenderer({ canvas: E.dom, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  E.renderer.outputColorSpace = THREE.SRGBColorSpace; E.renderer.toneMapping = THREE.ACESFilmicToneMapping; E.renderer.toneMappingExposure = 1.05;
  E.renderer.shadowMap.enabled = true; E.renderer.shadowMap.type = THREE.PCFShadowMap;
  E.scene = new THREE.Scene(); E.scene.background = new THREE.Color('#14111f');
  E.camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.5, 400);
  E.hemi = new THREE.HemisphereLight('#cfe0ff', '#7a6a50', 1.5); E.scene.add(E.hemi);
  E.sun = new THREE.DirectionalLight('#fff0d2', 2.1); E.sun.castShadow = true;
  E.sun.shadow.bias = -0.0006; E.sun.shadow.normalBias = 0.02; E.sun.shadow.radius = 2.5;
  E.scene.add(E.sun); E.scene.add(E.sun.target);
  initOverlay(dom.overlay);
  if (matchMedia('(pointer: coarse)').matches) { E.tdist = E.dist = 16; }
  applyQuality();
}
function applyQuality() {
  E.renderer.shadowMap.enabled = Q.shadows; E.sun.castShadow = Q.shadows;
  E.sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize); if (E.sun.shadow.map) { E.sun.shadow.map.dispose(); E.sun.shadow.map = null; }
}
function resize3() {
  const dpr = Math.min(Q.dprCap, window.devicePixelRatio || 1) * Q.scale;
  E.renderer.setPixelRatio(dpr); E.renderer.setSize(innerWidth, innerHeight, true);
  E.camera.aspect = innerWidth / innerHeight; E.camera.updateProjectionMatrix();
  resizeOverlay(Math.min(2, window.devicePixelRatio || 1));
}
function onGameStart3() {
  disposeTitle(); disposeTerrain(E.scene); disposeWater(E.scene); disposeEntities(E.scene); disposeParticles();
  const m = G.map;
  buildTerrain(m, E.scene); buildWater(E.scene); buildEntities(E.scene); initParticles(E.scene);
  GLOBAL.uMapSize.value.set(m.W, m.H);
  E.fogData = new Uint8Array(m.W * m.H);
  if (E.fogTex) E.fogTex.dispose();
  E.fogTex = new THREE.DataTexture(E.fogData, m.W, m.H, THREE.RedFormat, THREE.UnsignedByteType);
  E.fogTex.magFilter = THREE.LinearFilter; E.fogTex.minFilter = THREE.LinearFilter; E.fogTex.needsUpdate = true;
  GLOBAL.uFogTex.value = E.fogTex;
  E.anchor = null; E.ready = true;
  // iconos 3D de la raza del jugador: se generan de a uno por frame para no bloquear la interfaz
  E.iconQueue = [];
  if (G.human >= 0) {
    const race = G.players[G.human].race, team = G.players[G.human].color;
    for (const r of ['worker', 'inf', 'pike', 'ranged', 'cav', 'special', 'siege', 'general']) E.iconQueue.push(['units', race + '_' + r, team]);
    for (const t of ['house', 'farm', 'mill', 'lumber', 'mine', 'barracks', 'range', 'stable', 'temple', 'forge', 'market', 'tower', 'wall_post', 'gate', 'workshop', 'castle', 'tc']) E.iconQueue.push(['buildings', race + '_' + t, team]);
    for (const k of ['cmd_build', 'cmd_wall', 'cmd_attackmove', 'cmd_stop', 'cmd_upg_walls', 'cmd_repair', 'cmd_delete', 'cmd_back', 'cmd_rally', 'cmd_idle', 'cmd_road', 'cmd_upg_loom', 'cmd_ageup']) E.iconQueue.push(['nature', k, team]);
    for (const k of ['icon_attack', 'icon_armor', 'icon_parmor', 'icon_range', 'icon_speed']) E.iconQueue.push(['nature', k, 0]);
  }
}
// ------------------------------------------------------------- cámara
function placeCamera(shake) {
  const tx = G.cam.x / T, tz = G.cam.y / T, ty = Math.max(0, heightAt(tx, tz));
  const d = E.dist; let sx = 0, sz = 0;
  // sacudida suave (terremotos, pisotones): ruido continuo que decae con G.shake
  if (shake) { const a = Math.min(1, G.shake) * 0.3 * (0.6 + d / 50), t = E.time * 31; sx = (Math.sin(t) + Math.sin(t * 2.3 + 1.7) * 0.6) * a; sz = (Math.sin(t * 1.7 + 0.4) + Math.sin(t * 3.1) * 0.5) * a * 0.7; }
  E.camera.position.set(tx + sx, ty + d * Math.sin(PITCH), tz + d * Math.cos(PITCH) + sz);
  E.camera.lookAt(tx + sx, ty, tz + sz);
  E.camera.updateMatrixWorld();
}
function rayGround(cx, cy) {
  E.ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  E.ray.setFromCamera(E.ndc, E.camera);
  const o = E.ray.ray.origin, dir = E.ray.ray.direction; if (dir.y > -1e-4) return null;
  let h = 0, t = (h - o.y) / dir.y;
  for (let k = 0; k < 5; k++) { const x = o.x + dir.x * t, z = o.z + dir.z * t; h = heightAt(x, z); t = (h - o.y) / dir.y; }
  return { X: o.x + dir.x * t, Z: o.z + dir.z * t };
}
function project(X, Y, Z) {
  E.v.set(X, Y, Z).project(E.camera);
  return { x: (E.v.x + 1) / 2 * innerWidth, y: (1 - E.v.y) / 2 * innerHeight, z: E.v.z };
}
const viewH = () => 2 * E.dist * Math.tan(FOV * Math.PI / 360);   // alto visible (unidades) en el objetivo
function clampCam3(cam) {
  const W = G.map.W * T, H = G.map.H * T;
  cam.x = clamp(cam.x, 2 * T, W - 2 * T); cam.y = clamp(cam.y, 2 * T, H + 1 * T);
}
/** Zoom continuo con el punto (cx, cy) fijo en pantalla. */
function setDist(nd, cx, cy, immediate) {
  E.tdist = clamp(nd, E.dmin, E.dmax);
  if (cx !== undefined) { placeCamera(false); const g = rayGround(cx, cy); if (g) E.anchor = { cx, cy, X: g.X, Z: g.Z }; }
  if (immediate) { E.dist = E.tdist; keepAnchor(); }
}
function keepAnchor() {
  if (!E.anchor) return; placeCamera(false);
  const g = rayGround(E.anchor.cx, E.anchor.cy); if (!g) return;
  G.cam.x += (E.anchor.X - g.X) * T; G.cam.y += (E.anchor.Z - g.Z) * T; clampCam3(G.cam);
}
// ------------------------------------------------------------- picking
function pick3(w, css, touch) {
  if (!css) return null;
  const human = G.human;
  // unidades: cercanía en pantalla a su centro proyectado
  let best = null, bd = 1e9; const px = viewPx();
  for (const u of G.units) {
    if (u.dead || u.inside || (!isAlly(u.team, human) && !visibleAt(u.x, u.y))) continue;
    const [x, y] = lerpXY(u, E.alpha || 1), X = x / T, Z = y / T, hh = (u.def.race === 'giant' ? 1.1 : 0.6) * (u.def.role === 'cav' ? 1.2 : 1);
    const p = project(X, heightAt(X, Z) + hh * 0.5, Z); if (p.z > 1) continue;
    const r = Math.max(touch ? 24 : 14, hh * px * 0.6) + u.def.size * px / T * 0.4, d = Math.hypot(p.x - css.x, (p.y - css.y) * 0.8) - (u.team === human ? 3 : 0);
    if (d < r && d < bd) { bd = d; best = u; }
  }
  if (best) return best;
  // edificios: rayo contra su caja
  E.ndc.set(css.x / innerWidth * 2 - 1, -(css.y / innerHeight) * 2 + 1); E.ray.setFromCamera(E.ndc, E.camera);
  let bb = null, bt = 1e9; const box = new THREE.Box3(), hit = new THREE.Vector3();
  for (const b of G.blds) {
    if (b.dead || !exploredAt(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1))) continue;
    const y0 = footprintHeight(b.tx, b.ty, b.fp), hgt = b.def.flat ? 0.15 : bldHeight(b);
    box.min.set(b.tx, y0 - 0.05, b.ty); box.max.set(b.tx + b.fp, y0 + hgt, b.ty + b.fp);
    if (E.ray.ray.intersectBox(box, hit)) { const t = hit.distanceTo(E.ray.ray.origin); if (t < bt) { bt = t; bb = b; } }
  }
  if (bb) return bb;
  // tesoros, carne y recursos: sobre el punto del suelo (los árboles altos también por su copa)
  for (const t of G.treasures) if (!t.taken && Math.abs(w.x - (t.tx * T + 8)) < 12 && Math.abs(w.y - (t.ty * T + 8)) < 12 && exploredAt(t.tx, t.ty)) return t;
  for (const r of G.resBy.carcass || []) if (!r.dead && Math.abs(w.x - r.x) < 12 && Math.abs(w.y - r.y) < 10) return r;
  const tx = tileOf(w.x), ty = tileOf(w.y);
  for (const [ox, oy] of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) {
    const x = tx + ox, y = ty + oy; if (x < 0 || y < 0 || x >= G.map.W || y >= G.map.H) continue;
    const r = G.map.res[y * G.map.W + x]; if (!r || r.dead || !exploredAt(x, y)) continue;
    if (ox === 0 && oy === 0) return r;
    if (r.kind === 'tree') { const p = project(x + 0.5, heightAt(x + 0.5, y + 0.5) + 0.85, y + 0.5); if (Math.hypot(p.x - css.x, p.y - css.y) < 0.45 * px) return r; }
  }
  return null;
}
const viewPx = () => innerHeight / viewH();   // px CSS por unidad de mundo en el objetivo
function unitsInRect3(d) {
  const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
  const inBox = u => { if (u.dead || u.inside || u.team !== G.human) return false; const X = u.x / T, Z = u.y / T, p = project(X, heightAt(X, Z) + 0.3, Z); return p.z < 1 && p.x >= x0 - 6 && p.x <= x1 + 6 && p.y >= y0 - 6 && p.y <= y1 + 10; };
  let s = G.units.filter(u => inBox(u) && !isAnimal(u)); if (!s.length) s = G.units.filter(u => inBox(u));
  return s;
}
// ------------------------------------------------------------- frame
function updateFogTex() {
  const v = G.vis, d = E.fogData; for (let i = 0; i < v.length; i++) d[i] = v[i] === 2 ? 255 : v[i] === 1 ? 128 : 0;
  E.fogTex.needsUpdate = true; G.fogDirty = false;
}
function placementInfo() {
  if (!UI.mouseWorld || G.human < 0) return null;
  if (UI.placing) {
    const type = UI.placing, d = BLD[type], race = G.players[G.human].race, key = race + '_' + (type === 'wall' ? 'wall_post' : type);
    return placementTiles().map(([tx, ty]) => ({ tx, ty, fp: d.fp, key, ok: canPlace(G.human, type, tx, ty) || (type === 'gate' && G.blds.some(b => !b.dead && b.type === 'wall' && b.team === G.human && b.tx === tx && b.ty === ty)) }));
  }
  if (UI.roadDrag) return roadTiles().map(([tx, ty]) => ({ tx, ty, fp: 1, ok: canRoad(tx, ty) }));
  return null;
}
function frame3(dt, alpha) {
  if (!E.ready || !G) return;
  E.alpha = alpha; E.time += dt; GLOBAL.uTime.value = E.time;
  GLOBAL.uFogOn.value = G.human >= 0 && !G.cfg.revealed ? 1 : 0;
  if (G.fogDirty) updateFogTex();
  // zoom suave anclado
  if (Math.abs(E.tdist - E.dist) > 0.002) { E.dist += (E.tdist - E.dist) * Math.min(1, dt * 12); keepAnchor(); } else { E.dist = E.tdist; E.anchor = null; }
  placeCamera(G.shake > 0);
  // sol que sigue a la cámara (sombras acotadas a lo visible)
  const tx = G.cam.x / T, tz = G.cam.y / T, span = Math.min(60, viewH() * 1.25 + 6);
  E.sun.position.set(tx - span * 0.55, span * 1.25 + 12, tz + span * 0.35); E.sun.target.position.set(tx, 0, tz);
  const sc = E.sun.shadow.camera; sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = span * 4 + 40; sc.updateProjectionMatrix();
  // relámpagos
  GLOBAL.uFlash.value = Math.max(0, G.weather.flash || 0);
  E.hemi.intensity = 1.5 * (G.weather.cur === 'storm' ? 0.7 : G.weather.cur === 'rain' ? 0.85 : 1);
  E.sun.intensity = 2.1 * (G.weather.cur === 'storm' ? 0.45 : G.weather.cur === 'rain' || G.weather.cur === 'fog' ? 0.65 : G.weather.cur === 'snow' ? 0.8 : 1) + Math.max(0, G.weather.flash || 0) * 4;
  // viento: más fuerte con lluvia y tormenta, con rachas lentas
  const wk = (G.weather.cur === 'storm' ? 2.3 : G.weather.cur === 'rain' ? 1.5 : G.weather.cur === 'snow' ? 0.8 : 1) * (0.8 + 0.25 * Math.sin(E.time * 0.37) + 0.12 * Math.sin(E.time * 1.3));
  GLOBAL.uWind.value.set(0.8 * wk, 0.3 * wk);
  // entidades del área visible
  const a = rayGround(0, 0), b = rayGround(innerWidth, 0), c = rayGround(0, innerHeight), d = rayGround(innerWidth, innerHeight);
  const pts = [a, b, c, d].filter(Boolean); let x0 = 0, x1 = G.map.W - 1, y0 = 0, y1 = G.map.H - 1;
  if (pts.length === 4) { x0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p.X))) - 2); x1 = Math.min(G.map.W - 1, Math.ceil(Math.max(...pts.map(p => p.X))) + 2); y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p.Z))) - 2); y1 = Math.min(G.map.H - 1, Math.ceil(Math.max(...pts.map(p => p.Z))) + 3); }
  E.foot = pts.length === 4 ? [a, b, d, c] : null;
  updateEntities(alpha, { tileBox: { x0, y0, x1, y1 }, placement: placementInfo(), dt, time: E.time, dist: E.dist });
  updateEffects(dt, alpha, E.foot);
  E.renderer.render(E.scene, E.camera);
  drawOverlay(dt, alpha, project, viewPx());
  if (E.iconQueue && E.iconQueue.length) { const [k, key, team] = E.iconQueue.shift(); modelIcon(E.renderer, k, key, team, 64); }
}
// ------------------------------------------------------------- contrato
// Three.js genera UUIDs con Math.random al crear objetos; el render usa su propio generador para no
// alterar la secuencia aleatoria de la simulación (misma partida con render pixel o 3D).
let _rs = 0x2545f491;
const renderRandom = () => { _rs |= 0; _rs = _rs + 0x6D2B79F5 | 0; let t = Math.imul(_rs ^ _rs >>> 15, 1 | _rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function isolated(fn, a, b, c) { const r = Math.random; Math.random = renderRandom; try { return fn(a, b, c); } finally { Math.random = r; } }
const threeRenderer = {
  kind: 'three', get dom() { return E.dom; },
  init(dom) { isolated(initThree, dom); dom.canvas.hidden = true; E.dom.hidden = false; dom.overlay.hidden = false; },
  resize() { resize3(); },
  onGameStart() { isolated(onGameStart3); },
  beforeStep() { for (const u of G.units) { u._px = u.x; u._py = u.y; } for (const p of G.projs) { p._px = p.x; p._py = p.y; } },
  frame(dt, alpha) { isolated(frame3, dt, alpha); },
  terrainChanged(tx, ty) { isolated(() => terrainTileChanged(G.map, tx, ty)); },
  worldToScreen(x, y, h = 0.3) { placeCamera(false); const X = x / T, Z = y / T; return project(X, heightAt(X, Z) + h, Z); },
  screenToWorld(cx, cy) { if (!E.ready) return { x: G.cam.x, y: G.cam.y }; placeCamera(false); const g = rayGround(cx, cy); return g ? { x: g.X * T, y: g.Z * T } : { x: G.cam.x, y: G.cam.y }; },
  worldPerCss() { return viewH() / innerHeight * T; },
  panDelta(dx, dy) { const k = viewH() / innerHeight * T; return { x: dx * k, y: dy * k / Math.sin(PITCH) }; },
  viewWorldSize() { const h = viewH(); return { w: h * (innerWidth / innerHeight) * T, h: h / Math.sin(PITCH) * T }; },
  clampCam(cam) { clampCam3(cam); },
  zoomState() { return { canIn: E.tdist > E.dmin + 0.01, canOut: E.tdist < E.dmax - 0.01 }; },
  zoomStep(dir, cx, cy) { setDist(E.tdist * (dir > 0 ? 0.82 : 1 / 0.82), cx, cy, false); return true; },
  pinchBegin() { E.pinch0 = E.tdist; },
  pinchUpdate(ratio, cx, cy) { setDist(E.pinch0 / ratio, cx, cy, true); return true; },
  pick(w, css, touch) { return pick3(w, css, touch); },
  unitsInScreenRect(d) { return unitsInRect3(d); },
  isOnScreen(u) { const X = u.x / T, Z = u.y / T, p = project(X, heightAt(X, Z), Z); return p.z < 1 && p.x >= 0 && p.y >= 0 && p.x <= innerWidth && p.y <= innerHeight; },
  drawMinimapView(x) { if (!E.foot) return; x.beginPath(); E.foot.forEach((p, i) => i ? x.lineTo(p.X, p.Z) : x.moveTo(p.X, p.Z)); x.closePath(); x.stroke(); },
  /** Fondo animado de la pantalla de título (sin partida). */
  titleFrame(dt, race) { if (E.renderer) isolated(titleFrame, E.renderer, dt, race); },
  /** Ajustes gráficos: { preset, shadows, particles, scale } (los que falten salen del preset). */
  setQuality(o) {
    Object.assign(Q, PRESETS[o.preset] || PRESETS[Q.preset], { preset: o.preset || Q.preset });
    if (o.shadows !== undefined) Q.shadows = o.shadows; if (o.particles !== undefined) Q.particles = o.particles; if (o.scale) Q.scale = o.scale;
    if (E.renderer) { applyQuality(); resize3(); E.scene.traverse(m => { if (m.material) m.material.needsUpdate = true; }); }
  },
  /** Galería: dibuja el modelo (animado si es unidad) en un canvas; false si no hay modelo 3D. */
  galleryFrame(cv, kind, key, anim, t) { return E.renderer ? isolated(() => modelFrameTo(cv, kind, key.startsWith('neutral_') && kind === 'buildings' ? key.slice(8) : key, 0, anim, t)) : false; },
  icon(kind, key, team, size) { return E.ready || E.renderer ? modelIcon(E.renderer, kind, key, team, size) : null; },
  quality: Q, applyQuality, E,
};
export { threeRenderer, E, Q, project, rayGround };
