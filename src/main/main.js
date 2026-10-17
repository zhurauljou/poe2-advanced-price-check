const {
  app, BrowserWindow, globalShortcut, clipboard, screen, ipcMain, Tray, Menu, shell, nativeImage,
} = require('electron');
const path = require('path');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const settings = require('./settings');
const api = require('./api');
const pricing = require('./pricing');
const { log } = require('./log');
const winapi = require('./winapi');
const updater = require('./updater');
const { popularBuilds, categoryDemand } = require('./ninjaBuilds');
const craft = require('./craft');
let lastItem = null; // последний разобранный предмет — для советов по крафту
let lastThemeMods = []; // его ключевые моды — спрос для крафта считаем среди билдов с ними
const { parseItem } = require('./parser');
const stats = require('./stats');
const clientLang = require('./clientLang');
const i18n = require('../shared/i18n');
const { t } = i18n;

const WIDTH = 480;
const ICON = path.join(__dirname, '../../assets/icon.png');

let win = null;
let tray = null;
let pinned = false; // пошаговый крафт: окно не прячется при клике в игру
let interacted = false; // окно получало фокус (кликнули в него) — тогда клик обратно в игру его прячет
let leagues = [];
let ready = null; // промис загрузки справочников
let refreshTray = () => {};

const demo = require('./demo');
// Спрос (poe.ninja builds) — среди персонажей от этого уровня (80 / 90 / 95, переключатель на вкладке Demand).
// 80 — без фильтра: poe.ninja и так учитывает только 80+.
const demandLevel = () => { const l = settings.get().demandLevel || 90; return l > 80 ? l : null; };
// Демо-прогон живёт в своей папке данных, чтобы работать рядом с запущенной копией из трея.
if (demo.enabled) app.setPath('userData', app.getPath('userData') + '-demo');
// Одна копия. После обновления установщик запускает новую версию, пока старая ещё закрывается, — поэтому, не получив
// блокировку сразу, ждём до 10 с, пока старая не выйдет; только потом считаем себя лишней копией и выходим.
async function singleInstance() {
  for (let i = 0; i < 20; i++) {
    if (app.requestSingleInstanceLock()) return true;
    await sleep(500);
  }
  return false;
}

// Ошибка в фоне не должна всплывать системным окном поверх игры — пишем в лог и работаем дальше.
process.on('uncaughtException', (e) => log('uncaught', e));
process.on('unhandledRejection', (e) => log('unhandled', e));

// Карточка конкурента — отдельное окно сбоку от оверлея, чтобы не закрывать его содержимое.
const CMP_WIDTH = 440;
let cmpWin = null;
let cmpY = 0; // экранная Y строки лота, напротив которой показываем карточку

function createCompare() {
  cmpWin = new BrowserWindow({
    width: CMP_WIDTH, height: 300, show: false, frame: false, resizable: false, skipTaskbar: true,
    alwaysOnTop: true, focusable: false, fullscreenable: false, backgroundColor: '#0a0d12',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false },
  });
  cmpWin.setAlwaysOnTop(true, 'screen-saver');
  cmpWin.loadFile(path.join(__dirname, '../renderer/compare.html'));
}

// Справа от оверлея, не влезает — слева; по высоте — напротив строки лота, в пределах экрана.
function placeCompare(height) {
  const b = win.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  let x = b.x + b.width + 6;
  if (x + CMP_WIDTH > area.x + area.width) x = b.x - CMP_WIDTH - 6;
  const h = Math.min(Math.ceil(height), area.height - 10);
  const y = Math.max(area.y, Math.min(cmpY - 40, area.y + area.height - h));
  cmpWin.setBounds({ x: Math.round(x), y: Math.round(y), width: CMP_WIDTH, height: h });
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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  // Уровень screen-saver держит окно над полноэкранным-в-окне клиентом игры.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.on('focus', () => { interacted = true; });
  win.on('blur', () => { if (interacted && !pinned) hide(); });
  // Пользователь перетащил окно — запоминаем место, дальше открываемся там же.
  win.on('moved', () => {
    if (positioning || !win.isVisible()) return;
    const [x, y] = win.getPosition();
    anchorY = y;
    settings.set({ windowPos: { x, y } });
    refreshTray();
  });
}

// Свои перемещения (show, подгонка высоты) не должны записываться как «пользователь перетащил».
let positioning = false;
let anchorY = 0; // верх окна, который хотим держать; сдвигаем вверх, только если окно не влезает по высоте

function place(bounds) {
  positioning = true;
  win.setBounds(bounds);
  setTimeout(() => { positioning = false; }, 150);
}

// Запомненное место — если оно ещё на каком-то мониторе (монитор могли отключить).
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
    // Не двигали ни разу — рядом с курсором: справа, а если не влезает — слева.
    const cur = screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(cur).workArea;
    x = cur.x + 24;
    if (x + WIDTH > area.x + area.width) x = cur.x - WIDTH - 24;
    y = Math.max(area.y, cur.y - 120);
  }
  anchorY = Math.round(y);
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  place({ x: Math.round(x), y: Math.min(anchorY, area.y + area.height - h), width: WIDTH, height: h });
  interacted = false;
  win.showInactive(); // не забираем фокус у игры
  globalShortcut.register('Escape', hide);
}

// Окно игры — активное окно в момент Ctrl+D. Ему возвращаем фокус, когда закрываем оверлей,
// в который кликали (крестик, Esc после клика): сам Windows фокус игре не отдаёт.
let gameHwnd = 0;

function hide() {
  globalShortcut.unregister('Escape');
  if (cmpWin) cmpWin.hide();
  if (!win || !win.isVisible()) return;
  if (win.isFocused() && gameHwnd) winapi.focus(gameHwnd);
  win.hide();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ctrl+C «по-человечески»: игра опрашивает клавиатуру раз в кадр и мгновенное нажатие (keyTap) может
// пропустить — держим C нажатой ~30 мс.
async function pressCopy() {
  uIOhook.keyToggle(UiohookKey.Ctrl, 'down');
  await sleep(15);
  uIOhook.keyToggle(UiohookKey.C, 'down');
  await sleep(30);
  uIOhook.keyToggle(UiohookKey.C, 'up');
  await sleep(10);
  uIOhook.keyToggle(UiohookKey.Ctrl, 'up');
}

async function tap(key, mod) {
  if (mod) { uIOhook.keyToggle(mod, 'down'); await sleep(15); }
  uIOhook.keyToggle(key, 'down');
  await sleep(30);
  uIOhook.keyToggle(key, 'up');
  if (mod) { await sleep(10); uIOhook.keyToggle(mod, 'up'); }
}

// У оружия poe.ninja считает моды и базы всего оружия персонажа (основное, второе, на смене): в «Rare Sceptre»
// попадают палочки, посохи, копья — до 44% надеваний (аудит по всем классам). Броня и бижутерия — чистые.
// Оставляем базы того же класса; мод убираем, только если на этой базе его быть не может, а на чужой базе из списка — может
// (анойнты, энчанты, руны не трогаем — их нет в пуле ни у кого). Всё, что есть на самой вещи, — всегда.
function forBase(d, item) {
  if (!d || !item) return d;
  const key = (s) => String(s || '').replace(/ \(Local\)$/, '').replace(/\+#/g, '#').toLowerCase();
  const own = new Set((item.mods || []).map((m) => key(m.template)));
  const foreign = d.bases.filter((b) => craft.sameClass(item.baseType, b.name) === false).map((b) => b.name);
  const alien = (name) => craft.canAppear(item.baseType, name) === false && foreign.some((b) => craft.canAppear(b, name));
  return { ...d,
    mods: d.mods.filter((r) => own.has(key(r.name)) || !alien(r.name)),
    bases: d.bases.filter((b) => !foreign.includes(b.name)) };
}

// Шёпот продавцу в игре: переключаемся в игру, открываем чат (Enter) и вставляем текст (Ctrl+V).
// Отправляет сам игрок — своим Enter: одно действие на сервере = одно нажатие игрока.
async function whisperInGame(text) {
  clipboard.writeText(text);
  if (!gameHwnd) return false;
  winapi.focus(gameHwnd);
  await sleep(150);
  if (winapi.foreground() !== gameHwnd) return false;
  await tap(UiohookKey.Enter);
  await sleep(120);
  await tap(UiohookKey.V, UiohookKey.Ctrl);
  return true;
}

// Нажимаем Ctrl+C за пользователя и ждём, пока игра положит текст предмета в буфер.
// Не ответила за 400 мс — пробуем ещё раз.
async function copyItem() {
  const prev = clipboard.readText();
  clipboard.writeText('');
  let text = '';
  for (let attempt = 0; attempt < 2 && !text; attempt++) {
    await pressCopy();
    for (let i = 0; i < 20 && !text; i++) {
      await sleep(20);
      text = clipboard.readText();
    }
    if (!text) log(`copy: clipboard empty after attempt ${attempt + 1}`);
  }
  // Возвращаем пользователю прежний буфер. Строку с «битыми» символами (половинка эмодзи и т.п.)
  // Electron записать не может — тогда просто оставляем буфер как есть.
  if (prev) {
    setTimeout(() => {
      try { clipboard.writeText(prev.toWellFormed ? prev.toWellFormed() : prev); } catch {}
    }, 50);
  }
  return text;
}

let copying = false;

async function onHotkey() {
  // Удержание Ctrl+D шлёт хоткей повторно — параллельные копирования портят друг другу буфер.
  if (copying) return;
  copying = true;
  try {
    const fg = winapi.foreground();
    if (fg && fg !== winapi.hwndOf(win)) gameHwnd = fg;
    // Фокус у нашего окна (кликнули в него) — Ctrl+C ушёл бы ему, а не игре. Прячем и отдаём фокус игре.
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

// Язык клиента игры: auto — по первой строке текста («Класс предмета:» — русский). Для не-английского —
// названия предметов и справочник модов этого языка (грузим один раз), текст переводим в английский эквивалент.
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
    await clientLang.load(lang, app.getPath('userData'), api.fetchBuffer);
    stats.buildLocal(await api.cached(`stats-${lang}.json`, `https://${lang}.pathofexile.com/api/trade2/data/stats`));
  }
  clientLangActive = lang;
}

async function priceCheck(text) {
  const lang = detectClientLang(text);
  try {
    await useClientLang(lang);
  } catch (e) {
    log('client language', lang, e);
  }
  if (lang !== 'en') text = clientLang.toEnglish(text, lang);
  const item = parseItem(text);
  if (!item) {
    log('not an item:', text.slice(0, 80));
    return; // курсор не над предметом
  }
  // Текст последнего предмета — для разбора ошибок парсера.
  try { require('fs').writeFileSync(path.join(app.getPath('userData'), 'last-item.txt'), text); } catch {}
  try {
    await ready;
  } catch (e) {
    send('status', { error: t('Failed to load data: {msg}', { msg: e.message }) });
  }
  const league = settings.get().league;
  // Цены этой лиги уже есть — показываем сразу, свежие докачаются в фоне. Нет — ждём (иначе нечего показать).
  // Ошибку глотаем: нет цен poe.ninja для лиги — трейд всё равно работает.
  const ninja = api.loadNinja(league).catch((e) => log('ninja', e.message));
  if (api.ninja.league !== league) await ninja;
  // Спрос по классу вещей (poe.ninja) — влияет на то, какие моды включены и насколько строго. Кэшируется,
  // поэтому ждём только в первый раз и не дольше 1.5 с; не успели — работаем без него.
  let demand = null;
  if (['Rare', 'Magic', 'Normal'].includes(item.rarity)) {
    const q = categoryDemand({ league, itemClass: item.itemClass, rarity: 'Rare', limit: 80, minLevel: demandLevel() },
      api.fetchBuffer).catch((e) => { log('demand', e.message); return null; });
    demand = await Promise.race([q, new Promise((r) => setTimeout(() => r(null), 1500))]);
  } else if (item.rarity === 'Unique' && item.name) {
    // Уник: какие из ЕГО модов носят билды — для случайных модов (Heart of the Well) это и есть ключевые.
    const q = popularBuilds({ league, uniqueName: item.name, limit: 1, minLevel: demandLevel() }, api.fetchBuffer)
      .then((b) => ({ mods: b.mods })).catch((e) => { log('demand', e.message); return null; });
    // Ждём дольше, чем у редких: без спроса ключевые моды уника не отличить от второстепенных.
    demand = await Promise.race([q, new Promise((r) => setTimeout(() => r(null), 4000))]);
  }
  lastItem = item;
  const prepared = pricing.prepare(item, demand, (tpl) => craft.rollsOn(item.baseType, tpl));
  // Тема вещи для советов по крафту: два самых важных включённых мода (без сумм).
  lastThemeMods = prepared.filters.mods.filter((m) => m.enabled && m.statId && m.tag !== 'pseudo' && m.tag !== 'implicit' && m.tag !== 'rune' && !m.option)
    .sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 2).map((m) => m.text.split('\n')[0]);
  send('item', { ...prepared, league, leagues, priceCurrency: settings.get().priceCurrency || 'any', hotkey: hotkeyLabel() });
  show();
}

function send(ch, data) {
  if (win) win.webContents.send(ch, data);
}

async function initData() {
  const list = await api.tradeLeagues();
  leagues = list.result.map((l) => l.id);
  if (!settings.get().league || !leagues.includes(settings.get().league)) {
    const main = leagues.find((l) => !/^(HC |Hardcore|Standard)/.test(l)) || leagues[0];
    settings.set({ league: main });
  }
  await pricing.init();
  api.loadNinja(settings.get().league).catch(() => {});
  craft.load(api.cached).catch((e) => log('craft data', e.message)); // пул модов — и для «нет ключевого мода»
}

// Горячую клавишу занимаем, только пока активна игра (или наше окно): в остальных программах она остаётся их.
// Без koffi (не смогли спросить активное окно) — держим всегда, как раньше.
const GAME_TITLE = /^Path of Exile( 2)?$/;
let hotkeyOn = false;
let hotkeyBound = null; // какая комбинация сейчас занята — чтобы снять её при смене

// Варианты в меню трея. Игра читает клавиатуру напрямую и видит вторую клавишу комбинации, поэтому
// она не должна ничего делать в игре: D — шаг вправо (уводит от сундука), E по умолчанию свободнее.
const HOTKEYS = [['CommandOrControl+E', 'Ctrl+E'], ['CommandOrControl+D', 'Ctrl+D'], ['CommandOrControl+Shift+E', 'Ctrl+Shift+E']];
const hotkeyLabel = () => (HOTKEYS.find(([k]) => k === settings.get().hotkey) || [0, settings.get().hotkey])[1];

function setHotkey(hk) {
  if (hotkeyOn && hotkeyBound) globalShortcut.unregister(hotkeyBound);
  hotkeyOn = false;
  settings.set({ hotkey: hk });
  syncHotkey();
}

function syncHotkey() {
  const hk = settings.get().hotkey;
  let want = true;
  if (settings.get().hotkeyGameOnly) {
    const fg = winapi.foreground();
    if (fg) want = GAME_TITLE.test(winapi.title(fg)) || (win && fg === winapi.hwndOf(win));
  }
  if (want && !hotkeyOn) {
    hotkeyOn = globalShortcut.register(hk, () => { log('hotkey in', JSON.stringify(winapi.title(winapi.foreground()))); onHotkey(); });
    hotkeyBound = hotkeyOn ? hk : null;
    if (!hotkeyOn) log('Failed to register hotkey', hk);
  } else if (!want && hotkeyOn) {
    globalShortcut.unregister(hotkeyBound || hk);
    hotkeyOn = false;
  }
}

// Окно «Updates» — живой статус обновления (меню трея закрывается после клика, в нём прогресс не показать).
let updWin = null;

function openUpdates() {
  if (updWin && !updWin.isDestroyed()) {
    updWin.show();
    updWin.focus();
  } else {
    updWin = new BrowserWindow({
      width: 380, height: 200, frame: false, resizable: false, alwaysOnTop: true, fullscreenable: false, show: false,
      title: t('Updates'), backgroundColor: '#0b1017', icon: ICON,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
    });
    updWin.setAlwaysOnTop(true, 'screen-saver');
    updWin.loadFile(path.join(__dirname, '../renderer/updates.html'));
    updWin.once('ready-to-show', () => updWin.show());
  }
  // Открыли — сразу проверяем, если ещё не знаем о новой версии.
  if (['idle', 'latest', 'error'].includes(updater.status.state)) updater.check();
}

function updStatus() {
  const fake = demo.fakeUpdateStatus();
  if (fake) return fake;
  return updater.available() ? updater.status : { ...updater.status, state: 'unavailable' };
}

// Пункт трея про обновление — открывает окно «Updates»; подпись — по состоянию.
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

// Смена языка интерфейса: запоминаем, перестраиваем трей и сообщаем окнам — они перерисуются сразу.
function setUiLang(lang) {
  settings.set({ uiLang: lang });
  i18n.setLang(lang);
  refreshTray();
  for (const w of [win, cmpWin, updWin]) if (w && !w.isDestroyed()) w.webContents.send('ui-lang', lang);
  if (updWin && !updWin.isDestroyed()) updWin.setTitle(t('Updates'));
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  const refresh = () => {
    const cur = settings.get().league;
    tray.setToolTip(`PoE 2 Price Checker — ${t('{key} over an item', { key: hotkeyLabel() })}`);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'PoE 2 Price Checker', enabled: false },
      { label: t('{key} — price check the item under cursor', { key: hotkeyLabel() }), enabled: false },
      { type: 'separator' },
      {
        label: t('League: {name}', { name: cur || '…' }),
        submenu: leagues.map((l) => ({
          label: l, type: 'radio', checked: l === cur,
          click: () => { settings.set({ league: l }); api.loadNinja(l).catch(() => {}); refresh(); },
        })),
      },
      { type: 'separator' },
      {
        label: t('Hotkey'),
        submenu: HOTKEYS.map(([k, label]) => ({
          label, type: 'radio', checked: settings.get().hotkey === k,
          click: () => { setHotkey(k); refresh(); },
        })),
      },
      {
        label: t('Hotkey only in Path of Exile'), type: 'checkbox', checked: settings.get().hotkeyGameOnly,
        click: (mi) => { settings.set({ hotkeyGameOnly: mi.checked }); syncHotkey(); },
      },
      {
        // Автозапуск имеет смысл только у установленной программы, не у запуска из исходников.
        label: t('Start with Windows'), type: 'checkbox', checked: settings.get().startWithWindows, enabled: app.isPackaged,
        click: (mi) => { settings.set({ startWithWindows: mi.checked }); app.setLoginItemSettings({ openAtLogin: mi.checked }); },
      },
      {
        label: t('Reset window position'), enabled: !!settings.get().windowPos,
        click: () => { settings.set({ windowPos: null }); refresh(); },
      },
      {
        // Язык интерфейса: названия языков — на своём языке, чтобы найти нужный при любом выбранном.
        label: t('Interface language'),
        submenu: [['en', 'English'], ['ru', 'Русский']].map(([l, label]) => ({
          label, type: 'radio', checked: i18n.getLang() === l,
          click: () => setUiLang(l),
        })),
      },
      {
        // Язык клиента игры: как читать скопированный предмет. Auto — по самому тексту.
        label: t('Game client language'),
        submenu: [['auto', t('Auto')], ['en', 'English'], ['ru', 'Русский']].map(([l, label]) => ({
          label, type: 'radio', checked: (settings.get().clientLang || 'auto') === l,
          click: () => { settings.set({ clientLang: l }); refresh(); },
        })),
      },
      { type: 'separator' },
      updateItem(),
      { type: 'separator' },
      { label: t('Quit'), click: () => app.quit() },
    ]));
  };
  refresh();
  return refresh;
}

app.whenReady().then(singleInstance).then((ok) => {
  if (!ok) { app.quit(); return; }
  i18n.setLang(settings.get().uiLang);
  ipcMain.on('ui-lang-get', (e) => { e.returnValue = i18n.getLang(); });
  createOverlay();
  createCompare();
  refreshTray = buildTray();
  let lastNotified = null;
  updater.init((s) => {
    refreshTray();
    if (updWin && !updWin.isDestroyed()) updWin.webContents.send('upd-status', updStatus());
    // Фоновая проверка нашла новую версию / скачали — уведомление (клик открывает окно «Updates»).
    const say = (content) => tray.displayBalloon({ title: 'PoE 2 Price Checker', content });
    const key = `${s.state}:${s.version}`;
    if (key === lastNotified || (updWin && updWin.isVisible())) return;
    if (s.state === 'available') say(t('Update v{v} is available — click to open.', { v: s.version }));
    if (s.state === 'ready') say(t('Update v{v} is downloaded — click to install.', { v: s.version }));
    if (s.state === 'available' || s.state === 'ready') lastNotified = key;
  });
  tray.on('balloon-click', openUpdates);
  api.onWait = (ms) => send('status', { text: t('Waiting for the trade site rate limit… {n} s', { n: Math.ceil(ms / 1000) }) });
  ready = initData().then(refreshTray);
  ready.catch((e) => log('init failed', e));

  if (!demo.enabled) {
    syncHotkey();
    setInterval(syncHotkey, 250);
  }

  // Демо-режим (проверка без игры) — см. demo.js.
  demo.run({ ready, priceCheck, openUpdates, windows: () => ({ main: win, cmp: cmpWin, upd: updWin }) });

  ipcMain.handle('search', (_e, item, filters, relax) => (demo.mockTrade()
    ? demo.mockSearch(api.ninja.rates) : pricing.search(settings.get().league, item, filters, relax)));
  ipcMain.handle('unique-price', (_e, name, base) => api.uniquePrice(settings.get().league, name, base));
  ipcMain.handle('quick-price', (_e, item, filters) => (demo.mockTrade()
    ? demo.mockQuick() : pricing.quick(settings.get().league, item, filters)));
  ipcMain.handle('set-league', async (_e, l) => {
    settings.set({ league: l });
    refreshTray();
    await api.loadNinja(l).catch(() => {});
    return true;
  });
  ipcMain.handle('builds', (_e, opts) => popularBuilds({ ...opts, league: settings.get().league, limit: 5, minLevel: demandLevel() }, api.fetchBuffer));
  ipcMain.handle('craft', async () => {
    if (!lastItem) return { note: t('No item') };
    const league = settings.get().league;
    const rarity = 'Rare'; // белые и магические — заготовки под крафт: смотрим спрос на редкие такого класса
    const d = await categoryDemand({ league, itemClass: lastItem.itemClass, rarity, limit: 80, withMods: lastThemeMods, minLevel: demandLevel() },
      api.fetchBuffer).catch(() => null);
    const r = await craft.advise(lastItem, d && d.mods, api.cached);
    // Цены валюты для расчёта затрат на крафт (div за штуку; нет на poe.ninja — null).
    const prices = {};
    for (const name of ['Vaal Orb', 'Omen of Sanctification', 'Divine Orb', 'Orb of Transmutation', 'Greater Orb of Transmutation', 'Perfect Orb of Transmutation', 'Orb of Annulment', 'Fracturing Orb', "Hinekora's Lock", 'Omen of Putrefaction', 'Chaos Orb', 'Greater Chaos Orb', 'Perfect Chaos Orb', 'Omen of Whittling', 'Omen of Sinistral Erasure', 'Omen of Dextral Erasure', 'Regal Orb', 'Greater Regal Orb', 'Perfect Regal Orb']) { const row = api.ninja.byName.get(name); prices[name] = row ? row.divine : null; }
    for (const a of r.augments || []) { const row = api.ninja.byName.get(a.name); prices[a.name] = row ? row.divine : null; }
    for (const s of (r.goal && r.goal.plan) || []) {
      for (const name of [...s.currencies, ...(s.retry || [])]) {
        const row = api.ninja.byName.get(name);
        prices[name] = row ? row.divine : null;
      }
    }
    return { ...r, prices, theme: d ? d.themed : [], themeBuilds: d ? d.total : null };
  });
  ipcMain.handle('demand', async (_e, opts) => forBase(await categoryDemand({ ...opts, league: settings.get().league, limit: 80, minLevel: demandLevel() }, api.fetchBuffer), lastItem)); // 80 — чтобы найти и моды вещи вне топ-10
  ipcMain.handle('set-price-currency', (_e, c) => { settings.set({ priceCurrency: c }); });
  ipcMain.handle('copy', (_e, t) => clipboard.writeText(t));
  ipcMain.handle('demand-level', () => settings.get().demandLevel || 90);
  ipcMain.handle('set-demand-level', (_e, l) => settings.set({ demandLevel: l }));
  ipcMain.handle('whisper-game', (_e, t) => whisperInGame(t));
  ipcMain.handle('listing-url', (_e, item, filters, account) => (demo.mockTrade() ? 'https://www.pathofexile.com/trade2'
    : pricing.listingUrl(settings.get().league, item, filters, account)));
  ipcMain.handle('open-url', (_e, u) => {
    if (/^https:\/\/((www\.)?pathofexile\.com|poe\.ninja|github\.com\/zhurauljou\/poe2-advanced-price-check)\//.test(u)) shell.openExternal(u);
  });
  ipcMain.handle('upd-ready', (e) => e.sender.send('upd-status', updStatus()));
  ipcMain.handle('upd-check', () => updater.check());
  ipcMain.handle('upd-download', () => updater.download());
  ipcMain.handle('upd-install', () => updater.install());
  ipcMain.handle('upd-close', () => { if (updWin && !updWin.isDestroyed()) updWin.close(); });
  ipcMain.handle('upd-fit', (_e, h) => {
    if (updWin && !updWin.isDestroyed()) updWin.setContentSize(380, Math.min(Math.ceil(h) + 2, 400));
  });
  ipcMain.handle('element-variants', (_e, item, filters) => {
    const price = (n) => { const row = api.ninja.byName.get(n); return row ? row.divine : null; };
    const runes = (item.modLines || []).filter((l) => l.tag === 'rune').length;
    const socket = (item.sockets || 0) > runes ? 0 : price("Artificer's Orb");
    return pricing.elementVariants(item, filters).map((v) => ({ ...v, cost: (price(v.rune) ?? 0) + (socket || 0), needSocket: !!socket }));
  });
  ipcMain.handle('hide', () => hide());
  ipcMain.handle('pin', (_e, on) => { pinned = !!on; });
  ipcMain.handle('compare-show', (_e, html, y) => {
    cmpY = win.getBounds().y + y;
    cmpWin.webContents.send('compare', html);
  });
  ipcMain.handle('compare-fit', (_e, h) => { if (win.isVisible()) placeCompare(h); });
  ipcMain.handle('compare-hide', () => cmpWin.hide());
  ipcMain.handle('fit', (_e, h) => {
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    const height = Math.min(Math.ceil(h), area.height - 20);
    const b = win.getBounds();
    // Держим верх на месте; вверх сдвигаем, только пока окно не влезает, и возвращаем, когда снова влезает.
    const y = Math.max(area.y, Math.min(anchorY, area.y + area.height - height));
    place({ x: b.x, y, width: WIDTH, height });
  });
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
