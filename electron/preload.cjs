const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('desktop:minimize'),
  toggleFullscreen: () => ipcRenderer.invoke('desktop:toggle-fullscreen'),
  getWindowState: () => ipcRenderer.invoke('desktop:get-window-state'),
  getDisplayMetrics: () => ipcRenderer.invoke('desktop:get-display-metrics'),
  quit: () => ipcRenderer.invoke('desktop:quit'),
  writeOfficialCampaign: (campaign) => ipcRenderer.invoke('desktop:write-official-campaign', campaign),
  onWindowStateChanged: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('desktop:window-state', handler);
    return () => ipcRenderer.removeListener('desktop:window-state', handler);
  },
  onDisplayMetricsChanged: (listener) => {
    const handler = (_event, metrics) => listener(metrics);
    ipcRenderer.on('desktop:display-metrics', handler);
    return () => ipcRenderer.removeListener('desktop:display-metrics', handler);
  },
});
