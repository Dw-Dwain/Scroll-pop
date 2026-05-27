"use strict";
const electron = require("electron");
const __vite_import_meta_env__ = {};
electron.contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  getLocalApiUrl: () => __vite_import_meta_env__?.VITE_API_URL || "http://localhost:3001",
  getVersion: () => electron.ipcRenderer.invoke("app:version"),
  checkForUpdates: () => electron.ipcRenderer.invoke("updater:check"),
  onUpdateAvailable: (cb) => electron.ipcRenderer.on("update-available", (_e, info) => cb(info)),
  onUpdateDownloaded: (cb) => electron.ipcRenderer.on("update-downloaded", (_e, info) => cb(info)),
  installUpdate: () => electron.ipcRenderer.invoke("updater:install")
});
