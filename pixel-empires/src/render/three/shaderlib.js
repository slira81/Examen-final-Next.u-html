/* =====================================================================
   Piezas de shader compartidas: ruido procedural (sin texturas) y la
   niebla de guerra, que se inyecta en cualquier material estándar.
   Coordenadas: 1 unidad de Three.js = 1 casilla del mapa.
   ===================================================================== */
import * as THREE from 'three';

/** Uniforms globales compartidos por todos los materiales (se actualizan una vez por frame). */
const GLOBAL = {
  uFogTex: { value: null },            // G.vis en una textura W×H con filtrado lineal (bordes suaves)
  uMapSize: { value: new THREE.Vector2(96, 96) },
  uFogOn: { value: 1 },                // 0 con el mapa revelado o en modo observador
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.8, 0.3) },
  uFlash: { value: 0 },                // relámpagos
};

const NOISE_GLSL = /* glsl */`
float pe_hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float pe_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pe_hash(i), pe_hash(i + vec2(1, 0)), u.x), mix(pe_hash(i + vec2(0, 1)), pe_hash(i + vec2(1, 1)), u.x), u.y);
}
float pe_fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * pe_noise(p); p *= 2.03; a *= 0.5; } return s; }
`;

/** Factor de niebla de guerra: 0 = sin explorar, ~0.5 = explorado, 1 = visible. */
const FOG_GLSL = /* glsl */`
uniform sampler2D uFogTex; uniform vec2 uMapSize; uniform float uFogOn; uniform float uFlash;
vec3 pe_applyFog(vec3 col, vec3 wpos) {
  if (uFogOn < 0.5) return col * (1.0 + uFlash * 0.6);
  vec2 uv = wpos.xz / uMapSize;
  float v = texture(uFogTex, uv).r;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) v = 0.0;
  float seen = smoothstep(0.02, 0.5, v), vis = smoothstep(0.55, 0.98, v);
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 explored = mix(vec3(g), col, 0.35) * 0.48;
  vec3 dark = vec3(0.035, 0.03, 0.055);
  return mix(dark, mix(explored, col * (1.0 + uFlash * 0.6), vis), seen);
}
`;

/**
 * Añade niebla de guerra (y, opcionalmente, código extra) a un material estándar/lambert/phong.
 * opts.vertex / opts.fragment: { head, main } para inyectar más código.
 */
function withFog(material, opts = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    Object.assign(shader.uniforms, GLOBAL, opts.uniforms || {});
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPeWorld;\n' + NOISE_GLSL + (opts.vertexHead || ''))
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + (opts.vertexWorld || '') + '\n{ vec4 pw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n pw = instanceMatrix * pw;\n#endif\n vPeWorld = (modelMatrix * pw).xyz; }');
    if (opts.vertexBegin) shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + opts.vertexBegin);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPeWorld;\n' + NOISE_GLSL + FOG_GLSL + (opts.fragmentHead || ''))
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = pe_applyFog(gl_FragColor.rgb, vPeWorld);');
    if (opts.fragmentColor) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + opts.fragmentColor);
    if (prev) prev(shader, r);
  };
  material.customProgramCacheKey = () => 'pefog' + (opts.key || '');
  return material;
}

export { GLOBAL, NOISE_GLSL, FOG_GLSL, withFog };
