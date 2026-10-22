# Game knowledge for development

What the program knows about PoE 2 beyond the code: crafting mechanics, corruption, jewels, the market. The documents are for whoever works
on the craft advisor and price estimation; what the code reads lives in `data/*.json` and is checked by tests.

## Contents

| File | What's inside | Patch / verified | What the code uses |
|---|---|---|---|
| [crafting-notes.md](crafting-notes.md) | Basic crafting rules of 0.5: slots, ilvl and Greater/Perfect thresholds, currency, essences, Alloys, omens, recipes; §6 — what is done in code and what is open | 0.5.5 / 2026-10-18 | `src/main/craft.js`, `src/shared/plancost.js` |
| [crafting-tricks.md](crafting-tricks.md) | Techniques and combos: Desecration in detail, omen stacking, deterministic techniques, typical chains, traps | 0.5.5 / 2026-10-18 | craft plan (`plancost.js`) |
| [crafting-methods-research.md](crafting-methods-research.md) | Lich omens, Abyss Gaze, Verisium, runes and soul cores, other currency (line by line) | 0.5.5e / 2026-10-18 | `src/shared/methods.js`, `data/crafting-methods-research.json` |
| [corruption-sanctification.md](corruption-sanctification.md) | Vaal Orb, Infusers, double corruption, Sanctify, corruption mod pools by class | 0.5.5 / 2026-10-18 | `data/gamble-currency.json` (test `test/gamble.test.js` checks it against game data) |
| [jewels-crafting.md](jewels-crafting.md) | Jewels: pools, Liquid Emotions, Cranium, pricing, demand by base, exceeding the limit | 0.5.5 / 2026-10-19 | jewel crafting in `craft.js` |
| [market-notes.md](market-notes.md) | Market and demand: what is expensive, how bases and drops are priced, 0.5.5 builds and the stats they need, tablets | 0.5.5 / 2026-10-18 | nothing yet — ideas for price estimation |

Game data the documents rely on: RePoE (`repoe-mods.json`, `repoe-base-items.json` in the program cache,
the snapshot for tests — `test/fixtures/data`), the trade reference data (`stats.json`), poe.ninja.

## How to record

- **Patch and date** for every section or fact: "0.5.5, 2026-10-18". An outdated fact is worse than a missing one: this happened with the tags
  `no_*_spell_mods` (present in the data, but the game does not apply them — an Ashen Staff with a Cold mod turned up on trade).
- **Confidence** — one of three labels:
  - **H** — game data (RePoE, item text on poe2db), official patch notes, verified on live trade or in the game;
  - **M** — several community guides or a conclusion drawn from H;
  - **L** — a single source, an old guide, unverified.
  Older documents contain [official] / [community], [R] / [T] — these mean the same (H / M).
- **Source** — link and article date. Paraphrase in your own words: guides are copyrighted and go out of date quickly.
- **Contradictions** must not be silently fixed: record both claims with sources and the note "check in game" (section below).
- **If the code uses the knowledge** — it goes in `data/*.json`, and a test checks it against game data where possible
  (example — `test/gamble.test.js`: corruption mods on every base). Then a mismatch after a patch will be caught by CI.
- In the document, mark what is already done in code and what is open (like `crafting-notes.md` §6).

## Open questions — check in game

| Question | Sources | What the code does now |
|---|---|---|
| ~~**Abyssal Echoes:** after the reroll, can you take an option from the first three (a choice of 6) or only from the new ones?~~ **Only the new three** — player screenshot, 2026-10-22 (H): after the reroll the Well of Souls shows just the three new options | Player (2026-10-18): the omen lets you see 3 options and reroll once — "3 + 3". Whether you can go back to the first three is not clarified, but **it does not affect the calculation**: if the needed mod is in the first three, you take it; if not, you reroll; the chance is the same 1 − (1 − p)⁶. The difference matters only when choosing the best of several suitable ones | two independent triples, no repeats within a triple (player: a mod can come back in the second triple): 1 − Π(1 − g/(N − i)) per triple (`plancost.js`, 0.3.146) |
| ~~**Desecrate on a full item with a Necromancy omen** removes a mod from the same side?~~ **Yes** — player, 2026-10-18 (H): on full suffixes with Dextral Necromancy a suffix disappeared and an unrevealed desecrated suffix took its place | Mobalytics abyss-crafting, talisman-craft | `plancost.js` `desFirst`: one extra mod on a full side — Desecrate before the removals, instead of one Annulment attempt |
| **Essence of the Abyss + Fracturing Orb:** can the Mark be fractured? | tricks D-3 [T15]: yes; Mobalytics ssf-crafting: the Mark is desecrated and cannot be fractured. Player (2026-10-19): the Mark is desecrated and is removed by Omen of Light + Annulment — this supports the Mobalytics version, but Fracture on the Mark was not tested directly | — |
| **Jewel: exceeding the limit after Contempt** — remove the crafted "+1 Suffix allowed" and the three suffixes stay? Does it work in 0.5.5? | GGG forum 2026-06-04, poecurrency 2026-08-07 (M/L); no fix in the patch notes | the side over the limit is not touched, section "Over the limit" (`craft.js`) |
| **Greater Exalted / Chaos on a jewel** — do they apply (like the regular ones) or fail? | poe2wiki, codex: the family is not excluded (M); timesaver: strict threshold (L) | we don't recommend them, "no benefit" |
| **An emotion on a full jewel when its mod is of one side** (Paranoia → suffix): which mod is removed? Contempt on a 3-mod one (2P+1S)? | guides: "50/50" for Ferocity/Contempt on 2+2 (M) | emotion options — not built into the plan; risk — the key ones out of all mods |
| **Omen of Catalysing Exaltation on jewels** (Refined Catalysts) | poe2db: no restrictions; mobalytics: Ring/Amulet (L) | we don't recommend it |
| **Essence values** (Perfect Battle +2/+3 or +4/+6, Horror 60% or 100%, Hysteria on a focus) | poe2db (`essences.js`) versus Mobalytics essences (upd. 2026-06-16) | poe2db |
| **Artificer's Orb socket limit** by slot | Mobalytics currency-guide: body / two-handed 2, everything else 1 (the same guide has the outdated "caster weapons have no sockets") | 2 / 1 per the guides |

## New patch — checklist

0. What changed — `npm run check-patch` (compares RePoE and the trade reference data with the snapshot `test/fixtures/data`, leagues with
   `data/patch-baseline.json`, currency names from `data/*.json` with the game). GitHub runs it once a week
   (`.github/workflows/patch-check.yml`) and on changes opens an issue labelled `patch-check`. After reviewing —
   step 6 (new snapshot) and `node scripts/check-patch.js --update` (remember the leagues).
1. The program updates the data itself: the trade reference data and RePoE — once a day; when a new league appears — everything at once;
   if an item has a mod or base missing from the trade reference data — the reference data again (no more than once an hour). Manually —
   "Refresh game data" in the settings.
2. `CRAFT_LIVE=1 npm test` — craft scenarios and corruption mods on fresh data; investigate failures.
3. `node scripts/audit-craft.js` — the advisor on 840 random items: 0 violations.
4. Check the manually collected data (`data/crafting-currency.json`, `data/gamble-currency.json`, `src/main/essences.js`,
   `src/shared/methods.js`) against the patch notes and poe2db; update "Patch / verified" in the table above.
5. Mod weight estimates for the new league — with the local collection utilities (not in git): exalted rares
   (`scripts/collect-drops.js`, then `scripts/build-exalt-weights.js`) → commit `data/exalt-weights.json`; trade listings
   for the classes without enough exalted items → commit `data/weights.json` once enough has been collected (hours / overnight).
6. `node scripts/snapshot-test-data.js` — a new data snapshot for tests.
