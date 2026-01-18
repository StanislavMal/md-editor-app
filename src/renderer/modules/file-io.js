// src/renderer/modules/file-io.js
console.log('[Module Loaded] file-io.js');

import { resetPreviewState, scheduleUpdate, getPreviewHtmlContent } from './preview.js';
import { setCurrentFile, getCurrentFileName } from './state.js';

let editorView;

/**
 * Инициализирует обработчики для кнопок открытия и сохранения файлов.
 * @param {import('@codemirror/view').EditorView} cmInstance - Экземпляр редактора CodeMirror 6.
 */
export function initializeFileIO(cmInstance) {
  editorView = cmInstance;

  document.getElementById('open-btn').addEventListener('click', handleOpenFile);
  document.getElementById('save-md-btn').addEventListener('click', handleSaveMd);
  document.getElementById('save-pdf-btn').addEventListener('click', handleSavePdf);
}

/**
 * Обрабатывает открытие MD файла.
 */
async function handleOpenFile() {
  const openBtn = document.getElementById('open-btn');
  try {
    const result = await window.electronAPI.openFile();
    console.log('[FileIO] handleOpenFile: result =', result);
    if (result && result.content !== undefined) {
      console.log('[FileIO] handleOpenFile: result.filePath =', result.filePath);
      setButtonLoading(openBtn, true, 'Загрузка...');
      await loadFileContent(result.content, result.filePath);
      setButtonLoading(openBtn, false, 'Открыть');
    }
  } catch (error) {
    console.error('Ошибка при открытии файла:', error);
    setButtonLoading(openBtn, false, 'Открыть');
    alert('Ошибка при открытии файла: ' + error.message);
  }
}

/**
 * Загружает контент в редактор и сбрасывает состояние превью.
 * @param {string} content - Содержимое файла.
 * @param {string} filePath - Путь к файлу.
 */
async function loadFileContent(content, filePath) {
  if (!editorView) return;

  console.log('[FileIO] loadFileContent: устанавливаем currentFilePath =', filePath);
  setCurrentFile(filePath);
  resetPreviewState();

  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: content },
    selection: { anchor: 0 } // Сбросить курсор в начало
  });
  editorView.focus();

  // Даем DOM время на обновление перед первым рендерингом
  await new Promise(resolve => setTimeout(resolve, 50));
  scheduleUpdate(content);
}

/**
 * Обрабатывает сохранение в MD файл.
 */
async function handleSaveMd() {
  const saveMdBtn = document.getElementById('save-md-btn');
  const content = editorView.state.doc.toString();
  if (!content.trim()) {
    alert('Нечего сохранять');
    return;
  }
  
  setButtonLoading(saveMdBtn, true, 'Сохранение...');
  
  try {
    const suggestedName = getCurrentFileName();
    console.log('[FileIO] handleSaveMd: suggestedName =', suggestedName);
    const result = await window.electronAPI.saveMdFile(content, suggestedName);
    if (result.success) {
      setCurrentFile(result.filePath); // Обновляем текущий файл после сохранения
      alert(`Файл успешно сохранен в: ${result.filePath}`);
    } else if (result.error) {
      alert(`Ошибка сохранения: ${result.error}`);
    }
  } catch (error) {
    alert(`Критическая ошибка сохранения: ${error.message}`);
  } finally {
    setButtonLoading(saveMdBtn, false, 'Сохранить MD');
  }
}

/**
 * Обрабатывает экспорт в PDF.
 */
async function handleSavePdf() {
  const savePdfBtn = document.getElementById('save-pdf-btn');
  const pagesHtml = getPreviewHtmlContent();
  if (!pagesHtml.trim()) {
    alert('Нечего сохранять');
    return;
  }

  setButtonLoading(savePdfBtn, true, 'Экспорт...');
  
  try {
    const suggestedName = getCurrentFileName();
    const result = await window.electronAPI.savePdf(pagesHtml, suggestedName);
    if (result.success) {
      alert(`PDF успешно сохранен в: ${result.filePath}`);
    } else if (result.error) {
      alert(`Ошибка сохранения: ${result.error}`);
    }
  } catch (error) {
    alert(`Ошибка сохранения: ${error.message}`);
  } finally {
    setButtonLoading(savePdfBtn, false, 'Экспорт PDF');
  }
}

/**
 * Управляет состоянием загрузки кнопки.
 * @param {HTMLElement} button - Элемент кнопки.
 * @param {boolean} isLoading - Флаг загрузки.
 * @param {string} text - Текст для кнопки.
 */
function setButtonLoading(button, isLoading, text) {
    const textSpan = button.querySelector('.btn-text');
    button.disabled = isLoading;
    if (isLoading) {
      button.classList.add('loading');
    } else {
      button.classList.remove('loading');
    }
    if (textSpan) {
        textSpan.textContent = text;
    }
}
