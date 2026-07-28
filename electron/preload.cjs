const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('desktop:minimize'),
  toggleFullscreen: () => ipcRenderer.invoke('desktop:toggle-fullscreen'),
  getWindowState: () => ipcRenderer.invoke('desktop:get-window-state'),
  quit: () => ipcRenderer.invoke('desktop:quit'),
  onWindowStateChanged: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('desktop:window-state', handler);
    return () => ipcRenderer.removeListener('desktop:window-state', handler);
  },
});
