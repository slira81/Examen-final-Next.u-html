import base64, json, os, sys
A=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','art')
meta=json.load(open(os.path.join(A,'sprites.json')))
def uri(n): return 'data:image/png;base64,'+base64.b64encode(open(os.path.join(A,n+'.png'),'rb').read()).decode()
CH=[('guerrero','Guerrero','Infantería pesada','Casco con penacho del equipo, peto de acero, escudo redondo y espada. Silueta ancha con el escudo a un lado y la hoja vertical al otro.',['steel','team','gold','leather','skin']),
('mago','Mago','Hechicero de apoyo','Sombrero puntiagudo con estrella, barba larga y túnica azul con ribete dorado. Bastón alto con orbe que brilla; la silueta triangular lo distingue al instante.',['robe','hat','beard','gold','orb']),
('aldeano','Aldeano','Recolector y constructor','Sombrero de paja con cinta del equipo, túnica clara, mangas remangadas, saco al costado y un hacha. Es la figura más redonda y clara del grupo.',['straw','cloth','team','pants','skin']),
('arquero','Arquero','Tirador a distancia','Capucha verde en punta, jubón de cuero, carcaj en la espalda y arco que enmarca todo el lado izquierdo. Colores de bosque para camuflarse en el mapa.',['hood','tunic','leather','cloak','team'])]
NAMES={'steel':'Acero','team':'Equipo','gold':'Oro','leather':'Cuero','skin':'Piel','robe':'Túnica','hat':'Sombrero','beard':'Barba','orb':'Orbe','straw':'Paja','cloth':'Tela','pants':'Pantalón','hood':'Capucha','tunic':'Jubón','cloak':'Capa'}
data={c[0]:{t:{'src':uri(f'{c[0]}_{t}'),'pal':{m:meta[c[0]][t][m] for m in c[4]}} for t in ('azul','rojo')} for c in CH}
html=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'gallery_template.html')).read()
cards=''.join(f'<article class="card" data-c="{k}"><div class="stage"><img class="spr" alt="Sprite de {n}"></div><div class="body"><h3>{n}</h3><p class="role">{r}</p><p>{d}</p><div class="pal"></div></div></article>' for k,n,r,d,_ in CH)
html=html.replace('%%CARDS%%',cards).replace('%%DATA%%',json.dumps(data)).replace('%%NAMES%%',json.dumps(NAMES)).replace('%%ORDER%%',json.dumps([c[0] for c in CH])).replace('%%LABELS%%',json.dumps({c[0]:c[1] for c in CH}))
sys.stdout.write(html)
