// Ввод за пользователя: нажатия клавиш в игре (uiohook) и буфер обмена (копирование предмета, шёпот продавцу).
const { clipboard, ClipboardItem } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const winapi = require('./winapi');
const { log } = require('./log');

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

// Буфер обмена в Electron 44 асинхронный (как navigator.clipboard): readText / writeText / read / write — промисы.
// Снимок буфера пользователя — все типы сразу (текст, HTML, картинка…): ClipboardItem из read() читает данные
// лениво, после нашей записи там было бы уже другое. Скопированные в Проводнике файлы в read() не попадают.
// Берём только настоящее содержимое (текст, HTML, RTF, картинки). Служебные форматы Windows («electron
// application/osclipboard;format="DataObject"», «Ole Private Data») read() отдаёт и у пустого буфера — «вернуть» их
// значило бы стереть шёпот или текст предмета и оставить буфер без текста.
const KEEP = (type) => /^(text\/(plain|html|rtf)|image\/)/.test(type);
async function saveClipboard() {
  try {
    const items = await clipboard.read();
    const snap = await Promise.all(items.map(async (it) => {
      const data = {};
      for (const type of it.types) if (KEEP(type)) data[type] = await it.getType(type);
      return data;
    }));
    return snap.filter((d) => Object.keys(d).length);
  } catch (e) {
    log('clipboard save', e.message);
    return null;
  }
}
async function restoreClipboard(snap) {
  if (!snap || !snap.length) return;
  try { await clipboard.write(snap.map((d) => new ClipboardItem(d))); } catch (e) { log('clipboard restore', e.message); }
}

// Шёпот продавцу в игре: переключаемся в игру, открываем чат (Enter) и вставляем текст (Ctrl+V).
// Отправляет сам игрок — своим Enter: одно действие на сервере = одно нажатие игрока.
// Вставили — возвращаем прежний буфер; не вышло (игры нет) — шёпот остаётся в буфере, его можно вставить руками.
async function whisperInGame(text, gameHwnd) {
  const prev = await saveClipboard();
  await clipboard.writeText(text);
  if (!gameHwnd) return false;
  winapi.focus(gameHwnd);
  await sleep(150);
  if (winapi.foreground() !== gameHwnd) return false;
  await tap(UiohookKey.Enter);
  await sleep(120);
  await tap(UiohookKey.V, UiohookKey.Ctrl);
  setTimeout(() => restoreClipboard(prev), 300); // игра читает буфер не мгновенно
  return true;
}

// Нажимаем Ctrl+C за пользователя и ждём, пока игра положит текст предмета в буфер.
// Не ответила за 400 мс — пробуем ещё раз.
async function copyItem() {
  const prev = await saveClipboard();
  await clipboard.writeText('');
  let text = '';
  for (let attempt = 0; attempt < 2 && !text; attempt++) {
    await pressCopy();
    for (let i = 0; i < 20 && !text; i++) {
      await sleep(20);
      text = await clipboard.readText();
    }
    if (!text) log(`copy: clipboard empty after attempt ${attempt + 1}`);
  }
  // Возвращаем пользователю прежний буфер — со всеми форматами, а не только текст (картинку раньше стирали).
  setTimeout(() => restoreClipboard(prev), 50);
  return text;
}

module.exports = { sleep, copyItem, whisperInGame, saveClipboard, restoreClipboard };
