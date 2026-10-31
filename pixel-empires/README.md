# Pixel Empires

Juego de estrategia en tiempo real al estilo Age of Empires, con gráficos pixel art generados por código. Todo cabe en un solo archivo HTML, sin dependencias externas salvo las fuentes.

**Jugar:** abre `index.html` en el navegador (Chrome, Edge o Firefox de escritorio).

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

## Controles

| Acción | Control |
|---|---|
| Seleccionar | Clic o arrastrar; doble clic para todas las del mismo tipo en pantalla |
| Ordenar | Clic derecho: mover, atacar, recolectar, construir, reparar, cazar, recoger tesoros, entrar en guarnición |
| Cámara | Flechas, bordes de la pantalla, botón central; rueda para el zoom |
| Grupos | Ctrl + 1–9 para crear, 1–9 para seleccionar (doble pulsación centra la cámara) |
| Atajos | H centro urbano · . aldeano inactivo · M todo el ejército · A atacar moviéndose · S detener · Supr eliminar · P o Esc pausa |
| Panel de comandos | Q W E R T / A S D F G / Z X C V B |

## Estructura

```
src/01_sprite.js          núcleo de sprites: rampas de color con cambio de matiz, contorno selectivo, poses
src/02_vendor_zzfx.js     ZzFX (MIT) — https://github.com/KilledByAPixel/ZzFX
src/10..14_art_*.js       arte por código: unidades, edificios, naturaleza, fauna, efectos e íconos
src/20_data.js            razas, unidades, edificios, tecnologías, niveles
src/30_map.js             generación de mapas
src/31_path.js            A* y rejilla espacial
src/40_game.js            simulación (combate, experiencia, economía, producción, guarnición)
src/41_ai.js              IA
src/42_world.js           niebla, clima, fuego, desastres, campamentos, tesoros, fauna
src/43_diplo.js           diplomacia
src/50_render.js          render
src/51_ui.js · 52_input.js · 53_audio.js · 60_main.js
tools/build.py            genera index.html y dist/artifact.html
tools/artsheet.js         hoja de contacto del arte (Playwright)
tools/test_game.js        simulación automática de partidas para pruebas y balance
ART_SPEC.md               contrato de los módulos de arte
```

Para regenerar el juego: `python3 tools/build.py`. Pruebas: `node tools/test_game.js 30 --obs --players=5` (simula 30 minutos con 5 IAs).

## Referencias

- Fórmula de daño y armaduras inspirada en Age of Empires II: [guía de cálculo de daño](https://divy1211.github.io/AoE2DE_UGC_Guide/general/damage_calculation/) y la [documentación de openage](https://simonsan.github.io/openage-webdocs/sphinx/doc/reverse_engineering/game_mechanics/damage.html).
- Sistema de veteranía: [Wayward Strategy, «Killing for that promotion»](https://waywardstrategy.com/2020/11/05/killing-for-that-promotion-veterancy-systems-in-rts/).
- Técnica de pixel art: [Lospec](https://lospec.com/articles/category:articles), [GameDev.net: Color Palettes](https://www.gamedev.net/articles/visual-arts/color-palettes-r4964/) y la [guía de estilo LPC](https://lpc.opengameart.org/static/LPC-Style-Guide/build/styleguide.html).
- Sonido: [ZzFX](https://github.com/KilledByAPixel/ZzFX), de Frank Force (licencia MIT).
