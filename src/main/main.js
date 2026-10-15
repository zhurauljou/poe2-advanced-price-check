const {
  app, BrowserWindow, globalShortcut, clipboard, screen, ipcMain, Tray, Menu, shell, nativeImage,
} = require('electron');
const path = require('path');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const settings = require('./settings');
const api = require('./api');
const pricing = require('./pricing');
const { parseItem } = require('./parser');

const WIDTH = 460;
const ICON = path.join(__dirname, '../../assets/icon.png');

let win = null;
let tray = null;
let interacted = false; // окно получало фокус (кликнули в него) — тогда клик обратно в игру его прячет
let leagues = [];
let ready = null; // промис загрузки справочников

if (!app.requestSingleInstanceLock()) app.quit();

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
}

function show() {
  const cur = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(cur).workArea;
  const [, h] = win.getSize();
  let x = cur.x + 24;
  if (x + WIDTH > area.x + area.width) x = cur.x - WIDTH - 24;
  const y = Math.min(Math.max(area.y, cur.y - 120), area.y + area.height - h);
  win.setPosition(Math.round(x), Math.round(y));
  interacted = false;
  win.showInactive(); // не забираем фокус у игры
  globalShortcut.register('Escape', hide);
}

function hide() {
  globalShortcut.unregister('Escape');
  if (win && win.isVisible()) win.hide();
}

// Нажимаем Ctrl+C за пользователя и ждём, пока игра положит текст предмета в буфер.
async function copyItem() {
  const prev = clipboard.readText();
  clipboard.writeText('');
  uIOhook.keyTap(UiohookKey.C, [UiohookKey.Ctrl]);
  let text = '';
  for (let i = 0; i < 25 && !text; i++) {
    await new Promise((r) => setTimeout(r, 20));
    text = clipboard.readText();
  }
  if (prev) setTimeout(() => clipboard.writeText(prev), 50);
  return text;
}

async function priceCheck(sample) {
  const text = sample || await copyItem();
  const item = parseItem(text);
  if (!item) return; // курсор не над предметом
  try {
    await ready;
  } catch (e) {
    send('status', { error: 'Не удалось загрузить данные: ' + e.message });
  }
  const league = settings.get().league;
  try {
    await api.loadNinja(league);
  } catch (e) {
    // нет цен poe.ninja для этой лиги — трейд всё равно работает
  }
  send('item', { ...pricing.prepare(item), league, leagues });
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
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('PoE 2 Price Checker — Ctrl+D над предметом');
  const refresh = () => {
    const cur = settings.get().league;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'PoE 2 Price Checker', enabled: false },
      { label: 'Ctrl+D — оценить предмет под курсором', enabled: false },
      { type: 'separator' },
      {
        label: 'Лига: ' + (cur || '…'),
        submenu: leagues.map((l) => ({
          label: l, type: 'radio', checked: l === cur,
          click: () => { settings.set({ league: l }); api.loadNinja(l).catch(() => {}); refresh(); },
        })),
      },
      { type: 'separator' },
      { label: 'Выход', click: () => app.quit() },
    ]));
  };
  refresh();
  return refresh;
}

app.whenReady().then(() => {
  createOverlay();
  const refreshTray = buildTray();
  ready = initData().then(refreshTray);
  ready.catch((e) => console.error('init failed', e));

  const hk = settings.get().hotkey;
  if (!globalShortcut.register(hk, () => { priceCheck().catch((e) => console.error(e)); })) {
    console.error('Не удалось занять горячую клавишу', hk);
  }

  // npm start -- --demo=<файл с текстом предмета> [--shot=<png>] — проверка оверлея без игры.
  const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
  if (arg('demo')) {
    const sample = require('fs').readFileSync(arg('demo'), 'utf8');
    ready.then(() => priceCheck(sample)).then(() => {
      if (!arg('shot')) return;
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(arg('shot'), img.toPNG());
        app.quit();
      }, 6000);
    });
  }

  ipcMain.handle('search',(_e, item, filters) => pricing.search(settings.get().league, item, filters));
  ipcMain.handle('leagues', () => ({ leagues, current: settings.get().league }));
  ipcMain.handle('set-league', async (_e, l) => {
    settings.set({ league: l });
    refreshTray();
    await api.loadNinja(l).catch(() => {});
    return true;
  });
  ipcMain.handle('copy', (_e, t) => clipboard.writeText(t));
  ipcMain.handle('open-url', (_e, u) => { if (/^https:\/\/(www\.)?pathofexile\.com\//.test(u)) shell.openExternal(u); });
  ipcMain.handle('hide', () => hide());
  ipcMain.handle('fit', (_e, h) => {
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    const height = Math.min(Math.ceil(h), area.height - 20);
    const b = win.getBounds();
    const y = Math.min(b.y, area.y + area.height - height);
    win.setBounds({ x: b.x, y, width: WIDTH, height });
  });
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
