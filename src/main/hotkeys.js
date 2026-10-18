// Горячая клавиша: допустимые комбинации и их подпись (без Electron — для тестов).
// По умолчанию Ctrl+E. Игра читает клавиатуру напрямую и видит вторую клавишу комбинации, поэтому она не должна
// ничего делать в игре: D — шаг вправо (уводит от сундука), E по умолчанию свободнее.
const DEFAULT = 'CommandOrControl+E';
// Своя комбинация (окно настроек): Ctrl и / или Alt (можно с Shift) + буква, цифра или F1–F12.
const ACCEL = /^(?:(?:CommandOrControl|Alt|Shift)\+)+(?:[A-Z0-9]|F[1-9]|F1[0-2])$/;
const validHotkey = (k) => typeof k === 'string' && ACCEL.test(k) && /CommandOrControl|Alt/.test(k);
const hotkeyText = (k) => String(k).replace(/CommandOrControl/g, 'Ctrl');

module.exports = { DEFAULT, validHotkey, hotkeyText };
