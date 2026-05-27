import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL'] || process.env['VITE_DEV_SERVER_URL'];

function getDashboardPath(): string {
  // Packaged app: dashboard in extraResources
  const packedPath = join(process.resourcesPath, 'dashboard', 'index.html');
  if (existsSync(packedPath)) return packedPath;

  // Dev: look for pre-built dashboard dist
  const devPath = join(__dirname, '../../../dashboard/dist/index.html');
  if (existsSync(devPath)) return devPath;

  // Fallback renderer placeholder
  return join(__dirname, '../renderer/index.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#09090b',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#09090b',
      symbolColor: '#a1a1aa',
    },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // In dev: load the Vite dev server. In prod: load the built file.
  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(getDashboardPath());
  }
}

async function bootstrap() {
  await app.whenReady();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('update-available', (info) => mainWindow?.webContents.send('update-available', info));
    autoUpdater.on('update-downloaded', (info) => mainWindow?.webContents.send('update-downloaded', info));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('updater:check', () => autoUpdater.checkForUpdatesAndNotify());
ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());

bootstrap().catch(console.error);
