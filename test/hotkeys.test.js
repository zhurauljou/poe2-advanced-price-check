// Горячая клавиша из окна настроек: что принимаем и как подписываем.
const test = require('node:test');
const assert = require('node:assert');
const { validHotkey, hotkeyText, DEFAULT } = require('../src/main/hotkeys');

test('комбинация: Ctrl или Alt (можно с Shift) и буква, цифра или F1–F12', () => {
  for (const k of [DEFAULT, 'CommandOrControl+D', 'CommandOrControl+Shift+E', 'Alt+Q', 'Alt+Shift+F12', 'CommandOrControl+1']) assert.ok(validHotkey(k), k);
  for (const k of ['E', 'Shift+E', 'CommandOrControl+', 'CommandOrControl+F13', 'CommandOrControl+Space', 'Super+E', 'CommandOrControl+e', null, 42]) assert.ok(!validHotkey(k), String(k));
});

test('подпись — «Ctrl» вместо CommandOrControl', () => {
  assert.equal(hotkeyText('CommandOrControl+Shift+E'), 'Ctrl+Shift+E');
  assert.equal(hotkeyText('Alt+F2'), 'Alt+F2');
});
