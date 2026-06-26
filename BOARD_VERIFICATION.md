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
  center-left (W of Hagga Basin) · s8_3 🟡 not yet pinned (likely near Wind Pass/Splintered Rock) ·
  s8_4 bottom-left (by air zone) · **Arsunt** (named, by Carthag) · **Hagga Basin** (settlement I) ·
  **Splintered Rock** (mtn) · **Shield Wall #2** (mtn, red border) · **Wind Pass** (named nd).
  ⏳ s8_1,2,4 + 5 named found; **s8_3 to locate**.

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

### 3a. Confirmed adjacency (from user — AUTHORITATIVE; partial neighbor lists OK)
Each line lists known neighbors so far; we complete each area's full list over time.
```
shield_wall_1 (s5_mtn4):  gara_kulon (s1_nd1), <a minor erg in s5 = s5_erg4 or s5_erg5>
shield_wall_2 (s8_mtn2):  arsunt (s8_plt1), hagga_basin (s8_plt2)
wind_pass     (s8_nd1):   north_pole (np), splintered_rock (s8_mtn1)
```

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

## 4. Impassable borders (red/white lines)

```
shield_wall <-> (western desert area west of it)   # CONFIRMED red border (Bight of the Cliff side)
broken_land  <-> (north desert)   # CONFIRMED: red border runs along the NORTH edge of the
rimwall_west <-> (north desert)   #   Broken Land / Rimwall West arc — blocks city-mtns <-> north desert
# The impassable line appears continuous along the N + W of the central mountain mass (Rimwall
# West -> Broken Land -> Shield Wall). Confirm full extent; more red near False Wall East too.
```

---

## 5. Air zones (≈8 blue circles with ornithopter icon) — many seen, pairings unconfirmed

Each air zone sits on a sector boundary and connects to all areas in both sectors (and the pole).
Seen at: between Hagga Basin / Imperial Basin · west of Shield Wall (×2) · around the pole (several) ·
east desert (×2–3) · SE. Please list each with the two sectors it straddles once §2 is set.

| air zone | sector A | sector B |
| -------- | -------- | -------- |
| az1      | ?        | ?        |
| ...      |          |          |
