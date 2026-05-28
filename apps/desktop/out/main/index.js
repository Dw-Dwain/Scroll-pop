"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const electronUpdater = require("electron-updater");
let mainWindow = null;
const DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function getDashboardPath() {
  const packedPath = path.join(process.resourcesPath, "dashboard", "index.html");
  if (fs.existsSync(packedPath)) return packedPath;
  const devPath = path.join(__dirname, "../../../dashboard/dist/index.html");
  if (fs.existsSync(devPath)) return devPath;
  return path.join(__dirname, "../renderer/index.html");
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#09090b",
      symbolColor: "#a1a1aa"
    },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    show: false
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(getDashboardPath());
  }
}
async function bootstrap() {
  await electron.app.whenReady();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  if (electron.app.isPackaged) {
    electronUpdater.autoUpdater.checkForUpdatesAndNotify();
    electronUpdater.autoUpdater.on("update-available", (info) => mainWindow?.webContents.send("update-available", info));
    electronUpdater.autoUpdater.on("update-downloaded", (info) => mainWindow?.webContents.send("update-downloaded", info));
  }
}
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.handle("app:version", () => electron.app.getVersion());
electron.ipcMain.handle("updater:check", () => electronUpdater.autoUpdater.checkForUpdatesAndNotify());
electron.ipcMain.handle("updater:install", () => electronUpdater.autoUpdater.quitAndInstall());
bootstrap().catch(console.error);
