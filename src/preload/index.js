// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  convertMarkdown: (markdownText) => ipcRenderer.invoke('convert-markdown', markdownText),
  getGitHubCss: () => ipcRenderer.invoke('get-github-css'),
  openFile: () => ipcRenderer.invoke('open-file'),
  savePdf: (singleHtmlString) => ipcRenderer.invoke('save-pdf', singleHtmlString),
  saveMdFile: (content) => ipcRenderer.invoke('save-md-file', content),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  saveImage: (base64Data) => ipcRenderer.invoke('save-image', base64Data),
});
