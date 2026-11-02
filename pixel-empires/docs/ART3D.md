# Pixel Empires — Especificación de arte 3D (low-poly procedural)

Todo el arte se genera **por código** con el kit `src/render/three/kit.js` (primitivas facetadas,
color por vértice, sin texturas ni modelos externos). La única dependencia es Three.js.
Referencias de estilo: *Northgard*, *Kingdoms and Castles*, *Townscaper*: limpio, coherente,
legible desde una cámara RTS inclinada ~52°, colores saturados pero no chillones, siluetas claras.

Mira los ejemplos en `src/render/three/art/reference.js` (espadachín humano, caballero, oveja,
casa humana, roble). Esa es la **calidad mínima**; mejórala.

## 1. Unidades y escala

* 1 unidad de Three.js = 1 casilla del mapa. El suelo es y = 0. Todo modelo **mira hacia +Z**.
* Humano: 0.62 de alto (pies en 0, coronilla ~0.64). Elfo 0.68 (esbelto). Enano 0.48 (ancho,
  hombros ~0.24). Orco 0.66 (encorvado, hombros ~0.26, cabeza baja). Gigante 1.1–1.25.
* Caballería: lomo ~0.45, jinete hasta ~0.85. Mamut: lomo ~0.9.
* Edificios: casa (2×2) ~1.35 de alto; centro urbano (4×4) ~2.0; castillo (4×4) ~2.8;
  torre (2×2) ~2.6; cuartel/galería/establo/templo/mercado/taller (3×3) 1.4–2.0; granja plana.
* Árboles 1.3–1.8 de alto, copa de radio ~0.45–0.6 (los bosques son densos y se solapan).

## 2. El kit (`Builder`)

```js
import { shade, rng } from '../kit.js';
build(b, P) {
  b.part = P.body;                                   // pieza del rig (solo unidades)
  b.box(w, h, d, { x, y, z, rx, ry, rz, color: '#8a6a44' });
  b.cyl(rTop, rBot, h, lados, { ... });              // 6–8 lados: estilo low-poly
  b.cone(r, h, lados, o); b.ball(r, detail, o); b.blob(rx, ry, rz, detail, o);
  b.wedge(w, h, d, o);       // tejado a dos aguas, cumbrera a lo largo de X, base en y=o.y
  b.pyramid(w, h, d, o);     // tejado a cuatro aguas
  b.torus(r, tubo, seg, tseg, o); b.plane(w, h, o); b.lathe([[r, y], ...], seg, o); b.extrude([[x, y], ...], d, o);
}
```
Opciones comunes: `x y z` (posición), `rx ry rz` (radianes; orden XYZ, o `order: 'YXZ'` para
inclinar primero y luego girar), `sx sy sz` / `s` (escala), `color` (`'#hex'`, `'team'` o `'tint'`),
`teamShade` (0.6–1.2: variante más oscura/clara del color de equipo o del tinte),
`glow` (0..1: brillo propio — runas, cristales, orbes, fuego), `wave` (balanceo con el viento,
número o `fn(x, y, z)`, típicamente proporcional a la altura), `flag` (ondear como tela: banderas,
capas, estandartes; número o `fn(x, y, z)` creciente hacia el borde libre),
`spin: { c: [x,y,z], axis: [x,y,z], speed }` (giro continuo: aspas de molino, cristales flotantes).
Las posiciones de `wave/flag` que recibe la función ya están en coordenadas del modelo.
`shade(hex, k)` aclara/oscurece un color (k ±0.05–0.15) para variar superficies; `rng(seed)` da
aleatorio determinista para variantes.

### Reglas de estilo
* Facetado (`flat` por defecto). Cilindros de 5–8 lados, esferas `detail` 0–1.
* Grosor mínimo: 0.012 en unidades, 0.025 en edificios (si no, parpadea).
* Formas exageradas y legibles: cabezas algo grandes, armas gruesas y largas, tejados marcados.
* Variar tonos (`shade`) en piezas grandes para que no queden planas; caras superiores claras.
* Nada de colores casi negros en superficies grandes (el sombreado ya oscurece): oscuros mínimos
  ~#3a2c20. Negro puro solo en detalles diminutos (ojos, rendijas).
* Presupuesto: unidad ≤ 70 primitivas, jinete/máquina ≤ 110, edificio ≤ 220, árbol ≤ 25,
  decoración ≤ 12, proyectil ≤ 6.

### Color de equipo (obligatorio)
* Unidades: tabardos, capas, escudos, gualdrapas, penachos, estandartes → ≥ 20 % de lo visible.
* Edificios: banderas que ondean (`flag`), estandartes, cumbreras, toldos, escudos en muros → al
  menos una bandera y ≥ 8 % de lo visible desde arriba. Los muros: remate o banderín por pilar.
* Usa `color: 'team'` (y `teamShade` para matices). La naturaleza usa `'tint'` para el color de copa.

## 3. Paletas por raza

| Raza | Materiales / colores | Silueta y motivos |
|---|---|---|
| Humanos | piedra clara #b9b2a6, yeso #efe6cf, vigas #5a3b26, teja #b5523b, acero #aab2bc, cuero #6b4a2c | equilibrados; entramado de madera, tejas, escudos con cruz |
| Elfos | madera viva #8a6a3c/#a8844f, hoja #5f9a4c/#7fbf5a, blanco #f1efe4, oro #d9b44a, cristal verde #7ff0c0 (glow) | altos y esbeltos, orejas puntiagudas; cúpulas de hojas, arcos, raíces, cristales verdes |
| Enanos | granito #8d8a86/#6e6b68, pizarra #4f5661, bronce #c08a3e, hierro #6d737c, runas #5fe3ff o #ff9a3a (glow) | bajos y anchos, barbas enormes, cascos con cuernos/crestas; macizo, runas brillantes |
| Orcos | pieles #a07850, empalizada #7a5a3a, hueso #e8dcc0, hierro oxidado #7a5040, rojo #9c2f24, piel #6f9a4a | grandes y encorvados, colmillos, pinchos; tiendas de pieles, empalizadas, calaveras |
| Gigantes | megalitos #a39e94/#8b8780, tepe #6f8a54, madera clara #b08a5a, pieles #cdbfa5, hielo #bfeaff (glow) | enormes; piedras en pie, tejados de hierba, pieles, armas de piedra, escarcha |
| Neutrales | bandidos: cuero/rojo apagado; goblins: verde amarillento #8fa04a, harapos; ogro: gris verdoso | |

## 4. Rigs de unidades

Cada unidad se modela **en pose de descanso** (brazos colgando, mirando a +Z) y cada primitiva se
asigna a una pieza (`b.part = P.nombre`). El motor anima las piezas girándolas alrededor de su
pivote. Esqueletos (`src/render/three/rig.js`):

* `humanoid`: root, body (pivote cadera), head (cuello), armL/armR (hombros), handL/handR (mano;
  arma, escudo — son hijas del brazo), legL/legR (cadera), cape (capa), back (carcaj, mochila),
  toolAxe/toolPick/toolHammer/toolHoe (mano derecha) y toolBasket (mano izquierda) — solo aldeanos,
  carryWood/carryFood/carryGold/carryStone/carryIron — carga a la espalda, solo aldeanos.
* `quadruped`: root, body, head (incluye el cuello), legFL/legFR/legBL/legBR (hijas de root:
  se quedan en el suelo), tail, extra (silla, armadura; sigue al cuerpo).
* `rider`: quadruped + jinete rBody (silla), rHead, rArmL, rArmR, rHandL, rHandR, rCape.
* `bird`: root, body, head, legL, legR, wingL, wingR, tail.
* `siege`: root, body, wheelFL/FR/BL/BR (giran en X al avanzar: modela la rueda con el eje en X),
  arm (brazo de catapulta / cañón / cabeza del ariete), arm2, crewL/crewR (tripulantes opcionales).

Pivotes: los valores por defecto (en `rig.js`) son para un humano de 0.62 o un cuadrúpedo
mediano. **Si tus proporciones cambian, da `pivots: { armR: [x, y, z], ... }`** con la posición
real de cada articulación en tu modelo (hombro, cadera, cuello, mano...). Las herramientas y
cargas heredan el pivote de su padre.

Definición de unidad:
```js
orc_inf: {
  skeleton: 'humanoid',
  pivots: { body: [0, 0.29, 0], head: [0, 0.5, 0.03], armL: [-0.13, 0.47, 0], ... },
  anim: { attack: 'swing', hold: 'sword', height: 0.66, walk: 'normal', stride: 0.55 },
  scale: 1,                     // escala extra de la instancia (generales 1.1–1.2)
  build(b, P) { ... },
  pose(pose, st) { }            // opcional: ajustes propios (p. ej. cola de lobo, alas)
}
```
`anim.attack` (el golpe se produce en k = 0.5 de la animación): `swing` (espada, hacha, maza),
`thrust` (lanza, pica, alabarda), `bow`, `crossbow`, `gun` (arma de fuego enana), `cast`/`heal`
(bastón, dos brazos), `throw` (hachas, rocas: el arma de handR se oculta al lanzar), `smash` (arma
a dos manos por encima de la cabeza). Cuadrúpedos: `bite`, `gore` (embestida con cuernos o
colmillos), `stomp` (se encabrita), `none`. Jinete: `anim.riderAttack` (swing/thrust/bow/throw).
Asedio: `catapult`, `cannon`, `ram`, `ballista`.
`anim.walk`: `normal`, `heavy` (gigantes, ogro), cuadrúpedos `trot` o `gallop`. `anim.hold`:
`sword`, `spear`, `staff`, `bow`, `crossbow`, `twohand`, `none` (modula el braceo).
`anim.size`: escala del cuadrúpedo para el rebote. `anim.wheelTurns`: vueltas de rueda por ciclo.

Convenciones de armas en pose de descanso (el brazo cuelga): espada/hacha en handR apuntando hacia
delante y arriba (~45°); lanza/pica/bastón vertical junto al cuerpo; arco vertical en handL;
ballesta/arma de fuego horizontal hacia delante a la altura de la cintura; escudo en handL mirando
hacia fuera-delante. Rotar el brazo hacia delante es `rx` negativo.

Generales (rol `general`): más grandes (`scale` 1.12–1.2) y vistosos: corona o casco ornamentado,
capa (`cape`, con `flag`), detalles dorados y algo de `glow`. El aura la dibuja el motor.

## 5. Edificios

Clave `<raza>_<tipo>`: tc, house, barracks, mill, lumber, mine, farm, range, stable, temple, forge,
market, tower, gate, workshop, castle, más `wall_post` y `wall_seg`. Neutrales: bandit_camp (3×3),
goblin_hut (2×2), shrine (2×2), ruins (2×2, plano).

* Huella fp×fp centrada en el origen (x, z ∈ [−fp/2, fp/2]); deja ~0.08 de margen al borde.
  Entrada y fachada principal hacia +Z (la cámara mira desde +Z).
* Base asentada: zócalo, plataforma o cimientos que tapen el contacto con el terreno.
* Cada edificio debe identificar su función de un vistazo (molino con aspas giratorias `spin`,
  aserradero con troncos y sierra, mina con entrada y vagoneta, herrería con chimenea y yunque,
  establo con cercado y heno, galería con dianas, templo con altar/cúpula, mercado con puestos y
  toldos, taller con máquinas a medio hacer, cuartel con armeros y estandartes, castillo con
  torres y almenas, centro urbano el más grande y rico en detalles).
* `smoke: [[x, y, z], ...]` puntos de humo de chimenea (casas, herrería, centro urbano).
* `fire: [[x, y, z], ...]` (opcional) dónde arde cuando está dañado; si no, se reparte solo.
* Granja (3×3, plana): pieza 0 = tierra arada con surcos y vallado bajo; piezas 1, 2, 3 = cultivo
  en tres etapas (brotes, medio, maduro dorado). El motor muestra solo una.
* Muro: `wall_post` = pilar/torreón en el centro de la casilla (1×1, ~0.95–1.1 de alto, almenas);
  `wall_seg` = tramo desde el centro (x=0) hasta el borde +X (x=0.5), grosor 0.36–0.45, alto
  ~0.85, con almenas. El motor gira el tramo hacia cada vecino; deben encajar sin huecos.
* Puerta `gate` (1×1): el muro corre a lo largo de X (empalma con tramos en x = ±0.5) y el paso
  es a lo largo de Z. Pieza 0 = marco/torres; pieza 1 = hojas cerradas; pieza 2 = hojas abiertas.
* Andamios y escombros los hace el autor de naturaleza (ver abajo).

## 6. Naturaleza, recursos y proyectiles

* Árboles `tree_oak, tree_pine, tree_snowpine, tree_birch, tree_palm, tree_willow, tree_dead,
  tree_elder (gigante: árbol anciano enorme)`: `variants: 3`, `tints: [...]` (colores de copa;
  el motor elige uno por árbol) y copa con `color: 'tint'`. Pieza 1 = capa de nieve (se ve en
  terreno nevado). `wave` proporcional a la altura. Tronco con base algo ensanchada.
* `stump` tocón. Minas `mine_gold, mine_stone, mine_iron, mine_gems` (rocas con vetas; oro y
  gemas con `glow` suave): pieza 0 = roca base; pieza 1 = trozos extra (se ven con > 66 % de
  recurso), pieza 2 = más trozos (> 33 %). `bush_berry`: pieza 1 = bayas (se ven si queda comida).
  `fish_spot`: peces que asoman/ondas (puede usar `spin`).
* Decoración (pequeña, ≤ 12 primitivas): `decor_flowers` (variants 4), `decor_grass_tuft`
  (variants 2, `wave`), `decor_rock_small` (variants 3), `decor_rock_big`, `decor_mushroom`
  (variants 2), `decor_reeds` (`wave`), `decor_bones`, `decor_snowrock`, `decor_ruin_pillar`,
  `decor_signpost`, `decor_campfire` (llama con `glow`).
* Tesoros: `treasure_chest` (pieza 1 = tapa cerrada, pieza 2 = abierta), `treasure_gold_pile`,
  `treasure_relic` (objeto místico con `glow` y `spin`).
* `scaffold_1 … scaffold_4`: andamio para una huella de fp casillas y **1.0 de alto** (el motor lo
  estira en Y hasta la altura del edificio): postes, tablones, escalera. `rubble_1 … rubble_4`:
  montón de escombros quemados para cada huella.
* Proyectiles (centrados en el origen, apuntando a +Z): `proj_arrow, proj_bolt, proj_axe (gira),
  proj_rock, proj_cannonball, proj_magic (orbe con glow), proj_frost (esquirla de hielo con
  glow), proj_lightning (rayo corto con glow)`. Tamaño: flecha ~0.3 de largo; roca ~0.12 de radio.

## 7. Cómo trabajar

1. Edita **solo tu archivo** de `src/render/three/art/` (y, si lo necesitas, un archivo auxiliar
   propio con tu prefijo). Exporta `export const MODELS = { clave: definición, ... }`.
2. Compila: `npx vite build --outDir <tu carpeta>/dist` (desde `pixel-empires/`).
3. Visor: `node tools/viewer_shot.cjs <tu carpeta>/dist/index.html salida.png "viewer=keys&keys=a,b,c&anim=idle&zoom=1.4&yaw=30"`.
   Parámetros: `viewer=units|buildings|nature|keys`, `filter=prefijo`, `keys=lista`,
   `anim=idle|walk|attack|work|die`, `work=chop|mine|build|farm|gather`, `carry=wood|gold|...`,
   `t=0.4` (congela el tiempo; en `attack` k = (t % 1.2)/1.2, golpe en t≈0.6), `yaw` (grados),
   `pitch` (20 = vista lateral, 52 = la del juego), `zoom`, `cols`, `team=0..7|all`, `mask=2`
   (piezas opcionales), `snow=1`. Las etiquetas en rojo indican modelo genérico (falta el tuyo).
4. Revisa cada modelo desde la cámara del juego (pitch 52) **y** de lado (pitch 20) y en
   `anim=walk` y `anim=attack` (t = 0.45 y 0.62): nada debe atravesarse ni separarse.
5. La consola debe quedar limpia (`SIN ERRORES`).
