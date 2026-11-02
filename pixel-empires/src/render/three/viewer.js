/* =====================================================================
   Visor de modelos 3D: index.html?viewer=units|buildings|nature|keys
   Parámetros:
     filter=human_        prefijo de clave        keys=a,b,c   lista exacta
     anim=idle|walk|attack|work|die|cycle         work=chop|mine|build|farm|gather
     carry=wood|food|gold|stone|iron              team=0..7 (o 'all' = un color por modelo)
     yaw=30 (grados)      cols=6    zoom=1 (más = más cerca)   mask=2 (piezas opcionales)
     snow=1  pitch=52  t=1.3 (congela el tiempo en ese segundo)
   Pone window.__viewerReady = true tras el primer frame.
   ===================================================================== */
import * as THREE from 'three';
import { UNITS } from '../../data/data.js';
import { PE } from '../pixel/sprite.js';
import { GLOBAL } from './shaderlib.js';
import { artDef, artGeometry, skeletonOf, hasArt } from './art/index.js';
import { UNIT_KEYS, BUILDING_KEYS, NATURE_KEYS } from './art/keys.js';
import { RigSet, StaticSet } from './sets.js';
import { Pose, animate, writeBones, bonesBegin, bonesRow, bonesEnd, BT } from './rig.js';

/** Piezas opcionales visibles por defecto en el visor (las del estado normal en el juego). */
function defMask(k) { return /_gate$/.test(k) ? 2 : /_farm$/.test(k) ? 8 : /^bush_berry|^treasure_chest/.test(k) ? 2 : /^mine_/.test(k) ? 6 : 0; }
function startViewer() {
  const q = new URLSearchParams(location.search), mode = q.get('viewer');
  document.body.innerHTML = '<canvas id="v3d" style="position:fixed;inset:0;width:100vw;height:100vh"></canvas><canvas id="vlab" style="position:fixed;inset:0;pointer-events:none"></canvas>';
  const cv = document.getElementById('v3d'), lab = document.getElementById('vlab'), lc = lab.getContext('2d');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = q.get('tm') === 'neutral' ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#6f8f5a');
  scene.add(new THREE.HemisphereLight('#cfe0ff', '#7a6a50', +(q.get('hemi') || 1.5)));
  const sun = new THREE.DirectionalLight('#fff0d2', +(q.get('sun') || 2.1)); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 2.5;
  scene.add(sun); scene.add(sun.target);
  GLOBAL.uFogOn.value = 0;

  let keys = q.get('keys') ? q.get('keys').split(',') : mode === 'units' ? UNIT_KEYS : mode === 'buildings' ? BUILDING_KEYS : NATURE_KEYS;
  const filter = q.get('filter'); if (filter) keys = keys.filter(k => filter.split(',').some(f => k.startsWith(f)));
  const kindOf = k => UNITS[k] ? 'unit' : BUILDING_KEYS.includes(k) || /_(wall|gate)/.test(k) ? 'bld' : 'nature';
  const sizeOf = k => { const kd = kindOf(k); if (kd === 'unit') { const d = artDef(k, 'unit'); return d.skeleton === 'rider' || d.skeleton === 'siege' || UNITS[k].race === 'giant' ? 1.4 : 1; } if (kd === 'bld') return (artDef(k, 'bld').fp || 1) + 0.8; return 1.4; };
  const cell = Math.max(...keys.map(sizeOf)), cols = +(q.get('cols') || Math.ceil(Math.sqrt(keys.length * 1.6)));
  const rows = Math.ceil(keys.length / cols), W = cols * cell, H = rows * cell;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, H + 6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7fa064' }));
  ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(Math.max(W, H) + 6, Math.round(Math.max(W, H) + 6), 0x557744, 0x6a8a55); grid.position.y = 0.002; scene.add(grid);

  const teamQ = q.get('team') || '0', teamCols = PE.TEAM_COLORS.map(t => new THREE.Color(t.hex));
  const yaw = (+(q.get('yaw') ?? 20)) * Math.PI / 180, mask = q.get('mask'), snow = q.get('snow') === '1';
  const items = keys.map((k, i) => {
    const kind = kindOf(k), d = artDef(k, kind), x = (i % cols) * cell - W / 2 + cell / 2, z = Math.floor(i / cols) * cell - H / 2 + cell / 2;
    const it = { k, kind, d, x, z, col: teamCols[teamQ === 'all' ? i % 8 : +teamQ] };
    if (kind === 'unit') { it.set = new RigSet(scene, artGeometry(k, 'unit'), { cap: 1 }); it.pose = new Pose(skeletonOf(k)); }
    else if (k.endsWith('_wall_post') || k.endsWith('_wall_seg')) { it.set = new StaticSet(scene, artGeometry(k, 'bld'), { cap: 4 }); }
    else { const vs = d.variants || 1; it.sets = []; for (let v = 0; v < vs; v++) it.sets.push(new StaticSet(scene, artGeometry(k, kind, v), { cap: 1 })); }
    return it;
  });
  // cámara como la del juego
  const pitch = (+(q.get('pitch') || 52)) * Math.PI / 180, cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 400);
  const fit = Math.max(H, W / (innerWidth / innerHeight)) * 1.25 / (+(q.get('zoom') || 1)), dist = fit / (2 * Math.tan(17 * Math.PI / 180)) + 1;
  cam.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist + 0.2); cam.lookAt(0, 0.25, 0.2);
  const span = Math.max(W, H) * 0.8 + 3; sun.position.set(-span * 0.55, span * 1.25 + 6, span * 0.35); const sc = sun.shadow.camera; sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.far = span * 4 + 20; sc.updateProjectionMatrix();

  const anim = q.get('anim') || 'idle', work = q.get('work') || 'chop', carry = q.get('carry') || null, tFix = q.get('t');
  let t0 = performance.now(), frames = 0;
  function frame() {
    const t = tFix !== null ? +tFix : (performance.now() - t0) / 1000;
    GLOBAL.uTime.value = t;
    bonesBegin();
    items.forEach((it, i) => {
      if (it.kind === 'unit') {
        const a = anim === 'cycle' ? ['idle', 'walk', 'attack', 'work', 'die'][Math.floor(t / 2.4) % 5] : anim, lt = t % 2.4;
        const st = { anim: a === 'die' ? 'idle' : a, f: (t * 10 * (UNITS[it.k].sp || 34) / 34) % 8, k: (lt % 1.2) / 1.2, t, seed: i * 0.37, work: it.k.endsWith('_worker') ? work : null, carry, stun: 0, dead: a === 'die' ? lt : -1 };
        if (st.anim === 'work') st.f = (t * 6) % 4;
        animate(it.d, it.pose, st);
        const row = bonesRow(); writeBones(it.pose, BT.data, row * 72 * 4);
        it.set.begin(); it.set.add(row, it.x, 0, it.z, yaw, it.d.scale || 1, it.col); it.set.end();
      } else if (it.set) {
        it.set.begin();
        if (it.k.endsWith('_wall_post')) it.set.add(it.x, 0, it.z, 0, 1, 1, 1, it.col);
        else for (const [dx, dz, r] of [[0, 0, 0], [0, 0, -Math.PI / 2]]) it.set.add(it.x + dx, 0, it.z + dz, r, 1, 1, 1, it.col);
        it.set.end();
      } else {
        const d = it.d, tints = d.tints ? d.tints.map(h => new THREE.Color(h)) : null;
        it.sets.forEach((s, v) => {
          const n = it.sets.length, off = n > 1 ? (v - (n - 1) / 2) * (cell / n) * 0.9 : 0;
          s.begin(); s.add(it.x + off, 0, it.z + (n > 1 ? (v % 2) * 0.25 - 0.12 : 0), it.kind === 'bld' ? 0 : yaw + v, 1, 1, 1, tints ? tints[v % tints.length] : it.col, mask !== null ? +mask : (snow ? 2 : (d.defaultMask ?? defMask(it.k))), 99, v * 0.31); s.end();
        });
      }
    });
    bonesEnd();
    renderer.render(scene, cam);
    // etiquetas
    lab.width = innerWidth * 2; lab.height = innerHeight * 2; lab.style.width = innerWidth + 'px'; lab.style.height = innerHeight + 'px';
    lc.setTransform(2, 0, 0, 2, 0, 0); lc.font = '600 12px monospace'; lc.textAlign = 'center';
    for (const it of items) {
      const p = new THREE.Vector3(it.x, 0, it.z + cell * 0.42).project(cam), sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight;
      const txt = it.k + (hasArt(it.k) ? '' : ' (genérico)');
      lc.fillStyle = 'rgba(0,0,0,.55)'; const w = lc.measureText(txt).width + 8; lc.fillRect(sx - w / 2, sy - 11, w, 15); lc.fillStyle = hasArt(it.k) ? '#fff' : '#ffb0a0'; lc.fillText(txt, sx, sy);
    }
    if (++frames === 2) window.__viewerReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__viewer = { items, scene, cam, renderer };
}
export { startViewer };
