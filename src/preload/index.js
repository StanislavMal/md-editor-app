// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  convertMarkdown: (markdownText) => ipcRenderer.invoke('convert-markdown', markdownText),
  getGitHubCss: () => ipcRenderer.invoke('get-github-css'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openFile: () => ipcRenderer.invoke('open-file'),
  savePdf: (singleHtmlString, suggestedName) => ipcRenderer.invoke('save-pdf', singleHtmlString, suggestedName),
  saveMdFile: (content, suggestedName) => ipcRenderer.invoke('save-md-file', content, suggestedName),
  quickSaveFile: (content, filePath) => ipcRenderer.invoke('quick-save-file', content, filePath),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  saveImage: (base64Data) => ipcRenderer.invoke('save-image', base64Data),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  onFullscreenChanged: (callback) => ipcRenderer.on('fullscreen-changed', callback),
});
