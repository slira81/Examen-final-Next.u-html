/* =====================================================================
   Agua: malla solo donde hay agua, profundidad por vértice a partir del
   relieve, shader animado (ondas, brillos, espuma en la orilla) y niebla.
   ===================================================================== */
import * as THREE from 'three';
import { TERR, WATER_LEVEL } from './terrain.js';
import { GLOBAL, NOISE_GLSL, FOG_GLSL } from './shaderlib.js';

const WATER = { mesh: null };
function buildWater(scene) {
  const { heights: h, N, M } = TERR, RES = (N - 1) / TERR.W;
  const pos = [], depth = [], idx = [], vid = new Int32Array(N * M).fill(-1);
  const vert = (i, j) => { const k = j * N + i; if (vid[k] >= 0) return vid[k]; vid[k] = pos.length / 3; pos.push(i / RES, WATER_LEVEL, j / RES); depth.push(WATER_LEVEL - h[k]); return vid[k]; };
  for (let j = 0; j < M - 1; j++) for (let i = 0; i < N - 1; i++) {
    const d = Math.max(WATER_LEVEL - h[j * N + i], WATER_LEVEL - h[j * N + i + 1], WATER_LEVEL - h[(j + 1) * N + i], WATER_LEVEL - h[(j + 1) * N + i + 1]);
    if (d < -0.02) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), e = vert(i + 1, j + 1); idx.push(a, c, b, b, c, e);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1)); g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: Object.assign({ uDeep: { value: new THREE.Color('#1d5f8f') }, uShallow: { value: new THREE.Color('#43a6c6') }, uFoam: { value: new THREE.Color('#eef6ff') } }, GLOBAL),
    vertexShader: /* glsl */`
      attribute float aDepth; varying float vDepth; varying vec3 vPeWorld; uniform float uTime;
      void main() {
        vDepth = aDepth; vec4 w = modelMatrix * vec4(position, 1.0);
        float k = smoothstep(0.0, 0.25, aDepth);
        w.y += (sin(w.x * 1.3 + uTime * 1.6) * 0.016 + sin(w.z * 1.7 + uTime * 1.2) * 0.012) * k;
        vPeWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uShallow, uFoam; uniform float uTime; varying float vDepth; varying vec3 vPeWorld;
      ${NOISE_GLSL}
      ${FOG_GLSL}
      void main() {
        float d = vDepth; if (d < -0.015) discard;
        vec2 p = vPeWorld.xz; float t = uTime;
        float rip = pe_noise(p * 2.1 + vec2(t * 0.35, t * 0.22)) * 0.55 + pe_noise(p * 4.6 - vec2(t * 0.27, t * 0.41)) * 0.45;
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.42, d));
        col += vec3(0.10, 0.12, 0.14) * smoothstep(0.66, 0.82, rip);
        float band = 1.0 - smoothstep(0.0, 0.075, d);
        float anim = smoothstep(0.55, 0.75, pe_noise(p * 3.2 + t * 0.6) + 0.3 * sin(d * 70.0 - t * 3.0));
        col = mix(col, uFoam, clamp(band * 0.75 + band * anim * 0.35, 0.0, 1.0));
        float alpha = max(mix(0.6, 0.92, smoothstep(0.0, 0.35, d)), band * 0.92);
        gl_FragColor = vec4(pe_applyFog(col, vPeWorld), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 2; mesh.name = 'agua';
  scene.add(mesh); WATER.mesh = mesh;
  return mesh;
}
function disposeWater(scene) { if (!WATER.mesh) return; WATER.mesh.geometry.dispose(); WATER.mesh.material.dispose(); scene.remove(WATER.mesh); WATER.mesh = null; }
export { WATER, buildWater, disposeWater };
