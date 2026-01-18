// src/main/index.js
import { app, BrowserWindow, protocol, ipcMain } from 'electron'
import path from 'path'
import isDev from 'electron-is-dev' // <-- ИМПОРТИРУЕМ ПАКЕТ
import { registerIpcHandlers } from './ipc-handlers.js'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      webSecurity: false,
    },
  });

  mainWindow.setMenu(null);
  
  // --- НОВЫЙ, НАДЕЖНЫЙ СПОСОБ ---
  if (isDev) {
    // В режиме разработки мы ЗНАЕМ, что Vite запустил сервер на порту 5173.
    const devURL = 'http://localhost:5173';
    console.log(`[Main] Development mode detected. Loading from dev server: ${devURL}`);
    mainWindow.loadURL(devURL);
  } else {
    // В режиме продакшена, как и раньше, грузим из файла.
    console.log('[Main] Production mode detected. Loading from local file.');
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Открываем DevTools только в режиме разработки для удобства
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'undocked' });
  }


}

app.whenReady().then(() => {
  protocol.registerFileProtocol('safe-file', (request, callback) => {
    const url = request.url.substr('safe-file://'.length);
    callback({ path: path.normalize(decodeURI(url)) });
  });

  createWindow();
  
  registerIpcHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
