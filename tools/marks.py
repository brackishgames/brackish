#!/usr/bin/env python3
"""Draw the BRACKISH marks the way the game draws everything: a brightness field per cell, put through the
dot shader's palette, its 4x4 ordered dither between seven levels, and round dots sized by brightness.

  python3 tools/marks.py        writes brand/logo.svg, og.svg, avatar.svg, icon.svg; the PNGs (brand/, plus og.png and the icons at the root) are rendered from them
"""
import math, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
FONT = dict(re.findall(r'"(.)": "([.#]{35})"', SRC.split('const FONT = ', 1)[1].split('\n', 1)[0]))     # the game's 5x7 panel font
FONT3 = dict(re.findall(r'"(.)": "([.#]{15})"', SRC.split('const FONT3 = ', 1)[1].split('\n', 1)[0]))   # and its 3x5 one

STOPS = [(0.0, (0.01, 0.07, 0.12)), (0.4, (0.03, 0.47, 0.72)), (0.75, (0.30, 0.88, 0.94)), (1.0, (0.96, 1.0, 1.0))]   # the shader's palette()
UNLIT, AMBER = '#040a10', '#8a5a00'

def palette(b):
    for (b0, c0), (b1, c1) in zip(STOPS, STOPS[1:]):
        if b <= b1: k = (b - b0) / (b1 - b0); return tuple(c0[i] + (c1[i] - c0[i]) * k for i in range(3))
    return STOPS[-1][1]

def bayer(x, y):
    lx, ly, hx, hy = x % 2, y % 2, (x % 4) // 2, (y % 4) // 2
    return ((lx * 2 + ly * 3 - lx * ly * 4) * 4 + hx * 2 + hy * 3 - hx * hy * 4 + 0.5) / 16

def drive(b, x, y):   # OEL drive: off, or one of seven perceptual levels, dithered between them
    if b < 0.012: return 0.0
    return max(1 / 49, (math.floor(math.sqrt(min(b, 1.0)) * 7 + bayer(x, y)) / 7) ** 2)

smoothstep = lambda e0, e1, x: (lambda t: t * t * (3 - 2 * t))(max(0.0, min(1.0, (x - e0) / (e1 - e0))))
hexc = lambda c: '#%02x%02x%02x' % tuple(round(max(0, min(1, v)) * 255) for v in c)

def ray(u, v):
    """A cownose ray from above, nose up: u across (-1..1 wingtip to wingtip), v down. Returns brightness or None."""
    a = abs(u)
    if a <= 1:
        front = -0.36 + 0.46 * a ** 1.35 + 0.07 * math.exp(-(u / 0.07) ** 2)   # swept leading edge, notched cownose head
        back = 0.40 - 0.42 * a ** 0.75 + 0.05 * a ** 6                          # concave trailing edge out to the tip
        if front < v < back:
            edge = min(v - front, back - v, (1 - a) * 0.6)
            b = 0.10 + 0.30 * (1 - a) ** 0.9 + 0.10 * math.exp(-(u / 0.05) ** 2)   # faintly lit down the spine
            b += 0.28 * math.exp(-edge / 0.03) * (v < 0.1)                             # the leading edge catches what light comes down
            return b * (1 - 0.9 * smoothstep(0.35, 1.0, a)) * (1 - 0.6 * smoothstep(0.0, 0.4, v))   # the wingtips and the back half are lost in the murk
    if a < 0.03 and 0.38 < v < 0.85: return 0.28 * (1 - smoothstep(0.38, 0.8, v))   # the whip tail
    return None

def text_cells(s, x0, y0, scale=1, small=False):
    F, gw, gh = (FONT3, 3, 5) if small else (FONT, 5, 7)
    out = []
    for n, ch in enumerate(s):
        g = F[ch]
        for j in range(gh):
            for i in range(gw):
                if g[j * gw + i] == '#':
                    for sy in range(scale):
                        for sx in range(scale): out.append((x0 + (n * (gw + 1) + i) * scale + sx, y0 + j * scale + sy))
    return out

class Board:
    def __init__(s, cols, rows, pitch): s.cols, s.rows, s.p, s.b, s.txt, s.amber = cols, rows, pitch, {}, {}, set()
    def field(s, f):
        for y in range(s.rows):
            for x in range(s.cols):
                b = f(x, y)
                if b is not None: s.b[x, y] = max(s.b.get((x, y), 0), b)
    def ray(s, cx, cy, half, gain=1.0):
        s.field(lambda x, y: (lambda b: None if b is None else b * gain)(ray((x + 0.5 - cx) / half, (y + 0.5 - cy) / half)))
    def text(s, string, cy, lvl=0.5, scale=1, small=False):
        w = (len(string) * (4 if small else 6) - 1) * scale
        for c in text_cells(string, (s.cols - w) // 2, cy, scale, small): s.txt[c] = lvl
    def svg(s, blur):
        W, H, p = s.cols * s.p, s.rows * s.p, s.p
        lit, dim = [], []
        for y in range(s.rows):
            for x in range(s.cols):
                cx, cy = (x + 0.5) * p, (y + 0.5) * p
                if (x, y) in s.amber: lit.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{p * 0.4:.1f}" fill="{AMBER}"/>'); continue
                t = s.txt.get((x, y))
                if t:   # the panel layer: words are pale blue-white dots
                    lit.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{p * (0.38 + 0.42 * t) / 2:.1f}" fill="{hexc([k * (0.3 + 0.7 * t) for k in (0.80, 0.90, 1.0)])}"/>'); continue
                b = drive(s.b.get((x, y), 0), x, y)
                if b > 0: lit.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{p * (0.38 + 0.45 * b) / 2:.1f}" fill="{hexc(palette(b))}"/>')
                else: dim.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{p * 0.36:.1f}"/>')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
                f'<defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{p * blur:.1f}" result="b"/>'
                f'<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>\n'
                f'<radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.7"/></radialGradient></defs>\n'
                f'<rect width="{W}" height="{H}" fill="#010407"/>\n<g fill="{UNLIT}">\n' + '\n'.join(dim) + '\n</g>\n<g filter="url(#g)">\n' + '\n'.join(lit) +
                f'\n</g>\n<rect width="{W}" height="{H}" fill="url(#v)"/>\n</svg>\n')

def water(rows, top=0.16):   # a faint dithered surface glow that sinks to black
    return lambda x, y: top * max(0, 1 - y / (rows * 0.55)) ** 2 * (0.75 + 0.25 * math.sin(x * 0.37 + y * 0.11) * math.sin(x * 0.13 - y * 0.29)) or None

def write(name, board, blur):
    open(os.path.join(ROOT, 'brand', name), 'w').write(board.svg(blur)); print('wrote brand/' + name)

# the game logo: the ray over the wordmark
b = Board(63, 48, 12); b.ray(31.5, 13.5, 26); b.text('BRACKISH', 36); write('logo.svg', b, 0.45)
# the share card
b = Board(200, 105, 6); b.field(water(105, 0.1)); b.ray(100, 26, 42); b.text('BRACKISH', 66, scale=2); b.text("TAMPA BAY · DON'T SWIM IN IT", 88, 0.3); write('og.svg', b, 0.45)
# the org avatar: square, the ray big enough to read at 40px, the name under it
b = Board(53, 53, 1024 / 53); b.ray(26.5, 17.5, 22, 1.5); b.text('BRACKISH', 39, 0.66); write('avatar.svg', b, 0.4)
# the game icon (favicon, home screen): the ray alone
b = Board(16, 16, 11.25); b.ray(8, 6.2, 9); write('icon.svg', b, 0.35)
