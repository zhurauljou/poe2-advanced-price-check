// Окно «Updates»: живой статус обновления — проверка, «доступна vX» с кнопкой Download, прогресс скачивания,
// «Restart & install». Состояние присылает главный процесс (updater.status).
const $ = (id) => document.getElementById(id);
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
let page = null;

function render(s) {
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
      state = 'Running from source';
      detail = 'Updates come via git pull.';
      break;
    case 'checking':
      state = '<span class="spin"></span>Checking for updates…';
      break;
    case 'latest':
      state = '✓ You have the latest version';
      action.hidden = false; action.textContent = 'Check again'; action.dataset.do = 'check';
      break;
    case 'available':
      state = `Version <b>v${s.version}</b> is available`;
      action.hidden = false; action.textContent = 'Download'; action.dataset.do = 'download';
      break;
    case 'downloading': {
      const p = s.progress || {};
      state = `Downloading <b>v${s.version}</b>…`;
      bar.hidden = false;
      bar.firstElementChild.style.width = `${Math.round(p.percent || 0)}%`;
      detail = p.total ? `${Math.round(p.percent)}% · ${mb(p.transferred)} of ${mb(p.total)}${p.speed ? ` · ${mb(p.speed)}/s` : ''}` : 'Starting…';
      break;
    }
    case 'ready':
      state = `✓ <b>v${s.version}</b> is downloaded`;
      detail = 'Restart to install now — or it installs when you quit the app.';
      action.hidden = false; action.textContent = 'Restart & install'; action.dataset.do = 'install';
      break;
    case 'error':
      state = 'Update check failed';
      detail = s.error || '';
      action.hidden = false; action.textContent = 'Try again'; action.dataset.do = 'check';
      break;
    default:
      action.hidden = false; action.textContent = 'Check for updates'; action.dataset.do = 'check';
  }
  $('state').innerHTML = state;
  $('detail').textContent = detail;
  action.classList.toggle('primary-go', s.state === 'available' || s.state === 'ready');
  requestAnimationFrame(() => window.upd.fit(document.body.scrollHeight));
}

window.upd.onStatus(render);
$('action').addEventListener('click', () => window.upd[$('action').dataset.do]());
$('notes').addEventListener('click', () => page && window.upd.openUrl(page));
$('close').addEventListener('click', () => window.upd.close());
window.upd.ready();
