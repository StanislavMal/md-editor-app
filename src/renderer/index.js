// src/renderer/index.js

// CSS импорты
import 'github-markdown-css/github-markdown.css';
import 'highlight.js/styles/github.css';
import './styles/style.css';

console.log('[Renderer] renderer.js: Скрипт начал выполняться.');

// Добавляем функции в глобальный window для доступа из main process
import { hasUnsavedChanges } from './modules/state.js';
import { handleQuickSave } from './modules/file-io.js';
window.hasUnsavedChanges = hasUnsavedChanges;
window.handleQuickSave = handleQuickSave;

import { initializeEditor, setOnScrollCallback as setEditorScrollCallback, scrollToText as scrollToEditor } from './modules/editor.js';
import { scheduleUpdate, setOnScrollCallback as setPreviewScrollCallback, scrollToText as scrollToPreview } from './modules/preview.js';
import { initializeToolbar } from './modules/toolbar.js';
import { initializeState } from './modules/state.js';
import { initializeFileIO } from './modules/file-io.js';

// --- НОВАЯ, БОЛЕЕ НАДЕЖНАЯ ЛОГИКА СИНХРОНИЗАЦИИ ---

let scrollLock = null; // Может быть 'editor', 'preview' или null
let lockTimeout = null;

const LOCK_DURATION = 100; // мс, на которые блокируется ответная синхронизация

function releaseLock() {
  scrollLock = null;
}

// Обработчик скролла редактора
const handleEditorScroll = (line, scrollElement) => {
  if (scrollLock === 'preview') {
    return; // Игнорируем, если превью в данный момент является источником скролла
  }

  // Устанавливаем замок от имени редактора
  scrollLock = 'editor';
  clearTimeout(lockTimeout);
  lockTimeout = setTimeout(releaseLock, LOCK_DURATION);

  const { scrollTop, scrollHeight, clientHeight } = scrollElement;
  const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1.5; // Увеличим погрешность
  const previewPane = document.querySelector('.preview-pane');

  if (scrollTop <= 0) {
    previewPane.scrollTop = 0;
  } else if (isAtBottom) {
    previewPane.scrollTop = previewPane.scrollHeight;
  } else {
    scrollToPreview(line);
  }
};

// Обработчик скролла превью
const handlePreviewScroll = (line, scrollElement) => {
  if (scrollLock === 'editor') {
    return; // Игнорируем, если редактор в данный момент является источником скролла
  }

  // Устанавливаем замок от имени превью
  scrollLock = 'preview';
  clearTimeout(lockTimeout);
  lockTimeout = setTimeout(releaseLock, LOCK_DURATION);

  const { scrollTop, scrollHeight, clientHeight } = scrollElement;
  const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1.5; // Увеличим погрешность
  const editorScroller = document.querySelector('.cm-scroller');

  if (scrollTop <= 0) {
    // В CodeMirror 6 scrollToText(1) - лучший способ перейти к верху
    scrollToEditor(1);
  } else if (isAtBottom && editorScroller) {
    editorScroller.scrollTop = editorScroller.scrollHeight;
  } else {
    scrollToEditor(line);
  }
};


document.addEventListener('DOMContentLoaded', () => {
  console.log('[Renderer] DOMContentLoaded fired');

  try {
    console.log('[Renderer] 1. Initializing state...');
    initializeState();

    console.log('[Renderer] 2. Initializing editor...');
    const editorView = initializeEditor(scheduleUpdate);
    console.log('[Renderer] Editor view created:', !!editorView);

    console.log('[Renderer] 3. Initializing toolbar...');
    initializeToolbar(editorView);

    console.log('[Renderer] 4. Initializing file IO...');
    initializeFileIO(editorView);

    console.log('[Renderer] 5. Setting up scroll sync...');
    setEditorScrollCallback(handleEditorScroll);
    setPreviewScrollCallback(handlePreviewScroll);

    console.log('[Renderer] 6. Initial rendering...');
    scheduleUpdate(editorView.state.doc.toString());

    console.log('[Renderer] Initialization complete!');
  } catch (error) {
    console.error('[Renderer] Critical error during initialization:', error);
  }
});
