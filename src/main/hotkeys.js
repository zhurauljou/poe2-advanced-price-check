// Hotkey: allowed combinations and their label (no Electron — for tests).
// Default is Ctrl+E. The game reads the keyboard directly and sees the second key of the combination, so that key must
// do nothing in the game: D is a step right (walks away from the chest), E is freer by default.
const DEFAULT = 'CommandOrControl+E';
// Custom combination (settings window): Ctrl and / or Alt (optionally with Shift) + a letter, digit or F1–F12.
const ACCEL = /^(?:(?:CommandOrControl|Alt|Shift)\+)+(?:[A-Z0-9]|F[1-9]|F1[0-2])$/;
// Taken by Windows, the game or this app itself: Ctrl+C / Ctrl+Alt+C copy the item (the app sends them), Ctrl+V pastes a
// whisper, Ctrl+X / Ctrl+A edit chat, Alt+F4 closes the game.
const RESERVED = new Set(['CommandOrControl+C', 'CommandOrControl+Alt+C', 'CommandOrControl+V', 'CommandOrControl+X', 'CommandOrControl+A', 'Alt+F4']);
const reservedHotkey = (k) => RESERVED.has(k);
const validHotkey = (k) => typeof k === 'string' && ACCEL.test(k) && /CommandOrControl|Alt/.test(k) && !reservedHotkey(k);
const hotkeyText = (k) => String(k).replace(/CommandOrControl/g, 'Ctrl');

module.exports = { DEFAULT, validHotkey, reservedHotkey, hotkeyText };
