# PoE 2 — market and demand (for price estimation)

- **Relevant for:** 0.5.5, Forbidden Rites league. **Compiled:** 2026-10-18.
- **Source:** Mobalytics guides (agent search, paraphrased; dates as given on the site). Almost everything here is **M/L** (community):
  check on trade and poe.ninja before building it into the code. Confidence labels — see [README](README.md).
- **Not used by the code yet** — these are ideas for price estimation and the craft advisor (section 6).

Link shorthand: G = `https://mobalytics.gg/poe-2/guides/`.

## 1. What is expensive besides rare gear

**White (Normal) bases** — G`negative-rarity-farming` (upd. 2026-05-27, a 0.4-era strategy), **L**:
- Top bases ilvl 80–82 — blanks for Perfect currency; Exceptional bases (an extra socket or quality above 20%) —
  "hundreds of Divine" for the best ones.
- Staves and wands with skill level 20 (Grants Skill) — "several Divine".
- Level 20 skill gems, level 19–20 Spirit gems; high-level Charms — blanks for Perfect Transmute/Augment.
- Drop level: normal and magic monsters — zone level, rares +1, uniques +2.
- How they are priced: via poe.ninja — which bases are worn, then trade for normal uncorrupted bases with ilvl 80 / 81 / 82.

**Non-gear** — G`atlas-rushing-farming-strategy` (2026-09-05), **L**:
- Head of the King — usually more than 1 div; Breachlord Sacs (guaranteed drop).
- Lineage supports Rakiata's Flow, Garukhan's Resolve — "very expensive".
- The Taming from Berek's Grip + Berek's Pass + Berek's Respite sells for noticeably more than the three rings separately.
- Immured Fury — a guaranteed Fracturing Orb; Arbiter of Divinity fragments — "several div", most expensive at league start.
- Jewels Ingenuity, From Nothing.

**A "ladder" for storing value:** Abyssal Echoes → Whittling / Omen of Light → Hinekora's Lock → Mirror; the community prices expensive
items in Mirrors — G`league-start-gearing-guide` (upd. 2026-10-01), **L**.

## 2. Item level thresholds (for crafting and pricing bases)

- **Boots** — G`league-start-gearing-guide`, **M** (consistent with RePoE: check by tiers):
  useful thresholds — **71** (T2 resistances) and **82** (T1 Movement Speed + T1 resistances). At 72, 74, 75 "junk" tiers are added
  (Stun Threshold, Int, Stun hybrid, Reduced Ailment Duration) — an ilvl 71 base gives better chances of
  "MS + 3 resistances" than 72–81.
- **Waystones and unlocks** (same guide): T1 (zone 65) — 30% MS, +2 to minions / melee, crit, attack speed;
  T7 (71) — resistances up to 40%; T11 (75) — +3 to skills, the best flat damage, T1 flat physical.
- "+2 Melee Skills" on gloves and "+2 Minion Skills" on a helmet can appear as early as ilvl 41 — G`ssf-crafting` (2026-06-24), **L**.

## 3. Demand: 0.5.5 builds

**Starter tier list** (`https://mobalytics.gg/poe-2/tier-list`, upd. 2026-07-30), **L** (editorial opinion):
S — Deadeye, Infernalist, Martial Artist, Spirit Walker, Tactician, Gemling; A — Amazon, Blood Mage, Disciple of Varashta,
Lich, Oracle, Shaman, Titan; B — Pathfinder, Stormweaver, Witchhunter, Acolyte, Invoker; C — Chronomancer;
D — Ritualist, Smith, Warbringer.

**What popular 0.5.5 builds wear** (build pages, September–October 2026), **M** — consistent with what the program already
takes from poe.ninja:
- boots: 30–35% Movement Speed + three resistances (35% — only ilvl 82+);
- amulets: +3 / +4 to skill levels together with Spirit;
- farming builds: Item Rarity on all slots;
- armour builds: "+X% of Armour also applies to Elemental Damage";
- caster staves: +7 / +8 to elemental spell levels, "Explicit <element> Modifier magnitudes" (rune);
- "key" uniques: Headhunter, Mageblood, Kalandra's Touch.

**Minions — order of value** (G`minion-summoner-gear-and-invest-priority-guide-mattjestic`, 2026-05-28), **M**:
minion levels → Spirit → reservation reduction (pays off only after 200–300 Spirit). Sources of levels: sceptre up to +4,
amulet +3, helmet +2 (+1 from corruption). Slot order by investment: weapon > amulet / body > helmet / rings / boots.
Already in the program: Puppet Master and Command Skills — the minion niche (`pricing.js`).

## 4. Tablets

G`towers-and-tablets` (2026-07-21), **M**:
- Tablet slots of a waystone: 0–2 mods → 1, 3–5 → 2, 6+ → 3; the City biome with Industrial Improvements — 4.
- Tablets are Magic only until the atlas passives Reverse Transcription / Partial Translation are taken.
- Three tablets of the same type disable the other content on the map.
- Unique tablets: Visions of Paradise, Mastered Domain, Unforeseen Consequences, etc.
- Ancient Infuser on a tablet: destroys it, an extra mod over the limit, +10 uses, or a type change with a reroll
  (G`vaal-currency`, 2026-07-21).

## 5. League mechanics the program does not parse

- **Sacred Bloom / Viridian Wildwood** — G`how-to-viridian-wildwood-sacred-bloom` (2026-09-19), G`0-5-5-content-summary`
  (2026-08-28), **M**: Wild / Vivid / Primal / Sacred wisps (Sacred adds map bosses to rare packs), altars with omens.
- **Trial of Chaos 0.5.5** — G`trial-of-chaos` (2026-09-23), **M**: up to 30 rooms, rewards — only currency and Soul Cores, wagers
  (Future doubles the stack of the next currency rewards, Present — of the current ones).
- **Runeforged** — items "Runeforged <name>", cannot be repeated; on The Brass Dome all armour becomes Runic Ward
  (G`runic-ward`, 2026-06-22).
- **Runeseeker's Call** (unique wand): 5 augment sockets with 200% rune effect, corruption can add a 6th (G`runeseekers-call`).

## 6. Ideas for the program

| Idea | Basis |
|---|---|
| ~~Pricing white bases by ilvl steps~~ — done in 0.3.139: ilvl is searched from the level of the last unlocked tier up to the next one (`craft.ilvlBand`) | §1 |
| ~~"Lucky ilvl" hint~~ — done in 0.3.152, for any white / magic base: above the last tier of mods that builds need — only tiers of unneeded ones (`craft.js` `ilvlHint`) | §2 |
| Tablet helper: slots from the waystone's mod count, Magic/Rare, uniques. Done in 0.3.139: search by "Uses Remaining", ilvl turned off, Craft honestly says "no advice". Live texts — `test/fixtures/tablet-*.txt` (0.3.149–150: "N uses remaining" is an implicit line, stats "(Gold Piles)", "an additional Rare Chest") | §4 |
| ~~Price in Mirrors~~ — already there: from half a mirror, "≈ N mirror" under the price (`price.js` `alt`); Hinekora's Lock — not done | §1 |
| ~~Check how Head of the King, lineage supports, Arbiter fragments are priced~~ — by name from poe.ninja prices (Ritual, LineageSupportGems, Fragments: `pricing.js` `ninjaRow`), verified 2026-10-19 on texts written from memory; The Taming is a regular unique. The Taming recipe (three Berek rings cheaper than The Taming) — not done | §1 |
| Runeforged items and Runeseeker's Call sockets | §5 |
| Demand from Mobalytics builds in addition to poe.ninja — **do not do**: the site has no open API (only an internal one, closed off by bot protection) | — |
