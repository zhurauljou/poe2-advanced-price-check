// Craft plan cost model — shared by the window (<script> before the window parts) and by tests / simulation (require).
// create(ctx): ctx() → { prices: { currency: div }, goalValue: goal price | null | undefined, est: item price now }.
// Everything about choosing a step's method: Exalted / Greater / Perfect (with omens), Desecrate, essences and Alloys (crafted slot),
// Omen of Greater Exaltation (pairs), removing extras with Annulments, accounting for wanted mods hit along the way.
(function (root) {
  function create(C) {
    let restoreCost = null; // price of "restoring a wanted mod that got hit" (median of the plan's additions) — computed by expandPlan
  // Step cost: compare the options (with and without a side omen) and take the cheaper one on average.
  function stepCost(s) {
    const p = (n) => C().prices[n];
    const sum = (list) => list.reduce((a, n) => (a == null || p(n) == null ? null : a + p(n)), 0);
    if (s.act === 'remove' && s.targeted) return { cost: sum(s.currencies), chance: 1, currencies: s.currencies };
    if (s.act === 'remove') return removeCost(s);
    if (s.act === 'add') return addCost(s, 1);
    if (s.act === 'replace') return chaosLoop(s.rem, s.add) || addCost(s.add, 1);
    if (s.act === 'add2') {
      // Omen of Greater Exaltation: one Exalted — two mods; each roll costs half (Exalted + omens).
      const g = addCost(s.steps[0], 2, s.steps[1]);
      const des = s.steps.find((x) => x.useDes);
      return { ...g, two: true, desAlt: des ? addCost(des, 1).desAlt.map((o) => ({ ...o, mod: des.mod })) : [] };
    }
    if (s.act === 'regal') {
      // oneTier (jewels): only the plain Regal Orb — Greater / Perfect cut nothing there.
      const opts = M.tiers('regal').slice(0, s.oneTier ? 1 : undefined).filter(([n]) => p(n) != null).map(([n, lv]) => ({ orb: n, level: lv, cost: p(n) }));
      // Greater / Perfect cut off the random mod's low tiers; if they cost next to nothing (≤ 0.1 div or ≤ 3× the regular) — best by default.
      const cheapest = opts[0] ? opts[0].cost : 0;
      const pick = [...opts].reverse().find((o) => o.cost <= Math.max(0.1, cheapest * 3)) || opts[0] || { orb: 'Regal Orb', cost: p('Regal Orb') };
      return { cost: pick.cost, chance: 1, currencies: [pick.orb], regal: opts.filter((o) => o !== pick) };
    }
    const cost = sum(s.currencies);
    return { cost, chance: 1, currencies: s.currencies };
  }

  // Add a mod: try Exalted / Greater / Perfect (with and without a side omen) and take the cheapest on average.
  // Chance — hitting the wanted family in a goal tier (src/main/tiers.js); a miss is removed with Annulment. rolls = 2 — with Omen of Greater Exaltation
  // (then s2 is the pair's second mod). Chance unknown (valuable mod) — pick by guess (all families equally likely), no price shown.
  const M = typeof module !== 'undefined' && module.exports ? require('./methods') : root.CraftMethods;
  const EXALT_NAME = Object.fromEntries(M.tiers('exalt').map(([n], i) => [['base', 'greater', 'perfect'][i], n]));
  // Remove J extra mods while K wanted ones sit next to them (Annulment takes a random one of what is left): expected J + K·J/(J+1)
  // attempts, of which K·J/(J+1) hit a wanted mod — it has to be added again afterwards (restoreCost — the price of one such addition).
  // Hitting another extra mod is not a miss but progress. Compare: Annulment over the whole item or with a side omen.
  // Cost of losing a wanted mod: re-adding it, but no less than a quarter of the goal price — without a key mod the item is worth almost nothing.
  // Losing a key mod — a quarter of the item price (without it the item is worth much less); if there are no prices — re-adding it.
  // The loss can't cost more than the mod's share of the item price: an expensive "add again" is no reason to pay more than the item.
  const valueShare = () => Math.max(C().goalValue ? C().goalValue / 4 : 0, C().est ? C().est / 4 : 0);
  const restoreValue = () => valueShare() || (restoreCost ?? (C().prices['Orb of Annulment'] ?? 0) * 10);
  // Average loss from an essence / Alloy miss on a side: a random one of the onSide wanted mods and the sacrifice is removed.
  function essenceLoss(s) {
    const n = (s.onSide || 0) + 1;
    const k = Math.min((s.atRisk || []).length, n - 1);
    const minor = Math.min(restoreCost ?? (C().prices['Orb of Annulment'] ?? 0) * 10, valueShare() ? valueShare() / 2 : Infinity);
    return (k * restoreValue() + (n - 1 - k) * minor) / n;
  }
  function removeCost(s) {
    const p = (n) => C().prices[n];
    const ann = p('Orb of Annulment');
    if (ann == null) return { cost: null, chance: null, currencies: ['Orb of Annulment'], lottery: true };
    // Annulment removes the side's mods in a random order until the last junk one is gone; a hit wanted mod is restored after
    // that, not in between (the side shrinks: 1 in 3, then 1 in 2…). Wanted ones removed before the last of J junk: K·J/(J+1).
    // S spare junk (craft.js planGoal): any J of the J + S junk will do — wanted ones removed before that: K·J/(J+S+1).
    const run = (J, K, S = 0) => { const hits = J ? (K * J) / (J + S + 1) : 0; return { tries: J + hits, hits }; };
    // A wanted mod that got hit: restoring it costs as much as adding it, but no less than a quarter of the goal price — without a key mod
    // the item is worth almost nothing.
    const restore = restoreValue();
    // Average price of "restoring a hit mod" over the side's wanted mods: crafted — its essence / Alloy, the rest — restoreValue.
    const crystal = (side) => `Omen of ${side === 'prefix' ? 'Sinistral' : 'Dextral'} Crystallisation`;
    // A key mod that one Exalted Orb + the side's Exaltation omen gives back with chance `again`. Every miss is another mod
    // that has to come off again (Annulment + the side's Annulment omen) — «1 in 30» is 29 removals, not 30 cheap Exalts.
    // Capped by the key-mod loss (Spirit — a few Exalts; +levels — the cap: losing them costs the item its value).
    const againCost = (r) => {
      const S = r.side === 'prefix' ? 'Sinistral' : 'Dextral';
      const per = p('Exalted Orb') != null && p(`Omen of ${S} Exaltation`) != null ? p('Exalted Orb') + p(`Omen of ${S} Exaltation`) : null;
      if (per == null) return restore;
      const miss = (p('Orb of Annulment') ?? 0) + (p(`Omen of ${S} Annulment`) ?? 0);
      return Math.min(restore, (per + (1 - r.again) * miss) / r.again);
    };
    const sideRestore = (x) => {
      const list = (x.restore || []).length ? x.restore : [null];
      // secondary mod — re-adding it, but no more than half of the key mod's share
      const minor = Math.min(restoreCost ?? (p('Orb of Annulment') ?? 0) * 10, valueShare() ? valueShare() / 2 : Infinity);
      return list.reduce((a, n) => a + (n === 'minor' ? minor : n && n.again ? againCost(n) : n && p(n) != null ? p(n) : restore), 0) / list.length;
    };
    // The desecrated junk in the run (craft.js planGoal): an Annulment removes it on the way with chance J/(J+1) — one
    // more attempt; otherwise it is the last junk left and Orb of Annulment + Omen of Light removes it.
    const light = (p('Omen of Light') ?? 0) + ann;
    const desPart = (J, per) => {
      if (!s.des) return { tries: 0, spent: 0, left: 0 };
      const gone = J / (J + 1);
      return { tries: gone, spent: gone * per + (1 - gone) * light, left: 1 - gone };
    };
    const opts = [];
    const sides = Object.values(s.sides);
    const allJ = sides.reduce((a, x) => a + x.J, 0);
    const all = run(allJ, sides.reduce((a, x) => a + x.K, 0), sides.reduce((a, x) => a + (x.S || 0), 0));
    const allK = sides.reduce((a, x) => a + x.K, 0) || 1;
    const allRestore = sides.reduce((a, x) => a + sideRestore(x) * x.K, 0) / allK;
    const allDes = desPart(allJ, ann);
    opts.push({ currencies: ['Orb of Annulment'], tries: all.tries + allDes.tries, hits: all.hits, desLeft: allDes.left,
      cost: all.tries * ann + allDes.spent + all.hits * allRestore, spent: all.tries * ann + allDes.spent });
    if (sides.every((x) => !x.J || p(x.omen) != null)) {
      let tries = 0, hits = 0, spent = 0, lost = 0;
      let desLeft = 0;
      for (const x of sides) {
        if (x.des) { const dp = desPart(x.J, ann + (x.J ? p(x.omen) : 0)); tries += dp.tries; spent += dp.spent; desLeft = dp.left; }
        if (!x.J) continue;
        const r = run(x.J, x.K, x.S);
        tries += r.tries; hits += r.hits; spent += r.tries * (ann + p(x.omen)); lost += r.hits * sideRestore(x);
      }
      opts.push({ currencies: ['Orb of Annulment', ...sides.filter((x) => x.J).map((x) => x.omen)], tries, hits, spent, cost: spent + lost, desLeft });
    }
    // The first attempt to remove an extra mod on this side was already made by Desecrate (desFirst) — not needed.
    const merged = s.desMerge || s.essMerge;
    if (merged) {
      const x = s.sides[merged.side];
      for (const o of opts) {
        const one = ann + (o.currencies.includes(x.omen) ? p(x.omen) : 0);
        o.tries -= 1; o.spent -= one; o.cost -= one;
      }
    }
    // Essence of the Abyss + side Crystallisation removes a random mod on that side (like Annulment with an omen — same
    // attempts and hit wanted mods) and adds Mark of the Abyssal Lord; Mark is desecrated, Omen of Light +
    // Annulment removes it right away (player, 2026-10-19). A full option: chosen if it's the cheapest of all.
    let abyss = null;
    const sideJ = Object.entries(s.sides || {}).filter(([, x]) => x.J);
    if (s.abyss && p('Essence of the Abyss') != null && p('Omen of Light') != null && sideJ.length && sideJ.every(([side]) => p(crystal(side)) != null)) {
      let tries = 0, hits = 0, spent = 0, lost = 0;
      for (const [side, x] of sideJ) {
        const per = p('Essence of the Abyss') + p(crystal(side)) + p('Omen of Light') + ann;
        const r = run(x.J, x.K, x.S);
        const n = r.tries - (merged && merged.side === side ? 1 : 0);
        tries += n; hits += r.hits; spent += n * per; lost += r.hits * sideRestore(x);
      }
      abyss = { currencies: ['Essence of the Abyss', ...sideJ.map(([side]) => crystal(side)), 'Omen of Light', 'Orb of Annulment'],
        tries, hits, spent, cost: spent + lost };
      opts.push(abyss);
    }
    opts.sort((a, b) => a.cost - b.cost);
    const best = opts[0];
    const chaos = M.tiers('chaos').filter(([n]) => p(n) != null);
    const wh = s.whittle && p('Omen of Whittling') != null
      ? chaos.map(([n, lv]) => ({ orb: n, level: lv, cost: p(n) + p('Omen of Whittling') })) : [];
    const erasure = [];
    for (const [side, x] of Object.entries(s.sides || {})) {
      const omen = `Omen of ${side === 'prefix' ? 'Sinistral' : 'Dextral'} Erasure`;
      if (!x.J || p(omen) == null || !chaos.length) continue;
      const [n] = chaos[0];
      erasure.push({ side, orb: n, omen, chance: (x.J + (x.S || 0)) / (x.J + (x.S || 0) + x.K), cost: p(n) + p(omen) });
    }
    return { cost: best.cost, spent: best.spent, tries: best.tries, hits: best.hits, currencies: best.currencies,
      chance: best.hits > 0.05 ? 0.5 : 1, risky: best.hits > 0.05, whittle: wh.length ? wh : null, erasure,
      viaAbyss: best === abyss, abyss: abyss && abyss !== best ? abyss : null, other: opts.find((o) => o !== best && o !== abyss) || null, desMerge: s.desMerge || null, essMerge: s.essMerge || null,
      des: s.des ? { mod: s.des.mod, left: best.desLeft || 0, cost: light } : null };
  }

  // Average cost until success, given how the miss is removed: per — attempt price, pc — chance,
  // removal — [{ a: removal price, q: chance to hit a wanted mod }]. A wanted mod that got hit must be added again (≈ the same
  // cost E): E = (per + (1−pc)·a) / (pc − (1−pc)·q). Denominator ≤ 0 — the path is hopeless (Infinity).
  function tries(per, pc, removal) {
    return bestRemoval(per, pc, removal).cost;
  }
  // Same, but with the chosen miss-removal method ({ a, q }) — for the simulation.
  function bestRemoval(per, pc, removal) {
    let best = { cost: Infinity, a: 0, q: 0 };
    for (const { a, q } of removal) {
      const den = pc - (1 - pc) * q;
      if (den > 0) { const cost = (per + (1 - pc) * a) / den; if (cost < best.cost) best = { cost, a, q }; }
    }
    return best;
  }
  // How to remove an Exalted miss: Annulment with a side omen (1 of the side's mods) or without (1 of all mods).
  // By this point the other mods are wanted (extras were removed earlier): hitting them is a loss.
  function exaltRemoval(s) {
    const p = (n) => C().prices[n];
    const ann = p('Orb of Annulment') ?? 0;
    const out = [{ a: ann, q: (s.onItem || 0) / ((s.onItem || 0) + 1) }];
    if (p(s.annulOmen) != null) out.push({ a: ann + p(s.annulOmen), q: (s.onSide || 0) / ((s.onSide || 0) + 1) });
    return out;
  }
  function addCost(s, rolls, s2) {
    const p = (n) => C().prices[n];
    const removal = exaltRemoval(s);
    const lottery = [s, s2].some((x) => x && Object.values(x.desecrateOnly ? x.desecrate || {} : x.exalt).every((o) => o.chance == null));
    const opts = [];
    for (const k of s.craftedOnly || s.desecrateOnly ? [] : Object.keys(EXALT_NAME)) {
      const os = [s, s2].filter(Boolean).map((x) => x.exalt[k]);
      if (os.some((o) => !o) || p(EXALT_NAME[k]) == null) continue;
      // There is room on the other side — the side omen is required: otherwise the mod may take a slot the plan's next step needs.
      for (const omen of s.sideOmen ? [true] : [false]) {
        if (rolls === 2 && s.otherOpen && !omen) continue; // two mods on one side — only with a side omen
        const cur = [EXALT_NAME[k], ...(rolls === 2 ? ['Omen of Greater Exaltation'] : []), ...(omen ? [s.sideOmen] : [])];
        if (cur.some((n) => p(n) == null)) continue;
        const per = cur.reduce((a, n) => a + p(n), 0) / rolls;
        // Odds unknown (lottery): the rough frequency estimate beats a uniform guess (a rare mod is not as likely as a common one).
        const odds = (o) => { const c = lottery ? (o.rough ?? o.guess) : o.chance; return s.otherOpen && !omen ? c / 2 : c; };
        const cost = os.reduce((a, o) => a + tries(per, odds(o), removal), 0);
        const rem = bestRemoval(per, odds(os[0]), removal);
        opts.push({ k, currencies: cur, chances: os.map((o) => (lottery ? null : odds(o))), pool: os[0].pool, cost, per: per * rolls, slam: per / odds(os[0]), p: os.reduce((a, o) => a * odds(o), 1), ps: os.map(odds), rem });
      }
    }
    // Desecrate (only for the step the window gave it to: one desecration per item). Bone + Necromancy on a side
    // (if the other side has room); on reveal — best of 3 options (6 with Omen of Abyssal Echoes).
    // Miss — remove the desecrated mod precisely: Orb of Annulment + Omen of Light.
    // Perfect/corrupted essence (crafted slot): a sacrificial mod via Exalted on this side → side Omen of Crystallisation
    // + essence: removes a random mod on the side (the sacrifice — if there are no other removable ones there) and adds its own mod.
    if (rolls === 1 && (s.useCrafted || s.craftedOnly) && s.crafted && s.cross) {
      // The other side's Crystallisation (crossFirst): the essence removes a random mod there — one attempt of the removal
      // run that follows, priced in that step — and adds its own mod into the free slot of its side. No sacrifice, no risk here.
      for (const name of s.crafted || []) {
        const cur = [name, s.cross.omen];
        if (cur.some((n) => p(n) == null)) continue;
        const per = cur.reduce((a, n) => a + p(n), 0);
        const low = s.essTier && s.essTier[name] && s.bestTier ? Math.max(0, s.essTier[name].tier - s.bestTier) : 0;
        opts.push({ k: 'essence', essence: name, low, currencies: cur, chances: [1], pool: 0, cost: per + Math.min(low * 0.1, 0.5) * valueShare(), per, slam: per, p: 1, ps: [1], cross: s.cross });
      }
    } else if (rolls === 1 && (s.useCrafted || s.craftedOnly) && s.crafted) {
      const P = 1 / ((s.onSide || 0) + 1);
      for (const name of s.crafted || []) {
        const cur = [name, s.crystal, 'Exalted Orb', ...(s.sideOmen ? [s.sideOmen] : [])];
        if (cur.some((n) => p(n) == null)) continue;
        const per = cur.reduce((a, n) => a + p(n), 0);
        // Miss: the essence removed a wanted mod (the essence mod still landed) — restore it and remove the sacrifice. A key mod
        // of the item (atRisk: it was there before crafting) is expensive to restore — restoreValue; one added by the plan — re-adding it.
        // So the essence is better used when the side already has cheap wanted mods: a miss will hit them more often.
        // A fixed essence value below the best tier the item can roll (Hysteria 30% Movement Speed vs 35% T1 on ilvl 82+ boots):
        // the finished item is worth less — a rough loss of a tenth of the mod's price share per tier.
        const low = s.essTier && s.essTier[name] && s.bestTier ? Math.max(0, s.essTier[name].tier - s.bestTier) : 0;
        const cost = per + essenceLoss(s) + (1 - P) * (p('Orb of Annulment') ?? 0) + Math.min(low * 0.1, 0.5) * valueShare();
        opts.push({ k: 'essence', essence: name, low, currencies: cur, chances: [P], pool: 0, cost, per, slam: per / P, p: P, ps: [P] });
      }
    }
    if (rolls === 1 && (s.useDes || s.desecrateOnly) && s.desecrate) {
      const desRetry = (p('Orb of Annulment') ?? 0) + (p('Omen of Light') ?? 0);
      for (const [bone, o] of Object.entries(s.desecrate)) {
        for (const echo of [false, true]) {
          const boneName = bone.split('|')[0]; // key "bone|lich omen"
          const cur = [boneName, ...(o.extra || []), ...(s.necro ? [s.necro] : []), ...(echo ? ['Omen of Abyssal Echoes'] : [])];
          if (cur.some((n) => p(n) == null)) continue;
          const one = lottery ? (o.rough ?? o.guess) : o.chance;
          // Matching mods on the side ≤ 3 — the wanted one is guaranteed among the options (only the tier remains).
          // Within a triple the options don't repeat (drawn without replacement), and an Abyssal Echoes reroll is a new independent triple:
          // triple chance 1 − Π (1 − g / (N − i)), g = one·N "matching" of N families; with Echoes — two triples.
          const three = o.pool > 3 ? 1 - [0, 1, 2].reduce((a, i) => a * Math.max(0, 1 - (one * o.pool) / (o.pool - i)), 1) : null;
          const pc = o.pool <= 3 ? o.good : three != null ? 1 - Math.pow(1 - three, echo ? 2 : 1) : 1 - Math.pow(1 - one, echo ? 6 : 3);
          const per = cur.reduce((a, n) => a + p(n), 0);
          opts.push({ k: 'desecrate', bone: boneName, lich: o.lich || null, echo, currencies: cur, chances: [lottery ? null : pc], pool: o.pool, cost: tries(per, pc, [{ a: desRetry, q: 0 }]), per, slam: per / pc, p: pc, ps: [pc], rem: { a: desRetry, q: 0 }, desAvg: !!o.desAvg });
        }
      }
    }
    if (!opts.length) return { cost: null, chance: null, currencies: ['Exalted Orb'], lottery: true };
    // No "until success" method converges — so it's a single attempt (slam), the miss stays on the item: take the method
    // with the best "chance per attempt price".
    // Single attempt (until-success doesn't converge) on an item with a known gain: a miss is a ruined item, not the orb's price.
    // Then choose by the attempt's gain: chance × (goal price − price now) − attempt price (Perfect Exalted on an expensive item).
    // "Until success" costs more than the goal itself — nobody crafts like that: it's a single attempt (the miss stays on the item).
    // No goal price yet (or none found): caution, not optimism — «until success» far above what the item is worth now
    // counts as a single attempt (2,842 div of Omen of Light retries on a 5 ex focus), until the goal is priced.
    const cap = C().goalValue ? C().goalValue : C().est != null ? Math.max(10, 50 * C().est) : null;
    if (cap != null) for (const o of opts) if (o.cost > cap) o.cost = Infinity;
    const gain = C().goalValue != null && C().est != null ? Math.max(0, C().goalValue - C().est) : 0;
    if (gain && opts.every((o) => !Number.isFinite(o.cost))) opts.sort((a, b) => (b.p * gain - b.per) - (a.p * gain - a.per));
    else opts.sort((a, b) => a.cost - b.cost || a.slam - b.slam);
    const best = opts[0];
    // Other methods — for comparison (one best option of each).
    const kind = (o) => (o.k === 'desecrate' ? o.bone : o.k);
    const alts = opts.filter((o, i) => kind(o) !== kind(best) && opts.findIndex((x) => kind(x) === kind(o)) === i);
    const desAlt = alts.filter((o) => (o.k === 'desecrate' || o.k === 'essence') && o.k !== best.k);
    // No method converges: a miss removes a wanted mod more often than an extra one.
    const hopeless = !Number.isFinite(best.cost);
    // An essence adds the mod for sure — its price is known even if the Exalted chance for this mod is unknown.
    const lot = lottery && best.k !== 'essence';
    return { hopeless, perTry: best.per, ps: best.ps, rem: best.rem, cost: lot || hopeless ? null : best.cost, score: best.cost, chance: best.chances[0], chances: best.chances, currencies: best.currencies,
      lottery: lot, pool: best.pool, k: best.k, echo: best.echo, bone: best.bone, lich: best.lich, low: best.low || 0, cross: best.cross || null, desAvg: !!best.desAvg, alts: lottery ? [] : alts, desAlt };
  }

  // add2: if two separate Exalteds come out cheaper — expand it back into two steps.
  // Chaos Orb removes a random modifier and adds a random one (docs/crafting-notes.md §2): on a side with one unwanted mod
  // it is «Annulment + Exalted» in one orb. Repeated until it removes the unwanted mod and the new mod is the wanted one;
  // on a full item the new mod goes to the freed side, otherwise to either (≈ half the time to this one).
  // Options: plain Chaos (any mod of the item can go), + side Erasure omen (only this side), + Whittling (the unwanted mod is
  // the lowest-level one — it goes for sure). A hit wanted mod is restored like after an Annulment.
  // → the cheapest option, or null if Chaos does not fit (several unwanted mods, another side to clean, no prices).
  function chaosLoop(rem, add) {
    const p = (n) => C().prices[n];
    if (!rem || !rem.sides || !add || !add.exalt) return null;
    const side = add.side;
    const x = rem.sides[side];
    const others = Object.entries(rem.sides).filter(([sd]) => sd !== side);
    if (!x || x.J !== 1 || others.some(([, o]) => o.J)) return null;
    // Spare junk (S) on the side: Chaos taking it instead frees the slot just as well; on the other side it is not a loss either.
    const N = Object.values(rem.sides).reduce((a, o) => a + o.J + o.K + (o.S || 0), 0);
    const xS = x.S || 0, otherJunk = others.reduce((a, [, o]) => a + o.J + (o.S || 0), 0);
    const full = Object.values(rem.sides).every((o) => o.full);
    const land = full || others.every(([, o]) => o.full) ? 1 : 0.5;
    const restore = restoreValue();
    const lottery = Object.values(add.exalt).every((o) => o.chance == null);
    const opts = [];
    // Greater / Perfect Chaos: the new mod is level 35+ / 50+ (the same thresholds as Exalted) — a better shot at a good tier,
    // worth it on an expensive base. Whittling's removal ignores the threshold (docs/crafting-methods-research.md).
    M.tiers('chaos').forEach(([orb], i) => {
      const e = add.exalt[['base', 'greater', 'perfect'][i]];
      const q = e ? (lottery ? (e.rough ?? e.guess) : e.chance) : null;
      if (!q || p(orb) == null) return;
      const opt = (extra, pJunk, hit) => {
        const currencies = [orb, ...extra];
        if (currencies.some((n) => p(n) == null)) return;
        const per = currencies.reduce((a, n) => a + p(n), 0);
        const pc = pJunk * land * q;
        opts.push({ currencies, per, p: pc, hit, cost: (per + hit * restore) / pc });
      };
      opt([], (1 + xS) / N, (N - 1 - xS - otherJunk) / N);
      opt([`Omen of ${side === 'prefix' ? 'Sinistral' : 'Dextral'} Erasure`], (1 + xS) / (1 + xS + x.K), x.K / (1 + xS + x.K));
      if (rem.whittle) opt(['Omen of Whittling'], 1, 0);
    });
    if (!opts.length) return null;
    opts.sort((a, b) => a.cost - b.cost);
    const best = opts[0];
    return { k: 'chaos', cost: lottery ? null : best.cost, score: best.cost, perTry: best.per, chance: lottery ? null : best.p, chances: lottery ? null : [best.p],
      ps: [best.p], rem: { a: 0, q: best.hit }, hits: best.hit / best.p, currencies: best.currencies, lottery, land, junk: rem.mods };
  }

  // A removal followed by an addition on the same side → one Chaos step, if that is cheaper than both (lottery odds: the rough ones).
  function withChaos(plan) {
    const out = [];
    for (let i = 0; i < plan.length; i++) {
      const s = plan[i];
      const j = s.act === 'remove' && s.sides ? plan.findIndex((x, k) => k > i && x.act === 'add' && !x.useDes && !x.useCrafted && !x.craftedOnly && !x.desecrateOnly && s.sides[x.side] && s.sides[x.side].J) : -1;
      const c = j > 0 ? chaosLoop(s, plan[j]) : null;
      // Chaos wins only if it is cheaper, hits wanted mods no more often than Annulment would (plain Chaos on an item with many
      // good mods keeps hitting them — a «slot machine», not a plan), and costs less than the finished item.
      const r = c ? removeCost(s) : null;
      const two = c ? r.cost + addCost(plan[j], 1).score : null;
      const ok = c && Number.isFinite(c.score) && c.hits <= (r.hits || 0) + 0.5 && !(C().goalValue && c.score > C().goalValue) && !(two <= c.score);
      if (ok) {
        out.push({ act: 'replace', side: plan[j].side, mod: plan[j].mod, junk: s.mods, rem: s, add: plan[j], orMods: plan[j].orMods || null });
        plan = plan.filter((_, k) => k !== j);
        continue;
      }
      out.push(s);
    }
    return out;
  }

  function expandPlan(plan) {
    // Price of "restoring a wanted mod that got hit" — median of the plan's average addition prices (for removing extras).
    const adds = plan.flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : [])).map((x) => addCost(x, 1).score).filter(Number.isFinite).sort((a, b) => a - b);
    restoreCost = adds.length ? adds[Math.floor(adds.length / 2)] : null;
    plan = withChaos(crossFirst(desFirst(pairUp(withDesecrate(plan)))));
    return plan.flatMap((s) => {
      if (s.act !== 'add2') return [s];
      const two = stepCost(s);
      const one = (s.alt || s.steps).map(stepCost);
      const sep = one.every((c) => c.cost != null) ? one[0].cost + one[1].cost : null;
      return two.cost != null && sep != null && sep < two.cost ? (s.alt || s.steps) : [s];
    });
  }

  // Two Exalteds in a row on one side — pair them again (Omen of Greater Exaltation + side omen: the omens stack).
  // The pair could have split when one of its mods was taken by Desecrate or the crafted slot; expandPlan decides if the pair is cheaper.
  function pairUp(plan) {
    const solo = (s) => s && s.act === 'add' && !s.useDes && !s.useCrafted && !s.craftedOnly && !s.desecrateOnly && s.exalt;
    const out = [];
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i], b = plan[i + 1];
      if (solo(a) && solo(b) && a.side === b.side) {
        out.push({ act: 'add2', side: a.side, steps: [a, b], sideOmen: a.sideOmen, otherOpen: a.otherOpen, retry: a.retry,
          currencies: [...new Set([...(a.currencies || []), ...(b.currencies || []), 'Omen of Greater Exaltation'])] });
        i++;
      } else out.push(a);
    }
    return out;
  }

  // One desecration per item — give it to the step where it beats Exalted by the most. If cheaper — it becomes the step's main
  // method, if not — it shows up in "Instead" (chance and price visible). A mod from a Greater Exaltation pair (only if
  // desecrating it is better there) moves to a separate step.
  // Desecrate on a full side (with that side's Necromancy) itself removes a random mod on the side — verified in game
  // (2026-10-18). If the side has one extra mod, that's exactly one side-Annulment attempt: the extra goes with the same
  // 1 in (J + K) chance, a miss removes a wanted one the same way. So Desecrate goes before removals: saves one Annulment with an omen.
  function desFirst(plan) {
    const p = (n) => C().prices[n];
    const r = plan.findIndex((s) => s.act === 'remove' && s.sides);
    if (r < 0 || plan[r].des) return plan; // the desecrated junk still holds the slot until the run is over
    const d = plan.findIndex((s, i) => i > r && s.act === 'add' && s.useDes);
    if (d < 0) return plan;
    const D = plan[d];
    const x = plan[r].sides[D.side];
    if (!x || x.J !== 1 || !x.full || p(x.necro) == null || addCost(D, 1).k !== 'desecrate') return plan;
    const D2 = { ...D, necro: x.necro, desFirst: true };
    // The Necromancy omen was needed anyway — the whole saving counts; if not — its price is subtracted from the saved Annulment.
    const extra = D.necro ? 0 : p(x.necro);
    const R2 = { ...plan[r], desMerge: { side: D.side, extra, mod: D.mod } };
    if (removeCost(plan[r]).cost - removeCost(R2).cost <= extra) return plan;
    const out = plan.filter((_, i) => i !== d);
    out.splice(r, 1, D2, R2);
    return out;
  }

  // A Perfect essence / Alloy always removes a random mod before adding its own. Done while a side still has junk to Annul,
  // that removal is one attempt of the Annulment run — no sacrificial Exalt:
  // · the other side's Crystallisation, when its own side has room (verified in game for Alloys, player 2026-10-22) — its
  //   own mods are never at risk;
  // · its own side's Crystallisation, before the junk there is annulled: the junk dilutes the side (Transcendent Alloy on
  //   a focus with two junk suffixes of three — 2 in 3 it takes junk) and the freed slot gets the essence's mod.
  // Goes before the removals when the two steps together get cheaper; the cheaper side wins.
  function crossFirst(plan) {
    const p = (n) => C().prices[n];
    const m = plan.findIndex((s) => s.act === 'junk');
    if (m >= 0) return crossJunk(plan, m).filter((s) => s.act !== 'junk');
    const r = plan.findIndex((s) => s.act === 'remove' && s.sides);
    if (r < 0 || plan[r].desMerge) return plan;
    const e = plan.findIndex((s, i) => i > r && s.act === 'add' && (s.useCrafted || s.craftedOnly) && s.crafted && addCost(s, 1).k === 'essence');
    if (e < 0) return plan;
    const E = plan[e];
    const other = E.side === 'prefix' ? 'suffix' : 'prefix';
    const own = (plan[r].allSides || plan[r].sides)[E.side]; // a variant's removal may skip its side
    const base = removeCost(plan[r]).cost + addCost(E, 1).score;
    let best = null;
    for (const side of [other, E.side]) {
      const x = plan[r].sides[side];
      // Junk to take on that side; the other side needs room on the essence's own; the desecrated junk there would skew
      // the odds — keep it simple.
      if (!x || !x.J || (plan[r].des && plan[r].des.side === side)) continue;
      if (side === other && !(own && own.free >= 1)) continue;
      const omen = `Omen of ${side === 'prefix' ? 'Sinistral' : 'Dextral'} Crystallisation`;
      if (p(omen) == null) continue;
      const E2 = { ...E, cross: { side, omen, same: side === E.side } };
      const c2 = addCost(E2, 1);
      if (c2.k !== 'essence' || !c2.cross) continue;
      const R2 = { ...plan[r], essMerge: { side, mod: E.mod } };
      const total = removeCost(R2).cost + c2.score;
      if (total < base && (!best || total < best.total)) best = { E2, R2, total };
    }
    if (!best) return plan;
    const out = plan.filter((_, i) => i !== e);
    out.splice(r, 1, best.E2, best.R2);
    return out;
  }

  // A plan variant that keeps the junk (no removal step, only its marker): the essence still takes one off the other side
  // when that side holds nothing but junk — free, nothing wanted is at risk.
  function crossJunk(plan, m) {
    const p = (n) => C().prices[n];
    const e = plan.findIndex((s) => s.act === 'add' && (s.useCrafted || s.craftedOnly) && s.crafted && addCost(s, 1).k === 'essence');
    if (e < 0) return plan;
    const E = plan[e];
    const other = E.side === 'prefix' ? 'suffix' : 'prefix';
    const x = plan[m].sides[other], own = plan[m].sides[E.side];
    if (!x || !x.J || x.K || x.des || !own || !(own.free >= 1)) return plan;
    const omen = `Omen of ${other === 'prefix' ? 'Sinistral' : 'Dextral'} Crystallisation`;
    if (p(omen) == null) return plan;
    const E2 = { ...E, cross: { side: other, omen } };
    const c2 = addCost(E2, 1);
    if (c2.k !== 'essence' || !c2.cross || c2.score >= addCost(E, 1).score) return plan;
    return plan.map((s, i) => (i === e ? E2 : s));
  }

  function withDesecrate(plan) {
    // First the crafted slot (an essence adds the mod for sure), then desecration — to the best of the remaining steps.
    // There can be two crafted slots (Astrid's Creativity rune) — hand out as many as are free.
    const slots = Math.max(1, ...plan.flatMap((s) => (s.act === 'add2' ? s.steps : [s])).map((s) => s.craftedSlots || 0));
    const crafted = (x) => { for (let i = 0; i < slots; i++) x = withSlot(x, 'crafted', 'useCrafted', 'essence'); return x; };
    // Both one-time methods may want the same step (the key mod): try the other order too — Desecrate first, the essence
    // to the best remaining step — and keep it if the plan comes out clearly cheaper (a low-tier essence pays its loss).
    let out = withSlot(crafted(plan), 'desecrate', 'useDes', 'desecrate');
    const swapped = crafted(withSlot(plan, 'desecrate', 'useDes', 'desecrate'));
    if (planScore(swapped) < planScore(out) * 0.95) out = swapped;
    // Order of additions: essence first (while the side has fewer mods — higher chance it removes the sacrifice),
    // then desecrate (on a full item it replaces a random mod), then Exalted.
    for (const flag of ['useDes', 'useCrafted']) {
      const d = out.findIndex((s) => s.act === 'add' && s[flag]);
      const first = out.findIndex((s) => s.act === 'add' || s.act === 'add2');
      if (d >= 0 && first >= 0 && first < d) {
        // The step moves before additions first..d−1 on its side: there are fewer mods there at that point (onSide and onItem
        // in craft.js grow only with additions on their own side).
        const s = out[d];
        const n = out.slice(first, d).flatMap((x) => (x.act === 'add2' ? x.steps : x.act === 'add' ? [x] : [])).filter((x) => x.side === s.side).length;
        const moved = { ...s, onSide: Math.max(0, (s.onSide || 0) - n), onItem: Math.max(0, (s.onItem || 0) - n) };
        // Ahead of the other side's additions that side may still have room: Desecrate needs its side omen there.
        if (flag === 'useDes' && !moved.necro && moved.necroEarly) moved.necro = moved.necroEarly;
        // Essence first — higher chance to remove the sacrifice, but a miss more often removes a key mod (fewer others on the side).
        // Place it where it's cheaper on average.
        if (flag === 'useCrafted' && addCost(moved, 1).score > addCost(s, 1).score) continue;
        // Steps it moved ahead of — now have one more mod on its side.
        const bump = (x) => (x.side === s.side ? { ...x, onSide: (x.onSide || 0) + 1, onItem: (x.onItem || 0) + 1 } : x);
        for (let i = first; i < d; i++) {
          const x = out[i];
          if (x.act === 'add') out[i] = bump(x);
          else if (x.act === 'add2') out[i] = { ...x, steps: x.steps.map(bump) };
        }
        out.splice(d, 1);
        out.splice(first, 0, moved);
      }
    }
    return out;
  }

  // Average cost of the plan's additions (for comparing slot allocations); a step with no converging method counts as Infinity.
  function planScore(plan) {
    return plan.flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : [])).reduce((a, x) => a + (addCost(x, 1).score ?? Infinity), 0);
  }

  // Give a "one-time" method (desecration, crafted slot) to the step where it beats Exalted by the most.
  function withSlot(plan, field, flag, kind) {
    // A mod only the crafted slot provides (Alloy) — the slot is reserved for it.
    if (kind === 'essence' && plan.some((s) => s.act === 'add' && s.craftedOnly && !s[flag])) {
      let done = false; // one slot per call
      return plan.map((s) => { if (!done && s.act === 'add' && s.craftedOnly && !s[flag]) { done = true; return { ...s, [flag]: true }; } return s; });
    }
    // A mod only Desecrate provides (lich mods) — desecration is reserved for it.
    if (kind === 'desecrate' && plan.some((s) => s.act === 'add' && s.desecrateOnly)) return plan.map((s) => (s.act === 'add' && s.desecrateOnly ? { ...s, [flag]: true } : s));
    let best = null, ratio = Infinity, top = null;
    // A crafted-slot source (essence / Alloy) is once per item: taken ones are no longer offered to other steps.
    const used = new Set();
    if (kind === 'essence') {
      for (const s of plan.flatMap((y) => (y.act === 'add2' ? y.steps : [y]))) {
        if (s.act === 'add' && s.useCrafted) { const c = addCost(s, 1); if (c.k === 'essence') used.add(c.currencies[0]); }
      }
    }
    const free = (x) => (kind === 'essence' && x.crafted ? { ...x, crafted: x.crafted.filter((n) => !used.has(n)) } : x);
    plan.forEach((s, i) => {
      for (const [j, x0] of (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : []).entries()) {
        const x = free(x0);
        if (!x[field] || (Array.isArray(x[field]) && !x[field].length) || x.useDes || x.useCrafted) continue;
        const no = addCost(x, 1).score;
        const yes = addCost({ ...x, [flag]: true }, 1);
        const alt = yes.k === kind ? yes.score : (yes.alts || []).concat(yes.desAlt || []).find((o) => o.k === kind)?.cost;
        if (alt == null || !no) continue;
        const r = !Number.isFinite(no) ? (Number.isFinite(alt) ? 0 : Infinity) : alt / no;
        // Desecrate (6 options to choose from) — to the most valuable mod where it helps; essence — where it's cheaper.
        // Desecrate and the crafted slot — to the most valuable mod where they help (not where the price gain is largest).
        if ((kind === 'desecrate' || kind === 'essence') && (r < 1 || yes.k === kind)) {
          // Desecrate (pick 1 of 3) helps most where Exalted rarely hits: value ÷ rough Exalted chance — a valuable rare
          // mod (Spirit on body armour) gets it over a valuable common one (a resistance). The essence — by value.
          const e = x.exalt && x.exalt.base;
          const pe = e ? (e.chance ?? e.rough ?? e.guess) : null;
          const v = kind === 'desecrate' && pe ? (x.worth || 0) / Math.max(0.02, pe) : x.worth || 0;
          if (!top || v > top.v || (v === top.v && r < top.r)) top = { i, j, wins: yes.k === kind, v, r, crafted: x.crafted };
        }
        if (r < ratio) { ratio = r; best = { i, j, wins: yes.k === kind }; }
      }
    });
    // Desecrate helps several steps — give it to the most valuable; helps none — shown as an alternative.
    if (top) best = top;
    if (!best) return plan;
    const mark = (x) => ({ ...x, [flag]: true, ...(best.crafted ? { crafted: best.crafted } : {}) });
    return plan.flatMap((s, i) => {
      if (i !== best.i) return [s];
      if (s.act === 'add') return [mark(s)];
      if (!best.wins) return [{ ...s, steps: s.steps.map((x, j) => (j === best.j ? mark(x) : x)) }];
      // A Greater Exaltation pair across sides expands into the original steps (with side omens).
      return (s.alt || s.steps).map((x, j) => (j === best.j ? mark(x) : x));
    });
  }

    // Simulation of the whole plan (Monte Carlo): each step is "played out" with our chances. An "until success" step repeats,
    // the miss is removed (with chance q it hits a wanted mod); a "single attempt" hits or leaves the miss on the item;
    // an essence adds its mod for sure but may remove a wanted one. Result — costs and item price: between the price now and
    // the goal price by the share of achieved mods (by their value), minus lost wanted mods.
    // info: { keep: how many wanted mods are on the item }. → null if there is no goal or item price.
    // random — a [0, 1) generator (tests pass their own, seeded, so the result is reproducible).
    function simulate(plan, info = {}, runs = 2000, random = Math.random) {
      const { goalValue: goal, est, prices } = C();
      if (goal == null || est == null) return null;
      const steps = expandPlan(plan);
      const costs = steps.map(stepCost);
      const targets = steps.flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : s.act === 'replace' ? [s.add] : []));
      const totalWorth = targets.reduce((a, s) => a + (s.worth || s.pct || 1), 0) || 1;
      const lossPer = Math.max(goal, est) / Math.max(1, (info.keep || 0) + targets.length);
      const ann = prices['Orb of Annulment'] || 0;
      const poisson = (x) => Math.floor(x) + (random() < x % 1 ? 1 : 0);
      const out = [];
      for (let r = 0; r < runs; r++) {
        let spent = 0, got = 0, lost = 0, restoreLoss = 0;
        steps.forEach((s, i) => {
          const c = costs[i];
          if (s.act === 'remove' && s.mods) { spent += c.spent || 0; restoreLoss += Math.max(0, (c.cost || 0) - (c.spent || 0)) * (poisson(c.hits || 0) / Math.max(c.hits || 1, 1e-9)); return; }
          if (s.act !== 'add' && s.act !== 'add2' && s.act !== 'replace') { spent += c.cost || 0; return; }
          const parts = s.act === 'add2' ? s.steps : s.act === 'replace' ? [s.add] : [s];
          const ps = c.ps || [];
          const per = c.perTry || 0;
          if (c.k === 'essence') { // the mod lands for sure; the sacrifice is removed with chance P, otherwise a wanted mod
            spent += per; got += s.worth || s.pct || 1;
            if (random() > (ps[0] || 1)) { lost++; spent += ann; }
            return;
          }
          const loop = c.cost != null && Number.isFinite(c.score) && !c.lottery;
          parts.forEach((x, j) => {
            const p = ps[j] != null ? ps[j] : ps[0] || 0;
            const w = x.worth || x.pct || 1;
            if (!loop) { // single attempt: hit — the mod is there, miss — the miss stays
              spent += j === 0 ? per : 0;
              if (random() < p) got += w;
              return;
            }
            for (let k = 0; k < 200; k++) { // until success: every miss is removed (rem.a), sometimes along with a wanted mod
              spent += per / parts.length;
              if (random() < p) { got += w; return; }
              spent += (c.rem && c.rem.a) || 0;
              if (random() < ((c.rem && c.rem.q) || 0)) lost++;
            }
          });
        });
        const value = Math.max(0, est + (goal - est) * Math.min(1, got / totalWorth) - lost * lossPer - restoreLoss);
        out.push({ spent, value, net: value - spent, full: got >= totalWorth * 0.999 && !lost });
      }
      const q = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(f * arr.length))];
      const vals = out.map((o) => o.value).sort((a, b) => a - b);
      const spends = out.map((o) => o.spent).sort((a, b) => a - b);
      return {
        runs, value: { p10: q(vals, 0.1), p50: q(vals, 0.5), p90: q(vals, 0.9), mean: vals.reduce((a, b) => a + b, 0) / runs },
        spent: { mean: spends.reduce((a, b) => a + b, 0) / runs, p50: q(spends, 0.5), p90: q(spends, 0.9) },
        profit: out.filter((o) => o.net > est).length / runs, // crafting beats selling as is
        full: out.filter((o) => o.full).length / runs, // all wanted mods obtained, none lost
      };
    }

  // Currency of the plan: average costs, plus one attempt of each step with unknown odds (a lower bound, shown as «from»).
  const planSpend = (costs) => costs.reduce((a, c) => a + (c.cost != null ? c.cost : Number.isFinite(c.perTry) ? c.perTry : 0), 0);

  // The plan without the additions of mods not in keep. An Exaltation pair loses its omen; a removal stays only for the
  // sides a kept mod goes to (a two-sided Annulment step is cut to those sides); the desecrated mod is removed only if its
  // side is needed or a kept mod comes only from Desecrate — otherwise its slot stays taken and Desecrate is off.
  // Steps that make the item rare (essence, Regal, rune) stay — every variant needs them.
  function subPlan(plan, keep) {
    const kept = plan.flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : [])).filter((x) => keep.has(x.mod));
    const sides = new Set(kept.map((x) => x.side));
    // How many mods the variant puts on a side (the magic → rare essence takes a slot too) — a removal is needed only beyond the free slots.
    const putOn = (side) => kept.filter((x) => x.side === side).length + plan.filter((s) => s.act === 'essence' && s.side === side).length;
    const desOnly = kept.some((x) => x.desecrateOnly);
    let noDes = false;
    // Fewer mods no longer fill every free slot: a lottery fill's dropped side omens come back.
    const fix = (x) => ({ ...x, ...(x.fillOmen ? { sideOmen: x.fillOmen, otherOpen: true } : {}), ...(noDes && !x.desecrateOnly ? { desecrate: null } : {}) });
    const out = [];
    for (const s of plan) {
      if (s.act === 'remove' && s.targeted && s.side) {
        if (sides.has(s.side) || desOnly) out.push(s); else if (s.currencies.includes('Omen of Light')) noDes = true;
        continue;
      }
      if (s.act === 'remove' && s.sides) {
        // The desecrated junk in the run: kept as long as the variant needs its side, like the targeted step above.
        const desKept = s.des && (sides.has(s.des.side) || desOnly);
        if (s.des && !desKept) noDes = true;
        const r = desKept ? s : { ...s, des: null, sides: Object.fromEntries(Object.entries(s.sides).map(([sd, x]) => [sd, { ...x, des: 0 }])) };
        // Per side: remove only as many as the variant's mods do not fit into the free slots (no data on free — all of them).
        const J = Object.fromEntries(Object.entries(r.sides).map(([sd, x]) => [sd, x.free == null ? (sides.has(sd) ? x.J : 0) : Math.min(x.J, Math.max(0, putOn(sd) - x.free))]));
        if (!Object.values(J).some(Boolean)) {
          // No other junk left to Annul: the desecrated one is removed for sure, Annulment + Omen of Light.
          if (desKept) out.push({ act: 'remove', side: s.des.side, mod: s.des.mod, currencies: ['Orb of Annulment', 'Omen of Light'], chance: 1, targeted: true });
          // The junk stays on the item — an essence can still take one off the other side for free (crossFirst drops this marker).
          out.push({ act: 'junk', sides: r.sides });
          continue;
        }
        if (Object.entries(r.sides).every(([sd, x]) => J[sd] === x.J) || !r.modSides) { out.push(r); continue; }
        const left = { ...J };
        const mods = r.mods.filter((_, k) => left[r.modSides[k]]-- > 0);
        // Every side stays — a side with nothing to remove keeps J = 0 but its wanted mods: a plain Annulment or Chaos
        // Orb hits them too (three T1 prefixes on a helmet whose junk is a suffix), the side omens skip it.
        // The junk the variant no longer removes stays spare (S): hitting it instead is not a loss.
        const dropped = (sd) => r.mods.filter((m, k) => r.modSides[k] === sd && !mods.includes(m));
        out.push({ ...r, mods, allSides: r.allSides || r.sides, sides: Object.fromEntries(Object.entries(r.sides).map(([sd, x]) => [sd,
          { ...x, J: J[sd], S: (x.S || 0) + x.J - J[sd], spareNames: [...(x.spareNames || []), ...dropped(sd)] }])) });
        continue;
      }
      out.push(s);
    }
    return out.flatMap((s) => {
      if (s.act === 'add') return keep.has(s.mod) ? [fix(s)] : [];
      if (s.act !== 'add2') return [s];
      const xs = s.steps.filter((x) => keep.has(x.mod)).map(fix);
      return xs.length === 2 ? [{ ...s, steps: xs }] : xs;
    });
  }


  // Budget variants of one plan. Cheap — only sure steps (essence, ≥ 50%), or else the single mod whose plan (with the removals
  // it needs) is cheapest per value; Balanced — without lottery steps (unknown odds), or else without the mod that saves the
  // most currency per value lost (a lottery step counts one attempt); Ideal — the full goal.
  // Mods the item gets on the way (the magic → rare essence) count in every variant. null — nothing to choose from.
  function variants(g) {
    const steps = expandPlan(g.plan);
    const adds = [];
    steps.forEach((s) => {
      const xs = s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : s.act === 'replace' ? [s.add] : [];
      const c = stepCost(s);
      const lottery = c.lottery || c.hopeless || c.cost == null;
      for (const x of xs) adds.push({ mod: x.mod, worth: x.worth || x.pct || 1, lottery, sure: !lottery && (c.k === 'essence' || (c.chance ?? 0) >= 0.5) });
    });
    // One entry per mod (a mod can show up in two steps — a pair and an «or» step): dropped or kept together.
    const byMod = new Map();
    for (const a of adds) {
      const m = byMod.get(a.mod);
      if (!m) byMod.set(a.mod, { ...a });
      else Object.assign(m, { lottery: m.lottery || a.lottery, sure: m.sure && a.sure });
    }
    adds.splice(0, adds.length, ...byMod.values());
    if (adds.length < 2) return null;
    const all = adds.map((a) => a.mod);
    // A variant's price is its whole plan — with the removals its mods need (a full side: the desecrated mod via Omen of Light).
    const spendOf = (mods) => planSpend(expandPlan(subPlan(g.plan, new Set(mods))).map(stepCost));
    const per = (list) => spendOf(list.map((a) => a.mod)) / list.reduce((x, a) => x + a.worth, 0);
    const same = (a, b) => a.length === b.length && a.every((m) => b.includes(m));
    const sure = adds.filter((a) => a.sure);
    const cheap = sure.length ? sure : [[...adds].sort((a, b) => per([a]) - per([b]))[0]]; // else the single mod with the best value per price
    let balanced = adds.filter((a) => !a.lottery);
    if ((!balanced.length || balanced.length === adds.length || same(balanced, cheap)) && adds.length >= 3) {
      // Drop the mod that saves the most currency per value lost.
      const full = spendOf(all);
      const save = (a) => (full - spendOf(all.filter((m) => m !== a.mod))) / a.worth;
      const drop = [...adds].sort((a, b) => save(b) - save(a))[0];
      balanced = adds.filter((a) => a !== drop);
    }
    const out = [{ key: 'ideal', mods: all }];
    const add = (key, list) => { const mods = list.map((a) => a.mod); if (mods.length && !out.some((v) => same(v.mods, mods))) out.push({ key, mods }); };
    add('cheap', cheap);
    add('balanced', balanced);
    out.push(out.shift()); // Cheap, Balanced, Ideal
    // A smaller variant is worth showing only if it saves currency: not at least 10% cheaper than a fuller one — dropped
    // (when a risky removal costs most of the plan, every variant needs it and there is nothing to choose).
    for (const v of out) v.spend = spendOf(v.mods);
    for (let i = out.length - 2; i >= 0; i--) if (out.slice(i + 1).some((w) => w.spend <= out[i].spend * 1.1)) out.splice(i, 1);
    if (out.length < 2) return null;
    for (const v of out) {
      const keep = new Set(v.mods);
      v.plan = v.key === 'ideal' ? g.plan : subPlan(g.plan, keep);
      v.adds = g.add.filter((a, i) => (keep.has(a.text) || !all.includes(a.text)) && g.add.findIndex((x) => x.text === a.text) === i);
    }
    return out;
  }

    return { stepCost, addCost, removeCost, expandPlan, withDesecrate, simulate, variants, subPlan, planSpend, chaosLoop, EXALT_NAME };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlanCost = api;
}(typeof window !== 'undefined' ? window : this));
