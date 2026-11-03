/* =====================================================================
   Opciones gráficas (solo render 3D): calidad baja/media/alta, sombras,
   partículas y escala de resolución. Se guardan en el navegador.
   ===================================================================== */
import { RV } from '../render/view.js';
import { $, openModal, closeModal } from './ui.js';

const KEY = 'pe_gfx_v1';
const GFX = { preset: null, shadows: null, particles: null, scale: null };
function loadGfx() {
  try { Object.assign(GFX, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { /* sin almacenamiento */ }
  if (!GFX.preset) GFX.preset = matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
  return GFX;
}
function saveGfx() { try { localStorage.setItem(KEY, JSON.stringify(GFX)); } catch (_) { /* sin almacenamiento */ } }
/** Aplica los ajustes guardados al render activo (si admite calidad). */
function applyGfx() {
  if (!RV.impl || !RV.impl.setQuality) return;
  RV.impl.setQuality({ preset: GFX.preset, shadows: GFX.shadows ?? undefined, particles: GFX.particles ?? undefined, scale: GFX.scale ?? undefined });
}
const PART = [[0.35, 'Pocas'], [0.7, 'Normales'], [1, 'Muchas']];
function openGraphics(back) {
  const Q = RV.impl.quality;
  const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, n]) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
  openModal(`<h2>Gráficos</h2><div class="gfx">
    <label for="g-preset">Calidad</label>${sel('g-preset', [['low', 'Baja (móviles)'], ['medium', 'Media'], ['high', 'Alta']], GFX.preset)}
    <label for="g-shadows">Sombras</label>${sel('g-shadows', [['1', 'Sí'], ['0', 'No']], Q.shadows ? '1' : '0')}
    <label for="g-part">Partículas</label>${sel('g-part', PART, PART.reduce((b, p) => Math.abs(p[0] - Q.particles) < Math.abs(b[0] - Q.particles) ? p : b)[0])}
    <label for="g-scale">Resolución</label><div class="gscale"><input id="g-scale" type="range" min="50" max="100" step="5" value="${Math.round(Q.scale * 100)}"><span id="g-scale-v">${Math.round(Q.scale * 100)}%</span></div>
  </div><p class="lead gnote">La calidad baja desactiva las sombras y la decoración menuda y reduce la resolución: es la recomendada en el móvil.</p>
  <div class="mrow"><button id="g-ok">Listo</button></div>`);
  const upd = () => { applyGfx(); saveGfx(); };
  $('g-preset').onchange = e => { GFX.preset = e.target.value; GFX.shadows = GFX.particles = GFX.scale = null; applyGfx(); saveGfx(); const q = RV.impl.quality; $('g-shadows').value = q.shadows ? '1' : '0'; $('g-part').value = String(PART.reduce((b, p) => Math.abs(p[0] - q.particles) < Math.abs(b[0] - q.particles) ? p : b)[0]); $('g-scale').value = Math.round(q.scale * 100); $('g-scale-v').textContent = Math.round(q.scale * 100) + '%'; };
  $('g-shadows').onchange = e => { GFX.shadows = e.target.value === '1'; upd(); };
  $('g-part').onchange = e => { GFX.particles = +e.target.value; upd(); };
  $('g-scale').oninput = e => { $('g-scale-v').textContent = e.target.value + '%'; };
  $('g-scale').onchange = e => { GFX.scale = +e.target.value / 100; upd(); };
  $('g-ok').onclick = () => { if (back) back(); else closeModal(); };
}
export { GFX, loadGfx, saveGfx, applyGfx, openGraphics };
