/* =====================================================================
   Material común de los modelos procedurales (unidades, edificios,
   naturaleza). Lee los atributos del kit (aCol, aMisc, aSpinC, aSpinA)
   y, por instancia (el límite de 16 atributos obliga a empaquetar):
     iTeam  vec4  rgb = color de equipo (o tinte de la copa); w = fila de huesos (rig)
     iData  vec4  x = máscara de piezas opcionales (estáticos)
                  y = altura de recorte (obra en construcción; 99 = entero)
                  z = semilla/fase   w = destello de golpe / sacudida
   Variantes:
     rig     las piezas se mueven con matrices de hueso: una textura global
             (fila iTeam.w por instancia, 3 texels por pieza)
     static  aPart es un grupo opcional que se oculta según la máscara
   Cada material tiene su gemelo de profundidad para que las sombras
   respeten las animaciones.
   ===================================================================== */
import * as THREE from 'three';
import { GLOBAL, withFog } from './shaderlib.js';

const VERT_HEAD = /* glsl */`
attribute vec3 aCol; attribute vec4 aMisc; attribute vec3 aSpinC; attribute vec4 aSpinA;
attribute vec4 iTeam; attribute vec4 iData;
#define aTeam aMisc.x
#define aGlow aMisc.y
#define aWave aMisc.z
#define aPart aMisc.w
uniform float uTime; uniform vec2 uWind; uniform float uSpinK;
varying vec3 vPeCol; varying float vPeGlow; varying float vPeLocalY; varying float vPeClip; varying float vPeFlash;
#ifdef PE_RIG
uniform highp sampler2D uBones;
mat4 peBone(int part) {
  int x = part * 3, y = int(iTeam.w + 0.5);
  vec4 r0 = texelFetch(uBones, ivec2(x, y), 0), r1 = texelFetch(uBones, ivec2(x + 1, y), 0), r2 = texelFetch(uBones, ivec2(x + 2, y), 0);
  return transpose(mat4(r0, r1, r2, vec4(0.0, 0.0, 0.0, 1.0)));
}
#endif
mat4 peAxisRot(vec3 c, vec3 axis, float a) {
  vec3 k = normalize(axis); float s = sin(a), co = cos(a), t = 1.0 - co;
  mat3 R = mat3(t*k.x*k.x + co, t*k.x*k.y + s*k.z, t*k.x*k.z - s*k.y,
                t*k.x*k.y - s*k.z, t*k.y*k.y + co, t*k.y*k.z + s*k.x,
                t*k.x*k.z + s*k.y, t*k.y*k.z - s*k.x, t*k.z*k.z + co);
  mat4 M = mat4(R); M[3] = vec4(c - R * c, 1.0); return M;
}
mat4 peDeform() {
  mat4 M = mat4(1.0);
#ifdef PE_RIG
  M = peBone(int(aPart + 0.5));
#else
  int pm = int(aPart + 0.5);
  if (pm > 0 && ((int(iData.x + 0.5) >> pm) & 1) == 0) M = mat4(0.0);
#endif
  if (aSpinA.w != 0.0) M = M * peAxisRot(aSpinC, aSpinA.xyz, uTime * aSpinA.w * uSpinK);
  return M;
}
vec3 peWave(vec3 p) {
  float ph = iData.z * 6.2831;
  if (aWave > 0.0) {         // balanceo con el viento (árboles, hierba, juncos)
    float g = 0.55 + 0.45 * sin(uTime * 1.3 + ph + p.x * 0.7) + 0.25 * sin(uTime * 3.1 + ph * 1.7);
    return vec3(uWind.x, 0.0, uWind.y) * g * aWave * 0.11 + vec3(0.0, -aWave * aWave * 0.01 * g, 0.0);
  }
  if (aWave < 0.0) {         // ondear (banderas, capas, toldos)
    float w = -aWave;
    return vec3(sin(uTime * 7.0 + ph + p.x * 9.0 + p.y * 3.0) * 0.012, sin(uTime * 5.3 + ph + p.x * 6.0) * 0.008, sin(uTime * 6.1 + ph + p.x * 8.0) * 0.03) * w;
  }
  return vec3(0.0);
}
`;
const VERT_NORMAL = /* glsl */`
#include <beginnormal_vertex>
mat4 peM = peDeform();
objectNormal = mat3(peM) * objectNormal;
`;
const VERT_BEGIN = /* glsl */`
vPeCol = mix(aCol, aCol * iTeam.rgb, aTeam); vPeGlow = aGlow; vPeClip = iData.y; vPeFlash = iData.w;
#ifdef PE_GHOST
vPeCol = mix(vec3(dot(aCol, vec3(0.33))), iTeam.rgb, 0.75); vPeGlow = 0.25;
#endif
transformed = (peM * vec4(transformed, 1.0)).xyz;
transformed += peWave(transformed);
vPeLocalY = transformed.y;
`;
const FRAG_HEAD = /* glsl */`
uniform float uTime;
varying vec3 vPeCol; varying float vPeGlow; varying float vPeLocalY; varying float vPeClip; varying float vPeFlash;
`;
const FRAG_CLIP = /* glsl */`
if (vPeLocalY > vPeClip) discard;
`;

const MATS = new Map();
/** Textura global de huesos (la rellena rig.js) y multiplicador de giro. */
const BONES = { value: null }, SPIN = { value: 1 };
/**
 * Material compartido. kind: 'rig' | 'static'. opts.transparent para fantasmas.
 */
function modelMaterial(kind, opts = {}) {
  const key = kind + (opts.key || '');
  if (MATS.has(key)) return MATS.get(key);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: !opts.transparent });
  mat.defines = kind === 'rig' ? { PE_RIG: '' } : {};
  if (opts.ghost) mat.defines.PE_GHOST = '';
  const uniforms = { uSpinK: SPIN, uBones: BONES };
  withFog(mat, {
    key: 'pm_' + key, uniforms,
    vertexHead: VERT_HEAD,
    fragmentHead: FRAG_HEAD,
    fragmentColor: 'diffuseColor.rgb *= vPeCol;' + FRAG_CLIP,
  });
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    prev(shader, r);
    shader.vertexShader = shader.vertexShader
      .replace('#include <beginnormal_vertex>', VERT_NORMAL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BEGIN);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vPeCol * vPeGlow * (0.85 + 0.15 * sin(uTime * 3.0)) * 1.4 + vec3(vPeFlash * 0.7);');
    mat.userData.shader = shader;
  };
  mat.userData.kind = kind;
  MATS.set(key, mat);
  return mat;
}
/** Gemelo de profundidad (sombras) con la misma deformación y recorte. */
function depthMaterial(kind) {
  const key = 'depth_' + kind;
  if (MATS.has(key)) return MATS.get(key);
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.defines = kind === 'rig' ? { PE_RIG: '' } : {};
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, GLOBAL, { uSpinK: SPIN, uBones: BONES });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nmat4 peM = peDeform();\n' + VERT_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('void main() {', 'void main() {\n' + FRAG_CLIP);
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => 'pmdepth_' + kind;
  MATS.set(key, mat);
  return mat;
}
export { modelMaterial, depthMaterial, BONES, SPIN };
