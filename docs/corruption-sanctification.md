# PoE 2 — corruption, Sanctify and other "final steps" (for the Craft tab)

- **Current for:** patch **0.5.5** (league **Forbidden Rites**) + Standard. Corruption/Sanctify mechanics changed in **0.5.0** (Runes of Aldur) and **0.5.4** (Orbs of Sacrifice); 0.5.5 has no changes on these topics [PN055].
- **Compiled:** 2026-10-17. Data for the code — `data/gamble-currency.json`.
- **Confidence labels:** **[official]** — patch notes or item text (poe2db); **[community]** — community guides (Maxroll/Game8/Timesaver/U4N), often commercial; **[unverified]** — a single weak source or contradictions.
- **Key point:** GGG **does not publish** Vaal Orb outcome chances. Every "~25%" below is a community estimate.
- Unavailable during collection: maxroll.gg (connection dropped, only search snippets available), poe2wiki.net (Anubis), mobalytics (403).

## 1. Vaal Orb

**Text [official, DB_VAAL]:** "Modifies an item unpredictably and Corrupts it" / "Right click this item then left click an item to corrupt it. Corrupted items cannot be modified again." Stack 20, drop level 35. Price ≈ 1/57 Divine [PRICES].

**What changed in 0.5.0 [official, PN050]:**
- "The Corruption outcome that randomises the numeric values of the modifiers on an item beyond the normal range" — now **multiplies each mod from its current value** instead of rerolling it randomly. So a well-rolled unique, on average, stays good after this outcome, and a poor one stays poor.
- "Omen of Corruption can no longer be obtained." On the Currency Exchange — Standard only.

**Outcomes — Rare/Magic equipment** (one outcome at a time, not a combination) [community, TS_VAAL cites Game8; TS_DC]:

| Outcome | Chance | What happens to the price |
|---|---|---|
| No change (only the Corrupted tag) | ~25% | Usually −10…−30%: the item is "frozen", a buyer cannot finish crafting it |
| Corruption enchant (an enchant line, pool by class — §8) | ~25% | From "zero" to a multiple increase: MS on boots, +1 to skills on an amulet, +1 Max Res, etc. |
| Mods change: 1–3 random "reforge" steps (mods are replaced/rerolled) | ~25% | Most often **ruins** the item; on a good rare it is the main risk [unverified: exact mechanics] |
| +1 Augment socket **beyond the normal limit** (armour, shields/bucklers/foci, martial weapons) | ~25% | A good outcome for a body armour/two-hander (an extra rune) |
| Wands/Staves: quality up to ~23% instead of a socket | ~25% | A minor plus [unverified after 0.5: Artificer's Orb now works on wand/staff] |
| Amulets/Rings/Belts: no socket → the "no change" branch doubles | ~50% "nothing" | [unverified, search snippet only] |

**Outcomes — Unique** [community, U4N, MAXROLL snippet, TS_DC]: ~25% no change; ~25% corruption enchant; ~25% +1 socket (weapons/armour; on jewellery — nothing); ~25% mod values **×0.78…×1.22 of current**, step 0.01, with rounding. The "of current" rule is [official], the range is [community].

**Outcomes — Jewels** [community, U4N]: regular (rare/magic) — no change / enchant / reroll of up to 3 mods / +1 or −1 mod (can exceed the normal affix limit); unique — no change (two "nothing" slots, ~50%) / enchant / values ×0.78…1.22.

**Skill Gems** [community, TS_VAAL]: no change; +1 level (~12.5%); −1 level (~12.5%); ±1 support socket; quality shift −7…+3% (cap ~23%). A second time — **Crystallised Corruption** ("Modifies a Corrupted Skill Gem unpredictably or destroys it" [official]).

**Waystones** [community, TS_VAAL]: no change; ±1 tier (T1–T16); all affixes become prefixes or suffixes; random affixes are added. Chances not published. The "safest" use of a Vaal.

**Essence monsters** [community, old gamerant + crafting-notes.md]: more essences / type change / upgrade to a corrupted essence (Hysteria, Delirium, Horror, Insanity, Abyss, Breach). The atlas option **Archaic Corruption** (0.5.5) — essence monsters become Corrupted [PN055].

**Important for "sockets":** regular runes can be inserted into an empty socket of a Corrupted item, but since 0.5.4 the **9 meta runes** cannot be inserted into a Corrupted or Sanctified item: Astrid's Creativity, Katla's Gloom, Kolr's Hunt, Medved's Tending, Raven-Touched Shard, Serle's Triumph, Thrud's Might, Uhtred's Sidereus, Vorana's Carnage [official, PN054]. They must be inserted **before** corruption.

## 2. Vaal Infusers (4 types, 0.5.0)

[official, PN050 + DB_CUR texts] "There are now 4 types of Infusers… All Infusers can only be used on items at or above 20% Quality." Common text: "Improves the quality of … exceeding maximum quality by up to 10% with a chance of Corrupting it".

| Infuser | Used on | Price [PRICES] |
|---|---|---|
| Vaal Armourer's Infuser | "an Armour" — Body Armours, Helmets, Gloves, Boots, Shields, Bucklers, Foci | ~1.4 Div |
| Vaal Blacksmith's Infuser | "a Martial Weapon" | ~0.55 Div |
| Vaal Arcanist's Infuser | "a wand, staff or sceptre" | ~0.27 Div |
| Vaal Catalysing Infuser | "a ring or amulet" (patch notes say "Jewellery"; Belts — [unverified]) | ~6.5 Div |

- Always adds quality (+1%, sometimes +2%), up to 30% without other sources [community, WIKI_INF snippet].
- Corruption from an Infuser is **only the Corrupted tag**, with no random changes; the chance grows with current quality (~+5% per point above 20%; the first use at exactly 20% does not corrupt) [unverified].
- Value: +10% quality = +~10% to local defences/phys damage (armour/weapons) or +10% to catalyst-tag mods (jewellery). This is a "final" step: after corruption the item can't be crafted, but it doesn't get ruined either.

## 3. Omens and "double" corruption

| Item | Text [official] | Availability / notes |
|---|---|---|
| Omen of Corruption | "…your next Vaal Orb will always result in change" (id `OmenOnVaalRemoveDoNothingOutcome`) | **Not obtainable** since 0.5.0, on the exchange only in Standard [PN050] |
| Omen of Sanctification | "…your next Divine Orb used on a Rare item will Sanctify it" | Ritual; ~0.92 Div |
| Omen of the Blessed | "…your next Divine Orb will only reroll Implicit Modifiers" | ~0.26 Div. Can't be applied to Corrupted/Sanctified (Divine is blocked) |
| Omen of Putrefaction | "…next Desecration attempt will replace all modifiers on the item creating an item with up to 6 Unrevealed modifiers and Corrupting the item" | Corrupts the item |
| Architect's Orb | "Modifies a Corrupted Equipment or Jewel item unpredictably or destroys it" | Twice Corrupted: ~50% a second enchant (not from an already present group) / ~50% item destroyed [community, TS_DC]. ~8.75 Div. Temple of Atziri / Atziri's Vault |
| Yaomac's / Kopec's / Kamasa's / Yugul's Orb of Sacrifice | "Upgrades a Corruption Enchantment on a Rare Weapon or Quiver / Armour / Amulet, Ring or Belt / Jewel and removes a random Modifier" | 0.5.4: "These currencies upgrade Corrupted Enchantments on items, at the cost of randomly removing an Explicit Modifier" [PN054]. Rare only. Fractured mods are not removed [community]. Prices: Kopec's ~2.9 Div, Kamasa's ~3 Div, Yaomac's ~2 Ex (thin market) |
| Vaal Cultivation Orb | "Replaces up to 2 modifiers on a Corrupted Vaal Unique / Replaces other Uniques with a Corrupted Unique of the same Item Class" | For uniques, ~1.7 Div |
| Essence of Insanity | "Belt: On Corruption, Item gains two Enchantments" | Belt only; the essence mod takes the crafted slot. What happens on "no change" — [unverified] |

Examples of upgraded enchants after an Orb of Sacrifice (poe2db "Corrupted Upgrade Mods /190" [DB_SAC]): Bow Attacks fire 2 additional Arrows; Loads 2 additional bolts; (6—9)% additional Physical Damage Reduction (Body Armour); +(15—35)% to all Elemental Resistances (Ring/Amulet); (40—60)% increased Damage (Ring/Quiver); Allies in your Presence deal (50—75)% increased Damage (Sceptre); (50—75)% chance to Pierce an Enemy (Quiver).

Trade has separate filters **Corrupted**, **Sanctified**, **Twice Corrupted** [TRADE].

## 4. Sanctification (Divine Orb + Omen of Sanctification)

- **How:** activate an Omen of Sanctification, apply a Divine Orb to a **Rare** item. The omen is consumed [official].
- **Effect [official, PN050]:** "Sanctifying an item now multiplies each modifier value based on the current value, instead of randomising values." The item gets the **Sanctified** tag and can no longer be modified (like Corrupted).
- **Range [community, TS_SANCT cites hotfix 0.5.1; not found in the official thread]:** ×0.78…×1.22, step 0.01 (45 values), **each mod independently**, rounded up. Because it is "of current", a maxed mod can go above the normal maximum by up to +22%.
- **Distribution per mod [community]:** ~49% worse, ~2% unchanged, ~49% better, ~38% above the normal maximum (if the mod was at max). On an item with 5–6 mods it is almost always "some up, some down".
- **Compatibility [community]:** a Corrupted item cannot be Sanctified, a Sanctified item cannot be corrupted; Sanctify cannot be repeated. Meta runes (list in §1) cannot be inserted into a Sanctified item [official, PN054].
- **Risk:** any mod can drop by up to −22%, permanently. Bug report: the Medved's Tending rune mod dropped from 20% to 4% [FORUM_SANCT, not confirmed by GGG].
- **Order:** first Divine to max rolls (cheap and reversible), then Sanctify. Cost of an attempt ≈ 1 Divine + Omen (~0.9 Div).
- **Price of the result:** a Sanctified item with a "plus" above the maximum is a premium category; with a minus — cheaper than a regular item, because it can no longer be improved with Divines [community].

## 5. Tainted currency

PoE2 0.5 has **no** Tainted currency (Tainted Chaos / Exalted / Divine etc. are PoE1): poe2db Stackable Currency has not a single "Tainted" item [DB_CUR]. For working with Corrupted items, PoE2 has only Architect's Orb, Orbs of Sacrifice, Crystallised Corruption (gems), Vaal Cultivation Orb (uniques), Core Destabiliser (Soul Cores), Ancient Infuser (Tablets). Chaos/Exalted/Divine/Annulment **cannot be applied** to Corrupted items.

## 6. Other "gambling" steps at the finish

- **Fracturing Orb** [official]: "Fracture a random modifier on a rare item with at least 4 modifiers, locking it in place." The risk is locking a random unwanted mod (chance of the wanted one ≈ 1/number of mods). ~6.7 Div. Since 0.5.0 it drops only via an atlas specialisation [PN050].
- **Hinekora's Lock** [official]: "Allows an item to foresee the result of the next Currency item used on it / Modifying the item in any way removes the ability to foresee". According to the community it shows the outcome of both a Vaal Orb and Sanctify [community, TS_LOCK; in PoE1 there was a bug with the corruption altar]. Price ~2000 Div — only for "mirror-tier" items. The foresight is single-use: you look, don't like it — you need a new Lock.
- **Orb of Chance** [official]: "Unpredictably either upgrades a Normal item to Unique rarity or destroys it". Omen of Chance — won't destroy; Omen of the Ancients — a random unique of the same class. The chance of the wanted unique is not published.
- **Chaos/Exalted/Annulment/Divine on Corrupted** — not possible (the Corrupted tag blocks them).

## 7. Practice: when to corrupt and what happens to the price

- **Yes, worth it:** Waystones (T15→T16, cheap); spare gems (chance of +1 level / +1 support socket); cheap uniques in bulk (looking for an enchant / +socket / ×1.22); finished rares that sell cheaply anyway (the loss is small, while an MS enchant on boots or +1 socket on a body armour/two-hander is a big plus).
- **Rather not:** an almost finished expensive rare — the ~25% "reforge" ruins it, the ~25% "nothing" lowers its price (the item can no longer be finished). The expected price is usually lower than "sell as is".
- **Order:** everything reversible goes before corruption: Divine, 20% quality (+ Infuser if needed), runes (especially meta runes), Artificer's Orb. Vaal — last.
- **Price on trade [community, common practice]:** a Corrupted item without a useful enchant/socket sells cheaper than an uncorrupted equivalent (no "potential"). Corrupted with a valuable enchant — more expensive, sometimes by a multiple. Twice Corrupted with two good enchants — a separate premium market. When comparing prices on trade, the Corrupted filter must be set the same as on the item being priced.
- **Sanctify** — only on an almost perfect item where the worst case (all mods ×0.78) is still acceptable.

### Proposed "Risky final step" block for the Craft tab

> **Irreversible.** Chances are community estimates; GGG does not publish them.
> - **Vaal Orb** (~1/57 Div): ~25% nothing (item locked, the price usually drops), ~25% enchant (pool below), ~25% mods reroll (often ruins the item), ~25% +1 socket beyond the limit (none on jewellery; on wand/staff — quality).
> - On a unique item, instead of the reroll: values ×0.78–1.22 of current.
> - Before Vaal: Divine, quality, runes (meta runes can't be inserted after corruption).
> - **Sanctify** (Divine + Omen of Sanctification, ~2 Div): each mod ×0.78–1.22 of current, item locked. Only on an almost perfect item.
> - **Vaal Infuser** (quality ≥ 20%): up to +10% quality, can only lock the item (no other changes).
> - Omen of Corruption is not obtainable in the league. PoE2 has no Tainted currency.
> - Show "expected ≈ X Div" only as a rough estimate: the price of an enchant depends heavily on the line.

## 8. Corruption enchant pools by class

Source: local RePoE (`generation_type: corrupted`, for Jewels — domain `misc`), matches the poe2db "Corrupted Mods /125" list [REPOE, DB_VAAL]. All lines within a class have weight 1 (equally likely); "(only X bases)" — only on bases with that defence type (hybrid str/dex/int bases have no defence enchant). The same list is in `data/gamble-currency.json → corruptedEnchants`.

- **Body Armours:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; (3-5)% additional Physical Damage Reduction; (10-20)% of Damage taken Recouped as Life; (10-20)% of Damage taken Recouped as Mana; +1% to all Maximum Elemental Resistances; +(30-40) to maximum Life; (40-50)% increased Thorns damage; +(13-19)% to Chaos Resistance; (15-25)% increased Evasion Rating (only dex_armour bases); (15-25)% increased Energy Shield (only int_armour bases); (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases); (15-25)% increased Evasion and Energy Shield (only dex_int_armour bases)
- **Helmets:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; +(1-3)% to Maximum Cold Resistance; +(20-30) to Spirit; +1 to Maximum Power Charges; +(50-100) to Accuracy Rating; (15-25)% increased Life Regeneration rate; (20-30)% increased Mana Regeneration Rate; +1 to Level of all Minion Skills; (15-25)% increased Evasion Rating (only dex_armour bases); (15-25)% increased Energy Shield (only int_armour bases); (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases); (15-25)% increased Evasion and Energy Shield (only dex_int_armour bases)
- **Gloves:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; Damage Penetrates (10-15)% Fire Resistance; Damage Penetrates (10-15)% Cold Resistance; Damage Penetrates (10-15)% Lightning Resistance; Break (10-15)% increased Armour; (5-10)% increased Quantity of Gold Dropped by Slain Enemies; +1 to Maximum Frenzy Charges; +1 to Level of all Melee Skills; (15-25)% increased Evasion Rating (only dex_armour bases); (15-25)% increased Energy Shield (only int_armour bases); (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases); (15-25)% increased Evasion and Energy Shield (only dex_int_armour bases)
- **Boots:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; +(20-25)% to Fire Resistance; +(20-25)% to Cold Resistance; +(20-25)% to Lightning Resistance; +(1-3)% to Maximum Lightning Resistance; (3-5)% increased Movement Speed; (20-30)% increased Stun Threshold; (20-30)% increased Freeze Threshold; (20-30)% reduced Slowing Potency of Debuffs on You; (15-25)% increased Evasion Rating (only dex_armour bases); (15-25)% increased Energy Shield (only int_armour bases); (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases); (15-25)% increased Evasion and Energy Shield (only dex_int_armour bases)
- **Shields:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; (40-50)% increased Thorns damage; (10-15)% increased Block chance; +3% to maximum Block chance; (20-25) Life gained when you Block; (10-15) Mana gained when you Block; (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases)
- **Bucklers:** (15-25)% increased Evasion Rating; (10-20)% reduced Attribute Requirements; (40-50)% increased Thorns damage; (10-15)% increased Block chance; +3% to maximum Block chance; (20-25) Life gained when you Block; (10-15) Mana gained when you Block
- **Foci:** (15-25)% increased Energy Shield; (10-20)% reduced Attribute Requirements; +(20-25) to maximum Mana; (20-30)% increased Spell Damage
- **Quivers:** +(20-25) to maximum Mana; +(50-100) to Accuracy Rating; (20-30)% increased Damage; (4-6)% increased Skill Speed; (15-20)% increased Critical Damage Bonus; Gain (20-25) Life per enemy killed; Gain (10-15) Mana per enemy killed; (20-30)% chance to Pierce an Enemy; Projectiles have (10-20)% chance to Chain an additional time from terrain
- **Amulets:** Leech 3% of Physical Attack Damage as Life; Leech 2% of Physical Attack Damage as Mana; +1% to all Maximum Elemental Resistances; +(5-10)% to all Elemental Resistances; (10-15)% increased Rarity of Items found; +1 to Level of all Skills; +(10-15) to Strength; +(10-15) to Dexterity; +(10-15) to Intelligence; Life Flasks gain (0.08-0.17) charges per Second; Mana Flasks gain (0.08-0.17) charges per Second; Charms gain (0.08-0.17) charges per Second
- **Rings:** +(20-25) to maximum Mana; +(13-19)% to Chaos Resistance; (15-25)% increased Life Regeneration rate; (20-30)% increased Mana Regeneration Rate; +(5-10)% to all Elemental Resistances; (10-15)% increased Rarity of Items found; (20-30)% increased Damage; (4-6)% increased Skill Speed; (15-20)% increased Critical Damage Bonus; +(10-15) to Strength; +(10-15) to Dexterity; +(10-15) to Intelligence
- **Belts:** +(30-40) to maximum Life; (15-25)% increased Armour; (15-25)% increased Evasion Rating; (15-25)% increased maximum Energy Shield; +(20-25)% to Fire Resistance; +(20-25)% to Cold Resistance; +(20-25)% to Lightning Resistance; +(1-3)% to Maximum Fire Resistance; +1 to Maximum Endurance Charges; +(10-15) to Strength; +(10-15) to Dexterity; +(10-15) to Intelligence
- **Jewels:** +(4-6) to Strength; +(4-6) to Dexterity; +(4-6) to Intelligence; +(5-10)% to Fire Resistance; +(5-10)% to Cold Resistance; +(5-10)% to Lightning Resistance; +(3-7)% to Chaos Resistance; Immune to Maim; You cannot be Hindered; Corrupted Blood cannot be inflicted on you; Cannot be Blinded
- **Wands:** (10-20)% reduced Attribute Requirements; +1 to Level of all Fire Spell Skills; +1 to Level of all Cold Spell Skills; +1 to Level of all Lightning Spell Skills; +1 to Level of all Chaos Spell Skills; +1 to Level of all Physical Spell Skills; (20-30)% increased Spell Damage; (20-30)% increased Flammability Magnitude; (20-30)% increased Freeze Buildup; (20-30)% increased chance to Shock; (20-30)% increased Critical Hit Chance for Spells; Gain (20-25) Life per enemy killed; Gain (10-15) Mana per enemy killed; (10-15)% increased Cast Speed
- **Staves:** (10-20)% reduced Attribute Requirements; +1 to Level of all Fire Spell Skills; +1 to Level of all Cold Spell Skills; +1 to Level of all Lightning Spell Skills; +1 to Level of all Chaos Spell Skills; +1 to Level of all Physical Spell Skills; (40-60)% increased Spell Damage; (20-30)% increased Flammability Magnitude; (20-30)% increased Freeze Buildup; (20-30)% increased chance to Shock; (20-30)% increased Critical Hit Chance for Spells; Gain (20-25) Life per enemy killed; Gain (10-15) Mana per enemy killed; (10-15)% increased Cast Speed
- **Sceptres:** (10-20)% reduced Attribute Requirements; (15-25)% increased Spirit; Allies in your Presence deal (20-30)% increased Damage; Allies in your Presence have (5-10)% increased Attack Speed; Allies in your Presence have (5-10)% increased Cast Speed; Allies in your Presence have (10-15)% increased Critical Damage Bonus
- **Quarterstaves:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (13-20) to (21-31) Fire Damage; Adds (11-17) to (18-26) Cold Damage; Adds (1-3) to (41-61) Lightning Damage; Adds (10-16) to (17-25) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; Causes (20-30)% increased Stun Buildup; (10-20)% increased Melee Strike Range with this weapon; (10-15)% chance to Poison on Hit with this weapon; Grants 1 Rage on Hit; (40-50)% increased Elemental Damage with Attacks
- **Bows:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (9-14) to (15-22) Fire Damage; Adds (8-12) to (13-19) Cold Damage; Adds (1-2) to (29-43) Lightning Damage; Adds (7-11) to (12-18) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; (10-15)% chance to Maim on Hit; (5-10)% chance to Blind Enemies on hit; (20-30)% increased Elemental Damage with Attacks; Bow Attacks fire an additional Arrow
- **Crossbows:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (13-20) to (21-31) Fire Damage; Adds (11-17) to (18-26) Cold Damage; Adds (1-3) to (41-61) Lightning Damage; Adds (10-16) to (17-25) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; (10-15)% chance to Maim on Hit; (5-10)% chance to Blind Enemies on hit; (40-50)% increased Elemental Damage with Attacks; Loads an additional bolt
- **Spears:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (9-14) to (15-22) Fire Damage; Adds (8-12) to (13-19) Cold Damage; Adds (1-2) to (29-43) Lightning Damage; Adds (7-11) to (12-18) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; Causes (20-30)% increased Stun Buildup; (10-20)% increased Melee Strike Range with this weapon; (10-15)% chance to Poison on Hit with this weapon; Grants 1 Rage on Hit; (20-30)% increased Elemental Damage with Attacks
- **One Hand Maces:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (9-14) to (15-22) Fire Damage; Adds (8-12) to (13-19) Cold Damage; Adds (1-2) to (29-43) Lightning Damage; Adds (7-11) to (12-18) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; Causes (20-30)% increased Stun Buildup; (10-20)% increased Melee Strike Range with this weapon; (10-15)% chance to cause Bleeding on Hit; Grants 1 Rage on Hit; (20-30)% increased Elemental Damage with Attacks
- **Two Hand Maces:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (13-20) to (21-31) Fire Damage; Adds (11-17) to (18-26) Cold Damage; Adds (1-3) to (41-61) Lightning Damage; Adds (10-16) to (17-25) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; Causes (20-30)% increased Stun Buildup; (10-20)% increased Melee Strike Range with this weapon; (10-15)% chance to cause Bleeding on Hit; Grants 1 Rage on Hit; (40-50)% increased Elemental Damage with Attacks
- **Talismans:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (13-20) to (21-31) Fire Damage; Adds (11-17) to (18-26) Cold Damage; Adds (1-3) to (41-61) Lightning Damage; Adds (10-16) to (17-25) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; (40-50)% increased Elemental Damage with Attacks

## 9. Sources

- [PN050] Official 0.5.0 patch notes — https://www.pathofexile.com/forum/view-thread/3932540
- [PN054] Official 0.5.4 patch notes — https://www.pathofexile.com/forum/view-thread/3975218
- [PN055] Official 0.5.5 patch notes — https://www.pathofexile.com/forum/view-thread/4000864
- [DB_VAAL] poe2db Vaal Orb (Corrupted Mods /125) — https://poe2db.tw/us/Vaal_Orb
- [DB_OMEN] poe2db Omen — https://poe2db.tw/us/Omen ; /Omen_of_Corruption ; /Omen_of_Sanctification ; /Omen_of_the_Blessed
- [DB_CUR] poe2db Stackable Currency — https://poe2db.tw/us/Stackable_Currency (Infusers, Architect's Orb, Orbs of Sacrifice, Crystallised Corruption, Vaal Cultivation Orb)
- [DB_SAC] poe2db Kopec's Orb of Sacrifice (Corrupted Upgrade Mods /190) — https://poe2db.tw/us/Kopecs_Orb_of_Sacrifice
- [DB_MISC] poe2db Hinekora's Lock / Fracturing Orb / Orb of Chance / Essence of Insanity / Architect's Orb — https://poe2db.tw/us/<Name>
- [REPOE] Local RePoE cache %APPDATA%/PoE 2 Price Checker/cache/repoe-mods.json + repoe-base-items.json (domain item|misc, generation_type corrupted)
- [TS_VAAL] Timesaver.gg Vaal Orb Guide (0.5), 22.07.2026 (commercial) — https://timesaver.gg/blog/poe2-vaal-orb-guide
- [TS_SANCT] Timesaver.gg Sanctify guide, 22.06/09.08.2026 (commercial) — https://timesaver.gg/blog/poe2-sanctified-omen-of-sanctification-guide
- [TS_DC] Timesaver.gg Double Corruption guide, 22.07/22.08.2026 (commercial) — https://timesaver.gg/blog/poe2-double-corruption-guide
- [TS_LOCK] Timesaver.gg Hinekora's Lock guide (0.5.4) — https://timesaver.gg/blog/poe2-hinekoras-lock-guide
- [U4N] U4N unique/jewel Vaal outcome articles (commercial, no patch stated) — https://www.u4n.com/news/poe-2-vaal-orb-unique-items-outcome-chances-explained.html ; https://www.u4n.com/news/poe-2-vaal-orb-jewel-corruption-outcomes-unique-nonunique-jewel-effects-explained.html
- [MAXROLL] Maxroll Corruption Outcomes (only search snippet; site not reachable) — https://maxroll.gg/poe2/resources/corruption-outcomes
- [WIKI_INF] poe2wiki Vaal Infuser (only search snippet; Anubis-blocked) — https://www.poe2wiki.net/wiki/Vaal_Infuser
- [FORUM_SANCT] Forum bug report 'Medved's Tending sanctify range bug', 10.07.2026 — https://www.pathofexile.com/forum/view-thread/3983437
- [TRADE] trade2 filters snapshot (misc filters: Corrupted, Sanctified, Twice Corrupted)
- [PRICES] poe2db 'US Realm Economy' 24h snapshot on item pages, fetched 2026-10-17 (league not stated) (prices in this document come from this snapshot; approximate)
- Additional (search snippets only): Game8 0.5.0 / 0.5.4 summary — https://game8.co/games/Path-of-Exile-2/archives/601782 , https://game8.co/games/Path-of-Exile-2/archives/606723 ; BugFree 0.5.0 crafting — https://bugfree.gg/guides/poe2-crafting-changes-0-5-0 ; Switchblade Gaming — https://www.switchbladegaming.com/path-of-exile-2/vaal-orb-outcomes/ ; Gamerant (Apr 2025, outdated) — https://gamerant.com/path-of-exile-2-all-vaal-orb-outcomes-corruption-poe2/
