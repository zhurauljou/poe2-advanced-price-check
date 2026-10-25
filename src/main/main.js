const {
  app, BrowserWindow, globalShortcut, clipboard, screen, ipcMain, Tray, Menu, shell, nativeImage,
} = require('electron');
const path = require('path');
const { sleep, copyItem, whisperInGame } = require('./input');

const settings = require('./settings');
const api = require('./api');
const pricing = require('./pricing');
const { log } = require('./log');
const winapi = require('./winapi');
const updater = require('./updater');
const { popularBuilds, categoryDemand, prewarm: prewarmDemand } = require('./ninjaBuilds');
const craft = require('./craft');
const { themeMods } = require('./weights');
const history = require('./history');
let lastItem = null; // last parsed item — for crafting advice
let lastThemeMods = []; // its key mods — crafting demand is computed among builds that have them
let lastPriceKeys = []; // templates the price search never relaxes — the mods that hold the item's price; the craft plan keeps them
const { parseItem } = require('./parser');
const stats = require('./stats');
const clientLang = require('./clientLang');
const i18n = require('../shared/i18n');
const { t } = i18n;

const WIDTH = 480;
// Interface scale (settings window): larger on a 4K monitor. Window widths and content height take it into account.
const SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
const uiScale = () => (SCALES.includes(settings.get().uiScale) ? settings.get().uiScale : 1);
const W = () => Math.round(WIDTH * uiScale());
// Wide window (two columns) — the user's choice (header button or settings), setting wideWindow: 'on' | 'off'.
const WIDE = 900;
const WW = () => Math.round(WIDE * uiScale());
const ICON = path.join(__dirname, '../../assets/icon.png');

let win = null;
let tray = null;
let pinned = false; // step-by-step craft: the window doesn't hide on a click into the game
let interacted = false; // the window got focus (was clicked) — then a click back into the game hides it
let leagues = [];
let ready = null; // promise for loading the dictionaries (reset if loading failed — see ensureReady)
let refreshTray = () => {};

const demo = require('./demo');
// Demand (poe.ninja builds) — among characters from this level (80 / 90 / 95, toggle on the Demand tab).
// 80 — no filter: poe.ninja only counts 80+ anyway.
const demandLevel = () => { const l = settings.get().demandLevel || 90; return l > 80 ? l : null; };
// The demo run lives in its own data folder, so it can work next to a running tray copy.
if (demo.enabled) app.setPath('userData', app.getPath('userData') + '-demo');
// Single instance. After an update the installer starts the new version while the old one is still closing — so if we don't
// get the lock right away, wait up to 10 s for the old one to exit; only then consider ourselves a duplicate and quit.
async function singleInstance() {
  for (let i = 0; i < 20; i++) {
    if (app.requestSingleInstanceLock()) return true;
    await sleep(500);
  }
  return false;
}

// A background error must not pop up as a system dialog over the game — log it and keep going.
process.on('uncaughtException', (e) => log('uncaught', e));
process.on('unhandledRejection', (e) => log('unhandled', e));

// Windows show only their own files: no Node, sandboxed, with context isolation (explicitly — not relying on the
// Electron version's defaults). Navigation and new windows are blocked (app.on('web-contents-created') below): external links
// open only via open-url, from a site allowlist.
const SECURE = { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true };
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-navigate', (ev) => ev.preventDefault());
  wc.on('will-attach-webview', (ev) => ev.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
});

// Competitor card — a separate window beside the overlay, so it doesn't cover the overlay's content.
const CMP_WIDTH = 440;
const CW = () => Math.round(CMP_WIDTH * uiScale());
function applyScale() {
  for (const w of [win, cmpWin]) if (w && !w.isDestroyed()) w.webContents.setZoomFactor(uiScale());
}
let cmpWin = null;
let cmpY = 0; // screen Y of the listing row the card is shown next to

function createCompare() {
  cmpWin = new BrowserWindow({
    width: CMP_WIDTH, height: 300, show: false, frame: false, resizable: false, skipTaskbar: true,
    alwaysOnTop: true, focusable: false, fullscreenable: false, backgroundColor: '#0a0d12',
    webPreferences: { ...SECURE, preload: path.join(__dirname, 'preload-compare.js'), backgroundThrottling: false },
  });
  cmpWin.setAlwaysOnTop(true, 'screen-saver');
  cmpWin.loadFile(path.join(__dirname, '../renderer/compare.html'));
  cmpWin.webContents.on('did-finish-load', applyScale);
}

// To the right of the overlay, if it doesn't fit — to the left; vertically — next to the listing row, within the screen.
function placeCompare(height) {
  const b = win.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  let x = b.x + b.width + 6;
  if (x + CW() > area.x + area.width) x = b.x - CW() - 6;
  const h = Math.min(Math.ceil(height), area.height - 10);
  const y = Math.max(area.y, Math.min(cmpY - 40, area.y + area.height - h));
  cmpWin.setBounds({ x: Math.round(x), y: Math.round(y), width: CW(), height: h });
  if (!cmpWin.isVisible()) cmpWin.showInactive();
}

function createOverlay() {
  win = new BrowserWindow({
    width: WIDTH,
    height: 300,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    backgroundColor: '#14110e',
    webPreferences: { ...SECURE, preload: path.join(__dirname, 'preload.js') },
  });
  // The screen-saver level keeps the window above the game client in windowed fullscreen.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.webContents.on('did-finish-load', applyScale);
  win.on('focus', () => { interacted = true; syncEsc(); });
  win.on('blur', () => { if (interacted && !pinned) hide(); else syncEsc(); });
  // The user dragged the window — remember the spot and open there from now on.
  win.on('moved', () => {
    if (positioning || !win.isVisible()) return;
    const [x, y] = win.getPosition();
    anchorY = y;
    settings.set({ windowPos: { x, y } });
    refreshTray();
  });
}

// Our own moves (show, height fitting) must not be recorded as "the user dragged".
let positioning = false;
let anchorY = 0; // window top we want to keep; move up only if the window doesn't fit vertically

function place(bounds) {
  const b = win.getBounds();
  if (b.x === bounds.x && b.y === bounds.y && b.width === bounds.width && b.height === bounds.height) return;
  positioning = true;
  win.setBounds(bounds);
  setTimeout(() => { positioning = false; }, 150);
}

// Remembered spot — if it's still on some monitor (the monitor may have been disconnected).
function savedPos() {
  const p = settings.get().windowPos;
  if (!p) return null;
  const area = screen.getDisplayNearestPoint({ x: p.x + 40, y: p.y + 20 }).workArea;
  const inside = p.x + 40 >= area.x && p.x + 40 <= area.x + area.width && p.y >= area.y && p.y < area.y + area.height - 40;
  return inside ? p : null;
}

function show() {
  const [, h] = win.getSize();
  let x, y;
  const saved = savedPos();
  if (saved) {
    ({ x, y } = saved);
  } else {
    // Never moved — next to the cursor: to the right, or to the left if it doesn't fit.
    const cur = screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(cur).workArea;
    x = cur.x + 24;
    if (x + W() > area.x + area.width) x = cur.x - W() - 24;
    y = Math.max(area.y, cur.y - 120);
  }
  anchorY = Math.round(y);
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  place({ x: Math.round(x), y: Math.min(anchorY, area.y + area.height - h), width: W(), height: h });
  interacted = false;
  win.showInactive(); // don't steal focus from the game
  syncEsc();
}

// Esc from the game closes the overlay — via a global shortcut, which the game then doesn't receive. So we grab it only
// while needed: the window is shown but the game has focus. When the window is focused, the page catches Esc (first closes the league list);
// when pinned (step-by-step craft, still playing) — Esc stays with the game, «■ Stop» or the close button closes it.
let escOn = false;
function syncEsc() {
  const want = !!(win && win.isVisible() && !win.isFocused() && !pinned);
  if (want && !escOn) escOn = globalShortcut.register('Escape', hide);
  else if (!want && escOn) { globalShortcut.unregister('Escape'); escOn = false; }
}

// The game window is the active window at the moment of Ctrl+D. Focus goes back to it when we close an overlay
// that was clicked into (close button, Esc after a click): Windows doesn't give focus back to the game by itself.
let gameHwnd = 0;

function hide() {
  if (cmpWin) cmpWin.hide();
  if (win && win.isVisible()) {
    api.newGeneration(); // window closed — remaining searches for this item don't spend the trade rate limit
    if (win.isFocused() && gameHwnd) winapi.focus(gameHwnd);
    win.hide();
  }
  syncEsc();
}

// For weapons poe.ninja counts mods and bases of all the character's weapons (main, offhand, swap): «Rare Sceptre»
// picks up wands, staves, spears — up to 44% of equips (audit across all classes). Armour and jewellery are clean.
// Keep bases of the same class; drop a mod only if it can't be on this base but can be on another base from the list
// (anoints, enchants, runes are left alone — they're in no one's pool). Everything on the item itself — always.
// Jewels: demand among builds with the same base. The general «Rare Jewel» mixes colours and Time-Lost: Time-Lost mods there are
// 10–14% of builds (below the demand threshold), but among Time-Lost Sapphire wearers «Notable … Crit Damage Bonus» is 58%.
// The radius upgrade isn't a theme (all Time-Lost wear it), demand isn't narrowed by it.
function demandScope(item, withMods = []) {
  const jewel = item && item.itemClass === 'Jewels';
  return { withBase: jewel ? item.baseType : null, withMods: (withMods || []).filter((m) => !/^Upgrades Radius/i.test(m)) };
}

function forBase(d, item) {
  if (!d || !item) return d;
  const key = stats.templateKey;
  const own = new Set((item.mods || []).map((m) => key(m.template)));
  const foreign = d.bases.filter((b) => craft.sameClass(item.baseType, b.name) === false).map((b) => b.name);
  const alien = (name) => craft.canAppear(item.baseType, name) === false && foreign.some((b) => craft.canAppear(b, name));
  return { ...d,
    mods: d.mods.filter((r) => own.has(key(r.name)) || !alien(r.name)),
    bases: d.bases.filter((b) => !foreign.includes(b.name)) };
}

let copying = false;

async function onHotkey() {
  // Holding Ctrl+D re-sends the hotkey — parallel copies corrupt each other's clipboard.
  if (copying) return;
  copying = true;
  try {
    const fg = winapi.foreground();
    if (fg && fg !== winapi.hwndOf(win)) gameHwnd = fg;
    // Our window has focus (was clicked) — Ctrl+C would go to it, not the game. Hide it and give focus back to the game.
    if (win.isVisible() && win.isFocused()) {
      hide();
      await sleep(80);
    }
    const text = await copyItem();
    if (!text) return;
    await priceCheck(text);
  } catch (e) {
    log('priceCheck', e);
  } finally {
    copying = false;
  }
}

// Game client language: auto — by the first line of the text (the Russian «Item Class:» header means Russian). For non-English —
// item names and the mod dictionary for that language (loaded once); the text is translated to its English equivalent.
let clientLangActive = 'en';
function detectClientLang(text) {
  const want = settings.get().clientLang || 'auto';
  if (want !== 'auto') return want;
  return Object.keys(clientLang.LANGS).find((l) => text.startsWith(clientLang.LANGS[l].itemClass)) || 'en';
}
async function useClientLang(lang) {
  if (lang === clientLangActive) return;
  if (lang === 'en') stats.buildLocal(null);
  else {
    await clientLang.load(lang, api.cacheDir(), api.fetchBuffer);
    stats.buildLocal(await api.cached(`stats-${lang}.json`, `https://${lang}.pathofexile.com/api/trade2/data/stats`));
  }
  clientLangActive = lang;
}

// refresh — the same item again (league changed, opened from history): the window is already open, don't move it to the cursor.
// historyId — this item's history entry (otherwise a new entry).
let lastText = null;
let lastHistoryId = null;
async function priceCheck(text, refresh = false, historyId = null) {
  lastText = text;
  const rawText = text;
  const lang = detectClientLang(text);
  try {
    await useClientLang(lang);
  } catch (e) {
    log('client language', lang, e);
  }
  if (lang !== 'en') text = clientLang.toEnglish(text, lang);
  const item = parseItem(text);
  if (!item) {
    // Don't log the text itself: with "in game only" off it could be someone else's clipboard (password, email).
    log(`not an item (${text.length} chars, client ${lang})`);
    return; // cursor isn't over an item
  }
  api.newGeneration(); // new item — not-yet-sent requests for the previous one are cancelled
  // Text of the last item — for debugging parser errors.
  require('fs').promises.writeFile(path.join(app.getPath('userData'), 'last-item.txt'), text).catch(() => {});
  try {
    await ensureReady();
  } catch (e) {
    send('status', { error: t('Failed to load data: {msg}', { msg: e.message }) });
  }
  refreshLeagues().catch((e) => log('leagues', e.message)); // from cache (6 h) — instant; stale — refreshed in the background
  const league = settings.get().league;
  // Prices for this league are already there — show right away, fresh ones load in the background. None — wait (else nothing to show).
  // Swallow the error: no poe.ninja prices for the league — trade still works.
  const ninja = league ? api.loadNinja(league).catch((e) => log('ninja', e.message)) : null;
  if (ninja && api.ninja.league !== league) await ninja;
  // Demand for the item class (poe.ninja) — affects which mods are enabled and how strictly. It's cached,
  // so we wait only the first time and no longer than 1.5 s; if it's late — work without it.
  let demand = null;
  if (!league) {
    // league list didn't load — nothing to compute demand by
  } else if (['Rare', 'Magic', 'Normal'].includes(item.rarity)) {
    const q = categoryDemand({ league, itemClass: item.itemClass, rarity: 'Rare', limit: 80, minLevel: demandLevel(), ...demandScope(item) },
      api.fetchBuffer).catch((e) => { log('demand', e.message); return null; });
    demand = await Promise.race([q, new Promise((r) => setTimeout(() => r(null), 1500))]);
  } else if (item.rarity === 'Unique' && item.name) {
    // Unique: which of ITS mods builds wear — for random mods (Heart of the Well) those are the key ones.
    const q = popularBuilds({ league, uniqueName: item.name, limit: 1, minLevel: demandLevel() }, api.fetchBuffer)
      .then((b) => ({ mods: b.mods })).catch((e) => { log('demand', e.message); return null; });
    // Wait longer than for rares: without demand a unique's key mods can't be told from minor ones.
    demand = await Promise.race([q, new Promise((r) => setTimeout(() => r(null), 4000))]);
  }
  lastItem = item;
  const prepared = pricing.prepare(item, demand, (tpl) => craft.rollsOn(item.baseType, tpl));
  // Search toggles — as the user chose last time.
  const sd = settings.get();
  if (typeof sd.searchOnline === 'boolean') prepared.filters.online = sd.searchOnline;
  if (typeof sd.searchFlex === 'boolean') prepared.filters.flex = sd.searchFlex;
  // Craft base: search "same by tiers" — from the step where the last tier unlocked up to the next one (ilvl 84 = 82).
  const il = prepared.filters.ilvl;
  const band = il && il.enabled && (item.rarity === 'Normal' || item.rarity === 'Magic') ? craft.ilvlBand(item.baseType, item.ilvl) : null;
  if (band) Object.assign(il, { min: band.min, max: band.max, next: band.next });
  // Item theme for crafting advice: the mods that define its archetype (src/main/weights.js themeMods) — not just the ones
  // the price search enabled (local ES on gloves is folded into the property, which left «Rarity + Dexterity» as the theme).
  lastThemeMods = themeMods(prepared.filters.mods, item.itemClass);
  lastPriceKeys = prepared.filters.mods.filter((m) => m.key && m.tag !== 'pseudo' && m.template).map((m) => m.template);
  // Item level and quality too: every white base of a type shares name and base, so «Last check» showed another base's price.
  const entry = { name: item.name, baseType: item.baseType, rarity: item.rarity, league, ilvl: item.ilvl || null, quality: item.quality || 0 };
  lastHistoryId = historyId || history.add({ ...entry, text: rawText });
  const prev = history.previous(entry, lastHistoryId);
  send('item', { ...prepared, theme: lastThemeMods, league, leagues, historyId: lastHistoryId, offline: api.offline.host, previous: prev && { est: prev.est, at: prev.estAt || prev.at }, hotkey: hotkeyLabel(), wide: settings.get().wideWindow === 'on' });
  if (!refresh || !win.isVisible()) show();
  if (unknownToTrade(item)) refreshTradeData(rawText).catch((e) => log('trade data refresh', e.message));
}

// A mod or base missing from the trade dictionary — most likely a patch came out and the cached dictionary is from yesterday.
// On uniques unmatched lines are flavour text, not counted; implicits neither (tablets' «Adds Breaches to a Map»
// isn't on trade — that's visible from the base anyway).
function unknownToTrade(item) {
  if (!['Rare', 'Magic', 'Normal', 'Unique'].includes(item.rarity)) return false;
  if (!pricing.knownBase(item.baseType)) return true;
  return item.rarity !== 'Unique' && item.mods.some((m) => !m.statId && ['explicit', 'fractured', 'desecrated'].includes(m.tag));
}

// Fresh trade dictionary and the same item again. At most once an hour and only if the dictionary is older than 2 h — otherwise
// the mod just isn't searchable on trade, and downloading won't help.
let tradeDataAt = 0;
async function refreshTradeData(rawText) {
  if (Date.now() - tradeDataAt < 3600e3 || api.cacheAgeH('stats.json') < 2) return;
  tradeDataAt = Date.now();
  log('unknown mod or base — refreshing trade data');
  api.clearCache(/^(stats|items|static)(-\w+)?\.json$/);
  await pricing.init();
  if (clientLangActive !== 'en') {
    const lang = clientLangActive;
    clientLangActive = 'en';
    await useClientLang(lang);
  }
  if (lastText === rawText) await priceCheck(rawText, true, lastHistoryId);
}

function send(ch, data) {
  if (win) win.webContents.send(ch, data);
}

// Dictionaries are loaded at startup; if that failed (no network on first launch, etc.) — retry on the next
// check and on our own once a minute, rather than waiting for a restart.
let retryTimer = null;
function ensureReady() {
  if (!ready) {
    clearTimeout(retryTimer);
    ready = initData().then(refreshTray, (e) => {
      log('init failed', e);
      ready = null;
      retryTimer = setTimeout(() => ensureReady().catch(() => {}), 60e3);
      throw e;
    });
  }
  return ready;
}

// League for requests. No league list yet (didn't load) — don't send «null» to trade, say what's wrong instead.
function curLeague() {
  const l = settings.get().league;
  if (!l) throw new Error(t('League list is not loaded yet — check your internet connection'));
  return l;
}

// League list: 6 h cache, checked on every item check and on a timer — a new league appears in the tray without a
// restart; if the selected one ended — switch to the main current one.
async function refreshLeagues() {
  const ids = (await api.tradeLeagues()).result.map((l) => l.id);
  const changed = ids.join('|') !== leagues.join('|');
  leagues = ids;
  // A new league means a patch came out: cached trade and RePoE dictionaries are stale (new mods, bases, weights).
  // Refresh on our own — the player doesn't know something needs clicking after a patch. First launch — only remember.
  const known = settings.get().knownLeagues;
  if (!Array.isArray(known) || ids.some((id) => !known.includes(id))) {
    settings.set({ knownLeagues: ids });
    if (Array.isArray(known)) {
      log('new league:', ids.filter((id) => !known.includes(id)).join(', '), '— refreshing game data');
      Promise.resolve(ready).catch(() => {}).then(() => refreshData(true));
    }
  }
  if (!settings.get().league || !leagues.includes(settings.get().league)) {
    const main = leagues.find((l) => !/^(HC |Hardcore|Standard)/.test(l)) || leagues[0];
    if (settings.get().league) log('league ended:', settings.get().league, '→', main);
    settings.set({ league: main });
    send('league', main);
  }
  if (changed) refreshTray();
}

// «Refresh game data» (patch day): fresh trade dictionaries, RePoE and client-language names — without a restart.
// quiet — started by us (new league): report only errors.
async function refreshData(quiet = false) {
  api.clearCache();
  craft.reset();
  clientLang.reset();
  stats.buildLocal(null);
  clientLangActive = 'en';
  ready = null;
  try {
    await ensureReady();
    await craft.load(api.cached);
    if (quiet) return;
    tray.displayBalloon({ title: 'PoE 2 Price Checker', content: t('Game data updated') });
  } catch (e) {
    tray.displayBalloon({ title: 'PoE 2 Price Checker', content: t('Failed to load data: {msg}', { msg: e.message }) });
  }
}

async function initData() {
  await Promise.all([refreshLeagues(), pricing.init()]); // independent: one round trip instead of two on a cold cache
  const league = settings.get().league;
  api.loadNinja(league).catch(() => {});
  // Demand for the first hotkey: without it the window waits for poe.ninja (or shows the item without demand).
  prewarmDemand(league, demandLevel(), api.fetchBuffer).catch((e) => log('demand prewarm', e.message));
  craft.load(api.cached).catch((e) => log('craft data', e.message)); // mod pool — also for "missing key mod"
}

// The hotkey is grabbed only while the game (or our window) is active: in other programs it stays theirs.
// Without koffi (couldn't query the active window) — keep it always, as before.
const GAME_TITLE = /^Path of Exile( 2)?$/;
let hotkeyOn = false;
let hotkeyBound = null; // which combination is currently grabbed — to release it on change

const { DEFAULT: DEFAULT_HOTKEY, validHotkey, hotkeyText } = require('./hotkeys');
const curHotkey = () => (validHotkey(settings.get().hotkey) ? settings.get().hotkey : DEFAULT_HOTKEY);
const hotkeyLabel = () => hotkeyText(curHotkey());

// Changing the combination. Taken by another program — keep the previous one and return false.
function setHotkey(hk) {
  if (!validHotkey(hk)) return false;
  if (hotkeyOn && hotkeyBound) globalShortcut.unregister(hotkeyBound);
  hotkeyOn = false;
  let free = false;
  try { free = globalShortcut.register(hk, () => {}); } catch {}
  if (free) globalShortcut.unregister(hk);
  if (free) settings.set({ hotkey: hk });
  syncHotkey();
  return free;
}
// While the settings window waits for a new combination, the hotkey is released — otherwise its press won't reach the window.
let capturing = false;

// The combination is taken by another program — log it and tell via the tray once, not every 250 ms.
let hotkeyFailed = null;
function syncHotkey() {
  const hk = curHotkey();
  let want = !capturing;
  if (want && settings.get().hotkeyGameOnly) {
    const fg = winapi.foreground();
    if (fg) want = GAME_TITLE.test(winapi.title(fg)) || (win && fg === winapi.hwndOf(win));
  }
  if (want && !hotkeyOn) {
    try {
      hotkeyOn = globalShortcut.register(hk, () => { log('hotkey in', JSON.stringify(winapi.title(winapi.foreground()))); onHotkey(); });
    } catch (e) { hotkeyOn = false; }
    hotkeyBound = hotkeyOn ? hk : null;
    if (!hotkeyOn && hotkeyFailed !== hk) {
      hotkeyFailed = hk;
      log('Failed to register hotkey', hk);
      if (tray) tray.displayBalloon({ title: 'PoE 2 Price Checker', content: t('{key} is taken by another program — choose another hotkey in Settings', { key: hotkeyLabel() }) });
    }
    if (hotkeyOn) hotkeyFailed = null;
  } else if (!want && hotkeyOn) {
    globalShortcut.unregister(hotkeyBound || hk);
    hotkeyOn = false;
  }
}

// «Updates» window — live update status (the tray menu closes after a click, progress can't be shown there).
let updWin = null;

function openUpdates() {
  if (updWin && !updWin.isDestroyed()) {
    updWin.show();
    updWin.focus();
  } else {
    updWin = new BrowserWindow({
      width: 380, height: 200, frame: false, resizable: false, alwaysOnTop: true, fullscreenable: false, show: false,
      title: t('Updates'), backgroundColor: '#0b1017', icon: ICON,
      webPreferences: { ...SECURE, preload: path.join(__dirname, 'preload-updates.js') },
    });
    updWin.setAlwaysOnTop(true, 'screen-saver');
    updWin.loadFile(path.join(__dirname, '../renderer/updates.html'));
    updWin.once('ready-to-show', () => updWin.show());
  }
  // Opened — check right away if we don't know about a new version yet.
  if (['idle', 'latest', 'error'].includes(updater.status.state)) updater.check();
}

function updStatus() {
  const fake = demo.fakeUpdateStatus();
  if (fake) return fake;
  return updater.available() ? updater.status : { ...updater.status, state: 'unavailable' };
}

// Tray item about updates — opens the «Updates» window; label depends on the state.
function updateItem() {
  const s = updater.status;
  const v = `v${app.getVersion()}`;
  const label = !updater.available() ? t('{v} (from source)', { v })
    : s.state === 'available' ? `⬇ ${t('Update v{v} available…', { v: s.version })}`
    : s.state === 'downloading' ? t('Downloading v{v}… {pct}%', { v: s.version, pct: Math.round((s.progress && s.progress.percent) || 0) })
    : s.state === 'ready' ? t('Restart to update to v{v}…', { v: s.version })
    : t('Check for updates ({v})…', { v });
  return { label, click: openUpdates };
}

// Changing the interface language: remember it, rebuild the tray and notify windows — they re-render immediately.
function setUiLang(lang) {
  settings.set({ uiLang: lang });
  i18n.setLang(lang);
  refreshTray();
  for (const w of [win, cmpWin, updWin, setWin]) if (w && !w.isDestroyed()) w.webContents.send('ui-lang', lang);
  if (updWin && !updWin.isDestroyed()) updWin.setTitle(t('Updates'));
  if (setWin && !setWin.isDestroyed()) setWin.setTitle(t('Settings'));
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.on('double-click', () => openSettings());
  const refresh = () => {
    const cur = settings.get().league;
    tray.setToolTip(`PoE 2 Price Checker — ${t('{key} over an item', { key: hotkeyLabel() })}`);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'PoE 2 Price Checker', enabled: false },
      { label: t('{key} — price check the item under cursor', { key: hotkeyLabel() }), enabled: false },
      { type: 'separator' },
      {
        label: t('League: {name}', { name: cur || '…' }),
        submenu: leagues.map((l) => ({ label: l, type: 'radio', checked: l === cur, click: () => applySettings({ league: l }) })),
      },
      { label: t('Settings…'), click: () => openSettings() },
      { type: 'separator' },
      updateItem(),
      { type: 'separator' },
      { label: t('Quit'), click: () => app.quit() },
    ]));
    if (setWin && !setWin.isDestroyed()) setWin.webContents.send('settings', settingsSnapshot());
  };
  refresh();
  return refresh;
}

// ---- settings: one place where they change (settings window, tray, overlay), with value validation ----
const LANGS = ['en', 'ru'];
const CLIENT_LANGS = ['auto', 'en', 'ru'];
function settingsSnapshot() {
  const s = settings.get();
  return { hotkey: curHotkey(), hotkeyLabel: hotkeyLabel(), hotkeyGameOnly: !!s.hotkeyGameOnly, startWithWindows: !!s.startWithWindows,
    packaged: app.isPackaged, uiLang: i18n.getLang(), clientLang: s.clientLang || 'auto', league: s.league, leagues,
    uiScale: uiScale(), scales: SCALES, windowPos: !!s.windowPos, wideWindow: s.wideWindow === 'on' ? 'on' : 'off' };
}
// → { ok, error? }: an unknown or invalid value isn't saved.
function applySettings(patch) {
  const p = patch || {};
  let error = null;
  if (LANGS.includes(p.uiLang) && p.uiLang !== i18n.getLang()) setUiLang(p.uiLang);
  if (CLIENT_LANGS.includes(p.clientLang)) settings.set({ clientLang: p.clientLang });
  if (p.league !== undefined && leagues.includes(p.league) && p.league !== settings.get().league) {
    settings.set({ league: p.league });
    // The open window shows the league in its header and searched in the old one: tell it.
    send('league', p.league);
    api.loadNinja(p.league).catch(() => {});
  }
  if (p.hotkey !== undefined && p.hotkey !== curHotkey()) {
    if (!validHotkey(p.hotkey)) error = t('Use Ctrl or Alt with a letter, digit or F1–F12');
    else if (!setHotkey(p.hotkey)) error = t('{key} is taken by another program', { key: hotkeyText(p.hotkey) });
  }
  if (typeof p.hotkeyGameOnly === 'boolean') { settings.set({ hotkeyGameOnly: p.hotkeyGameOnly }); syncHotkey(); }
  if (typeof p.startWithWindows === 'boolean' && app.isPackaged) {
    settings.set({ startWithWindows: p.startWithWindows });
    app.setLoginItemSettings({ openAtLogin: p.startWithWindows });
  }
  if (SCALES.includes(p.uiScale)) {
    settings.set({ uiScale: p.uiScale });
    applyScale();
    if (win && win.isVisible()) win.webContents.send('refit');
  }
  if (['on', 'off'].includes(p.wideWindow)) {
    settings.set({ wideWindow: p.wideWindow });
    if (win && win.isVisible()) win.webContents.send('refit', { wide: p.wideWindow === 'on' });
  }
  if (typeof p.searchOnline === 'boolean') settings.set({ searchOnline: p.searchOnline });
  if (typeof p.searchFlex === 'boolean') settings.set({ searchFlex: p.searchFlex });
  refreshTray();
  return error ? { ok: false, error } : { ok: true };
}

let setWin = null;
// welcome — first launch: a "what you need to know" card on top (screen mode, hotkey, tray).
function openSettings(welcome = false) {
  if (setWin && !setWin.isDestroyed()) { setWin.show(); setWin.focus(); return; }
  setWin = new BrowserWindow({
    width: 420, height: 520, frame: false, resizable: false, alwaysOnTop: true, fullscreenable: false, show: false,
    title: t('Settings'), backgroundColor: '#0b1017', icon: ICON,
    webPreferences: { ...SECURE, preload: path.join(__dirname, 'preload-settings.js') },
  });
  setWin.setAlwaysOnTop(true, 'screen-saver');
  setWin.loadFile(path.join(__dirname, '../renderer/settings.html'), welcome ? { query: { welcome: '1' } } : undefined);
  setWin.once('ready-to-show', () => setWin.show());
  setWin.on('closed', () => { if (capturing) { capturing = false; syncHotkey(); } setWin = null; });
}

// IPC: each channel accepts calls only from its own window (the competitor card shows trade data — it has
// no reason to search or write to the game chat).
const isFrom = (w) => (e) => !!(w && !w.isDestroyed() && e.sender === w.webContents);
const FROM = {
  overlay: (e) => isFrom(win)(e),
  compare: (e) => isFrom(cmpWin)(e),
  updates: (e) => isFrom(updWin)(e),
  settings: (e) => isFrom(setWin)(e),
  any: (e) => isFrom(win)(e) || isFrom(updWin)(e) || isFrom(setWin)(e),
};
function handle(channel, allowed, fn) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!allowed(e)) { log('ipc: rejected', channel); throw new Error('not allowed'); }
    return fn(e, ...args);
  });
}
const DEMAND_LEVELS = [80, 90, 95, 98];

app.whenReady().then(singleInstance).then((ok) => {
  if (!ok) { app.quit(); return; }
  // Launched again (desktop shortcut) — the app is already in the tray: show settings rather than stay silent.
  app.on('second-instance', () => openSettings());
  // First launch (no league chosen yet — not an update): the app doesn't silently go to the tray, it explains how to use it.
  if (!settings.get().welcomed) {
    if (!settings.get().league && !demo.enabled) setTimeout(() => openSettings(true), 1500);
    settings.set({ welcomed: true });
  }
  i18n.setLang(settings.get().uiLang);
  ipcMain.on('ui-lang-get', (e) => { e.returnValue = i18n.getLang(); });
  createOverlay();
  createCompare();
  refreshTray = buildTray();
  let lastNotified = null;
  updater.init((s) => {
    refreshTray();
    if (updWin && !updWin.isDestroyed()) updWin.webContents.send('upd-status', updStatus());
    // Background check found a new version / downloaded it — notification (click opens the «Updates» window).
    const say = (content) => tray.displayBalloon({ title: 'PoE 2 Price Checker', content });
    const key = `${s.state}:${s.version}`;
    if (key === lastNotified || (updWin && updWin.isVisible())) return;
    if (s.state === 'available') say(t('Update v{v} is available — click to open.', { v: s.version }));
    if (s.state === 'ready') say(t('Update v{v} is downloaded — click to install.', { v: s.version }));
    if (s.state === 'available' || s.state === 'ready') lastNotified = key;
  });
  tray.on('balloon-click', openUpdates);
  api.onWait = (ms) => send('status', { waitUntil: Date.now() + ms }); // the window runs a countdown
  ensureReady().catch(() => {});

  if (!demo.enabled) {
    syncHotkey();
    setInterval(syncHotkey, 250);
    setInterval(() => refreshLeagues().catch((e) => log('leagues', e.message)), 6 * 3600e3);
  }

  // Demo mode (checking without the game) — see demo.js.
  demo.run({ ready: ensureReady(), priceCheck, openUpdates, openSettings, windows: () => ({ main: win, cmp: cmpWin, upd: updWin, set: setWin }) });

  handle('search', FROM.overlay, (_e, item, filters, relax) => (demo.mockTrade()
    ? demo.mockSearch(api.ninja.rates) : api.forCurrent(() => pricing.search(curLeague(), item, filters, relax))));
  handle('icons', FROM.overlay, (_e, keys) => require('./icons').icons(keys));
  handle('unique-price', FROM.overlay, (_e, name, base) => api.uniquePrice(curLeague(), name, base));
  handle('quick-price', FROM.overlay, (_e, item, filters) => (demo.mockTrade()
    ? demo.mockQuick() : api.forCurrent(() => pricing.quick(curLeague(), item, filters))));
  handle('set-league', FROM.overlay, async (_e, l) => {
    if (!leagues.includes(l)) throw new Error(`unknown league ${l}`);
    settings.set({ league: l });
    refreshTray();
    await api.loadNinja(l).catch(() => {});
    return true;
  });
  handle('builds', FROM.overlay, (_e, opts) => popularBuilds({ ...opts, league: curLeague(), limit: 5, minLevel: demandLevel() }, api.fetchBuffer));
  handle('craft', FROM.overlay, async () => {
    if (!lastItem) return { note: t('No item') };
    const league = curLeague();
    const rarity = 'Rare'; // normal and magic items are craft bases: look at demand for rares of that class
    const d = await categoryDemand({ league, itemClass: lastItem.itemClass, rarity, limit: 80, minLevel: demandLevel(), ...demandScope(lastItem, lastThemeMods) },
      api.fetchBuffer).catch(() => null);
    const r = await craft.advise(lastItem, d && d.mods, api.cached, { priceKeys: lastPriceKeys });
    // Currency prices for crafting cost estimates (div each; not on poe.ninja — null).
    const prices = {};
    for (const name of ['Vaal Orb', 'Omen of Sanctification', 'Divine Orb', 'Orb of Transmutation', 'Greater Orb of Transmutation', 'Perfect Orb of Transmutation', 'Orb of Annulment', 'Fracturing Orb', "Hinekora's Lock", 'Omen of Putrefaction', 'Chaos Orb', 'Greater Chaos Orb', 'Perfect Chaos Orb', 'Omen of Whittling', 'Omen of Sinistral Erasure', 'Omen of Dextral Erasure', 'Regal Orb', 'Greater Regal Orb', 'Perfect Regal Orb']) { const row = api.ninja.byName.get(name); prices[name] = row ? row.divine : null; }
    for (const a of r.augments || []) { const row = api.ninja.byName.get(a.name); prices[a.name] = row ? row.divine : null; }
    // Emotions on jewels (variants section) — their prices vary a lot: Potent Ferocity ≈ 6 div, coloured ones — a few ex.
    for (const s of r.sections || []) for (const o of s.options || []) { const row = api.ninja.byName.get(o.name); prices[o.name] = row ? row.divine : null; }
    for (const s of (r.goal && r.goal.plan) || []) {
      for (const name of [...s.currencies, ...(s.retry || []), ...(s.options || [])]) {
        const row = api.ninja.byName.get(name);
        prices[name] = row ? row.divine : null;
      }
    }
    // Prices from a handful of trades (poe.ninja volume): the window marks them — in Standard a Greater Exalted Orb trades
    // a few times a day, its price is a guess.
    const thin = Object.keys(prices).filter((name) => { const row = api.ninja.byName.get(name); return row && (row.volume || 0) < 10; });
    return { ...r, prices, thin, theme: d ? d.themed : [], themeBuilds: d ? d.total : null };
  });
  handle('demand', FROM.overlay, async (_e, opts) => forBase(await categoryDemand({ ...opts, league: curLeague(), limit: 80, minLevel: demandLevel(), ...demandScope(lastItem, opts && opts.withMods) }, api.fetchBuffer), lastItem)); // 80 — to also find the item's mods outside the top 10
  handle('copy', FROM.overlay, (_e, t) => clipboard.writeText(String(t).slice(0, 4000)));
  handle('demand-level', FROM.overlay, () => settings.get().demandLevel || 90);
  handle('set-demand-level', FROM.overlay, (_e, l) => { if (DEMAND_LEVELS.includes(l)) settings.set({ demandLevel: l }); });
  // Only whispers go to the game chat («@Name text»): the window must not be able to type arbitrary text in the game.
  // Doesn't look like a whisper — don't type it in the game, but put it on the clipboard (to paste manually) and log why.
  handle('whisper-game', FROM.overlay, async (_e, t) => {
    const ok = typeof t === 'string' && /^@\S+ /.test(t) && t.length <= 512 && !/[\r\n]/.test(t);
    if (ok) return whisperInGame(t, gameHwnd);
    log(`whisper: not a whisper (${typeof t}, ${String(t).length} chars, starts ${JSON.stringify(String(t).slice(0, 2))})`);
    await clipboard.writeText(String(t || '').slice(0, 4000));
    return false;
  });
  handle('listing-url', FROM.overlay, (_e, item, filters, account) => (demo.mockTrade() ? 'https://www.pathofexile.com/trade2'
    : api.forCurrent(() => pricing.listingUrl(curLeague(), item, filters, account))));
  handle('open-url', FROM.any, (_e, u) => {
    if (typeof u === 'string' && /^https:\/\/((www\.)?pathofexile\.com|poe\.ninja|poe2db\.tw|github\.com\/zhurauljou\/poe2-advanced-price-check)\//.test(u)) shell.openExternal(u);
  });
  handle('upd-ready', FROM.updates, (e) => e.sender.send('upd-status', updStatus()));
  handle('upd-check', FROM.updates, () => updater.check());
  handle('upd-download', FROM.updates, () => updater.download());
  handle('upd-install', FROM.updates, () => updater.install());
  handle('upd-close', FROM.updates, () => { if (updWin && !updWin.isDestroyed()) updWin.close(); });
  handle('upd-fit', FROM.updates, (_e, h) => {
    if (!Number.isFinite(h)) return;
    if (updWin && !updWin.isDestroyed()) updWin.setContentSize(380, Math.min(Math.ceil(h) + 2, 400));
  });
  handle('element-variants', FROM.overlay, (_e, item, filters) => {
    const price = (n) => { const row = api.ninja.byName.get(n); return row ? row.divine : null; };
    const runes = (item.modLines || []).filter((l) => l.tag === 'rune').length;
    const socket = (item.sockets || 0) > runes ? 0 : price("Artificer's Orb");
    return pricing.elementVariants(item, filters).map((v) => ({ ...v, cost: (price(v.rune) ?? 0) + (socket || 0), needSocket: !!socket }));
  });
  handle('hide', FROM.overlay, () => hide());
  // Settings window
  handle('settings-get', FROM.settings, () => settingsSnapshot());
  handle('settings-set', FROM.settings, (_e, patch) => ({ ...applySettings(patch), settings: settingsSnapshot() }));
  handle('settings-capture', FROM.settings, (_e, on) => { capturing = !!on; syncHotkey(); });
  handle('settings-action', FROM.settings, (_e, act) => {
    if (act === 'reset-position') { settings.set({ windowPos: null }); refreshTray(); }
    if (act === 'refresh-data') refreshData();
    if (act === 'open-logs') shell.openPath(app.getPath('userData'));
    if (act === 'close' && setWin) setWin.close();
    return settingsSnapshot();
  });
  handle('settings-fit', FROM.settings, (_e, h) => { if (Number.isFinite(h) && setWin) setWin.setContentSize(420, Math.min(Math.ceil(h) + 2, 900)); });
  // The overlay remembers search toggles («Buyable now», «Allow 1 minor mod missing») — the next item gets the same.
  handle('set-search-defaults', FROM.overlay, (_e, p) => { applySettings({ searchOnline: p && p.online, searchFlex: p && p.flex }); });
  handle('exchange-offers', FROM.overlay, (_e, want, have) => {
    if (!pricing.isExchangeable(want) || !pricing.isExchangeable(have) || want === have) throw new Error('not on the exchange');
    return api.forCurrent(() => pricing.exchangeOffers(curLeague(), want, have));
  });
  handle('limit-wait', FROM.overlay, () => api.limitWait());
  handle('recheck', FROM.overlay, () => (lastText ? priceCheck(lastText, true, lastHistoryId) : null));
  // Check history
  handle('history', FROM.overlay, () => history.brief());
  handle('history-open', FROM.overlay, (_e, id) => { const h = history.get(id); return h ? priceCheck(h.text, true, h.id) : null; });
  handle('history-price', FROM.overlay, (_e, id, est) => history.setPrice(id, est));
  handle('pin', FROM.overlay, (_e, on) => { pinned = !!on; syncEsc(); });
  handle('set-wide', FROM.overlay, (_e, on) => { settings.set({ wideWindow: on ? 'on' : 'off' }); });
  handle('compare-show', FROM.overlay, (_e, html, y) => {
    if (typeof html !== 'string' || !Number.isFinite(y)) return;
    cmpY = win.getBounds().y + y;
    cmpWin.webContents.send('compare', html);
  });
  handle('compare-fit', FROM.compare, (_e, h) => { if (Number.isFinite(h) && win.isVisible()) placeCompare(h * uiScale()); });
  handle('compare-hide', FROM.overlay, () => cmpWin.hide());
  // → { capped, wide }: the window hit the screen height (content scrolls); wide — two columns fit the screen width.
  handle('fit', FROM.overlay, (_e, h, wide) => {
    if (!Number.isFinite(h)) return null;
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    const want = Math.ceil(h * uiScale());
    const height = Math.min(want, area.height - 20);
    const b = win.getBounds();
    const width = wide && WW() <= area.width - 20 ? WW() : W();
    // Keep the top in place; move up only while the window doesn't fit, and move back when it fits again.
    const y = Math.max(area.y, Math.min(anchorY, area.y + area.height - height));
    // Got wider — don't go past the screen's right edge (shift left).
    const x = Math.max(area.x, Math.min(b.x, area.x + area.width - width));
    place({ x, y, width, height });
    return { capped: want > height, wide: width > W() };
  });
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
