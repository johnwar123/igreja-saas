const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  onBackendReady: (callback) => {
    ipcRenderer.invoke('get-backend-port').then(callback);
  }
});