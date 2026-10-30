#!/usr/bin/env python3
"""Generador de sprites pixel art (32x32) para Pixel Empires.

Técnica (según guías de Lospec / GameDev.net / PixelJoint):
  * Cada material tiene una rampa de 4 tonos con cambio de matiz: las sombras
    se enfrían hacia el azul/violeta y las luces se calientan hacia el amarillo.
  * Luz desde arriba a la izquierda: bordes superiores/izquierdos claros,
    inferiores/derechos oscuros, con volumen cilíndrico en áreas anchas.
  * Contorno selectivo de 1 px: nunca negro puro; usa el tono más oscuro del
    material vecino, más suave en el lado iluminado.
  * Paleta compartida y un color de equipo (azul / rojo) que reemplaza al
    material 'team', para reutilizar cada diseño en ambos bandos.

Uso: python3 make_sprites.py   -> escribe PNG y sprites.json en ../art
"""
import colorsys, json, os
from PIL import Image

W = H = 32
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'art')


# ---------------------------------------------------------------- color
def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))

def to_hex(rgb): return '#%02x%02x%02x' % tuple(int(round(v)) for v in rgb)

def shift(rgb, dh, ds, dv):
    h, s, v = colorsys.rgb_to_hsv(*[x / 255 for x in rgb])
    h = (h + dh / 360) % 1
    s = max(0, min(1, s + ds)); v = max(0, min(1, v + dv))
    return tuple(x * 255 for x in colorsys.hsv_to_rgb(h, s, v))

def ramp(base):
    """4 tonos [sombra, base, luz, brillo] con cambio de matiz."""
    b = hx(base)
    return [shift(b, -14, +0.10, -0.26), b, shift(b, +8, -0.06, +0.14), shift(b, +16, -0.20, +0.27)]

def outline_of(base, soft=False):
    b = hx(base)
    return shift(b, -22, +0.05, -0.48 if not soft else -0.36)

MATS = {  # material: color base
    'skin': '#e9b38a', 'hair': '#6b4128', 'steel': '#8f9db3', 'blade': '#c9d4e3', 'gold': '#e2b237',
    'leather': '#8a5a36', 'wood': '#9a6b3c', 'cloth': '#d9c59b', 'pants': '#6e5236', 'straw': '#e3bb4c',
    'robe': '#3f58cc', 'hat': '#4a3fa8', 'beard': '#e6e8ee', 'hood': '#3f7d3a', 'cloak': '#2f5e34',
    'tunic': '#6d9a45', 'sack': '#b08a58', 'orb': '#46e3e6', 'feather': '#e8e4d6',
}
FIXED = {'eye': '#1d1530', 'ol': '#1d1530', 'string': '#e8e0c8', 'white': '#f4f1ea', 'mouth': '#a85a4a'}
TEAMS = {'azul': '#3a6fe0', 'rojo': '#d8403a'}


# ---------------------------------------------------------------- lienzo
class Canvas:
    def __init__(self): self.g = [[None] * W for _ in range(H)]
    def px(self, m, x, y):
        if 0 <= x < W and 0 <= y < H: self.g[y][x] = m
    def rect(self, m, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.px(m, x, y)
    def ell(self, m, cx, cy, rx, ry):
        for y in range(H):
            for x in range(W):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: self.px(m, x, y)
    def poly(self, m, pts):
        n = len(pts)
        for y in range(H):
            for x in range(W):
                px_, py_, inside, j = x + .5, y + .5, False, n - 1
                for i in range(n):
                    xi, yi = pts[i]; xj, yj = pts[j]
                    if (yi > py_) != (yj > py_) and px_ < (xj - xi) * (py_ - yi) / (yj - yi) + xi: inside = not inside
                    j = i
                if inside: self.px(m, x, y)
    def line(self, m, x0, y0, x1, y1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; e = dx + dy
        while True:
            self.px(m, x0, y0)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * e
            if e2 >= dy: e += dy; x0 += sx
            if e2 <= dx: e += dx; y0 += sy
    def rim(self, fn, m, *a):
        """Dibuja una forma con contorno interior oscuro (armas sobre el cuerpo)."""
        t = Canvas(); fn(t, 'x', *a)
        for y in range(H):
            for x in range(W):
                if t.g[y][x]: continue
                if any(0 <= x + dx < W and 0 <= y + dy < H and t.g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): self.px('ol', x, y)
        for y in range(H):
            for x in range(W):
                if t.g[y][x]: self.g[y][x] = m


# ---------------------------------------------------------------- render
def render(cv, team_hex):
    mats = dict(MATS); mats['team'] = team_hex
    ramps = {k: ramp(v) for k, v in mats.items()}
    g, out = cv.g, Image.new('RGBA', (W, H), (0, 0, 0, 0)); o = out.load()
    used = {}
    def at(x, y): return g[y][x] if 0 <= x < W and 0 <= y < H else None
    # sombra de suelo
    for y in (30, 31):
        for x in range(8, 24):
            if ((x + .5 - 16) / (8 if y == 30 else 6)) ** 2 <= 1: o[x, y] = (20, 12, 40, 70 if y == 30 else 45)
    for y in range(H):
        for x in range(W):
            m = g[y][x]
            if m is None: continue
            if m in FIXED: col = hx(FIXED[m]); used[m] = FIXED[m]
            else:
                r = ramps[m]; lvl = 1
                up, lf, dn, rt = at(x, y - 1) != m, at(x - 1, y) != m, at(x, y + 1) != m, at(x + 1, y) != m
                if (up or lf) and not (dn or rt): lvl = 2
                if up and lf: lvl = 3
                if (dn or rt) and not (up or lf): lvl = 0
                if lvl == 1 and (up or lf) and (dn or rt): lvl = 1
                # volumen cilindrico en tramos horizontales anchos
                x0 = x
                while at(x0 - 1, y) == m: x0 -= 1
                x1 = x
                while at(x1 + 1, y) == m: x1 += 1
                n = x1 - x0 + 1
                if n >= 6 and lvl == 1:
                    if x - x0 < max(1, n // 5): lvl = 2
                    elif x1 - x <= max(1, n // 4) - 1 + (1 if n >= 9 else 0): lvl = 0
                if m == 'orb': lvl = 3 if (x - x0 < 1 or y - 0 < 0) else (2 if lvl >= 1 else 1)
                col = r[lvl]; used.setdefault(m, set()).add(to_hex(col)) if isinstance(used.get(m, set()), set) else None
            o[x, y] = tuple(int(round(v)) for v in col) + (255,)
    # contorno selectivo exterior
    for y in range(H):
        for x in range(W):
            if g[y][x] is not None: continue
            best = None
            for dx, dy, soft in ((0, 1, True), (1, 0, True), (0, -1, False), (-1, 0, False)):  # vecino abajo/derecha => borde sup/izq (suave)
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and g[ny][nx] is not None:
                    nm = g[ny][nx]
                    if nm == 'ol': best = 'skip'; break
                    if best is None: best = (nm, soft)
            if best is None or best == 'skip': continue
            nm, soft = best
            col = hx(FIXED['ol']) if nm in FIXED else outline_of(mats[nm], soft)
            o[x, y] = tuple(int(round(v)) for v in col) + (255,)
    palette = {k: [to_hex(c) for c in v] for k, v in ramps.items()}
    return out, palette


# ---------------------------------------------------------------- personajes
def warrior():
    c = Canvas()
    # piernas y botas
    c.rect('steel', 11, 22, 14, 27); c.rect('steel', 17, 22, 20, 27)
    c.rect('leather', 10, 27, 14, 29); c.rect('leather', 17, 27, 21, 29)
    # tabardo del equipo, cuerpo
    c.rect('team', 11, 15, 20, 24); c.rect('team', 12, 25, 14, 25); c.rect('team', 17, 25, 19, 25)
    # peto
    c.poly('steel', [(10, 14), (21, 14), (20.5, 20), (11.5, 20)])
    c.rect('steel', 14, 15, 17, 19)
    c.line('gold', 15, 15, 15, 18); c.line('gold', 16, 15, 16, 18)
    # cinturon
    c.rect('leather', 10, 20, 21, 21); c.rect('gold', 15, 20, 16, 21)
    # hombreras
    c.ell('steel', 9.5, 15.5, 3, 2.6); c.ell('steel', 22.5, 15.5, 3, 2.6)
    # brazo derecho (espada)
    c.rect('steel', 22, 17, 24, 22); c.rect('leather', 22, 21, 24, 22)
    # espada
    def sword(t, m):
        t.rect(m, 26, 5, 27, 19); t.px(m, 26, 4); t.px(m, 27, 4); t.px(m, 26, 3)
        t.rect(m, 24, 20, 29, 21); t.rect(m, 26, 22, 27, 24); t.rect(m, 25, 25, 28, 25)
    c.rim(sword, 'blade')
    c.rect('gold', 24, 20, 29, 21); c.rect('leather', 26, 22, 27, 24); c.rect('gold', 25, 25, 28, 25)
    c.px('leather', 22, 21)
    # escudo redondo (izquierda)
    def shield(t, m): t.ell(m, 6.5, 19.5, 5.3, 6)
    c.rim(shield, 'steel')
    c.ell('team', 6.5, 19.5, 4, 4.7)
    c.rect('white', 6, 15, 6, 24); c.rect('white', 3, 19, 10, 19)
    c.ell('gold', 6.5, 19.5, 1.6, 1.6)
    c.rect('steel', 9, 17, 10, 19)
    # cabeza y casco
    c.ell('skin', 15.5, 10, 5, 5.2)
    c.ell('steel', 15.5, 8.2, 5.8, 5.4)
    c.rect('steel', 10, 9, 11, 14); c.rect('steel', 20, 9, 21, 14)
    c.rect('skin', 12, 10, 19, 14); c.rect(None, 12, 14, 12, 14); c.rect(None, 19, 14, 19, 14)
    c.rect('steel', 15, 9, 16, 12)
    c.px('eye', 13, 12); c.px('eye', 18, 12)
    c.px('mouth', 15, 14); c.px('mouth', 16, 14)
    c.rect('steel', 10, 8, 21, 8)
    # penacho
    c.ell('team', 15.5, 2.4, 2.4, 2.6); c.rect('team', 15, 1, 19, 2); c.rect('team', 18, 2, 20, 5)
    c.rect('gold', 13, 5, 18, 5)
    return c


def mage():
    c = Canvas()
    # tunica
    c.poly('robe', [(11, 16), (20, 16), (23.5, 29), (8.5, 29)])
    c.rect('leather', 11, 29, 14, 29); c.rect('leather', 17, 29, 20, 29)
    c.rect('gold', 9, 27, 23, 28)
    c.rect('hat', 12, 20, 19, 21); c.rect('gold', 15, 20, 16, 21)
    c.line('hat', 15, 22, 14, 27); c.line('hat', 16, 22, 17, 27)
    # mangas
    c.poly('robe', [(7, 16), (11, 16), (11, 22), (6, 23)])
    c.poly('robe', [(20, 16), (24, 16), (25, 22), (20, 22)])
    c.rect('gold', 6, 22, 11, 22); c.rect('gold', 20, 22, 25, 22)
    c.ell('skin', 6.5, 24, 1.5, 1.5)
    c.rect('skin', 24, 22, 26, 24)
    # baston
    def staff(t, m): t.rect(m, 26, 7, 27, 29)
    c.rim(staff, 'wood')
    c.rect('gold', 25, 6, 28, 7)
    # orbe con aura
    c.ell('orb', 26.5, 3.4, 2.7, 2.7)
    c.px('white', 25, 2)
    # rostro, barba
    c.ell('skin', 15.5, 12.5, 3.9, 3.3)
    c.poly('beard', [(11.8, 13), (19.2, 13), (18.2, 19), (15.5, 23), (12.8, 19)])
    c.rect('skin', 14, 12, 17, 13)
    c.px('eye', 14, 12); c.px('eye', 17, 12)
    c.rect('white', 13, 11, 14, 11); c.rect('white', 17, 11, 18, 11)
    c.rect('skin', 15, 13, 16, 14)
    # sombrero
    c.poly('hat', [(15.5, -1), (17.5, 4), (20, 10), (11, 10), (13, 4)])
    c.ell('hat', 15.5, 10.4, 8, 1.8)
    c.rect('gold', 12, 8, 19, 9)
    c.px('gold', 15, 4); c.px('gold', 14, 5); c.px('gold', 15, 5); c.px('gold', 16, 5); c.px('gold', 15, 6)
    c.px('hat', 17, 0); c.px('hat', 18, 1)
    return c


def villager():
    c = Canvas()
    # botas y pantalon
    c.rect('pants', 12, 24, 19, 27); c.px(None, 15, 27); c.px(None, 16, 27)
    c.rect('pants', 12, 27, 14, 27); c.rect('pants', 17, 27, 19, 27)
    c.rect('leather', 11, 28, 14, 29); c.rect('leather', 17, 28, 20, 29)
    # tunica
    c.rect('cloth', 11, 15, 20, 24); c.rect('cloth', 12, 24, 19, 25)
    c.rect('team', 11, 20, 20, 21); c.rect('team', 15, 22, 16, 25)
    c.rect('leather', 13, 15, 14, 15)  # cuello en V (cordón)
    c.rect('skin', 14, 15, 17, 16); c.px('cloth', 15, 17)
    # brazos remangados
    c.rect('cloth', 9, 16, 11, 18); c.rect('skin', 9, 19, 10, 22)
    c.rect('cloth', 20, 16, 22, 18); c.rect('skin', 22, 19, 23, 22)
    # saco al costado
    c.ell('sack', 8, 24.5, 3, 2.6); c.rect('leather', 7, 21, 9, 22)
    # hacha
    def handle(t, m): t.rect(m, 24, 8, 25, 25)
    c.rim(handle, 'wood')
    def head(t, m):
        t.poly(m, [(25, 7), (29.5, 5.5), (30.5, 13), (25, 12)])
    c.rim(head, 'steel')
    c.rect('blade', 29, 7, 29, 12)
    c.rect('skin', 22, 21, 25, 22)
    # cabeza
    c.ell('skin', 15.5, 10.4, 4.7, 4.9)
    c.rect('hair', 11, 8, 12, 12); c.rect('hair', 19, 8, 20, 12)
    c.px('eye', 14, 11); c.px('eye', 17, 11)
    c.px('mouth', 15, 13); c.px('mouth', 16, 13)
    c.px('skin', 15, 12); c.px('skin', 16, 12)
    # sombrero de paja
    c.ell('straw', 15.5, 7.4, 8.3, 2.1)
    c.ell('straw', 15.5, 5.2, 4.7, 3.4)
    c.rect('team', 11, 6, 20, 7)
    c.px('straw', 11, 8); c.px('straw', 20, 8)
    return c


def archer():
    c = Canvas()
    # capa trasera
    c.poly('cloak', [(10, 13), (21, 13), (22, 20), (9, 20)])
    # piernas y botas altas
    c.rect('pants', 12, 22, 14, 26); c.rect('pants', 17, 22, 19, 26)
    c.rect('leather', 11, 26, 14, 29); c.rect('leather', 17, 26, 20, 29)
    c.rect('gold', 11, 26, 14, 26); c.rect('gold', 17, 26, 20, 26)
    # carcaj en la espalda
    def quiver(t, m): t.rect(m, 21, 9, 23, 20)
    c.rim(quiver, 'leather')
    c.px('feather', 21, 7); c.px('feather', 22, 7); c.px('team', 22, 8); c.px('team', 23, 8); c.px('feather', 21, 8)
    c.line('wood', 22, 9, 22, 9)
    # jubon
    c.rect('tunic', 11, 15, 20, 23)
    c.rect('leather', 12, 15, 19, 20)
    c.rect('leather', 11, 21, 20, 21); c.rect('gold', 15, 21, 16, 21)
    c.rect('team', 12, 22, 19, 22)
    c.rect('tunic', 12, 23, 19, 24)
    # brazos
    c.rect('tunic', 9, 15, 10, 18); c.rect('leather', 9, 18, 10, 19)
    c.rect('tunic', 21, 15, 22, 19); c.rect('leather', 21, 18, 22, 20); c.px('skin', 21, 21); c.px('skin', 22, 21)
    c.rect('skin', 7, 16, 8, 18)
    # arco
    cx, cy, rx, ry = 8, 15.5, 5.4, 11.5
    for y in range(H):
        for x in range(W):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if 0.62 <= d <= 1.0 and x <= 8: c.px('wood', x, y)
    c.line('string', 8, 4, 8, 27)
    # capucha
    c.ell('hood', 15.5, 8.6, 6.2, 6.4)
    c.poly('hood', [(15.5, 0), (19, 4), (12, 4)])
    c.poly('hood', [(10.5, 13), (20.5, 13), (21, 16), (10, 16)])
    # rostro en sombra de la capucha
    c.rect('skin', 12, 9, 19, 13); c.px(None, 12, 13); c.px(None, 19, 13)
    c.rect('hood', 12, 8, 19, 8); c.rect('hood', 12, 9, 13, 9); c.rect('hood', 18, 9, 19, 9)
    c.px('eye', 14, 11); c.px('eye', 17, 11)
    c.px('white', 14, 10); c.px('white', 17, 10)
    c.px('mouth', 15, 13); c.px('mouth', 16, 13)
    return c


CHARS = {'guerrero': warrior, 'mago': mage, 'aldeano': villager, 'arquero': archer}


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    sheet = Image.new('RGBA', (W * len(CHARS), H * len(TEAMS)), (0, 0, 0, 0))
    for ti, (tname, thex) in enumerate(TEAMS.items()):
        for ci, (cname, fn) in enumerate(CHARS.items()):
            img, pal = render(fn(), thex)
            img.save(os.path.join(OUT, f'{cname}_{tname}.png'))
            img.resize((W * 8, H * 8), Image.NEAREST).save(os.path.join(OUT, f'{cname}_{tname}_x8.png'))
            sheet.paste(img, (ci * W, ti * H))
            meta.setdefault(cname, {})[tname] = pal
    sheet.save(os.path.join(OUT, 'spritesheet.png'))
    sheet.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST).save(os.path.join(OUT, 'spritesheet_x6.png'))
    json.dump(meta, open(os.path.join(OUT, 'sprites.json'), 'w'), indent=1)
    print('ok', list(CHARS))


if __name__ == '__main__':
    main()
