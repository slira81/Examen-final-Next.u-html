/* =====================================================================
   Kit de modelado low-poly procedural (sin texturas).
   Un Builder acumula primitivas facetadas con color por vértice y
   atributos especiales que leen los shaders:
     aCol   color base (sRGB → lineal)          aTeam  1 = color del jugador
     aGlow  brillo propio 0..1 (runas, orbes)  aWave  ondear (banderas, copas)
     aSpinC centro de giro  aSpinA eje xyz + velocidad (aspas, ruedas)
     aPart  índice de pieza (solo unidades con rig)
   Uso:
     const b = new Builder();
     b.box(0.4, 0.5, 0.25, { y: 0.45, color: '#8a6a44' });
     b.cyl(0.05, 0.05, 0.8, 6, { x: 0.2, y: 0.6, rz: 0.2, color: 'team' });
     const geo = b.geometry();
   Opciones comunes de cada primitiva:
     x, y, z (posición)  rx, ry, rz (rotación en radianes, orden XYZ)  sx, sy, sz (escala)
     color ('#hex' | 'team')  glow (0..1)  wave (0..1)  spin: { c: [x, y, z], axis: [x, y, z], speed }
     part (índice de pieza, lo pone el rig)   flat (true por defecto: caras facetadas)
   ===================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _cache = new Map();
function lin(hex) { let c = _cache.get(hex); if (!c) { c = new THREE.Color(hex); _cache.set(hex, c); } return c; }
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** Variación determinista de color (±k en luminosidad) para evitar superficies planas. */
function shade(hex, k) { const c = lin(hex).clone(); c.offsetHSL(0, 0, k); return '#' + c.getHexString(THREE.SRGBColorSpace); }

class Builder {
  constructor() { this.geos = []; this.part = 0; }
  /** Añade una geometría de Three.js ya creada con las opciones comunes. */
  add(geo, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0); _q.setFromEuler(_e);
    _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1); _v.set(o.x || 0, o.y || 0, o.z || 0);
    _m.compose(_v, _q, _s); g.applyMatrix4(_m);
    if (o.flat !== false) g.computeVertexNormals();
    const n = g.attributes.position.count, team = o.color === 'team' ? 1 : 0, c = team ? lin('#ffffff') : lin(o.color || '#cccccc');
    const col = new Float32Array(n * 3), t = new Float32Array(n), gl = new Float32Array(n), wv = new Float32Array(n), sc = new Float32Array(n * 3), sa = new Float32Array(n * 4), pt = new Float32Array(n);
    const pos = g.attributes.position.array;
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; t[i] = team; gl[i] = o.glow || 0; pt[i] = o.part ?? this.part;
      wv[i] = typeof o.wave === 'function' ? o.wave(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) : (o.wave || 0);
      if (o.spin) { sc[i * 3] = o.spin.c[0]; sc[i * 3 + 1] = o.spin.c[1]; sc[i * 3 + 2] = o.spin.c[2]; sa[i * 4] = o.spin.axis[0]; sa[i * 4 + 1] = o.spin.axis[1]; sa[i * 4 + 2] = o.spin.axis[2]; sa[i * 4 + 3] = o.spin.speed; }
    }
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aTeam', new THREE.BufferAttribute(t, 1)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
    g.setAttribute('aWave', new THREE.BufferAttribute(wv, 1)); g.setAttribute('aSpinC', new THREE.BufferAttribute(sc, 3)); g.setAttribute('aSpinA', new THREE.BufferAttribute(sa, 4)); g.setAttribute('aPart', new THREE.BufferAttribute(pt, 1));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'aCol', 'aTeam', 'aGlow', 'aWave', 'aSpinC', 'aSpinA', 'aPart'].includes(k)) g.deleteAttribute(k);
    this.geos.push(g); return this;
  }
  // ---- primitivas (centradas en el origen salvo que se indique)
  box(w, h, d, o) { return this.add(new THREE.BoxGeometry(w, h, d), o); }
  /** Cilindro/prisma: rTop, rBot, alto, lados (6 = hexagonal, estilo low-poly). */
  cyl(rt, rb, h, seg = 7, o) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1), o); }
  cone(r, h, seg = 6, o) { return this.add(new THREE.ConeGeometry(r, h, seg, 1), o); }
  /** Esfera low-poly (icosaedro); detail 0 = 20 caras, 1 = 80. */
  ball(r, detail = 1, o) { return this.add(new THREE.IcosahedronGeometry(r, detail), o); }
  /** Esfera achatada/estirada por ejes. */
  blob(rx, ry, rz, detail = 1, o = {}) { return this.add(new THREE.IcosahedronGeometry(1, detail), Object.assign({}, o, { sx: rx, sy: ry, sz: rz })); }
  /** Cuña (prisma triangular): base w×d, alto h, cumbrera a lo largo de X (tejado a dos aguas). */
  wedge(w, h, d, o) {
    const g = new THREE.BufferGeometry(), x = w / 2, z = d / 2;
    const v = [-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z, -x, h, 0, x, h, 0];
    const f = [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 3, 0, 4, 1, 2, 5, 0, 3, 2, 0, 2, 1];
    const p = []; for (const i of f) p.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return this.add(g, o);
  }
  /** Pirámide de base cuadrada (tejado a cuatro aguas, puntas). */
  pyramid(w, h, d, o = {}) { return this.add(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4), Object.assign({}, o, { sx: w * (o.sx ?? 1), sy: h * (o.sy ?? 1), sz: d * (o.sz ?? 1) })); }
  torus(r, tube, seg = 8, tseg = 5, o) { return this.add(new THREE.TorusGeometry(r, tube, tseg, seg), o); }
  /** Placa plana (banderas, toldos): w×h en el plano XY. */
  plane(w, h, o) { return this.add(new THREE.PlaneGeometry(w, h, 3, 2), Object.assign({ flat: true }, o)); }
  /** Cilindro hueco por segmentos de un perfil (copas, cúpulas, jarrones): pts = [[r, y], ...]. */
  lathe(pts, seg = 8, o) { return this.add(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), o); }
  /** Extrusión de un contorno 2D (XY) con profundidad d. */
  extrude(pts, d, o) { const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); return this.add(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), o); }
  /** Geometría final fusionada (o null si está vacía). */
  geometry() { if (!this.geos.length) return null; const g = mergeGeometries(this.geos, false); g.computeBoundingSphere(); g.computeBoundingBox(); return g; }
}

/** Pseudoaleatorio determinista por semilla (para variantes). */
function rng(seed) { let a = seed | 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export { Builder, lin, shade, rng };
