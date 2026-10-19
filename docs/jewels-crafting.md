# Jewels in PoE 2 0.5.5: crafting and pricing

Patch 0.5.5, Forbidden Rites league (started 2026-09-04), compiled 2026-10-17.
Game terms are given in English, as in the game. **[R]** — verified against local game data
(`%APPDATA%\PoE 2 Price Checker\cache\repoe-mods.json`, `repoe-base-items.json`, `stats.json`).
**[T]** — live trade or poe.ninja, data as of 2026-10-17. [Sn] — sources at the end.
"(unverified)" — a claim from a single third-party source or a conclusion without confirmation.

---

## 1. Basics

### 1.1 Bases and mod pools [R]
In RePoE the bases have `item_class: "Jewel"` and short names: `Ruby`, `Emerald`, `Sapphire`, `Diamond`,
`Time-Lost Ruby`, etc. On trade the class is called `Jewels`, the category `jewel`.

| Base | Tags | Prefix / suffix families (regular) | desecrated p / s |
|---|---|---|---|
| Ruby (Str) | strjewel | 29 / 21 | 29 / 3 |
| Emerald (Dex) | dexjewel | 30 / 44 | 29 / 3 |
| Sapphire (Int) | intjewel | 23 / 35 | 29 / 3 |
| Diamond | str+dex+int jewel, not_for_sale | 70 / 90 (union) | 29 / 3 |
| Time-Lost Ruby | str_radius_jewel, radius_jewel | 30 / 22 | 6 / 6 |
| Time-Lost Emerald | dex_radius_jewel | 31 / 45 | 6 / 6 |
| Time-Lost Sapphire | int_radius_jewel | 24 / 35 | 6 / 6 |
| Time-Lost Diamond | all three radius tags | 71 / 88 | 6 / 6 |

What each colour gives (per the RePoE pool):
- **Ruby** — physical / fire / melee / mace / armour / block / totem / warcry / bleed / ignite / rage / banner.
  Also minion life and AoE, Max Fire Res, life leech, life regen, mana cost → life cost, stun.
  It has no crit suffixes of its own, so crit builds almost never take Ruby [S9].
- **Emerald** — bow / crossbow / spear / quarterstaff / projectile / lightning / evasion / accuracy / poison / shock / mark / companion / herald / charm / flask.
  Suffixes: **Attack Speed**, **Critical Hit Chance for Attacks**, **Critical Damage Bonus for Attack Damage**, Movement Speed, Cooldown Recovery, pierce, fork/chain.
- **Sapphire** — spell / cold / chaos / ES / curse / minion damage / ailment magnitude / trigger / offering.
  Suffixes: **Critical Hit Chance**, **Critical Damage Bonus** (global), crit for spells, **Cast Speed**, Minion attack/cast speed and minion crit, recoup, mana/life on kill.
- **Diamond** — the pool of all three colours. Getting the right pair of mods is very hard (160 families). Obtained at the **Reforging Bench**.
  A recipe of 1 Ruby + 1 Emerald + 1 Sapphire is listed on poe2db as a Forge recipe [S4][S17]. Another source says "any one" base (unverified). Time-Lost Diamond is made the same way from three Time-Lost [S3].

Mod changes in 0.5.0 [S1]: Max Rage on Ruby is now +1–2, Chaos Damage on Sapphire 7–13%, Banner AoE 6–16%.
The "Fevered" prefix no longer rolls on Sapphire and Time-Lost Sapphire.
The ES Recharge suffix no longer rolls on Jewels.

### 1.2 Slots, levels, tiers
- Rare: **2 prefixes + 2 suffixes = 4 mods**. Magic: 1+1. Our `craft.js` counts it the same way (`perSide = 2`).
  A fifth mod is possible only via the crafted mod "+1 Prefix/Suffix Modifier allowed" (see 2.6) or by corrupting a unique (Heart of the Well) [S6][S7].
  timesaver says "up to 3 prefixes and 3 suffixes" for Time-Lost [S2]. This contradicts the game data and the guides on 5-mod jewels, so we treat it as an error (unverified).
- **Every jewel mod has exactly one tier with a wide range** [R]: all jewel mods have `required_level = 1`.
  Item level does not affect the mod set. Only a **Divine Orb** improves the roll.
  Example: `JewelCriticalChance` (5–15)% increased Critical Hit Chance — a single "tier". The radius counterpart has (2–3)%.
- Values on Time-Lost are small because they apply to every passive in the radius.
  For example, "Small Passive Skills in Radius also grant (2–3)% increased Armour" versus (10–20)% Armour on a regular Ruby [R].

### 1.3 Sockets on the tree
A jewel works only in a dedicated Jewel Socket. A Time-Lost radius works only in a real tree socket.
Sinister Jewel Sockets (Voices, Zarokh's Gift) are disconnected from the tree: uniques can't go in them, the radius does not work [S4][S2].
Lich (Crystalline Phylactery) accepts a non-unique basic jewel and empowers it. Sorceress (Baryanic Leylines) has +40% to the radius of non-unique Time-Lost [S4].

### 1.4 Time-Lost jewels (radius jewels)
- The implicit `JewelRadiusImplicit` — base radius. Without mods the radius is **Small** [R].
  The radius is raised by the **prefixes** "Upgrades Radius to Medium" and "Upgrades Radius to Large".
  On trade this is a single option stat `explicit.stat_3891355829|1/|2`; "Very Large" (|3) comes only from crafting [R][S11].
  **The radius upgrade takes a prefix slot.**
- Suffixes "(15–25)% increased Effect of Small Passive Skills in Radius" and "… Notable Passive Skills in Radius" [R].
  Trade: `stat_1060572482` and `stat_4234573345`. The old `JewelRadiusNotableEffect` has weight 0 and no longer rolls.
- The other mods are written as "**Small Passive Skills in Radius also grant …**" or "**Notable Passive Skills in Radius also grant …**".
  **Small or Notable does not depend on the affix side.** RePoE checked against trade [R]:
  - prefixes: 48 Small, 21 Notable (ailment / crit-ailment / curse / ignite / poison / shock / bleed magnitude, AoE, ES recharge start, presence AoE, block…);
  - suffixes: 57 Notable (cast/attack speed, crit chance/bonus, life on kill…), 27 Small (leech, mana regen, shock chance, stun threshold…).
- In total there are 560 "… in Radius also grant" stats on trade (groups explicit / fractured / crafted / desecrated) [R].
- The Time-Lost desecrated pool (Abyss) — 6+6 mods [R]. For example, "Notable Passive Skills in Radius also grant 1% increased maximum Life / maximum Mana".
  Also Recoup as Life/Mana, Global Defences, Regenerate % Life, Mana Cost Efficiency, flask/charm charges per second.
- Where they come from: since 0.5, a regular world drop, magic/rare, drop level 20, more often on high-tier maps [S2].
  The Time-Lost Cache chest at the end of the Trial of the Sekhemas — older sources [S3] (unverified for 0.5.5).
  The Diamond version — only via the Reforging Bench from three Time-Lost [S3][S4].
- A unique on the Time-Lost Diamond base: **Against the Darkness**. Large radius, 2 random mods from the Time-Lost pool, Limited to 1 [S2][S3].

### 1.5 Corruption (Vaal Orb) [R][S3][S4]
- The corrupted enchant on jewels is 1 of 11 options, all with equal weight: +(4–6) Str / Dex / Int, +(5–10)% Fire / Cold / Lightning Res, +(3–7)% Chaos Res.
  Or immunities: Immune to Maim, You cannot be Hindered, Corrupted Blood cannot be inflicted on you, Cannot be Blinded.
- The other outcomes are as for items: nothing (~25%), reroll of 1–3 mods, enchant. Jewels have no sockets [S16].
  "Radius to Large" from corruption is mentioned only by timesaver [S2]; it is not in the poe2db list. We treat it as an error (unverified).
- **Architect's Orb** works on an already corrupted item: 50% a second corrupted enchant, 50% the item is destroyed [S16].
- Heart of the Well (Diamond unique): Vaal can give a **5th mod** [S7].

---

## 2. Currency and omens on jewels

### 2.1 Basic orbs
- **Transmutation / Augmentation / Regal / Exalted / Chaos / Annulment / Divine** work as usual.
  Side omens too: Sinistral/Dextral Exaltation, Erasure, Annulment, Coronation, Alchemy, and also **Greater Exaltation** (Exalt adds two mods).
- **Greater / Perfect** versions (Exalted / Chaos / Regal: mod level 35+/50+; Augmentation/Transmutation: 44+/70+) **are useless on jewels**.
  All jewel mods are level 1 [R], so there are no eligible mods. Probably the orb will not apply or will do nothing (not verified in game).
- **Omen of Whittling** (Chaos removes the lowest-level mod): all jewel mods are level 1, so effectively a random mod is removed (unverified).
- **Divine Orb** — the only way to raise a roll. There are no tiers, so the reroll covers the whole range.
- Chance of a specific mod with chaos spam: Emerald has 74 families, so the second crit line comes up roughly 1 time in 73. Time-Lost Emerald has ~77 [S5][S9].
  In PoE 2 there are no weights in the files; guides treat the pool as equally likely (unverified).

### 2.2 Essences
They **cannot be applied** to jewels [R]. RePoE has no essence mods with jewel tags.
In poe2db the "Equipment" tooltip does not include Jewels; this is noted in `data/crafting-currency.json`. Corrupted essences and Alloys cannot be applied either.

### 2.3 Desecration — Preserved Cranium
- Cranium is the only bone for jewels, and it exists only as Preserved. Requires a Rare.
  Adds an Unrevealed desecrated mod; if the item is full, it first removes a random mod [S13].
- Revealing at the Well of Souls: a choice of 1 out of 3. **Omen of Abyssal Echoes** gives one reroll of the three.
  **Omen of Sinistral/Dextral Necromancy** places the mod only as a prefix or only as a suffix.
  **Omen of Light** — the next Annulment removes only a desecrated mod. Limit — 1 desecrated mod per item.
  Lich omens (Sovereign/Liege/Blackblooded) work only on Weapon/Jewellery, not on jewels.
- The desecrated mod pool of regular jewels [R]: 29 hybrid "Abyss" prefixes.
  For example, (5–10)% Armour/Evasion/ES + (4–8)% Spell/Attack/Minion/Thorns/Totem Damage; (4–8)% Fire/Cold/Lightning Damage + Penetrates (4–7)%.
  Also: Bleed/Poison chance+magnitude, Companion life+damage, Aura magnitude+Presence AoE, Exposure effect, Abyssal Wasting.
  Only 3 suffixes: (1–2)% increased Str/Dex/Int.
- **Important:** the reveal also offers **regular** mods from the pool. In guides, the desecrated suffix is used to add the second crit line, Movement Speed, Attack Speed, Effect of Small/Notable Passives [S5][S10][S12].
  In an experiment [S10]: 60 Emerald + Dextral Necromancy → 38 successes, 5 with the second crit line, 2 with MS. This is patch 0.3.
- Cranium price ~1.6 div in June [S12] (unverified as of 2026-10-17).

### 2.4 Refined Catalysts (jewel quality)
- Since 0.5.0 jewels have a separate set of **Refined** catalysts [S1][S14]. They add quality that boosts mods of their tag, and replace any other quality type.
  - Refined Flesh — Life; Refined Neural — Mana; Refined Carapace — Armour/Evasion/ES
  - Refined Uul-Netol's — Physical; Refined Xoph's — Fire; Refined Tul's — Cold; Refined Esh's — Lightning; Refined Chayula's — Chaos
  - Refined Reaver — Attack; Refined Sibilant — Caster; Refined Skittering — Speed
  - Refined Adaptive — Attribute; Refined Necrotic — Minion (added in 0.5.2)
- Since 0.5.0 catalysts do not drop from monsters; they come only from the Genesis Tree (Breach). Alternate-quality items can be disenchanted to get back some of the catalysts [S1].
- **Omen of Catalysing Exaltation**: the next Exalted Orb consumes all catalyst quality and raises the chance of a mod of that type [S14].
  Not directly confirmed for Refined on jewels (unverified). Guides recommend Refined Reaver for attack jewels and Refined Sibilant for caster ones [S5].
- In the advanced text (Ctrl+Alt+C) a mod affected by quality is marked "— 40% Increased". Our parser accounts for this (`boostLine`).
  The quality cap on jewels is 20% (unverified).

### 2.5 Liquid Emotions (Delirium) — the main jewel crafting tool in 0.5
Since 0.5.0: "Liquid Emotions can now be used to craft additional mods on Jewels" [S1].
**Each emotion removes a random mod from a Rare jewel and adds a guaranteed Crafted mod.**
The mod depends on the emotion and the base colour [S11][S15]. An item can have only **1 crafted mod** (0.5.0).
Regular emotions work on Rare basic jewels (Ruby/Emerald/Sapphire/Diamond), **Ancient** ones — only on Rare Time-Lost.

Regular jewels (Diluted → Liquid → Concentrated → Potent) [S15], format Ruby / Sapphire / Emerald:
- Diluted Ire / Guilt / Greed — Armour / ES / Evasion %; Fire / Cold / Lightning %; Phys / Chaos / Elemental %.
- Liquid Paranoia — Attack Dmg / **Cast Speed** / **Attack Speed**.
- Liquid Envy — mana→life cost / Spell Dmg / CDR. Disgust — life regen / mana on kill / life on kill.
  Despair — Rage on hit / **Spell Crit Chance** / **Attack Crit Chance**.
- Concentrated Fear — Warcry speed / **Spell Crit Bonus** / **Attack Crit Bonus**. Suffering — Max Rage / AoE / **Movement Speed**.
  Isolation — Max Fire / Cold / Lightning (Diamond: Max Chaos, `CraftedJewelMaximumChaosResistance` [R]).
- **Potent Melancholy** — Debilitate / Exposure / Blind on Hit, if the tree has jewels of the two other colours [R][S15].
- **Potent Ferocity** — a crafted **prefix** "(40–60)% increased Effect of Suffixes" or a suffix "(40–60)% increased Effect of Prefixes" [R].
  Trade: `stat_2475221757` and `stat_1443502073`. **This is the main price multiplier**: crit suffixes get +40–60%.
- **Potent Contempt** — a crafted prefix "+1 Suffix Modifier allowed" or a suffix "+1 Prefix Modifier allowed" [R].
  It gives up a slot on one side and grants a third mod on the other. This is how a "5-line" with three good suffixes is made.
  Trade: `stat_718638445` and `stat_3182714256`. Potent Contempt price ~1/1.5 div per poe2db (snapshot date unknown).

Time-Lost (Ancient, requires the Delirium Atlas Tree) [S1][S15]:
- Ancient Ire / Guilt / Greed / Paranoia / Envy / Disgust / Despair / Fear / Suffering — the same themes in the form "Small/Notable Passive Skills in Radius also grant …".
  For example, Ancient Despair (Sapphire) — Notable: Spell Crit Chance; Ancient Fear (Emerald) — Notable: Attack Crit Bonus.
- Ancient Isolation — damage conversion in the radius.
- **Ancient Potent Melancholy** — "Upgrades Radius to Very Large" (crafted prefix) [R][S11].
- **Ancient Potent Ferocity** — Notable: Max Fire / Cold / Lightning / Chaos Res (`CraftedJewelRadius*Resistance` [R]).
- **Ancient Potent Contempt** — +1 Prefix/Suffix Modifier allowed. Drop level 65, ~5.4 div over 24 h per poe2db [S11].
- 0.5.5 fixed a bug: the Atlas passive "I know your childhood fears…" was dropping Ancient Liquid Emotions [S18]. Since then Ancient emotions have probably become rarer and more expensive (unverified).

### 2.6 Miscellaneous
- **Fracturing Orb** locks a random mod; requires 4+ mods. On jewels that means 4 mods, a 1/4 chance to hit the right one, and with a desecrated mod in the base ~1/3 [S12].
  **Hinekora's Lock** before expensive steps lets you preview the outcome.
- "(Jewel)" mods on trade: "Recover #% of maximum Mana on Kill (Jewel)" is `stat_1604736568`, separate from the regular `stat_1030153674` [R].

---

## 3. Recipes (from 0.5 guides; prices as of the guide date)

**A. Crit jewel Emerald/Sapphire from a 3-mod (cheap, 0.3, [S10])**
1. Buy a Rare with two useful prefixes and one crit line in the suffixes.
2. Omen of Dextral Necromancy + Preserved Cranium: a desecrated suffix. If it removed the crit line — trash it.
3. Omen of Abyssal Echoes, then reveal: look for the second crit line or Movement Speed.
4. In the experiment ~15 div went into 60 bases, profit 60–70 div. This is 0.3 economics.

**B. "5-line" (three good suffixes + Ferocity/Contempt), 0.5 [S5][S6]**
1. A base with a fractured crit suffix (≈1 div). For Time-Lost: fractured Notable crit bonus/chance, filter "crafted: no".
2. Chaos spam + Omen of Dextral Erasure for the second crit suffix (~1/73).
3. Dextral Necromancy + Cranium for the third suffix (Attack Speed, MS, Effect of Notable/Small). A miss is removed with Omen of Light + Annulment.
4. Chaos spam for the prefixes (Shock magnitude, ailment magnitude, etc.).
5. **Potent Liquid Contempt** (or Ferocity) at the end. The emotion removes a random mod — per the guides this is a "pure 50/50". Use Hinekora's Lock before it.
6. Cost: ~60 div (about 8 attempts at ~6 div + the base), with average luck up to ~150 div. For a "regular + Time-Lost" pair people budget ~300 div. Each failed desecration ~15–16 div [S5][S6].
   A cheaper option: buy a jewel with the needed suffixes and a bad desecration/prefixes and redo it [S6].

**C. Time-Lost Sapphire "large radius + notable crit" [S12], June 2026**
1. Buy ≥5 Rare Time-Lost Sapphires with Large radius, without fractured/corrupted/desecrated (25–40 ex each).
2. Cranium: Large + 2 mods + 1 desecrated.
3. Fracturing Orb to lock Large (~1/3).
4. Annulment down to one extra mod, then chaos spam.
   Targets: Notable crit chance, Notable crit bonus, Effect of Small/Notable Passives. Then Divine.
5. Cost price ~9 div, estimated value 50–60 div.
6. Final step: Ancient Potent Melancholy (Very Large) or Ancient Contempt.

---

## 4. Pricing

### 4.1 What is expensive
- **Regular jewels:** almost all of the price comes from the **suffixes**.
  - Emerald: Attack Crit Chance + Attack Crit Bonus + Attack Speed.
  - Sapphire: global Crit Chance + Crit Bonus (+ Cast Speed / ES).
  - Minion: Minion Attack and Cast Speed, Minion Crit.
  - Price multipliers — **Effect of Suffixes** (Ferocity) and a third suffix (Contempt).
  Prefixes — damage of their archetype (projectile, spell, elemental, shock/ailment magnitude), but they are secondary.
  Ruby has no crit lines, so it is mostly cheap [S9].
- **Time-Lost:** first the radius (Large / Very Large; Large with two decent notables can be better than Medium with three [S2]).
  Then ≥2 mods that scale the build: Notable crit chance/bonus, Notable cast/attack speed, crit-ailment magnitude, curse AoE.
  Plus Effect of Notable/Small Passives. One useful Notable on Medium — <1 div; two — several div; god-roll — double-digit div (July, [S2]).
- **Uniques** (poe.ninja Forbidden Rites, 2026-10-17, lowest price without regard to rolls) [T]:

| Unique | Price, div | Listings |
|---|---|---|
| Voices (Sapphire) | 1199 | 72 |
| Grand Spectrum Ruby | 36 | — |
| Against the Darkness | 8.5 | 1771 |
| The Adorned | 7 | — |
| Grand Spectrum Emerald | 4.7 | — |
| Controlled Metamorphosis | 4 | — |
| Grand Spectrum Sapphire | 2 | — |
| Undying Hate | 1 | — |
| Heroic Tragedy | 0.67 | — |
| Heart of the Well | 0.54 | — |
| Megalomaniac | 0.09 | — |
| From Nothing | 0.1 | — |
| Prism of Belief | ~0 | — |

  For Megalomaniac (drops identified since 0.5), Heart of the Well, Timeless jewels and Against the Darkness the price is **entirely in the rolls**.
  Heart of the Well: 4 mods with Extra Fire/Cold/Lightning + 2 crit lines — ~100–185 div, a clean 5-mod — hundreds to thousands of div (August, [S7]).
  They cannot be priced by a single poe.ninja price.

### 4.2 Live trade, Forbidden Rites, 2026-10-17 [T]
Search instant buyout + online, the 10 cheapest listings, class jewel, nonunique:

| Query | Listings | 10 cheapest |
|---|---|---|
| Emerald: Atk Crit Chance + Atk Crit Bonus + Attack Speed | 344 | 1, 105, 125, 150, 220…277 div — real floor ~100+ div |
| Emerald: Atk Crit Chance ≥10 + Atk Crit Bonus ≥20 | 1487 | 1–3 div |
| Emerald: Effect of Suffixes + Atk Crit Bonus | 1864 | 15–20 div |
| Sapphire: Crit Chance + Crit Bonus + Effect of Suffixes | 1777 | 25–35 div |
| Time-Lost: Notable Crit Bonus + Notable Crit Chance | 1180 | 20–28 div |
| Time-Lost: "Very Large" | 10000+ | 8 chaos (cheap on its own) |

Conclusions: **two** crit lines are a mass-market product (1–3 div). The price jumps on the **third** key suffix or on Ferocity.
1 div ≈ 746–790 ex in October [S8].

### 4.3 How to price-check
- Search by the **number of key lines**, not by all mods. Jewels have 4–5 lines, and 1–2 junk prefixes barely lower the price.
  A "count" group is convenient: N of [crit lines, AS/CS, Effect of Suffixes].
- For Time-Lost always filter the radius: `stat_3891355829` with option 2/3 or 1/2/3. Search for "Notable …" and "Small …" as **separate** stats, not the regular ones.
- Ferocity and Contempt are crafted lines (group `crafted.stat_*`). Make sure you search for the crafted version or pseudo.
- Junk "1 div" listings on expensive queries are price fixers; discard them.
- Megalomaniac, Timeless, Heart of the Well, Against the Darkness — search by specific mods/notables, not by name.

---

## 4.4 Demand by base (poe.ninja, Forbidden Rites, 2026-10-19) [T]

The overall "Rare Jewel" demand mixes the colours and Time-Lost. Time-Lost mods there are at 10–14% of builds (below the 15% threshold).
Among builds that wear **this base** (poe.ninja filter by base), the picture is different:

| Base | Builds 90+ | Top mods |
|---|---|---|
| Time-Lost Sapphire | 22 424 | Very Large 80%; Notable Crit Damage Bonus 58.5%; Notable Crit Chance 48%; Notable Spell Crit Chance 41%; Notable Crit Spell Damage Bonus 39% |
| Time-Lost Emerald | 15 635 | Very Large 67%; Notable Attack Crit Bonus 66%; Notable Attack Crit Chance 62%; Notable Projectile Speed 36%; Notable Spear Crit Bonus 33% |
| Sapphire | 60 818 | ES 51%; Spell Damage 50%; Crit Damage Bonus 47%; Crit Chance 43%; Spell Crit Chance 39% |
| Emerald | 28 336 | Attack Crit Chance 46%; Attack Crit Bonus 43%; Attack Speed 40%; Projectile Damage 36% |

The program (0.3.160+) computes a jewel's demand among builds with the same base (`ninjaBuilds.categoryDemand` `withBase`).

## 4.5 New from the 2026-10-19 research (report by source)

- **Exceeding the limit after Contempt** (M/L): if after Potent Contempt you remove the crafted "+1 Suffix Modifier allowed",
  the three suffixes stay. Chaos and Exalt do not touch that side ("no space"); the crafted slot is free again for a second emotion.
  The "+1" is removed with Omen of Sinistral/Dextral Erasure + Chaos or a side Annulment (not Omen of Light — that is only for desecrated).
  Sources: GGG forum "Ancient Potent Liquid Contempt intended?" (2026-06-04, https://www.pathofexile.com/forum/view-thread/3948475),
  poecurrency (2026-08-07). There is no fix in the 0.5.1–0.5.5 patch notes — **check in game**. In the program: the side over the limit is not
  touched, section "Over the limit".
- **Greater / Perfect** on jewels most likely **work like the regular ones** (M: poe2wiki, crafting codex — the level threshold does not
  exclude a family entirely, its highest tier remains; jewels have one tier). Against — timesaver ("strict threshold", L).
  There is no reason to recommend them (more expensive, no benefit); do not write "will not apply".
- **Emotions:** the full table "emotion × colour → mod and side" — `data/liquid-emotions.json` (poe2db Liquid_Emotions, 2026-10-19, H).
  Ancient Potent Ferocity — Notable **resistances**, not Effect of Suffixes (a common confusion). Ferocity and Contempt — the side follows the
  side of the removed mod; on a full 2+2 — "50/50" (M, guides). poe.ninja prices 2026-10-19: Potent Ferocity ≈ 6 div, Potent Contempt
  ≈ 2.6 div, Ancient Potent Contempt ≈ 17 div, Ancient Melancholy ≈ 1.4 chaos, colour ones — 1–15 ex.
- **Time-Lost corruption:** the same 11 enchants, no radius among them (poe2db Time-Lost Emerald, H) — timesaver's "Radius to Large from corruption" is an error.
- **0.5.1:** 40 new Elemental passives next to Jewel Sockets (Sorceress/Witch, Druid) — radius jewels are more valuable there (H, patch notes).

## 5. What this means for our app

**Status as of 2026-10-19 (0.3.160):** done — item 1 (radius mod text, `craft-data.radiusText`), 2 (we don't recommend
Greater/Perfect), 3 (emotions — options by colour with price and risk; not built into the plan), 4 (Desecrate — candidates from the regular pool too),
7 (the "(Jewel)" stat), 8 partially (radius in the search, Ferocity/Contempt — always key; "count" by key mods — no), demand by base (§4.4),
tier is not a sign of a key mod, the side over the limit. Open: emotions in the craft plan (which side gets removed on a full item), "count" search,
Omen of Catalysing Exaltation on jewels.


Current state: `craft.js` takes `misc` mods as `item` (correct); 2+2 for the `jewel` tag (correct); parses the "±N Modifier allowed" adjustment (correct).
Cranium bone only Preserved (correct), we don't recommend lich omens on jewels (correct). The "Refined Catalyst" advice exists.
Gaps:

1. **Time-Lost: the radius mod text in RePoE is truncated.** `JewelRadiusArmour` has the text "(2-3)% increased [Armour]", while in the game and on trade it is "Small Passive Skills in Radius also grant …".
   Consequences:
   - (a) `tradeStats()` → `statFor("2% increased Armour")` finds the **regular** `stat_2866361420` instead of `stat_3858398337`. The "after craft" price for Time-Lost is computed with the wrong stat.
   - (b) Demand (`want`) is taken from the global mod's line and greatly overstates the demand for radius mods.
   - (c) `own` (the item's lines) does not match `m.lines`.

   Fix: for mods with the `*_radius_jewel` tags, prepend "Small/Notable Passive Skills in Radius also grant ".
   Choose between Small and Notable by whether the stat exists in `stats.json`: verified, 0 ambiguous cases. The affix side does **not** determine Small/Notable.
   Exceptions: "Upgrades Radius to …", "Effect of Small/Notable Passive Skills in Radius", `JewelRadiusIncisionChance`, `JewelRadiusDazeBuildup`, `JewelRadiusSlowEffectOnSelf`.
   For the last three neither a Small nor a Notable stat was found; a manual check is needed.
2. **Greater/Perfect orbs are useless on jewels.** All mods are level 1.
   Right now we recommend "Greater / Perfect Exalted / Regal / Augmentation / Chaos (35+/50+…)" — these lines must be removed for the `jewel` tag.
   Whittling on jewels removes an effectively random mod: do not recommend it as targeted.
3. **We don't recommend Liquid Emotions at all**, yet they are the main jewel craft of 0.5. Add a section for Rare jewels if there is no crafted mod:
   - Potent Ferocity — "+40–60% Effect of Suffixes" if the suffixes are good; Potent Contempt — a third suffix.
   - Colour emotions (Paranoia — AS/CS, Despair/Fear — crit, Suffering — MS) — as a guaranteed mod **instead of a random one**.
   - For Time-Lost — Ancient emotions (Very Large radius, etc.).
   Warning: "removes a random mod — use Hinekora's Lock first". Data — `CraftedJewel*` in RePoE (domain `misc`, `spawn_weights` empty, so their pool is currently correctly excluded).
   The "emotion → mod → colour" mapping will have to be entered manually, for example in `data/crafting-currency.json`.
4. **Desecration on jewels**: we show only the `desecrated` domain — hybrid prefixes and 3 attribute suffixes.
   The reveal also offers regular mods (crit, MS, Effect of Passives) [S5][S10]. For jewels, candidates must be shown from both pools (with an "unverified" note about the exact mechanics).
   Recommend Omen of Abyssal Echoes and Necromancy for the needed side.
5. **Omen of Catalysing Exaltation** is currently mentioned only for rings and amulets. For jewels, add it to the Refined Catalyst advice, listing the 13 types (Reaver — attack, Sibilant — caster, Necrotic — minions, Skittering — speed).
6. **Corruption**: we could show the list of the 11 corrupted jewel enchants. For Heart of the Well, note the chance of a 5th mod.
7. **Trade stat "(Jewel)"**: "Recover #% of maximum Mana on Kill" on a jewel must be searched as `stat_1604736568`, but `stats.lookup` will find `stat_1030153674`.
   A suffix variant " (Jewel)" is needed in the index, analogous to " (Local)" (for the Jewels class).
8. **Pricing**:
   - For Time-Lost always enable the radius filter (option stat `3891355829`; check that the variant logic in pricing.js returns it).
   - By default "count" by key suffixes. Search for Ferocity/Contempt in the crafted group.
   - Ruby / Emerald / Sapphire / Diamond in the same `jewel` category is fine if the filters are by mods.
   - For unique jewels the poe.ninja price is a floor; for Megalomaniac, Timeless, Heart of the Well, Against the Darkness warn that the price is in the rolls.
9. Minor: `tierUps` / "weak tier" does not trigger on jewels, they always have 1 tier — this is correct. But the UI should say "improve the roll — Divine Orb", not "tier".

---

## 6. Sources
- [S1] Official patch notes 0.5.0 (Return of the Ancients), PoE forum, ~2026-05-22/29: https://www.pathofexile.com/forum/view-thread/3932540 (jewel lines quoted).
- [S2] timesaver.gg, PoE2 Time-Lost Jewels Guide (0.5), 2026-07-31: https://timesaver.gg/blog/poe2-time-lost-jewels-guide (a shop; prices are estimates).
- [S3] poe2db Time-Lost Diamond: https://poe2db.tw/us/Time-Lost_Diamond (viewed 2026-10-17); game8 Time-Lost: https://game8.co/games/Path-of-Exile-2/archives/493122.
- [S4] poe2db Jewels / Diamond: https://poe2db.tw/us/Jewels, https://poe2db.tw/us/Diamond (2026-10-17).
- [S5] Mobalytics, "The ULTIMATE 5 Line Jewel Craft Guide — 3 Methods" (0.5; the page returned 403, content per search results): https://mobalytics.gg/poe-2/profile/gl1tch3d/guides/the-ultimate-5-line-jewel-craft-guide-3-methods
- [S6] mmoexp, 5-mod jewel guides (0.5; per search results): https://www.mmoexp.com/News/poe-2-0-5-jewel-crafting-guide-how-to-craft-insane-5-mod-endgame-jewels-for-any-build.html , https://www.mmoexp.com/News/poe-2-jewel-crafting-guide-craft-five-mod-jewels-for-50-divines-less.html
- [S7] timesaver.gg, Heart of the Well guide, 2026-08-17: https://timesaver.gg/blog/poe2-heart-of-the-well-guide
- [S8] div/ex rate: timesaver tablet guide 2026-10-09 (~790 ex), poeoverlay (~746 ex, 2026-10-17): https://timesaver.gg/blog/poe2-tablet-prices-which-mods-worth-divines-0-5-5 , https://www.poeoverlay.com/market-history/poe2/forbidden-rites/currency
- [S9] u4gm / mmojugg jewel guides 0.5 (per search results; Ruby without crit, Emerald 74 mods): https://www.u4gm.com/path-of-exile-2/blog-path-of-exile-2-0.5-jewel-crafting-guide
- [S10] poe2fun, Emerald Jewel Crafting (0.3.0): https://poe2fun.com/guides/poe2-emerald-jewel-crafting-guide
- [S11] poe2db Ancient Potent Liquid Contempt / Potent Liquid Contempt (2026-10-17): https://poe2db.tw/us/Ancient_Potent_Liquid_Contempt , https://poe2db.tw/us/Potent_Liquid_Contempt ; game8 Ancient Potent Liquid Melancholy: https://game8.co/games/Path-of-Exile-2/archives/603306
- [S12] exile.codex-wiki, Time-Lost jewels crafting breakdown (0.5, 2026-06-24): https://exile.codex-wiki.com/builds/poe2-time-lost-jewels-complete-crafting-breakdown
- [S13] game8 Desecrated Modifiers and Abyss Crafting: https://game8.co/games/Path-of-Exile-2/archives/547417 ; timesaver Desecrated currency (0.5.3): https://timesaver.gg/blog/poe2-desecrated-currency-guide
- [S14] poe2db Catalysts (Refined, Omen of Catalysing Exaltation), 2026-10-17: https://poe2db.tw/us/Catalysts ; timesaver catalysts (0.5.2, 2026-06-24): https://timesaver.gg/blog/poe2-catalysts-guide
- [S15] aoeah, Liquid Emotions in PoE 2 0.5 (2026-06-12): https://www.aoeah.com/news/4633--how-to-get-and-use-liquid-emotions-in-poe-2-05
- [S16] timesaver Vaal Orb guide (2026-07-22) / Double corruption (0.5.3): https://timesaver.gg/blog/poe2-vaal-orb-guide , https://timesaver.gg/blog/poe2-double-corruption-guide
- [S17] Diamond at the Reforging Bench: https://www.sportskeeda.com/mmo/path-exile-2-how-craft-diamond-jewel-pearlescent-amulets , https://www.ezg.com/blog/poe-2-patch-0-5-0-crafting-guide-how-to-make-diamond-jewels-and-pearlescent-amulets
- [S18] Official patch notes 0.5.5, 2026-09-03: https://www.pathofexile.com/forum/view-thread/4000864 (for jewels only the Prism of Belief / From Nothing and Ancient Emotions fixes).
- [T] poe.ninja API `poe2/api/economy/stash/current/item/overview?league=Forbidden Rites&type=UniqueJewels` and trade2 search/fetch, 2026-10-17.
- [R] RePoE (repoe-fork.github.io/poe2) and trade `data/stats` from the app cache, 2026-10-17.
