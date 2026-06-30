#!/usr/bin/env python3
"""Generate src/engine/boardShapes.ts from the local reference image docs/images/dune-map.png.

Each area's captured centroid (boardPositions.ts) aligns with that image, so a watershed seeded from
the centroids recovers every region's real outline (organic inner areas + radial sand sectors). The
dark boundary lines get their own watershed label so no area absorbs the ridge network. Also detects
the pink air-zone circles and matches each to its AIR_ZONE by nearest member centroid.

Run from the repo root:  python3 scripts/layout/extract_shapes.py
Requires: numpy, scipy, contourpy (matplotlib), pillow. The image is gitignored — keep it local.
"""
import re
import numpy as np
from PIL import Image
from scipy import ndimage
import contourpy

IMG = 'docs/images/dune-map.png'
OUT = 'src/engine/boardShapes.ts'
SIMPLIFY = 2.2  # Douglas-Peucker tolerance in source pixels

pos = open('src/engine/boardPositions.ts').read()
POS = {m[0]: (float(m[1]), float(m[2])) for m in re.findall(r'"([a-z0-9_]+)":\s*\[([0-9.]+),\s*([0-9.]+)\]', pos)}
ids = list(POS)
board = open('src/engine/board.ts').read()
AZ = [(m.group(1), re.findall(r'"([a-z0-9_]+)"', m.group(2)))
      for m in re.finditer(r'id:\s*"(az\d)",\s*areas:\s*\[([^\]]*)\]', board)]

im = np.asarray(Image.open(IMG).convert('RGB')).astype(int)
H, W = im.shape[:2]
R, G, B = im[..., 0], im[..., 1], im[..., 2]
lum = 0.299 * R + 0.587 * G + 0.114 * B

# --- area polygons via centroid-seeded watershed -------------------------------------------------
cost = np.clip(255 - lum, 0, 255).astype(np.uint8)
markers = np.zeros((H, W), dtype=np.int16)
markers[lum < 110] = len(ids) + 1  # dark lines get their own label, so no area absorbs the ridges
for i, id in enumerate(ids, start=1):
    x, y = POS[id]
    px, py = int(round(x * W)), int(round(y * H))
    markers[py - 2:py + 3, px - 2:px + 3] = i
lab = ndimage.watershed_ift(cost, markers)


def dp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = (b[0] - a[0], b[1] - a[1])
    L = (ab[0] ** 2 + ab[1] ** 2) ** .5 or 1
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        q = pts[i]
        d = abs((q[0] - a[0]) * ab[1] - (q[1] - a[1]) * ab[0]) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return dp(pts[:idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [a, b]


def dp_closed(pts, eps):
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 4:
        return pts
    a = pts[0]
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - a[0]) ** 2 + (pts[i][1] - a[1]) ** 2)
    return dp(pts[:far + 1], eps)[:-1] + dp(pts[far:] + [pts[0]], eps)[:-1]


SHAPES = {}
for i, id in enumerate(ids, start=1):
    mask = (lab == i).astype(float)
    if mask.sum() < 50:
        continue
    lines = contourpy.contour_generator(z=mask).lines(0.5)
    if not lines:
        continue
    poly = [(float(p[0]), float(p[1])) for p in max(lines, key=len)]
    poly = dp_closed(poly, SIMPLIFY)
    if len(poly) > 2 and poly[0] != poly[-1]:
        poly.append(poly[0])
    SHAPES[id] = [[round(x / W, 4), round(y / H, 4)] for x, y in poly]

# --- air-zone circles ----------------------------------------------------------------------------
pink = (R > 180) & (G > 90) & (G < 175) & (B > 120) & (B < 210) & (R - G > 45) & (B - G > 10)
plab, pn = ndimage.label(pink)
psz = ndimage.sum(np.ones_like(plab), plab, range(1, pn + 1))
circ = []
for i in range(1, pn + 1):
    if psz[i - 1] < 300:
        continue
    ys, xs = np.where(plab == i)
    circ.append((xs.mean() / W, ys.mean() / H))
DOTS, used = {}, set()
for az, areas in AZ:
    cs = [POS[a] for a in areas if a in POS]
    mx, my = sum(c[0] for c in cs) / len(cs), sum(c[1] for c in cs) / len(cs)
    j = min((k for k in range(len(circ)) if k not in used), key=lambda k: (circ[k][0] - mx) ** 2 + (circ[k][1] - my) ** 2)
    used.add(j)
    DOTS[az] = (round(circ[j][0], 4), round(circ[j][1], 4))

# --- emit ----------------------------------------------------------------------------------------
out = ['// AUTO-GENERATED from docs/images/dune-map.png by scripts/layout/extract_shapes.py.',
       '// Each area is the traced outline of its real region on the board (normalized 0..1, [x,y]).',
       '// Regenerate: python3 scripts/layout/extract_shapes.py',
       'export const AREA_SHAPES: Record<string, readonly (readonly [number, number])[]> = {']
for id in sorted(SHAPES):
    out.append(f'  {id}: [{",".join(f"[{x},{y}]" for x, y in SHAPES[id])}],')
out += ['};', '',
        '// Air-zone circles (ornithopter/carryall), detected from dune-map.png (radius ~16 board units).',
        'export const AIR_ZONE_DOTS: Record<string, readonly [number, number]> = {']
for az, _ in AZ:
    out.append(f'  {az}: [{DOTS[az][0]}, {DOTS[az][1]}],')
out.append('};')
open(OUT, 'w').write('\n'.join(out) + '\n')
print(f'wrote {OUT}: {len(SHAPES)} areas, {len(DOTS)} air zones')
