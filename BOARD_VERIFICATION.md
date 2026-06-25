# Board verification checklist — please correct

**v2** — re-extracted from your physical-board photos (`docs/map/`), far more reliable
than the rulebook art. You correct it; then I generate the engine's `board.ts` from it.

**Confidence key:** ✅ confident · 🟡 likely · ❓ guess — please verify

**Board structure (confirmed):** two square sections joined at a central seam; polar map
with the **North Pole as the central hub**. Sectors radiate from the pole (4 central ring +
4 outer ring). Supremacy track on the west edge, Prescience track on the east edge.

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

### Desert (pale sand) — sietch names partial (glare/small labels)
| id | name | type | deep | feature | conf |
|----|------|------|------|---------|------|
| sihaya_ridge | Sihaya Ridge | desert | ? | sietch | ✅ |
| rock_outcroppings | Rock Outcroppings | desert | ? | sietch | ✅ |
| bight_of_the_cliff | Bight of the Cliff | desert | ? | sietch | ✅ |
| the_great_flat | The Great Flat | desert | Y | – | ✅ |
| the_funeral_plain | The Funeral Plain | desert | Y | – | ✅ |
| windgap | Windgap (next to False Wall West) | desert | ? | sietch | ✅ (name) |
| habbanya_ridge | Habbanya Ridge | desert | ? | sietch | ✅ (name) |
| gara_kulon | Gara Kulon | desert | ? | sietch | ✅ (name) |
| hobars_gap | Hobars Gap | desert | ? | sietch | ✅ (name) |
| tasmin_sink | Tasmin Sink | desert | Y | sietch | ✅ (name) |

> **All 8 sietches named** ✅: Sihaya Ridge, Rock Outcroppings, Bight of the Cliff, Windgap,
> Habbanya Ridge, Gara Kulon, Hobars Gap, Tasmin Sink. (Still set `deep` Y/N per sietch.)
>
> ❓ **Unnamed outer desert areas:** the outer ring has several open desert polygons split by
> white borders that I couldn't all name. Please add/rename rows so every area on the board
> is represented. (I can also do another zoom pass on specific photos to read more labels —
> just say which corner.)

---

## 2. Sectors (8 total: 4 central + 4 outer)

Spokes radiate from the North Pole. I can see the blue boundary lines but did not fully
assign every area. Please name the 8 sectors and list their member areas.

| id  | central/outer | areas in this sector                                                |
| --- | ------------- | ------------------------------------------------------------------- |
| s1  | central       | ? (the cities cluster is split across the northern central sectors) |
| s2  | central       | ?                                                                   |
| s3  | central       | ?                                                                   |
| s4  | central       | ?                                                                   |
| s5  | outer         | ?                                                                   |
| s6  | outer         | ?                                                                   |
| s7  | outer         | ?                                                                   |
| s8  | outer         | ?                                                                   |

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
