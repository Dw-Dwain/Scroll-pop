import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  getLocalApiUrl: () => (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001',
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  onUpdateAvailable: (cb: (info: unknown) => void) => ipcRenderer.on('update-available', (_e, info) => cb(info)),
  onUpdateDownloaded: (cb: (info: unknown) => void) => ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
});
