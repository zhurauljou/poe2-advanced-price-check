// Input on the user's behalf: key presses in the game (uiohook) and the clipboard (copying an item, whispering a seller).
const { clipboard, ClipboardItem } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const winapi = require('./winapi');
const { log } = require('./log');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ctrl+C "like a human": the game polls the keyboard once per frame and can miss an instant press (keyTap) —
// hold C down for ~30 ms.
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

// The clipboard in Electron 44 is async (like navigator.clipboard): readText / writeText / read / write return promises.
// Snapshot of the user's clipboard — all types at once (text, HTML, image…): a ClipboardItem from read() reads its data
// lazily, so after our write it would hold something else. Files copied in Explorer don't show up in read().
// Only real content is kept (text, HTML, RTF, images). Windows service formats ('electron
// application/osclipboard;format="DataObject"', 'Ole Private Data') come from read() even for an empty clipboard — "restoring" them
// would wipe the whisper or the item text and leave the clipboard with no text.
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

// Whisper to a seller in the game: switch to the game, open chat (Enter) and paste the text (Ctrl+V).
// The player sends it with their own Enter: one server action = one player key press.
// Pasted — restore the previous clipboard; failed (no game) — the whisper stays in the clipboard to paste by hand.
async function whisperInGame(text, gameHwnd) {
  const prev = await saveClipboard();
  await clipboard.writeText(text);
  if (!gameHwnd) { log('whisper: no game window (press the hotkey in the game first)'); return false; }
  // Windows doesn't always hand over focus on the first try — retry for up to a second. From the second try, with Alt held: Windows
  // forbids window switching to a process it doesn't consider active, and a key press lifts that restriction
  // (in the game Alt only briefly highlights items on the ground).
  let focused = false;
  for (let i = 0; i < 10 && !focused; i++) {
    if (i > 0) uIOhook.keyToggle(UiohookKey.Alt, 'down');
    winapi.focus(gameHwnd);
    if (i > 0) uIOhook.keyToggle(UiohookKey.Alt, 'up');
    await sleep(100);
    focused = winapi.foreground() === gameHwnd;
  }
  if (!focused) { log('whisper: could not focus the game window'); return false; }
  await sleep(200); // the game, back from the background, doesn't accept input right away
  await tap(UiohookKey.Enter);
  await sleep(150);
  await tap(UiohookKey.V, UiohookKey.Ctrl);
  log(`whisper: pasted (${text.length} chars)`);
  // Previous clipboard — with a margin: the game, back from the background, might paste it instead of the whisper.
  setTimeout(() => restoreClipboard(prev), 1500);
  return true;
}

// Press Ctrl+C on the user's behalf and wait for the game to put the item text in the clipboard.
// No response within 400 ms — try again.
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
  // Give the user back their previous clipboard — with all formats, not just text (images used to be wiped).
  setTimeout(() => restoreClipboard(prev), 50);
  return text;
}

module.exports = { sleep, copyItem, whisperInGame, saveClipboard, restoreClipboard };
