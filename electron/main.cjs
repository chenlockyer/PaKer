const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('node:path');

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const isDevelopment = Boolean(DEV_SERVER_URL) && !app.isPackaged;

let mainWindow = null;

function isTrustedExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send('desktop:window-state', {
    fullscreen: mainWindow.isFullScreen(),
    maximized: mainWindow.isMaximized(),
  });
}

function registerWindowIpc() {
  ipcMain.handle('desktop:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('desktop:toggle-fullscreen', () => {
    if (!mainWindow) return false;
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  });

  ipcMain.handle('desktop:get-window-state', () => ({
    fullscreen: mainWindow?.isFullScreen() ?? false,
    maximized: mainWindow?.isMaximized() ?? false,
  }));

  ipcMain.handle('desktop:quit', () => {
    app.quit();
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#e9edf2',
    title: '纸牌建筑师 · House of Cards',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: isDevelopment,
    },
  });

  mainWindow.removeMenu();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
      if (isTrustedExternalUrl(url)) {
        void shell.openExternal(url);
      }
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isFullscreenShortcut =
      input.type === 'keyDown' &&
      (input.key === 'F11' || (input.alt && input.key === 'Enter'));

    if (isFullscreenShortcut) {
      event.preventDefault();
      mainWindow?.setFullScreen(!mainWindow.isFullScreen());
    }

    if (input.type === 'keyDown' && input.key === 'Escape' && mainWindow?.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('enter-full-screen', sendWindowState);
  mainWindow.on('leave-full-screen', sendWindowState);
  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDevelopment) {
    await mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });

    registerWindowIpc();
    await createMainWindow();

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
