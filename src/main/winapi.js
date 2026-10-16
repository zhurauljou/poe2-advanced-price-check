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
    getCursor: user32.func('bool __stdcall GetCursorPos(_Out_ int32_t *pt)'),
    setCursor: user32.func('bool __stdcall SetCursorPos(int x, int y)'),
    mouseEvent: user32.func('void __stdcall mouse_event(uint32_t flags, uint32_t dx, uint32_t dy, uint32_t data, uintptr_t extra)'),
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

// Курсор — в физических пикселях (как его видит игра); запоминаем при проверке и возвращаем для клика.
function cursor() {
  if (!api) return null;
  const pt = new Int32Array(2);
  return api.getCursor(pt) ? { x: pt[0], y: pt[1] } : null;
}

function moveCursor(p) {
  return !!(api && p && api.setCursor(p.x, p.y));
}

// Левый клик в текущей точке курсора.
function click() {
  if (!api) return;
  api.mouseEvent(0x0002, 0, 0, 0, 0); // LEFTDOWN
  api.mouseEvent(0x0004, 0, 0, 0, 0); // LEFTUP
}

module.exports = { foreground, focus, title, hwndOf, cursor, moveCursor, click };
