// src/main/ipc-handlers.js

import { ipcMain, dialog, Menu, BrowserWindow, app, net } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import MarkdownIt from 'markdown-it';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItTaskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js';
import {
  convertImagesToBase64,
  getGitHubCSS,
  getPrintCSS,
  getHighlightCSS,
  getMathJaxChtmlCSS,
  buildFullHTML
} from './file-utils.js';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
}).use(markdownItAttrs).use(markdownItTaskLists);

const defaultImageRule = md.renderer.rules.image;
md.renderer.rules.image = function(tokens, idx, options, env, self) {
  const token = tokens[idx];
  const src = token.attrGet('src');

  if (src && src.startsWith('safe-file://')) {
    try {
      const filePath = src.substring('safe-file://'.length);
      console.log(`[Main LOG] Image Rule: Пытаюсь встроить локальный файл: ${filePath}`);
      
      if (fsSync.existsSync(filePath)) {
        const fileData = fsSync.readFileSync(filePath);
        const base64 = Buffer.from(fileData).toString('base64');
        
        let mimeType = 'image/png';
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        if (ext === '.gif') mimeType = 'image/gif';
        if (ext === '.webp') mimeType = 'image/webp';
        if (ext === '.svg') mimeType = 'image/svg+xml';

        token.attrSet('src', `data:${mimeType};base64,${base64}`);
        console.log('[Main LOG] Image Rule: Файл успешно сконвертирован в base64 Data URL.');
      } else {
        console.error(`[Main LOG] Image Rule: Файл не найден по пути: ${filePath}`);
        return `<p style="color: red;">[Файл не найден: ${path.basename(filePath)}]</p>`;
      }
    } catch (error) {
      console.error(`[Main LOG] Image Rule: Ошибка чтения локального файла изображения: ${error.message}`);
      return `<p style="color: red;">[Не удалось загрузить изображение: ${path.basename(src)}]</p>`;
    }
  }

  return defaultImageRule(tokens, idx, options, env, self);
};


md.renderer.rules.fence = function(tokens, idx, options, env, self) {
  const token = tokens[idx];
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : '';
  let langName = '', langAttrs = '', highlighted;
  
  if (info) {
    const arr = info.split(/(\s+)/g);
    langName = arr[0];
    langAttrs = arr.slice(1).join('');
  }

  if (langName && hljs.getLanguage(langName)) {
    try {
      highlighted = hljs.highlight(token.content, { language: langName, ignoreIllegals: true }).value;
    } catch (__) { 
      highlighted = md.utils.escapeHtml(token.content);
    }
  } else {
    highlighted = md.utils.escapeHtml(token.content);
  }

  const lines = highlighted.split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  
  const startLine = token.map[0] + 1;
  const lineSpans = lines.map((line, index) => {
    const content = line || '&nbsp;';
    return `<span data-line="${startLine + index}">${content}</span>`;
  }).join('');

  const preAttrs = self.renderAttrs(token);
  const langForDataAttr = langName || 'text';
  const codeAttributes = langAttrs ? ` ${langAttrs}` : '';

  return `<pre${preAttrs} class="hljs" data-lang="${langForDataAttr}" data-line="${startLine}"><code${codeAttributes}>${lineSpans}</code></pre>\n`;
};

function addLineNumberAttributes(md) {
  function addLineAttr(token) {
    if (token.map) {
      const line = token.map[0] + 1;
      token.attrPush(['data-line', String(line)]);
    }
  }
  
  const blockRules = [
    'paragraph_open', 'heading_open', 'list_item_open', 'blockquote_open', 'hr'
  ];
  blockRules.forEach(ruleName => {
    const originalRule = md.renderer.rules[ruleName] || function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
    md.renderer.rules[ruleName] = (tokens, idx, options, env, self) => {
      addLineAttr(tokens[idx]);
      return originalRule(tokens, idx, options, env, self);
    };
  });

  const originalTableOpen = md.renderer.rules.table_open || function(t, i, o, e, s) { return s.renderToken(t, i, o); };
  md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
    addLineAttr(tokens[idx]);
    return originalTableOpen(tokens, idx, options, env, self);
  };

  const originalTrOpen = md.renderer.rules.tr_open || function(t, i, o, e, s) { return s.renderToken(t, i, o); };
  md.renderer.rules.tr_open = (tokens, idx, options, env, self) => {
    addLineAttr(tokens[idx]);
    return originalTrOpen(tokens, idx, options, env, self);
  };
}

addLineNumberAttributes(md);

export function registerIpcHandlers(mainWindow) {
  ipcMain.handle('save-pdf', async (event, singleHtmlString, suggestedName) => {
    console.log('[IPC] Получен вызов: save-pdf');
    const defaultName = suggestedName ? `${suggestedName}.pdf` : 'document.pdf';
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Сохранить как PDF',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { success: false };
    }

    try {
      const githubCss = await getGitHubCSS();
      const printCss = await getPrintCSS();
      const highlightCss = await getHighlightCSS();
      const mathJaxCss = await getMathJaxChtmlCSS();

      let pdfReadyHtml = await convertImagesToBase64(singleHtmlString, net);
      const fullHtml = await buildFullHTML(pdfReadyHtml, githubCss, printCss, highlightCss, mathJaxCss);

      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true,
          webSecurity: false,
        }
      });

      const tempHtmlPath = path.join(os.tmpdir(), `md-print-${Date.now()}-${Math.random()}.html`);
      try {
        await fs.writeFile(tempHtmlPath, fullHtml);
        await printWindow.loadFile(tempHtmlPath);
      } finally {
        await fs.unlink(tempHtmlPath).catch(err => console.error("Не удалось удалить временный HTML:", err));
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const pdfData = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4'
      });
      
      printWindow.close();
      await fs.writeFile(filePath, pdfData);

      return { success: true, filePath };
    } catch (error) {
      console.error('Не удалось сохранить PDF:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-image', async (event, base64Data) => {
    console.log('[Main LOG] save-image: Получен вызов от renderer-процесса.');
    try {
      const { v4: uuidv4 } = await import('uuid');
      
      const assetsDir = path.join(app.getPath('documents'), 'md-editor-app-assets');
      await fs.mkdir(assetsDir, { recursive: true });

      const data = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(data, 'base64');
      
      const filename = `${uuidv4()}.png`;
      const imagePath = path.join(assetsDir, filename);

      await fs.writeFile(imagePath, buffer);

      const imageUrl = `safe-file://${imagePath}`;
      return { success: true, filePath: imageUrl };
    } catch (error) {
      console.error('[Main LOG] save-image: ОШИБКА при сохранении изображения:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('show-context-menu', (event) => {
    console.log('[IPC] Получен вызов: show-context-menu');
    const template = [
      { label: 'Отменить', role: 'undo' },
      { type: 'separator' },
      { label: 'Вырезать', role: 'cut' },
      { label: 'Копировать', role: 'copy' },
      { label: 'Вставить', role: 'paste' },
      { type: 'separator' },
      { label: 'Выделить всё', role: 'selectAll' }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  ipcMain.handle('convert-markdown', (event, markdownText) => md.render(markdownText));
  
  ipcMain.handle('open-file', async () => {
    console.log('[IPC] Получен вызов: open-file');
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown Files', extensions: ['md'] }],
    });
    if (!canceled && filePaths.length > 0) {
      const content = await fs.readFile(filePaths[0], 'utf-8');
      return { filePath: filePaths[0], content };
    }
    return null;
  });

  ipcMain.handle('save-md-file', async (event, content, suggestedName) => {
    console.log('[IPC] Получен вызов: save-md-file, suggestedName =', suggestedName);
    const defaultName = suggestedName ? `${suggestedName}.md` : 'document.md';
    console.log('[IPC] save-md-file: defaultName =', defaultName);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Сохранить Markdown файл',
      defaultPath: defaultName,
      filters: [{ name: 'Markdown Files', extensions: ['md'] }],
    });
    if (canceled || !filePath) return { success: false };
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, filePath };
    } catch (error)
    {
      console.error('Не удалось сохранить MD файл:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quick-save-file', async (event, content, filePath) => {
    console.log('[IPC] Получен вызов: quick-save-file, filePath =', filePath);
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, filePath };
    } catch (error) {
      console.error('Не удалось быстро сохранить файл:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('minimize-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.minimize();
  });

  ipcMain.on('maximize-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.on('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.close();
  });

  ipcMain.handle('get-unsaved-changes', async (event) => {
    // Получить состояние несохраненных изменений из рендерера
    return await event.sender.executeJavaScript(`
      (function() {
        const state = window.modules?.state?.hasUnsavedChanges?.() || false;
        return state;
      })()
    `);
  });

  ipcMain.handle('get-editor-content', async (event) => {
    // Получить содержимое редактора из рендерера
    return await event.sender.executeJavaScript(`
      (function() {
        const editorView = window.modules?.editor?.getEditorView?.();
        return editorView ? editorView.state.doc.toString() : '';
      })()
    `);
  });

  ipcMain.handle('get-file-info', async (event) => {
    // Получить информацию о файле для предложения имени
    return await event.sender.executeJavaScript(`
      (function() {
        const state = window.modules?.state;
        return {
          currentFileName: state?.getCurrentFileName?.() || 'Новый документ',
          isFileLoadedFromDisk: state?.isFileLoadedFromDisk?.() || false
        };
      })()
    `);
  });

  console.log('[IPC] registerIpcHandlers: Все обработчики зарегистрированы.');
}
