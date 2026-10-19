# PoE 2 — crafting techniques and combos (for the Craft advisor)

- **Current for:** 0.5.x (Runes of Aldur → Forbidden Rites, 0.5.5e). The crafting core has not changed since 0.5.0. Supplements `docs/crafting-notes.md`: what is already described there is not repeated here, only refined.
- **Compiled:** 2026-10-17.
- **Confidence:** **[H]** — there is in-game text (poe2db 0.5), official patch notes or several independent sources; **[M]** — 1–2 guides for 0.5 or a logical inference from [H]; **[L]** — a single third-party guide, an old patch or contradictory data. [T#] references point to section 8.
- Unavailable during collection: maxroll (connection dropped), mobalytics (403), poe2wiki (Anubis): only search snippets from them are available.

---

## 0. Corrections to `crafting-notes.md`

| § | Currently in the notes | What is actually true | Confidence |
|---|---|---|---|
| 2.5 | "Revealing — a choice among options (3 — unverified)" | **3 options**, you pick 1. The pool may include the class's **regular (base) mods**, unless a lich omen narrows the pool to its own mods [T2][T9][T11] | H |
| 2.5 / 3 | Abyssal Echoes — "one reroll" | Yes: **one reroll of the whole set of 3 options** (0.5 text [T1][T16], codex [T9]). Guides from the 0.3 era say "3 → 6 options" [T10] — that is outdated. **Disputed (2026-10-18):** Mobalytics [abyss-crafting](https://mobalytics.gg/poe-2/guides/abyss-crafting) (upd. 2026-07-07) says that after the reroll you can also take an option from the first three — effectively a choice of 6; the code (`plancost.js`) assumes a choice of 6. Verify in game (docs/README.md) | H / disputed |
| 2.1 / 2.5 | "There are no Desecrated prefixes on Body/Gloves/Boots/Helmet" | There are no **lich-exclusive mods** among armour prefixes. Desecrate into an armour prefix (Rib + Sinistral Necromancy) works and offers **regular prefixes** (flat ES, hybrid, life, MS on boots); almost every armour recipe in 0.5 does this [T2][T17][T18]. Sceptres have no exclusive mods at all [T2] | H |
| 2.5 | Ancient — mods 40+ | All **198 lich mods are level 65** [T2]: with a lich omen, Ancient gives nothing beyond the ilvl ≥ 65 requirement (which is needed anyway). Ancient pays off only when base mods can appear in the reveal (armour prefix, reveal without a lich omen): then it cuts off base mods below 40 | H (levels) / M (inference) |
| 2.2 | "threshold never removes a family — unverified" | **Confirmed:** for Greater/Perfect currency the minimum mod level is a level filter, but "at least one tier of each mod will always be eligible". A family whose tiers (≤ ilvl) are all below the threshold still rolls at its best tier. Example: a Perfect Exalt gave ES Recharge Rate T1 (lvl 48) [T6][T8] | H |
| 2.3 | Fracturing: "≥ 4 mods" | Desecrated mods, **including unrevealed ones**, cannot be fractured, but they **count toward the minimum of 4**. On an item with 3 regular mods and 1 unrevealed, the chance to hit the wanted mod is **1/3**, not 1/4 [T10][T12][T17]. Mark of the Abyssal Lord **can** be fractured, and such a Mark can no longer be converted [T15] | H / M (Mark) |
| 2.3 / R6 | Hinekora: "you can't look at another option" | The foresight lasts until the item is changed: you can hover **different** currencies (Exalt, Chaos, Divine, Vaal…) and see the result of each, then apply the best one. An active omen changes the result, so you need to look at the exact "currency + omens" combination [T13][T4] | M |
| R3 / §6.10 | Whittling: "safer to exclude desecrated" | The opposite: **an unrevealed desecrated mod counts as a level-1 mod**, and Whittling removes it first [T8]. Special crafted mods of level 0–1 (Mark, corrupted and Breach essences) are also first candidates [T3][T17] | H (unrevealed) / M (crafted) |
| R3 | "An essence mod is removed only by chance" | If the essence mod is a special level 0–1 mod (Mark, Hysteria, Breach, etc.), it can be removed with **Chaos + Whittling** (after revealing the desecrated mod first) [T17]. Regular Greater essences give a regular tier with its own level — unverified | M/L |
| R8 | Liquid Emotions "like a Greater Essence (unverified)" | Official patch notes: on jewels they "work similarly to greater essences, each having a set of specific mods that will replace a random existing mod" [T5] | H |
| 3 (bottom) | "up to three omens — unverified for regular crafting" | The "up to 3" limit applies only to Chaotic Waystone omens [T5]. For crafting the rule is: **different kinds stack, one omen of each kind**; if a combination is invalid, the craft will not go through [T8][T9]. See section 2 | H/M |
| 2.5 | Putrefaction and the 1-desecrated limit | Putrefaction bypasses the limit: all mods become **up to 6 Unrevealed** (3+3), the item is corrupted, they are revealed one at a time (prefixes first), each time from 3 options [T1][T17] | H (text) / M (order) |

---

## 1. Desecration — in detail

### 1.1 Mechanics (what to model)
- **Desecrate** adds 1 Unrevealed mod. Without an omen the side is random (~50/50 [T10], **M**). Sinistral/Dextral Necromancy set the side. An unrevealed mod **takes up a slot** on that side [T10] → this is a free way to "close" a side for subsequent Exalts (see T-07).
- **Full item (6 mods):** first a random mod is removed [T2][T16]. How this interacts with Necromancy (whether the mod is removed from the same side) is not documented [T9]: model it as "random among all non-fractured", **L**.
  Mobalytics [abyss-crafting](https://mobalytics.gg/poe-2/guides/abyss-crafting) and [talisman-craft](https://mobalytics.gg/poe-2/guides/talisman-craft) (2026): the bone removes a random mod and places a desecrated mod **on the same side** (a prefix removed — a prefix comes); with a Necromancy omen a mod from that side is removed ("1/3" with three suffixes). If so, on a side with one removable mod the replacement is guaranteed — **M**, verify in game; not modelled in the plan.
  **Verified in game (2026-10-18, H):** full suffixes + Dextral Necromancy — a suffix was removed, an unrevealed desecrated suffix took its place. In the plan (0.3.140): one extra mod on a full side — Desecrate is done before the removals and replaces one Annulment attempt on that side (`plancost.js` `desFirst`).
- **Revealing at the Well of Souls:** 3 options, take 1. It can be postponed: the item can be crafted further with an unrevealed mod (the fracture and "unveil at the end" tricks are built on this) [T10][T17], **H**.
- **Option pool:**
  - with a lich omen (Sovereign → Ulaman, Liege → Amanamu, Blackblooded → Kurgal; **Weapon/Jewellery only**) — that lich's mods for the class and side. In total the liches have Amanamu 26P/44S, Kurgal 23P/39S, Ulaman 22P/44S (across all classes), all level 65 [T2], **H**. If ≤ 3 match the class and side, the wanted mod is guaranteed: e.g. Sovereign + Sinistral on a crossbow "guarantees" +1 Ballista Totem [T17], **M**.
  - without an omen — a mix of the class's base mods for that side and lich exclusives [T2]. According to the community (Craft of Exile): at ilvl 65+ at least 1 option is an exclusive, the rest ~50/50; GGG has not confirmed this [T10], **L**.
  - Ancient bone: options with mod level ≥ 40 [T2][T11]. Gnawed: only ilvl ≤ 64, gives no exclusives (lvl 65) [T2].
- **Abyssal Echoes:** one reroll of the whole set. Probably after the reroll the choice is only from the new set — **M** (that is how the text [T1] reads; no explicit confirmation). Mobalytics [abyss-crafting](https://mobalytics.gg/poe-2/guides/abyss-crafting) (upd. 2026-07-07): "you can also take an option from the first three" — a choice of 6; this is what the code currently assumes. Disputed — verify in game.
- **Omen of Light + Annulment:** guaranteed to remove the desecrated mod (there is always only one on an item, so a side omen isn't needed), after which you can desecrate again. This is the standard "retry loop" [T1][T14][T17], **H**. Loop cost = Annul + Light (+ bone + Echoes).

### 1.2 Tactics
| # | Technique | Conditions | Effect / chance | Pitfalls | Confidence |
|---|---|---|---|---|---|
| D-1 | **Open a slot → desecrate into it** (Annul + side omen on the bad mod, then bone + the same Necromancy, then Echoes) | The target side has 1 removable mod (or the rest are fractured) — the Annul is guaranteed | The junk mod is replaced by a pick of 1 out of 3 (with Echoes — 2 sets). Normal practice: this is what the "Light loop" looks like, only the first pass uses a regular Annul | Echoes costs ~1 div: use it only on items where the mod noticeably raises the price [T17][T18] | M |
| D-2 | **Desecrate a full item on purpose** | Almost never used. Justified when all non-fractured mods are equally junk (fractured base + junk) | Random junk → 3 options. Cheaper than Chaos + omens if the bone is cheap | May remove the only valuable mod. How the removal side relates to Necromancy is unknown | L |
| D-3 | **Essence of the Abyss → desecrate** | Rare, crafted slot free (Essence of the Abyss is also crafted [S10 in notes]) | Essence of the Abyss: "Removes a random modifier" (Crystallisation picks the removal side [T15]) + Mark. Desecrate **replaces the Mark** with an unrevealed "higher tier" mod and removes nothing else even on a full item [T2]. Observed min. level ~33 [T15]. After that the crafted slot is free again (the Mark is gone) — inference, **M** | The Mark can land as a prefix or a suffix [T15]; the Mark can be accidentally fractured by a Fracturing Orb [T15]; Whittling removes the Mark first (level 0) | H (replacement) / L (tier) |
| D-4 | **Unrevealed desecrated as a "dummy" for Fracture** | A rare with 3 mods, one of them key | Desecrate (don't reveal) → Fracturing Orb: **1/3** on the key mod. Then Annul the extra, reveal or Light | On a 3-mod item desecrate removes nothing. Don't reveal before the fracture | H |
| D-5 | **Blocker via reveal** | You need to exclude a mod of group X from future Exalts (e.g. Mana on a wand) | Pick a cheap group-X mod in the reveal → Perfect Exalt + Greater Exaltation into the open slots (X won't roll) → Light + Annul removes the blocker → new desecrate [T17] | Costs Light + a bone on top; pays off only with expensive Exalts | M |
| D-6 | **Unveil at the end** | Desecrate done early (took a slot), reveal postponed | Revealing last, you see the final item and choose for it; the options don't conflict with groups already present (assumption) | While the mod is unrevealed, Whittling hits it | M |
| D-7 | **Putrefaction "slot machine"** | A cheap ilvl 81+ base where the combined result of 6 mods matters (quivers, armour for Decay/Stonefist) | All mods → 6 Unrevealed (3P+3S), Corrupted; 6 reveals with 3 options each. Cost ~6–7 ex per attempt, resale 2–12 div [T17] | The item is corrupted — only runes and quality afterwards. Echoes — on the last reveals if the first ones are good | M |
| D-8 | **Lich omen + side** on weapons/jewellery | ilvl ≥ 65, Weapon/Jewellery | The pool narrows to the lich's exclusives on that side; with a small pool the wanted mod is almost guaranteed (Sovereign + Sinistral on a crossbow → +1 totem; Blackblooded on an amulet → "ES from Equipped Body Armour") [T17] | Lich omens don't work on armour. An Ancient bone is useless with them (everything is lvl 65) | H/M |

---

## 2. Omen stacking

- **Rule [H/M]:** you can activate several omens **of different kinds**, and they all apply to the next eligible currency. Two omens of the same kind don't stack [T9]. If a combination is invalid, the craft **will not go through**: the currency and omens are not consumed [T8][T9]. Omens don't bypass limits: Greater Exaltation + Sinistral with one free prefix — refused [T9], **M**.
- No explicit overall limit on the number of omens for crafting has been found. "Up to 3" applies only to Chaotic omens for Waystones [T5].

| Combination | Works? | Source / confidence |
|---|---|---|
| Greater Exaltation + Sinistral/Dextral Exaltation | Yes: 2 mods on one side (needs 2 open slots) | [T9][T17], H |
| Greater Exaltation + Perfect/Greater Exalted | Yes; both mods with the min. level (with the family exception, see §0) | [T6][T17], H |
| Homogenising + Greater + side (+ Perfect) | Worked in 0.3; in the 0.5 league Homogenising is unavailable (Currency Exchange only in Standard) | [T6][T5], H |
| Greater Annulment + Sinistral/Dextral Annulment | Yes: 2 mods from one side | poe2wiki [T8], H |
| Whittling + Dextral/Sinistral Erasure (+ Greater/Perfect Chaos) | Yes: the lowest-level mod on the side; in maxroll guides — for rerolling suffixes | [T19], M |
| Light + side Annulment | Pointless (there is only one desecrated mod on an item) | inference, H |
| Necromancy + lich omen (+ Echoes) | Yes, standard | [T17][T18], H |
| Catalysing Exaltation + side/Greater | Used in 0.5 guides [T17][T18], but there are complaints that in combination with other omens the catalyst "doesn't trigger" (0.3, small sample) [T7] | L |
| Crystallisation + Perfect/corrupted Essence / Alloy | Yes; in recipes Alloy is also steered by Crystallisation [T17] — for Alloy not confirmed by in-game text | H (essences) / L (Alloy) |

---

## 3. Catalogue of "deterministic" techniques

Format: **conditions → effect → chance → currency / price → pitfalls**.

- **T-01. Annul + side omen when the side has 1 removable mod.** The other mods on the side are fractured, or there is only one mod → the wanted mod is removed 100%. Price: Annul + Sinistral/Dextral Annulment, ~3.5 div per attempt according to the community [T17]. Pitfall: crafted and desecrated mods are also removable and count. **H**.
- **T-02. Chaos + Whittling.** The bad mod has the **lowest mod level** (not tier!) among the non-fractured ones → it is removed for sure, and a random one is added (with Greater/Perfect Chaos — 35+/50+). Reveal the desecrated mod beforehand, otherwise Whittling will hit the unrevealed one (lvl 1) [T8][T17]. How ties in level are resolved is unknown — **L**. Price: Whittling is an expensive omen (Ritual, "very rare" per maxroll [T19]). **H**.
- **T-03. Chaos + Erasure (side).** Removes a random mod from the chosen side and adds a random one (the new mod's side is not restricted — unconfirmed [T1]). Erasure costs "a few div" [T14]. Compare with T-01 + Exalt: maxroll advises working out which is cheaper — Annul + Sinistral Annulment or Perfect Chaos + Sinistral Erasure [T19]. **M**.
- **T-04. Perfect/corrupted essence + Crystallisation.** Removes a random mod from the specified side and adds the essence mod (the crafted slot must be free). If the removal side has 1 removable mod — deterministic [T9]. "Sacrificial mod" pattern: Exalt + side omen adds junk to the side with the fractured mod → Crystallisation on that same side → the essence removes exactly the junk [T17]. If the essence mod's side is full, the removal is probably forced to come from it ("all suffixes full → removes only a suffix" [T17]) — **M**.
- **T-05. Fracture the key mod.** P = 1/k, where k is the number of non-fractured **non-desecrated** mods (≥ 4 mods total required, desecrated ones count). First Annul the extras down to 3 regular + 1 unrevealed (D-4). After the fracture: Annul down to the base → Chaos-spam the second mod → onward down the chain [T12][T17]. In 0.5 the Fracturing Orb is obtained only via the atlas [notes S2]. **H**.
- **T-06. Fracture + side omens (isolation).** The fractured mod is on the same side as the junk: Annul/Crystallisation on that side hits only the junk [T9]. **H**.
- **T-07. Fill the other side to steer an Exalt (a free side omen).** If one side is full, a regular Exalt puts the mod on the other. You can fill it with an unrevealed desecrated mod (Necromancy), a cheap Exalt or a blocker. **H** (basic mechanics).
- **T-08. Group blocker.** An item can have only one mod per mod group. A cheap mod of group X closes X for subsequent Exalts/Chaos; then it is removed (Whittling if it is the lowest level, Light for a desecrated blocker, side Annul) [T9][T17]. Example — an Accuracy blocker on a bow before Whittling-spamming suffixes [T17]. **M**.
- **T-09. Greater Exaltation (+ Perfect Exalted).** Two mods for one Exalt; with Perfect — both 50+ (with the family exception). The omen is cheap (~4 ex versus ~171 ex for a Perfect Exalt [T17], prices at snapshot time). The most popular finisher in 0.5 recipes [T17]. **H**.
- **T-10. Catalysing Exaltation (jewellery).** Consumes all catalyst quality, increases the weight of mods with the same tag. The multiplier is officially unknown. The codex estimate is ~×5 at 20% and ~×7.5 at 40% [T9], **L**. Player feedback is contradictory [T7]. There are recipes with 40% (Breach rings/essence) [T17][T18].
- **T-11. Jewellery quality as a mod multiplier (the +4 trick).** Catalyst quality boosts mods with a matching tag. On an amulet, +3 to skills at ≥ 34% quality becomes +4 (3 × 1.34 → 4). To raise the quality cap, Essence of the Breach is used (+20% to maximum quality [notes S13b]). After that its mod is removed with Whittling (after revealing the desecrated mod) or a side Annul — **the quality stays**: player, 2026-10-19, 0.5.5 (H); previously this was based only on community data [T17]. The +3 → +4 multiplier — **L/M**.
- **T-12. Astrid's Creativity (rune "+1 Crafted Modifier allowed", Limit 1) [T21].** Gives 2 crafted mods: essence + Alloy or Perfect essence. According to community recipes, the crafted mods remain after the rune is replaced [T17], **L**. Price 14–20 div [T17]. Requires an augment socket.
- **T-13. Hinekora's Lock.** See the result of several currencies without spending them, apply the best one. Any action changes the item, including activating an omen. Price — hundreds of div in a settled economy [T13]. Makes sense only before an irreversible step on an item worth more than the Lock: Vaal, Perfect Exalt on the last slot, Divine "into the window". **M**.
- **T-14. Light loop.** See 1.1. Cost of attempt N ≥ 2 = Annul + Light (5+ div [T17]) + bone (+ Echoes). **H**.
- **T-15. Sanctification (Divine + omen) on a finished item.** A value multiplier, after which the item can't be crafted; on a +4 amulet "guaranteed +5" according to one guide [T17], **L**. Only at the very end.
- **T-16. Liquid Emotions on jewels.** Replace a random mod with a mod from their set (official [T5]). Community: Contempt — crafted "+1 prefix/+1 suffix count" 50/50 → 3 suffixes on a jewel [T17], **L**.

---

## 4. Typical 0.5 chains (order and why)

General skeleton (codex [T9], recipes [T17][T18]): **base ilvl → magic with 1–2 key mods → ONE essence (magic→rare) → desecrate (side omen, sometimes don't reveal) → Exalt / Greater Exaltation (+ side) → fix (Whittling / side Annul / Light loop) → Divine → quality / sockets / runes → Vaal (opt.)**. Keep track of the mod count: essence → 3, desecrate → 4, Greater Exaltation → 6.

| Slot | Chain | Why this way | Src. |
|---|---|---|---|
| **Phys weapon (bow, spear, quarterstaff, crossbow)** | magic with high %Phys → Greater Essence of Abrasion (flat phys) → Sinistral Necromancy (+ Sovereign/Liege) + Preserved Jawbone → Greater/Perfect Exalt + Greater Exaltation on 2 suffixes → reveal → quality 20%, Artificer's, Greater Iron Runes | Damage prefixes are locked in by the essence and desecrate; suffixes — by a single double Exalt | [T17][T18] |
| Phys BIS (fractured) | fractured T1 mod / +5 proj → Annul down to the base → Chaos-spam the second key mod → desecrate prefix → Exalt suffixes → Alloy (Runebinder etc.) with a full side → Light + Ancient Jawbone + Echoes — hunting for the last prefix → Divine | Fracture removes the risk; the Light loop is the main expense | [T17] |
| **Wand / staff (spells)** | magic with +N to spell levels (Perfect Trans/Aug 70+) → Greater Essence (Sorcery / Seeking / Alacrity) → Sinistral Necromancy + Preserved Jawbone (+ lich omen, Echoes) → 2 Exalts / Greater Exaltation on suffixes (crit, cast speed) | +levels come from the base, the essence is the third mod; desecrate into a prefix for %spell/ele | [T18][T17] |
| Wand high-end | fractured +5 → Annul → sacrificial Exalt → Alloy (Transcendent/Celestial) + Crystallisation → (Astrid's for a 2nd crafted) → Mana blocker via reveal → Perfect Exalt + Greater Exaltation | Mana is the main "junk" among prefixes; the blocker removes it from the pool | [T17] |
| **Armour ES/Eva (body, helmet)** | Perfect Trans/Aug (T1 %ES / flat ES / spirit) → Greater Essence of Enhancement (or Body for life) → Dextral Exaltation + Greater Exaltation (2 resistances) → Preserved Rib (prefix) → reveal: flat ES > %ES > spirit → 2 sockets + Iron Runes | Lich armour prefixes are empty → a prefix reveal gives base mods; resistance suffixes are filled with a double Exalt | [T17][T18] |
| Armour BIS | magic T1 %ES → Rib (don't reveal) → Fracture 1/3 → Annul → Chaos-spam (Medved's rune for mana/spirit) → Sinistral + **Ancient** Rib + Echoes (flat ES) → Perfect Exalt + Greater Exaltation | Ancient is justified: only base mods land in an armour prefix | [T17] |
| **Boots (MS)** | magic with MS + resistance (cheaper on trade than rolling it) → resistance essence (or Ruin for chaos) → Dextral Necromancy + Rib (if MS is already there; otherwise Sinistral — hunting for MS) → Greater Exaltation for the rest. Alternative for MS: corrupted Essence of Hysteria (30% MS, Rare, removes a random mod → Sinistral Crystallisation, if the prefixes hold nothing valuable) | MS is a prefix; without it boots are worth almost nothing | [T17][notes] |
| **Gloves** | fractured flat dmg / +2 proj or melee → Annul → Chaos-spam → sacrificial Exalt into a suffix → Dextral Crystallisation + Essence of Hysteria (Crit Dmg) → Rib + Echoes / Light loop | The sacrificial mod + Crystallisation make the corrupted essence deterministic | [T17] |
| **Ring (attack)** | magic flat ele + resist ilvl 75+ → Greater Essence → Breach catalyst 20% → Dextral Exaltation + Catalysing + Greater Exalt (all res) → Uul-Netol 20% + Catalysing + Greater Exalt (flat phys) → Preserved Collarbone (+ Echoes) | Catalyst before each Exalt, because Catalysing consumes the quality | [T18] |
| **Amulet (+skills / spirit)** | fractured +3 skills / spirit → Annul down to 2 → Chaos-spam T1–T2 spirit → Dextral Exaltation + Exalt → Dextral Crystallisation + Perfect Enhancement (sacrifice) → catalyst 20% → Perfect Exalt + Dextral → Collarbone + Echoes + Light loop. +4 variant: Breach essence + catalyst up to ≥ 34% (T-11) | Rings and amulets are often cheaper to buy; craft only with a fractured base | [T17] |
| **Belt** | magic life + 2 charm → resistance essence → Dextral Necromancy + lich omen (cheap) + Preserved Collarbone (+ Echoes) → Exalt | Lich omen on a belt suffix — "Elemental+Chaos res" 3/4 per the recipe | [T18][T17] |
| **Jewel** | rare with 2 wanted suffixes → Liquid Emotion (+1 suffix, 50/50) → Preserved Cranium + Dextral → Echoes → remove the crafted "+1 suffix" with a side Annul → Chaos on the prefixes | Only Preserved Cranium; jewel desecrated mods are level 1 | [T17][T2] |

**Outdated (do not recommend):** 0.3/0.4 recipes with two essences (Greater + Perfect Sorcery), two desecrates on one item, Recombinator, Homogenising (league) — e.g. [T20], amulet_003 in [T17].

---

## 5. Price guidelines (cost tier; use poe.ninja live)

> **Outdated (2026-10-18):** the side omens of Annulment / Erasure and Omen of Light have become several times more expensive (Sinistral Annulment ≈ 19.6 div, Erasure ≈ 13–20 div, Light ≈ 8.8 div), Abyssal Echoes got cheaper (≈ 0.08 div), Astrid's Creativity ≈ 3.6 div. The advisor takes prices from poe.ninja live. Details and corrections — `docs/crafting-methods-research.md`.
Community snapshot for 0.5 [T17][T14][T13], very approximate:
- **Cheap (≤ 5 ex):** Preserved bones (~1 ex), Omen of Greater Exaltation (~4 ex), Putrefaction (~4 ex), Greater Exalted, Greater essences, Necromancy omens.
- **Medium (≈ 1–10 div):** Abyssal Echoes (~1 div), Perfect Exalted (~2.5 div), Sinistral/Dextral Annulment (~3.5 div per attempt), Omen of Light (5+ div), Ancient Collarbone (~7 div), Erasure omens ("a few div"), Whittling.
- **Expensive:** Astrid's Creativity (14–20 div), Fracturing Orb (atlas), Hinekora's Lock (hundreds of div).

---

## 6. Pitfalls
- Whittling with an unrevealed desecrated mod or a special essence mod hits them (§0).
- Desecrating a full item removes a random mod; Essence of the Abyss → desecrate doesn't (it replaces the Mark).
- Don't reveal the desecrated mod before a fracture; don't fracture the Mark.
- Greater/Perfect currency doesn't guarantee 50+ for families with a low ceiling (ES Recharge, accuracy, etc.).
- An omen for a side with no room — the craft won't go through; an omen that is activated but unused will trigger on the next currency (including in the Hinekora preview).
- Catalysing consumes all quality; if you need the quality bonus after it, catalyse again.
- A weak mod of the same group blocks a Perfect essence: an Exalted Orb added a low "+# to Level of all Melee / Projectile Skills" — Perfect Essence of Battle can no longer be applied (Mobalytics [crossbow-craft](https://mobalytics.gg/poe-2/guides/crossbow-craft), [talisman-craft](https://mobalytics.gg/poe-2/guides/talisman-craft); pre-0.5 guides, the mod group mechanics are the same) — **M**.
- Temporary recipes from guides often violate "1 crafted + 1 desecrated" (Timesaver mixes up bones by slot [T14]; [T17] has recipes with two desecrates) — check against the 0.5 rules.

---

## 7. What the advisor should model next (by priority)

1. **Choosing how to remove a bad mod** (changes the plan most often). Candidates and their P / price:
   - side Annul: P = 1/n_side (removable mods on the side; fractured ones don't count; crafted and desecrated do); if n_side = 1 — guaranteed;
   - Chaos + Whittling: P = 1 if the mod is strictly the minimum by `required_level` among the removable ones (unrevealed desecrated — lvl 1, special essence mods — 0–1); then a new mod by weights (like an Exalt with the currency's min. level);
   - Chaos + Erasure: 1/n_side for the removal + a random new mod;
   - Light + Annul (desecrated mod): P = 1;
   - Perfect essence + Crystallisation (if the crafted slot is free and the essence mod is wanted): 1/n_side.
   Pick the minimum of `(currency price + omens) / P` plus the expected cost of a miss (lost mod × price).
2. **Desecrate (reveal) evaluation.** Inputs: class, ilvl, side (omen or 50/50), lich omen (pool of the lich's exclusives for the class and side), bone (Ancient → base mods ≥ 40), mod groups on the item (exclude). Probability that the set contains the target: q ≈ 1 − (1 − s)³, where s is the target's share of weight in the pool. More precisely — sampling without replacement or Monte Carlo. If there are no weights, use equal ones. With Echoes: Q = 1 − (1 − q)². Light loop: E[attempts] = 1/Q, price = bone + (Light + Annul) × (E − 1) + Echoes × E. Show a "guarantee" if there are ≤ 3 matching mods.
3. **Enumeration with two mods per Exalt.** Greater Exaltation (+ side, + Perfect): two sequential draws without replacement by weight with group exclusion; account for the exception for families below the threshold (§0).
4. **Fracture branch.** If the item has a key mod and ≥ 3 mods in total: P = 1/k, where k is the regular (non-desecrated) mods; total mods must be ≥ 4, desecrated ones count toward that. The "3 regular + 1 unrevealed" trick → 1/3 instead of 1/4. Cost of a miss = a new base. Then the expected number of Chaos to the second key mod = 1 / p_mod (p_mod — the weight share after removal).
5. **Slot accounting: "1 crafted + 1 desecrated" and ways to free slots.** Essence of the Abyss → desecrate frees the crafted slot. Whittling or a side Annul removes a crafted mod. Astrid's gives +1 crafted. The planner must decide what takes the crafted slot: a Greater essence for magic→rare, a Perfect/corrupted essence or an Alloy.
6. **Side without an omen.** If one side is full (including due to an unrevealed desecrated mod), a regular Exalt picks the other one by itself. Recommend this instead of buying a side omen.
7. **Blockers.** If the target has a high risk of a "junk" group (Mana on a wand, Accuracy on a bow), compare EV with a blocker (a mod of the group, then its removal) and without: a blocker pays off when Δp × the Perfect slam price exceeds the cost of removing the blocker.
8. **Jewellery quality.** Recalculate the values of mods with the catalyst tag (+3 → +4 at ≥ 34%) and account for Catalysing (weight ×?; the ×5 at 20% estimate — mark as imprecise).
9. **Hinekora's Lock** — only as "insurance" before an irreversible step: recommend it if `item price × P(failure) > Lock price`.
10. **Putrefaction** for cheap quivers and armour (EV over 6 reveals) — a separate "slot machine" mode.

---

## 8. Sources
- [T1] poe2db, Omen (0.5 texts) — https://poe2db.tw/us/Omen
- [T2] poe2db, Desecrated Modifiers (0.5: "may include base modifiers", 198 lich mods, all lvl 65; no prefixes on armour; sceptres without exclusives) — https://poe2db.tw/us/Desecrated_Modifiers
- [T3] poe2db, Essence / Essence of the Abyss — https://poe2db.tw/us/Essence ; https://poe2db.tw/us/Essence_of_the_Abyss
- [T4] poe2db, Hinekora's Lock — https://poe2db.tw/us/Hinekoras_Lock
- [T5] Official 0.5.0 patch notes (Liquid Emotions, Homogenising only in Standard, "Up to 3" for Chaotic omens) — https://www.pathofexile.com/forum/view-thread/3932540
- [T6] PoE forum: "Omen of Greater Exaltation with Perfect Exalted Orb does not guarantee 2 ilvl 50+ mods?" (09.2025) — https://www.pathofexile.com/forum/view-thread/3851632
- [T7] PoE forum: "Omen of Catalysing Exaltation bugged or just unlucky?" (09.2025) — https://www.pathofexile.com/forum/view-thread/3849100
- [T8] poe2wiki (search snippets only): Omen of Whittling (unrevealed desecrated = level-1 mod) — https://poe2wiki.net/wiki/Omen_of_Whittling ; Omen (omen stacking, invalid combos block the craft) — https://www.poe2wiki.net/wiki/Omen ; Perfect/Greater Exalted ("at least one tier of each mod will always be eligible") — https://www.poe2wiki.net/wiki/Perfect_Exalted_Orb
- [T9] PoE2 Crafting Codex (domistae, 0.5.x; the author calls it "provisional") — https://domistae.github.io/poe2-leveling/poe2_crafting_codex.html
- [T10] Sift, Desecration (Craft of Exile, community tests; partly outdated — "3→6") — https://isayi9999.github.io/sift-public/crafting/desecration
- [T11] PoE2Craft, Abyss & Well of Souls (0.5.4; error: "repeat for second desecrated mod") — https://poe2craft.com/guides/abyss-well-of-souls
- [T12] Timesaver, Fracturing Orb guide (0.5.4, 02.07/24.08.2026) — https://timesaver.gg/blog/poe2-fracturing-orb-guide
- [T13] Timesaver, Hinekora's Lock guide (0.5.4) — https://timesaver.gg/blog/poe2-hinekoras-lock-guide
- [T14] Timesaver, 0.5 Crafting Guide and Omens guide (commercial, contain errors: Vertebrae "body armour", Cranium "helmets", Sanctification "+ Vaal") — https://timesaver.gg/blog/poe2-0-5-crafting-guide ; https://timesaver.gg/blog/poe2-omens-guide
- [T15] POE2FUN, Essence of the Abyss secrets (date not stated) — https://poe2fun.com/guides/secret-in-essence-of-the-abyssal
- [T16] vaal.tools, Desecrated modifiers (0.5.5d) — https://www.vaal.tools/mechanics/desecrated_modifiers/
- [T17] fixerpimp-gamer, "PoE2 Crafting DB — 0.5 Return of the Ancients" (49–55 community recipes, uneven quality) — https://github.com/fixerpimp-gamer/POE2_0.5_Craft_Guides
- [T18] Exile Codex — summaries of 0.5/0.5.5 videos: ASaVeQ "simple crafts" (05.09.2026), lilbotq "ring craft" (31.08.2026), Barczi "ES crafting" (06.06.2026) — https://exile.codex-wiki.com/guides/how-i-make-currency-early-with-simple-crafts-poe2-0-5-5 ; https://exile.codex-wiki.com/guides/how-to-get-rich-with-this-early-league-ring-craft-path-of ; https://exile.codex-wiki.com/guides/easy-energy-shield-crafting-for-profit-poe-2-0-5
- [T19] Maxroll (search snippets only): How to Craft in PoE2; Flameblast Gemling and Hollow Form guides (Erasure + Whittling + Perfect Chaos) — https://maxroll.gg/poe2/resources/how-to-craft-in-path-of-exile-2 ; https://maxroll.gg/poe2/build-guides/flameblast-oil-grenade-gemling-build-guide ; https://maxroll.gg/poe2/build-guides/hollow-form-whirling-assault-martial-artist-build-guide
- [T20] POE2FUN, Staff guide 0.4.0 (example of an outdated chain with two essences and two desecrates) — https://poe2fun.com/guides/poe2-staff-crafting-guide
- [T21] poe2db, Astrid's Creativity — https://poe2db.tw/us/Astrids_Creativity
