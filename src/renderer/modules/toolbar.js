// src/renderer/modules/toolbar.js
console.log('[Module Loaded] toolbar.js');

import { applyMarkdown, insertLineBreak } from './editor.js';
import { toggleTheme, togglePreview, zoomIn, zoomOut, resetZoom } from './state.js';

/**
 * Инициализирует все обработчики событий для кнопок на панели инструментов.
 * @param {import('@codemirror/view').EditorView} editorView - Экземпляр редактора CodeMirror 6.
 */
export function initializeToolbar(editorView) {
  // --- Кнопки форматирования ---
  // --- ИСПРАВЛЕНИЕ ЗДЕСЬ: Передаем editorView в функции ---
  document.getElementById('btn-bold').addEventListener('click', () => applyMarkdown('bold', editorView));
  document.getElementById('btn-italic').addEventListener('click', () => applyMarkdown('italic', editorView));
  document.getElementById('btn-heading').addEventListener('click', () => applyMarkdown('heading', editorView));
  document.getElementById('btn-quote').addEventListener('click', () => applyMarkdown('quote', editorView));
  document.getElementById('btn-ul').addEventListener('click', () => applyMarkdown('ul', editorView));
  document.getElementById('btn-ol').addEventListener('click', () => applyMarkdown('ol', editorView));
  document.getElementById('btn-link').addEventListener('click', () => applyMarkdown('link', editorView));
  document.getElementById('btn-image').addEventListener('click', () => applyMarkdown('image', editorView));
  document.getElementById('btn-table').addEventListener('click', () => applyMarkdown('table', editorView));
  document.getElementById('btn-tasklist').addEventListener('click', () => applyMarkdown('tasklist', editorView));
  document.getElementById('btn-linebreak').addEventListener('click', () => insertLineBreak(editorView));

  // --- Кнопки управления видом ---
  document.getElementById('toggle-preview').addEventListener('click', () => togglePreview(editorView));
  document.getElementById('zoom-in').addEventListener('click', zoomIn);
  document.getElementById('zoom-out').addEventListener('click', zoomOut);
  document.getElementById('zoom-reset').addEventListener('click', resetZoom);

  // --- Переключатель темы ---
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // --- Глобальные горячие клавиши ---
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      togglePreview(editorView);
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      toggleTheme();
    }
  });

}
