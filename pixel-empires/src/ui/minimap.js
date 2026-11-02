/* =====================================================================
   Minimapa: terreno, recursos, edificios, unidades, niebla y la zona
   que ve la cámara (la dibuja el render activo).
   ===================================================================== */
import { PE } from '../render/pixel/sprite.js';
import { T } from '../data/data.js';
import { TR_COLOR } from '../map/map.js';
import { G, isAlly, isAnimal, tileOf } from '../sim/game.js';
import { exploredAt, visibleAt } from '../world/world.js';
import { RV, teamColorIdx } from '../render/view.js';
import { UI } from './ui.js';

const MINI = { base: null };
function buildMiniBase() {
  const m = G.map, W = m.W, H = m.H; MINI.base = new ImageData(W, H);
  for (let i = 0; i < W * H; i++) { const c = PE.hx(TR_COLOR[m.terr[i]]); MINI.base.data.set([c[0], c[1], c[2], 255], i * 4); }
}
function miniTileChanged(tx, ty) { const i = ty * G.map.W + tx; MINI.base.data.set(PE.hx(TR_COLOR[G.map.terr[i]]).slice(0, 3), i * 4); }
function drawMinimap() {
  const mc = UI.mini, x = mc.getContext('2d'), m = G.map, W = m.W, H = m.H;
  if (mc.width !== W) { mc.width = W; mc.height = H; }
  const img = new ImageData(new Uint8ClampedArray(MINI.base.data), W, H), d = img.data;
  const put = (i, c) => { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; };
  const RC = { tree: [38, 92, 44], gold: [255, 210, 58], gems: [190, 110, 255], stone: [200, 200, 200], iron: [160, 110, 90], berry: [220, 80, 120], fish: [140, 200, 255] };
  for (const r of G.map.resList) if (!r.dead && RC[r.kind]) put(r.ty * W + r.tx, RC[r.kind]);
  for (const b of G.blds) { if (b.dead) continue; const col = PE.hx(PE.TEAM_COLORS[teamColorIdx(b.team)].hex); for (let y = b.ty; y < b.ty + b.fp; y++) for (let xx = b.tx; xx < b.tx + b.fp; xx++) if (exploredAt(xx, y)) put(y * W + xx, col); }
  for (const u of G.units) { if (u.dead || u.inside || (isAnimal(u) && u.team >= 7)) continue; if (!isAlly(u.team, G.human) && !visibleAt(u.x, u.y)) continue; const col = PE.hx(PE.TEAM_COLORS[teamColorIdx(u.team)].hex); put(tileOf(u.y) * W + tileOf(u.x), col.map(v => Math.min(255, v + 40))); }
  if (G.human >= 0 && !G.cfg.revealed) for (let i = 0; i < W * H; i++) { const v = G.vis[i]; if (v === 0) { d[i * 4] = 10; d[i * 4 + 1] = 8; d[i * 4 + 2] = 16; } else if (v === 1) { d[i * 4] *= 0.55; d[i * 4 + 1] *= 0.55; d[i * 4 + 2] *= 0.6; } }
  x.putImageData(img, 0, 0);
  x.strokeStyle = '#fff'; x.lineWidth = 1; RV.impl.drawMinimapView(x);
  for (const p of G.pings) { p.t += 0.25; const r = 2 + (p.t % 1) * 5; x.strokeStyle = '#ff5a4a'; x.beginPath(); x.arc(p.x / T, p.y / T, r, 0, 7); x.stroke(); }
  G.pings = G.pings.filter(p => p.t < 4);
}
export { MINI, buildMiniBase, miniTileChanged, drawMinimap };
