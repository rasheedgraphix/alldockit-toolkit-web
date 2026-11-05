const { app, BrowserWindow, shell, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Ensure Windows taskbar groups properly and displays the custom AllDocKit icon
if (process.platform === 'win32') {
  app.setAppUserModelId('RasheedGraphix.AllDocKitToolkit');
}

// 1. SINGLE INSTANCE LOCK:
// Prevents multiple conflicting background instances from fighting over resources
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;

function getAppIcon() {
  const candidatePaths = [
    path.join(__dirname, 'build/icon.ico'),
    path.join(__dirname, 'public/icon.ico'),
    path.join(__dirname, 'build/icon.png'),
    path.join(__dirname, 'public/logo_512x512.png'),
    path.join(process.resourcesPath || '', 'build/icon.ico'),
    path.join(process.resourcesPath || '', 'public/icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build/icon.png'),
  ];

  for (const candidate of candidatePaths) {
    if (candidate && fs.existsSync(candidate)) {
      const img = nativeImage.createFromPath(candidate);
      if (!img.isEmpty()) {
        return img;
      }
    }
  }
  return undefined;
}

function resolveDistIndexHtml() {
  const possiblePaths = [
    path.join(__dirname, 'dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html'),
    path.join(process.resourcesPath || '', 'app.asar/dist/index.html'),
    path.join(process.resourcesPath || '', 'app/dist/index.html'),
    path.join(process.resourcesPath || '', 'dist/index.html'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(__dirname, 'dist/index.html');
}

function createWindow() {
  const windowIcon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'AllDocKit Toolkit',
    icon: windowIcon,
    backgroundColor: '#0c0a09',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Ensure local assets, webworkers and indexedDB work reliably in AppX
      webSecurity: false, // Allows local file:// access without CORS issues in packaged apps
    },
  });

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Handle second instance: focus existing window instead of creating ghost windows
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000');
  } else {
    const indexPath = resolveDistIndexHtml();
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load local index.html:', err);
      // Fallback reload attempt
      setTimeout(() => {
        if (mainWindow) mainWindow.loadFile(indexPath);
      }, 500);
    });
  }

  // Gracefully show window once ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Fallback: If ready-to-show is delayed or skipped, show within 1.5s so screen never stays blank
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1500);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
