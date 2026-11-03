/* =====================================================================
   Registro del arte 3D. Junta los módulos de arte (uno por autor) y
   construye/cachea las geometrías. Si falta un modelo se usa uno
   genérico, así el juego siempre se puede jugar.
   Claves:
     unidades      UNITS de data.js (human_inf, animal_sheep, neutral_ogre...)
     edificios     <raza>_<tipo> (human_house, orc_wall_post...) y neutrales (bandit_camp...)
     naturaleza    tree_oak, mine_gold, bush_berry, decor_flowers, proj_arrow...
   ===================================================================== */
import { Builder } from '../kit.js';
import { makeSkeleton } from '../rig.js';
import { MODELS as REF } from './reference.js';
import { MODELS as UNITS_HED } from './units_hed.js';
import { MODELS as UNITS_OGN } from './units_ogn.js';
import { MODELS as BLD_HED } from './bld_hed.js';
import { MODELS as BLD_OGN } from './bld_ogn.js';
import { MODELS as NATURE } from './nature.js';
import { MODELS as ICONS } from './icons.js';
import { fallbackUnit, fallbackBuilding, fallbackNature } from './fallback.js';

const ART = Object.assign({}, REF, UNITS_HED, UNITS_OGN, BLD_HED, BLD_OGN, NATURE, ICONS);
const GEO = new Map(), SK = new Map();

/** Definición de un modelo (o genérica si no existe). kind: 'unit' | 'bld' | 'nature'. */
function artDef(key, kind) {
  const d = ART[key];
  if (d) return d;
  const f = kind === 'unit' ? fallbackUnit(key) : kind === 'bld' ? fallbackBuilding(key) : fallbackNature(key);
  ART[key] = f; f.fallback = true; return f;
}
function hasArt(key) { return !!ART[key] && !ART[key].fallback; }
/** Esqueleto de una unidad (cacheado). */
function skeletonOf(key) {
  let s = SK.get(key); if (s) return s;
  const d = artDef(key, 'unit'); s = makeSkeleton(d.skeleton || 'humanoid', d.pivots || {}); SK.set(key, s); return s;
}
/**
 * Geometría fusionada de un modelo. variant: índice de variante (árboles, rocas) o nombre de
 * sub-modelo para edificios compuestos (muro: 'post' | 'seg').
 */
function artGeometry(key, kind, variant = 0) {
  const ck = key + '#' + variant; let g = GEO.get(ck); if (g) return g;
  const d = artDef(key, kind), b = new Builder();
  try {
    if (kind === 'unit') d.build(b, skeletonOf(key).P);
    else if (typeof variant === 'string' && d[variant]) d[variant](b);
    else d.build(b, { v: variant | 0 });
    g = b.geometry();
  } catch (e) { console.error('Arte 3D: fallo al construir', key, e); g = null; }
  if (!g) { const f = new Builder(); (kind === 'unit' ? fallbackUnit(key) : kind === 'bld' ? fallbackBuilding(key) : fallbackNature(key)).build(f, kind === 'unit' ? skeletonOf(key).P : { v: 0 }); g = f.geometry(); }
  g.userData.height = g.boundingBox.max.y;
  GEO.set(ck, g); return g;
}
function artKeys() { return Object.keys(ART); }
export { ART, artDef, hasArt, skeletonOf, artGeometry, artKeys };
