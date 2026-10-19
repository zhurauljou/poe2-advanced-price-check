# PoE 2 — Gaze, lich omens, Verisium, runes: research summary (for the Craft advisor)

- **Relevant for:** 0.5.5e, Forbidden Rites league. **Compiled:** 2026-10-18.
- **Data for the code:** `data/crafting-methods-research.json`. It has `items` (44 entries), `lichMods` (lich mod pools by class and side), `lichModsNoOmen`, `lichModIndex` (198 mods with `group` and spawn tags), `alteredCollarbonePool` and `runesData` (source and top runes by slot).
- **Prices:** poe.ninja, Forbidden Rites, 18.10.2026 (1 div = 710 ex). Lich omens, Ulaman's/Amanamu's Gaze and Starlit Ore have almost zero trade volume; their prices are unreliable.
- **Confidence:** H — item text on poe2db, patch notes or RePoE; M — community guides or a conclusion drawn from H; L — a single weak source.
- What is already in `crafting-notes.md`, `crafting-tricks.md` and `corruption-sanctification.md` is not repeated here.

## 1. Abyss Gaze (Abyssal Eye)
They don't change mods. These are **augments for an augment socket** (`slot: socket`), req. 60, **"Limited to: 1 Ancient Augment"**. The limit is shared with the Thesis cores (Jiquani's / Guatelitzi's / Quipolatl's / Citaqualotl's) and Emergent runes. The text says "Weapon or Armour", but only three slots have effects [H]:

| Gaze | Effect | Price |
|---|---|---|
| Kurgal's | Helmet: Life Regen also affects Mana Regen; gloves: 40% Arcane Surge effect; boots: 15% Mana Cost Efficiency if you haven't Dodge Rolled | **~31 div** |
| Tecrod's | Body: 1.5% life regen/s; gloves: 25% Life Cost Efficiency; boots: 10% MS on Low Life | ~12 div |
| Amanamu's | Helmet: removes a damaging ailment on a Command skill; body: +2 Armour per 1 Spirit; boots: 1% MS per 15 Spirit (up to 40%; other MS mods, except Sprint, stop working) | ~0.5 div |
| Ulaman's | Helmet: +1 Accuracy per 1 helmet Evasion; gloves: Lucky crit against Parried; body: Prevent +3% of Deflected damage | ~0.2 div |

Advisor: count Gaze as an addition to the item's price and as a candidate for the socket. A Gaze can be removed only with an **Orb of Extraction** (~2.35 div, destroys the item).

## 2. Lich omens (Sovereign = Ulaman, Liege = Amanamu, Blackblooded = Kurgal)
- Text: "next **Weapon or Jewellery** Desecration attempt will guarantee a random <lich> modifier". A GGG employee: "The Lich specific omens are only compatible with weapons and jewelry". The omen **rejects** a Rib with a Focus and armour; a belt works [H]. For a quiver (Jawbone) unconfirmed [M].
- All lich mods are level 65. Requires ilvl ≥ 65 and a Preserved or Ancient bone; Gnawed is rejected [H]. Ancient on top of a lich omen is useless (this is already in tricks).
- With the omen, all 3 reveal options are drawn from the lich's pool for the class and side. Community recipes confirm: Sovereign + Sinistral on a crossbow "always" gives +1 Ballista [M].
- **The "guaranteed at ≤ 3" model:** pool = `lichMods[omen][class][side]` minus mods whose `group` (see `lichModIndex`) is already on the item. If the pool has ≤ 3 mods, all of them are shown for the choice and the needed mod is guaranteed. Otherwise P(target in the set) = 3/n (sampling without replacement, equal weights).
- Pool sizes (prefixes/suffixes). One-handed and two-handed swords, axes, daggers, claws and flails have 1/1 for each lich: these are "Penetrate X Resistance" and a shared suffix.

| Class | Sovereign | Liege | Blackblooded |
|---|---|---|---|
| amulet | 4/6 | 4/6 | 3/8 |
| ring | 2/4 | 3/5 | 2/6 |
| belt | 3/4 | 3/4 | 3/4 |
| bow | 2/3 | 3/3 | 3/3 |
| crossbow | 2/3 | 3/2 | 2/3 |
| spear | 2/3 | 3/3 | 3/3 |
| wand | 2/4 | 3/3 | 1/2 |
| staff | 2/2 | 3/3 | 2/2 |
| quarterstaff | 2/2 | 2/2 | 2/2 |
| 1H/2H mace | 5/6 | 1/1 | 2/1 |
| talisman | 4/4 | 3/3 | 2/2 |
| quiver (M) | 1/2 | 1/1 | 1/2 |
| sceptre | 0/0 | 0/0 | 0/0 |

- The omen costs pennies (≤ 0.02 div). Cost of an attempt = bone + omen + Necromancy.
- **Altered Collarbone** (~3.8 div) — a separate pool of "otherworldly" (Breach) desecrated mods: amulet 4, ring 16, belt 16 (`alteredCollarbonePool`). In RePoE these are level 1 mods, so Whittling will remove such a mod first. The chance of an otherworldly mod is not published [L].

## 3. Verisium
- **Verisium** — Runeforging at the Verisium Anvil. The base turns into "Runeforged <base>" and gets Runic Ward; mods apparently are kept [M]. Price: 20–230 Verisium for a body armour, up to ~490 for level 80 shields and foci. For bases below level 55 — no losses (Vaal Cuirass: 298 AR + 70 Ward). Above 55 the base loses part of its defence: Tasalian Focus ES 91 → 36, Desert Buckler EV 192 → 87 [H per RePoE]. The mod pool does not change: RePoE has no mods with the `runeforged` tag [H]. Verisium is almost free. The advisor can remind "Runeforge before selling" if the base is below 55 and the item is armour.
- **Exceptional Verisium** — special bases: Sacrificial Regalia (4 variants with a new implicit) and Grasping Mail (Runeforged → Runemastered → Runefather's, the defence type changes) [M].
- **Starlit Ore** (Revered / Veridical / Venerable / Warding) — forging a specific unique (The Unleashed / Eventide Petals / Eyes of the Runefather / Duality). **Crest** (Medved / Vorana / Uhtred / Olroth) — Unique Runeforging: upgrading a unique's base, each unique has its own recipe. **Liquid Verisium** — starts a Runic Remnant. For crafting rare items all of this is `ignore`.

## 4. Runes and soul cores — machine data
- **URL:** `https://repoe-fork.github.io/poe2/augments.json` (+ `.min.json`). It is the same host as `REPOE` in `src/main/craft.js`; the file is from 11.09.2026 (0.5.5b). The key is the Metadata path; the name is taken from `base_items[key].name`. Value: `type_id` (Rune / SoulCore / Idol / AbyssalEye / CongealedMist), `required_level`, `limit` and `categories: {slot: {target, stat_text, stats, bonded_stat_text}}`. 313 entries.
- `bonded_*` — "Bonded" effects; they work only with the Shaman notable Wisdom of the Maji. **Ignore them for pricing.** Perfect Adept / Robust / Resolve have no other lines on weapons.
- **Top by slot** (in full — in `runesData.top`):
  - **Weapon (martial):** Perfect Iron (20% inc phys), Perfect Desert / Glacial / Storm (flat ele), Soul Core of Quipolatl (5% AS), Citaqualotl (40% ele with attacks), Topotante (pen 25%), Fenumus' (13% extra chaos), Saqawal's (5% of all elements), Farrul's Hunt, Jiquani's cores (+1 to a skill type). Perfect runes cost ~2.6–3.8 div, the rest — pennies.
  - **Caster (wand/staff):** Perfect Iron (35% spell), Perfect Desert / Glacial / Storm (12% extra ele), Hedgewitch Assandra's (+1 spell), Perfect Vision (28% spell crit), Perfect Mind (+90 mana); Aldur's Legacy runes (Lifesprig +2 spell, Cursecarver +3 curse) — no price on the exchange. **Sceptre:** Xipocado's Dominion, Rune of the Hunt.
  - **Body:** Emergent Vigour (~42 div), Emergent Possibility (~29), Guatelitzi's Thesis (~16), Tecrod's Gaze; basic ones — Perfect Body (+75 life), Perfect Iron (20% def), Perfect resists (+22%), Citaqualotl (+6% all res).
  - **Helmet:** Jiquani's Thesis (~226 div), Raven-Touched Shard (~208 div, "Raven-Touched" — the item can be instilled), Emergent Vigour, Kurgal's Gaze, Atziri's Devotion (~8.6), Vorana's Carnage (Berserking).
  - **Gloves:** Jiquani's Thesis, Kurgal's Gaze, Emergent Possibility, Tecrod's Gaze, Kolr's Hunt / Katla's Gloom (mod pools — already in the app), Cadigan's Epiphany (augment sockets → jewel socket).
  - **Boots:** Jiquani's Thesis, Kurgal's Gaze, Tecrod's Gaze, Guatelitzi's Thesis (+25% MS while Sprinting), Farrul's Chase (5% MS), Zalatl's Insulation, Uhtred's Sidereus.
  - **Shield / focus:** almost only generic Armour runes (Perfect Body / Iron / resists, Citaqualotl), Soul Core of Ticaba (−50% crit dmg against you), Rune of Vitality, Atmohua's Retreat (focus), Ancient Rune of Witchcraft / Retaliation / Dueling.
  - **Meta (any slot):** Astrid's Creativity (+1 crafted, **~3.6 div**), Serle's Triumph (+1 suffix, ~3 div), Masterwork Rune (upgrades the rune in the socket, ~0.9 div).

## 5. Greater/Perfect Chaos and Regal [H]
- Minimum mod level: Greater **35**, Perfect **50** — for both Chaos and Regal (poe2db). The threshold applies to the **added** mod. Exception for families with a low ceiling — see tricks §0.
- Whittling and Sinistral/Dextral Erasure trigger on the "next Chaos Orb", i.e. also on Greater/Perfect [M/H]. The removal ignores the threshold. The side of the new mod is not restricted, but on a full item the new mod goes to the side that was freed [M].
- Sinistral/Dextral Coronation — "next Regal Orb", also works with Greater/Perfect Regal [M]. Homogenising Coronation exists only in Standard.
- Prices: **Perfect Chaos ~7.7 div**, Greater Chaos ~0.3; Perfect Regal ~0.05, Greater Regal ~0.01. For the advisor: Perfect Regal is almost always more cost-effective than the regular one, and a Perfect Chaos + Whittling step costs ~22 div.

## 6. Miscellaneous (one line each)
| Item | What it does | For the advisor |
|---|---|---|
| Omen of Amelioration | −75% experience loss on death | no |
| Omen of Answered Prayers | extra shrine effect | no |
| Ancient Infuser | changes and corrupts a Tablet | no |
| Core Destabiliser | changes a Soul Core (may destroy it) | no |
| Vaal Siphoner | corrupted rare ring or amulet: a kill threshold (with a minimum monster level); once it is reached, **one random mod loses a tier** (at the lowest tier it stays as is), the others are rerolled from the current value up to **110% of the tier maximum**; applying it again resets the progress (Mobalytics [vaal-siphoner](https://mobalytics.gg/poe-2/guides/vaal-siphoner), 2026-10-09, **M**; earlier this said "removes a random mod" — per the old description) | advice (final step) |
| Orb of Extraction | destroys the item, returns the augments | advice (expensive cores and runes) |
| Artificer's Shard | 10 pcs = Artificer's Orb | no |
| Crystallised Corruption | double corruption of a gem | no |
| Perfect / Thaumaturgic Flux | raises the item's skills to 20 (or to a fixed level, L) | advice (wand/staff/sceptre) |
| Masterwork Rune | upgrades the socketed rune | advice |
| Altered Collarbone | see §2 | plan |
| Architect's, Orbs of Sacrifice, Vaal Cultivation | already in `corruption-sanctification.md` | — |
| Chaotic omens, Bartering / Gambling / Hunt / Resurgence / Refreshment / Reinforcements / Secret Compartments, Sagas, Ritual items | maps, vendor, combat, Expedition | no |

## 7. Contradictions with the existing notes
| Where | Now | According to data | Confidence |
|---|---|---|---|
| tricks §1.1 | "Amanamu 26P/44S, Kurgal 23P/39S, Ulaman 22P/44S" | RePoE: **Ulaman 26P/51S, Amanamu 24P/39S, Kurgal 21P/37S** (198 in total; 2 mods disabled) | H |
| tricks §0 / T2 | "lich exclusives are not among armour prefixes" | True for helmet, gloves, boots, body, shield and buckler. **A focus does have lich prefixes** (Sovereign: spell dmg while melee, +1 spell totem; Liege: curse magnitude, offering; Blackblooded: invocated dmg, spell AoE), but the omen does not work on a focus | H |
| notes §2.5 / tricks D-8 | lich omens — weapons and jewellery only | Confirmed by GGG. Add: a belt works, a Gnawed bone is rejected | H |
| tricks §5 (prices) | Echoes ~1 div; Light 5+; side Annul ~3.5; Erasure "several div"; Astrid's 14–20; Greater Exaltation ~4 ex | Now: Echoes **0.08**; Light **8.8**; Sinistral / Dextral Annulment **19.6 / 12.8**; Erasure **20 / 13.2**; Whittling **14**; Astrid's **3.6**; Greater Exaltation ~14 ex; Perfect Chaos 7.7; Fracturing 10.6; Hinekora 1677; Preserved Cranium 28 | H (snapshot) |
| Vaal Siphoner (§6) | "removes a random mod" | lowers the tier of one mod, the others — up to 110% of the maximum (Mobalytics, 2026-10-09); fixed in §6 and `data/crafting-methods-research.json` | M |
| `essences.js` (poe2db) | Perfect Battle +2/+3, Horror 60%, Hysteria on a focus 20–23% | Mobalytics [essences](https://mobalytics.gg/poe-2/guides/essences) (upd. 2026-06-16): +4/+6, 100%, 41–45% — the table looks outdated; left per poe2db, check in game | disputed |
| tricks D-3 [T15] | The Mark (Essence of the Abyss) can be fractured with a Fracturing Orb | Mobalytics [ssf-crafting](https://mobalytics.gg/poe-2/guides/ssf-crafting) (2026-06-24): the Mark is desecrated and cannot be fractured (chance 1/3 instead of 1/4) | disputed |
| runes | Uhtred's Sidereus — boots augment only | Mobalytics [runes-of-aldur](https://mobalytics.gg/poe-2/guides/runes-of-aldur) (2026-07-20): the socketed rune unlocks **Chronomancy** mods for the item (like influence runes — their own pools); not accounted for in the advisor | M |
| notes §2.7 | only Runic Ward from Verisium | Add Exceptional Verisium (special bases) and Crest / Starlit Ore — these are uniques, not crafting | H/M |

## 8. What to model (priority)
1. **Lich omen in the desecrate plan** for weapons and jewellery: "guaranteed at ≤ 3", otherwise 3/n; do not suggest it for armour, focus, shield and sceptre, or at ilvl < 65.
2. **Cost of Whittling / Erasure / side-Annul steps** — from live prices. Right now they are an order of magnitude more expensive than in tricks; Perfect Chaos is expensive too.
3. **Augments as a price addition and a "what to socket" hint** — from `augments.json`: Gaze and Thesis in armour slots, Perfect runes. Ignore Bonded lines.
4. **Perfect Regal instead of Regal** at high ilvl. It is cheap.
5. Runeforging (armour below level 55) and Altered Collarbone (jewellery) — optional hints.

## Sources
- poe2db 0.5: Amanamus_Gaze, Kurgals_Gaze, Ulamans_Gaze, Tecrods_Gaze, Omen_of_the_Sovereign, Omen_of_the_Liege, Omen_of_the_Blackblooded, Altered_Collarbone, Liquid_Verisium, Verisium, Exceptional_Verisium, *_Starlit_Ore, *_Crest_of_*, Runeforging, Runeforged_Vaal_Cuirass, Greater/Perfect_Chaos_Orb, Greater/Perfect_Regal_Orb, Omen_of_Whittling, Omen_of_Sinistral/Dextral_Erasure, Omen_of_Sinistral_Coronation, Masterwork_Rune, Perfect_Flux, Orb_of_Extraction, Vaal_Siphoner and others from §6 — `https://poe2db.tw/us/<Name>`
- GGG on lich omens: https://www.pathofexile.com/forum/view-thread/3834266
- Patch notes 0.5.0 (Runeforging, Runic Ward): https://www.pathofexile.com/forum/view-thread/3932540
- RePoE: https://repoe-fork.github.io/poe2/augments.json, mods.min.json, base_items.min.json (local app cache)
- poe.ninja exchange API (Forbidden Rites, 18.10.2026): `https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden%20Rites&type=<Currency|Ritual|Abyss|Verisium|Runes|SoulCores|Expedition>`
- Community recipes (Sovereign + crossbow): https://github.com/fixerpimp-gamer/POE2_0.5_Craft_Guides
- Bonded = Wisdom of the Maji: https://www.poe2wiki.net/wiki/Bonded (search snippet only)
