/* =====================================================================
   Terreno 3D generado desde G.map: relieve suave (solo visual; la
   simulación sigue en una rejilla plana), mezcla de terrenos en shader
   con bordes irregulares, adoquines en caminos, roca en pendientes y
   bloques de 16×16 casillas con recorte por cámara.
   ===================================================================== */
import * as THREE from 'three';
import { TR } from '../../map/map.js';
import { GLOBAL, withFog } from './shaderlib.js';

const RES = 2;                 // vértices por casilla
const CH = 16;                 // casillas por bloque
// altura base por terreno: hierba, hierba oscura, tierra, arena, nieve, camino, roca, agua, vado
const BASE_H = [0, 0.03, -0.01, -0.07, 0.12, -0.02, 1.0, -0.62, -0.24];
// paleta (sRGB): color A y B por terreno, mezclados con ruido
const PAL_A = ['#5e9a3e', '#3f7e35', '#8c6a45', '#dcc58e', '#e8eef5', '#9c8a6c', '#7c7a7c', '#3d5a6a', '#b9a273'];
const PAL_B = ['#7bb04c', '#4f9040', '#a07c52', '#ead6a2', '#f6f9fc', '#b2a283', '#959091', '#2e4a5a', '#a89064'];
const WATER_LEVEL = -0.16;

const TERR = { heights: null, N: 0, W: 0, H: 0, group: null, typesTex: null, material: null };

function valueNoise(seed) {
  const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy); const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
}
/** Calcula el campo de alturas (N×N vértices) a partir de los tipos de terreno. */
function buildHeights(map) {
  const W = map.W, H = map.H, N = W * RES + 1, M = H * RES + 1, h = new Float32Array(N * M), terr = map.terr;
  const n1 = valueNoise(map.seed | 0), n2 = valueNoise((map.seed | 0) + 17);
  const tAt = (x, y) => terr[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const X = i / RES, Z = j / RES, qx = X - 0.5, qz = Z - 0.5, cx = Math.floor(qx), cz = Math.floor(qz), fx = qx - cx, fz = qz - cz;
    let v = 0, wl = 0;
    for (const [dx, dz, w] of [[0, 0, (1 - fx) * (1 - fz)], [1, 0, fx * (1 - fz)], [0, 1, (1 - fx) * fz], [1, 1, fx * fz]]) {
      const t = tAt(cx + dx, cz + dz); let b = BASE_H[t];
      if (t === TR.ROCK) b += n2(X * 0.45, Z * 0.45) * 1.1 + n1(X * 1.3, Z * 1.3) * 0.25;
      v += b * w; if (t !== TR.WATER && t !== TR.SHALLOW) wl += w;
    }
    // ondulación suave de las tierras (no del agua)
    v += (n1(X / 13, Z / 13) - 0.5) * 0.55 * wl + (n2(X / 4, Z / 4) - 0.5) * 0.08 * wl;
    h[j * N + i] = v;
  }
  return { h, N, M };
}
function heightAt(X, Z) {
  const { heights: h, N, M } = TERR; if (!h) return 0;
  const gx = Math.min(N - 1.001, Math.max(0, X * RES)), gz = Math.min(M - 1.001, Math.max(0, Z * RES)), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = h[j * N + i], b = h[j * N + i + 1], c = h[(j + 1) * N + i], d = h[(j + 1) * N + i + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
/** Altura de apoyo para un edificio (media de sus esquinas y centro). */
function footprintHeight(tx, ty, fp) {
  let s = 0; for (const [x, z] of [[tx, ty], [tx + fp, ty], [tx, ty + fp], [tx + fp, ty + fp], [tx + fp / 2, ty + fp / 2]]) s += heightAt(x, z);
  return Math.max(WATER_LEVEL + 0.05, s / 5);
}

const TERRAIN_FRAG = /* glsl */`
uniform highp usampler2D uTypes; uniform vec3 uPalA[9]; uniform vec3 uPalB[9];
varying float vPeNY;
vec3 pe_terrCol(int t, vec2 p) {
  float n = pe_fbm(p * 0.7), n2 = pe_noise(p * 5.0);
  vec3 c = mix(uPalA[t], uPalB[t], n);
  if (t <= 1) c *= 0.9 + 0.2 * n2;
  else if (t == 2) c *= 0.88 + 0.24 * pe_noise(p * 9.0);
  else if (t == 3) c *= 0.95 + 0.08 * sin(p.x * 3.0 + p.y * 1.3 + n * 4.0);
  else if (t == 5) {   // adoquines
    vec2 q = p * 2.4; q.x += floor(q.y) * 0.5; vec2 g = fract(q);
    float e = min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y));
    c *= mix(0.62, 1.0, smoothstep(0.03, 0.14, e)) * (0.9 + 0.2 * pe_hash(floor(q)));
  } else if (t == 6) c *= 0.85 + 0.3 * pe_noise(p * vec2(1.5, 6.0));
  else if (t == 4) c *= 0.96 + 0.06 * n2;
  return c;
}
int pe_type(ivec2 c) { c = clamp(c, ivec2(0), ivec2(uMapSize) - 1); return int(texelFetch(uTypes, c, 0).r); }
vec3 pe_terrain(vec3 wp) {
  vec2 p = wp.xz, q = p - 0.5; ivec2 cell = ivec2(floor(q)); vec2 f = fract(q);
  vec2 warp = vec2(pe_fbm(p * 0.9), pe_fbm(p * 0.9 + 11.7)) - 0.5;
  warp += (vec2(pe_noise(p * 3.7), pe_noise(p * 3.7 + 5.1)) - 0.5) * 0.35;
  f = clamp(f + warp * 0.95, 0.0, 1.0);
  vec2 w = smoothstep(0.12, 0.88, f);
  vec3 c00 = pe_terrCol(pe_type(cell), p), c10 = pe_terrCol(pe_type(cell + ivec2(1, 0)), p), c01 = pe_terrCol(pe_type(cell + ivec2(0, 1)), p), c11 = pe_terrCol(pe_type(cell + ivec2(1, 1)), p);
  vec3 c = mix(mix(c00, c10, w.x), mix(c01, c11, w.x), w.y);
  // pendientes pronunciadas: roca; zonas bajas cerca del agua: más oscuras
  vec3 rock = mix(uPalA[6], uPalB[6], pe_noise(p * vec2(2.0, 7.0))) * (0.8 + 0.25 * pe_noise(vec2(p.x * 3.0, wp.y * 9.0)));
  c = mix(rock, c, smoothstep(0.62, 0.86, vPeNY));
  c *= mix(0.72, 1.0, smoothstep(-0.5, -0.05, wp.y));
  return c;
}
`;

function buildTerrain(map, scene) {
  const W = map.W, H = map.H; TERR.W = W; TERR.H = H;
  const { h, N, M } = buildHeights(map); TERR.heights = h; TERR.N = N; TERR.M = M;
  // tipos de terreno por casilla (entero) para el shader
  const types = new Uint8Array(W * H); types.set(map.terr);
  TERR.typesData = types;
  TERR.typesTex = new THREE.DataTexture(types, W, H, THREE.RedIntegerFormat, THREE.UnsignedByteType);
  TERR.typesTex.internalFormat = 'R8UI'; TERR.typesTex.magFilter = THREE.NearestFilter; TERR.typesTex.minFilter = THREE.NearestFilter; TERR.typesTex.needsUpdate = true;
  const palA = PAL_A.map(c => new THREE.Color(c)), palB = PAL_B.map(c => new THREE.Color(c));
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  withFog(mat, {
    key: 'terrain', uniforms: { uTypes: { value: TERR.typesTex }, uPalA: { value: palA }, uPalB: { value: palB } },
    vertexHead: 'varying float vPeNY;', vertexWorld: 'vPeNY = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz).y;',
    fragmentHead: TERRAIN_FRAG, fragmentColor: 'diffuseColor.rgb = pe_terrain(vPeWorld);',
  });
  TERR.material = mat;
  const group = new THREE.Group(); group.name = 'terreno';
  for (let cz = 0; cz < H; cz += CH) for (let cx = 0; cx < W; cx += CH) {
    const geo = chunkGeometry(cx, cz, Math.min(CH, W - cx), Math.min(CH, H - cz));
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.castShadow = false; group.add(mesh);
  }
  // suelo exterior oscuro para que no se vea el vacío más allá del mapa
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(W + 160, H + 160), withFog(new THREE.MeshLambertMaterial({ color: 0x1a1626 }), { key: 'outer' }));
  outer.rotation.x = -Math.PI / 2; outer.position.set(W / 2, -0.75, H / 2); group.add(outer);
  scene.add(group); TERR.group = group;
  return TERR;
}
function chunkGeometry(cx, cz, w, hgt) {
  const { heights: h, N } = TERR, nx = w * RES + 1, nz = hgt * RES + 1;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3), idx = [];
  const H = (i, j) => h[Math.min(TERR.M - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const gi = cx * RES + i, gj = cz * RES + j, k = (j * nx + i) * 3;
    pos[k] = gi / RES; pos[k + 1] = H(gi, gj); pos[k + 2] = gj / RES;
    const dx = (H(gi + 1, gj) - H(gi - 1, gj)) * RES / 2, dz = (H(gi, gj + 1) - H(gi, gj - 1)) * RES / 2, l = Math.hypot(dx, 1, dz);
    nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(idx);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
/** Un camino nuevo: actualiza el tipo de la casilla en la textura del shader. */
function terrainTileChanged(map, tx, ty) {
  if (!TERR.typesData) return; TERR.typesData[ty * map.W + tx] = map.terr[ty * map.W + tx]; TERR.typesTex.needsUpdate = true;
}
function disposeTerrain(scene) {
  if (!TERR.group) return;
  TERR.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(TERR.group); TERR.group = null;
  if (TERR.typesTex) TERR.typesTex.dispose();
}
export { TERR, WATER_LEVEL, buildTerrain, heightAt, footprintHeight, terrainTileChanged, disposeTerrain, GLOBAL };
