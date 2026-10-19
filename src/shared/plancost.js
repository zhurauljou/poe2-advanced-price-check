// Модель стоимости плана крафта — общая для окна (<script> до частей окна) и для тестов / симуляции (require).
// create(ctx): ctx() → { prices: { валюта: div }, goalValue: цена цели | null | undefined, est: цена вещи сейчас }.
// Всё про выбор способа шага: Exalted / Greater / Perfect (с оменами), Desecrate, эссенции и Alloys (crafted-слот),
// Omen of Greater Exaltation (пары), снятие лишнего Annulment'ами с учётом задетых нужных модов.
(function (root) {
  function create(C) {
    let restoreCost = null; // цена «вернуть задетый нужный мод» (медиана добавлений плана) — считает expandPlan
  // Затраты на шаг: сравниваем варианты (с оменом стороны и без) и берём дешевле в среднем.
  function stepCost(s) {
    const p = (n) => C().prices[n];
    const sum = (list) => list.reduce((a, n) => (a == null || p(n) == null ? null : a + p(n)), 0);
    if (s.act === 'remove' && s.targeted) return { cost: sum(s.currencies), chance: 1, currencies: s.currencies };
    if (s.act === 'remove') return removeCost(s);
    if (s.act === 'add') return addCost(s, 1);
    if (s.act === 'add2') {
      // Omen of Greater Exaltation: один Exalted — два мода; каждый бросок стоит половину (Exalted + омены).
      const g = addCost(s.steps[0], 2, s.steps[1]);
      const des = s.steps.find((x) => x.useDes);
      return { ...g, two: true, desAlt: des ? addCost(des, 1).desAlt.map((o) => ({ ...o, mod: des.mod })) : [] };
    }
    if (s.act === 'regal') {
      const opts = M.tiers('regal').filter(([n]) => p(n) != null).map(([n, lv]) => ({ orb: n, level: lv, cost: p(n) }));
      // Greater / Perfect отсекают низкие тиры случайного мода; если стоят копейки (≤ 0.1 div или ≤ 3× обычного) — по умолчанию лучший.
      const cheapest = opts[0] ? opts[0].cost : 0;
      const pick = [...opts].reverse().find((o) => o.cost <= Math.max(0.1, cheapest * 3)) || opts[0] || { orb: 'Regal Orb', cost: p('Regal Orb') };
      return { cost: pick.cost, chance: 1, currencies: [pick.orb], regal: opts.filter((o) => o !== pick) };
    }
    const cost = sum(s.currencies);
    return { cost, chance: 1, currencies: s.currencies };
  }

  // Добавить мод: перебираем Exalted / Greater / Perfect (с оменом стороны и без) и берём самый дешёвый в среднем.
  // Шанс — попасть в нужное семейство в T1–T2; промах убираем Annulment'ом. rolls = 2 — с Omen of Greater Exaltation
  // (тогда s2 — второй мод пары). Шанс неизвестен (ценный мод) — выбираем по guess (все семейства равновероятны), цену не пишем.
  const M = typeof module !== 'undefined' && module.exports ? require('./methods') : root.CraftMethods;
  const EXALT_NAME = Object.fromEntries(M.tiers('exalt').map(([n], i) => [['base', 'greater', 'perfect'][i], n]));
  // Снять J лишних модов, когда рядом K нужных (Annulment берёт случайный из J + K): ожидаемо Σ (j+K)/j попыток,
  // из них Σ K/j заденут нужный мод — его придётся добавлять снова (restoreCost — цена одного такого добавления).
  // Попадание в другой лишний мод — не промах, а прогресс. Сравниваем: Annulment по всей вещи или с оменом стороны.
  // Цена потери нужного мода: его добавление, но не меньше четверти цены цели — без ключевого мода вещь почти ничего не стоит.
  // Потеря ключевого мода — четверть цены вещи (без него вещь стоит намного меньше); если цен нет — его повторное добавление.
  // Больше доли мода в цене вещи потеря стоить не может: дорогое «добавить заново» — не повод платить больше вещи.
  const valueShare = () => Math.max(C().goalValue ? C().goalValue / 4 : 0, C().est ? C().est / 4 : 0);
  const restoreValue = () => valueShare() || (restoreCost ?? (C().prices['Orb of Annulment'] ?? 0) * 10);
  // Средняя потеря от промаха эссенции / Alloy на стороне: снимается случайный из onSide нужных модов и жертвы.
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
    const run = (J, K) => { let tries = 0, hits = 0; for (let j = J; j >= 1; j--) { tries += (j + K) / j; hits += K / j; } return { tries, hits }; };
    // Задетый нужный мод: вернуть его стоит как его добавление, но не меньше четверти цены цели — без ключевого мода
    // вещь почти ничего не стоит.
    const restore = restoreValue();
    // Средняя цена «вернуть задетый» по нужным модам стороны: крафтовый — его эссенция / Alloy, остальные — restoreValue.
    const sideRestore = (x) => {
      const list = (x.restore || []).length ? x.restore : [null];
      // второстепенный мод — его повторное добавление, но не дороже половины доли ключевого
      const minor = Math.min(restoreCost ?? (p('Orb of Annulment') ?? 0) * 10, valueShare() ? valueShare() / 2 : Infinity);
      return list.reduce((a, n) => a + (n === 'minor' ? minor : n && p(n) != null ? p(n) : restore), 0) / list.length;
    };
    const opts = [];
    const sides = Object.values(s.sides);
    const all = run(sides.reduce((a, x) => a + x.J, 0), sides.reduce((a, x) => a + x.K, 0));
    const allK = sides.reduce((a, x) => a + x.K, 0) || 1;
    const allRestore = sides.reduce((a, x) => a + sideRestore(x) * x.K, 0) / allK;
    opts.push({ currencies: ['Orb of Annulment'], tries: all.tries, hits: all.hits, cost: all.tries * ann + all.hits * allRestore, spent: all.tries * ann });
    if (sides.every((x) => !x.J || p(x.omen) != null)) {
      let tries = 0, hits = 0, spent = 0, lost = 0;
      for (const x of sides) {
        if (!x.J) continue;
        const r = run(x.J, x.K);
        tries += r.tries; hits += r.hits; spent += r.tries * (ann + p(x.omen)); lost += r.hits * sideRestore(x);
      }
      opts.push({ currencies: ['Orb of Annulment', ...sides.filter((x) => x.J).map((x) => x.omen)], tries, hits, spent, cost: spent + lost });
    }
    // Первую попытку снять лишний мод этой стороны уже сделал Desecrate (desFirst) — она не нужна.
    if (s.desMerge) {
      const x = s.sides[s.desMerge.side];
      for (const o of opts) {
        const one = ann + (o.currencies.includes(x.omen) ? p(x.omen) : 0);
        o.tries -= 1; o.spent -= one; o.cost -= one;
      }
    }
    // Essence of the Abyss + Crystallisation стороны снимает случайный мод этой стороны (как Annulment с оменом — те же
    // попытки и задетые нужные) и ставит Mark of the Abyssal Lord; Mark — desecrated, его сразу снимает Omen of Light +
    // Annulment (игрок, 2026-10-19). Полноценный вариант: выбирается, если дешевле всех.
    let abyss = null;
    const crystal = (side) => `Omen of ${side === 'prefix' ? 'Sinistral' : 'Dextral'} Crystallisation`;
    const sideJ = Object.entries(s.sides || {}).filter(([, x]) => x.J);
    if (s.abyss && p('Essence of the Abyss') != null && p('Omen of Light') != null && sideJ.length && sideJ.every(([side]) => p(crystal(side)) != null)) {
      let tries = 0, hits = 0, spent = 0, lost = 0;
      for (const [side, x] of sideJ) {
        const per = p('Essence of the Abyss') + p(crystal(side)) + p('Omen of Light') + ann;
        const r = run(x.J, x.K);
        const n = r.tries - (s.desMerge && s.desMerge.side === side ? 1 : 0);
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
      erasure.push({ side, orb: n, omen, chance: x.J / (x.J + x.K), cost: p(n) + p(omen) });
    }
    return { cost: best.cost, spent: best.spent, tries: best.tries, hits: best.hits, currencies: best.currencies,
      chance: best.hits > 0.05 ? 0.5 : 1, risky: best.hits > 0.05, whittle: wh.length ? wh : null, erasure,
      viaAbyss: best === abyss, abyss: abyss && abyss !== best ? abyss : null, other: opts.find((o) => o !== best && o !== abyss) || null, desMerge: s.desMerge || null };
  }

  // Средняя стоимость до удачи с учётом того, чем снимать промах: per — цена попытки, pc — шанс,
  // removal — [{ a: цена снятия, q: шанс задеть нужный мод }]. Задетый нужный мод придётся добавлять снова (≈ та же
  // стоимость E): E = (per + (1−pc)·a) / (pc − (1−pc)·q). Знаменатель ≤ 0 — путь безнадёжен (Infinity).
  function tries(per, pc, removal) {
    return bestRemoval(per, pc, removal).cost;
  }
  // То же, но с выбранным способом снятия промаха ({ a, q }) — для симуляции.
  function bestRemoval(per, pc, removal) {
    let best = { cost: Infinity, a: 0, q: 0 };
    for (const { a, q } of removal) {
      const den = pc - (1 - pc) * q;
      if (den > 0) { const cost = (per + (1 - pc) * a) / den; if (cost < best.cost) best = { cost, a, q }; }
    }
    return best;
  }
  // Чем снять промах Exalted: Annulment с оменом стороны (1 из модов стороны) или без (1 из всех модов).
  // Остальные моды к этому моменту — нужные (лишнее убрано раньше): задеть их — потеря.
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
      // Есть место на другой стороне — омен стороны обязателен: иначе мод может занять слот, нужный следующему шагу плана.
      for (const omen of s.sideOmen ? [true] : [false]) {
        if (rolls === 2 && s.otherOpen && !omen) continue; // два мода на одну сторону — только с оменом стороны
        const cur = [EXALT_NAME[k], ...(rolls === 2 ? ['Omen of Greater Exaltation'] : []), ...(omen ? [s.sideOmen] : [])];
        if (cur.some((n) => p(n) == null)) continue;
        const per = cur.reduce((a, n) => a + p(n), 0) / rolls;
        const odds = (o) => { const c = lottery ? o.guess : o.chance; return s.otherOpen && !omen ? c / 2 : c; };
        const cost = os.reduce((a, o) => a + tries(per, odds(o), removal), 0);
        const rem = bestRemoval(per, odds(os[0]), removal);
        opts.push({ k, currencies: cur, chances: os.map((o) => (lottery ? null : odds(o))), pool: os[0].pool, cost, per: per * rolls, slam: per / odds(os[0]), p: os.reduce((a, o) => a * odds(o), 1), ps: os.map(odds), rem });
      }
    }
    // Desecrate (только для шага, которому окно его отдало: одна desecration на вещь). Кость + Necromancy на сторону
    // (если на другой есть место), при раскрытии — лучший из 3 вариантов (6 с Omen of Abyssal Echoes).
    // Промах — убрать desecrated-мод прицельно: Orb of Annulment + Omen of Light.
    // Perfect/порченая эссенция (crafted-слот): жертвенный мод Exalted'ом на эту сторону → Omen of Crystallisation
    // стороны + эссенция: снимает случайный мод стороны (жертву — если других снимаемых там нет) и ставит свой мод.
    if (rolls === 1 && (s.useCrafted || s.craftedOnly) && s.crafted) {
      const P = 1 / ((s.onSide || 0) + 1);
      for (const name of s.crafted || []) {
        const cur = [name, s.crystal, 'Exalted Orb', ...(s.sideOmen ? [s.sideOmen] : [])];
        if (cur.some((n) => p(n) == null)) continue;
        const per = cur.reduce((a, n) => a + p(n), 0);
        // Промах: эссенция сняла нужный мод (мод эссенции всё равно встал) — вернуть его и снять жертву. Ключевой мод
        // вещи (atRisk: был на ней до крафта) вернуть дорого — restoreValue; добавленный по плану — его повторное добавление.
        // Поэтому эссенцию выгоднее ставить, когда на стороне уже есть дешёвые нужные моды: промах чаще попадёт в них.
        const cost = per + essenceLoss(s) + (1 - P) * (p('Orb of Annulment') ?? 0);
        opts.push({ k: 'essence', essence: name, currencies: cur, chances: [P], pool: 0, cost, per, slam: per / P, p: P, ps: [P] });
      }
    }
    if (rolls === 1 && (s.useDes || s.desecrateOnly) && s.desecrate) {
      const desRetry = (p('Orb of Annulment') ?? 0) + (p('Omen of Light') ?? 0);
      for (const [bone, o] of Object.entries(s.desecrate)) {
        for (const echo of [false, true]) {
          const boneName = bone.split('|')[0]; // ключ «кость|лич-омен»
          const cur = [boneName, ...(o.extra || []), ...(s.necro ? [s.necro] : []), ...(echo ? ['Omen of Abyssal Echoes'] : [])];
          if (cur.some((n) => p(n) == null)) continue;
          const one = lottery ? o.guess : o.chance;
          // Подходящих модов на стороне ≤ 3 — нужный гарантированно среди вариантов (остаётся только тир).
          // В тройке варианты не повторяются (выбор без возврата), а реролл Abyssal Echoes — новая независимая тройка:
          // шанс тройки 1 − Π (1 − g / (N − i)), g = one·N «подходящих» из N семейств; с Echoes — две тройки.
          const three = o.pool > 3 ? 1 - [0, 1, 2].reduce((a, i) => a * Math.max(0, 1 - (one * o.pool) / (o.pool - i)), 1) : null;
          const pc = o.pool <= 3 ? o.good : three != null ? 1 - Math.pow(1 - three, echo ? 2 : 1) : 1 - Math.pow(1 - one, echo ? 6 : 3);
          const per = cur.reduce((a, n) => a + p(n), 0);
          opts.push({ k: 'desecrate', bone: boneName, lich: o.lich || null, echo, currencies: cur, chances: [lottery ? null : pc], pool: o.pool, cost: tries(per, pc, [{ a: desRetry, q: 0 }]), per, slam: per / pc, p: pc, ps: [pc], rem: { a: desRetry, q: 0 } });
        }
      }
    }
    if (!opts.length) return { cost: null, chance: null, currencies: ['Exalted Orb'], lottery: true };
    // Ни один способ «до победы» не сходится — значит, одна попытка (слэм), промах остаётся на вещи: берём способ
    // с лучшим «шансом за цену попытки».
    // Одна попытка (до победы не сходится) на вещи с известной выгодой: промах — испорченная вещь, а не цена сферы.
    // Тогда выбираем по выгоде попытки: шанс × (цена цели − цена сейчас) − цена попытки (Perfect Exalted на дорогой вещи).
    // «До победы» дороже самой цели — так не крафтят: это одна попытка (промах остаётся на вещи).
    if (C().goalValue) for (const o of opts) if (o.cost > C().goalValue) o.cost = Infinity;
    const gain = C().goalValue != null && C().est != null ? Math.max(0, C().goalValue - C().est) : 0;
    if (gain && opts.every((o) => !Number.isFinite(o.cost))) opts.sort((a, b) => (b.p * gain - b.per) - (a.p * gain - a.per));
    else opts.sort((a, b) => a.cost - b.cost || a.slam - b.slam);
    const best = opts[0];
    // Другие способы — для сравнения (по одному лучшему варианту каждого).
    const kind = (o) => (o.k === 'desecrate' ? o.bone : o.k);
    const alts = opts.filter((o, i) => kind(o) !== kind(best) && opts.findIndex((x) => kind(x) === kind(o)) === i);
    const desAlt = alts.filter((o) => (o.k === 'desecrate' || o.k === 'essence') && o.k !== best.k);
    // Ни один способ не сходится: промах чаще снимет нужный мод, чем лишний.
    const hopeless = !Number.isFinite(best.cost);
    // Эссенция ставит мод наверняка — её цена известна, даже если шанс Exalted для этого мода неизвестен.
    const lot = lottery && best.k !== 'essence';
    return { hopeless, perTry: best.per, ps: best.ps, rem: best.rem, cost: lot || hopeless ? null : best.cost, score: best.cost, chance: best.chances[0], chances: best.chances, currencies: best.currencies,
      lottery: lot, pool: best.pool, k: best.k, echo: best.echo, bone: best.bone, lich: best.lich, alts: lottery ? [] : alts, desAlt };
  }

  // add2, если два отдельных Exalted выходят дешевле, — разворачиваем обратно в два шага.
  function expandPlan(plan) {
    // Цена «вернуть задетый нужный мод» — медиана средних цен добавления в этом плане (для снятия лишнего).
    const adds = plan.flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : [])).map((x) => addCost(x, 1).score).filter(Number.isFinite).sort((a, b) => a - b);
    restoreCost = adds.length ? adds[Math.floor(adds.length / 2)] : null;
    plan = desFirst(pairUp(withDesecrate(plan)));
    return plan.flatMap((s) => {
      if (s.act !== 'add2') return [s];
      const two = stepCost(s);
      const one = (s.alt || s.steps).map(stepCost);
      const sep = one.every((c) => c.cost != null) ? one[0].cost + one[1].cost : null;
      return two.cost != null && sep != null && sep < two.cost ? (s.alt || s.steps) : [s];
    });
  }

  // Два Exalted подряд на одну сторону — снова в пару (Omen of Greater Exaltation + омен стороны: омены складываются).
  // Пара могла распасться, когда один её мод забрал Desecrate или crafted-слот; дешевле ли пара — решит expandPlan.
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

  // Desecration одна на вещь — отдаём её шагу, где она выгоднее всего относительно Exalted. Дешевле — станет основным
  // способом шага, нет — покажется в «Вместо этого» (видно шанс и цену). Мод из пары Greater Exaltation (только если
  // десекрейт там выгоднее) уходит в отдельный шаг.
  // Desecrate на полную сторону (с Necromancy этой стороны) сам снимает случайный мод стороны — проверено в игре
  // (2026-10-18). Если на стороне один лишний мод, это ровно одна попытка Annulment стороны: лишний уходит с тем же
  // шансом 1 из (J + K), промах снимает нужный так же. Поэтому Desecrate — до снятий: экономит одну Annulment с оменом.
  function desFirst(plan) {
    const p = (n) => C().prices[n];
    const r = plan.findIndex((s) => s.act === 'remove' && s.sides);
    if (r < 0) return plan;
    const d = plan.findIndex((s, i) => i > r && s.act === 'add' && s.useDes);
    if (d < 0) return plan;
    const D = plan[d];
    const x = plan[r].sides[D.side];
    if (!x || x.J !== 1 || !x.full || p(x.necro) == null || addCost(D, 1).k !== 'desecrate') return plan;
    const D2 = { ...D, necro: x.necro, desFirst: true };
    // Омен Necromancy и так был нужен — экономия вся; не был — его цена вычитается из сэкономленной Annulment.
    const extra = D.necro ? 0 : p(x.necro);
    const R2 = { ...plan[r], desMerge: { side: D.side, extra, mod: D.mod } };
    if (removeCost(plan[r]).cost - removeCost(R2).cost <= extra) return plan;
    const out = plan.filter((_, i) => i !== d);
    out.splice(r, 1, D2, R2);
    return out;
  }

  function withDesecrate(plan) {
    // Сначала crafted-слот (эссенция ставит мод наверняка), потом desecration — на лучший из оставшихся шагов.
    // Crafted-слотов может быть два (руна Astrid's Creativity) — раздаём столько, сколько свободно.
    const slots = Math.max(1, ...plan.flatMap((s) => (s.act === 'add2' ? s.steps : [s])).map((s) => s.craftedSlots || 0));
    let withCrafted = plan;
    for (let i = 0; i < slots; i++) withCrafted = withSlot(withCrafted, 'crafted', 'useCrafted', 'essence');
    const out = withSlot(withCrafted, 'desecrate', 'useDes', 'desecrate');
    // Порядок добавлений: эссенция первой (пока на стороне меньше модов — выше шанс, что снимет жертву),
    // затем desecrate (на полной вещи он заменяет случайный мод), потом Exalted.
    for (const flag of ['useDes', 'useCrafted']) {
      const d = out.findIndex((s) => s.act === 'add' && s[flag]);
      const first = out.findIndex((s) => s.act === 'add' || s.act === 'add2');
      if (d >= 0 && first >= 0 && first < d) {
        // Шаг встаёт раньше добавлений first..d−1 на своей стороне: модов там к этому моменту меньше (onSide и onItem
        // в craft.js растут только с добавлениями своей стороны).
        const s = out[d];
        const n = out.slice(first, d).flatMap((x) => (x.act === 'add2' ? x.steps : x.act === 'add' ? [x] : [])).filter((x) => x.side === s.side).length;
        const moved = { ...s, onSide: Math.max(0, (s.onSide || 0) - n), onItem: Math.max(0, (s.onItem || 0) - n) };
        // Эссенция первой — выше шанс снять жертву, но промах чаще снимает ключевой мод (на стороне меньше других).
        // Ставим туда, где дешевле в среднем.
        if (flag === 'useCrafted' && addCost(moved, 1).score > addCost(s, 1).score) continue;
        // Шаги, перед которыми он встал, — на его стороне теперь на мод больше.
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

  // Отдать «одноразовый» способ (desecration, crafted-слот) шагу, где он выгоднее всего относительно Exalted.
  function withSlot(plan, field, flag, kind) {
    // Мод, который даёт только crafted-слот (Alloy), — слот за ним.
    if (kind === 'essence' && plan.some((s) => s.act === 'add' && s.craftedOnly && !s[flag])) {
      let done = false; // по одному слоту за вызов
      return plan.map((s) => { if (!done && s.act === 'add' && s.craftedOnly && !s[flag]) { done = true; return { ...s, [flag]: true }; } return s; });
    }
    // Мод, который даёт только Desecrate (моды личей), — desecration за ним.
    if (kind === 'desecrate' && plan.some((s) => s.act === 'add' && s.desecrateOnly)) return plan.map((s) => (s.act === 'add' && s.desecrateOnly ? { ...s, [flag]: true } : s));
    let best = null, ratio = Infinity, top = null;
    // Источник crafted-слота (эссенция / Alloy) один раз на вещь: занятые уже не предлагаем другим шагам.
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
        // Desecrate (6 вариантов на выбор) — самому ценному моду, где он помогает; эссенция — где выгоднее по цене.
        // Desecrate и crafted-слот — самому ценному моду, где они помогают (а не там, где выигрыш по цене больше).
        if ((kind === 'desecrate' || kind === 'essence') && (r < 1 || yes.k === kind)) {
          const v = x.worth || 0;
          if (!top || v > top.v || (v === top.v && r < top.r)) top = { i, j, wins: yes.k === kind, v, r, crafted: x.crafted };
        }
        if (r < ratio) { ratio = r; best = { i, j, wins: yes.k === kind }; }
      }
    });
    // Desecrate помогает нескольким шагам — отдаём самому ценному; не помогает ни одному — покажется как альтернатива.
    if (top) best = top;
    if (!best) return plan;
    const mark = (x) => ({ ...x, [flag]: true, ...(best.crafted ? { crafted: best.crafted } : {}) });
    return plan.flatMap((s, i) => {
      if (i !== best.i) return [s];
      if (s.act === 'add') return [mark(s)];
      if (!best.wins) return [{ ...s, steps: s.steps.map((x, j) => (j === best.j ? mark(x) : x)) }];
      // Пара Greater Exaltation через стороны разворачивается в исходные шаги (с оменами стороны).
      return (s.alt || s.steps).map((x, j) => (j === best.j ? mark(x) : x));
    });
  }

    // Симуляция всего плана (Монте-Карло): каждый шаг «проигрывается» по нашим шансам. Шаг «до победы» повторяется,
    // промах снимается (с шансом q заденет нужный мод); «одна попытка» попадает или оставляет промах на вещи;
    // эссенция ставит свой мод наверняка, но может снять нужный. Итог — затраты и цена вещи: между ценой сейчас и
    // ценой цели по доле достигнутых модов (по их ценности), минус потерянные нужные моды.
    // info: { keep: сколько нужных модов на вещи }. → null, если нет цены цели или вещи.
    // random — генератор [0, 1) (тесты передают свой, с зерном, чтобы результат повторялся).
    function simulate(plan, info = {}, runs = 2000, random = Math.random) {
      const { goalValue: goal, est, prices } = C();
      if (goal == null || est == null) return null;
      const steps = expandPlan(plan);
      const costs = steps.map(stepCost);
      const targets = steps.flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : []));
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
          if (s.act !== 'add' && s.act !== 'add2') { spent += c.cost || 0; return; }
          const parts = s.act === 'add2' ? s.steps : [s];
          const ps = c.ps || [];
          const per = c.perTry || 0;
          if (c.k === 'essence') { // мод ставится наверняка; жертва снимается с шансом P, иначе — нужный мод
            spent += per; got += s.worth || s.pct || 1;
            if (random() > (ps[0] || 1)) { lost++; spent += ann; }
            return;
          }
          const loop = c.cost != null && Number.isFinite(c.score) && !c.lottery;
          parts.forEach((x, j) => {
            const p = ps[j] != null ? ps[j] : ps[0] || 0;
            const w = x.worth || x.pct || 1;
            if (!loop) { // одна попытка: попал — мод есть, нет — промах остаётся
              spent += j === 0 ? per : 0;
              if (random() < p) got += w;
              return;
            }
            for (let k = 0; k < 200; k++) { // до победы: каждый промах снимается (rem.a), иногда вместе с нужным модом
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
        runs, value: { p10: q(vals, 0.1), p50: q(vals, 0.5), p90: q(vals, 0.9) },
        spent: { mean: spends.reduce((a, b) => a + b, 0) / runs, p50: q(spends, 0.5), p90: q(spends, 0.9) },
        profit: out.filter((o) => o.net > est).length / runs, // крафт выгоднее, чем продать как есть
        full: out.filter((o) => o.full).length / runs, // все нужные моды получены, ни один не потерян
      };
    }

    return { stepCost, addCost, removeCost, expandPlan, withDesecrate, simulate, EXALT_NAME };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlanCost = api;
}(typeof window !== 'undefined' ? window : this));
