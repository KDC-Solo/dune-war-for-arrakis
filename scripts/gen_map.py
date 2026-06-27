"""Emit a Graphviz DOT 'map' of the board from BOARD_VERIFICATION.md §3a/§4.
Nodes = areas (boxes, colored by sector); solid edges = passable borders;
red dashed = impassable. Render with a force-directed engine so neighbours sit
adjacent, e.g.:  python3 scripts/gen_map.py | neato -Tpng -o board_map.png
"""
import re, os, sys

SRC = os.path.join(os.path.dirname(__file__), "..", "BOARD_VERIFICATION.md")
text = open(SRC).read().splitlines()
start = next(i for i,l in enumerate(text) if l.startswith("### 3a"))
end   = next(i for i,l in enumerate(text) if l.startswith("### 3b"))
block = text[start:end]

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

named_all = sorted([nm for v in named_sector.values() for nm in v], key=len, reverse=True)
id_re = re.compile(r'\bs[1-8]_\d+\b|\b(?:' + '|'.join(named_all) + r')\b')
area_re = re.compile(r'^([a-z0-9_]+)(?:\s*\([^)]*\))?\s*:\s*(.*)$')

adj={v:set() for v in valid}
for line in block:
    m=area_re.match(line)
    if not m: continue
    a=m.group(1)
    if a not in valid: continue
    for n in id_re.findall(m.group(2).split('#')[0]):
        if n in valid and n!=a: adj[a].add(n)
edges=set()
for a in adj:
    for b in adj[a]: edges.add(tuple(sorted((a,b))))

# impassable from §4
imp=set()
i4=next(i for i,l in enumerate(text) if l.startswith("## 4."))
i5=next(i for i,l in enumerate(text) if l.startswith("## 5."))
for line in text[i4:i5]:
    m=re.match(r'^([a-z0-9_]+)\s*<->\s*([a-z0-9_]+)', line)
    if m and m.group(1) in valid and m.group(2) in valid:
        imp.add(tuple(sorted((m.group(1),m.group(2)))))

fill={'s1':'#ffd9d9','s2':'#ffe9cc','s3':'#fff7cc','s4':'#dcf5d0','s5':'#d9ecff',
      's6':'#e6dcff','s7':'#ffdcf0','s8':'#d6fff2','np':'#bbbbbb'}

# --- physical-board orientation (board-relative: N=top, E=right, W=left, pole=centre) ---
# Minimal 9-point skeleton pinned to fix orientation; everything else force-laid freely.
ANCHORS={
 'north_pole':(0,0),
 # inner ring: each inner sector's pole-touching node, in its quadrant
 's5_3':(2.2,1.6),'wind_pass':(-2.2,1.6),'s6_1':(2.2,-1.6),'s7_4':(-2.2,-1.6),
 # outer ring: a far corner of each outer sector
 's1_10':(8.0,5.0),'s2_4':(8.0,-5.0),'s3_4':(-8.0,-5.0),'s4_1':(-8.0,5.0),
}

def short(v):  # compact labels for the long named areas
    abbr={'the_funeral_plain':'Funeral Plain','rock_outcroppings':'Rock Outcrop','bight_of_the_cliff':'Bight of Cliff',
          'the_great_flat':'Great Flat','hole_in_the_rock':'Hole in Rock','false_wall_west':'FW West',
          'false_wall_east':'FW East','false_wall_south':'FW South','shield_wall_1':'Shield Wall 1',
          'shield_wall_2':'Shield Wall 2','rimwall_west':'Rimwall West','broken_land':'Broken Land',
          'splintered_rock':'Splintered Rk','imperial_basin':'Imperial Basin','sihaya_ridge':'Sihaya Ridge',
          'gara_kulon':'Gara Kulon','habbanya_ridge':'Habbanya Rdg','tasmin_sink':'Tasmin Sink',
          'pasty_mesa':'Pasty Mesa','harg_pass':'Harg Pass','hobars_gap':'Hobars Gap','wind_pass':'Wind Pass',
          'hagga_basin':'Hagga Basin','north_pole':'NORTH POLE'}
    return abbr.get(v, v)

out=[]
out.append('graph board {')
out.append('  layout=neato; overlap=false; sep="+9"; splines=true; bgcolor=white;')
out.append('  node [shape=box, style="filled,rounded", fontname="Helvetica", fontsize=10, '
           'margin="0.06,0.03", penwidth=0.6];')
out.append('  edge [color="#aaaaaa", penwidth=0.7];')
for v in sorted(valid):
    posattr=''
    if v in ANCHORS:
        x,y=ANCHORS[v]; posattr=f', pos="{x},{y}!"'
    out.append(f'  "{v}" [label="{short(v)}", fillcolor="{fill[sector_of[v]]}"{posattr}];')
for a,b in sorted(edges):
    out.append(f'  "{a}" -- "{b}";')
for a,b in sorted(imp):
    out.append(f'  "{a}" -- "{b}" [color="#e23",penwidth=2.0,style=dashed];')
out.append('}')
sys.stdout.write('\n'.join(out)+'\n')
sys.stderr.write(f"{len(valid)} nodes, {len(edges)} passable, {len(imp)} impassable\n")
