const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  windowControls: {
    minimize: () => ipcRenderer.send('window-control', 'minimize'),
    close: () => ipcRenderer.send('window-control', 'close'),
    togglePin: () => ipcRenderer.send('window-control', 'toggle-pin'),
    getPinStatus: () => ipcRenderer.sendSync('window-control', 'get-pin-status'),
    onPinStatusChanged: (callback) => {
      const subscription = (event, status) => callback(status);
      ipcRenderer.on('pin-status-changed', subscription);
      return () => {
        ipcRenderer.removeListener('pin-status-changed', subscription);
      };
    }
  },
  clipboard: {
    copyText: (text) => ipcRenderer.invoke('clipboard-copy', text),
  },
  translation: {
    translate: (text) => ipcRenderer.invoke('translate-text', text),
  },
  history: {
    get: () => ipcRenderer.invoke('get-history'),
    save: (history) => ipcRenderer.invoke('save-history', history),
  }
});
