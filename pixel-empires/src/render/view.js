/* =====================================================================
   Puente entre el juego (entrada, interfaz, audio y bucle) y el render
   activo. Cada render (pixel 2D o 3D) implementa el mismo contrato:
     init, resize, onGameStart, frame(dt, alpha), terrainChanged(tx, ty)
     screenToWorld(cx, cy)         punto del suelo bajo el puntero (px de mundo)
     worldPerCss()                 px de mundo por px CSS cerca del centro
     viewWorldSize()               tamaño aproximado del suelo visible
     zoomStep(dir, cx, cy), pinchBegin(), pinchUpdate(ratio, cx, cy), zoomState()
     pick(w, css)                  entidad bajo el puntero
     unitsInScreenRect(d)          unidades propias dentro de una caja de pantalla
     isOnScreen(u), drawMinimapView(ctx)
   ===================================================================== */
import { G } from '../sim/game.js';

const RV = { impl: null, kind: '' };
function setRenderer(impl) { RV.impl = impl; RV.kind = impl.kind; }
const teamColorIdx = t => t >= 0 && t < 8 && G.players[t] ? G.players[t].color : 6;
const screenToWorld = (cx, cy) => RV.impl.screenToWorld(cx, cy);
const worldPerCss = () => RV.impl.worldPerCss();
const viewWorldSize = () => RV.impl.viewWorldSize();

export { RV, setRenderer, teamColorIdx, screenToWorld, worldPerCss, viewWorldSize };
