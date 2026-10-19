// "Updates" window: live update status — checking, "vX available" with a Download button, download progress,
// "Restart & install". The state is sent by the main process (updater.status).
const $ = (id) => document.getElementById(id);
const { t } = window.i18n;
window.i18n.setLang(window.upd.uiLang());
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
// The version comes from GitHub (latest.yml) and is inserted into markup — escape it.
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let page = null;
let last = null; // last status — to re-render on language change

function render(s) {
  last = s;
  $('current').textContent = `v${s.current}`;
  const action = $('action');
  const bar = $('bar');
  action.hidden = true;
  bar.hidden = true;
  $('notes').hidden = !s.page || !['available', 'downloading', 'ready'].includes(s.state);
  page = s.page;
  let state = '';
  let detail = '';
  switch (s.state) {
    case 'unavailable':
      state = t('Running from source');
      detail = t('Updates come via git pull.');
      break;
    case 'checking':
      state = `<span class="spin"></span>${t('Checking for updates…')}`;
      break;
    case 'latest':
      state = `✓ ${t('You have the latest version')}`;
      action.hidden = false; action.textContent = t('Check again'); action.dataset.do = 'check';
      break;
    case 'available':
      state = t('Version <b>v{v}</b> is available', { v: esc(s.version) });
      action.hidden = false; action.textContent = t('Download'); action.dataset.do = 'download';
      break;
    case 'downloading': {
      const p = s.progress || {};
      state = t('Downloading <b>v{v}</b>…', { v: esc(s.version) });
      bar.hidden = false;
      bar.firstElementChild.style.width = `${Math.round(p.percent || 0)}%`;
      detail = p.total ? `${Math.round(p.percent)}% · ${t('{a} of {b}', { a: mb(p.transferred), b: mb(p.total) })}${p.speed ? ` · ${mb(p.speed)}/s` : ''}` : t('Starting…');
      break;
    }
    case 'ready':
      state = `✓ ${t('<b>v{v}</b> is downloaded', { v: esc(s.version) })}`;
      detail = t('Restart to install now — or it installs when you quit the app.');
      action.hidden = false; action.textContent = t('Restart & install'); action.dataset.do = 'install';
      break;
    case 'error':
      state = t('Update check failed');
      detail = s.error || '';
      action.hidden = false; action.textContent = t('Try again'); action.dataset.do = 'check';
      break;
    default:
      action.hidden = false; action.textContent = t('Check for updates'); action.dataset.do = 'check';
  }
  $('state').innerHTML = state;
  $('detail').textContent = detail;
  action.classList.toggle('primary-go', s.state === 'available' || s.state === 'ready');
  requestAnimationFrame(() => window.upd.fit(document.body.scrollHeight));
}

window.upd.onStatus(render);
// UI language: static labels (data-i18n) and the current status.
function applyLang() {
  document.documentElement.lang = window.i18n.getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.title = `${t('Updates')} — PoE 2 Price Checker`;
}
applyLang();
window.upd.onUiLang((lang) => { window.i18n.setLang(lang); applyLang(); if (last) render(last); });
$('action').addEventListener('click', () => window.upd[$('action').dataset.do]());
$('notes').addEventListener('click', () => page && window.upd.openUrl(page));
$('close').addEventListener('click', () => window.upd.close());
window.upd.ready();
