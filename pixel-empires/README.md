# Pixel Empires

Juego de estrategia en tiempo real al estilo Age of Empires, con gráficos pixel art generados por código. Todo cabe en un solo archivo HTML, sin dependencias externas salvo las fuentes.

**Jugar:** abre `index.html` en el navegador. Funciona en escritorio (ratón y teclado) y en móvil (pantalla táctil, en horizontal o vertical).

## Qué incluye

- **5 razas con estilo propio:** Humanos, Elfos, Enanos, Orcos y Gigantes. Cada raza tiene 8 unidades (aldeano, infantería, antimontura, tirador, montada, especial, asedio y general), 17 edificios y bonificaciones propias.
- **Generales únicos:** solo puede existir uno por jugador. Cada uno tiene un aura que refuerza a los aliados cercanos y una habilidad especial que lanza solo en combate.
  - Rey Paladín: Bendición.
  - Reina del Bosque: Lluvia de flechas.
  - Rey de la Montaña: Martillo sísmico.
  - Caudillo: Grito de guerra.
  - Rey Titán: Pisotón.
- **Experiencia y niveles:** las unidades militares acumulan XP *pendiente* al dañar y derrotar enemigos, y solo la ganan si **sobreviven al enfrentamiento** (5 s sin combatir).
  - Subir de nivel es progresivo: el nivel 2 pide 100 XP, el 3 260, el 4 480 y el 5 800.
  - Cada nivel da +10 % de vida y +8 % de ataque. Desde el nivel 3 suma armadura y desde el 4 regenera vida.
  - Una insignia sobre la cabeza indica el nivel: bronce, plata, oro y estrella rubí.
- **Economía:** comida, madera, oro, piedra y hierro.
  - Fuentes de comida: bayas, granjas que se resiembran, ganado (ovejas, cerdos, vacas, gallinas), caza (ciervos, jabalíes, osos, caballos salvajes) y pesca.
  - Minas de oro, piedra, hierro y vetas de gemas.
  - Mercado con precios dinámicos.
- **Eras y tecnologías:** 3 eras y unas 20 mejoras, entre ellas una tecnología única por raza.
- **Defensa:** torres de arqueros, muros que se trazan arrastrando, puertas que solo abren a aliados y guarnición en centro urbano, torres y castillo (cada unidad dentro dispara una flecha más). La campana de alarma refugia a los aldeanos.
- **Mundo vivo:**
  - Niebla de guerra y caminos que aceleran el movimiento.
  - Campamentos de bandidos y chozas goblin que lanzan incursiones.
  - Un santuario custodiado por un ogro, cofres, reliquias (dan oro constante) y fauna hostil.
  - Clima con efecto en el juego: lluvia, niebla, nieve y tormentas con rayos.
  - Desastres: incendios forestales, terremotos, plagas de langostas e invasiones de monstruos.
- **Diplomacia** con hasta 5 reinos rivales: alianzas, paz, guerra, tributos, relaciones y exigencias. Los aliados comparten visión y se defienden entre sí. Las IAs también negocian entre ellas.
- **IA:** reparte aldeanos, construye, avanza de era, investiga, entrena ejércitos mixtos, se defiende, ataca en oleadas, usa el mercado y la campana, y apoya a sus aliados.
- **Audio:** efectos con ZzFX y música medieval procedural en modo dórico, con dos temas: paz y batalla.
- **Galería de diseños:** desde el menú puedes ver todas las unidades animadas (quieto, caminar, atacar) y todos los edificios de cada raza.
- **Modo observador:** en la configuración puedes marcar «Solo observar» para ver a las IAs jugar entre sí con el mapa revelado.

## Controles

**Móvil:** tocar para seleccionar y, con algo seleccionado, tocar el destino u objetivo para ordenar. Arrastrar mueve la cámara, pellizcar o los botones + y − hacen zoom, y mantener pulsado y arrastrar selecciona varias unidades. Para construir se toca el lugar y se pulsa «Construir». En horizontal el panel pasa a una columna lateral para dejar toda la altura al mapa.

**Escritorio:**

| Acción | Control |
|---|---|
| Seleccionar | Clic o arrastrar; doble clic para todas las del mismo tipo en pantalla |
| Ordenar | Clic derecho: mover, atacar, recolectar, construir, reparar, cazar, recoger tesoros, entrar en guarnición |
| Cámara | Flechas, bordes de la pantalla, botón central; rueda o botones + y − para el zoom |
| Grupos | Ctrl + 1–9 para crear, 1–9 para seleccionar (doble pulsación centra la cámara) |
| Atajos | H centro urbano · . aldeano inactivo · M todo el ejército · A atacar moviéndose · S detener · Supr eliminar · P o Esc pausa |
| Panel de comandos | Q W E R T / A S D F G / Z X C V B |

## Proporciones

El entorno (terreno, árboles, minas y edificios) se dibuja al doble de resolución que los personajes con el mismo código de arte: el núcleo evalúa las formas a nivel de subpíxel (`SCanvasScaled` en `src/01_sprite.js`), así que las curvas y los contornos quedan finos y del mismo tamaño de píxel que las unidades. Una casa mide unas tres veces la altura de un aldeano.

## Estructura

Proyecto Vite con módulos ES. `npm run build` genera `dist/index.html` y la copia `Pixel Empires.html`: un único archivo autocontenido que se abre con doble clic.

```
index.html                 estructura de la interfaz (plantilla de Vite)
src/main.js                arranque, pantalla inicial, galería y bucle (simulación 30 Hz + render)
src/data/data.js           razas, unidades, edificios, tecnologías, niveles
src/map/map.js             generación de mapas
src/sim/path.js            A* y rejilla espacial
src/sim/game.js            simulación (combate, experiencia, economía, producción, guarnición)
src/ai/ai.js               IA rival
src/world/world.js         niebla, clima, fuego, desastres, campamentos, tesoros, fauna
src/world/diplo.js         diplomacia
src/render/pixel/          render 2D actual y arte por código (se reemplaza por 3D)
src/ui/ui.js, styles.css   interfaz
src/input/input.js         ratón, teclado y gestos táctiles
src/audio/audio.js, zzfx.js  sonido (ZzFX, MIT) y música procedural
tools/                     pruebas automáticas con Playwright (partidas, paridad, móvil, capturas)
```

Pruebas: `node tools/test_game.cjs 30 --obs --players=5` (simula 30 minutos), `node tools/play_test.cjs` (ratón y teclado), `node tools/mobile_test.cjs` (gestos táctiles) y `node tools/parity.cjs a.html b.html` (compara dos builds con aleatoriedad determinista).

## Referencias

- Fórmula de daño y armaduras inspirada en Age of Empires II: [guía de cálculo de daño](https://divy1211.github.io/AoE2DE_UGC_Guide/general/damage_calculation/) y la [documentación de openage](https://simonsan.github.io/openage-webdocs/sphinx/doc/reverse_engineering/game_mechanics/damage.html).
- Sistema de veteranía: [Wayward Strategy, «Killing for that promotion»](https://waywardstrategy.com/2020/11/05/killing-for-that-promotion-veterancy-systems-in-rts/).
- Técnica de pixel art: [Lospec](https://lospec.com/articles/category:articles), [GameDev.net: Color Palettes](https://www.gamedev.net/articles/visual-arts/color-palettes-r4964/) y la [guía de estilo LPC](https://lpc.opengameart.org/static/LPC-Style-Guide/build/styleguide.html).
- Sonido: [ZzFX](https://github.com/KilledByAPixel/ZzFX), de Frank Force (licencia MIT).
