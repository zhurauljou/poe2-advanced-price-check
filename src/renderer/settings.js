// Окно настроек: всё меняется сразу (главный процесс проверяет значения и сохраняет), кнопки «Сохранить» нет.
const $ = (id) => document.getElementById(id);
const { t } = window.i18n;
window.i18n.setLang(window.cfg.uiLang());
let cur = null; // последний снимок настроек от главного процесса
let capturing = false;

function applyLang() {
  document.documentElement.lang = window.i18n.getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}

// Первый запуск: карточка приветствия сверху (окно открыто с ?welcome).
const welcome = new URLSearchParams(location.search).has('welcome');
$('welcome').hidden = !welcome;
$('welcomeOk').addEventListener('click', () => window.cfg.action('close'));

function render(s) {
  cur = s;
  $('welcomeKey').textContent = t('Hover an item in the game and press {key} — the price shows up next to it.', { key: s.hotkeyLabel });
  if (!capturing) $('hotkey').textContent = s.hotkeyLabel;
  $('hotkeyGameOnly').checked = s.hotkeyGameOnly;
  $('startWithWindows').checked = s.startWithWindows;
  $('startWithWindows').disabled = !s.packaged; // из исходников автозапуск не нужен
  $('league').innerHTML = '';
  for (const l of s.leagues) {
    const o = document.createElement('option');
    o.value = l;
    o.textContent = l;
    o.selected = l === s.league;
    $('league').appendChild(o);
  }
  $('uiLang').value = s.uiLang;
  $('clientLang').value = s.clientLang;
  $('scale').innerHTML = '';
  for (const k of s.scales) {
    const b = document.createElement('button');
    b.textContent = `${Math.round(k * 100)}%`;
    b.dataset.scale = k;
    if (k === s.uiScale) b.className = 'on';
    $('scale').appendChild(b);
  }
  $('resetPos').disabled = !s.windowPos;
  fit();
}

function fit() {
  requestAnimationFrame(() => window.cfg.fit(document.body.scrollHeight));
}

async function set(patch) {
  const r = await window.cfg.set(patch);
  render(r.settings);
  return r;
}

function message(text, error) {
  $('hotkeyMsg').textContent = text || '';
  $('hotkeyMsg').classList.toggle('error', !!error);
  fit();
}

// ---- запись новой комбинации: клик по кнопке, затем нажать сочетание (Esc — отмена) ----
const KEY = (code) => {
  let m = code.match(/^Key([A-Z])$/);
  if (m) return m[1];
  m = code.match(/^Digit(\d)$/);
  if (m) return m[1];
  m = code.match(/^F(\d{1,2})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `F${m[1]}`;
  return null;
};

async function startCapture() {
  capturing = true;
  await window.cfg.capture(true);
  $('hotkey').textContent = t('Press a combination…');
  $('hotkey').classList.add('wait');
  message('');
}

async function stopCapture() {
  capturing = false;
  $('hotkey').classList.remove('wait');
  await window.cfg.capture(false);
  if (cur) $('hotkey').textContent = cur.hotkeyLabel;
}

document.addEventListener('keydown', async (e) => {
  if (!capturing) return;
  e.preventDefault();
  if (e.key === 'Escape') { await stopCapture(); return; }
  const key = KEY(e.code);
  if (!key) return; // пока зажаты только модификаторы — ждём основную клавишу
  if (!e.ctrlKey && !e.altKey) { message(t('Use Ctrl or Alt with a letter, digit or F1–F12'), true); return; }
  const hk = [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift', key].filter(Boolean).join('+');
  await stopCapture();
  const r = await set({ hotkey: hk });
  message(r.ok ? t('Saved') : r.error, !r.ok);
});

$('hotkey').addEventListener('click', () => (capturing ? stopCapture() : startCapture()));
$('hotkeyReset').addEventListener('click', async () => {
  const r = await set({ hotkey: 'CommandOrControl+E' });
  message(r.ok ? t('Saved') : r.error, !r.ok);
});
$('hotkeyGameOnly').addEventListener('change', (e) => set({ hotkeyGameOnly: e.target.checked }));
$('startWithWindows').addEventListener('change', (e) => set({ startWithWindows: e.target.checked }));
$('league').addEventListener('change', (e) => set({ league: e.target.value }));
$('uiLang').addEventListener('change', (e) => set({ uiLang: e.target.value }));
$('clientLang').addEventListener('change', (e) => set({ clientLang: e.target.value }));
$('scale').addEventListener('click', (e) => {
  const b = e.target.closest('[data-scale]');
  if (b) set({ uiScale: Number(b.dataset.scale) });
});
$('resetPos').addEventListener('click', async () => render(await window.cfg.action('reset-position')));
$('refresh').addEventListener('click', async (e) => {
  e.target.disabled = true;
  await window.cfg.action('refresh-data'); // итог — уведомлением в трее
  setTimeout(() => { e.target.disabled = false; }, 3000);
});
$('logs').addEventListener('click', () => window.cfg.action('open-logs'));
$('close').addEventListener('click', () => window.cfg.action('close'));

window.cfg.onChanged(render);
window.cfg.onUiLang((lang) => {
  window.i18n.setLang(lang);
  applyLang();
  if (cur) render(cur);
});
applyLang();
window.cfg.get().then(render);
