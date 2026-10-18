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
  if (!gameHwnd) { log('whisper: no game window (press the hotkey in the game first)'); return false; }
  // Windows не всегда отдаёт фокус с первого раза — пробуем до секунды. Со второй попытки — с нажатым Alt: Windows
  // запрещает переключать окна процессу, который не считает активным, а нажатие клавиши этот запрет снимает
  // (Alt в игре лишь на миг подсвечивает предметы на земле).
  let focused = false;
  for (let i = 0; i < 10 && !focused; i++) {
    if (i > 0) uIOhook.keyToggle(UiohookKey.Alt, 'down');
    winapi.focus(gameHwnd);
    if (i > 0) uIOhook.keyToggle(UiohookKey.Alt, 'up');
    await sleep(100);
    focused = winapi.foreground() === gameHwnd;
  }
  if (!focused) { log('whisper: could not focus the game window'); return false; }
  await sleep(200); // игра, вернувшись из фона, принимает ввод не сразу
  await tap(UiohookKey.Enter);
  await sleep(150);
  await tap(UiohookKey.V, UiohookKey.Ctrl);
  log(`whisper: pasted (${text.length} chars)`);
  // Прежний буфер — с запасом: игра, вернувшаяся из фона, могла бы вставить уже его, а не шёпот.
  setTimeout(() => restoreClipboard(prev), 1500);
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
