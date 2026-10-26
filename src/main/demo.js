// Demo mode — check the window without the game and without extra trade requests:
//   npx electron . --demo=<item text file> --shot=<png> [flags]
//   --mock-trade         fake listings instead of a trade search (it has strict rate limits)
//   --tab=demand|craft   open a tab before the screenshot
//   --hover=N            hover the N-th listing (the comparison card is saved as <shot>-cmp.png)
//   --eval=<js>          run in the window before the screenshot (open a menu, etc.)
//   --upd='{"state":…}'  screenshot of the "Updates" window in the given state
//   --settings           screenshot of the settings window
//   --tape=<folder> [--record]  network responses from a recording (offline — screenshots repeat) or record them (scripts/visual.js)
//   --scenes=<json file>  several screenshots in one run: [{ demo, shot, tab?, eval? }] (scripts/visual.js); --demo is still required
const { app } = require('electron');
const fs = require('fs');

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
// Only when running from source: --eval runs arbitrary code in the window; the installed program has no use for it.
const enabled = !app.isPackaged && !!arg('demo');
//   --tape=<folder> [--record]  network responses — from a recording (offline, screenshots repeat) or record them there
if (enabled && arg('tape')) require('./api').setTape(arg('tape'), process.argv.includes('--record'));

// Fake listings for --mock-trade.
function mockSearch(rates) {
  const lot = (amount, currency, divine, seller, h) => ({
    amount, currency, currencyName: currency, currencyImage: null, divine, seller, online: true,
    indexed: new Date(Date.now() - h * 3600e3).toISOString(), whisper: h % 2 ? `@${seller} hi` : undefined,
  });
  const listings = [lot(12, 'exalted', 0.03, 'Stadder', 3), lot(1, 'chaos', 0.16, 'Frozenc', 20), lot(1, 'divine', 1, 'Qhaelo', 13),
    lot(2, 'divine', 2, 'DonDoddd', 50), lot(5, 'divine', 5, 'GrabThatMercAndTwist', 96),
    ...[6, 7, 8, 9, 10].map((d, i) => lot(d, 'divine', d, `Seller${i + 1}`, 30 * i + 5))];
  return { total: 37, url: 'https://www.pathofexile.com/trade2', listings, rates, filters: null, dropped: [] };
}

// Fake short price: different outcomes (cheaper / more expensive) in rotation — not random, so screenshots repeat.
let quickN = 0;
function mockQuick() {
  const base = [0.2, 0.5, 1, 2, 4][quickN++ % 5];
  const lots = [1, 1.1, 1.3, 1.6, 2].map((k, i) => ({ div: base * k, indexed: new Date(Date.now() - i * 20 * 3600e3).toISOString() }));
  return new Promise((r) => setTimeout(() => r({ total: 20, divs: lots.map((l) => l.div), lots, url: 'https://www.pathofexile.com/trade2' }), 400));
}

const mockTrade = () => enabled && process.argv.includes('--mock-trade');

// Fake update status for --upd (null — no substitution).
const fakeUpdateStatus = () => (enabled && arg('upd') ? JSON.parse(arg('upd')) : null);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolves once the window has settled: no DOM changes and no finite animations (price glide, fade-ins) for 800 ms.
// Capped at 20 s — a page that never settles is captured as is ('cap' is logged).
const SETTLE = `new Promise((resolve) => {
  const t0 = performance.now(); let last = t0;
  const mo = new MutationObserver(() => { last = performance.now(); });
  mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  const tick = () => {
    const now = performance.now();
    if (document.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getTiming().iterations !== Infinity)) last = now;
    if (now - last >= 800 || now - t0 > 20000) { mo.disconnect(); resolve(now - t0 > 20000 ? 'cap' : 'quiet'); } else setTimeout(tick, 100);
  };
  tick();
})`;

// Scene batch (--scenes): one Electron start for all screenshots. Before each scene the window is reloaded and history
// and the mock price rotation are reset, so a scene looks the same as in a run of its own.
async function runScenes({ priceCheck, windows }) {
  const scenes = JSON.parse(fs.readFileSync(arg('scenes'), 'utf8'));
  const history = require('./history');
  for (const [i, s] of scenes.entries()) {
    const wc = windows().main.webContents;
    try {
      if (i) { const done = new Promise((r) => wc.once('did-finish-load', r)); wc.reload(); await done; }
      history.clear();
      quickN = 0;
      const settle = async () => { if (await wc.executeJavaScript(SETTLE) === 'cap') console.error(`demo scene ${s.shot}: did not settle`); };
      await priceCheck(fs.readFileSync(s.demo, 'utf8'));
      await settle();
      if (s.tab) { await wc.executeJavaScript(`setTab(${JSON.stringify(s.tab)})`); await settle(); }
      if (s.eval) { await wc.executeJavaScript(s.eval); await settle(); }
      fs.writeFileSync(s.shot, (await wc.capturePage()).toPNG());
    } catch (e) {
      console.error(`demo scene ${s.shot}:`, e.message);
    }
  }
  app.quit();
}

// Scenario: show an item (or the "Updates" window), apply the flags, take a screenshot and exit.
function run({ ready, priceCheck, openUpdates, openSettings, windows }) {
  if (!enabled) return;
  if (process.argv.includes('--settings')) {
    ready.catch(() => {}).then(() => openSettings(process.argv.includes('--welcome')));
    setTimeout(async () => {
      if (arg('eval')) { await windows().set.webContents.executeJavaScript(arg('eval')); await wait(800); }
      fs.writeFileSync(arg('shot'), (await windows().set.webContents.capturePage()).toPNG());
      app.quit();
    }, 4000);
    return;
  }
  if (arg('upd')) {
    setTimeout(openUpdates, 300);
    setTimeout(async () => {
      fs.writeFileSync(arg('shot'), (await windows().upd.webContents.capturePage()).toPNG());
      app.quit();
    }, 3000);
    return;
  }
  // The window must have time to load: offline (--tape) the reference data is ready before it, and the item would be lost.
  const loaded = () => new Promise((r) => { const wc = windows().main && windows().main.webContents; if (!wc || !wc.isLoading()) r(); else wc.once('did-finish-load', r); });
  if (arg('scenes')) { ready.then(loaded).then(() => runScenes({ priceCheck, windows })); return; }
  ready.then(loaded).then(() => priceCheck(fs.readFileSync(arg('demo'), 'utf8'))).then(() => {
    if (!arg('shot')) return;
    setTimeout(async () => {
      const { main, cmp } = windows();
      // An error in --eval (element not there yet, etc.) must not leave the run without a screenshot — log it and capture as is.
      if (arg('eval')) { try { await main.webContents.executeJavaScript(arg('eval')); } catch (e) { console.error('demo eval:', e.message); } await wait(400); }
      if (arg('hover')) {
        await main.webContents.executeJavaScript(`document.querySelectorAll('.lot')[${+arg('hover')}]
          .dispatchEvent(new MouseEvent('mouseenter'))`);
        await wait(1500);
      }
      if (arg('tab')) { await main.webContents.executeJavaScript(`setTab(${JSON.stringify(arg('tab'))})`); await wait(500); }
      fs.writeFileSync(arg('shot'), (await main.webContents.capturePage()).toPNG());
      if (cmp.isVisible()) fs.writeFileSync(arg('shot').replace(/\.png$/, '-cmp.png'), (await cmp.webContents.capturePage()).toPNG());
      app.quit();
    }, 9000);
  });
}

module.exports = { enabled, mockSearch, mockQuick, mockTrade, fakeUpdateStatus, run };
