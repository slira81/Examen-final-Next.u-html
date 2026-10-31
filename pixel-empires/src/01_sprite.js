/* =====================================================================
   Pixel Empires — núcleo de sprites (pixel art generado por código)
   ---------------------------------------------------------------------
   Técnica (Lospec / GameDev.net / PixelJoint):
   * Cada material tiene una rampa de 4 tonos con cambio de matiz: las
     sombras se enfrían (violeta) y las luces se calientan (amarillo).
   * Luz desde arriba a la izquierda + volumen cilíndrico en tramos anchos.
   * Contorno selectivo de 1 px con el tono oscuro del material vecino,
     más suave en el lado iluminado. Nunca negro puro.
   * Material 'team' = color del jugador, así cada diseño sirve a todos.
   API:  new SCanvas(w,h) -> px/rect/ell/ring/poly/line/rim/at/glow
         PE.render(canvas, opts) -> HTMLCanvasElement
         PE.ART.{units,buildings,nature,fx,icons}[key] = definición
         PE.frame(kind,key,f,opts) -> canvas en caché
   ===================================================================== */
'use strict';
var PE = (typeof window !== 'undefined' ? window : globalThis).PE = ((typeof window !== 'undefined' ? window : globalThis).PE || {});

// ------------------------------------------------------------- color
PE.hx = function (c) {
  c = c.replace('#', '');
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16), c.length >= 8 ? parseInt(c.slice(6, 8), 16) : 255];
};
PE.toHex = rgb => '#' + rgb.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
  return [h, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  return [m[0] * 255, m[1] * 255, m[2] * 255];
}
PE.shift = function (rgb, dh, ds, dv) {
  let [h, s, v] = rgb2hsv(rgb[0], rgb[1], rgb[2]);
  h = ((h + dh / 360) % 1 + 1) % 1; s = Math.max(0, Math.min(1, s + ds)); v = Math.max(0, Math.min(1, v + dv));
  return hsv2rgb(h, s, v);
};
const _rampCache = {};
/** 4 tonos [sombra, base, luz, brillo] con cambio de matiz. */
PE.ramp = function (hex) {
  if (_rampCache[hex]) return _rampCache[hex];
  const b = PE.hx(hex);
  return (_rampCache[hex] = [PE.shift(b, -14, 0.10, -0.26), b.slice(0, 3), PE.shift(b, 8, -0.06, 0.14), PE.shift(b, 16, -0.20, 0.27)]);
};
PE.outlineOf = (hex, soft) => PE.shift(PE.hx(hex), -22, 0.05, soft ? -0.36 : -0.48);

// ------------------------------------------------------------- materiales
PE.MATS = {
  skin: '#e9b38a', hair: '#6b4128', steel: '#8f9db3', blade: '#c9d4e3', gold: '#e2b237',
  leather: '#8a5a36', wood: '#9a6b3c', cloth: '#d9c59b', pants: '#6e5236', straw: '#e3bb4c',
  robe: '#3f58cc', hat: '#4a3fa8', beard: '#e6e8ee', hood: '#3f7d3a', cloak: '#2f5e34',
  tunic: '#6d9a45', sack: '#b08a58', orb: '#46e3e6', feather: '#e8e4d6',
  stone: '#9b968c', brick: '#a8563e', plaster: '#d9c9a0', roof: '#a04a32', thatch: '#c79a4a',
  darkwood: '#5c3d24', iron: '#5f6673', copper: '#c07a3a', bone: '#e3dcc0', fur: '#7a5a3a',
  leaf: '#4f9a4a', moss: '#5f8a3a', water: '#3d7fd0', snow: '#eef3f8', ice: '#a8d8f0',
  elfskin: '#f3d6bc', elfhair: '#ecdca2', silver: '#c9d4e3', orcskin: '#6f9a3a', orcskin2: '#8a8a52',
  giantskin: '#a38f80', frostskin: '#8fb6d6', rune: '#5ff0e0', fire: '#ff8a2a', red: '#c0392b',
  purple: '#7a3fb0', grass: '#4c9a3c', dirt: '#8a6a44', sand: '#d9c08a', rock: '#7d7a78',
};
PE.FIXED = {
  eye: '#1d1530', ol: '#1d1530', string: '#e8e0c8', white: '#f4f1ea', mouth: '#a85a4a', black: '#140f1f',
  glowY: '#ffe98a', glowC: '#9ff8f2', glowG: '#b8ff8a', glowR: '#ff6a4a', window: '#ffd27a', shadow: '#14102a55',
};
PE.EMISSIVE = new Set(['orb', 'rune', 'fire']);
PE.addMats = o => Object.assign(PE.MATS, o);
PE.addFixed = o => Object.assign(PE.FIXED, o);
PE.addEmissive = (...names) => names.forEach(n => PE.EMISSIVE.add(n));

// Colores de jugador (el índice es el "team" de render)
PE.TEAM_COLORS = [
  { name: 'Azul', hex: '#3a6fe0' }, { name: 'Rojo', hex: '#d8403a' }, { name: 'Amarillo', hex: '#e3c23a' },
  { name: 'Morado', hex: '#9a4fd8' }, { name: 'Naranja', hex: '#e8862e' }, { name: 'Cian', hex: '#2fb8c8' },
  { name: 'Gris', hex: '#8a8f99' },
];

// ------------------------------------------------------------- lienzo
class SCanvas {
  constructor(w, h) { this.w = w; this.h = h; this.g = new Array(w * h).fill(null); this.ox = 0; this.oy = 0; this.glows = []; }
  /** Pinta un píxel con un material ('steel', 'steel.0' fuerza tono 0..3, null borra). */
  px(m, x, y) {
    x = Math.round(x + this.ox); y = Math.round(y + this.oy);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y * this.w + x] = m;
  }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.g[y * this.w + x] : null; }
  rect(m, x0, y0, x1, y1) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0];
    for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) this.px(m, x, y);
  }
  ell(m, cx, cy, rx, ry) { this.ring(m, cx, cy, rx, ry, -1); }
  /** Anillo elíptico: píxeles con distancia normalizada en (inner, 1]. */
  ring(m, cx, cy, rx, ry, inner, filter) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2;
        if (d <= 1 && d > inner && (!filter || filter(x, y))) this.px(m, x, y);
      }
  }
  poly(m, pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const n = pts.length;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + .5, py = y + .5; let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.px(m, x, y);
    }
  }
  line(m, x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) {
      this.px(m, x0, y0); if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  /** Dibuja una forma con contorno interior oscuro de 1 px (armas sobre el cuerpo). fn(t, m). */
  rim(fn, m) {
    const t = new SCanvas(this.w, this.h); fn(t, 'x');
    const W = this.w, H = this.h;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (t.g[y * W + x]) continue;
      if ((x > 0 && t.g[y * W + x - 1]) || (x < W - 1 && t.g[y * W + x + 1]) || (y > 0 && t.g[(y - 1) * W + x]) || (y < H - 1 && t.g[(y + 1) * W + x])) this.px('ol', x, y);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.g[y * W + x]) this.px(m, x, y);
  }
  /** Desplaza todo lo dibujado dentro de fn (partes móviles de la animación). */
  at(dx, dy, fn) { this.ox += dx; this.oy += dy; try { fn(); } finally { this.ox -= dx; this.oy -= dy; } }
  /** Halo semitransparente que sólo se pinta sobre fondo vacío. */
  glow(x, y, a, hex) { this.glows.push([Math.round(x + this.ox), Math.round(y + this.oy), a, hex || '#6ef0f5']); }
  /** Dither de tablero de ajedrez sobre un rectángulo (sólo píxeles ya pintados con 'onlyOn' si se indica). */
  dither(m, x0, y0, x1, y1, parity = 0, onlyOn) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (((x + y) & 1) === parity && (!onlyOn || this.get(x + this.ox, y + this.oy) === onlyOn)) this.px(m, x, y);
  }
}
PE.SCanvas = SCanvas;

/**
 * Lienzo a resolución k veces mayor con la MISMA API en coordenadas lógicas.
 * Las formas (elipses, polígonos, líneas) se evalúan a nivel de subpíxel, así el
 * entorno se dibuja más grande con curvas suaves y contorno fino, con el mismo
 * tamaño de píxel que los personajes, sin redibujar el arte.
 */
class SCanvasScaled extends SCanvas {
  constructor(w, h, k) { super(w, h); this.k = k; this.pw = w * k; this.ph = h * k; this.g = new Array(this.pw * this.ph).fill(null); }
  _set(m, X, Y) { if (X >= 0 && Y >= 0 && X < this.pw && Y < this.ph) this.g[Y * this.pw + X] = m; }
  px(m, x, y) {
    const k = this.k, X = Math.round(x + this.ox) * k, Y = Math.round(y + this.oy) * k;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) this._set(m, X + i, Y + j);
  }
  get(x, y) { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.g[(y * this.k) * this.pw + x * this.k] : null; }
  rect(m, x0, y0, x1, y1) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0];
    const k = this.k, X0 = (Math.round(x0) + this.ox) * k, Y0 = (Math.round(y0) + this.oy) * k, X1 = (Math.round(x1) + this.ox + 1) * k - 1, Y1 = (Math.round(y1) + this.oy + 1) * k - 1;
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) this._set(m, X, Y);
  }
  ring(m, cx, cy, rx, ry, inner, filter) {
    const k = this.k, ox = this.ox, oy = this.oy;
    for (let Y = Math.floor((cy - ry - 1) * k); Y <= Math.ceil((cy + ry + 1) * k); Y++)
      for (let X = Math.floor((cx - rx - 1) * k); X <= Math.ceil((cx + rx + 1) * k); X++) {
        const lx = (X + .5) / k, ly = (Y + .5) / k, d = ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2;
        if (d <= 1 && d > inner && (!filter || filter(Math.floor(lx), Math.floor(ly)))) this._set(m, X + ox * k, Y + oy * k);
      }
  }
  poly(m, pts) {
    const k = this.k; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const n = pts.length;
    for (let Y = Math.floor(y0 * k); Y <= Math.ceil(y1 * k); Y++) for (let X = Math.floor(x0 * k); X <= Math.ceil(x1 * k); X++) {
      const px = (X + .5) / k, py = (Y + .5) / k; let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this._set(m, X + this.ox * k, Y + this.oy * k);
    }
  }
  line(m, x0, y0, x1, y1) {
    // línea suave a alta resolución con pincel de k×k
    const k = this.k, ax = (Math.round(x0) + this.ox) * k, ay = (Math.round(y0) + this.oy) * k, bx = (Math.round(x1) + this.ox) * k, by = (Math.round(y1) + this.oy) * k;
    let x = ax, y = ay; const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1; let e = dx + dy;
    for (;;) {
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) this._set(m, x + i, y + j);
      if (x === bx && y === by) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x += sx; } if (e2 <= dx) { e += dx; y += sy; }
    }
  }
  rim(fn, m) {
    const t = new SCanvasScaled(this.w, this.h, this.k); fn(t, 'x');
    const W = this.pw, H = this.ph, ox = this.ox * this.k, oy = this.oy * this.k;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (t.g[y * W + x]) continue;
      if ((x > 0 && t.g[y * W + x - 1]) || (x < W - 1 && t.g[y * W + x + 1]) || (y > 0 && t.g[(y - 1) * W + x]) || (y < H - 1 && t.g[(y + 1) * W + x])) this._set('ol', x + ox, y + oy);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.g[y * W + x]) this._set(m, x + ox, y + oy);
  }
  glow(x, y, a, hex) { const k = this.k, X = Math.round(x + this.ox) * k, Y = Math.round(y + this.oy) * k; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) this.glows.push([X + i, Y + j, a, hex || '#6ef0f5']); }
}
PE.SCanvasScaled = SCanvasScaled;
/** Escala del entorno (edificios y naturaleza) respecto a los personajes. */
PE.ENV = { scale: 2 };
PE.envScale = (kind, key) => (kind === 'buildings' || (kind === 'nature' && !key.startsWith('treasure_'))) ? PE.ENV.scale : 1;

// ------------------------------------------------------------- render
const baseOf = m => { const i = m.indexOf('.'); return i < 0 ? m : m.slice(0, i); };
const forcedOf = m => { const i = m.indexOf('.'); return i < 0 ? -1 : +m.slice(i + 1); };
PE.makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/**
 * Convierte un SCanvas de materiales en una imagen.
 * opts: team (hex), shadow (true | {cx,cy,rx,ry,a}), shade (true), outline (true)
 */
PE.render = function (cv, opts = {}) {
  const W = cv.pw || cv.w, H = cv.ph || cv.h, g = cv.g;
  const team = opts.team || PE.TEAM_COLORS[0].hex;
  const shade = opts.shade !== false, outline = opts.outline !== false;
  const out = PE.makeCanvas(W, H), ctx = out.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const matHex = b => b === 'team' ? team : (PE.MATS[b] || '#ff00ff');
  const set = (x, y, rgb, a = 255) => { const i = (y * W + x) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = a; };
  const blend = (x, y, rgb, a) => {
    const i = (y * W + x) * 4, A = a / 255, B = d[i + 3] / 255, o = A + B * (1 - A);
    if (o <= 0) return;
    for (let k = 0; k < 3; k++) d[i + k] = (rgb[k] * A + d[i + k] * B * (1 - A)) / o;
    d[i + 3] = o * 255;
  };
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? g[y * W + x] : null);
  const bat = (x, y) => { const m = at(x, y); return m === null ? null : baseOf(m); };
  // sombra de suelo
  if (opts.shadow) {
    const s = opts.shadow === true ? {} : opts.shadow;
    const cx = s.cx ?? W / 2, cy = s.cy ?? H - 2, rx = s.rx ?? W * 0.26, ry = s.ry ?? 1.6, a = s.a ?? 70;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const q = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2;
      if (q <= 1) set(x, y, [20, 12, 40], q < 0.45 ? a : a * 0.65);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = g[y * W + x]; if (m === null) continue;
    const b = baseOf(m);
    if (PE.FIXED[b]) { const c = PE.hx(PE.FIXED[b]); if (c[3] < 255) blend(x, y, c, c[3]); else set(x, y, c); continue; }
    const r = PE.ramp(matHex(b));
    let lvl = forcedOf(m);
    if (lvl < 0) {
      lvl = 1;
      if (shade) {
        const up = bat(x, y - 1) !== b, lf = bat(x - 1, y) !== b, dn = bat(x, y + 1) !== b, rt = bat(x + 1, y) !== b;
        if ((up || lf) && !(dn || rt)) lvl = 2;
        if (up && lf) lvl = 3;
        if ((dn || rt) && !(up || lf)) lvl = 0;
        if (lvl === 1) { // volumen cilíndrico en tramos horizontales anchos
          let x0 = x, x1 = x;
          while (bat(x0 - 1, y) === b) x0--;
          while (bat(x1 + 1, y) === b) x1++;
          const n = x1 - x0 + 1;
          if (n >= 6) {
            if (x - x0 < Math.max(1, n / 5 | 0)) lvl = 2;
            else if (x1 - x <= Math.max(1, n / 4 | 0) - 1 + (n >= 9 ? 1 : 0)) lvl = 0;
          }
        }
      }
      if (PE.EMISSIVE.has(b)) lvl = Math.max(2, lvl);
    }
    set(x, y, r[Math.max(0, Math.min(3, lvl))]);
  }
  // contorno selectivo exterior
  if (outline) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y * W + x] !== null) continue;
    let best = null, skip = false;
    for (const [dx, dy, soft] of [[0, 1, true], [1, 0, true], [0, -1, false], [-1, 0, false]]) {
      const nm = at(x + dx, y + dy);
      if (nm === null) continue;
      const nb = baseOf(nm);
      if (nb === 'ol') { skip = true; break; }
      if (!best) best = [nb, soft];
    }
    if (skip || !best) continue;
    const [nb, soft] = best;
    if (PE.FIXED[nb] && PE.hx(PE.FIXED[nb])[3] < 255) continue;
    set(x, y, PE.FIXED[nb] ? PE.hx(PE.FIXED.ol) : PE.outlineOf(matHex(nb), soft));
  }
  for (const [x, y, a, hex] of cv.glows) {
    if (x < 0 || y < 0 || x >= W || y >= H || g[y * W + x] !== null) continue;
    blend(x, y, PE.hx(hex), a);
  }
  ctx.putImageData(img, 0, 0);
  return out;
};

// ------------------------------------------------------------- poses
// body: 0 arriba / 1 abajo.  ll, lr: elevación de pies (negativo = arriba).
// s: balanceo de brazos (-1..1).  sw: vaivén de telas.  sec: inercia secundaria.
// glow: pulso 0..2.  atk: fase de ataque 0 reposo, 1 preparación, 2 golpe, 3 seguimiento.
PE.Pose = o => Object.assign({ body: 0, ll: 0, lr: 0, s: 0, sw: 0, sec: 0, glow: 0, atk: 0, t: 0, anim: 'idle' }, o);
function seq(anim, cols) {
  const n = cols.body.length, out = [];
  for (let i = 0; i < n; i++) {
    const o = { anim, t: i };
    for (const k in cols) o[k] = cols[k][i];
    o.sec = cols.body[(i - 1 + n) % n] - cols.body[i];
    out.push(PE.Pose(o));
  }
  return out;
}
PE.ANIMS = {
  idle: seq('idle', { body: [0, 0, 1, 1], glow: [0, 1, 2, 1] }),
  walk: seq('walk', {
    body: [1, 1, 0, 0, 1, 1, 0, 0], ll: [0, 0, 0, 0, -1, -1, -2, -1], lr: [-1, -1, -2, -1, 0, 0, 0, 0],
    s: [1, 1, 0, 0, -1, -1, 0, 0], sw: [0, -1, -1, 0, 0, 1, 1, 0], glow: [1, 2, 1, 0, 1, 2, 1, 0],
  }),
  attack: seq('attack', { body: [0, 1, 1, 0], atk: [1, 2, 3, 0], glow: [1, 2, 2, 0], sw: [0, 1, 1, 0] }),
};
PE.ANIMS.work = PE.ANIMS.attack;

// ------------------------------------------------------------- registro y caché
PE.ART = { units: {}, buildings: {}, nature: {}, fx: {}, icons: {} };
PE.MISSING = new Set();
const _cache = new Map();
function placeholder(w, h) {
  const c = PE.makeCanvas(w, h), x = c.getContext('2d');
  for (let y = 0; y < h; y += 4) for (let i = 0; i < w; i += 4) { x.fillStyle = ((i + y) / 4) % 2 ? '#ff00ff' : '#200020'; x.fillRect(i, y, 4, 4); }
  return c;
}
/**
 * Devuelve (y guarda en caché) un frame renderizado.
 *  kind 'units':  opts {team (índice o hex), anim:'idle'|'walk'|'attack'|'work', ...extra}  f = índice dentro de la animación
 *  otros:         opts {team, v (variante), mask, size, open, state, ...}               f = frame
 */
PE.frame = function (kind, key, f, opts = {}) {
  const def = PE.ART[kind][key];
  const teamHex = typeof opts.team === 'number' ? PE.TEAM_COLORS[opts.team].hex : (opts.team || PE.TEAM_COLORS[0].hex);
  const ck = kind + '|' + key + '|' + f + '|' + teamHex + '|' + JSON.stringify(opts, (k, v) => k === 'team' ? undefined : v);
  let c = _cache.get(ck);
  if (c) return c;
  if (!def) {
    if (!PE.MISSING.has(kind + ':' + key)) { PE.MISSING.add(kind + ':' + key); console.warn('PE: arte faltante', kind, key); }
    c = placeholder(16, 16);
  } else {
    const w = typeof def.w === 'function' ? def.w(opts) : def.w, h = typeof def.h === 'function' ? def.h(opts) : def.h;
    const k = opts.k ?? PE.envScale(kind, key);
    const cv = k > 1 ? new SCanvasScaled(w, h, k) : new SCanvas(w, h);
    try {
      if (kind === 'units') {
        const anim = PE.ANIMS[opts.anim || 'idle'];
        def.draw(cv, anim[((f % anim.length) + anim.length) % anim.length], opts);
      } else def.draw(cv, f, opts);
      const ro = Object.assign({ team: teamHex }, def.render || {});
      if (kind === 'units' && ro.shadow === undefined) ro.shadow = true;
      if (k > 1 && ro.shadow && ro.shadow !== true) { const sh = ro.shadow; ro.shadow = Object.assign({}, sh, { cx: sh.cx != null ? sh.cx * k : undefined, cy: sh.cy != null ? sh.cy * k : undefined, rx: sh.rx != null ? sh.rx * k : undefined, ry: sh.ry != null ? sh.ry * k : undefined }); }
      c = PE.render(cv, ro); c.k = k;
    } catch (e) {
      console.error('PE: error dibujando', kind, key, e);
      c = placeholder(w, h);
    }
  }
  _cache.set(ck, c);
  return c;
};
PE.frameCount = function (kind, key, anim) {
  if (kind === 'units') return PE.ANIMS[anim || 'idle'].length;
  const def = PE.ART[kind][key];
  return def ? def.frames || 1 : 1;
};
PE.clearCache = () => _cache.clear();
