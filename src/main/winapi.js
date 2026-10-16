// Пара функций user32 через koffi: запомнить окно игры и вернуть ему фокус.
// Electron сам этого не умеет, а без этого после клика по оверлею фокус «повисает» —
// окно спрятано, игра неактивна, и следующий Ctrl+C уходит в никуда.
let api = null;
try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  api = {
    getForeground: user32.func('intptr_t __stdcall GetForegroundWindow()'),
    setForeground: user32.func('bool __stdcall SetForegroundWindow(intptr_t hWnd)'),
    getText: user32.func('int __stdcall GetWindowTextW(intptr_t hWnd, _Out_ uint16_t *buf, int n)'),
  };
} catch {
  // нет koffi / не Windows — работаем без возврата фокуса
}

function foreground() {
  return api ? api.getForeground() : 0;
}

function focus(hwnd) {
  return !!(api && hwnd && api.setForeground(hwnd));
}

function title(hwnd) {
  if (!api || !hwnd) return '';
  const buf = Buffer.alloc(512);
  const n = api.getText(hwnd, buf, 256);
  return buf.toString('utf16le', 0, n * 2);
}

// HWND окна Electron — из буфера getNativeWindowHandle().
function hwndOf(win) {
  const b = win.getNativeWindowHandle();
  return b.length >= 8 ? Number(b.readBigUInt64LE(0)) : b.readUInt32LE(0);
}

module.exports = { foreground, focus, title, hwndOf };
