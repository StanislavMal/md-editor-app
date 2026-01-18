// src/renderer/modules/state.js
console.log('[Module Loaded] state.js');

import { scheduleUpdate } from './preview.js';

const state = {
  previewVisible: true,
  zoomLevel: 100,
  currentFilePath: null,
  ui: {
    editorPane: null,
    previewPane: null,
    previewContainer: null,
    togglePreviewBtn: null,
    zoomLevelIndicator: null,
  }
};

export function getState() {
  return { ...state };
}

export function initializeState() {
  console.log('[State] Инициализация состояния и кэширование UI-элементов.');
  state.ui.editorPane = document.querySelector('.editor-pane');
  state.ui.previewPane = document.querySelector('.preview-pane');
  state.ui.previewContainer = document.getElementById('pdf-simulation-container');
  state.ui.togglePreviewBtn = document.getElementById('toggle-preview');
  state.ui.zoomLevelIndicator = document.getElementById('zoom-level');

  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Загружаем сохраненный currentFilePath
  const savedFilePath = localStorage.getItem('currentFilePath');
  if (savedFilePath) {
    state.currentFilePath = savedFilePath;
    console.log('[State] Восстановлен currentFilePath из localStorage:', savedFilePath);
  }
}

export function togglePreview(editorView) {
  state.previewVisible = !state.previewVisible;
  
  if (state.previewVisible) {
    state.ui.previewPane.classList.remove('hidden');
    state.ui.editorPane.classList.remove('fullwidth');
    state.ui.togglePreviewBtn.classList.add('active');
    state.ui.togglePreviewBtn.querySelector('.btn-text').textContent = 'Превью';
    if(editorView) {
      scheduleUpdate(editorView.state.doc.toString());
    }
  } else {
    state.ui.previewPane.classList.add('hidden');
    state.ui.editorPane.classList.add('fullwidth');
    state.ui.togglePreviewBtn.classList.remove('active');
    state.ui.togglePreviewBtn.querySelector('.btn-text').textContent = 'Показать';
  }
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  console.log(`🎨 Тема изменена на: ${newTheme}`);
}

export function setZoom(newZoom) {
  state.zoomLevel = Math.max(50, Math.min(200, newZoom));
  state.ui.previewContainer.style.transform = `scale(${state.zoomLevel / 100})`;
  state.ui.zoomLevelIndicator.textContent = `${state.zoomLevel}%`;
}

export function zoomIn() {
  setZoom(state.zoomLevel + 10);
}

export function zoomOut() {
  setZoom(state.zoomLevel - 10);
}

export function resetZoom() {
  setZoom(100);
}

export function setCurrentFile(filePath) {
    state.currentFilePath = filePath;
    // Сохраняем в localStorage для persistence между перезапусками
    if (filePath) {
        localStorage.setItem('currentFilePath', filePath);
    } else {
        localStorage.removeItem('currentFilePath');
    }
}

export function getCurrentFileName() {
    if (!state.currentFilePath) {
        console.log('[State] getCurrentFileName: currentFilePath не установлен');
        return null;
    }
    // Извлекаем имя файла без расширения
    const fileName = state.currentFilePath.split(/[/\\]/).pop();
    const baseName = fileName.replace(/\.md$/i, '');
    console.log(`[State] getCurrentFileName: возвращаем "${baseName}" из "${state.currentFilePath}"`);
    return baseName;
}
