// Hotkey: allowed combinations and their label (no Electron — for tests).
// Default is Ctrl+E. The game reads the keyboard directly and sees the second key of the combination, so that key must
// do nothing in the game: D is a step right (walks away from the chest), E is freer by default.
const DEFAULT = 'CommandOrControl+E';
// Custom combination (settings window): Ctrl and / or Alt (optionally with Shift) + a letter, digit or F1–F12.
const ACCEL = /^(?:(?:CommandOrControl|Alt|Shift)\+)+(?:[A-Z0-9]|F[1-9]|F1[0-2])$/;
const validHotkey = (k) => typeof k === 'string' && ACCEL.test(k) && /CommandOrControl|Alt/.test(k);
const hotkeyText = (k) => String(k).replace(/CommandOrControl/g, 'Ctrl');

module.exports = { DEFAULT, validHotkey, hotkeyText };
