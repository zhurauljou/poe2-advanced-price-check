// Hotkey from the settings window: what we accept and how we label it.
const test = require('node:test');
const assert = require('node:assert');
const { validHotkey, hotkeyText, DEFAULT } = require('../src/main/hotkeys');

test('combination: Ctrl or Alt (optionally with Shift) and a letter, digit or F1–F12', () => {
  for (const k of [DEFAULT, 'CommandOrControl+D', 'CommandOrControl+Shift+E', 'Alt+Q', 'Alt+Shift+F12', 'CommandOrControl+1']) assert.ok(validHotkey(k), k);
  for (const k of ['E', 'Shift+E', 'CommandOrControl+', 'CommandOrControl+F13', 'CommandOrControl+Space', 'Super+E', 'CommandOrControl+e', null, 42]) assert.ok(!validHotkey(k), String(k));
});

test('label — "Ctrl" instead of CommandOrControl', () => {
  assert.equal(hotkeyText('CommandOrControl+Shift+E'), 'Ctrl+Shift+E');
  assert.equal(hotkeyText('Alt+F2'), 'Alt+F2');
});

test('combinations taken by Windows, the game or the item copy are refused', () => {
  const { reservedHotkey } = require('../src/main/hotkeys');
  for (const k of ['CommandOrControl+C', 'CommandOrControl+Alt+C', 'CommandOrControl+V', 'CommandOrControl+X', 'CommandOrControl+A', 'Alt+F4']) {
    assert.ok(reservedHotkey(k), k);
    assert.ok(!validHotkey(k), k);
  }
  assert.ok(validHotkey('CommandOrControl+Shift+C'), 'Ctrl+Shift+C is free');
});
