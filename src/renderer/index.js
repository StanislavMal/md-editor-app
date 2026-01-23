// src/renderer/index.js

// CSS импорты
import 'github-markdown-css/github-markdown.css';
import 'highlight.js/styles/github.css';
import './styles/style.css';

console.log('[Renderer] renderer.js: Скрипт начал выполняться.');

console.time('Total App Initialization');

// Добавляем функции в глобальный window для доступа из main process
import { hasUnsavedChanges, getCurrentFileName, isFileLoadedFromDisk } from './modules/state.js';
import { handleQuickSave } from './modules/file-io.js';
import { getEditorView } from './modules/editor.js';

window.hasUnsavedChanges = hasUnsavedChanges;
window.handleQuickSave = handleQuickSave;

// Добавляем модули в глобальный объект для доступа из main process
window.modules = {
  state: { hasUnsavedChanges, getCurrentFileName, isFileLoadedFromDisk },
  editor: { getEditorView }
};

import { initializeEditor, setOnScrollCallback as setEditorScrollCallback, scrollToText as scrollToEditor } from './modules/editor.js';
import { scheduleUpdate, setOnScrollCallback as setPreviewScrollCallback, scrollToText as scrollToPreview } from './modules/preview.js';
import { initializeToolbar } from './modules/toolbar.js';
import { initializeState } from './modules/state.js';
import { initializeFileIO } from './modules/file-io.js';
import { initializeAIChat } from './modules/ai-chat.js';
import { initializeAIFeedback } from './modules/ai-feedback.js';

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
  console.time('DOMContentLoaded to Ready');

  try {
    console.log('[Renderer] 1. Initializing state...');
    console.time('State Init');
    initializeState();
    console.timeEnd('State Init');

    console.log('[Renderer] 2. Initializing editor...');
    console.time('Editor Init');
    const editorView = initializeEditor(scheduleUpdate);
    console.timeEnd('Editor Init');
    console.log('[Renderer] Editor view created:', !!editorView);

    console.log('[Renderer] 3. Initializing toolbar...');
    console.time('Toolbar Init');
    initializeToolbar(editorView);
    console.timeEnd('Toolbar Init');

    console.log('[Renderer] 3.5. Initializing word counter...');
    console.time('Word Counter Init');
    import('./modules/word-counter.js').then(({ initializeWordCounter }) => {
      initializeWordCounter(editorView);
      console.timeEnd('Word Counter Init');
    });

    console.log('[Renderer] 4. Initializing file IO...');
    console.time('FileIO Init');
    initializeFileIO(editorView);
    console.timeEnd('FileIO Init');

    console.log('[Renderer] 5. Initializing AI Chat...');
    console.time('AI Chat Init');
    initializeAIChat();
    console.timeEnd('AI Chat Init');

    console.log('[Renderer] 5.5. Initializing AI Feedback...');
    console.time('AI Feedback Init');
    initializeAIFeedback(editorView);
    console.timeEnd('AI Feedback Init');

    console.log('[Renderer] 6. Setting up scroll sync...');
    console.time('Scroll Sync Setup');
    setEditorScrollCallback(handleEditorScroll);
    setPreviewScrollCallback(handlePreviewScroll);
    console.timeEnd('Scroll Sync Setup');

    console.log('[Renderer] 6. Initializing title bar buttons...');
    console.time('Title Bar Init');
    // Обработчики для кнопок шапки
    document.getElementById('minimize-btn')?.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });
    document.getElementById('maximize-btn')?.addEventListener('click', () => {
      window.electronAPI.maximizeWindow();
    });
    document.getElementById('close-btn')?.addEventListener('click', () => {
      window.electronAPI.closeWindow();
    });

    // Функция для обновления состояния полноэкранного режима
    const updateFullscreenState = (isFullscreen) => {
      console.log('[Renderer] Fullscreen state:', isFullscreen);
      if (isFullscreen) {
        document.body.classList.add('fullscreen');
      } else {
        document.body.classList.remove('fullscreen');
      }
    };

    // Обработчик изменения полноэкранного режима
    window.electronAPI.onFullscreenChanged((event, isFullscreen) => {
      updateFullscreenState(isFullscreen);
    });
    console.timeEnd('Title Bar Init');

    console.log('[Renderer] 7. Initial rendering...');
    console.time('Initial Render');
    scheduleUpdate(editorView.state.doc.toString());
    console.timeEnd('Initial Render');

    console.log('[Renderer] 8. Initializing MathJax...');
    console.time('MathJax Init');
    // Инициализация MathJax после загрузки всех компонентов
    if (window.MathJax) {
      // MathJax 3 использует другой API
      MathJax.startup.promise.then(() => {
        console.log('[Renderer] MathJax initialized successfully');
        // Перерендерим preview после инициализации MathJax
        scheduleUpdate(editorView.state.doc.toString());
      }).catch((error) => {
        console.error('[Renderer] MathJax initialization failed:', error);
      });
    } else {
      console.warn('[Renderer] MathJax not found, math formulas may not render');
    }
    console.timeEnd('MathJax Init');

    console.timeEnd('DOMContentLoaded to Ready');
    console.timeEnd('Total App Initialization');
    console.log('[Renderer] Initialization complete!');

    // Скрываем loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 300); // Ждем завершения transition
    }
  } catch (error) {
    console.error('[Renderer] Critical error during initialization:', error);
    // В случае ошибки тоже скрываем overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 300);
    }
  }
});
