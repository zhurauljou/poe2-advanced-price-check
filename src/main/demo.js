// Демо-режим — проверка окна без игры и без лишних запросов к трейду:
//   npx electron . --demo=<файл с текстом предмета> --shot=<png> [флаги]
//   --mock-trade         подставные лоты вместо поиска на трейде (у него жёсткие лимиты)
//   --tab=demand|craft   открыть вкладку перед снимком
//   --hover=N            навести на N-й лот (карточка сравнения сохранится как <shot>-cmp.png)
//   --eval=<js>          выполнить в окне перед снимком (открыть меню и т.п.)
//   --upd='{"state":…}'  снимок окна «Updates» в заданном состоянии
//   --settings           снимок окна настроек
const { app } = require('electron');
const fs = require('fs');

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
// Только при запуске из исходников: --eval выполняет произвольный код в окне, установленной программе он ни к чему.
const enabled = !app.isPackaged && !!arg('demo');

// Подставные лоты для --mock-trade.
function mockSearch(rates) {
  const lot = (amount, currency, divine, seller, h) => ({
    amount, currency, currencyName: currency, currencyImage: null, divine, seller, online: true,
    indexed: new Date(Date.now() - h * 3600e3).toISOString(), whisper: h % 2 ? `@${seller} hi` : undefined,
  });
  const listings = [lot(12, 'exalted', 0.03, 'Stadder', 3), lot(1, 'chaos', 0.16, 'Frozenc', 20), lot(1, 'divine', 1, 'Qhaelo', 13),
    lot(2, 'divine', 2, 'DonDoddd', 50), lot(5, 'divine', 5, 'GrabThatMercAndTwist', 96),
    ...[6, 7, 8, 9, 10].map((d, i) => lot(d, 'divine', d, `Seller${i + 1}`, 30 * i + 5))];
  return { total: 37, url: 'https://www.pathofexile.com/trade2', listings, rates, filters: null, dropped: [] };
}

// Подставная короткая цена: случайная, чтобы видеть разные исходы (дешевле / дороже).
function mockQuick() {
  const base = [0.2, 0.5, 1, 2, 4][Math.floor(Math.random() * 5)];
  const lots = [1, 1.1, 1.3, 1.6, 2].map((k, i) => ({ div: base * k, indexed: new Date(Date.now() - i * 20 * 3600e3).toISOString() }));
  return new Promise((r) => setTimeout(() => r({ total: 20, divs: lots.map((l) => l.div), lots, url: 'https://www.pathofexile.com/trade2' }), 400));
}

const mockTrade = () => enabled && process.argv.includes('--mock-trade');

// Подставной статус обновления для --upd (null — без подмены).
const fakeUpdateStatus = () => (enabled && arg('upd') ? JSON.parse(arg('upd')) : null);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Сценарий: показать предмет (или окно «Updates»), выполнить флаги, снять скриншот и выйти.
function run({ ready, priceCheck, openUpdates, openSettings, windows }) {
  if (!enabled) return;
  if (process.argv.includes('--settings')) {
    ready.catch(() => {}).then(() => openSettings());
    setTimeout(async () => {
      if (arg('eval')) { await windows().set.webContents.executeJavaScript(arg('eval')); await wait(800); }
      fs.writeFileSync(arg('shot'), (await windows().set.webContents.capturePage()).toPNG());
      app.quit();
    }, 4000);
    return;
  }
  if (arg('upd')) {
    setTimeout(openUpdates, 300);
    setTimeout(async () => {
      fs.writeFileSync(arg('shot'), (await windows().upd.webContents.capturePage()).toPNG());
      app.quit();
    }, 3000);
    return;
  }
  ready.then(() => priceCheck(fs.readFileSync(arg('demo'), 'utf8'))).then(() => {
    if (!arg('shot')) return;
    setTimeout(async () => {
      const { main, cmp } = windows();
      if (arg('eval')) { await main.webContents.executeJavaScript(arg('eval')); await wait(400); }
      if (arg('hover')) {
        await main.webContents.executeJavaScript(`document.querySelectorAll('.lot')[${+arg('hover')}]
          .dispatchEvent(new MouseEvent('mouseenter'))`);
        await wait(1500);
      }
      if (arg('tab')) { await main.webContents.executeJavaScript(`setTab(${JSON.stringify(arg('tab'))})`); await wait(500); }
      fs.writeFileSync(arg('shot'), (await main.webContents.capturePage()).toPNG());
      if (cmp.isVisible()) fs.writeFileSync(arg('shot').replace(/\.png$/, '-cmp.png'), (await cmp.webContents.capturePage()).toPNG());
      app.quit();
    }, 9000);
  });
}

module.exports = { enabled, mockSearch, mockQuick, mockTrade, fakeUpdateStatus, run };
