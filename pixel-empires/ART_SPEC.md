# Pixel Empires — Especificación de arte (contrato para los módulos de arte)

Todo el arte del juego se genera por código en el navegador con el núcleo `src/01_sprite.js`.
Cada módulo de arte es un archivo JS que **solo registra definiciones** en `PE.ART` (no ejecuta nada más).
El motor pide frames con `PE.frame(kind, key, f, opts)` y los guarda en caché.

## 1. API del núcleo (leer `src/01_sprite.js`)

```js
const c = new PE.SCanvas(w, h);             // rejilla de materiales (no colores)
c.px(m, x, y)                               // m = 'steel' | 'steel.0'..'steel.3' (fuerza tono) | 'team' | null (borra)
c.rect(m, x0, y0, x1, y1)                   // inclusivo
c.ell(m, cx, cy, rx, ry)                    // elipse rellena (centro en coordenadas de píxel, usa .5 para centrar)
c.ring(m, cx, cy, rx, ry, inner, filter?)   // anillo: distancia normalizada en (inner, 1]; filter(x,y) opcional
c.poly(m, [[x,y], ...])                     // polígono relleno
c.line(m, x0, y0, x1, y1)                   // Bresenham
c.rim((t, m) => t.rect(m, ...), 'blade')    // forma con contorno interior oscuro de 1 px (armas delante del cuerpo)
c.at(dx, dy, () => { ... })                 // desplaza todo lo dibujado dentro (partes móviles)
c.glow(x, y, alpha, '#hex')                 // halo semitransparente sobre fondo vacío
c.dither(m, x0, y0, x1, y1, parity, onlyOn?)
PE.addMats({ elf_leaf: '#4f9a4a' })         // registrar materiales nuevos (PREFIJA con tu módulo)
PE.addFixed({ elf_glow: '#b8ff8acc' })      // colores fijos (sin sombreado), admite alfa #rrggbbaa
PE.addEmissive('elf_glow2')                 // materiales que siempre se ven brillantes
```

El render (`PE.render`) hace automáticamente:
* rampa de 4 tonos con cambio de matiz por material,
* luz arriba-izquierda: borde superior/izquierdo claro, inferior/derecho oscuro, volumen cilíndrico,
* contorno selectivo de 1 px alrededor de la figura (`render: {outline:false}` para desactivarlo),
* sombra de suelo para unidades (`render: {shadow: {...}}` para ajustarla, `false` para quitarla),
* el material `'team'` se reemplaza por el color del jugador.

Materiales base disponibles: ver `PE.MATS` y `PE.FIXED` en el núcleo (skin, hair, steel, blade, gold, leather,
wood, cloth, pants, straw, robe, hat, beard, hood, cloak, tunic, sack, orb, feather, stone, brick, plaster, roof,
thatch, darkwood, iron, copper, bone, fur, leaf, moss, water, snow, ice, elfskin, elfhair, silver, orcskin,
orcskin2, giantskin, frostskin, rune, fire, red, purple, grass, dirt, sand, rock; fijos: eye, ol, string, white,
mouth, black, glowY, glowC, glowG, glowR, window).

Tono forzado: `'stone.0'` = sombra, `'.1'` base, `'.2'` luz, `'.3'` brillo. Úsalo para ladrillos, vetas,
juntas, detalles. Las zonas con tono forzado cuentan como el mismo material para el sombreado automático.

**Ejemplo de referencia completo:** `tools/example_unit.js` (guerrero humano con idle/walk/attack).
Diseños originales en Python: `tools/make_sprites.py` (aldeano, guerrero, mago, arquero).

## 2. Unidades (`PE.ART.units[key]`)

```js
PE.ART.units.human_inf = {
  w: 32, h: 32, ax: 16, ay: 29,      // ancla = punto entre los pies (se ubica en la posición de la unidad)
  draw(c, P, o) { ... },             // P = pose, o = opciones
  render: { shadow: { cx: 16, cy: 30, rx: 7 } },   // opcional
};
```

Pose `P` (ver `PE.ANIMS` en el núcleo): `body` (0 arriba, 1 abajo), `ll`/`lr` (elevación de pies, negativo
arriba), `s` (balanceo de brazos -1..1), `sw` (vaivén de telas -1..1), `sec` (inercia secundaria: penachos,
sombreros, colas, orejas), `glow` (0..2 pulso), `atk` (0 reposo, 1 preparación, 2 golpe/disparo, 3
seguimiento), `t` (índice de frame), `anim` ('idle' 4 frames, 'walk' 8 frames, 'attack' 4 frames).
'work' usa los mismos frames que 'attack' (aldeanos: talar, minar, construir).

Opciones `o`: `o.carry` para trabajadores ('wood' | 'food' | 'gold' | 'stone' | 'iron' | undefined) — dibuja
el bulto que lleva (troncos al hombro, saco, cesta, piedra) cuando está definido. `o.dead` solo para animales.

Requisitos de animación:
* **idle**: respiración (body), detalles secundarios (`sec`, `glow`).
* **walk**: pies alternados (`ll`, `lr`), caída del cuerpo, brazos y armas en contrafase (`s`), telas (`sw`),
  inercia (`sec`). Los personajes miran de frente / 3⁄4; el motor los voltea horizontalmente según dirección.
* **attack**: el arma debe moverse de forma clara: preparación (atk 1), golpe o disparo (atk 2, aquí el motor
  lanza el proyectil), seguimiento (atk 3), vuelta (atk 0). Arqueros tensan la cuerda; magos alzan el báculo con
  brillo; asedio mueve el brazo / retrocede el cañón.
* El reposo (`P` en cero) es el punto más alto: nada debe salirse del lienzo cuando body = 1 o atk mueve armas.

Tamaños de lienzo y proporciones (centro x = 15.5, pies en y = 29 en 32×32):

| Tipo | Lienzo | Ancla | Notas |
|---|---|---|---|
| Humanoide normal (humano, elfo, enano, orco, neutrales) | 32×32 | 16,29 | |
| Gigante | 40×40 | 20,37 | Todos los gigantes, incluido su trabajador |
| Montado (caballería, jinetes) y asedio | 40×32 (mamut 48×40) | 20,29 (mamut 24,37) | Vista 3⁄4 de perfil mirando a la DERECHA |

Proporciones por raza (32×32):
* **Humano**: cabeza centro y≈10 r≈5, torso y14–24, piernas y22–29. Piel `skin`.
* **Elfo**: más esbelto y alto: cabeza y≈8.5 r≈4.5, orejas en punta, torso estrecho (x12–19) y13–22,
  piernas largas y21–29. Piel `elfskin`, pelo `elfhair`/plata, verdes de hoja, plata, blanco, detalles dorados.
* **Enano**: bajo y ancho: cabeza grande centro y≈12 r≈5, barba enorme (rojiza/castaña/gris) y14–22, torso
  ancho x9–22 y15–25, piernas cortas y25–29. Acero pesado, oro, runas `rune` brillantes, cuero.
* **Orco**: encorvado y fornido: cabeza baja (y≈11) mandíbula ancha con colmillos `bone`, hombros muy anchos
  (x7–24), torso y14–25. Piel `orcskin`, hierro oscuro `iron`, huesos, pintura de guerra roja, pinchos, pieles.
* **Gigante** (40×40): cabeza y7–15, torso enorme y15–30, piernas y30–37. Piel `giantskin` (o `frostskin`),
  pieles `fur`, madera tosca, piedra, cuerdas. Siluetas pesadas y lentas.

Colores de equipo: cada unidad debe llevar una zona visible del material `'team'` (tabardo, capa, cinta,
penacho, escudo, estandarte). El general lleva más color de equipo, capa y adornos dorados.

### Lista de unidades (clave = `<raza>_<rol>`)

Razas: `human`, `elf`, `dwarf`, `orc`, `giant`. Roles: `worker`, `inf`, `pike`, `ranged`, `cav`, `special`, `siege`, `general`.

| Clave | Nombre | Concepto visual |
|---|---|---|
| human_worker | Aldeano | (existe) sombrero de paja, túnica clara, hacha/herramienta |
| human_inf | Espadachín | (existe) casco con penacho, peto, escudo redondo, espada |
| human_pike | Lancero | casco abierto, gambesón con tabardo, pica larga vertical (punta sobresale arriba) |
| human_ranged | Arquero | (existe) capucha verde, arco largo, carcaj |
| human_cav | Caballero | jinete con armadura y lanza sobre caballo con gualdrapa del equipo (40×32) |
| human_special | Mago | (existe) sombrero puntiagudo, barba, bastón con orbe |
| human_siege | Catapulta | catapulta de madera con ruedas y brazo, sin tripulante o con uno (40×32) |
| human_general | Rey Paladín | corona sobre yelmo, armadura dorada y plateada, capa del equipo larga, espada grande, aura |
| elf_worker | Recolector élfico | túnica verde clara, capucha corta, hoz/cesta |
| elf_inf | Danzante de espadas | ágil, dos espadas curvas, armadura ligera de hojas plateadas |
| elf_pike | Guardián del bosque | guja élfica (hoja curva en asta larga), yelmo alado plateado |
| elf_ranged | Arquero élfico | arco largo curvo élfico, capa con hojas, pelo largo |
| elf_cav | Jinete de ciervo | elfo arquero montado en ciervo blanco con astas grandes (40×32) |
| elf_special | Druida | báculo de raíz con flores/brillo verde, túnica de hojas, corona de ramas |
| elf_siege | Lanzavirotes | balista élfica curva de madera clara con virote (40×32) |
| elf_general | Reina del Bosque | corona de hojas doradas, arco dorado, capa larga del equipo, brillo |
| dwarf_worker | Minero | casco con vela/lámpara, barba, pico |
| dwarf_inf | Hachero | yelmo con cuernos cortos, armadura pesada, hacha grande de dos manos |
| dwarf_pike | Alabardero | escudo torre rectangular y alabarda |
| dwarf_ranged | Ballestero | ballesta pesada, yelmo cerrado, barba trenzada |
| dwarf_cav | Jinete de carnero | enano sobre un carnero de montaña con cuernos curvos (40×32) |
| dwarf_special | Atronador | trabuco/arcabuz con fogonazo en el ataque, mochila de pólvora |
| dwarf_siege | Bombarda | cañón de bronce sobre cureña (40×32), fogonazo al disparar |
| dwarf_general | Rey de la Montaña | corona-yelmo dorada, barba trenzada blanca, martillo de guerra rúnico brillante, capa |
| orc_worker | Peón orco | taparrabo, saco, pico/hacha tosca, pelado |
| orc_inf | Bruto | hombreras con pinchos, cuchilla enorme |
| orc_pike | Lancero salvaje | lanza con punta de hueso, escudo de piel, pintura de guerra |
| orc_ranged | Lanzahachas | hachas arrojadizas en el cinto, brazo que lanza |
| orc_cav | Jinete de lobo | orco sobre lobo gigante gris (40×32) |
| orc_special | Chamán | máscara de hueso, bastón con calavera y relámpagos, plumas |
| orc_siege | Ariete | tronco con cabeza de metal colgando en un armazón con techo de pieles y ruedas (40×32) |
| orc_general | Caudillo | yelmo con grandes cuernos, hacha doble, pieles, estandarte del equipo a la espalda |
| giant_worker | Recolector gigante | 40×40, cesta enorme a la espalda, garrote pequeño |
| giant_inf | Guerrero gigante | 40×40, garrote de tronco con clavos, pieles |
| giant_pike | Muro de piedra | 40×40, escudo hecho de una losa de piedra, armadura de rocas |
| giant_ranged | Lanzarrocas | 40×40, levanta una roca sobre la cabeza y la lanza |
| giant_cav | Mamut de guerra | 48×40, mamut con colmillos y howdah con jinete gigante |
| giant_special | Gigante de escarcha | 40×40, piel `frostskin`, carámbanos, aliento helado (brillo celeste) |
| giant_siege | Rompemuros | 40×40, gigante que carga un tronco como ariete |
| giant_general | Rey Titán | 40×40, el más grande, corona de piedra y oro, maza enorme, capa, ojos brillantes |
| neutral_bandit | Bandido | capucha y pañuelo, espada corta, ropa harapienta (sin color de equipo obligatorio) |
| neutral_bandit_archer | Bandido arquero | arco corto |
| neutral_goblin | Goblin | pequeño, verde pálido, daga, orejas grandes |
| neutral_ogre | Ogro | 40×40, jefe que custodia tesoros, maza, barriga |

## 3. Edificios (`PE.ART.buildings[key]`)

```js
PE.ART.buildings.human_house = { w: 32, h: 48, frames: 4, draw(c, f, o) { ... } };
```
* `w` = huella × 16 exacto. La fila inferior del sprite coincide con el borde inferior de la huella.
  `h` es libre (techos, torres): huella×16 + hasta 48 px.
* `frames: 4` de animación en bucle (banderas ondeando, humo de chimenea, aspas de molino, antorchas, runas
  que pulsan, agua). El motor reproduce a ~4 fps con desfase aleatorio.
* Vista 3⁄4 frontal: se ve la fachada sur y el techo. Base con borde/sombra en el suelo.
* Debe tener material `'team'` visible (banderas, toldos, tejados, estandartes).

Huellas (tiles de 16 px): `tc` 4, `house` 2, `barracks` 3, `range` 3, `stable` 3, `workshop` 3, `temple` 3,
`forge` 2, `market` 3, `tower` 2 (alta, h hasta 80), `castle` 4 (h hasta 112), `mill` 2, `lumber` 2, `mine` 2,
`farm` 3 (plana), `wall` 1, `gate` 1.

Claves `<raza>_<tipo>` para las 5 razas y los 17 tipos. Elementos identificativos por tipo:
tc (centro urbano grande, campana/bandera), house, barracks (armas cruzadas, maniquí), range (diana, flechas),
stable (herradura, heno, puertas de establo), workshop (grúa, engranajes, troncos), temple (altar, vitrales,
brillo), forge (yunque, chimenea con humo y brasas), market (puestos con toldos, barriles), tower (torre de
arqueros alta con almenas), castle (fortaleza con torres y estandartes), mill (molino de viento o rueda),
lumber (troncos apilados, sierra), mine (entrada de mina con vigas y vagoneta), farm (cultivo; `frames: 4` =
etapas de crecimiento 0 sembrado → 3 maduro, el motor elige la etapa, no anima), wall (`masks: true`: dibuja
según `o.mask` bits 1=N 2=E 4=S 8=O de muros vecinos; un poste si mask=0), gate (`masks: true`, `frames: 2`:
0 cerrada, 1 abierta; orientación horizontal si mask tiene E u O, vertical si N o S).

Estilos por raza:
* **Humanos**: piedra clara y entramado de madera, tejados de teja del equipo o paja, estandartes.
* **Elfos**: madera viva y curva, tejados de hojas/pétalos, cristales verdes, lianas, formas orgánicas y altas.
* **Enanos**: piedra tallada pesada, puertas en la roca, oro y runas brillantes, chimeneas con humo, metal.
* **Orcos**: pieles sobre postes, empalizadas de troncos afilados, huesos, cráneos, pinchos de hierro, tótems.
* **Gigantes**: megalitos enormes, troncos gruesos, techos de pasto, piedras rúnicas, escala tosca y robusta.

Granjas por raza: humanos trigo, elfos viñas/bayas, enanos hongos, orcos calabazas, gigantes coles.

Neutrales: `neutral_bandit_camp` (3×3, tiendas raídas, fogata animada), `neutral_ruins` (2×2, columnas rotas),
`neutral_shrine` (2×2, santuario antiguo con brillo, custodia un tesoro), `neutral_goblin_hut` (2×2).

## 4. Naturaleza (`PE.ART.nature[key]`)

```js
PE.ART.nature.tree_oak = { w: 24, h: 32, ax: 12, ay: 31, frames: 4, variants: 3, draw(c, f, o) { /* o.v = variante */ } };
```
El ancla (ax, ay) se coloca en el centro del borde inferior de la tile. Variantes con `o.v`.

**Tiles de terreno** (16×16, deben ser perfectamente repetibles, `render: {shade:false, outline:false}`,
dibuja con tonos forzados `'grass.0'..'grass.3'` y detalles): `tile_grass` (4 variantes), `tile_grass_dark`
(2), `tile_dirt` (2), `tile_sand` (2), `tile_snow` (2), `tile_road` (2, adoquines/tierra apisonada),
`tile_rock` (2, montaña infranqueable), `tile_water` (frames 4: brillo/olas), `tile_shallow` (frames 4,
vadeable). `shore_foam` (masks: true, frames 4): superposición sobre una tile de agua; bits de `o.mask` =
lados con tierra (1=N 2=E 4=S 8=O); espuma/orilla de 2–3 px en esos lados. El motor mezcla los bordes entre
terrenos automáticamente.

**Árboles** (24×32 aprox., `frames: 4` balanceo con el viento sutil, 2–3 variantes): `tree_oak`, `tree_pine`,
`tree_birch`, `tree_palm`, `tree_willow`, `tree_snowpine`, `tree_dead`, `tree_elder` (árbol antiguo enorme
32×40 con brillo mágico). `stump` (16×16, tocón). **Minas** (16×20, frames 4 destello, 3 variantes):
`mine_gold`, `mine_stone`, `mine_iron`, `mine_gems` (cristales morados/azules). **Comida**: `bush_berry`
(16×16, variante 0 con bayas, 1 sin bayas), `fish_spot` (16×16 sobre agua, frames 4: ondas y pez saltando).
**Decoración** (pasable): `decor_flowers` (4 var.), `decor_rock_small` (3), `decor_rock_big` (2),
`decor_grass_tuft` (frames 4, 2 var.), `decor_mushroom` (2), `decor_bones`, `decor_ruin_pillar` (2),
`decor_signpost`, `decor_campfire` (frames 4), `decor_reeds` (frames 4, orilla), `decor_snowrock`.
**Tesoros**: `treasure_chest` (frames 4 destello; `o.open` abierto), `treasure_relic` (frames 4, artefacto
brillante), `treasure_gold_pile`. **Otros**: `rubble` (`sizes: [1,2,3,4]`, `o.size` tiles, w = size×16),
`scaffold` (`o.size`, andamio de construcción superpuesto, w = size×16, h = size×16+16), `scorch` (2 var.).

## 5. Fauna, efectos, proyectiles e íconos

**Animales** (`PE.ART.units`, mismo contrato que unidades, vista de perfil mirando a la DERECHA, animaciones
idle/walk/attack, `o.dead` dibuja el cadáver): `animal_sheep` (24×20), `animal_pig` (24×20), `animal_cow`
(32×24), `animal_chicken` (16×16), `animal_deer` (32×28), `animal_horse` (32×28), `animal_wolf` (32×24),
`animal_bear` (32×28), `animal_boar` (28×22). Anclas en los pies (centro abajo). Pon `dead: true` en la
definición si soportan `o.dead`.

**Efectos** (`PE.ART.fx`, ancla en el centro, `frames` se reproducen una vez salvo fuego): `fx_fire`
(frames 4, variantes 3 tamaños), `fx_smoke` (6), `fx_explosion` (6, 32×32), `fx_heal` (6), `fx_frost` (6),
`fx_lightning` (4, 16×48), `fx_magic` (6), `fx_levelup` (8, anillo de destellos dorados), `fx_dust` (4),
`fx_splash` (4), `fx_blood` (4), `fx_build` (4, polvo de construcción), `fx_stomp` (6, onda de choque).
**Proyectiles** (apuntan a la DERECHA; el motor los rota): `proj_arrow`, `proj_bolt`, `proj_rock` (frames 4),
`proj_axe` (frames 4 girando), `proj_cannonball`, `proj_fireball` (frames 4), `proj_magic` (frames 4),
`proj_spear`, `proj_lightning` (frames 2), `proj_frost` (frames 4).

**Íconos** (`PE.ART.icons`, `render: {shadow:false}`): 12×12 recursos y estadísticas: `icon_wood`,
`icon_food`, `icon_gold`, `icon_stone`, `icon_iron`, `icon_pop`, `icon_attack`, `icon_armor`, `icon_parmor`,
`icon_range`, `icon_speed`, `icon_hp`, `icon_xp`, `icon_time`. Insignias de nivel (sobre la cabeza de la
unidad, máx. 11×8): `badge_2`, `badge_3`, `badge_4`, `badge_5` (bronce 1 galón, plata 2 galones, oro 3
galones, estrella rubí con laureles). Comandos 16×16: `cmd_stop`, `cmd_attackmove`, `cmd_build`,
`cmd_repair`, `cmd_delete`, `cmd_rally`, `cmd_idle`, `cmd_ageup`, `cmd_trade`, `cmd_diplomacy`,
`cmd_back`, `cmd_ability`, `cmd_upg_melee`, `cmd_upg_ranged`, `cmd_upg_armor`, `cmd_upg_wood`,
`cmd_upg_mine`, `cmd_upg_farm`, `cmd_upg_loom`, `cmd_upg_walls`, `cmd_upg_heal`, `cmd_upg_unique`,
`cmd_upg_cav`, `cmd_upg_speed`, `cmd_road`, `cmd_wall`, `cmd_gate`.

## 6. Reglas de calidad

* Calidad profesional: siluetas claras y distintas por rol (prueba: ¿se reconoce en negro?), lectura a 1×.
* Nada de negro puro ni blanco puro grandes; el render ya pone el contorno.
* Evita ruido: áreas de color legibles, 1–2 detalles por zona, detalles con tonos forzados.
* Cada unidad: idle, walk y attack deben verse claramente distintos y fluidos.
* Prueba visual obligatoria: `node tools/artsheet.js tools/out/<tuarchivo>.png src/<tuarchivo>.js --scale=3`
  (opciones `--prefix=elf_`, `--kind=units`). Mira el PNG y corrige. Itera al menos 2–3 veces.
* Rendimiento: usa las primitivas; no hagas bucles por píxel de todo el lienzo dentro de `draw` salvo en tiles.
* Solo escribe en tu archivo asignado (y archivos temporales en `tools/out/`). No modifiques el núcleo.
