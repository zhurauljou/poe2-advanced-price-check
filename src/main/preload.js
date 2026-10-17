// Мост главного окна (оверлей). У окна карточки конкурента и окна «Updates» свои мосты (preload-compare.js,
// preload-updates.js) — только то, что им нужно: карточку рисуют данные трейда, ей незачем искать или писать в чат.
const { contextBridge, ipcRenderer } = require('electron');

// Язык интерфейса: синхронно при загрузке окна (без мигания английским) и событие смены из трея.
const uiLang = () => ipcRenderer.sendSync('ui-lang-get');
const onUiLang = (cb) => ipcRenderer.on('ui-lang', (_e, lang) => cb(lang));

contextBridge.exposeInMainWorld('pc', {
  uiLang,
  onUiLang,
  onItem: (cb) => ipcRenderer.on('item', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('status', (_e, data) => cb(data)),
  uniquePrice: (name, base) => ipcRenderer.invoke('unique-price', name, base),
  whisperGame: (text) => ipcRenderer.invoke('whisper-game', text),
  demandLevel: () => ipcRenderer.invoke('demand-level'),
  setDemandLevel: (l) => ipcRenderer.invoke('set-demand-level', l),
  listingUrl: (item, filters, account) => ipcRenderer.invoke('listing-url', item, filters, account),
  quickPrice: (item, filters) => ipcRenderer.invoke('quick-price', item, filters),
  search: (item, filters, relax) => ipcRenderer.invoke('search', item, filters, relax),
  setLeague: (league) => ipcRenderer.invoke('set-league', league),
  builds: (opts) => ipcRenderer.invoke('builds', opts),
  demand: (opts) => ipcRenderer.invoke('demand', opts),
  craft: () => ipcRenderer.invoke('craft'),
  setPriceCurrency: (c) => ipcRenderer.invoke('set-price-currency', c),
  copy: (text) => ipcRenderer.invoke('copy', text),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  hide: () => ipcRenderer.invoke('hide'),
  recheck: () => ipcRenderer.invoke('recheck'),
  history: () => ipcRenderer.invoke('history'),
  historyOpen: (id) => ipcRenderer.invoke('history-open', id),
  historyPrice: (id, est) => ipcRenderer.invoke('history-price', id, est),
  setSearchDefaults: (p) => ipcRenderer.invoke('set-search-defaults', p),
  onRefit: (cb) => ipcRenderer.on('refit', () => cb()),
  elementVariants: (item, filters) => ipcRenderer.invoke('element-variants', item, filters),
  pin: (on) => ipcRenderer.invoke('pin', on),
  fit: (height) => ipcRenderer.invoke('fit', height),
  // карточка конкурента в окне сбоку
  compareShow: (html, y) => ipcRenderer.invoke('compare-show', html, y),
  compareHide: () => ipcRenderer.invoke('compare-hide'),
});
