/* Listas de claves de arte que el juego pide (para el visor y las pruebas). */
import { UNITS, RACE_KEYS, BUILD_MENU } from '../../../data/data.js';

const UNIT_KEYS = Object.keys(UNITS);
const NEUTRAL_BLD = ['bandit_camp', 'goblin_hut', 'shrine', 'ruins'];
/** Edificios: <raza>_<tipo>; muros y puertas se componen de piezas (_wall_post, _wall_seg, _gate). */
const BUILDING_KEYS = [...RACE_KEYS.flatMap(r => BUILD_MENU.filter(t => t !== 'wall').map(t => r + '_' + t).concat([r + '_wall_post', r + '_wall_seg'])), ...NEUTRAL_BLD];
const TREE_KEYS = ['tree_oak', 'tree_pine', 'tree_snowpine', 'tree_birch', 'tree_palm', 'tree_willow', 'tree_dead', 'tree_elder'];
const NATURE_KEYS = [
  ...TREE_KEYS, 'stump',
  'mine_gold', 'mine_stone', 'mine_iron', 'mine_gems', 'bush_berry', 'fish_spot',
  'decor_flowers', 'decor_grass_tuft', 'decor_rock_small', 'decor_rock_big', 'decor_mushroom', 'decor_reeds', 'decor_bones', 'decor_snowrock', 'decor_ruin_pillar', 'decor_signpost', 'decor_campfire',
  'treasure_chest', 'treasure_gold_pile', 'treasure_relic',
  'rubble_1', 'rubble_2', 'rubble_3', 'rubble_4', 'scaffold_1', 'scaffold_2', 'scaffold_3', 'scaffold_4',
  'proj_arrow', 'proj_bolt', 'proj_axe', 'proj_rock', 'proj_cannonball', 'proj_magic', 'proj_frost', 'proj_lightning',
];
export { UNIT_KEYS, BUILDING_KEYS, NATURE_KEYS, TREE_KEYS, NEUTRAL_BLD };
