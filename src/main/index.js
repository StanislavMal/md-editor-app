// src/main/index.js
import { app, BrowserWindow, protocol, ipcMain, dialog } from 'electron'
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

  // Обработчик закрытия окна
  mainWindow.on('close', async (event) => {
    console.log('[Main] Close event triggered');
    event.preventDefault(); // Предотвращаем немедленное закрытие

    try {
      // Проверяем, есть ли несохраненные изменения
      const hasUnsaved = await mainWindow.webContents.executeJavaScript(`
        (function() {
          return window.modules?.state?.hasUnsavedChanges?.() || false;
        })()
      `);

      if (hasUnsaved) {
        console.log('[Main] Unsaved changes detected, showing save dialog');

        // Получаем содержимое редактора и информацию о файле
        const editorContent = await mainWindow.webContents.executeJavaScript(`
          (function() {
            const editorView = window.modules?.editor?.getEditorView?.();
            return editorView ? editorView.state.doc.toString() : '';
          })()
        `);

        const fileInfo = await mainWindow.webContents.executeJavaScript(`
          (function() {
            const state = window.modules?.state;
            return {
              currentFileName: state?.getCurrentFileName?.() || 'Новый документ',
              isFileLoadedFromDisk: state?.isFileLoadedFromDisk?.() || false
            };
          })()
        `);

        // Показываем диалог
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Сохранить как', 'Не сохранять', 'Отмена'],
          defaultId: 0,
          cancelId: 2,
          title: 'Несохраненные изменения',
          message: 'У вас есть несохраненные изменения. Что вы хотите сделать?',
        });

        if (response === 0) { // Сохранить как
          console.log('[Main] User chose "Save as"');
          const defaultName = fileInfo.isFileLoadedFromDisk ? fileInfo.currentFileName : 'Новый документ';
          const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Сохранить как',
            defaultPath: `${defaultName}.md`,
            filters: [{ name: 'Markdown Files', extensions: ['md'] }],
          });

          if (!canceled && filePath) {
            try {
              const fs = await import('fs/promises');
              await fs.writeFile(filePath, editorContent, 'utf-8');
              console.log('[Main] File saved successfully:', filePath);
              mainWindow.destroy(); // Закрываем окно после сохранения
            } catch (error) {
              console.error('[Main] Error saving file:', error);
              await dialog.showErrorBox('Ошибка сохранения', `Не удалось сохранить файл: ${error.message}`);
              // Не закрываем окно при ошибке
              return;
            }
          } else {
            // Пользователь отменил диалог сохранения, не закрываем окно
            return;
          }
        } else if (response === 1) { // Не сохранять
          console.log('[Main] User chose "Do not save"');
          mainWindow.destroy(); // Закрываем окно без сохранения
        } else { // Отмена
          console.log('[Main] User chose "Cancel"');
          // Не закрываем окно
          return;
        }
      } else {
        console.log('[Main] No unsaved changes, closing window');
        mainWindow.destroy(); // Закрываем окно
      }
    } catch (error) {
      console.error('[Main] Error in close handler:', error);
      // В случае ошибки все равно закрываем окно
      mainWindow.destroy();
    }
  });
  
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
