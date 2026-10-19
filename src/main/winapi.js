// A couple of user32 functions via koffi: remember the game window and give focus back to it.
// Electron can't do this itself, and without it focus "hangs" after a click on the overlay —
// the window is hidden, the game is inactive, and the next Ctrl+C goes nowhere.
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
  // no koffi / not Windows — work without restoring focus
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

// HWND of the Electron window — from the getNativeWindowHandle() buffer.
function hwndOf(win) {
  const b = win.getNativeWindowHandle();
  return b.length >= 8 ? Number(b.readBigUInt64LE(0)) : b.readUInt32LE(0);
}

module.exports = { foreground, focus, title, hwndOf };
