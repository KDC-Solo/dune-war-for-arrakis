# Board verification checklist — please correct

**v2** — re-extracted from your physical-board photos (`docs/map/`), far more reliable
than the rulebook art. You correct it; then I generate the engine's `board.ts` from it.

**Confidence key:** ✅ confident · 🟡 likely · ❓ guess — please verify

**Board structure (confirmed):** two square sections joined at a central seam; polar map
with the **North Pole as the central hub**. Sectors radiate from the pole (4 central ring +
4 outer ring).

**Board orientation reference (confirmed — this is how the board is laid out & how we label it):**
The board sits in landscape, two square halves side by side. Our **N/E/S/W labels are
BOARD-relative (the physical edges), NOT in-world map directions** — the board is a polar
projection so in-world "north" is the North Pole at the **centre**, and every edge is really
"south" (away from the pole). Anchors for the board-relative compass:
- **West = left edge** → has the **Supremacy track**
- **East = right edge** → has the **Prescience track**
- **North = top edge** → beyond the Broken Land / Rimwall West mountain arc
- **South = bottom edge**
- **Centre = North Pole** (in-world north / the hub all air zones connect to)

**How to correct:** edit the tables directly. For adjacency, list area IDs sharing a **white
border**. Put **red/white impassable** pairs in §4 instead, not §3.

---

## 1. Areas

**TYPE = COLOUR (your rule):** dark-**orange** terrain → `plateau` · dark-**grey** terrain →
`mountain` · pale sandy/dune terrain → `desert` (`minor_erg` if it's the distinct erg texture).
I re-typed every area below by colour. 🟡 marks shadowed ridges where grey-vs-orange is hard to
judge from the photos — please eyeball these.

`deep`: Y if a desert touches the board edge · `feature`: settlement rank (I/II/III) or sietch

### Plateaus (dark orange) — incl. all the cities
| id | name | type | feature | conf |
|----|------|------|---------|------|
| arrakeen | Arrakeen | plateau | settlement III | ✅ |
| carthag | Carthag | plateau | settlement II | ✅ |
| arsunt | Arsunt | plateau | settlement I (Pyon village) | ✅ |
| hagga_basin | Hagga Basin | plateau | settlement I (Pyon village) | ✅ |
| imperial_basin | Imperial Basin | plateau | settlement I (Pyon village) | ✅ |
| false_wall_west | False Wall West | plateau | – | ✅ (your call) |
| false_wall_south | False Wall South | plateau | – | ✅ (your call) |
| pasty_mesa | Pasty Mesa | plateau | – | ✅ (your call) |

### Mountains (dark grey)
| id | name | type | feature | conf |
|----|------|------|---------|------|
| north_pole | North Pole | mountain | settlement I (Pyon village — the 4th) | ✅ |
| hole_in_the_rock | Hole in the Rock | mountain | – | ✅ (your call) |
| shield_wall | Shield Wall | mountain | – (west border impassable) | ✅ |
| broken_land | Broken Land | mountain | – | ✅ |
| rimwall_west | Rimwall West | mountain | – (a Rimwall **East** too? verify) | ✅ (your call) |
| splintered_rock | Splintered Rock | mountain | – | ✅ (your call) |
| false_wall_east | False Wall East | mountain | – | ✅ (your call) |

### Minor erg — 5 areas, contiguous chain starting at Harg Pass (only Harg Pass is named)
| id | name | type | feature | conf |
|----|------|------|---------|------|
| harg_pass | Harg Pass | minor_erg | – | ✅ (named) |
| minor_erg_2 | (unnamed minor erg) | minor_erg | – | ✅ (your call) |
| minor_erg_3 | (unnamed minor erg) | minor_erg | – | ✅ (your call) |
| minor_erg_4 | (unnamed minor erg) | minor_erg | – | ✅ (your call) |
| minor_erg_5 | (unnamed minor erg) | minor_erg | – | ✅ (your call) |

> The 4 unnamed minor ergs are adjacent to each other and to Harg Pass, forming one connected
> run (this is the large pale central region I had mislabeled `central_erg` — now resolved as
> these 5 minor ergs). I'll order erg_2→erg_5 along the chain once you confirm/refine §3 links.

### Desert (pale sand) — `deep`: only Sihaya Ridge, Rock Outcroppings, The Great Flat
| id | name | type | deep | feature | conf |
|----|------|------|------|---------|------|
| sihaya_ridge | Sihaya Ridge | desert | Y | sietch | ✅ |
| rock_outcroppings | Rock Outcroppings | desert | Y | sietch | ✅ |
| the_great_flat | The Great Flat | desert | Y | – | ✅ |
| bight_of_the_cliff | Bight of the Cliff | desert | N | sietch | ✅ |
| the_funeral_plain | The Funeral Plain | desert | N | – | ✅ |
| windgap | Windgap (next to False Wall West) | desert | N | sietch | ✅ (name) |
| habbanya_ridge | Habbanya Ridge | desert | N | sietch | ✅ (name) |
| gara_kulon | Gara Kulon | desert | N | sietch | ✅ (name) |
| hobars_gap | Hobars Gap | desert | N | sietch | ✅ (name) |
| tasmin_sink | Tasmin Sink | desert | N | sietch | ✅ (name) |
| wind_pass | Wind Pass | desert | N | – | ✅ (s8; new — not a sietch) |

> **All 8 sietches named** ✅: Sihaya Ridge, Rock Outcroppings, Bight of the Cliff, Windgap,
> Habbanya Ridge, Gara Kulon, Hobars Gap, Tasmin Sink. (Still set `deep` Y/N per sietch.)
>
### Unnamed deep-desert areas (outer ring) — counting from user
All `type=desert`, `deep=Y`. **Counting convention:** the 4 **corner** areas are each one area
shared by two edges, so an edge's count *includes* its corners. Unique areas = corners + middles.

**Corners (4) — each shared by two edges**
| id | corner | shared by |
|----|--------|-----------|
| desert_nw | NW | North + West |
| desert_ne | NE | North + East |
| desert_sw | SW | West + South |
| desert_se | SE | South + East |

**Edge middles (non-corner)**
| id | edge | conf |
|----|------|------|
| desert_n2 | North | ✅ North=6 (= nw + ne + 4 middles) |
| desert_n3 | North | ✅ |
| desert_n4 | North | ✅ |
| desert_n5 | North | ✅ |
| desert_w2 | West | ✅ West=4 (= nw + sw + 2 middles) |
| desert_w3 | West | ✅ |
| desert_s1 | South | ✅ South=8 (= sw + se + 6 middles) |
| desert_s2 | South | ✅ |
| desert_s3 | South | ✅ |
| desert_s4 | South | ✅ |
| desert_s5 | South | ✅ |
| desert_s6 | South | ✅ |
| desert_e1 | East | ✅ East=6 (= ne + se + 4 middles) |
| desert_e2 | East | ✅ |
| desert_e3 | East | ✅ |
| desert_e4 | East | ✅ |

> **All four edges confirmed:** North=6 · West=4 · South=8 · East=6 (each includes its 2 corners).
> **Unique unnamed deep-desert areas = 20** (4 corners + 4 N + 2 W + 6 S + 4 E middles).
> Check: edge sum 6+4+8+6 = 24, minus 4 corners counted twice = 20. ✅
>
> These 20 unnamed areas + the named ones get assigned to sectors in §2 below.

---

## 2. Sectors (8 total: 4 central + 4 outer)

Each **area belongs to exactly one sector**. For each sector you give: **# areas** + the
**count per terrain type**. Direction labels are board-relative (see top note). We reconcile
against the grand totals as we go, then assign the actual member areas.

**Reliable pre-sector caps (confirmed by user):** minor_erg **5** (Harg Pass + 4) · deep-desert **23**
(20 unnamed per-edge + Sihaya Ridge, Rock Outcroppings, Great Flat). Both ✅ matched by the sector counts.

**NOT caps — only NAMED subsets** (sectors revealed many unnamed areas of these types too):
plateau named 8 · mountain named 7 · non-deep desert named 7. Real totals come from the sectors below.

| sector | c/o | #areas | plat | mtn | m.erg | deep des | desert |
|--------|-----|--------|------|-----|-------|----------|--------|
| sector | dir | #areas | plat | mtn | m.erg | deep des | desert |
| s1 | NE outer | 18 | 0 | 0 | 0 | 7 | 11 |
| s2 | SE outer | 10 | 2 | 0 | 0 | 4 | 4 |
| s3 | SW outer | 10 | 1 | 0 | 0 | 5 | 4 |
| s4 | NW outer | 20 | 0 | 4 | 0 | 6 | 10 |
| **outer Σ** | s1–s4 | **58** | **3** | **4** | **0** | **22** | **29** |
| s5 | NE inner | 16 | 4 | 9 | 2 | 0 | 1 |
| s6 | SE inner | 9 | 1 | 1 | 3 | 1 | 3 |
| s7 | SW inner | 8 | 2 | 0 | 0 | 0 | 6 |
| s8 | NW inner | 9 | 2 | 4 | 0 | 0 | 3 |
| np | North Pole | 1 | 0 | 1 | 0 | 0 | 0 |
| **TOTAL** | | **101** | **12** | **19** | **5** | **23** | **42** |

*(Sector ids: **s1 NE-outer → clockwise outer → s5 NE-inner → clockwise inner**. np = North Pole, shared by inner s5–s8.)*

*(Inner-sector counts **EXCLUDE North Pole** — it's 1 mountain area shared by all 4 central
sectors, counted once. It's added as its own row above.)*

**FINAL totals (all 8 sectors + North Pole):**
plateau **12** · mountain **19** · minor_erg **5** · deep-desert **23** · non-deep desert **42** = **101 areas**

> 🔴 **Major finding:** plateau & mountain have many **unnamed** areas too (named were only 8 & 7).
> Only minor_erg (5) and deep-desert (23) were real caps — both matched exactly ✅.
>
> **Named vs unnamed (101 total):** 26 named, **75 unnamed** —
> plateau 4 unnamed (12−8) · mountain 12 unnamed (19−7) · minor_erg 4 unnamed (Harg Pass chain) ·
> deep-desert 20 unnamed · non-deep desert 35 unnamed (42−7).
>
> ⚠️ **Sanity-check please:** 101 areas (19 mountain!) is large — worth a glance to confirm before we
> build the adjacency graph for all 101. Your minor_erg & deep-desert counts matched perfectly, so the
> method looks sound, but the mountain count especially is worth a second look.

> **Cross-check after all 4 outer sectors:**
> - ✅ **Plateau 3 outer / 5 left for central** — and the 5 remaining must be the **5 city plateaus**
>   (Arrakeen, Carthag, Arsunt, Hagga Basin, Imperial Basin) = the storm-safe "5 central plateaus". Clean!
> - ✅ **minor_erg 0 outer** — all 5 (Harg Pass chain) fall in central, as expected.
> - ✅ **mountain 4 outer / 3 left for central** (incl. North Pole the hub).
> - ✅ **deep-desert = 23 RESOLVED.** Was 22 after outer; the SE **inner** sector has 1 deep-desert
>   area (so not every central sector is 0 deep). 22 outer + 1 SE-inner = 23. No off-by-one after all.
> - **non-deep desert 29** (7 named + ~22 unnamed) — central will add a few more; we'll catalogue all
>   the unnamed non-deep areas in §1 after the 8 sectors are in.

> Rules note: Coriolis storms spare "the 5 **central plateau** areas." With the corrected types
> this is almost certainly the **5 city plateaus** (Arrakeen, Carthag, Arsunt, Hagga Basin,
> Imperial Basin) — please confirm.

---

## 2.1 Area roster — canonical IDs for all 101 areas

**ID scheme (user-chosen):** unnamed areas = **`s<sector>_<N>`**, numbered in **reading order**
(left→right, top→bottom) within the sector; **named areas keep their names** (used as landmarks).
**Terrain type is NOT in the id** — it's a separate attribute (annotated inline as `(deep)`,
`(mtn)`, etc. when discussing). `np` = North Pole.
*(The type-suffixed `s1_dd1`-style ids below are the OLD scheme — kept only as a per-type count
reference; the real positional `s#_N` ids get assigned as we trace each sector. §2.2 holds them.)*

**§2.2 Positional ids — read off the user's physically-marked board photos:**
- `s1` (NE-out, 18 areas): **read from `north-east.jpg` (marked).** s1_1 top-left(N edge) · s1_2
  top-center(N edge) · s1_3 left below s1_1 · s1_4 center-left by mesa, N of impassable border ·
  s1_5 center(large), N of air zone · s1_6 center on mesa, right of s1_5 · s1_7 S/E of air zone
  (inner, by Rimwall West) · s1_8 on long mesa, left of Sihaya Ridge · s1_9 right-center by mesa ·
  s1_10 top-right(NE corner) · s1_11 bottom-center · s1_12 bottom-center-right · s1_13 right-lower ·
  s1_14 bottom-right(edge) · **Sihaya Ridge** right-center (named, green triangle).
  Found in **center-east.jpg** (s1 spills into it): s1_15 bottom-center (by Gara Kulon) · s1_16
  bottom-right (by an air zone) · **Gara Kulon** (board spelling **"Cara Kulon"**) center, green
  triangle, **adjacent to Shield Wall #1 (s5)** — visually confirms the s5 shield_wall↔gara_kulon edge.
  ✅ **s1 fully located: s1_1..s1_16 + Sihaya Ridge + Gara Kulon = 18.**
- `s2` (SE-out, 10): from `south-east.jpg`. s2_1 top-center · s2_2 top-right (by prescience track) ·
  s2_3 center · s2_4 right (edge) · s2_5 left (by Pasty Mesa) · s2_6 bottom-left · s2_7 bottom-center ·
  s2_8 center-left (by air zone) · **Pasty Mesa** left ridge (plt) · **Tasmin Sink** center-left green
  triangle. ✅ s2_1..s2_8 + Pasty Mesa + Tasmin Sink = 10.
- `s6` (SE-in, 9): from `south-east.jpg`. s6_1 center-left · s6_2 top-right (N of False Wall East) ·
  s6_3 center-right · s6_4 center-bottom (S of False Wall South) · s6_5 bottom-left · **False Wall East**
  (mtn ridge) · **False Wall South** (plt ridge) · **Harg Pass** (minor erg) · **Hobars Gap** (green
  triangle sietch) · `np` North Pole (top-left). ✅ s6_1..s6_5 + 4 named = 9.
- `s3` (SW-out, 10): from `south-west.jpg`. s3_1 left (W edge) · s3_2 top-center · s3_3 top-center-right ·
  s3_4 bottom-left (🟡 verify) · s3_5 center-right (by False Wall West) · s3_6 bottom-center · s3_7
  bottom-right · s3_8 bottom-left (S edge) · s3_9 bottom-center (S edge, by air zone) · **Habbanya Ridge**
  center green triangle. ✅ s3_1..s3_9 + Habbanya Ridge = 10.
- `s7` (SW-in, 8): from `south-west.jpg`. s7_1 top-right (near North Pole / False Wall West) · s7_2
  top-left (on a ridge) · s7_3 center-left · s7_4 center-top (S of North Pole) · s7_5 center · s7_6
  bottom-center · **False Wall West** (plt ridge, left) · **Windgap** (green triangle sietch, bottom-left).
  ✅ s7_1..s7_6 + False Wall West + Windgap = 8.
- `s4` (NW-out, 20): from `north-west.jpg` (most) + `center-west.jpg` (s4_12, Bight, Great Flat).
  s4_1 left (W, by supremacy track) · s4_2 top-center · s4_3 top-right (N edge) · s4_4 center-right ·
  s4_5 left (W edge, lower) · s4_6 center (by Bight of the Cliff) · s4_7 N (top of center-west) ·
  s4_8 left-center · s4_9 center (by Rock Outcroppings) · s4_10 center-right (by s8 Shield Wall) ·
  s4_11 right (N of cities, by seam) · s4_12 center-south (by Great Flat/Bight) · s4_13 bottom (by air
  zone) · s4_14 center-bottom (by s8 Shield Wall) · s4_15 center-right (by s8 Shield Wall) · s4_16
  right (large, by Shield Wall + western cities) · **The Funeral Plain** (named, center-left) ·
  **Rock Outcroppings** (green triangle) · **Bight of the Cliff** (green triangle) · **The Great Flat**
  (deep, SW edge). ✅ s4_1..s4_16 + 4 named = 20.
- `s8` (NW-in, 9): from `center-west.jpg`. s8_1 W edge (by Shield Wall #2's red border) · s8_2
  center-left (W of Hagga Basin) · s8_3 🟡 SW corner of s8 (s4/s3/s7/s8 junction) ·
  s8_4 bottom-left (by air zone) · **Arsunt** (named, by Carthag) · **Hagga Basin** (settlement I) ·
  **Splintered Rock** (mtn) · **Shield Wall #2** (mtn, red border) · **Wind Pass** (named nd).
  ⏳ s8_1..s8_4 + 5 named = 9. ✅ s8 complete.
- `s5` (NE-in, 16): from `center-east.jpg`. s5_1 top-center (by Imperial Basin) · s5_2 center-left
  (by Hole in the Rock) · s5_3 center · s5_4 center-bottom · s5_5 center-right · s5_6 right · s5_7
  bottom-center · s5_8 bottom-right · s5_9 center-right (by s1_15) · **Carthag, Arrakeen, Imperial
  Basin** (plt) · **Broken Land, Rimwall West, Hole in the Rock, Shield Wall #1** (mtn). ✅ s5_1..s5_9
  + 7 named = 16.

**Outer**
- `s1` NE-out (18): **Sihaya Ridge** =`s1_dd1` + `s1_dd2..7` · **Gara Kulon** =`s1_nd1` + `s1_nd2..11`  ✅
- `s2` SE-out (10): **Pasty Mesa** =`s2_plt1` + `s2_plt2`(unnamed) · `s2_dd1..4` · **Tasmin Sink** =`s2_nd1` + `s2_nd2..4`  ✅ (False Wall South & Hobars Gap are NOT here — placed elsewhere, TBD)
- `s3` SW-out (10): `s3_plt1`(unnamed) · `s3_dd1..5` · **Habbanya Ridge** =`s3_nd1` + `s3_nd2..4`  ✅ (False Wall West NOT here — inner)
- `s4` NW-out (20): `s4_mtn1..4`(unnamed; Shield Wall NOT here) · **The Great Flat** =`s4_dd1`, **Rock Outcroppings** =`s4_dd2` + `s4_dd3..6` · **Bight of the Cliff** =`s4_nd1`, **The Funeral Plain** =`s4_nd2` + `s4_nd3..10`  ✅

**Inner** (exclude North Pole)
- `s5` NE-in (16): **Carthag** =`s5_plt1`, **Arrakeen** =`s5_plt2`, **Imperial Basin** =`s5_plt3` + `s5_plt4` · **Broken Land** =`s5_mtn1`, **Rimwall West** =`s5_mtn2`, **Hole in the Rock** =`s5_mtn3`, **Shield Wall #1** =`s5_mtn4` + `s5_mtn5..9` · `s5_erg4..5` · `s5_nd1`  ✅
- `s6` SE-in (9): **False Wall South** =`s6_plt1` · **False Wall East** =`s6_mtn1` · **Harg Pass** =`s6_erg1` + `s6_erg2..3` · `s6_dd1` · **Hobars Gap** =`s6_nd1` + `s6_nd2..3`  ✅
- `s7` SW-in (8): **False Wall West** =`s7_plt1` + `s7_plt2`(unnamed) · **Windgap** =`s7_nd1` + `s7_nd2..6`  ✅
- `s8` NW-in (9): **Arsunt** =`s8_plt1`, **Hagga Basin** =`s8_plt2` · **Splintered Rock** =`s8_mtn1`, **Shield Wall #2** =`s8_mtn2` + `s8_mtn3..4` · **Wind Pass** =`s8_nd1` + `s8_nd2..3`  ✅ (TWO "Shield Wall" areas: #1 in s5, #2 here by the western cities. Wind Pass = NEW, confirm ≠ Windgap)
- `np` (1): **North Pole** (mtn; shared by all 4 inner sectors s5–s8)

**Placement tracker (26 named):**
- ✅ **ALL placed (28 named — 26 + "Wind Pass" + a 2nd "Shield Wall"):**
  np North Pole · s1 Sihaya Ridge, Gara Kulon · s2 Pasty Mesa, Tasmin Sink · s3 Habbanya Ridge ·
  s4 The Great Flat, Rock Outcroppings, Bight of the Cliff, The Funeral Plain ·
  s5 Carthag, Arrakeen, Imperial Basin, Broken Land, Rimwall West, Hole in the Rock, **Shield Wall #1** ·
  s6 False Wall South, False Wall East, Harg Pass, Hobars Gap · s7 False Wall West, Windgap ·
  s8 Arsunt, Hagga Basin, Splintered Rock, **Shield Wall #2**, **Wind Pass** (new).
- ⚠️ Confirm only: **Wind Pass** (s8) ≠ **Windgap** (s7). (TWO Shield Walls confirmed: #1 in s5, #2 in s8.)
- 👀 Watch for other **duplicate-named** areas (long ridges): e.g. is there a "Rimwall East" too?

---

## 3. Adjacency (ground movement)

White-border neighbors only. `# impassable` notes go to §4. Use §2.1 IDs.

> 📊 **Visual:** see [`BOARD_GRAPH.md`](BOARD_GRAPH.md) for the auto-generated Mermaid graph of the whole
> board (101 nodes, 265 passable edges + 11 impassable). Regenerate with `python3 scripts/gen_graph.py`.
> It also validates the graph (symmetric edges, no isolated nodes) — it already caught one stray edge.

### 3a. Confirmed adjacency (from user — AUTHORITATIVE; partial neighbor lists OK)
Each line lists known neighbors so far; we complete each area's full list over time.
```
shield_wall_1 (s5_mtn4):  gara_kulon (s1_nd1), <a minor erg in s5 = s5_erg4 or s5_erg5>
shield_wall_2 (s8_mtn2):  arsunt (s8_plt1), hagga_basin (s8_plt2)
wind_pass     (s8_nd1):   north_pole (np), splintered_rock (s8_mtn1), s8_4, s8_2, s5_3, s7_2, s7_3, s7_4   # NOT false_wall_west
s8_3:                     bight_of_the_cliff, s4_12, s4_13, s8_1, s8_4, s3_3, s7_1   # COMPLETE (7 nbrs); 4-sector junction
north_pole    (np):       wind_pass (s8), s5_3, s6_1, s7_4   # ✅ COMPLETE — exactly one area per inner sector
```

### 3a-s1. Sector s1 (NE-outer) — PHOTO-TRACED DRAFT (from north-east.jpg + center-east.jpg)
Traced by Claude from the marked photos; ✅ = clear white border, 🟡 = likely (needs your eye).
Spatial layout (board N = top):
```
   [seam]  s1_1  s1_2            Sihaya   s1_10
           s1_3  s1_4  s1_5      s1_6  s1_9
                      (air zone) s1_8
           s1_7  s1_11  s1_12    s1_13
                  GaraKulon       s1_14
                  s1_15  s1_16
```
**User answers (2026-06-27):** seam IS crossable — s1_1/s1_3 ↔ s4 across the central seam ✅
(specific s4 id TBD when tracing s4). All 4 queried internal pairs confirmed adjacent ✅
(s1_1↔s1_4, s1_5↔s1_6, s1_7↔s1_8, s1_8↔s1_11). Gara-Kulon-junction Qs still OPEN (🟡 below).
```
s1_1:    s1_2 ✅, s1_3 ✅, s1_4 ✅, s4_3 ✅(seam, per s4 trace)
s1_2:    s1_1 ✅, s1_4 ✅, s1_5 ✅, s1_6 ✅, sihaya_ridge ✅
s1_3:    s1_1 ✅, s1_4 ✅, s4_11 ✅, s4_3 ✅(seam)   # S border = Broken Land (impassable §4)
s1_4:    s1_3 ✅, s1_2 ✅, s1_5 ✅, s1_1 ✅   # S border = Broken Land arc (impassable §4)
s1_5:    s1_2 ✅, s1_4 ✅, s1_8 ✅, s1_7 ✅, s1_6 ✅   # SW=air zone; S→rimwall_west RED §4; + s5_5 RED §4
s1_6:    s1_2 ✅, s1_8 ✅, s1_9 ✅, sihaya_ridge ✅, s1_5 ✅
s1_7:    s1_5 ✅, s1_11 ✅, s1_8 ✅, s5_6 ✅, shield_wall_1 ✅   # white crossings; + s5_5 RED §4
s1_8:    s1_5 ✅, s1_6 ✅, s1_9 ✅, s1_12 ✅, s1_11 ✅, s1_7 ✅
s1_9:    s1_6 ✅, s1_8 ✅, sihaya_ridge ✅, s1_10 ✅, s1_12 ✅, s1_13 ✅
s1_10:   sihaya_ridge ✅, s1_9 ✅, s1_13 ✅   # NE corner (desert_ne); E-edge (Prescience track)
s1_11:   s1_7 ✅, s1_8 ✅, s1_12 ✅, gara_kulon ✅, shield_wall_1 ✅   # NOT s5_9, NOT s1_15
s1_12:   s1_8 ✅, s1_9 ✅, s1_11 ✅, s1_13 ✅, s1_14 ✅, gara_kulon ✅   # NOT s5_9
s1_13:   s1_9 ✅, s1_10 ✅, s1_12 ✅, s1_14 ✅   # E-edge
s1_14:   s1_12 ✅, s1_13 ✅, s1_16 ✅, gara_kulon ✅   # E-edge; exactly 4 nbrs (NOT s5_9, NOT s1_15)
sihaya_ridge: s1_2 ✅, s1_6 ✅, s1_9 ✅, s1_10 ✅   # ✅ VERIFIED deep-desert sietch (4 nbrs; NOT rimwall_west)
gara_kulon:   s1_11 ✅, s1_14 ✅, s1_15 ✅, shield_wall_1/s5_mtn4 ✅(§3a), s5_9 ✅
s1_15:   gara_kulon ✅, s1_16 ✅, s5_9 ✅, pasty_mesa ✅(s2), s2_1 ✅   # NOT s1_11/s1_14; s1↔s2 boundary
s1_16:   s1_14 ✅, s1_15 ✅, s2_1 ✅, s2_2 ✅(s2), gara_kulon ✅   # 5 nbrs; NOT s5_9
```
**s1 area-by-area VERIFIED (2026-06-27).** s1↔s2 boundary: s1_15↔{pasty_mesa, s2_1}, s1_16↔{s2_1, s2_2}.
s1↔s5: only s1_7↔s5_6 (white) + s1_15↔s5_9; s1_11↔shield_wall_1 (white). Red arc (§4): s1_4/s1_5↔rimwall_west(?),
s1_5↔s5_5, s1_7↔s5_5, s1_3↔broken_land(?), s5_6↔shield_wall_1.

### 3a-s2. Sector s2 (SE-outer) — PHOTO-TRACED DRAFT (from south-east.jpg)
✅ = clear white border, 🟡 = likely (needs your eye). E edge (right) = Prescience track; S edge = bottom.
Spatial layout (board N = top; this is the SE quadrant):
```
   [s6 inner + air-zone band above]
   pasty_mesa  s2_5   s2_1   s2_2
               tasmin_sink   s2_3
      s2_8   s2_6      s2_7   s2_4
         (air zone SW)   [S edge]
```
**User answers (2026-06-27):** s2_6↔tasmin_sink ✅ · pasty_mesa↔tasmin_sink ✅ · s2_8↔pasty_mesa
NO (not adjacent) · Pasty Mesa has NO ground crossing into s6 (air zone only) · s2↔s1 on E edge YES
(s2_2 ↔ s1_16, exact s1 id to pin) · **s2↔s3 do NOT connect at the S-edge SW corner (air zone there)
— outer ring is broken at the SE/SW seam.**
```
s2_1:    s2_2 ✅, s2_3 ✅, tasmin_sink ✅, pasty_mesa ✅, s1_15 ✅, s1_16 ✅(s1)   # 6 nbrs; NOT s2_5; N=s6/air-zone band
s2_2:    s2_1 ✅, s2_3 ✅, s2_4 ✅, s1_16 ✅(E-edge x-sector; exact s1 id 🟡)
s2_3:    s2_1 ✅, s2_2 ✅, s2_4 ✅, s2_7 ✅, tasmin_sink ✅   # 5 nbrs; NOT s2_6
s2_4:    s2_2 ✅, s2_3 ✅, s2_7 ✅                          # E edge, lower
s2_5:    s2_6 ✅, pasty_mesa ✅, tasmin_sink ✅, s2_8 ✅, false_wall_south ✅(s6), s6_3 ✅(s6)   # 6 nbrs; NOT s2_1; s2↔s6 ground crossing here
s2_6:    s2_5 ✅, s2_7 ✅, s2_8 ✅, tasmin_sink ✅   # NOT s2_3
s2_7:    s2_3 ✅, s2_4 ✅, s2_6 ✅, s2_8 ✅, tasmin_sink ✅   # S edge (tasmin_sink added via reciprocal)
s2_8:    s2_5 ✅, s2_6 ✅, s2_7 ✅, false_wall_south ✅(s6), hobars_gap ✅(s6), s6_5 ✅(s6)   # 6 nbrs; S edge; NO s3 crossing
pasty_mesa:  s2_5 ✅, tasmin_sink ✅, s2_1 ✅, s1_15 ✅(s1), s5_9 ✅(s5), s6_2 ✅(s6), s6_3 ✅(s6)   # plateau; HAS s5/s6 ground links
tasmin_sink: s2_1 ✅, s2_3 ✅, s2_5 ✅, s2_6 ✅, s2_7 ✅, pasty_mesa ✅   # non-deep desert sietch (6 nbrs)
```
**s2↔s6/s5 mirrors to apply when tracing s6/s5:** s2_5↔{false_wall_south, s6_3} · s2_8↔{false_wall_south,
hobars_gap, s6_5} · pasty_mesa↔{s6_2, s6_3} · pasty_mesa↔s5_9 (all ground crossings). (s2 pass 2026-06-27.)

### 3a-s3. Sector s3 (SW-outer) — PHOTO-TRACED DRAFT (from south-west.jpg)
✅ = clear white border, 🟡 = likely. W edge (left) = Supremacy track; S edge = bottom; pole = upper-right.
Already pinned by user's §3a `s8_3` line: **s3_3 ↔ s7_1 ✅ and s3_3 ↔ s8_3 ✅** (the s3/s4/s7/s8 4-sector junction).
Spatial layout (SW quadrant):
```
   [W edge]                         [air-zone band / s7 inner →]
   s3_1   s3_2   s3_3 ──(s7_1, s8_3 junction)
          habbanya     s3_5    s3_8 (air zone → s7)
   s3_4   s3_6   s3_7   s3_9
   [S edge bottom]
```
**User answers (2026-06-27) — s3 FULLY RESOLVED (all edges ✅):** Habbanya is ringed by s3_1..s3_6
(all six). s3_5↔s3_7 ✅. Rich cross-sector crossings confirmed (see x-sector block).
```
s3_1:    s3_2 ✅, s3_4 ✅, habbanya_ridge ✅, the_great_flat ✅(s4)        # W edge
s3_2:    s3_1 ✅, s3_3 ✅, habbanya_ridge ✅, the_great_flat ✅(s4), s4_12 ✅
s3_3:    s3_2 ✅, s3_5 ✅, habbanya_ridge ✅, s4_12 ✅, s8_3 ✅, s7_1 ✅     # s3/s4/s7/s8 4-sector junction
s3_4:    s3_1 ✅, s3_6 ✅, habbanya_ridge ✅                               # W + S edges
s3_5:    s3_3 ✅, s3_6 ✅, s3_7 ✅, s3_8 ✅, habbanya_ridge ✅, s7_1 ✅, false_wall_west ✅(s7)
s3_6:    s3_4 ✅, s3_5 ✅, s3_7 ✅, habbanya_ridge ✅                       # S edge
s3_7:    s3_5 ✅, s3_6 ✅, s3_8 ✅, s3_9 ✅                                # S edge
s3_8:    s3_5 ✅, s3_7 ✅, s3_9 ✅, false_wall_west ✅(s7), windgap ✅(s7)
s3_9:    s3_7 ✅, s3_8 ✅, windgap ✅(s7), s7_6 ✅, s6_5 ✅(s6)             # S edge; NO s2 link (air zone)
habbanya_ridge: s3_1 ✅, s3_2 ✅, s3_3 ✅, s3_4 ✅, s3_5 ✅, s3_6 ✅       # sietch; ringed by all of s3_1..6
```
**s3 cross-sector edges to mirror later:** →s4: s3_1↔the_great_flat · s3_2↔{the_great_flat, s4_12} ·
s3_3↔s4_12.  →s7: s3_3↔s7_1 · s3_5↔{s7_1, false_wall_west} · s3_8↔{false_wall_west, windgap} ·
s3_9↔{windgap, s7_6}.  →s8: s3_3↔s8_3 (already in §3a).  →s6: s3_9↔s6_5.
**s3 resolved — no open questions. ✅ area-by-area VERIFIED 2026-06-27 (all 10 unchanged).**

### 3a-s4. Sector s4 (NW-outer, 20 areas) — PHOTO-TRACED DRAFT (north-west.jpg + center-west.jpg)
✅ clear · 🟡 likely. W edge (left) = Supremacy track; N edge = top; pole = lower-right (Shield Wall/cities).
Pre-pinned by user lines: s8_3↔{bight, s4_12, s4_13} (§3a) · s3↔s4: s3_1↔great_flat, s3_2↔{great_flat, s4_12}, s3_3↔s4_12.
Shield Wall & Broken Land borders are IMPASSABLE (red) → §4, not listed as nbrs here.
Spatial layout (NW quadrant):
```
[N edge top]
   s4_2          s4_3 ──seam→ s1_1
 s4_1  rock_outcr   s4_10  s4_11 ──seam→ s1_3
    s4_4    s4_9    s4_15   s4_16 ──seam→ s5_1
 funeral_plain  s4_8   s4_14  [Shield Wall red]
 s4_5   s4_7   s4_13(air zone)
 s4_6    s4_12   bight   s8_3
 great_flat
[W edge left / S edge bottom]
```
**User answers (2026-06-27) — s4 desert edges RESOLVED.** Funeral Plain ringed by s4_1,2,4,5,6,7.
NOT adjacent: s4_2↔s4_3, s4_4↔s4_9. Seam: s4_3↔s1_1, s4_11↔s1_3, s4_16↔s1_3 (NOT s4_16↔s5_1).
⚠️ User also listed s4_15↔shield_wall and s4_16↔{shield_wall, broken_land, arsunt} — these are the
RED mountain edges → treated as **impassable (§4)** pending the confirm Q below.
```
s4_1:    s4_2 ✅, s4_5 ✅, the_funeral_plain ✅           # W edge; NOT the_great_flat
s4_2:    s4_1 ✅, s4_4 ✅, the_funeral_plain ✅, rock_outcroppings ✅        # N edge (NOT s4_3)
s4_3:    s4_10 ✅, s4_11 ✅, rock_outcroppings ✅, s1_1 ✅, s1_3 ✅(seam)     # N edge (NOT s4_2)
s4_4:    s4_2 ✅, s4_7 ✅, s4_8 ✅, the_funeral_plain ✅, rock_outcroppings ✅   # (NOT s4_9)
s4_5:    s4_1 ✅, s4_6 ✅, the_great_flat ✅, the_funeral_plain ✅           # W edge
s4_6:    s4_5 ✅, s4_7 ✅, s4_12 ✅, bight_of_the_cliff ✅, the_great_flat ✅, the_funeral_plain ✅
s4_7:    s4_4 ✅, s4_6 ✅, s4_8 ✅, s4_13 ✅, bight_of_the_cliff ✅, the_funeral_plain ✅
s4_8:    s4_4 ✅, s4_7 ✅, s4_9 ✅, s4_13 ✅, s4_14 ✅, rock_outcroppings ✅   # 6 nbrs
s4_9:    s4_8 ✅, s4_10 ✅, s4_14 ✅, s4_15 ✅, rock_outcroppings ✅         # (NOT s4_4)
s4_10:   s4_3 ✅, s4_9 ✅, s4_11 ✅, s4_15 ✅, rock_outcroppings ✅
s4_11:   s4_3 ✅, s4_10 ✅, s4_15 ✅, s4_16 ✅, s1_3 ✅(seam)                # Broken Land (impassable §4)
s4_12:   s4_6 ✅, bight_of_the_cliff ✅, the_great_flat ✅, s8_3 ✅, s3_2 ✅, s3_3 ✅
s4_13:   s4_7 ✅, s4_8 ✅, s4_14 ✅, s8_1 ✅, s8_3 ✅, bight_of_the_cliff ✅   # air zone
s4_14:   s4_8 ✅, s4_9 ✅, s4_13 ✅, s4_15 ✅, s8_1 ✅, shield_wall_2 ✅       # air zone; shield_wall_2 = white (6 nbrs)
s4_15:   s4_9 ✅, s4_10 ✅, s4_11 ✅, s4_14 ✅, shield_wall_2 ✅             # s4_15↔s4_16 is RED impassable (§4)!
s4_16:   s4_11 ✅, broken_land ✅, arsunt ✅, shield_wall_2 ✅   # MOUNTAIN area on Shield Wall massif (city side); NOT adj s4_15 (red §4); NOT s1_3
the_funeral_plain: s4_1 ✅, s4_2 ✅, s4_4 ✅, s4_5 ✅, s4_6 ✅, s4_7 ✅      # ringed by all 6
rock_outcroppings: s4_2 ✅, s4_3 ✅, s4_4 ✅, s4_8 ✅, s4_9 ✅, s4_10 ✅       # deep-desert sietch
bight_of_the_cliff: s4_6 ✅, s4_7 ✅, s4_12 ✅, s4_13 ✅, s8_3 ✅           # non-deep desert sietch
the_great_flat: s4_5 ✅, s4_6 ✅, s4_12 ✅, s3_1 ✅, s3_2 ✅       # deep-desert (SW corner of s4); NOT s4_1
```
**s4 cross-sector edges to mirror:** →s1 (seam): s4_3↔{s1_1, s1_3} · s4_11↔s1_3 (s4_16 does NOT reach s1).
→s8: s4_13↔{s8_1, s8_3} · s4_14↔s8_1 · s4_12↔s8_3 · bight↔s8_3 · **s4_15↔shield_wall_2 · s4_16↔{shield_wall_2, arsunt}**.
→s5: **s4_16↔broken_land**.  →s3: s4_12↔{s3_2,s3_3} · great_flat↔{s3_1,s3_2}.
**🔴 s4 §4 finding (corrects earlier assumption):** the red impassable line runs **between s4_15 and s4_16**
(along the Shield Wall crest), NOT between the desert and the mountains. s4_16 is a **mountain** area on the
city side and is freely passable to Arsunt / Shield Wall #2 / Broken Land. So the north desert DOES connect
to the cities via s4_16. Only s4_15↔s4_16 is sealed here. (Revisit full §4 extent when tracing s5/s8.)
**s4 fully resolved. ✅ area-by-area VERIFIED 2026-06-27.**

### 3a-s8. Sector s8 (NW-inner, 9 areas) — PARTIAL (dense mountain core; needs your direct lists)
✅ clear/known · 🟡 guess. Pre-known: s8_3 COMPLETE (§3a) · shield_wall_2↔{arsunt, hagga_basin} (§3a) ·
wind_pass↔{north_pole, splintered_rock} (§3a) · s8_1↔{s4_13, s4_14} & s4↔s8 ties (§3a-s4) ·
shield_wall_2↔{s4_15, s4_16} & s4_16↔arsunt (§3a-s4). Areas: s8_1, s8_2, s8_3, s8_4, arsunt, hagga_basin,
splintered_rock, shield_wall_2, wind_pass. Layout (center-west.jpg): s8_1 NW (W=air zone s4_13, E=Shield Wall #2
red), s8_2 mtn on Splintered Rock massif, s8_3 SW junction, s8_4 S by Wind Pass; cities/Splintered Rock to the E.
**User answers (2026-06-27):** s8_1↔s8_2 and s8_1↔Shield Wall #2 are BOTH RED impassable (→§4).
s8_2 borders splintered_rock/hagga_basin/wind_pass/s8_4 (+ s8_1 red, +shield_wall_2 🟡). s8_4↔wind_pass
yes but s8_4↔splintered_rock NO; wind_pass↔false_wall_west NO. Hagga Basin: arsunt/carthag/s5_1/s5_2/
splintered_rock/s8_2/shield_wall_2 — **NOT north_pole, NOT imperial_basin (air zone)**.
```
s8_1:    s8_3 ✅, s4_13 ✅, s4_14 ✅, s8_4 ✅           # white(4); s8_1↔s8_2 & s8_1↔Shield Wall #2 = RED impassable (§4)
s8_2:    splintered_rock ✅, hagga_basin ✅, wind_pass ✅, s8_4 ✅, shield_wall_2 ✅   # unnamed MTN; white(5) + s8_1 RED §4 = 6
s8_3:    bight_of_the_cliff ✅, s4_12 ✅, s4_13 ✅, s8_1 ✅, s8_4 ✅, s3_3 ✅, s7_1 ✅   # COMPLETE
s8_4:    s8_3 ✅, s8_2 ✅, wind_pass ✅, s7_1 ✅, s7_2 ✅(s7), s8_1 ✅   # NOT splintered_rock
arsunt:        shield_wall_2 ✅, s4_16 ✅, hagga_basin ✅, broken_land ✅, carthag ✅   # ✅ city I COMPLETE (5 nbrs)
hagga_basin:   arsunt ✅, carthag ✅, s5_1 ✅, s5_2 ✅, splintered_rock ✅, s8_2 ✅, shield_wall_2 ✅   # city I; NOT north_pole / imperial_basin(air zone)
splintered_rock: wind_pass ✅, s8_2 ✅, hagga_basin ✅, s5_2 ✅   # ✅ COMPLETE 4 nbrs; NOT false_walls/s8_4/north_pole/hole_in_the_rock
shield_wall_2: arsunt ✅, hagga_basin ✅, s4_14 ✅, s4_15 ✅, s4_16 ✅, s8_2 ✅   # W side (s8_1) = RED impassable §4
wind_pass:     north_pole ✅, splintered_rock ✅, s8_4 ✅, s8_2 ✅      # NOT false_wall_west
```
**s8 ✅ area-by-area VERIFIED 2026-06-27 (all 9 areas).** s8_2↔shield_wall_2 = white; splintered_rock
has only 4 nbrs (no false walls); arsunt↔{carthag, broken_land} confirmed.

> ## 🎉 §3 ADJACENCY COMPLETE — all 8 sectors + North Pole (101 areas) traced & user-verified
> area-by-area on 2026-06-27. Every area's neighbour list is ✅. Cross-sector edges mirrored both ways.
> Remaining Phase 0: finalize §4 (impassable — mostly captured inline above) and §5 (air zones).
> Next build step: Phase 1 — generate typed `board.ts` from §3a + a graph well-formedness unit test
> (symmetric edges, every id resolves). NOTE: §3b below is the OLD unreliable draft — IGNORE/DELETE it.

### 3a-s5. Sector s5 (NE-inner, 16 areas) — SKELETON (densest core; needs your direct lists)
✅ known · 🟡 photo-guess. Named (7): Carthag, Arrakeen, Imperial Basin, Broken Land, Rimwall West,
Hole in the Rock, Shield Wall #1. Unnamed s5_1..s5_9 (types per §2.1: 1 extra plateau, 5 mtn, 2 m.erg, 1 nd).
Pre-known: shield_wall_1↔{gara_kulon, an s5 minor erg} (§3a) · hagga_basin↔{s5_1, s5_2, carthag} (§3a-s8).
Rough positions (center-east.jpg): s5_1 top-ctr (by Imperial Basin) · s5_2 ctr-left (by Hole in the Rock/
Splintered Rock) · s5_3 ctr · s5_4 ctr-bottom (by North Pole) · s5_5 ctr-right · s5_6 right (by Rimwall West,
red) · s5_7 bottom-ctr (air zone) · s5_8 bottom-right · s5_9 far right (by Gara Kulon/Shield Wall #1).
**User answers (2026-06-27, round 1):** cities pinned (note **Carthag NOT↔ Imperial Basin** — s5_1/Arrakeen
between them). s5_1 = the central plateau ringed by all 3 cities + Hagga Basin. **s5_9 is a large area
bordering FIVE s1 areas** (s1_11/12/14/15/16) + Gara Kulon + Shield Wall #1 — this is the main s1↔s5 ground
crossing. Mountain web (Rimwall West / Hole in the Rock / North Pole) still 🟡 — next round.
```
s5_1:  carthag ✅, arrakeen ✅, imperial_basin ✅, hagga_basin ✅, hole_in_the_rock ✅, s5_2 ✅   # central PLATEAU (s5_plt4); 6 nbrs
s5_2:  hagga_basin ✅, hole_in_the_rock ✅, s5_3 ✅, s5_1 ✅, splintered_rock ✅   # 5 nbrs
s5_3:  hole_in_the_rock ✅, north_pole ✅, s5_2 ✅, s5_4 ✅, s6_1 ✅(s6), wind_pass ✅(s8)   # pole-ring; 6 nbrs; NOT s5_5
s5_4:  imperial_basin ✅, hole_in_the_rock ✅, s5_3 ✅, s5_5 ✅, s5_7 ✅, s6_1 ✅(s6), false_wall_east ✅(s6)   # 7 nbrs
s5_5:  imperial_basin ✅, rimwall_west ✅, s5_4 ✅, s5_6 ✅, s5_7 ✅, s5_8 ✅   # 6 white + s1_5/s1_7 RED §4 = 8 total; NOT s5_3
s5_6:  s5_5 ✅, s5_8 ✅, s1_7 ✅   # + shield_wall_1 = RED impassable (§4); NOT rimwall_west / s5_9
s5_7:  s5_8 ✅, s5_4 ✅, s5_5 ✅, false_wall_east ✅(s6), s6_2 ✅(s6)   # 5 nbrs; air zone (NOT north_pole)
s5_8:  s5_7 ✅, s5_9 ✅, s5_6 ✅, s5_5 ✅, shield_wall_1 ✅, s6_2 ✅(s6)   # 6 nbrs
s5_9:  gara_kulon ✅, shield_wall_1 ✅, s1_15 ✅, s5_8 ✅, pasty_mesa ✅(s2), s6_2 ✅(s6)   # 6 nbrs; NOT s5_6, NOT s1_11/12/14/16
# Named hubs:
carthag:        arsunt ✅, arrakeen ✅, hagga_basin ✅, broken_land ✅, s5_1 ✅   # COMPLETE (NOT imperial_basin)
arrakeen:       carthag ✅, imperial_basin ✅, broken_land ✅, rimwall_west ✅, s5_1 ✅   # COMPLETE
imperial_basin: arrakeen ✅, hole_in_the_rock ✅, rimwall_west ✅, s5_1 ✅, s5_4 ✅, s5_5 ✅   # COMPLETE (NOT carthag/hagga_basin)
hole_in_the_rock: imperial_basin ✅, s5_1 ✅, s5_2 ✅, s5_3 ✅, s5_4 ✅   # ✅ COMPLETE (embedded in s5)
rimwall_west:   broken_land ✅, arrakeen ✅, imperial_basin ✅, s5_5 ✅   # ✅ COMPLETE (4 white); + s1_4, s1_5 = RED impassable arc (§4 only, not nbrs)
broken_land:    carthag ✅, arrakeen ✅, rimwall_west ✅, s4_16 ✅, arsunt ✅   # ✅ COMPLETE: white(5) + s4_11, s1_3, s1_4 RED §4 = 8
shield_wall_1:  gara_kulon ✅, s5_9 ✅, s5_8 ✅, s1_11 ✅, s1_7 ✅   # ✅ COMPLETE; s5_8 = the s5 minor_erg; + s5_6 RED §4
gara_kulon:     s1_11 ✅, s1_12 ✅, s1_14 ✅, s1_15 ✅, s1_16 ✅, shield_wall_1 ✅, s5_9 ✅
```
**🌟 North Pole COMPLETE (user):** `north_pole: wind_pass(s8), s5_3, s6_1, s7_4` — exactly ONE area per inner
sector, nothing else. (Corrects earlier guesses: NOT splintered_rock / hole_in_the_rock / false walls / hagga_basin.)
**s5 ✅ area-by-area VERIFIED 2026-06-27 (all 16 areas).** s5_8 = a minor_erg. Type-id of the other
minor_erg + the 1 nd among s5_2..s5_9 still TBD (cosmetic; doesn't affect the graph).
**s5→inner reciprocals to mirror:** north_pole↔{s6_1, s7_4} · rimwall_west↔{s1_4, s1_5} (impassable §4) ·
s5_3↔s6_1 (pole-ring) · s5_4↔{s6_1, false_wall_east} · s5_7↔{false_wall_east, s6_2} · s5_8↔s6_2 · s5_9↔s6_2.

### 3a-s6. Sector s6 (SE-inner, 9 areas) — area-by-area pass (seeded from cross-sector mirrors)
Areas: s6_1..s6_5, False Wall East, False Wall South, Harg Pass, Hobars Gap. Layout (south-east.jpg):
s6_1 top-left (by North Pole) · s6_2 top (N of False Wall East) · s6_3 center-right · s6_4 center-bottom
(S of False Wall South) · s6_5 bottom-left. Seeded edges (from s2/s5/s3 mirrors — to verify in pass):
```
s6_1:  north_pole ✅, s5_3 ✅, s5_4 ✅, s7_4 ✅(s7), s7_5 ✅(s7), false_wall_east ✅, harg_pass ✅, s6_4 ✅   # ✅ 8 nbrs
s6_2:  s5_7 ✅, s5_8 ✅, s5_9 ✅, pasty_mesa ✅(s2), s6_3 ✅, false_wall_east ✅   # ✅ 6 nbrs; NOT s5_4
s6_3:  s2_5 ✅(s2), pasty_mesa ✅(s2), s6_2 ✅, false_wall_south ✅, harg_pass ✅, false_wall_east ✅   # ✅ 6 nbrs
s6_4:  s6_1 ✅, harg_pass ✅, false_wall_south ✅, hobars_gap ✅, s6_5 ✅, s7_6 ✅(s7), s7_5 ✅(s7)   # ✅ 7 nbrs
s6_5:  s3_9 ✅(s3), s2_8 ✅(s2), s6_4 ✅, s7_6 ✅(s7), hobars_gap ✅   # ✅ 5 nbrs
false_wall_east: s5_4 ✅, s5_7 ✅, s6_1 ✅, s6_2 ✅, s6_3 ✅, harg_pass ✅   # ✅ 6 nbrs (mtn ridge)
false_wall_south: s2_5 ✅(s2), s2_8 ✅(s2), s6_3 ✅, s6_4 ✅, harg_pass ✅, hobars_gap ✅   # ✅ 6 nbrs (plt ridge)
harg_pass: s6_1 ✅, s6_3 ✅, s6_4 ✅, false_wall_east ✅, false_wall_south ✅   # ✅ 5 nbrs (minor erg)
hobars_gap: s2_8 ✅(s2), s6_4 ✅, s6_5 ✅, false_wall_south ✅   # ✅ 4 nbrs (sietch)
# s7 mirrors to apply when tracing s7: s7_4↔s6_1 · s7_5↔{s6_1, s6_4} · s7_6↔{s6_4, s6_5}
```
**s6 ✅ area-by-area VERIFIED 2026-06-27 (all 9 areas).**

### 3a-s7. Sector s7 (SW-inner, 8 areas) — area-by-area pass (seeded from mirrors)
Areas: s7_1..s7_6, False Wall West, Windgap. Layout (south-west.jpg): s7_1 top-right (near North Pole/
False Wall West) · s7_2 on the FWW ridge · s7_3 center · s7_4 right (by North Pole) · s7_5 center-right ·
s7_6 bottom. Seeded edges (verify in pass):
```
s7_1:  s3_3 ✅(s3), s8_3 ✅(s8), s3_5 ✅(s3), false_wall_west ✅, s7_2 ✅, s8_4 ✅(s8)   # ✅ 6 nbrs
s7_2:  s7_1 ✅, s8_4 ✅(s8), wind_pass ✅(s8), s7_3 ✅, windgap ✅, false_wall_west ✅   # ✅ 6 nbrs
s7_3:  s7_2 ✅, s7_4 ✅, s7_5 ✅, wind_pass ✅(s8), windgap ✅   # ✅ 5 nbrs; NOT false_wall_west
s7_4:  north_pole ✅, s6_1 ✅(s6), s7_3 ✅, s7_5 ✅, wind_pass ✅(s8)   # ✅ 5 nbrs (pole-ring)
s7_5:  s6_1 ✅(s6), s6_4 ✅(s6), s7_3 ✅, s7_4 ✅, s7_6 ✅, windgap ✅   # ✅ 6 nbrs
s7_6:  s3_9 ✅(s3), s6_4 ✅(s6), s6_5 ✅(s6), s7_5 ✅, windgap ✅   # ✅ 5 nbrs
false_wall_west: s3_5 ✅(s3), s3_8 ✅(s3), s7_1 ✅, s7_2 ✅, windgap ✅   # ✅ 5 nbrs (plt ridge)
windgap: s3_8 ✅(s3), s3_9 ✅(s3), s7_2 ✅, s7_3 ✅, s7_5 ✅, s7_6 ✅, false_wall_west ✅   # ✅ 7 nbrs sietch
```
**s7 ✅ area-by-area VERIFIED 2026-06-27 (all 8 areas).**

### 3b. Earlier photo-based DRAFT (UNVERIFIED — my geography proved unreliable; supersede with 3a)

```
# --- city cluster (north of pole) ---
north_pole: shield_wall, hagga_basin, imperial_basin, hole_in_the_rock, false_wall_west, false_wall_east
arsunt: carthag, hagga_basin, shield_wall, broken_land
carthag: arsunt, arrakeen, hagga_basin, imperial_basin, broken_land
arrakeen: carthag, imperial_basin, broken_land, rimwall_west
hagga_basin: arsunt, carthag, shield_wall, imperial_basin, north_pole
imperial_basin: carthag, arrakeen, hagga_basin, hole_in_the_rock, north_pole, rimwall_west
shield_wall: arsunt, hagga_basin, north_pole       # WEST border IMPASSABLE (see §4)
broken_land: arsunt, carthag, arrakeen, rimwall_west
rimwall_west: arrakeen, imperial_basin, broken_land, hole_in_the_rock   # + eastern desert
hole_in_the_rock: imperial_basin, north_pole, rimwall_west, splintered_rock, false_wall_east
splintered_rock: hole_in_the_rock, north_pole, false_wall_west, false_wall_east
# --- south: false walls + the 5-area minor-erg chain (harg_pass -> erg_2..erg_5) ---
false_wall_west: north_pole, splintered_rock, minor_erg_2, windgap   # +western desert
false_wall_east: north_pole, hole_in_the_rock, splintered_rock, harg_pass
false_wall_south: harg_pass, minor_erg_5, pasty_mesa, hobars_gap
harg_pass: false_wall_east, false_wall_south, minor_erg_2
minor_erg_2: harg_pass, false_wall_west, minor_erg_3      # chain order is a GUESS — please fix
minor_erg_3: minor_erg_2, minor_erg_4
minor_erg_4: minor_erg_3, minor_erg_5
minor_erg_5: minor_erg_4, false_wall_south
pasty_mesa: false_wall_south, tasmin_sink        # + SE desert
# --- outer ring (LEAST certain — please draw the real links) ---
the_funeral_plain: rock_outcroppings, the_great_flat       # NW outer
rock_outcroppings: the_funeral_plain, bight_of_the_cliff
bight_of_the_cliff: rock_outcroppings, the_great_flat, habbanya_ridge
the_great_flat: the_funeral_plain, bight_of_the_cliff, habbanya_ridge
habbanya_ridge: bight_of_the_cliff, the_great_flat, false_wall_west
sihaya_ridge: rimwall_west          # NE — fill neighbors
gara_kulon: rimwall_west, hobars_gap
hobars_gap: false_wall_south, gara_kulon
tasmin_sink: pasty_mesa
windgap: false_wall_west, minor_erg_2          # Windgap, next to False Wall West
```

> ✅ **City cluster adjacency PHOTO-VERIFIED** (new north-center photo): Arsunt–Carthag–Arrakeen
> and Hagga Basin–Imperial Basin interlock as drafted; ringed by Shield Wall (W), Broken Land (N),
> Rimwall West (NE), with an air zone between Hagga Basin & Imperial Basin.
> ⚠️ Still weak: the outer desert ring, and which **unnamed** mountain/desert areas sit between the
> named ones (the named areas don't all touch directly — unnamed areas fill the gaps). Needs the
> §2.1 IDs assigned to map positions before the full graph can be drawn.

---

## 4. Impassable borders (red lines)

**✅ CONSOLIDATED & user-confirmed (2026-06-27), collected from the area-by-area §3 pass.** These 11
unordered pairs each **block ground movement both ways** (they are NOT in the §3a neighbour lists).
**Model:** the red line is one continuous arc threading the N + W face of the central mountain/city
mass, separating it from the surrounding desert. It is NOT "every mountain edge" — most mountain
borders (e.g. s4_16↔arsunt/broken_land, Shield Wall #2↔cities) are passable; only these specific
seams are red.

```
# --- N face: Broken Land / Rimwall West / s5_5 vs the s1 (NE-outer) desert ---
broken_land  <-> s1_3
broken_land  <-> s1_4
rimwall_west <-> s1_4
rimwall_west <-> s1_5
s5_5         <-> s1_5
s5_5         <-> s1_7
# --- Broken Land vs s4 (NW-outer) ---
broken_land  <-> s4_11
# --- Shield Wall crest, internal to s4 (NW-outer): desert s4_15 | mountain s4_16 ---
s4_15        <-> s4_16
# --- Shield Wall #1 (s5) vs s5_6 ---
shield_wall_1 <-> s5_6
# --- Shield Wall #2 (s8) west border ---
shield_wall_2 <-> s8_1
s8_2          <-> s8_1
```
> **Count: 11 impassable pairs.** Per-area incidence (how many red edges touch each):
> s1_4 (2), s1_5 (2), s8_1 (2), broken_land (3), rimwall_west (2), s5_5 (2), others 1.
> ✅ **EXHAUSTIVE — user-verified against the physical board (2026-06-27).** These 11 are the complete
> set of red impassable borders; no others (incl. none extra near False Wall East).

---

## 5. Air zones (8 blue ornithopter circles) — ✅ user-confirmed 2026-06-27

**Model:** each air zone is a node that connects a **specific small set of areas** (the 2–3 listed) —
NOT all areas of a sector, and NOT the North Pole. An air zone lets vehicles cross between its areas
(notably az1 crosses where the **ground** border is impassable: s1_5/s1_7 ↔ s5_5). Whether air zones
also link zone-to-zone (an ornithopter flight network) is a movement-rule detail for Phase 2.

| air zone | connects these areas | straddles |
| -------- | -------------------- | --------- |
| az1 | s1_5, s1_7, s5_5 | s1 ↔ s5 |
| az2 | hagga_basin, s5_1, s5_2 | s5 ↔ s8 |
| az3 | s4_13, s4_14, s8_1 | s4 ↔ s8 |
| az4 | s5_7, s6_2 | s5 ↔ s6  *(sits in the minor-erg areas)* |
| az5 | false_wall_south, hobars_gap, s2_8 | s2 ↔ s6 |
| az6 | s6_4, s7_5, s7_6 | s6 ↔ s7 |
| az7 | s7_1, s7_2, s8_4 | s7 ↔ s8 |
| az8 | s3_8, windgap, false_wall_west | s3 ↔ s7 |

> **Structure (8 zones):** 4 link the **inner ring** (s5–s8: az2 s5–s8, az4 s5–s6, az6 s6–s7, az7 s7–s8)
> and 4 are **spokes** from each outer sector to its inner neighbour (az1 s1–s5, az3 s4–s8, az5 s2–s6,
> az8 s3–s7). az1's areas are exactly the impassable-ground crossing (§4), so air is the only link there.

---

## 6. Per-area terrain (collected per sector — feeds `terrain`/`deep` in board.ts)

**Format** (parsed by `scripts/gen_board.py`):
- `TERRAIN <sector>: <terrain> = <id,id,... | ALL>` — assign a terrain to those areas (`ALL` = every
  area in the sector). Named areas are already typed in §1 but may be reaffirmed here.
- `DEEP <sector>: <id,id,...>` — these (and only these) areas in the sector are deep desert (`deep=true`);
  every other desert area in the sector is `deep=false`.

```
TERRAIN s1: desert = ALL
DEEP s1: s1_1, s1_2, s1_10, s1_13, s1_14, s1_16, sihaya_ridge

TERRAIN s2: plateau = s2_5, pasty_mesa
TERRAIN s2: desert = s2_1, s2_2, s2_3, s2_4, s2_6, s2_7, s2_8, tasmin_sink
DEEP s2: s2_2, s2_4, s2_7, s2_8

TERRAIN s6: plateau = false_wall_south
TERRAIN s6: mountain = false_wall_east
TERRAIN s6: minor_erg = s6_2, s6_3, harg_pass
TERRAIN s6: desert = s6_1, s6_4, s6_5, hobars_gap
DEEP s6: s6_5

TERRAIN s3: plateau = s3_8
TERRAIN s3: desert = s3_1, s3_2, s3_3, s3_4, s3_5, s3_6, s3_7, s3_9, habbanya_ridge
DEEP s3: s3_1, s3_4, s3_6, s3_7, s3_9

TERRAIN s7: plateau = s7_2, false_wall_west
TERRAIN s7: desert = s7_1, s7_3, s7_4, s7_5, s7_6, windgap
DEEP s7: (none)
```
