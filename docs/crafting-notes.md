# PoE 2 — crafting notes (for the Craft tab)

- **Current for:** patch **0.5.5** (latest subpatch — **0.5.5e**, Oct 6, 2026), league **Forbidden Rites** (event league, launched Sep 4, 2026) + Standard. The crafting core has not changed since **0.5.0** ("Return of the Ancients", league **Runes of Aldur**, launched May 29, 2026). The next big patch is **1.0, Dec 11, 2026** (per third-party sources, unverified against an official announcement).
- **Compiled:** 2026-10-17.
- Notation: [S#] — a reference to a source in section 7. "(unverified)" — the fact is not confirmed by any source found, or is confirmed only by a dubious one.
- Note: maxroll.gg would not load (connection dropped), poe2wiki.net and mobalytics block downloads — the basis is official patch notes + poe2db.
- **Corrections and techniques are in `docs/crafting-tricks.md` (§0 "Corrections")**: a desecrate reveal offers 3 options, and without a lich omen these include regular mods too; "no desecrated prefixes on armour" holds only for lich exclusives (Rib + Sinistral Necromancy gives regular prefixes); Greater/Perfect/Ancient cut off low tiers, but a family with no tiers above the threshold rolls at its best tier; Whittling treats an unrevealed desecrated mod as level 1; Putrefaction bypasses the one-desecrated limit.

## 1. What changed in the last 2 patches (crafting only)

**0.5.0 (Runes of Aldur, patch notes ~May 21–26, 2026) [S1][S2]:**
- **One crafted mod per item.** "All crafted modifiers are now guaranteed, but items can only have 1 crafted modifier at a time." Essence mods (including Perfect and corrupted ones, incl. Mark of the Abyssal Lord) and Alloys are crafted mods: a second essence/Alloy on the same item gives the error "This item already has a crafted modifier" [S1][S9][S10][S11]. "Essence → Perfect essence" chains no longer work.
- **One desecrated mod per item**, and it NO LONGER counts as crafted → an item can have 1 crafted + 1 desecrated [S1].
- Desecrated mods with Instant Leech no longer roll [S2].
- Greater Orb of Transmutation / Augmentation: min. mod level **44** (was 55); Transmutation/Augmentation became noticeably rarer; Greater/Perfect currency "somewhat rarer"; Divine Orb — more common [S2].
- **Fracturing Orb** now drops only when specialising via atlas passives (Exceptional Items, Fracturing Orbs) [S2].
- **Recombinator disabled**, Omen of Recombination removed (deleted on login) [S2][S6]. 0.5.5 says nothing about it returning — treat it as disabled (unverified).
- **Omen of Corruption is no longer obtainable**; Omen of Corruption, Omen of Homogenising Coronation, Omen of Homogenising Exaltation — on the Currency Exchange only in Standard [S1].
- Omen of Chaotic Rarity/Quantity/Monsters (for Waystones) now FORBID their mod type; new Omen of Chaotic Effectiveness [S2].
- Abyss omens don't drop in zones below level 65 [S2].
- Perfect Essence of Battle: +3 (was +5) for 2H/Crossbow, +2 (was +3) for 1H/Bow; Essence of Hysteria on Focus: 20–23% ES Recharge Rate (was 41–45%) [S2]. Melee/Projectile +levels on weapons were lowered (2H +7→+5, 1H +5→+4), spell levels were not touched (unverified, [S6]).
- Catalysts no longer drop from monsters — only the Genesis Tree (Breach); 12/13 **Refined** catalysts for jewels were added [S2][S4].
- 13 **Alloys** (Verisium): "add various new crafted modifiers to items by replacing an existing modifier" — analogous to a Perfect essence, they take the crafted slot [S1][S4].
- **Liquid Emotions** (Delirium) craft extra mods onto jewels like a Greater Essence (unverified, [S6]).
- Vaal Orb: the "reroll values beyond the range" outcome now **multiplies** each mod from its current value; the same for Sanctification (Omen of Sanctification) [S2].
- Vaal Infusers split into 4 types (Armourer's / Blacksmith's / Arcanist's / Catalysing), work only on items with quality ≥ 20% [S2].
- Jeweller's Orbs can be used on items with skills (to add sockets) [S1].
- Cast Speed on rings — from lvl 60, on amulets — from lvl 66; Leech mods on gloves/rings were re-tiered by level, "of the Parasite"/"of the Thirsty" removed [S1][S2].
- New runes: 13 Ancient, 13 Mythical, 3 Flux, 15 meta-crafting runes (e.g. Astrid's Creativity — "+1 Crafted Modifier allowed", Serle's Triumph — "+1 Suffix Modifier allowed") [S2][S14].

**0.5.5 (Forbidden Rites, Sep 3–4, 2026) and subpatches b–e [S3][S5][S7]:**
- No changes to the mechanics of crafting currency/omens/essences. 0.5.5b–e — bug fixes only.
- Doryani's Refined Formula removed; new atlas option **Archaic Corruption** — essence monsters become Corrupted (more corrupted essences) [S3][S8].
- Trial of Chaos: rewards are now only currency and Soul Cores (no more corrupted items) [S3].
- Expedition/Fallow/Verisium Anvil — in the core game (Standard and Forbidden Rites); the Verisium Anvil is unlocked by the Act 4 quest "The Runeseeker" [S3].
- 17 new Soul Cores, a number reworked, 8 restricted to "Limit 1" [S3].
- League mechanic: Ritual in every campaign zone — gives currency for crafting while levelling; doesn't affect endgame item crafting [S3][S8].

## 2. Basic rules

### 2.1 Mod slots
- Rare: up to **3 prefix + 3 suffix**; Magic: **1 prefix + 1 suffix** [S12].
- Jewels, rare: **2 + 2** (unverified, follows from game data, no source found).
- Modifiers: "+1 Suffix Modifier allowed" (the Serle's Triumph rune, etc.) [S14]; "+1 Crafted Modifier allowed" — Astrid's Creativity [S14].
- Limits on top of slots: **1 crafted** (essence / Alloy / other "guaranteed" mods) and **1 desecrated** [S1].
- Desecrated prefixes on Body Armour/Gloves/Boots/Helmets — per poe2db "none" (unverified, the page contains a contradiction) [S13].

### 2.2 Mod level and ilvl
- A mod can roll only if its level is ≤ the item's ilvl. Greater/Perfect currency additionally cuts off mods below a threshold [S4].
- Thresholds (poe2db) [S4]:

| Currency | Greater | Perfect |
|---|---|---|
| Orb of Transmutation | 44 | 70 |
| Orb of Augmentation | 44 | 70 |
| Regal Orb | 35 | 50 |
| Exalted Orb | 35 | 50 |
| Chaos Orb | 35 | 50 (the added mod) |

- Per [S12], the threshold "never removes a modifier family entirely" — a family with no tier above the threshold apparently can still roll at its best available tier (unverified).
- Perfect currency on a base with ilvl < threshold is useless/forbidden (unverified) — the minimum for a Perfect Exalt is ilvl ≥ 50, better ≥ 75–82 for T1.
- Higher isn't always better: boots have useful thresholds at 71 and 82, while 72–75 add "junk" tiers — an ilvl 71 base gives the best chances for MS + resistances (see `market-notes.md` §2, **M**).

### 2.3 Core currency [S4]
- **Orb of Transmutation** — Normal → Magic (1 mod). **Orb of Augmentation** — +1 mod on Magic.
- **Regal Orb** — Magic → Rare (+1 mod). Omen of Sinistral/Dextral Coronation — prefix/suffix only.
- **Orb of Alchemy** — Normal/Magic → Rare with 4 mods. Omen of Sinistral/Dextral Alchemy — maximum prefixes/suffixes [S15].
- **Exalted Orb** — +1 random mod on a Rare.
- **Chaos Orb** — remove 1 random mod and add 1 random (not a full reroll) [S4].
- **Orb of Annulment** — remove 1 random mod.
- **Divine Orb** — rerolls mod numbers (within the tier). Omen of the Blessed — implicit only; Omen of Sanctification — Sanctify a rare item (value multiplier, after which the item can hardly be crafted; ~78–122% — unverified, [S12]).
- **Fracturing Orb** — locks a random mod on a Rare with **≥ 4 mods**; a fractured mod isn't changed by Chaos/Annul/Divine (per [S12], unverified for Divine). Fracture can also land on a crafted mod [S10].
- **Hinekora's Lock** — "Allows an item to foresee the result of the next Currency item used on it. Modifying the item in any way removes the ability to foresee." Stack 10 [S16]. The preview doesn't consume currency; works with Vaal/Divine/Chaos/Exalted (unverified, [S17]). Expensive (hundreds of Divines per [S17] — unverified).
- **Orb of Chance** — Normal → a random Unique or destruction. Omen of Chance — doesn't destroy; Omen of the Ancients — guarantees an upgrade to a unique of the same class [S15]. In 0.5 Chance can be applied to Tablets [S2].
- **Artificer's Orb** — +1 Augment socket on a martial weapon, wand, staff or armour [S4]. Socket limits per slot — (unverified). Vaal can add a socket beyond the limit (unverified, [S18]).
- **Jeweller's Orbs** — Lesser/Greater/Perfect: 3/4/5 support sockets on a gem; in 0.5 they also work on item skills [S1][S4].
- **Vaal Orb** — unpredictable change + Corrupted. Outcomes (unverified, ~25% each [S18]): no change; corruption enchant/implicit; mod "reforge"; +socket (on wand/staff — quality up to 23% instead?). The value-randomisation outcome in 0.5 multiplies from the current value [S2]. Omen of Corruption ("always changes") — not obtainable in the league [S1][S15]. Second corruption — Architect's Orb, 50/50 "second enchant / destruction" (unverified, [S18]).

### 2.4 Quality and catalysts [S4][S2]
- Blacksmith's Whetstone — martial weapons; Arcanist's Etcher — wands, staves, sceptres; Armourer's Scrap — armour; up to 20%.
- Vaal Infusers (Armourer's/Blacksmith's/Arcanist's/Catalysing) — up to +10% beyond the maximum, chance of corruption, only at quality ≥ 20%.
- Catalysts (rings, amulets): Flesh (life), Neural (mana), Carapace (armour/evasion/ES), Uul-Netol's (physical), Xoph's (fire), Tul's (cold), Esh's (lightning), Chayula's (chaos), Reaver (attack), Sibilant (caster), Skittering (speed), Adaptive (attributes), Necrotic (minion). A new quality type replaces the old one.
- **Refined** catalysts (the same 13 types) — for jewels [S4].
- Essence of the Breach — +20% to maximum jewellery quality [S13b].
- **Omen of Catalysing Exaltation** — the next Exalted Orb "consumes all Catalyst Quality" and increases the chance of a mod of the matching type [S15].
- Catalysts now come only from the Genesis Tree [S2].

### 2.5 Desecration (Abyss) [S4][S13]
- Bones: **Jawbone** — weapons/quivers; **Rib** — armour; **Collarbone** — amulets/rings/belts; **Cranium** — jewels (Preserved only); **Vertebrae** — waystones (Preserved). **Gnawed** — item ilvl ≤ 64; **Preserved** — any; **Ancient** — mods of level ≥ 40. **Altered Collarbone** — jewellery, chance of "otherworldly" mods.
- Applied to a Rare: adds an Unrevealed desecrated mod; **if the item is full — also removes a random mod** [S13]. Revealing — at the Well of Souls, a choice among options (3 — per [S12], unverified). An item with a desecrated mod can't be desecrated again [S13].
- Omens: Abyssal Echoes — one reroll of the options; Sinistral/Dextral Necromancy — prefix/suffix only; the Sovereign (Ulaman) / the Liege (Amanamu) / the Blackblooded (Kurgal) — a guaranteed mod from the lich's pool, **only on Weapon or Jewellery**; Putrefaction — replaces all mods with up to 6 Unrevealed and corrupts (how it works with the 1-desecrated limit — unverified); **Omen of Light** — Annulment removes only desecrated mods [S13][S15].
- **Essence of the Abyss** gives Mark of the Abyssal Lord (crafted slot!); desecrating such an item always removes the Mark and adds an Unrevealed desecrated mod **of a higher tier** [S13].
  **The Mark is a desecrated mod:** Omen of Light + Annulment removes it right away, without a Desecrate (player, 2026-10-19, 0.5.5, H). Hence a cheap way to remove a mod from the wanted side: Essence of the Abyss + Omen of Sinistral/Dextral Crystallisation → Omen of Light + Annulment. In `plancost.js` `removeCost` this is a removal option on par with Annulment with a side omen.

### 2.6 Essences [S13b]
- Lesser / regular / Greater: Magic → Rare + a guaranteed mod (tier fixed by the essence and the item class).
- Perfect and corrupted essences: on a Rare — remove a random mod and add their own. Omen of Sinistral/Dextral Crystallisation — only a prefix/suffix is removed.
- All essence mods are crafted → **one essence per item** [S1][S10].
- Corrupted essences (obtained by corrupting an essence monster with a Vaal Orb, Archaic Corruption on the atlas): **Hysteria** — Helmet +1 to level of Minion skills; Body 64–97 to 98–145 Physical Thorns; Gloves 25–29% Crit Damage Bonus; Boots 30% Movement Speed; Ring 50–59% Mana Regen; Amulet 19–21% damage taken recouped as Life; Belt +254–304 Stun Threshold; Shield 20–24% Block; Quiver 43–50% Bow damage; Focus 20–23% ES Recharge. **Delirium** — Body: allocates a random Notable. **Horror** — Gloves/Boots: 60% increased effect of Socketed Augments. **Insanity** — Belt: 2 enchants on corruption. **Abyss** — Mark of the Abyssal Lord. **Breach** — jewellery +20% max Quality.
- Perfect essences (values checked against poe2db, they match `essences.js`): Body (Body Armour, 8–10% max Life), Mind (Ring, 4–6% max Mana), Enhancement (Amulet, 20–30% global def), Ruin (Body, 10–15% phys as chaos), Infinite (Amulet, 7–10% attrs), Opulence (Gloves, gold), Insulation/Thawing/Grounding (Belt/Helmet/Gloves recoup), Battle (+2 1H/Bow, +3 2H/Crossbow), Haste (martial, Onslaught), Seeking (Body, -crit dmg taken), Sorcery (Wand +3 / Staff +5 spell levels), Alacrity (Focus/Wand 18–20%, Staff 28–32% Mana Cost Efficiency), Command (Sceptre, 15–20% aura magnitudes), Abrasion/Flames/Ice/Electricity (1H/Bow 15–20%, 2H/Crossbow 25–33% gain as extra).

### 2.7 Alloys (Verisium, 0.5) [S4][S1]
- 13 of them, unlocked via Remnant encounters after the Farrow quest in Act 2. Most: "removes a random modifier and augments" with a guaranteed crafted mod (depends on the class). They take the crafted slot → incompatible with an essence.
- Runic (Runic Ward on jewellery), Adaptive, Protective (Runic Ward/recovery on weapons/shields), Expansive (Presence, mana efficiency, minion limit…), Swift (cast/attack speed…), Cyclonic (durations), Prismatic (penetration, ailment magnitude, exposure), Mystic (AoE, Spirit, chaining), Sovereign (augment effect, resists), Celestial (mana, **spell level**, accuracy, attack speed), Transcendent (cast speed, cold dmg, attributes, phys), Runebinder's, Runefather's. Exact values per slot — not found (unverified).
- Verisium Runeforging (Verisium Anvil) — Runic Ward on armour; below lvl 55 with no downsides, above — at the cost of part of the base defences [S1][S2].

### 2.8 Recombinators
- Disabled since 0.5.0; Omen of Recombination removed [S2]. In 0.5.5 Expedition became "core", but nothing is said about the Recombinator returning (unverified). Do not recommend.

### 2.9 Forbidden Rites
- No new crafting mechanic; Ritual in the campaign gives crafting currency while levelling [S3][S8]. Royal Lenience — Defer for an already paid Tribute (+500% of the deferred item's price) [S5].

## 3. Crafting omens [S15][S13]

| Omen | Currency | Effect |
|---|---|---|
| Sinistral / Dextral Exaltation | Exalted | prefix only / suffix only |
| Greater Exaltation | Exalted | adds **two** mods |
| Homogenising Exaltation | Exalted | a mod of the same type (tag) as one already present; Standard only (Currency Exchange) |
| Catalysing Exaltation | Exalted | consumes all Catalyst Quality, increases the chance of a mod of that type |
| Sinistral / Dextral Coronation | Regal | prefix / suffix only |
| Homogenising Coronation | Regal | a mod of the same type; Standard only |
| Sinistral / Dextral Alchemy | Alchemy | maximum prefixes / suffixes |
| Whittling | Chaos | removes the mod with the **lowest mod level** (not tier) |
| Sinistral / Dextral Erasure | Chaos | removes only a prefix / suffix |
| Greater Annulment | Annulment | removes **two** mods |
| Sinistral / Dextral Annulment | Annulment | removes only a prefix / suffix |
| Light | Annulment | removes only the desecrated mod |
| Sinistral / Dextral Crystallisation | Perfect / Corrupted Essence | removes only a prefix / suffix |
| the Blessed | Divine | rerolls implicit only |
| Sanctification | Divine | Sanctify a rare item (value multiplier, the item is "frozen") |
| Corruption | Vaal | always causes a change; not obtainable in the league |
| Chance | Orb of Chance | doesn't destroy the item |
| the Ancients | Orb of Chance | a random unique of the same class |
| Abyssal Echoes | Desecration reveal | one reroll of the options |
| Sinistral / Dextral Necromancy | Desecration | prefix / suffix only |
| the Sovereign / the Liege / the Blackblooded | Desecration (Weapon/Jewellery) | guaranteed Ulaman / Amanamu / Kurgal mod |
| Putrefaction | Desecration | all mods → up to 6 Unrevealed, Corrupted |
| Chaotic Rarity / Quantity / Monsters / Effectiveness | Chaos on Waystone | forbid a mod of their type (0.5) |
| Recombination | — | removed in 0.5 |

Combining: up to three omens can be active at once (stated for Waystone omens in 0.5 [S2]; for regular crafting — unverified, but the "Greater Exaltation + Sinistral Exaltation" combo is described in guides [S19]).

## 4. Recipes

**General principle (all sources):** cheap and reversible first, irreversible (Vaal, Sanctify) last; one essence and one desecration — plan in advance what will take the crafted slot [S12][S19].

### R1. Magic base → essence → finishing (basic, cheap–medium)
1. A base with high ilvl (≥ 75–82 for T1; check the ilvl, not the level requirement [S19]). Magic with 1–2 wanted mods (Transmute/Augment; Greater 44+, Perfect 70+).
2. Greater Essence of the wanted mod → Rare with a guaranteed mod (crafted slot taken).
3. Desecrate (bone for the slot, Necromancy omen on the wanted side) **before** the Exalts, while there is room — otherwise a random mod gets removed [S13][S19].
4. Exalted (+ Sinistral/Dextral Exaltation) into the remaining slots; on expensive bases — Greater/Perfect Exalted.
5. Divine — when the mod set is final. Quality, sockets, runes.
- Risk: medium (Exalts are random). When: armour/jewellery for "life + resists", weapons for a specific damage type.

### R2. Perfect Exalt + omens (expensive)
- Perfect Exalted (mods 50+) + Sinistral/Dextral Exaltation; for 2 free slots on one side — + Greater Exaltation (two mods). Example from guides: wand/staff — Perfect Exalt + Greater Exaltation for two strong prefixes [S19]; amulets — side omen + Catalysing Exaltation [S19].
- Before an expensive step — Hinekora's Lock, if the Lock's price is lower than the risk.

### R3. Remove one bad mod
- The bad mod is the lowest-level one → **Chaos + Whittling** (removes it and immediately adds a new one; Greater/Perfect Chaos — the new mod is 35+/50+).
- The bad mod is alone on its side (or the rest on the side are fractured) → **Annulment + Sinistral/Dextral Annulment** = 100% hit.
- Several on the side → Annulment + side omen (1/N) or Chaos + Erasure (replaces it with a random one).
- The bad mod is desecrated → **Annulment + Omen of Light** (guaranteed to hit it), then desecrate again.
- The bad mod is an essence (crafted) → it can only be removed by Annul/Chaos at random; frees the crafted slot (unverified).

### R4. Desecration targeting
- Weapon/Jewellery: lich omen (Sovereign/Liege/Blackblooded) + Necromancy omen for the side; Ancient bone (mods 40+); Abyssal Echoes — only on almost perfect items [S19].
- **Essence of the Abyss → desecrate**: the Mark is guaranteed to be replaced with a higher-tier desecrated mod [S13]; but Essence of the Abyss is Perfect-like (removes a random mod) and takes the crafted slot, which means no other essence can be applied before the desecrate.
- Don't forget: on a full item desecrate removes a random mod.

### R5. Fracture-then-craft
- A Rare with ≥ 4 mods, one of which is key (e.g. +levels on a staff) → Fracturing Orb (risk: the wrong one gets locked). Better on an item with 4 mods where we don't care about the 3 "junk" ones, or where all are good.
- After the fracture — aggressively Annul/Chaos the rest; the side with the fractured mod becomes easier for side omens.
- Fracturing Orb is scarce in 0.5 (atlas) [S2].

### R6. Hinekora's Lock
- Before: a Vaal Orb on an expensive item, Perfect Exalt/Chaos on an almost finished one, Fracturing Orb (unverified that the Lock works with Fracturing), Divine on an item with a narrow window. If the preview is bad — don't apply the currency; but any change to the item (including with another currency) removes the foresight, so you can't "look at another option" — you need a new Lock [S16][S17].

### R7. Jewellery: catalyst + Catalysing Exaltation
- Ring/amulet with open slots → Catalyst of the wanted type up to 20% (Breach Ring/Essence of the Breach — higher) → Exalted + Omen of Catalysing Exaltation (+ side omen) → consumes quality, increases the chance of a mod with that tag. Afterwards — catalyse again for the final quality bonus (quality boosts matching mods).
- Rings are often cheaper to buy [S19].

### R8. Jewels
- 2+2 mods; Refined catalyst for quality; Preserved Cranium for desecrate; Liquid Emotions (Delirium) — extra mods "like a Greater Essence" (unverified) [S6].

### R9. Weapons
- Spell staves/wands: high-ilvl base → Magic with +spell levels (Perfect Transmute/Augment 70+) → Greater Essence (Sorcery / Alacrity / Seeking) → Exalt/Perfect Exalt on prefixes; an alternative finisher — Celestial/Transcendent Alloy (spell level/cast speed), if the crafted slot is free [S20, low reliability]. Perfect Essence of Sorcery (+3 wand / +5 staff) — only if the crafted slot is free.
- Phys/Attack: high ilvl, Greater Essence of Abrasion/Haste/Battle; desecrate prefix (Jawbone + Sinistral Necromancy + lich omen); Perfect Essence of Battle (+2/+3 to attacks) or Abrasion (gain as extra) as an alternative to another essence — pick one.

### R10. Armour (ES / life)
- Greater Essence of Enhancement (68–79%) or Body; desecrate (Rib), Necromancy on the wanted side; Exalt finishing only if the item is already good; Verisium Runeforging — compare defences before/after [S19].
- Boots — craft only if Movement Speed is already there (or Essence of Hysteria on boots — 30% MS, crafted slot) [S19][S13b].

### R11. The "deterministic" approach of top crafters (summary)
- Reduce randomness: side omens on every Exalt/Annul/Chaos; Whittling on the lowest-level mod; Omen of Light for desecrated; Crystallisation for Perfect essences; Fracture the key mod; Hinekora's Lock before expensive steps; Greater/Perfect currency to cut off low tiers. Decide in advance what will occupy the crafted slot and the desecrated slot [S12][S1].

## 5. Practical tips and common mistakes
- Check the base's ilvl (not the level requirement); at low ilvl Perfect currency and T1 are unavailable [S19][S4].
- Divine — only when the mod set is final [S19].
- Exalted onto a side that is already full — wasted currency (the Exalt will pick the other side or won't work; unverified).
- Desecrate before the Exalts (while there is room) [S19].
- Don't plan two essences / essence + Alloy — it's one crafted slot [S1][S10].
- Old guides (pre-0.5) with essence stacking and the Recombinator are outdated [S11].
- Vaal — only on finished items you don't mind losing [S18].
- Prices: the Exalted→Divine rate in 0.5 jumped around ~90–300+ (unverified, [S11]); current ones — poe.ninja.

## 6. Conclusions for the Craft tab (checked against `src/main/craft.js`, `src/main/essences.js`)

> **Status (checked against the code in v0.3.113, 2026-10-18):** items 1–5, 7–9, 11, 13, 16, 17 are done — the crafted slot and its
> limit (`craftedCap`, the Astrid's Creativity rune), corrupted essences and Alloys (`data/crafting-currency.json`), Desecrate
> omens (Necromancy, lich omens, Abyssal Echoes), Hinekora's Lock and Fracturing Orb — in the risky steps section,
> Greater / Perfect Transmutation, Omen of Greater Exaltation in the plan, Artificer's Orb sockets, Liquid Emotions,
> the tip about Omen of Catalysing Exaltation (consumes all quality).
> Open: 6 (Altered bones — only a mention), 10 (whether Whittling removes a desecrated mod — verify in game),
> 12 ("guaranteed" highlighting).
> Below is the original list (as compiled for 0.5.5).

**Mismatches / outdated:**
1. **The "1 crafted mod" limit isn't accounted for.** `advise()` offers an essence for magic→rare and at the same time the `perfect` section (Perfect essences) for rare, without checking whether there is already a crafted/essence mod. If the item has an essence/Alloy mod (tag `crafted` in Advanced Mod Descriptions, Mark of the Abyssal Lord too), Perfect essences, corrupted essences and Alloys are inapplicable (error "This item already has a crafted modifier"). Needed: hide/flag the `perfect` section when a crafted mod is present; in `planGoal` for magic, don't promise "essence + Perfect later".
2. **Perfect essence = crafted slot.** The `perfect` section should warn: "will take the only crafted slot; after it, essences/Alloys can no longer be applied".
3. **No corrupted essences** (Hysteria, Delirium, Horror, Insanity, Abyss, Breach) in `essences.js` — Hysteria on boots (30% MS), gloves (Crit Damage), helmet (+1 minion), etc. are valuable; Essence of the Abyss → desecrate gives a higher-tier desecrated mod.
4. **No Alloys** — an alternative to Perfect essences (also replace + crafted slot). Add at least a mention for weapons/jewellery (value data needs to be collected from poe2db).
5. **The Desecration section** doesn't mention omens: Sinistral/Dextral Necromancy (side), Sovereign/Liege/Blackblooded (lich pool, Weapon/Jewellery only), Abyssal Echoes. It also isn't stated that on a full item a random mod will be removed — currently there is "replaces a random one when full", OK; but it's worth advising to desecrate **before** the Exalts, while there is room.
6. `boneFor()` — correct (Gnawed ≤ 64, Preserved, Ancient 40+, Cranium Preserved only). Altered Collarbone could be added for jewellery.
7. **Hinekora's Lock** is advised only in the magic→rare section (where it makes almost no sense price-wise). Better: advise it before expensive steps — Perfect Exalt/Chaos, Fracturing Orb, Vaal on an almost finished item, Perfect essence; and only if the expected item price ≫ the Lock's price.
8. **Fracturing Orb** (`cheap`) is labelled "cheap and risk-free" — in 0.5 it is scarce (atlas) and risky (random mod). Move it from `cheap` to a separate risk section; advise it only if the key mod is ≥ ~50% of the item's mods or if most mods are good.
9. **Magic base:** Greater/Perfect Transmutation/Augmentation (44+/70+) aren't suggested — useful for preparing a magic base before an essence. Orb of Alchemy + Sinistral/Dextral Alchemy are also missing.
10. **Whittling** (`lowest`): takes the min. `required_level` among all non-fractured mods, including desecrated and crafted — whether Whittling removes a desecrated/crafted mod is unverified; safer to exclude desecrated (it has its own path via Omen of Light).
11. **Catalyst tip** for rings/amulets: worth clarifying that Catalysing Exaltation **consumes all quality** — catalyse again after it; and that catalysts now come only from the Genesis Tree (more expensive).
12. **Annulment + side omen:** if the side has only one non-fractured mod — 100% chance (currently `sameSide` already counts only non-fractured — good; could explicitly highlight "guaranteed").
13. **Omen of Greater Exaltation** is offered when `open[side] >= 2` — OK; could add the combination with Perfect Exalted for expensive bases.
14. **Recombinator / Omen of Corruption / Homogenising omens** are not recommended in the app — correct (they aren't in the league / aren't obtainable). Don't add them.
15. Essence values in `essences.js` were checked against poe2db (Body, Mind, Enhancement, Insulation, Command, Infinite, Battle, Sorcery, Alacrity, Haste — they match, including the Perfect Battle +2/+3 nerf). Command: Perfect — "Aura Skills have (15–20)% increased Magnitudes" — matches.
16. `Artificer's Orb` excludes Sceptre — per poe2db the list is "martial weapon, wand, staff or armour" — matches. Socket limits weren't checked (`!item.sockets` — advises only at 0 sockets; 2H/Body can have 2 — unverified).
17. Jewels: Liquid Emotions (Delirium) could be added as a way to add a mod (unverified).

**What the app should additionally check/advise:**
- ilvl < 50 → warning: Perfect Exalted/Regal/Chaos are pointless; ilvl < 70 → Perfect Transmute/Augment; ilvl below the T1 level of the wanted mod → "T1 impossible on this base" (partly already there via `bestIdx`).
- Warn if the item is Sanctified/Corrupted (already there) and if there is a crafted mod (not there).
- If a desecrated mod is already present — don't offer a second desecration (already there), but offer Omen of Light for a weak desecrated mod (there).
- For a fractured item: highlight that the side with the fractured mod makes side omens easier (Annul 1/(N-1)).
- Step order in `planGoal`: essence → desecrate (if there is room) → Exalts → Divine → quality/sockets → (Vaal).

## 7. Sources
- [S1] Official 0.5.0 patch notes (Return of the Ancients / Runes of Aldur), PoE forum, ~21–26.05.2026 — https://www.pathofexile.com/forum/view-thread/3932540
- [S2] The same thread, item/currency changes section (both parts) — https://www.pathofexile.com/forum/view-thread/3932540
- [S3] Official 0.5.5 patch notes (Forbidden Rites), 03.09.2026 — https://www.pathofexile.com/forum/view-thread/4000864
- [S4] poe2db Stackable Currency (0.5 data) — https://poe2db.tw/us/Stackable_Currency
- [S5] 0.5.5 summary (note.com, koni_pu3), 03.09.2026 — https://note.com/koni_pu3/n/n5ab3664d0265?hl=en
- [S6] BugFree.gg, "0.5.0 Crafting Changes", 23.05.2026 — https://bugfree.gg/guides/poe2-crafting-changes-0-5-0
- [S7] Patch notes 0.5.5b (11.09), 0.5.5c (18.09), 0.5.5d (~28.09), 0.5.5e (06.10.2026) — https://www.pathofexile.com/forum/view-thread/4004106 · /4006357 · /4008534 · /4009785 ; list: https://www.pathofexile.com/forum/view-forum/2212
- [S8] Kami-labs, 0.5.5 patch notes summary, Sep 2026 — https://kami-labs.fr/en/path-of-exile-2/patch-notes-0-5-5-path-of-exile-2-forbidden-rites/
- [S9] Forum, feedback "Please Revert The Essence Crafting Change", 25.05.2026 — https://www.pathofexile.com/forum/view-thread/3933180
- [S10] Forum, bug report "Non-crafted weapon has a crafted mod error", 09.06.2026 — https://www.pathofexile.com/forum/view-thread/3956910 ; "Essence of Abyss: this item already has a crafted modifier", 12.06.2026 — https://www.pathofexile.com/forum/view-thread/3960848
- [S11] Timesaver.gg, "PoE2 0.5 Crafting Guide", 05.06 / upd. 06.08.2026 (commercial, contains errors) — https://timesaver.gg/blog/poe2-0-5-crafting-guide
- [S12] PoE2 Crafting Codex (domistae, checked against 0.5.0, header says 0.5.5) — https://domistae.github.io/poe2-leveling/poe2_crafting_codex.html
- [S13] poe2db Desecrated Modifiers (0.5) — https://poe2db.tw/us/Desecrated_Modifiers
- [S13b] poe2db Essence (0.5) — https://poe2db.tw/us/Essence
- [S14] PoE2Craft codex, Runes ("0.5.4, June 2026") — https://poe2craft.com/codex/runes
- [S15] poe2db Omen (0.5) — https://poe2db.tw/us/Omen
- [S16] poe2db Hinekora's Lock — https://poe2db.tw/us/Hinekoras_Lock
- [S17] Timesaver.gg, Hinekora's Lock guide, 01.07 / upd. 06.09.2026 (commercial) — https://timesaver.gg/blog/poe2-hinekoras-lock-guide
- [S18] Timesaver.gg, Double Corruption guide, 22.07 / upd. 22.08.2026 (commercial, internal contradictions) — https://timesaver.gg/blog/poe2-double-corruption-guide
- [S19] Elyxir.gg, "Crafting Guide under the New Essence Rules", 09.06.2026 (commercial) + a summary of Mobalytics 0.5 guides from search (pages 403) — https://www.elyxir.gg/guide/path-of-exile-2/path-of-exile-2-crafting-guide-how-to-make-better-weapons-and-armor-under-the-new-essence-rules ; https://mobalytics.gg/poe-2/guides/ssf-crafting
- [S20] Mobalytics, "[0.5] Low/High Budget Equipment Crafting Guide" (search snippet only, 403) — https://mobalytics.gg/poe-2/profile/paintmaster/guides/recoup-chronomancer-gear-crafting-guide
- Unavailable during collection: maxroll.gg/poe2 (connection dropped), poe2wiki.net (Anubis), mobalytics (403).
