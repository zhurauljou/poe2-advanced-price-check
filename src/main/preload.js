// Main window (overlay) bridge. The competitor card window and the "Updates" window have their own bridges (preload-compare.js,
// preload-updates.js) — only what they need: the card is drawn from trade data, it has no reason to search or write to chat.
const { contextBridge, ipcRenderer } = require('electron');

// UI language: synchronously on window load (no flash of English) and a change event from the tray.
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
  icons: (keys) => ipcRenderer.invoke('icons', keys),
  search: (item, filters, relax) => ipcRenderer.invoke('search', item, filters, relax),
  setLeague: (league) => ipcRenderer.invoke('set-league', league),
  builds: (opts) => ipcRenderer.invoke('builds', opts),
  demand: (opts) => ipcRenderer.invoke('demand', opts),
  craft: () => ipcRenderer.invoke('craft'),
  copy: (text) => ipcRenderer.invoke('copy', text),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  hide: () => ipcRenderer.invoke('hide'),
  recheck: () => ipcRenderer.invoke('recheck'),
  limitWait: () => ipcRenderer.invoke('limit-wait'),
  exchangeOffers: (want, have) => ipcRenderer.invoke('exchange-offers', want, have),
  history: () => ipcRenderer.invoke('history'),
  historyOpen: (id) => ipcRenderer.invoke('history-open', id),
  historyPrice: (id, est) => ipcRenderer.invoke('history-price', id, est),
  setSearchDefaults: (p) => ipcRenderer.invoke('set-search-defaults', p),
  onRefit: (cb) => ipcRenderer.on('refit', (_e, d) => cb(d)),
  onLeague: (cb) => ipcRenderer.on('league', (_e, l) => cb(l)),
  elementVariants: (item, filters) => ipcRenderer.invoke('element-variants', item, filters),
  pin: (on) => ipcRenderer.invoke('pin', on),
  focusSelf: () => ipcRenderer.invoke('focus-overlay'),
  setWide: (on) => ipcRenderer.invoke('set-wide', on),
  fit: (height, wide) => ipcRenderer.invoke('fit', height, wide),
  // competitor card in a side window
  compareShow: (html, y) => ipcRenderer.invoke('compare-show', html, y),
  compareHide: () => ipcRenderer.invoke('compare-hide'),
});
