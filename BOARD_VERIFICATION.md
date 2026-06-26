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

**Grand totals to reconcile against:**
plateau **8** · mountain **7** · minor_erg **5** · deep-desert **23** (20 unnamed + Sihaya Ridge,
Rock Outcroppings, Great Flat) · desert/non-deep **7** (Bight, Windgap, Habbanya Ridge, Gara
Kulon, Hobars Gap, Tasmin Sink, Funeral Plain) = **50 areas**

| sector | c/o | #areas | plat | mtn | m.erg | deep des | desert |
|--------|-----|--------|------|-----|-------|----------|--------|
| SW | outer | 10 | 1 | 0 | 0 | 5 | 4 |
| SE | outer | 10 | 2 | 0 | 0 | 4 | 4 |
| NE | outer | 18 | 0 | 0 | 0 | 7 | 11 |
| NW | outer | 20 | 0 | 4 | 0 | 6 | 10 |
| **outer Σ** | | **58** | **3** | **4** | **0** | **22** | **29** |
| SW-in | central | 8 | 2 | 0 | 0 | 0 | 6 |

*(Inner-sector counts **EXCLUDE North Pole** — it's 1 mountain area shared by all 4 central
sectors, counted once separately at the end. So board mountain total = inner mountains + outer 4 + North Pole.)*

**Running tally (5 of 8):** plateau **5**/8 · mountain 4/7 (+ North Pole pending) · minor_erg 0/5 · deep-desert **22**/23 (central confirming 0 deep ✓) · non-deep desert **35** · **areas 66** (+ North Pole)

> **Cross-check after all 4 outer sectors:**
> - ✅ **Plateau 3 outer / 5 left for central** — and the 5 remaining must be the **5 city plateaus**
>   (Arrakeen, Carthag, Arsunt, Hagga Basin, Imperial Basin) = the storm-safe "5 central plateaus". Clean!
> - ✅ **minor_erg 0 outer** — all 5 (Harg Pass chain) fall in central, as expected.
> - ✅ **mountain 4 outer / 3 left for central** (incl. North Pole the hub).
> - ⚠️ **deep-desert = 22, expected 23.** Central sectors should have **0** deep desert (they're inner),
>   so we're **1 short**. Likely an off-by-one in a per-edge count (the 20 unnamed) or one sector. To
>   reconcile: do central (confirm 0 deep there), then we recheck one edge. (Everything else reconciles.)
> - **non-deep desert 29** (7 named + ~22 unnamed) — central will add a few more; we'll catalogue all
>   the unnamed non-deep areas in §1 after the 8 sectors are in.

> Rules note: Coriolis storms spare "the 5 **central plateau** areas." With the corrected types
> this is almost certainly the **5 city plateaus** (Arrakeen, Carthag, Arsunt, Hagga Basin,
> Imperial Basin) — please confirm.

---

## 3. Adjacency (ground movement) — improved draft, please correct

White-border neighbors only. `# impassable` notes go to §4.

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

> ⚠️ Outer-ring adjacency is still my weakest area. The core (cities/pole/plateau) is solid.

---

## 4. Impassable borders (red/white lines)

```
shield_wall <-> (western desert area west of it)   # CONFIRMED red border; which area? (Bight of the Cliff side)
# A few more red segments seen near the eastern mountains and around False Wall East — please add.
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
