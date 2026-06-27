"""Generate src/engine/board.ts from BOARD_VERIFICATION.md (the verified source of truth).

Parses §3a (adjacency), §4 (impassable), §5 (air zones); area membership/sector from the
known roster; named-area metadata (name/terrain/deep/feature) is the small hard-coded table
below (from §1). Unnamed areas keep terrain=null/deep=null where not yet typed (a known gap;
the adjacency GRAPH is complete and verified — terrain typing is a later pass).

Run:  python3 scripts/gen_board.py > src/engine/board.ts
"""
import re, os, sys

SRC = os.path.join(os.path.dirname(__file__), "..", "BOARD_VERIFICATION.md")
text = open(SRC).read().splitlines()

# ---- area universe (sector membership) ----
named_sector = {
 's1': ['sihaya_ridge','gara_kulon'],
 's2': ['pasty_mesa','tasmin_sink'],
 's3': ['habbanya_ridge'],
 's4': ['the_funeral_plain','rock_outcroppings','bight_of_the_cliff','the_great_flat'],
 's5': ['carthag','arrakeen','imperial_basin','broken_land','rimwall_west','hole_in_the_rock','shield_wall_1'],
 's6': ['false_wall_south','false_wall_east','harg_pass','hobars_gap'],
 's7': ['false_wall_west','windgap'],
 's8': ['arsunt','hagga_basin','splintered_rock','shield_wall_2','wind_pass'],
 'np': ['north_pole'],
}
sizes = {'s1':16,'s2':8,'s3':9,'s4':16,'s5':9,'s6':5,'s7':6,'s8':4}
valid=set(); sector_of={}
for s,n in sizes.items():
    for i in range(1,n+1):
        v=f"{s}_{i}"; valid.add(v); sector_of[v]=s
for s,names in named_sector.items():
    for nm in names: valid.add(nm); sector_of[nm]=s

# ---- named-area metadata: id -> (Name, terrain, deep, settlement|None, sietch) ----
NAMED = {
 'arrakeen': ('Arrakeen','plateau',False,3,False),
 'carthag': ('Carthag','plateau',False,2,False),
 'arsunt': ('Arsunt','plateau',False,1,False),
 'hagga_basin': ('Hagga Basin','plateau',False,1,False),
 'imperial_basin': ('Imperial Basin','plateau',False,1,False),
 'north_pole': ('North Pole','mountain',False,1,False),
 'false_wall_west': ('False Wall West','plateau',False,None,False),
 'false_wall_south': ('False Wall South','plateau',False,None,False),
 'pasty_mesa': ('Pasty Mesa','plateau',False,None,False),
 'hole_in_the_rock': ('Hole in the Rock','mountain',False,None,False),
 'shield_wall_1': ('Shield Wall','mountain',False,None,False),
 'shield_wall_2': ('Shield Wall','mountain',False,None,False),
 'broken_land': ('Broken Land','mountain',False,None,False),
 'rimwall_west': ('Rimwall West','mountain',False,None,False),
 'splintered_rock': ('Splintered Rock','mountain',False,None,False),
 'false_wall_east': ('False Wall East','mountain',False,None,False),
 'harg_pass': ('Harg Pass','minor_erg',False,None,False),
 'sihaya_ridge': ('Sihaya Ridge','desert',True,None,True),
 'rock_outcroppings': ('Rock Outcroppings','desert',True,None,True),
 'the_great_flat': ('The Great Flat','desert',True,None,False),
 'bight_of_the_cliff': ('Bight of the Cliff','desert',False,None,True),
 'the_funeral_plain': ('The Funeral Plain','desert',False,None,False),
 'windgap': ('Windgap','desert',False,None,True),
 'habbanya_ridge': ('Habbanya Ridge','desert',False,None,True),
 'gara_kulon': ('Gara Kulon','desert',False,None,True),
 'hobars_gap': ('Hobars Gap','desert',False,None,True),
 'tasmin_sink': ('Tasmin Sink','desert',False,None,True),
 'wind_pass': ('Wind Pass','desert',False,None,False),
}
# unnamed areas whose terrain we pinned during the §3 pass (deep=False; none are deep desert)
KNOWN_UNNAMED = {'s5_8':'minor_erg','s4_16':'mountain','s8_2':'mountain'}

# ---- parse §6 per-area terrain (TERRAIN/DEEP lines) ----
TERRAIN_BY_ID = {}   # id -> terrain
DEEP_IDS = set()     # ids explicitly deep
TYPED_SECTORS = set()
for line in text:
    m = re.match(r'^TERRAIN\s+(\w+):\s*(\w+)\s*=\s*(.+)$', line)
    if m:
        sec, terr, rhs = m.group(1), m.group(2), m.group(3).strip()
        members = [v for v in valid if sector_of[v] == sec]
        targets = members if rhs.strip() == 'ALL' else [x.strip() for x in rhs.split(',')]
        for t in targets:
            if t in valid: TERRAIN_BY_ID[t] = terr
        TYPED_SECTORS.add(sec)
        continue
    m = re.match(r'^DEEP\s+(\w+):\s*(.+)$', line)
    if m:
        for t in [x.strip() for x in m.group(2).split(',')]:
            if t in valid: DEEP_IDS.add(t)

# ---- parse ecological testing stations (STATIONS line) ----
STATION_IDS = set()
for line in text:
    m = re.match(r'^STATIONS:\s*(.+)$', line)
    if m:
        for t in [x.strip() for x in m.group(1).split(',')]:
            if t in valid: STATION_IDS.add(t)

# ---- parse §3a adjacency ----
start = next(i for i,l in enumerate(text) if l.startswith("### 3a"))
end   = next(i for i,l in enumerate(text) if l.startswith("### 3b"))
named_all = sorted([nm for v in named_sector.values() for nm in v], key=len, reverse=True)
id_re = re.compile(r'\bs[1-8]_\d+\b|\b(?:' + '|'.join(named_all) + r')\b')
area_re = re.compile(r'^([a-z0-9_]+)(?:\s*\([^)]*\))?\s*:\s*(.*)$')
adj={v:set() for v in valid}
for line in text[start:end]:
    m=area_re.match(line)
    if not m or m.group(1) not in valid: continue
    a=m.group(1)
    for n in id_re.findall(m.group(2).split('#')[0]):
        if n in valid and n!=a: adj[a].add(n); adj[n].add(a)  # force symmetric

# ---- parse §4 impassable ----
imp=set()
i4=next(i for i,l in enumerate(text) if l.startswith("## 4."))
i5=next(i for i,l in enumerate(text) if l.startswith("## 5."))
for line in text[i4:i5]:
    m=re.match(r'^([a-z0-9_]+)\s*<->\s*([a-z0-9_]+)', line)
    if m and m.group(1) in valid and m.group(2) in valid:
        imp.add(tuple(sorted((m.group(1),m.group(2)))))

# ---- parse §5 air zones ----
azones=[]
i5b=next(i for i,l in enumerate(text) if l.startswith("## 5."))
for line in text[i5b:]:
    m=re.match(r'^\|\s*(az\d+)\s*\|\s*([^|]+?)\s*\|', line)
    if not m: continue
    ids=[x.strip() for x in m.group(2).split(',')]
    ids=[x for x in ids if x in valid]
    if ids: azones.append((m.group(1), ids))

# ---- emit TypeScript ----
def ts_str(s): return 'null' if s is None else '"%s"' % s
def area_meta(v):
    if v in NAMED:
        name, nterr, ndeep, settle, sietch = NAMED[v]
    else:
        name, nterr, ndeep, settle, sietch = None, None, None, None, False
    terr = TERRAIN_BY_ID.get(v) or nterr or KNOWN_UNNAMED.get(v)   # §6 > §1-named > pinned
    if sector_of[v] in TYPED_SECTORS:
        deep = (v in DEEP_IDS)
    elif v in NAMED:
        deep = ndeep
    elif terr is not None:
        deep = False
    else:
        deep = None
    deep_s = 'null' if deep is None else ('true' if deep else 'false')
    station = ('true' if v in STATION_IDS else 'false')
    return ts_str(name), ts_str(terr), deep_s, (str(settle) if settle else 'null'), ('true' if sietch else 'false'), station

o=[]
o.append('// AUTO-GENERATED by scripts/gen_board.py from BOARD_VERIFICATION.md — do not edit by hand.')
o.append('// Regenerate: npm run gen:board')
o.append('//')
o.append('// Source of truth: BOARD_VERIFICATION.md (§1/§6 terrain, §2 sectors, §3a adjacency, §4 impassable, §5 air zones).')
o.append('// All 101 areas are fully terrain-typed (plateau 12 / mountain 19 / minor_erg 5 / desert 65; deep 23).')
o.append('')
o.append("export type Terrain = 'plateau' | 'mountain' | 'desert' | 'minor_erg';")
o.append("export type SectorId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 'np';")
o.append('')
o.append('export interface Area {')
o.append('  id: string;')
o.append('  name: string | null;        // proper name for named areas; null for unnamed sX_N')
o.append('  sector: SectorId;')
o.append('  terrain: Terrain | null;    // null = not yet typed')
o.append('  deep: boolean | null;       // deep desert (worm/spice); null = unknown (untyped)')
o.append('  settlement: 1 | 2 | 3 | null; // settlement rank (Pyon I / Carthag II / Arrakeen III)')
o.append('  sietch: boolean;')
o.append('  testingStation: boolean;    // ecological testing station present')
o.append('}')
o.append('')
o.append('export const AREAS: Record<string, Area> = {')
for v in sorted(valid):
    name,terr,deep,settle,sietch,station = area_meta(v)
    o.append(f'  "{v}": {{ id: "{v}", name: {name}, sector: "{sector_of[v]}", terrain: {terr}, deep: {deep}, settlement: {settle}, sietch: {sietch}, testingStation: {station} }},')
o.append('};')
o.append('')
o.append('export const AREA_IDS: readonly string[] = Object.keys(AREAS);')
o.append('')
o.append('/** Passable (white-border) ground adjacency. Symmetric. Impassable pairs are NOT here. */')
o.append('export const ADJACENCY: Record<string, readonly string[]> = {')
for v in sorted(valid):
    nb=', '.join('"%s"'%x for x in sorted(adj[v]))
    o.append(f'  "{v}": [{nb}],')
o.append('};')
o.append('')
o.append('/** Impassable (red) borders — physically touching but NOT traversable by ground. */')
o.append('export const IMPASSABLE: readonly (readonly [string, string])[] = [')
for a,b in sorted(imp):
    o.append(f'  ["{a}", "{b}"],')
o.append('];')
o.append('')
o.append('export interface AirZone { id: string; areas: readonly string[]; }')
o.append('/** Air zones (ornithopter circles): each connects its specific set of areas. */')
o.append('export const AIR_ZONES: readonly AirZone[] = [')
for az,ids in azones:
    arr=', '.join('"%s"'%x for x in ids)
    o.append(f'  {{ id: "{az}", areas: [{arr}] }},')
o.append('];')
o.append('')
sys.stdout.write('\n'.join(o)+'\n')
sys.stderr.write(f"emitted {len(valid)} areas, {sum(len(a) for a in adj.values())//2} edges, "
                 f"{len(imp)} impassable, {len(azones)} air zones\n")
