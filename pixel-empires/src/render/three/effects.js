/* =====================================================================
   Efectos: traduce los efectos de la simulación (G.fx) a partículas y
   mantiene los emisores continuos: humo de chimeneas, edificios en
   llamas, árboles ardiendo, auras de generales, aturdidos, estelas de
   proyectiles, polvo de pisadas y el clima (lluvia, nieve, tormenta).
   ===================================================================== */
import { T } from '../../data/data.js';
import { G, isAlly } from '../../sim/game.js';
import { visibleAt } from '../../world/world.js';
import { GLOBAL } from './shaderlib.js';
import { heightAt, footprintHeight, WATER_LEVEL } from './terrain.js';
import { emit, stepParticles, FX } from './particles.js';
import { ENT, lerpXY } from './entities.js';
import { artDef } from './art/index.js';

const SEEN = new WeakSet();
// desplazamiento vertical (px de la vista 2D) que la simulación suma a algunos efectos
const OFF = { fx_levelup: 10, fx_heal: 8, fx_blood: 8, fx_lightning: 16, fx_magic: 4, fx_frost: 4 };
const AURA = { human: '#ffd870', elf: '#8aff9a', dwarf: '#ffb060', orc: '#ff6a4a', giant: '#9adcff' };
const W = { bolt: null, acc: 0 };

function at(x, y, hOff = 0) { const X = x / T, Z = y / T; return [X, heightAt(X, Z) + hOff, Z]; }
function onFx(f) {
  const off = OFF[f.key] || 0, gy = f.y + off, X = f.x / T, Z = gy / T, Y = heightAt(X, Z) + off / T * 0.9 + 0.15;
  if (!visibleAt(f.x, gy)) return;
  switch (f.key) {
    case 'fx_blood': FX.blood(X, Y + 0.15, Z); break;
    case 'fx_dust': FX.dust(X, Y, Z); break;
    case 'fx_smoke': FX.smoke(X, Y + 0.3, Z, 1.5); break;
    case 'fx_explosion': FX.explosion(X, Y, Z, 1.2); break;
    case 'fx_fire': FX.fire(X, Y, Z, 2); break;
    case 'fx_magic': FX.magic(X, Y + 0.2, Z); break;
    case 'fx_heal': FX.heal(X, Y + 0.2, Z); break;
    case 'fx_frost': FX.frost(X, Y + 0.2, Z); break;
    case 'fx_levelup': FX.levelup(X, Y - 0.1, Z); break;
    case 'fx_lightning': FX.lightning(X, heightAt(X, Z), Z); break;
    case 'fx_splash': FX.splash(X, WATER_LEVEL + 0.02, Z); break;
    case 'fx_stomp': FX.stomp(X, heightAt(X, Z), Z); break;
    case 'fx_build': FX.build(X, Y, Z); break;
    case 'beam': { const a = at(f.x, f.y + 8, 0.4), b = at(f.x2, f.y2 + 8, 0.4); FX.beam(a[0], a[1], a[2], b[0], b[1], b[2]); break; }
  }
}
const chance = r => Math.random() < r;
const hsh = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** Paso de efectos por frame (dt real; 0 en pausa). foot = [{X, Z}...] o null. */
function updateEffects(dt, alpha, foot) {
  if (!G) return;
  for (const f of G.fx) if (!SEEN.has(f)) { SEEN.add(f); onFx(f); }
  if (dt <= 0) { stepParticles(0); return; }
  const human = G.human, wind = GLOBAL.uWind.value;
  // edificios: humo de chimenea, daños y fuego
  for (const b of G.blds) {
    if (b.dead || b.def.flat) continue;
    const info = ENT.blds.get(b.id); if (!info) continue;
    if (!visibleAt((b.tx + b.fp / 2) * T, (b.ty + b.fp / 2) * T)) continue;
    const d = artDef(info.key, 'bld'), cy = Math.cos(info.yaw), sy = Math.sin(info.yaw);
    if (b.done && d.smoke) for (const [sx, syy, sz] of d.smoke) if (chance(dt * 1.6)) emit(1, { x: info.X + sx * cy + sz * sy, y: info.y0 + syy, z: info.Z - sx * sy + sz * cy, vx: wind.x * 0.25, vz: wind.y * 0.25, vy: 0.45, vs: 0.08, life: [2.2, 3.2], size: [0.12, 0.55], c0: '#d8d2c8', c1: '#a8a49e', alpha: 0.32, kind: 1, drag: 0.2 });
    if (b.def.invuln) continue;
    const dmg = b.done ? 1 - b.hp / b.maxhp : 0, burning = b.fire > 0;
    if (dmg > 0.5 || burning) {
      const pts = d.fire || [0, 1, 2].map(i => [(hsh(b.id, i) - 0.5) * b.fp * 0.6, info.h * (0.6 + hsh(i, b.id) * 0.3), (hsh(b.id + 5, i) - 0.5) * b.fp * 0.6]);
      const rate = burning ? 6 : (dmg - 0.5) * 14;
      pts.forEach(([px, py, pz], i) => {
        if (i > 0 && dmg < 0.75 && !burning) return;
        const X = info.X + px * cy + pz * sy, Y = info.y0 + py, Z = info.Z - px * sy + pz * cy;
        if (chance(dt * rate)) FX.fire(X, Y, Z, 1.2);
        if (chance(dt * rate * 0.35)) emit(1, { x: X, y: Y + 0.3, z: Z, vx: wind.x * 0.3, vz: wind.y * 0.3, vy: 0.6, vs: 0.1, life: [1.6, 2.4], size: [0.25, 0.9], c0: '#3a3632', c1: '#6a6660', alpha: 0.5, kind: 1, drag: 0.3 });
      });
    }
  }
  // árboles en llamas
  if (G.fires) for (const r of G.fires) { if (!r.burn || r.dead) continue; const X = r.tx + 0.5, Z = r.ty + 0.5; if (!visibleAt(X * T, Z * T)) continue; const h = heightAt(X, Z); if (chance(dt * 9)) FX.fire(X, h + 0.4 + Math.random() * 0.7, Z, 1.3); if (chance(dt * 2)) FX.smoke(X, h + 1.1, Z, 0.8); }
  // unidades: auras, aturdidos, grito de guerra, polvo de pisadas
  for (const u of G.units) {
    if (u.dead || u.inside) continue;
    if (!isAlly(u.team, human) && !visibleAt(u.x, u.y)) continue;
    const def = u.def;
    if (def.aura || u.stun > 0 || (u.cryT && u.cryT > G.time) || (u.anim === 'walk' && (def.race === 'giant' || def.role === 'cav' || def.role === 'siege'))) {
      const [x, y] = lerpXY(u, alpha), X = x / T, Z = y / T, h = heightAt(X, Z), tall = def.race === 'giant' ? 1.3 : 0.7;
      if (def.aura) {
        const c = AURA[def.race] || '#ffe080', r = (def.aura.r || 4) * 0.9;
        if (chance(dt * 1.1)) emit(1, { add: true, x: X, y: h + 0.05, z: Z, life: [1.6, 1.6], size: [0.4, r * 2], c0: c, alpha: 0.35, kind: 3, fadeIn: 0.2 });
        if (chance(dt * 5)) { const a = Math.random() * 6.28, rr = 0.3 + Math.random() * 0.4; emit(1, { add: true, x: X + Math.cos(a) * rr, y: h + 0.1, z: Z + Math.sin(a) * rr, vy: 0.6, life: [0.9, 1.4], size: [0.06, 0.02], c0: c, kind: 6 }); }
      }
      if (u.stun > 0 && chance(dt * 10)) { const a = G.time * 6 + Math.random() * 6.28; emit(1, { add: true, x: X + Math.cos(a) * 0.15, y: h + tall + 0.08, z: Z + Math.sin(a) * 0.15, vx: -Math.sin(a) * 0.6, vz: Math.cos(a) * 0.6, life: [0.3, 0.45], size: [0.07, 0.04], c0: '#fff4a0', kind: 6 }); }
      if (u.cryT && u.cryT > G.time && chance(dt * 4)) emit(1, { add: true, x: X, y: h + 0.2, z: Z, sx: 0.3, sz: 0.3, vy: 0.8, life: [0.6, 0.9], size: [0.07, 0.03], c0: '#ff8a5a', c1: '#ff3a20', kind: 0 });
      if (u.anim === 'walk' && !def.aura && chance(dt * (def.race === 'giant' ? 5 : 3))) emit(1, { x: X, y: h + 0.04, z: Z, sx: 0.25, sz: 0.25, vs: 0.3, up: 0.2, life: [0.5, 0.9], size: [0.1, 0.3], c0: '#b9a07a', c1: '#9a8a70', alpha: 0.35, kind: 1, drag: 2 });
    }
  }
  // estelas de proyectiles
  for (const p of G.projs) {
    if (p.t < 0 || !visibleAt(p.x, p.y)) continue;
    const st = ENT.proj.get(p); if (!st) continue;
    if (p.art === 'proj_magic') emit(1, { add: true, x: st.x, y: st.y, z: st.z, vs: 0.2, life: [0.2, 0.35], size: [0.1, 0.02], c0: '#d8b0ff', c1: '#6a40ff', kind: 0 });
    else if (p.art === 'proj_frost') emit(1, { add: true, x: st.x, y: st.y, z: st.z, vs: 0.3, life: [0.25, 0.4], size: [0.08, 0.02], c0: '#e8fbff', c1: '#7ad0ff', kind: 5, spin: 5 });
    else if (p.art === 'proj_lightning') emit(1, { add: true, x: st.x, y: st.y, z: st.z, vs: 0.4, life: [0.1, 0.2], size: [0.08, 0.02], c0: '#ffffff', c1: '#8ab0ff', kind: 6 });
    else if ((p.art === 'proj_cannonball' || p.art === 'proj_rock') && chance(0.6)) emit(1, { x: st.x, y: st.y, z: st.z, vs: 0.1, life: [0.5, 0.9], size: [0.06, 0.25], c0: p.art === 'proj_cannonball' ? '#6a6460' : '#b9a07a', alpha: 0.45, kind: 1 });
  }
  updateWeather(dt, foot);
  stepParticles(dt);
}
/** Lluvia, nieve, tormenta (relámpagos) y neblina dentro del área que ve la cámara. */
function updateWeather(dt, foot) {
  const w = G.weather; if (!w) return;
  const a = w.a || 0, cur = w.cur;
  GLOBAL.uHaze.value = (cur === 'fog' ? 0.75 : cur === 'storm' ? 0.4 : cur === 'rain' ? 0.25 : cur === 'snow' ? 0.18 : 0) * a;
  if (w.bolt && w.bolt !== W.bolt) { W.bolt = w.bolt; const X = w.bolt.x / T, Z = w.bolt.y / T; FX.bolt(X, heightAt(X, Z), Z); }
  if (!foot || !(cur === 'rain' || cur === 'storm' || cur === 'snow') || a <= 0.01) return;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of foot) { x0 = Math.min(x0, p.X); x1 = Math.max(x1, p.X); z0 = Math.min(z0, p.Z); z1 = Math.max(z1, p.Z); }
  const area = (x1 - x0) * (z1 - z0), wind = GLOBAL.uWind.value;
  if (cur === 'snow') {
    W.acc += dt * Math.min(400, area * 0.35) * a; const n = Math.floor(W.acc); W.acc -= n;
    for (let i = 0; i < n; i++) { const X = x0 + Math.random() * (x1 - x0), Z = z0 + Math.random() * (z1 - z0), h = heightAt(Math.max(0, X), Math.max(0, Z)); emit(1, { x: X, y: h + 2.5 + Math.random() * 2, z: Z, vx: wind.x * 0.4, vz: wind.y * 0.4, vy: -0.7, vs: 0.25, vsy: 0.2, life: [4, 5.5], size: [0.05, 0.04], c0: '#ffffff', alpha: 0.9, kind: 5, spin: 2, ground: h + 0.02, fadeIn: 0.05 }); }
  } else {
    const storm = cur === 'storm';
    W.acc += dt * Math.min(storm ? 2200 : 1400, area * (storm ? 2.6 : 1.7)) * a; const n = Math.floor(W.acc); W.acc -= n;
    for (let i = 0; i < n; i++) {
      const X = x0 + Math.random() * (x1 - x0), Z = z0 + Math.random() * (z1 - z0), h = heightAt(Math.max(0, X), Math.max(0, Z)), y = h + 3 + Math.random() * 3, sp = storm ? 16 : 13;
      emit(1, { x: X, y, z: Z, vx: wind.x * (storm ? 3 : 1.5), vz: wind.y * (storm ? 3 : 1.5), vy: -sp, life: [(y - h) / sp, (y - h) / sp], size: [0.1, 0.1], stretch: 4, c0: '#e4eefc', alpha: 0.75, kind: 2, fadeIn: 0.02 });
    }
  }
}
export { updateEffects };
