// src/main.js - Главный файл инициализации для веб-версии

import 'github-markdown-css/github-markdown.css';
import 'highlight.js/styles/github.css';
import './styles/style.css';

console.log('[Web App] Starting initialization...');
console.time('Total App Initialization');

// Импорты модулей
import { initializeEditor, setOnScrollCallback as setEditorScrollCallback, scrollToText as scrollToEditor } from './modules/editor.js';
import { scheduleUpdate, setOnScrollCallback as setPreviewScrollCallback, scrollToText as scrollToPreview } from './modules/preview.js';
import { initializeToolbar } from './modules/toolbar.js';
import { initializeState } from './modules/state.js';
import { initializeFileIO } from './modules/file-io.js';
import { initializeAIChat } from './modules/ai-chat.js';
import { initializeAIFeedback } from './modules/ai-feedback.js';
import { initializeWordCounter } from './modules/word-counter.js';

// --- СИНХРОНИЗАЦИЯ СКРОЛЛА ---
let scrollLock = null;
let lockTimeout = null;
const LOCK_DURATION = 100;

function releaseLock() {
  scrollLock = null;
}

const handleEditorScroll = (line, scrollElement) => {
  if (scrollLock === 'preview') return;
  scrollLock = 'editor';
  clearTimeout(lockTimeout);
  lockTimeout = setTimeout(releaseLock, LOCK_DURATION);

  const { scrollTop, scrollHeight, clientHeight } = scrollElement;
  const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1.5;
  const previewPane = document.querySelector('.preview-pane');

  if (scrollTop <= 0) {
    previewPane.scrollTop = 0;
  } else if (isAtBottom) {
    previewPane.scrollTop = previewPane.scrollHeight;
  } else {
    scrollToPreview(line);
  }
};

const handlePreviewScroll = (line, scrollElement) => {
  if (scrollLock === 'editor') return;
  scrollLock = 'preview';
  clearTimeout(lockTimeout);
  lockTimeout = setTimeout(releaseLock, LOCK_DURATION);

  const { scrollTop, scrollHeight, clientHeight } = scrollElement;
  const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1.5;
  const editorScroller = document.querySelector('.cm-scroller');

  if (scrollTop <= 0) {
    scrollToEditor(1);
  } else if (isAtBottom && editorScroller) {
    editorScroller.scrollTop = editorScroller.scrollHeight;
  } else {
    scrollToEditor(line);
  }
};

// --- ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Web App] DOMContentLoaded fired');
  console.time('DOMContentLoaded to Ready');

  try {
    // 1. Инициализация состояния
    console.log('[Web App] 1. Initializing state...');
    console.time('State Init');
    initializeState();
    console.timeEnd('State Init');

    // 2. Инициализация редактора
    console.log('[Web App] 2. Initializing editor...');
    console.time('Editor Init');
    const editorView = initializeEditor(scheduleUpdate);
    console.timeEnd('Editor Init');

    // 3. Инициализация тулбара
    console.log('[Web App] 3. Initializing toolbar...');
    console.time('Toolbar Init');
    initializeToolbar(editorView);
    console.timeEnd('Toolbar Init');

    // 4. Инициализация счетчика слов
    console.log('[Web App] 4. Initializing word counter...');
    console.time('Word Counter Init');
    initializeWordCounter(editorView);
    console.timeEnd('Word Counter Init');

    // 5. Инициализация файлового ввода/вывода (веб-версия)
    console.log('[Web App] 5. Initializing file IO...');
    console.time('FileIO Init');
    initializeFileIO(editorView);
    console.timeEnd('FileIO Init');

    // 6. Инициализация AI чата
    console.log('[Web App] 6. Initializing AI Chat...');
    console.time('AI Chat Init');
    initializeAIChat();
    console.timeEnd('AI Chat Init');

    // 7. Инициализация AI обратной связи
    console.log('[Web App] 7. Initializing AI Feedback...');
    console.time('AI Feedback Init');
    initializeAIFeedback(editorView);
    console.timeEnd('AI Feedback Init');

    // 8. Настройка синхронизации скролла
    console.log('[Web App] 8. Setting up scroll sync...');
    console.time('Scroll Sync Setup');
    setEditorScrollCallback(handleEditorScroll);
    setPreviewScrollCallback(handlePreviewScroll);
    console.timeEnd('Scroll Sync Setup');

    // 9. Инициализация зума
    console.log('[Web App] 9. Initializing zoom controls...');
    initializeZoomControls();

    // 10. Первый рендеринг
    console.log('[Web App] 10. Initial rendering...');
    console.time('Initial Render');
    scheduleUpdate(editorView.state.doc.toString());
    console.timeEnd('Initial Render');

    // 11. Инициализация MathJax
    console.log('[Web App] 11. Initializing MathJax...');
    console.time('MathJax Init');
    if (window.MathJax) {
      MathJax.startup.promise.then(() => {
        console.log('[Web App] MathJax initialized successfully');
        scheduleUpdate(editorView.state.doc.toString());
      }).catch((error) => {
        console.error('[Web App] MathJax initialization failed:', error);
      });
    }
    console.timeEnd('MathJax Init');

    console.timeEnd('DOMContentLoaded to Ready');
    console.timeEnd('Total App Initialization');
    console.log('[Web App] Initialization complete!');

    // Скрываем loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 300);
    }
  } catch (error) {
    console.error('[Web App] Critical error during initialization:', error);
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 300);
    }
  }
});

// --- УПРАВЛЕНИЕ ЗУМОМ ---
let currentZoom = 100;

function initializeZoomControls() {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomResetBtn = document.getElementById('zoom-reset');
  const zoomLevelSpan = document.getElementById('zoom-level');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      currentZoom = Math.min(currentZoom + 10, 200);
      applyZoom();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      currentZoom = Math.max(currentZoom - 10, 50);
      applyZoom();
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      currentZoom = 100;
      applyZoom();
    });
  }

  function applyZoom() {
    if (zoomLevelSpan) {
      zoomLevelSpan.textContent = `${currentZoom}%`;
    }
    document.body.style.zoom = currentZoom / 100;
  }
}

// Экспорт для глобального доступа
window.hasUnsavedChanges = () => {
  const { hasUnsavedChanges } = require('./modules/state.js');
  return hasUnsavedChanges();
};
