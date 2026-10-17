// Мост окна карточки конкурента: получить разметку и сообщить высоту — больше ничего.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pc', {
  onCompare: (cb) => ipcRenderer.on('compare', (_e, html) => cb(html)),
  compareFit: (height) => ipcRenderer.invoke('compare-fit', height),
});
