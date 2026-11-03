/* =====================================================================
   Capa 2D sobre el 3D: barras de vida, insignias de nivel, textos
   flotantes, caja de selección, marcas de órdenes y clima en pantalla.
   Trabaja en píxeles CSS con el devicePixelRatio aplicado al lienzo.
   ===================================================================== */
import { T, LEVEL_MAX } from '../../data/data.js';
import { G, isAlly, isAnimal } from '../../sim/game.js';
import { visibleAt, exploredAt } from '../../world/world.js';
import { PE } from '../pixel/sprite.js';
import { UI } from '../../ui/ui.js';
import { lerpXY, bldHeight } from './entities.js';
import { heightAt, footprintHeight } from './terrain.js';

const OV = { cv: null, ctx: null, dpr: 1, w: 0, h: 0, drops: [], flakes: [] };
function initOverlay(cv) { OV.cv = cv; OV.ctx = cv.getContext('2d'); }
function resizeOverlay(dpr) {
  OV.dpr = dpr; OV.w = innerWidth; OV.h = innerHeight;
  OV.cv.width = Math.round(innerWidth * dpr); OV.cv.height = Math.round(innerHeight * dpr);
  OV.cv.style.width = innerWidth + 'px'; OV.cv.style.height = innerHeight + 'px';
}
function bar(c, x, y, w, f, colr) {
  c.fillStyle = 'rgba(20,12,24,.85)'; c.fillRect(x - 1, y - 1, w + 2, 5);
  c.fillStyle = colr || (f > 0.5 ? '#5fd35a' : f > 0.25 ? '#e8c43a' : '#e4483a'); c.fillRect(x, y, Math.max(1, Math.round(w * f)), 3);
}
/** Dibuja la capa. project(X, Y, Z) -> {x, y, z} en px CSS (z > 1 = fuera de cámara). */
function drawOverlay(dt, alpha, project, zoomPx) {
  const c = OV.ctx; c.setTransform(OV.dpr, 0, 0, OV.dpr, 0, 0); c.clearRect(0, 0, OV.w, OV.h);
  c.imageSmoothingEnabled = false;
  const human = G.human, sz = Math.max(0.6, Math.min(1.6, zoomPx / 40));
  // unidades: vida e insignias
  for (const u of G.units) {
    if (u.dead || u.inside) continue;
    const show = G.sel.includes(u) || u.hp < u.maxhp || u.lvl >= 2; if (!show) continue;
    if (!isAlly(u.team, human) && !visibleAt(u.x, u.y)) continue;
    const [x, y] = lerpXY(u, alpha), X = x / T, Z = y / T, hgt = (u.def.race === 'giant' ? 1.3 : 0.72) * (u.def.role === 'cav' ? 1.2 : 1);
    const p = project(X, heightAt(X, Z) + hgt, Z); if (p.z > 1 || p.x < -40 || p.y < -40 || p.x > OV.w + 40 || p.y > OV.h + 40) continue;
    const w = Math.round(22 * sz), bx = Math.round(p.x - w / 2), by = Math.round(p.y - 8);
    if ((G.sel.includes(u) || u.hp < u.maxhp) && (!isAnimal(u) || u.hp < u.maxhp)) bar(c, bx, by, w, u.hp / u.maxhp);
    if (u.lvl >= 2) { const bi = PE.frame('icons', 'badge_' + u.lvl, 0), s = Math.max(1, Math.round(2 * sz)); c.drawImage(bi, Math.round(p.x - bi.width * s / 2), by - 4 - bi.height * s, bi.width * s, bi.height * s); }
  }
  // edificios: vida y construcción
  for (const b of G.blds) {
    if (b.dead || b.def.invuln || b.team === 7) continue;
    const sel = G.sel.includes(b); if (!sel && b.hp >= b.maxhp && b.done) continue; if (b.def.flat && !sel) continue;
    if (!exploredAt(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1))) continue;
    const p = project(b.tx + b.fp / 2, footprintHeight(b.tx, b.ty, b.fp) + (b.def.flat ? 0.3 : bldHeight(b) * (b.done ? 1 : Math.max(0.3, b.progress)) + 0.25), b.ty + b.fp / 2); if (p.z > 1) continue;
    const w = Math.round(b.fp * 22 * sz); bar(c, Math.round(p.x - w / 2), Math.round(p.y), w, b.done ? b.hp / b.maxhp : b.progress, b.done ? null : '#8ab4ff');
  }
  // textos flotantes
  c.textAlign = 'center'; c.font = `600 ${Math.round(13 * Math.max(0.85, sz))}px "Jersey 10", monospace`;
  for (const t of G.texts) {
    if (!visibleAt(t.x, t.y)) continue; const X = t.x / T, Z = t.y / T, p = project(X, heightAt(X, Z) + 1.1, Z); if (p.z > 1) continue;
    c.globalAlpha = Math.min(1, (t.life - t.t) * 2); c.fillStyle = '#140f1f'; c.fillText(t.text, p.x + 1, p.y + 1); c.fillStyle = t.color; c.fillText(t.text, p.x, p.y); c.globalAlpha = 1;
  }
  c.textAlign = 'left';
  // marcas de órdenes
  for (const m of UI.marks) { const X = m.x / T, Z = m.y / T, p = project(X, heightAt(X, Z), Z), k = m.t / 0.5, r = (6 + k * 14) * sz; c.strokeStyle = m.c; c.globalAlpha = 1 - k; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.5, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
  // caja de selección
  if (UI.drag && UI.drag.box) { const d = UI.drag; c.strokeStyle = '#8fff7a'; c.lineWidth = 1.5; c.fillStyle = 'rgba(143,255,122,.08)'; const x0 = Math.min(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0); c.fillRect(x0, y0, w, h); c.strokeRect(x0 + 0.5, y0 + 0.5, w, h); }
  drawWeatherOverlay(c, dt);
}
function drawWeatherOverlay(c, dt) {
  // la lluvia, la nieve y la neblina son 3D (effects.js); aquí solo el tono de tormenta y el destello
  const w = G.weather, a = w.a, W = OV.w, H = OV.h;
  if (w.cur === 'storm') { c.fillStyle = 'rgba(20,16,50,' + (0.12 * a) + ')'; c.fillRect(0, 0, W, H); }
  if (w.flash > 0) { c.fillStyle = 'rgba(235,240,255,' + Math.min(0.3, w.flash * 0.3) + ')'; c.fillRect(0, 0, W, H); }
}
export { OV, initOverlay, resizeOverlay, drawOverlay };
