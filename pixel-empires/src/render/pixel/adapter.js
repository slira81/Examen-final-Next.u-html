/* =====================================================================
   Adaptador del render pixel 2D al contrato de render/view.js.
   Mantiene exactamente las fórmulas anteriores (paridad verificada).
   ===================================================================== */
import { PE } from './sprite.js';
import { T } from '../../data/data.js';
import { G, clamp, isAlly, isAnimal, tileOf } from '../../sim/game.js';
import { exploredAt, visibleAt } from '../../world/world.js';
import { VIEW, prerenderTerrain, redrawTiles, render } from './render.js';

/** Lienzo nítido: cada píxel interno ocupa exactamente S píxeles del dispositivo. */
function zoomLimits(devW, devH) {
  let min = 1; while ((devW / min) * (devH / min) > 1.25e6) min++;        // límite de rendimiento
  const max = Math.max(min, Math.floor(Math.min(devH, devW * 1.4) / 150));
  return { min, max };
}
const cssToInternal = v => v * VIEW.dpr / VIEW.S;
const pixelRenderer = {
  kind: 'pixel',
  init(dom) { VIEW.cv = dom.canvas; VIEW.ctx = VIEW.cv.getContext('2d'); VIEW.cv.hidden = false; },
  resize() {
    if (!VIEW.cv) return;
    VIEW.dpr = Math.min(3, window.devicePixelRatio || 1);
    const devW = Math.round(innerWidth * VIEW.dpr), devH = Math.round(innerHeight * VIEW.dpr), lim = zoomLimits(devW, devH);
    VIEW.zmin = lim.min; VIEW.zmax = lim.max;
    if (!VIEW.zoomSet) { VIEW.S = Math.round(Math.min(devH / 420, devW / 420)); VIEW.zoomSet = true; }
    VIEW.S = clamp(VIEW.S, lim.min, lim.max);
    VIEW.w = Math.ceil(devW / VIEW.S); VIEW.h = Math.ceil(devH / VIEW.S); VIEW.ww = VIEW.w / VIEW.WS; VIEW.wh = VIEW.h / VIEW.WS;
    VIEW.cv.width = VIEW.w; VIEW.cv.height = VIEW.h;
    VIEW.cv.style.width = (VIEW.w * VIEW.S / VIEW.dpr) + 'px'; VIEW.cv.style.height = (VIEW.h * VIEW.S / VIEW.dpr) + 'px';
    VIEW.ctx.imageSmoothingEnabled = false;
  },
  onGameStart() { prerenderTerrain(); },
  frame(dt) { render(dt); },
  terrainChanged(tx, ty) { redrawTiles(tx, ty); },
  screenToWorld(cx, cy) { return { x: cssToInternal(cx) / VIEW.WS + VIEW.cx, y: cssToInternal(cy) / VIEW.WS + VIEW.cy }; },
  worldPerCss() { return VIEW.dpr / VIEW.S / VIEW.WS; },
  viewWorldSize() { return { w: VIEW.w / VIEW.WS, h: VIEW.h / VIEW.WS }; },
  zoomState() { return { canIn: VIEW.S < VIEW.zmax, canOut: VIEW.S > VIEW.zmin }; },
  /** Zoom entero (píxeles nítidos) conservando el punto bajo (cx, cy). Devuelve true si cambió. */
  zoomTo(s, cx, cy) {
    s = clamp(s, VIEW.zmin, VIEW.zmax); if (s === VIEW.S || !G) { VIEW.S = s; return false; }
    const before = this.screenToWorld(cx, cy); VIEW.S = s; this.resize(); const after = this.screenToWorld(cx, cy);
    G.cam.x += before.x - after.x; G.cam.y += before.y - after.y; return true;
  },
  zoomStep(dir, cx, cy) { return this.zoomTo(VIEW.S + dir, cx, cy); },
  pinchBegin() { this._s0 = VIEW.S; },
  pinchUpdate(ratio, cx, cy) { const want = clamp(Math.round(this._s0 * ratio), VIEW.zmin, VIEW.zmax); return want !== VIEW.S ? this.zoomTo(want, cx, cy) : false; },
  /** Entidad bajo el punto de mundo w (unidades primero, luego edificios, recursos y tesoros). */
  pick(w, css, touch) {
    let best = null, bd = 1e9;
    for (const u of G.units) {
      if (u.dead || u.inside || (!isAlly(u.team, G.human) && !visibleAt(u.x, u.y))) continue;
      const def = PE.ART.units[u.key], hh = (def ? Math.min(def.ay, 34) : 14) / VIEW.WS, pad = touch ? 5 : 1;
      const dx = Math.abs(w.x - u.x), dy = w.y - (u.y - hh / 2);
      if (dx < u.def.size * 0.6 + 3 + pad && Math.abs(dy) < hh / 2 + 1 + pad) { const d = dx + Math.abs(dy) * 0.5 - (u.team === G.human ? 3 : 0); if (d < bd) { bd = d; best = u; } }
    }
    if (best) return best;
    for (const b of G.blds) {
      if (b.dead || !exploredAt(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1))) continue;
      const img = PE.ART.buildings[b.key], h = img ? (typeof img.h === 'number' ? img.h : b.fp * T) : b.fp * T, extra = b.def.flat ? 0 : Math.max(0, h - b.fp * T) * 0.7;
      if (w.x >= b.tx * T && w.x < (b.tx + b.fp) * T && w.y >= b.ty * T - extra && w.y < (b.ty + b.fp) * T) return b;
    }
    for (const t of G.treasures) if (!t.taken && Math.abs(w.x - (t.tx * T + 8)) < 10 && Math.abs(w.y - (t.ty * T + 8)) < 10 && exploredAt(t.tx, t.ty)) return t;
    for (const r of G.resBy.carcass || []) if (!r.dead && Math.abs(w.x - r.x) < 10 && Math.abs(w.y - r.y) < 8) return r;
    const tx = tileOf(w.x), ty = tileOf(w.y);
    for (const [ox, oy] of [[0, 0], [0, 1], [0, -1]]) { const x = tx + ox, y = ty + oy; if (x < 0 || y < 0 || x >= G.map.W || y >= G.map.H) continue; const r = G.map.res[y * G.map.W + x]; if (r && !r.dead && exploredAt(x, y) && (oy === 0 || r.kind === 'tree')) { if (oy === 1 && w.y < (y * T) - 18) continue; return r; } }
    return null;
  },
  /** Unidades propias dentro de la caja de pantalla d (px CSS). */
  unitsInScreenRect(d) {
    const a = this.screenToWorld(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1)), b = this.screenToWorld(Math.max(d.x0, d.x1), Math.max(d.y0, d.y1));
    const inBox = u => !u.dead && !u.inside && u.team === G.human && u.x >= a.x - 3 && u.x <= b.x + 3 && u.y >= a.y && u.y <= b.y + 8;
    let s = G.units.filter(u => inBox(u) && !isAnimal(u));
    if (!s.length) s = G.units.filter(u => inBox(u));
    return s;
  },
  isOnScreen(u) { return u.x > VIEW.cx && u.x < VIEW.cx + VIEW.ww && u.y > VIEW.cy && u.y < VIEW.cy + VIEW.wh; },
  drawMinimapView(x) { x.strokeRect((G.cam.x - VIEW.ww / 2) / T + 0.5, (G.cam.y - VIEW.wh / 2) / T + 0.5, VIEW.ww / T, VIEW.wh / T); },
};
export { pixelRenderer };
