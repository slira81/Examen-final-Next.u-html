import sys,json
txt=sys.stdin.read(); i=txt.rfind('\n}')
d=json.loads(txt[:i+2]); print({k:d.get(k) for k in ['renderMs','tStart','simMs','msPerStep','time','units','over','weather','levels','idleW']})
for s in d['summary']: print(s['race'],s['alive'],'age',s['age'],s['pop'],s['res'],'u',s['units'],'mil',s['mil'],'k/l',s['killed'],s['lost'],'lvl',s['maxLvl'],'gen',s['gen'],'\n   ',s['blds'],'|',s['techs'])
for m in d['msgs']: print('  ',m)
print(txt[i+2:][:3000])
