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
const { popularBuilds } = require('./ninjaBuilds');
const { parseItem } = require('./parser');

const WIDTH = 480;
const ICON = path.join(__dirname, '../../assets/icon.png');

let win = null;
let tray = null;
let interacted = false; // окно получало фокус (кликнули в него) — тогда клик обратно в игру его прячет
let leagues = [];
let ready = null; // промис загрузки справочников
let refreshTray = () => {};

const DEMO = process.argv.some((a) => a.startsWith('--demo='));
// Демо-прогон живёт в своей папке данных, чтобы работать рядом с запущенной копией из трея.
if (DEMO) app.setPath('userData', app.getPath('userData') + '-demo');
if (!app.requestSingleInstanceLock()) app.quit();

// Ошибка в фоне не должна всплывать системным окном поверх игры — пишем в лог и работаем дальше.
process.on('uncaughtException', (e) => log('uncaught', e));
process.on('unhandledRejection', (e) => log('unhandled', e));

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
  win.on('blur', () => { if (interacted) hide(); });
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

async function priceCheck(text) {
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
    send('status', { error: 'Failed to load data: ' + e.message });
  }
  const league = settings.get().league;
  // Цены этой лиги уже есть — показываем сразу, свежие докачаются в фоне. Нет — ждём (иначе нечего показать).
  // Ошибку глотаем: нет цен poe.ninja для лиги — трейд всё равно работает.
  const ninja = api.loadNinja(league).catch((e) => log('ninja', e.message));
  if (api.ninja.league !== league) await ninja;
  send('item', { ...pricing.prepare(item), league, leagues, priceCurrency: settings.get().priceCurrency || 'any' });
  show();
}

// --demo … --mock-trade: проверка вёрстки результатов без запросов к трейду (у него жёсткие лимиты).
function mockSearch() {
  const lot = (amount, currency, divine, seller, h) => ({
    amount, currency, currencyName: currency, currencyImage: null, divine, seller, online: true,
    indexed: new Date(Date.now() - h * 3600e3).toISOString(), whisper: `@${seller} hi`,
  });
  const listings = [lot(12, 'exalted', 0.03, 'Stadder', 3), lot(1, 'chaos', 0.16, 'Frozenc', 20), lot(1, 'divine', 1, 'Qhaelo', 13),
    lot(2, 'divine', 2, 'DonDoddd', 50), lot(5, 'divine', 5, 'GrabThatMercAndTwist', 96)];
  return { total: 37, url: 'https://www.pathofexile.com/trade2', listings, rates: api.ninja.rates,
    filters: null, dropped: [] };
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
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('PoE 2 Price Checker — Ctrl+D over an item');
  const refresh = () => {
    const cur = settings.get().league;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'PoE 2 Price Checker', enabled: false },
      { label: 'Ctrl+D — price check the item under cursor', enabled: false },
      { type: 'separator' },
      {
        label: 'League: ' + (cur || '…'),
        submenu: leagues.map((l) => ({
          label: l, type: 'radio', checked: l === cur,
          click: () => { settings.set({ league: l }); api.loadNinja(l).catch(() => {}); refresh(); },
        })),
      },
      { type: 'separator' },
      {
        label: 'Reset window position', enabled: !!settings.get().windowPos,
        click: () => { settings.set({ windowPos: null }); refresh(); },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
  };
  refresh();
  return refresh;
}

app.whenReady().then(() => {
  createOverlay();
  refreshTray = buildTray();
  ready = initData().then(refreshTray);
  ready.catch((e) => log('init failed', e));

  const hk = settings.get().hotkey;
  if (!DEMO && !globalShortcut.register(hk, () => { log('hotkey'); onHotkey(); })) {
    log('Failed to register hotkey', hk);
  }

  // npm start -- --demo=<файл с текстом предмета> [--shot=<png>] — проверка оверлея без игры.
  const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
  if (arg('demo')) {
    const sample = require('fs').readFileSync(arg('demo'), 'utf8');
    ready.then(() => priceCheck(sample)).then(() => {
      if (!arg('shot')) return;
      setTimeout(async () => {
        if (process.argv.includes('--dump-filters')) {
          console.log(await win.webContents.executeJavaScript(
            'JSON.stringify({ ilvl: state.filters.ilvl, reqLevel: state.filters.reqLevel, sockets: state.filters.sockets, quality: state.filters.quality, skill: state.filters.skill, props: state.item.properties })'));
        }
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(arg('shot'), img.toPNG());
        app.quit();
      }, 9000);
    });
  }

  ipcMain.handle('search', (_e, item, filters, relax) => (DEMO && process.argv.includes('--mock-trade')
    ? mockSearch() : pricing.search(settings.get().league, item, filters, relax)));
  ipcMain.handle('leagues', () => ({ leagues, current: settings.get().league }));
  ipcMain.handle('set-league', async (_e, l) => {
    settings.set({ league: l });
    refreshTray();
    await api.loadNinja(l).catch(() => {});
    return true;
  });
  ipcMain.handle('builds', (_e, opts) => popularBuilds({ ...opts, league: settings.get().league, limit: 5 }, api.fetchBuffer));
  ipcMain.handle('set-price-currency', (_e, c) => { settings.set({ priceCurrency: c }); });
  ipcMain.handle('copy', (_e, t) => clipboard.writeText(t));
  ipcMain.handle('open-url', (_e, u) => { if (/^https:\/\/((www\.)?pathofexile\.com|poe\.ninja)\//.test(u)) shell.openExternal(u); });
  ipcMain.handle('hide', () => hide());
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
