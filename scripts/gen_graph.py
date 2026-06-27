import re, sys, os

# Repo-relative: BOARD_VERIFICATION.md sits one level up from scripts/.
# Regenerate the diagram with:  python3 scripts/gen_graph.py   (prints the ```mermaid block)
SRC = os.path.join(os.path.dirname(__file__), "..", "BOARD_VERIFICATION.md")
text = open(SRC).read().splitlines()

# --- slice §3a (between '### 3a' first occurrence and '### 3b') ---
start = next(i for i,l in enumerate(text) if l.startswith("### 3a"))
end   = next(i for i,l in enumerate(text) if l.startswith("### 3b"))
block = text[start:end]

# --- valid ids ---
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
valid = set()
sector_of = {}
for s,n in sizes.items():
    for i in range(1,n+1):
        vid=f"{s}_{i}"; valid.add(vid); sector_of[vid]=s
for s,names in named_sector.items():
    for nm in names:
        valid.add(nm); sector_of[nm]=s

# regex to find ids: positional sX_N or any named (longest-first to avoid prefix issues)
named_all = sorted([nm for v in named_sector.values() for nm in v], key=len, reverse=True)
id_re = re.compile(r'\bs[1-8]_\d+\b|\b(?:' + '|'.join(named_all) + r')\b')

# area line: starts with an id then optional (tag) then ':'
area_re = re.compile(r'^([a-z0-9_]+)(?:\s*\([^)]*\))?\s*:\s*(.*)$')

adj = {v:set() for v in valid}
asym = []
for line in block:
    m = area_re.match(line)
    if not m: continue
    area = m.group(1)
    if area not in valid: continue
    rest = m.group(2).split('#')[0]  # drop trailing comments (may contain "NOT x")
    nbrs = set(id_re.findall(rest)) - {area}
    nbrs = {n for n in nbrs if n in valid}
    for n in nbrs:
        adj[area].add(n)

# symmetric union + asymmetry report
edges = set()
allnodes = set(adj)
for a in adj:
    for b in adj[a]:
        edges.add(tuple(sorted((a,b))))
for a,b in sorted(edges):
    if b not in adj or a not in adj[b] if False else False: pass
# asymmetry: a lists b but b does not list a
for a in adj:
    for b in adj[a]:
        if a not in adj.get(b,set()):
            asym.append((a,b))

print(f"nodes={len(valid)} edges={len(edges)} asymmetric_dir_edges={len(asym)}", file=sys.stderr)
# degree per node
for v in sorted(valid, key=lambda x:(sector_of[x],x)):
    pass
if asym:
    print("ASYMMETRIES (A lists B but B omits A):", file=sys.stderr)
    for a,b in sorted(asym): print(f"  {a} -> {b}", file=sys.stderr)

# isolated nodes
iso = [v for v in valid if not adj[v]]
if iso: print("ISOLATED:", iso, file=sys.stderr)

# --- parse §4 impassable pairs ---
imp=set()
i4=next(i for i,l in enumerate(text) if l.startswith("## 4."))
i5=next(i for i,l in enumerate(text) if l.startswith("## 5."))
for line in text[i4:i5]:
    m=re.match(r'^([a-z0-9_]+)\s*<->\s*([a-z0-9_]+)', line)
    if m and m.group(1) in valid and m.group(2) in valid:
        imp.add(tuple(sorted((m.group(1),m.group(2)))))

# --- Mermaid output ---
order = ['s1','s2','s3','s4','s5','s6','s7','s8','np']
label = {'s1':'s1 NE-outer','s2':'s2 SE-outer','s3':'s3 SW-outer','s4':'s4 NW-outer',
         's5':'s5 NE-inner','s6':'s6 SE-inner','s7':'s7 SW-inner','s8':'s8 NW-inner','np':'North Pole'}
out=['```mermaid','graph TD']
for s in order:
    members=sorted([v for v in valid if sector_of[v]==s])
    out.append(f'  subgraph {s}["{label[s]}"]')
    for v in members:
        out.append(f'    {v}')
    out.append('  end')
adj_edges=sorted(edges)
for a,b in adj_edges:
    out.append(f'  {a} --- {b}')
imp_edges=sorted(imp)
for a,b in imp_edges:
    out.append(f'  {a} -.->|red| {b}')
# style impassable links red+dashed (they are the last len(imp_edges) links)
n=len(adj_edges)
idxs=','.join(str(n+i) for i in range(len(imp_edges)))
if idxs:
    out.append(f'  linkStyle {idxs} stroke:#e23,stroke-width:2px,stroke-dasharray:4')
out.append('```')
print('\n'.join(out))
print(f"GRAPH: {len(valid)} nodes, {len(adj_edges)} passable edges, {len(imp_edges)} impassable", file=sys.stderr)
