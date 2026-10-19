// Competitor card window bridge: get the markup and report the height — nothing more.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pc', {
  onCompare: (cb) => ipcRenderer.on('compare', (_e, html) => cb(html)),
  compareFit: (height) => ipcRenderer.invoke('compare-fit', height),
});
