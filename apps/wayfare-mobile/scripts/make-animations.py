#!/usr/bin/env python3
"""
Writes Wayfare's own Lottie animations to assets/animations/ (no third-party artwork, no licence
strings attached). Run again after changing a colour or timing:

    python3 scripts/make-animations.py

  confetti.json  a burst of paper confetti (trip completed, new badge)       1.8 s, plays once
  stamp.json     an ink splash behind a passport stamp as it lands           0.6 s, plays once
  travel.json    a little globe with a paper plane circling it (empty pages)  4 s, loops
"""
import json
import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'animations')
FPS = 60

PURPLE = '#6a01a3'
LAVENDER = '#c77dff'
ORANGE = '#f97316'
TEAL = '#0e9fb7'
YELLOW = '#fbbf24'
PINK = '#ec4899'
GREEN = '#22c55e'


def rgba(hex_color, a=1.0):
    h = hex_color.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


def static(v):
    return {'a': 0, 'k': v}


LINEAR_IN = {'x': [1], 'y': [1]}
LINEAR_OUT = {'x': [0], 'y': [0]}


def animated(frames):
    """frames: [(t, value)], value a number or list. Linear between dense keyframes."""
    k = []
    for t, v in frames:
        k.append({'t': t, 's': v if isinstance(v, list) else [v], 'i': LINEAR_IN, 'o': LINEAR_OUT})
    return {'a': 1, 'k': k}


def transform(p=None, r=None, s=None, o=None, a=None):
    return {
        'p': p or static([0, 0, 0]),
        'a': a or static([0, 0, 0]),
        's': s or static([100, 100, 100]),
        'r': r or static(0),
        'o': o or static(100),
    }


def group(items, name='g'):
    return {
        'ty': 'gr',
        'nm': name,
        'it': items
        + [{'ty': 'tr', 'p': static([0, 0]), 'a': static([0, 0]), 's': static([100, 100]), 'r': static(0), 'o': static(100), 'sk': static(0), 'sa': static(0)}],
    }


def fill(color, a=100):
    return {'ty': 'fl', 'c': static(rgba(color)), 'o': static(a), 'r': 1, 'nm': 'fill'}


def stroke(color, width, a=100, dash=None):
    s = {'ty': 'st', 'c': static(rgba(color)), 'o': static(a), 'w': static(width), 'lc': 2, 'lj': 2, 'nm': 'stroke'}
    if dash:
        s['d'] = [{'n': 'd', 'nm': 'dash', 'v': static(dash[0])}, {'n': 'g', 'nm': 'gap', 'v': static(dash[1])}]
    return s


def rect(w, h, r=0):
    return {'ty': 'rc', 'd': 1, 's': static([w, h]), 'p': static([0, 0]), 'r': static(r)}


def ellipse(w, h, p=(0, 0)):
    return {'ty': 'el', 'd': 1, 's': static([w, h]), 'p': static(list(p))}


def path(points, closed=True):
    zeros = [[0, 0] for _ in points]
    return {'ty': 'sh', 'ks': static({'c': closed, 'v': [list(p) for p in points], 'i': zeros, 'o': zeros})}


def layer(ind, name, shapes, ks, op):
    return {'ddd': 0, 'ind': ind, 'ty': 4, 'nm': name, 'sr': 1, 'ks': ks, 'ao': 0, 'shapes': shapes, 'ip': 0, 'op': op, 'st': 0, 'bm': 0}


def doc(name, w, h, op, layers):
    return {'v': '5.7.4', 'fr': FPS, 'ip': 0, 'op': op, 'w': w, 'h': h, 'nm': name, 'ddd': 0, 'assets': [], 'layers': layers}


def confetti():
    """Paper pieces thrown up from just below the middle, falling with a flutter."""
    rnd = random.Random(7)
    W, H, OP = 400, 400, 108
    colors = [PURPLE, LAVENDER, ORANGE, TEAL, YELLOW, PINK, GREEN]
    layers = []
    for i in range(30):
        angle = math.radians(rnd.uniform(-160, -20))  # upwards fan
        speed = rnd.uniform(420, 900)
        vx, vy = math.cos(angle) * speed, math.sin(angle) * speed
        x, y = W / 2 + rnd.uniform(-24, 24), H * 0.7
        spin = rnd.uniform(-720, 720)
        flutter = rnd.uniform(2.5, 5)
        delay = rnd.randint(0, 6)
        pos, rot, scl, opa = [], [], [], []
        px, py, pvx, pvy = x, y, vx, vy
        for f in range(0, OP + 1, 4):
            t = max(0, f - delay) / FPS
            if f == 0 or f < delay:
                px, py, pvx, pvy = x, y, vx, vy
            else:
                dt = 4 / FPS
                pvx *= 0.985
                pvy = pvy * 0.985 + 1250 * dt
                px += pvx * dt
                py += pvy * dt
            pos.append((f, [round(px), round(py), 0]))
            rot.append((f, round(spin * t)))
            scl.append((f, [round(100 * math.cos(t * flutter * math.pi)), 100, 100]))
            fade = 100 if f < OP * 0.7 else max(0, 100 * (OP - f) / (OP * 0.3))
            opa.append((f, round(fade if f >= delay else 0)))
        shape = rect(rnd.choice([11, 13, 16]), rnd.choice([7, 8, 18]), 2) if i % 3 else ellipse(12, 12)
        ks = transform(p=animated(pos), r=animated(rot), s=animated(scl), o=animated(opa))
        layers.append(layer(i + 1, f'piece{i}', [group([shape, fill(colors[i % len(colors)])])], ks, OP))
    return doc('confetti', W, H, OP, layers)


def stamp():
    """An ink ring that spreads and fades, and a few drops flung outwards. Layers are named "ink"
    so the app can tint them to the stamp's colour."""
    W, H, OP = 300, 300, 36
    c = [W / 2, H / 2, 0]
    layers = []
    ring_s = [(f, [60 + 90 * (1 - (1 - f / OP) ** 3)] * 2 + [100]) for f in range(0, OP + 1, 2)]
    ring_o = [(f, round(85 * (1 - f / OP) ** 1.5, 1)) for f in range(0, OP + 1, 2)]
    layers.append(layer(1, 'ink', [group([ellipse(180, 180), stroke(PURPLE, 7)], 'ink')], transform(p=static(c), s=animated(ring_s), o=animated(ring_o)), OP))
    rnd = random.Random(3)
    for i in range(10):
        ang = 2 * math.pi * i / 10 + rnd.uniform(-0.2, 0.2)
        dist = rnd.uniform(95, 135)
        size = rnd.uniform(6, 12)
        pos = []
        for f in range(0, OP + 1, 2):
            k = 1 - (1 - f / OP) ** 2.2
            pos.append((f, [round(c[0] + math.cos(ang) * (60 + (dist - 60) * k), 1), round(c[1] + math.sin(ang) * (60 + (dist - 60) * k), 1), 0]))
        opa = [(f, round(95 * (1 - f / OP), 1)) for f in range(0, OP + 1, 2)]
        layers.append(layer(i + 2, 'ink', [group([ellipse(size, size), fill(PURPLE)], 'ink')], transform(p=animated(pos), o=animated(opa)), OP))
    return doc('stamp', W, H, OP, layers)


def travel():
    """A globe with a paper plane flying round it: smaller and fainter behind, larger in front."""
    W, H, OP = 240, 240, 240
    cx, cy = W / 2, H / 2 + 6
    layers = []
    # Plane (drawn first so it sits on top: the first layer is the top one in Lottie).
    pos, rot, scl, opa = [], [], [], []
    for f in range(0, OP + 1, 2):
        a = 2 * math.pi * f / OP
        x = cx + 98 * math.cos(a)
        y = cy - 8 + 34 * math.sin(a) - 10 * math.cos(a)
        dx = -98 * math.sin(a)
        dy = 34 * math.cos(a) + 10 * math.sin(a)
        front = (math.sin(a) + 1) / 2  # 1 at the front (bottom of the ellipse), 0 behind
        pos.append((f, [round(x, 1), round(y, 1), 0]))
        rot.append((f, round(math.degrees(math.atan2(dy, dx)), 1)))
        scl.append((f, [round(70 + 45 * front, 1)] * 2 + [100]))
        opa.append((f, round(35 + 65 * front, 1)))
    # Keep the rotation continuous (no 360° jumps).
    for i in range(1, len(rot)):
        while rot[i][1] - rot[i - 1][1] > 180:
            rot[i] = (rot[i][0], rot[i][1] - 360)
        while rot[i][1] - rot[i - 1][1] < -180:
            rot[i] = (rot[i][0], rot[i][1] + 360)
    plane = group([path([(16, 0), (-12, -11), (-6, 0), (-12, 11)]), fill(PURPLE)], 'plane')
    fold = group([path([(16, 0), (-6, 0), (-12, 11)]), fill('#4a0173')], 'fold')
    layers.append(layer(1, 'plane', [fold, plane], transform(p=animated(pos), r=animated(rot), s=animated(scl), o=animated(opa)), OP))
    # Orbit (dashed).
    layers.append(layer(2, 'orbit', [group([ellipse(196, 68, (0, -8)), stroke(LAVENDER, 2, 70, dash=(6, 8))])], transform(p=static([cx, cy, 0])), OP))
    # Globe: a gentle bob, meridians and an equator.
    bob = [(f, [cx, round(cy + 3 * math.sin(2 * math.pi * f / OP * 2), 1), 0]) for f in range(0, OP + 1, 4)]
    globe = [
        group([ellipse(30, 108), stroke(PURPLE, 2.5, 55)], 'meridian'),
        group([ellipse(76, 108), stroke(PURPLE, 2.5, 55)], 'meridian2'),
        group([path([(-54, 0), (54, 0)], closed=False), stroke(PURPLE, 2.5, 55)], 'equator'),
        group([path([(-46, -28), (46, -28)], closed=False), stroke(PURPLE, 2, 40)], 'north'),
        group([path([(-46, 28), (46, 28)], closed=False), stroke(PURPLE, 2, 40)], 'south'),
        group([ellipse(108, 108), fill('#efe0fb'), stroke(PURPLE, 3)], 'globe'),
    ]
    layers.append(layer(3, 'globe', globe, transform(p=animated(bob)), OP))
    return doc('travel', W, H, OP, layers)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, make in (('confetti', confetti), ('stamp', stamp), ('travel', travel)):
        with open(os.path.join(OUT, f'{name}.json'), 'w') as f:
            json.dump(make(), f, separators=(',', ':'))
        print('wrote', name, os.path.getsize(os.path.join(OUT, f'{name}.json')), 'bytes')


if __name__ == '__main__':
    main()
