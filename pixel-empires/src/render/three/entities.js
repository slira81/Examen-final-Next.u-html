/* =====================================================================
   Vistas de entidades: traduce el estado de la simulación a instancias
   de los modelos procedurales (unidades con rig, edificios, naturaleza,
   proyectiles). Solo lee G; nunca lo modifica.
   ===================================================================== */
import * as THREE from 'three';
import { T, BLD } from '../../data/data.js';
import { G, isAlly, farmFood } from '../../sim/game.js';
import { exploredAt, visibleAt } from '../../world/world.js';
import { PE } from '../pixel/sprite.js';
import { teamColorIdx } from '../view.js';
import { heightAt, footprintHeight, WATER_LEVEL } from './terrain.js';
import { withFog } from './shaderlib.js';
import { RigSet, StaticSet } from './sets.js';
import { Pose, animate, writeBones, bonesBegin, bonesRow, bonesEnd, BT, MAXP } from './rig.js';
import { artDef, artGeometry, skeletonOf } from './art/index.js';
import { Builder } from './kit.js';
import { Q } from './quality.js';

const TWF = MAXP * 3 * 4;      // floats por fila de huesos
const V = { scene: null, rig: new Map(), stat: new Map(), poses: new Map(), rs: new Map(), proj: new WeakMap(), corpse: new WeakMap(), used: new Set(), blds: new Map(), collapsing: [], dying: [], teamCols: [], tint: new Map(), decorRows: null };

/** Posición interpolada entre el paso anterior y el actual de la simulación. */
function lerpXY(e, alpha) {
  if (e._px === undefined) return [e.x, e.y];
  const dx = e.x - e._px, dy = e.y - e._py; if (dx * dx + dy * dy > 64 * 64) return [e.x, e.y];   // teletransporte (salir de un edificio)
  return [e._px + dx * alpha, e._py + dy * alpha];
}
const C = new Map(); const col = h => { let c = C.get(h); if (!c) { c = new THREE.Color(h); C.set(h, c); } return c; };
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function rigSet(key) {
  const lod = V.lodUnits, k = lod ? key + '#lod' : key;
  let s = V.rig.get(k);
  if (!s) { s = new RigSet(V.scene, artGeometry(key, 'unit', 0, lod), { cap: 8 }); V.rig.set(k, s); }
  s.mesh.castShadow = !V.far;
  if (!V.used.has(s)) { V.used.add(s); s.begin(); }
  return s;
}
function statSet(key, kind, variant = 0, opts) {
  const lod = !(opts && opts.ghost) && (kind === 'nature' ? V.lodNature : kind === 'bld' ? V.lodUnits : false);
  const k = key + '#' + variant + (opts && opts.ghost ? '#g' : '') + (lod ? '#lod' : '');
  let s = V.stat.get(k);
  if (!s) { s = new StaticSet(V.scene, artGeometry(key, kind, variant, lod), Object.assign({ cap: 8 }, opts || {})); V.stat.set(k, s); }
  if (!V.used.has(s)) { V.used.add(s); s.begin(); }
  return s;
}
function poseOf(key) { let p = V.poses.get(key); if (!p) { p = new Pose(skeletonOf(key)); V.poses.set(key, p); } return p; }
/** Clave de arte de un edificio (los neutrales no llevan prefijo de raza). */
const bldKey = b => b.key.startsWith('neutral_') ? b.key.slice(8) : b.key;
/** Altura del modelo de un edificio (para picking, barras y fuego). */
function bldHeight(b) {
  if (b.def.wall || b.def.gate) return 1;
  return artGeometry(bldKey(b), 'bld').userData.height || 1.2;
}

// ------------------------------------------------------------ elementos fijos (anillos, fantasma)
const VIEWS = { ring: null, scorch: null };
function buildEntities(scene) {
  V.scene = scene;
  V.teamCols = PE.TEAM_COLORS.map(t => new THREE.Color(t.hex));
  const ringGeo = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
  VIEWS.ring = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 600);
  VIEWS.ring.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3); VIEWS.ring.count = 0; VIEWS.ring.frustumCulled = false; VIEWS.ring.renderOrder = 3; scene.add(VIEWS.ring);
  // quemaduras y huellas en el suelo
  const sb = new Builder(); const pts = []; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = 0.38 + ((i * 37) % 10) / 60; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  sb.extrude(pts, 0.01, { rx: -Math.PI / 2, y: 0.012, color: '#2a221c' });
  V.scorchGeo = sb.geometry();
  // fauna y decoración por filas (para recorrer solo lo visible)
  V.decorRows = []; for (const d of G.map.decor) (V.decorRows[d.ty] || (V.decorRows[d.ty] = [])).push(d);
  V.rs.clear(); V.blds.clear(); V.collapsing.length = 0;
  tileGhost();   // crea ya el material translúcido del fantasma (se compila con la escena)
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------ unidades
function workStyle(u) {
  const o = u.order;
  if (u.def.role !== 'worker' || !o) return null;
  if (o.t === 'gather') return o.kind === 'tree' ? 'chop' : o.kind === 'gold' || o.kind === 'stone' || o.kind === 'iron' || o.kind === 'gems' ? 'mine' : 'gather';
  if (o.t === 'farm') return 'farm';
  if (o.t === 'build') return 'build';
  if (o.t === 'attack') return 'hunt';
  if (o.t === 'return') return u.ckind === 'wood' ? 'chop' : u.ckind === 'food' ? 'gather' : 'mine';
  return null;
}
function targetOf(u) {
  if (u.anim === 'attack' && u.swTarget && !u.swTarget.dead) return u.swTarget;
  const o = u.order; if (!o) return null;
  if (u.anim === 'work') return o.res || o.b || null;
  if (o.t === 'attack' && o.target && !o.target.dead && u.anim !== 'walk') return o.target;
  return null;
}
const centerOfE = e => e.k === 'b' ? { x: (e.tx + e.fp / 2) * T, y: (e.ty + e.fp / 2) * T } : e.k === 'r' && e.x === undefined ? { x: e.tx * T + 8, y: e.ty * T + 8 } : { x: e.x, y: e.y };
const ST = { anim: 'idle', f: 0, k: 0, t: 0, seed: 0, work: null, carry: null, stun: 0, dead: -1, wheel: 0 };
function drawUnit(u, x, y, dt, time) {
  const def = artDef(u.key, 'unit'), X = x / T, Z = y / T;
  let rs = V.rs.get(u.id);
  if (!rs) { rs = { yaw: u.face < 0 ? -Math.PI / 2 + 0.45 : Math.PI / 2 - 0.45, lx: x, ly: y, seed: hash(u.id, 7), seen: 0 }; V.rs.set(u.id, rs); }
  rs.seen = time;
  const mdx = x - rs.lx, mdy = y - rs.ly; rs.lx = x; rs.ly = y;
  let target = null; const tg = targetOf(u);
  if (tg) { const c = centerOfE(tg); if (Math.abs(c.x - x) + Math.abs(c.y - y) > 0.5) target = Math.atan2(c.x - x, c.y - y); }
  else if (mdx * mdx + mdy * mdy > 0.0025) target = Math.atan2(mdx, mdy);
  if (target !== null) rs.yaw = wrapA(rs.yaw + wrapA(target - rs.yaw) * Math.min(1, dt * 11));
  ST.anim = u.anim || 'idle'; ST.f = u.af || 0; ST.k = ST.anim === 'attack' ? (u.af || 0) / 4 : 0; ST.t = time; ST.seed = rs.seed;
  ST.work = workStyle(u); ST.carry = u.carry > 0 ? u.ckind : null; ST.stun = u.stun || 0; ST.dead = -1;
  if (ST.anim === 'walk') rs.wheel = -(ST.f / 8) * Math.PI * 2 * ((def.anim && def.anim.wheelTurns) || 1); ST.wheel = rs.wheel || 0;
  const pose = poseOf(u.key); animate(def, pose, ST);
  const row = bonesRow(); writeBones(pose, BT.data, row * TWF);
  const tc = V.teamCols[teamColorIdx(u.team)];
  rigSet(u.key).add(row, X, heightAt(X, Z), Z, rs.yaw, def.scale || 1, tc, u.flash > 0 ? 0.6 : 0);
}
function drawDead(key, team, x, y, yaw, t, seed) {
  const def = artDef(key, 'unit'), X = x / T, Z = y / T;
  ST.anim = 'idle'; ST.f = 0; ST.k = 0; ST.t = 0; ST.seed = seed; ST.work = null; ST.carry = null; ST.stun = 0; ST.dead = t; ST.wheel = 0;
  const pose = poseOf(key); animate(def, pose, ST);
  const row = bonesRow(); writeBones(pose, BT.data, row * TWF);
  rigSet(key).add(row, X, heightAt(X, Z), Z, yaw, def.scale || 1, V.teamCols[teamColorIdx(team)], 0);
}

// ------------------------------------------------------------ edificios
function wallNb(b) {
  if (b._m3 === G.cleanT && b._m3 !== undefined) return b._mask3;
  const nb = (x, y) => G.blds.some(o => !o.dead && (o.def.wall || o.def.gate) && o.team === b.team && o.tx === x && o.ty === y);
  b._mask3 = (nb(b.tx, b.ty - 1) ? 1 : 0) | (nb(b.tx + 1, b.ty) ? 2 : 0) | (nb(b.tx, b.ty + 1) ? 4 : 0) | (nb(b.tx - 1, b.ty) ? 8 : 0); b._m3 = G.cleanT;
  return b._mask3;
}
const SEG_YAW = [[1, Math.PI / 2], [2, 0], [4, -Math.PI / 2], [8, Math.PI]];   // N, E, S, O (el tramo modelado va hacia +X)
function drawBuilding(b, time) {
  const key = bldKey(b), fp = b.fp, X = b.tx + fp / 2, Z = b.ty + fp / 2, y0 = footprintHeight(b.tx, b.ty, fp);
  const tc = V.teamCols[teamColorIdx(b.team)], flash = b.flash > 0 && b.done ? 0.3 : 0;
  const race = key.split('_')[0];
  if (b.def.wall) {
    const m = wallNb(b), clip = b.done ? 99 : 0.05 + 1.0 * b.progress;
    const straight = m === 5 || m === 10;
    if (!straight || (b.tx + b.ty) % 3 === 0) statSet(race + '_wall_post', 'bld').add(X, y0, Z, 0, 1, 1, 1, tc, 0, clip, 0, flash);
    for (const [bit, yaw] of SEG_YAW) if (m & bit) statSet(race + '_wall_seg', 'bld').add(X, y0, Z, yaw, 1, 1, 1, tc, 0, clip, 0, flash);
    if (!b.done) statSet('scaffold_1', 'nature').add(X, y0, Z, 0, 1, 1.0, 1, null);
    V.blds.set(b.id, { key: race + '_wall_post', X, Z, y0, h: 1, yaw: 0, fp, mask: 0, tc, flat: true });   // los muros no se derrumban (una puerta puede sustituirlos)
    return;
  }
  let mask = 0, yaw = 0;
  if (b.def.gate) { const m = wallNb(b); if ((m & 5) && !(m & 10)) yaw = Math.PI / 2; mask = b.open ? 4 : 2; }
  else if (b.type === 'farm') { const k = b.food / farmFood(G.players[b.team]); mask = !b.done ? 0 : 1 << (k > 0.66 ? 3 : k > 0.33 ? 2 : 1); }
  const h = artGeometry(key, 'bld').userData.height || 1.2;
  const clip = b.done || b.def.flat ? 99 : 0.04 + h * b.progress;
  statSet(key, 'bld').add(X, y0, Z, yaw, 1, 1, 1, tc, mask, clip, b.id * 0.137 % 1, flash);
  if (!b.done && !b.def.flat) statSet('scaffold_' + Math.min(4, fp), 'nature').add(X, y0, Z, 0, 1, Math.max(0.3, h * Math.min(1, b.progress + 0.25)), 1, null);
  V.blds.set(b.id, { key, X, Z, y0, h, yaw, fp, mask, tc, flat: b.def.flat });
}

// ------------------------------------------------------------ actualización por frame
function updateEntities(alpha, ctx) {
  const human = G.human, m = G.map, dt = ctx.dt || 0, time = ctx.time || 0;
  for (const s of V.used) s.begin();
  V.used.clear();
  // nivel de detalle según la distancia de la cámara (y siempre simplificado en calidad baja)
  const dist = ctx.dist || 20; V.lodNature = dist > 27 || Q.preset === 'low'; V.lodUnits = dist > 33 || Q.preset === 'low'; V.far = dist > 34;
  bonesBegin();
  // recorte por cámara (área visible del suelo con margen)
  const tb = ctx.tileBox, inView = (x, y, m) => x >= (tb.x0 - m) * T && x <= (tb.x1 + 1 + m) * T && y >= (tb.y0 - m) * T && y <= (tb.y1 + 1 + m) * T;
  // unidades
  const alive = new Set();
  for (const u of G.units) {
    if (u.dead) { const rs = V.rs.get(u.id); if (rs && !rs.dead) { rs.dead = true; V.dying.push({ x: u.x, y: u.y, yaw: rs.yaw, key: u.key, t: time }); } continue; }
    if (u.inside) continue;
    if (!isAlly(u.team, human) && !visibleAt(u.x, u.y)) continue;
    alive.add(u.id);
    if (!inView(u.x, u.y, 1.5)) continue;
    const [x, y] = lerpXY(u, alpha); drawUnit(u, x, y, dt, time);
  }
  if (V.rs.size > alive.size + 64) for (const [id, rs] of V.rs) if (time - rs.seen > 3) V.rs.delete(id);
  // cadáveres (con el giro que tenía la unidad al morir)
  V.dying = V.dying.filter(d => time - d.t < 1);
  for (const c of G.corpses) {
    if (!inView(c.x, c.y, 1) || !visibleAt(c.x, c.y)) continue;
    let yaw = V.corpse.get(c);
    if (yaw === undefined) { const d = V.dying.find(d => d.key === c.key && Math.abs(d.x - c.x) < 2 && Math.abs(d.y - c.y) < 2); yaw = d ? d.yaw : (c.face < 0 ? -Math.PI / 2 : Math.PI / 2); V.corpse.set(c, yaw); }
    drawDead(c.key, c.team, c.x, c.y, yaw, c.t, (c.x * 7 + c.y) % 1);
  }
  for (const r of G.resBy.carcass || []) if (!r.dead && exploredAt(r.tx, r.ty) && r.art) drawDead(r.art, 7, r.x, r.y, (r.face || 1) < 0 ? -1.2 : 1.2, 1, 0);
  bonesEnd();
  // edificios (y derrumbes de los que desaparecen)
  const seen = new Set();
  for (const b of G.blds) {
    if (b.dead || !exploredAt(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1))) continue;
    seen.add(b.id);
    if (!inView((b.tx + b.fp / 2) * T, (b.ty + b.fp / 2) * T, b.fp + 2)) continue;
    drawBuilding(b, time);
  }
  for (const [id, info] of V.blds) if (!seen.has(id)) { V.blds.delete(id); if (!info.flat && G.blds.every(b => b.id !== id || b.dead)) V.collapsing.push(Object.assign(info, { t0: time, tilt: (hash(id, 3) - 0.5) * 0.3 })); }
  V.collapsing = V.collapsing.filter(c => time - c.t0 < 1.6);
  for (const c of V.collapsing) {
    const k = (time - c.t0) / 1.6, e = k * k;
    statSet(c.key, 'bld').add(c.X + Math.sin(time * 40) * 0.02 * (1 - k), c.y0 - c.h * 0.95 * e, c.Z, c.yaw, 1, 1, 1, c.tc, c.mask, c.h * (1 - e) + 0.02, 0, 0, [c.tilt * e, c.tilt * 0.6 * e]);
  }
  // naturaleza y recursos del área visible
  const { x0, y0, x1, y1 } = ctx.tileBox, snowy = G.weather && G.weather.cur === 'snow';
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const r = m.res[ty * m.W + tx]; if (!r || r.dead || !exploredAt(tx, ty)) continue;
    const X = tx + 0.5, Z = ty + 0.5, j = hash(tx, ty);
    if (r.kind === 'tree') {
      const key = r.art || 'tree_oak', d = artDef(key, 'nature'), nv = d.variants || 1, v = Math.floor(j * 97) % nv;
      const tints = d.tints; let tint = null; if (tints) { const tk = key + (Math.floor(j * 31) % tints.length); tint = V.tint.get(tk); if (!tint) { tint = col(tints[Math.floor(j * 31) % tints.length]); V.tint.set(tk, tint); } }
      const s = 0.88 + hash(ty, tx) * 0.26, shake = r.shake && G.time - r.shake < 0.15 ? (G.time - r.shake) * 0.4 : 0, snow = m.terr[ty * m.W + tx] === 4 || snowy ? 2 : 0;
      statSet(key, 'nature', v).add(X + (j - 0.5) * 0.25, heightAt(X, Z) - 0.02, Z + (hash(tx + 9, ty) - 0.5) * 0.25, j * 6.283, s, s * (0.92 + j * 0.16), s, tint, snow, 99, j, 0, shake ? [Math.sin(G.time * 60) * shake, 0] : null);
    } else if (r.kind === 'gold' || r.kind === 'stone' || r.kind === 'iron' || r.kind === 'gems') {
      const k = r.amt / (r.max || r.amt || 1);
      statSet('mine_' + r.kind, 'nature').add(X, heightAt(X, Z), Z, j * 6.283, 1, 1, 1, null, (k > 0.66 ? 2 : 0) | (k > 0.33 ? 4 : 0), 99, j);
    } else if (r.kind === 'berry') statSet('bush_berry', 'nature').add(X, heightAt(X, Z), Z, j * 6.283, 1, 1, 1, null, r.amt > 0 ? 2 : 0, 99, j);
    else if (r.kind === 'fish') statSet('fish_spot', 'nature').add(X, WATER_LEVEL + 0.01, Z, j * 6.283, 1, 1, 1, null, 0, 99, j);
  }
  // decoración
  if (V.decorRows && Q.decor) for (let ty = y0; ty <= y1; ty++) { const row = V.decorRows[ty]; if (!row) continue; for (const d of row) { if (d.tx < x0 || d.tx > x1 || !exploredAt(d.tx, d.ty)) continue; const X = d.tx + 0.5, Z = d.ty + 0.5, j = hash(d.tx, d.ty * 3), dd = artDef(d.key, 'nature'); statSet(d.key, 'nature', (d.v || 0) % (dd.variants || 1)).add(X + (j - 0.5) * 0.4, heightAt(X, Z), Z + (hash(d.ty, d.tx) - 0.5) * 0.4, j * 6.283, 1, 1, 1, null, 0, 99, j); } }
  // huellas: tocones, escombros, quemaduras
  for (const d of G.decals) {
    if (d.tx < x0 - 4 || d.tx > x1 || d.ty < y0 - 4 || d.ty > y1 || !exploredAt(d.tx, d.ty)) continue;
    if (d.key === 'stump') { const X = d.tx + 0.5, Z = d.ty + 0.5; statSet('stump', 'nature').add(X, heightAt(X, Z), Z, hash(d.tx, d.ty) * 6.283, 1, 1, 1, null); }
    else if (d.key === 'rubble') { const fp = Math.min(4, d.size || 2), X = d.tx + fp / 2, Z = d.ty + fp / 2, k = Math.min(1, (G.time - d.t) / 1.2); statSet('rubble_' + fp, 'nature').add(X, footprintHeight(d.tx, d.ty, fp) - 0.2 * (1 - k), Z, 0, 1, k, 1, null); }
    else if (d.key === 'scorch') { const X = d.tx + 0.5, Z = d.ty + 0.5; scorchSet().add(X, heightAt(X, Z), Z, hash(d.tx, d.ty) * 6.283, 1, 1, 1, null); }
  }
  // tesoros
  for (const t of G.treasures) if (!t.taken && exploredAt(t.tx, t.ty)) { const X = t.tx + 0.5, Z = t.ty + 0.5; statSet('treasure_' + t.type, 'nature').add(X, heightAt(X, Z), Z, hash(t.tx, t.ty) * 6.283 * 0.2 - 0.3, 1, 1, 1, null, t.open ? 4 : 2, 99, t.ph || 0); }
  // proyectiles con arco real
  for (const p of G.projs) {
    if (p.t < 0) continue;
    const [x, y] = lerpXY(p, alpha), k = Math.min(1, p.t / p.dur), arc = Math.sin(k * Math.PI) * p.arc;
    const gy = y + arc + (p.tgt && p.tgt.k === 'u' ? 6 * k : 0), X = x / T, Z = gy / T;
    const h0 = p.att && p.att.def && p.att.def.role === 'siege' ? 0.45 : 0.42, h1 = p.tgt && p.tgt.k === 'u' ? 0.32 : p.tgt && p.tgt.k === 'b' ? 0.6 : 0.05;
    const Y = heightAt(X, Z) + h0 * (1 - k) + h1 * k + arc / T * 1.1;
    let st = V.proj.get(p); if (!st) { st = { x: X, y: Y, z: Z, yaw: Math.atan2((p.tgt ? centerOfE(p.tgt).x : x) - p.sx, (p.tgt ? centerOfE(p.tgt).y : y) - p.sy), pitch: -0.3 }; V.proj.set(p, st); }
    const dx = X - st.x, dy = Y - st.y, dz = Z - st.z, hl = Math.hypot(dx, dz);
    if (hl > 1e-4) { st.yaw = Math.atan2(dx, dz); st.pitch = -Math.atan2(dy, hl); }
    st.x = X; st.y = Y; st.z = Z;
    statSet(p.art || 'proj_arrow', 'nature', 0, { shadow: false }).add(X, Y, Z, st.yaw, 1, 1, 1, null, 0, 99, 0, 0, [st.pitch, 0]);
  }
  // fantasma de colocación (modelo translúcido verde/rojo)
  if (ctx.placement) for (const g of ctx.placement) {
    const X = g.tx + g.fp / 2, Z = g.ty + g.fp / 2, y = footprintHeight(g.tx, g.ty, g.fp), c = col(g.ok ? '#5cff7a' : '#ff4a3a');
    if (g.key) statSet(g.key, 'bld', 0, { ghost: true, shadow: false, transparent: true, opacity: 0.5 }).add(X, y + 0.01, Z, 0, 1, 1, 1, c, g.key.endsWith('_gate') ? 2 : g.key.endsWith('_farm') ? 8 : 0);
    else tileGhost().add(X, y + 0.01, Z, 0, g.fp, 1, g.fp, c);
  }
  for (const s of V.used) s.end();
  // los conjuntos que no se usaron este frame quedan vacíos
  for (const s of V.stat.values()) if (!V.used.has(s) && s.mesh.count) { s.begin(); s.end(); }
  for (const s of V.rig.values()) if (!V.used.has(s) && s.mesh.count) { s.begin(); s.end(); }
  drawRings(alpha);
}
function tileGhost() {
  let s = V.stat.get('tileghost');
  if (!s) { const b = new Builder(); b.box(0.96, 0.05, 0.96, { y: 0.025, color: '#ffffff' }); s = new StaticSet(V.scene, b.geometry(), { cap: 64, shadow: false, transparent: true, opacity: 0.5, ghost: true }); V.stat.set('tileghost', s); }
  if (!V.used.has(s)) { V.used.add(s); s.begin(); }
  return s;
}
function scorchSet() {
  let s = V.stat.get('scorch');
  if (!s) { s = new StaticSet(V.scene, V.scorchGeo, { cap: 16, shadow: false }); V.stat.set('scorch', s); }
  if (!V.used.has(s)) { V.used.add(s); s.begin(); }
  return s;
}
function drawRings(alpha) {
  const R = VIEWS.ring, human = G.human; let n = 0;
  const put = (X, Y, Z, r, c) => { if (n >= 600) return; _p.set(X, Y, Z); _q.identity(); _s.set(r, 1, r); _m.compose(_p, _q, _s); R.setMatrixAt(n, _m); R.setColorAt(n, c); n++; };
  for (const e of G.sel) {
    if (e.dead || e.inside) continue;
    const c = col(isAlly(e.team, human) ? '#8fff7a' : (e.team !== undefined && e.team !== 7) ? '#ff6a5a' : '#ffd23a');
    if (e.k === 'u') { const [x, y] = lerpXY(e, alpha), X = x / T, Z = y / T, d = artDef(e.key, 'unit'), big = d.skeleton === 'rider' || d.skeleton === 'siege' ? 1.5 : 1; put(X, heightAt(X, Z) + 0.03, Z, (0.2 + e.def.size * 0.03) * big * (d.scale || 1), c); }
    else if (e.k === 'b') put(e.tx + e.fp / 2, footprintHeight(e.tx, e.ty, e.fp) + 0.04, e.ty + e.fp / 2, e.fp * 0.72, c);
    else if (e.k === 'r') put(e.tx + 0.5, heightAt(e.tx + 0.5, e.ty + 0.5) + 0.03, e.ty + 0.5, 0.55, c);
  }
  R.count = n; R.instanceMatrix.needsUpdate = true; if (R.instanceColor) R.instanceColor.needsUpdate = true;
}
function disposeEntities(scene) {
  for (const s of V.rig.values()) s.dispose(); for (const s of V.stat.values()) s.dispose();
  V.rig.clear(); V.stat.clear(); V.used.clear(); V.poses.clear();
  if (VIEWS.ring) { scene.remove(VIEWS.ring); VIEWS.ring.geometry.dispose(); VIEWS.ring.dispose(); VIEWS.ring = null; }
}
const lambert = (opts, key) => withFog(new THREE.MeshLambertMaterial(opts), { key });
export { V as ENT, VIEWS, lerpXY, buildEntities, updateEntities, disposeEntities, lambert, bldHeight, bldKey };
