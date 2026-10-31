#!/usr/bin/env python3
"""Concatena src/*.js en un único HTML jugable.

Salidas:
  index.html            documento completo (abrir directamente en el navegador)
  dist/artifact.html    mismo juego sin <html>/<head>/<body> (para publicar como página)
"""
import glob, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

CSS = r"""
:root{
  /* Layout: lienzo a pantalla completa; barra superior y panel inferior de madera con borde dorado */
  --wood:#2a1d14;--wood2:#3a2a1c;--wood3:#4d3826;--gold:#c9a24a;--gold2:#ffd27a;--ink:#140f1f;
  --text:#f4e9c8;--mute:#cdb98e;--good:#8fff7a;--bad:#ff7a6a;--warn:#ffb070;--sel:#5a8ad8;
  --font:"Jersey 10","Courier New",monospace;--font-logo:"Silkscreen","Jersey 10",monospace;color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:#0a0812;color:var(--text);font:18px/1.25 var(--font);user-select:none;-webkit-user-select:none}
canvas#game{position:fixed;left:0;top:0;image-rendering:pixelated;cursor:crosshair}
[hidden]{display:none!important}
button{font:inherit;color:var(--text);background:var(--wood3);border:2px solid var(--gold);box-shadow:inset 0 -3px 0 rgba(0,0,0,.35),inset 0 2px 0 rgba(255,220,150,.15);padding:4px 10px;cursor:pointer}
button:hover{background:#5e4630}button:active{transform:translateY(1px)}
button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--gold2);outline-offset:2px}
select,input[type=range]{font:inherit;color:var(--text);background:var(--wood2);border:2px solid var(--gold);padding:2px 4px}
.panel{position:fixed;background:linear-gradient(var(--wood2),var(--wood));border:3px solid var(--gold);box-shadow:0 0 0 3px var(--ink),0 6px 20px rgba(0,0,0,.5)}
#top{left:8px;right:8px;top:8px;display:flex;align-items:center;gap:14px;padding:4px 10px;flex-wrap:wrap}
#resbar{display:flex;gap:14px;flex-wrap:wrap}
.res{display:flex;align-items:center;gap:5px;font-weight:400;font-variant-numeric:tabular-nums}
.res b{min-width:36px;color:#fff}.res b.lack{color:var(--bad)}
.ri{display:inline-block;width:24px;height:24px;background-size:contain;background-repeat:no-repeat;image-rendering:pixelated;vertical-align:middle}
.tinfo{display:flex;gap:14px;color:var(--mute);margin-left:auto}
#clock{font-variant-numeric:tabular-nums}
.tbtns{display:flex;gap:6px}.tbtns button{padding:2px 8px}.tbtns button.off{opacity:.5}.tbtns button.warn{color:var(--warn);border-color:var(--warn)}
#log{position:fixed;left:14px;top:58px;max-width:min(620px,70vw);pointer-events:none;text-shadow:1px 1px 0 #000,0 0 4px #000;font-size:18px;display:grid;gap:2px}
#proposals{position:fixed;right:14px;top:60px;display:grid;gap:8px;width:300px}
.toast{background:var(--wood2);border:2px solid var(--gold);padding:8px;box-shadow:0 0 0 2px var(--ink)}
.toast div{display:flex;gap:6px;margin-top:6px}
#bottom{left:8px;right:8px;bottom:8px;height:150px;display:flex;gap:10px;padding:8px}
#mini{width:134px;height:134px;flex:none;image-rendering:pixelated;border:2px solid var(--ink);background:#000;cursor:pointer}
#info{flex:1;min-width:0;overflow:hidden;font-size:17px;line-height:1.18}
.hint{color:var(--mute);line-height:1.5}.hint b{color:var(--text)}
.one{display:flex;gap:10px;align-items:flex-start}
.portrait{image-rendering:pixelated;background:rgba(0,0,0,.25);border:2px solid var(--wood3);padding:2px;flex:none;max-height:96px}
.otxt{min-width:0;flex:1}.nm{font-size:22px;font-weight:700;color:var(--gold2)}.sub{color:var(--mute)}.sub.gold{color:var(--gold2)}.warn{color:var(--warn)}
.lvl{font-size:13px;background:var(--gold);color:var(--ink);padding:0 6px;margin-left:4px}
.hpline{display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
.hpb{display:inline-block;width:24px;height:4px;background:#2a0a0a;position:relative}.hpb>i{position:absolute;inset:0 auto 0 0;background:#5fd35a}
.hpb.big{width:160px;height:8px;border:1px solid var(--ink)}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin:2px 0}.st{display:flex;align-items:center;gap:3px;font-variant-numeric:tabular-nums}
.si{display:inline-block;width:18px;height:18px;background-size:contain;background-repeat:no-repeat;image-rendering:pixelated}
.xp{display:flex;align-items:center;gap:8px;font-size:13px}.xpb{display:inline-block;width:160px;height:8px;background:#1a1430;border:1px solid var(--ink);position:relative}
.xpb>i{position:absolute;top:0;bottom:0;left:0;background:linear-gradient(90deg,#c98a2a,#ffd23a)}.xpb>i.pend{background:repeating-linear-gradient(90deg,rgba(255,210,58,.45) 0 3px,transparent 3px 5px)}
.pxp{color:var(--gold2)}
.multi{display:flex;flex-wrap:wrap;gap:3px;max-height:132px;overflow:hidden}
.mcell{position:relative;width:34px;height:34px;background:rgba(0,0,0,.3);border:1px solid var(--wood3);display:grid;place-items:center;cursor:pointer}
.mcell .hpb{position:absolute;left:3px;right:3px;bottom:2px;width:auto;height:3px}.mcell .lv{position:absolute;right:1px;top:0;font-size:11px;color:var(--gold2);font-style:normal}
.mico,.qi,.cico,.ico{image-rendering:pixelated}
.queue{display:grid;grid-template-columns:repeat(3,30px);gap:4px 4px;flex:none;align-content:start;margin-left:auto}.qcell{position:relative;width:30px;height:30px;background:rgba(0,0,0,.3);border:1px solid var(--wood3);display:grid;place-items:center;cursor:pointer}
.qp{position:absolute;left:0;right:0;bottom:-6px;height:4px;background:#111}.qp i{position:absolute;inset:0 auto 0 0;background:#8ab4ff}
#cmds{flex:none;display:grid;grid-template-columns:repeat(5,44px);grid-auto-rows:42px;gap:4px;align-content:start}
.cmd{position:relative;width:44px;height:42px;padding:0;display:grid;place-items:center;background:var(--wood3)}
.cmd.empty{background:rgba(0,0,0,.2);border-color:#5a4630;box-shadow:none;cursor:default}
.cmd em{position:absolute;right:2px;bottom:-1px;font-size:13px;font-style:normal;color:var(--gold2);text-shadow:1px 1px 0 #000}
.cmd.lack{filter:saturate(.4) brightness(.8)}.cmd.lack em{color:var(--bad)}.cmd.locked{filter:grayscale(1) brightness(.6)}
.cico{max-width:36px;max-height:36px}
#tip{position:fixed;z-index:20;max-width:320px;background:var(--wood);border:2px solid var(--gold);padding:8px;box-shadow:0 0 0 2px var(--ink);font-size:17px;pointer-events:none}
#tip .d{color:var(--mute);margin-top:4px}#tip .hk{color:var(--gold2)}
.cost{display:inline-flex;align-items:center;gap:2px;margin-right:6px;font-variant-numeric:tabular-nums}.cost .ri{width:18px;height:18px}.cost.lack{color:var(--bad)}
#modal{position:fixed;inset:0;z-index:30;background:rgba(8,5,14,.72);display:grid;place-items:center;padding:16px}
.mbox{background:linear-gradient(var(--wood2),var(--wood));border:3px solid var(--gold);box-shadow:0 0 0 3px var(--ink);padding:18px 22px;max-width:min(1100px,96vw);max-height:92vh;overflow:auto}
.mbox h2{margin:0 0 8px;font-size:28px;color:var(--gold2);text-wrap:balance}.mbox h2.win{color:#ffe46a}.mbox h2.lose{color:var(--bad)}
.mbox h3{color:var(--gold2);margin:14px 0 6px}.lead{color:var(--mute);max-width:70ch;margin:0 0 10px}
.mrow{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.menu{display:grid;gap:8px;min-width:260px}.menu button{font-size:18px;padding:8px}
.vol{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;margin-top:14px}
.help{max-width:72ch;color:var(--mute)}.help b{color:var(--text)}.help li{margin:4px 0}
table.dip,table.stats-t{border-collapse:collapse;width:100%}table.dip td,table.stats-t td,table.stats-t th{padding:6px 8px;border-bottom:1px solid var(--wood3);text-align:left;vertical-align:middle}
table.stats-t th{color:var(--gold2);font-weight:600}tr.dead{opacity:.45}
.sw{display:inline-block;width:14px;height:14px;border:2px solid var(--ink);vertical-align:middle}
.stance{display:flex;gap:3px}.stance button{padding:2px 6px;font-size:13px}.stance button.on.ally{background:#2f6a2a}.stance button.on.neutral{background:#6a5a2a}.stance button.on.enemy{background:#7a2a22}
.relbar{position:relative;width:120px;height:8px;background:linear-gradient(90deg,#a03028,#6a5a2a,#2f8a2a);border:1px solid var(--ink)}.relbar i{position:absolute;top:-3px;width:3px;height:14px;background:#fff;transform:translateX(-1px)}
.trib{display:flex;gap:3px;flex-wrap:wrap}.trib button{padding:1px 4px;font-size:12px;display:flex;align-items:center;gap:2px}.trib .ri{width:16px;height:16px}
/* configuración */
#setup{position:fixed;inset:0;overflow:auto;background:radial-gradient(ellipse at 50% 0%,#3a2a4a,#120c1c 70%);padding-block:24px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.swrap{max-width:1180px;margin:0 auto;display:grid;gap:18px}
.logo{font-family:var(--font-logo);font-weight:700;font-size:clamp(36px,6.5vw,72px);margin:0;color:var(--gold2);text-shadow:4px 4px 0 #6b2d0a,8px 8px 0 rgba(0,0,0,.4);letter-spacing:3px;line-height:1}
.tag{color:var(--mute);margin:6px 0 0;max-width:70ch}
#races{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.race{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:10px;background:linear-gradient(var(--wood2),var(--wood));min-width:0}
.race.on{border-color:var(--gold2);background:linear-gradient(#5a4026,#2a1d14);box-shadow:0 0 0 3px var(--gold2)}
.race b{font-size:20px;color:var(--gold2)}.race small{color:var(--mute);font-size:13px}.race ul{margin:4px 0 0;padding-left:16px;text-align:left;font-size:12px;color:var(--text)}
.rport{image-rendering:pixelated;height:120px}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;background:linear-gradient(var(--wood2),var(--wood));border:3px solid var(--gold);padding:14px;box-shadow:0 0 0 3px var(--ink)}
.opt{display:grid;gap:4px}.opt label{color:var(--mute);font-size:13px}
.checks{display:flex;gap:14px;flex-wrap:wrap;align-items:center}.checks label{color:var(--text)}
#rivals{display:grid;gap:6px}.rival{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.sbtns{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.sbtns .go{font-size:22px;padding:8px 26px;background:#6b4a26;border-color:var(--gold2)}
.gtabs,.gmode{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}.gtabs button.on,.gmode button.on{background:#6b4a26;border-color:var(--gold2)}
.ggrid{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.ggrid figure{margin:0;display:grid;justify-items:center;gap:2px;background:rgba(0,0,0,.25);padding:6px;border:1px solid var(--wood3)}
.ggrid figcaption{font-size:12px;color:var(--mute);max-width:130px;text-align:center}.gc{image-rendering:pixelated}
@media (max-width:760px){#cmds{grid-template-columns:repeat(5,36px);grid-auto-rows:34px}.cmd{width:36px;height:34px}#mini{width:96px;height:96px}#bottom{height:128px}.tinfo{display:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
"""

BODY = r"""
<canvas id="game"></canvas>
<div id="hud" hidden>
  <div id="top" class="panel">
    <div id="resbar"></div>
    <div class="tinfo"><span id="age"></span><span id="clock">00:00</span><span id="weather"></span></div>
    <div class="tbtns"><button id="b-idle" data-tip="Aldeanos inactivos (tecla .)">Inactivos: 0</button><button id="b-diplo">Diplomacia</button><button id="b-music">Música</button><button id="b-speed">1x</button><button id="b-menu">Menú</button></div>
  </div>
  <div id="log"></div>
  <div id="proposals"></div>
  <div id="bottom" class="panel"><canvas id="mini" width="96" height="96"></canvas><div id="info"></div><div id="cmds"></div></div>
</div>
<div id="tip" hidden></div>
<div id="setup" hidden>
  <div class="swrap">
    <header><h1 class="logo">PIXEL EMPIRES</h1><p class="tag">Estrategia en tiempo real en pixel art. Elige tu raza, recolecta, avanza de era, forja alianzas y lleva a tus veteranos y a tu general a la victoria.</p></header>
    <div id="races"></div>
    <div class="opts">
      <div class="opt"><label for="s-team">Tu equipo</label><select id="s-team"><option value="0">Libre (todos contra todos)</option><option value="1">Equipo 1</option><option value="2">Equipo 2</option><option value="3">Equipo 3</option></select></div>
      <div class="opt"><label for="s-rivals">Rivales</label><select id="s-rivals"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></div>
      <div class="opt"><label for="s-diff">Dificultad</label><select id="s-diff"><option value="easy">Fácil</option><option value="normal" selected>Normal</option><option value="hard">Difícil</option></select></div>
      <div class="opt" style="grid-column:1/-1"><label>Rivales: raza, equipo y dificultad</label><div id="rivals"></div></div>
      <div class="opt"><label for="s-map">Mapa</label><select id="s-map"><option value="continental">Continental</option><option value="forest">Bosques profundos</option><option value="mountains">Montañas</option><option value="rivers">Ríos</option><option value="tundra">Tundra</option></select></div>
      <div class="opt"><label for="s-size">Tamaño</label><select id="s-size"><option value="72">Pequeño</option><option value="96" selected>Mediano</option><option value="128">Grande</option></select></div>
      <div class="opt"><label for="s-res">Recursos iniciales</label><select id="s-res"><option value="low">Bajos</option><option value="normal" selected>Normales</option><option value="high">Altos</option></select></div>
      <div class="opt checks"><label><input type="checkbox" id="s-weather" checked> Clima</label><label><input type="checkbox" id="s-dis" checked> Desastres</label><label><input type="checkbox" id="s-reveal"> Mapa revelado</label></div>
    </div>
    <div class="sbtns"><button id="s-help">Cómo jugar</button><button id="s-gallery">Galería de diseños</button><button id="s-start" class="go">COMENZAR</button></div>
  </div>
</div>
<div id="modal" hidden></div>
"""

def main():
    files = sorted(glob.glob(os.path.join(ROOT, 'src', '*.js')))
    if '--core' in sys.argv: files = [f for f in files if not re.match(r'1\d_', os.path.basename(f))]
    js = '\n'.join(open(f, encoding='utf8').read() for f in files)
    js = js.replace('</script>', '<\\/script>')
    head = ('<title>Pixel Empires</title>\n'
            '<meta name="description" content="Estrategia en tiempo real tipo Age of Empires en pixel art: 5 razas, generales únicos, experiencia y diplomacia.">\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jersey+10&family=Silkscreen:wght@400;700&display=swap">\n'
            '<style>' + CSS + '</style>\n')
    script = '<script>\n' + js + '\n</script>\n'
    full = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            + head + '</head>\n<body>\n' + BODY + script + '</body>\n</html>\n')
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf8').write(full)
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    open(os.path.join(ROOT, 'dist', 'artifact.html'), 'w', encoding='utf8').write(head + BODY + script)
    print('ok', len(files), 'archivos,', round(len(full) / 1024), 'KB')

if __name__ == '__main__':
    main()
