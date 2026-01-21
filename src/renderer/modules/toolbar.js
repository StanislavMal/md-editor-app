// src/renderer/modules/toolbar.js
console.log('[Module Loaded] toolbar.js');

import { applyMarkdown, insertLineBreak, getEditorView, performUndo, performRedo } from './editor.js';
import { toggleTheme, togglePreview, zoomIn, zoomOut, resetZoom } from './state.js';
import { handleQuickSave } from './file-io.js';
import { formatTextWithAIStreaming, saveAISettings, getAISettingsPublic, testAPIConnection, getAvailableModels } from './ai.js';
import { initializeWordCounter } from './word-counter.js';
import { openSearchDialog } from './search-replace.js';

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

  // --- Кнопки undo/redo ---
  document.getElementById('btn-undo').addEventListener('click', () => performUndo(editorView));
  document.getElementById('btn-redo').addEventListener('click', () => performRedo(editorView));

  // --- Поиск и замена ---
  document.getElementById('btn-search-replace').addEventListener('click', () => openSearchDialog());

  // --- AI форматирование ---
  document.getElementById('btn-ai-format').addEventListener('click', () => handleAIFormat(editorView));
  document.getElementById('ai-settings-dropdown-btn').addEventListener('click', () => showAISettings());

  // --- Кнопки управления видом ---
  document.getElementById('toggle-preview').addEventListener('click', () => togglePreview(editorView));

  // --- Кнопки zoom в статус-баре ---
  document.getElementById('zoom-in')?.addEventListener('click', zoomIn);
  document.getElementById('zoom-out')?.addEventListener('click', zoomOut);
  document.getElementById('zoom-reset')?.addEventListener('click', resetZoom);

  // --- Переключатель темы ---
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // --- Dropdown меню для файла ---
  const fileBtn = document.getElementById('file-btn');
  const dropdown = fileBtn.closest('.dropdown');
  fileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Закрытие dropdown при клике вне
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Закрытие dropdown при выборе элемента
  dropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      dropdown.classList.remove('open');
    });
  });

  // --- Глобальные горячие клавиши ---
  document.addEventListener('keydown', (e) => {
    // Обработка клавиш в начале, до других обработчиков
    if (e.ctrlKey && (e.key.toLowerCase() === 'p' || e.code === 'KeyP')) {
      e.preventDefault();
      e.stopPropagation();
      togglePreview(editorView);
      return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === 'd' || e.code === 'KeyD')) {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme();
      return;
    }
    if (e.ctrlKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
      e.preventDefault();
      e.stopPropagation();
      handleQuickSave();
      return;
    }
    if (e.ctrlKey && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
      e.preventDefault();
      e.stopPropagation();
      openSearchDialog();
      return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === 'h' || e.code === 'KeyH')) {
      e.preventDefault();
      e.stopPropagation();
      openSearchDialog();
      return;
    }
  });

}

// Глобальная переменная для отслеживания состояния генерации
let isGenerating = false;
let abortController = null;

/**
 * Обрабатывает AI форматирование текста с streaming
 * @param {import('@codemirror/view').EditorView} editorView - Экземпляр редактора
 */
function handleAIFormat(editorView) {
  if (!editorView) return;

  // Если генерация уже идет, останавливаем её
  if (isGenerating) {
    stopGeneration();
    return;
  }

  const text = editorView.state.doc.toString().trim();

  if (!text) {
    alert('Нет текста для форматирования. Введите текст в редактор.');
    return;
  }

  startGeneration(editorView, text);
}

/**
 * Начинает генерацию текста
 */
function startGeneration(editorView, text) {
  isGenerating = true;
  abortController = new AbortController();

  const aiButton = document.getElementById('btn-ai-format');
  const originalText = aiButton.innerHTML;

  // Меняем кнопку на "Стоп"
  aiButton.innerHTML = '⏹️';
  aiButton.title = 'Остановить генерацию (MD AI)';
  aiButton.style.backgroundColor = '#dc3545';
  aiButton.style.color = 'white';

  console.log('[AI] Начинаем streaming форматирование текста...');

  formatTextWithAIStreaming(
    text,
    // onChunk - вызывается при получении очередного кусочка текста
    (chunkText) => {
      if (abortController.signal.aborted) return;

      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: chunkText
        },
        selection: { anchor: chunkText.length }
      });
    },
    // onComplete - вызывается при завершении генерации
    (finalText) => {
      if (abortController.signal.aborted) return;

      console.log('[AI] Streaming форматирование завершено успешно');
      stopGeneration();
    },
    // onError - вызывается при ошибке
    (error) => {
      if (abortController.signal.aborted) return;

      console.error('[AI] Ошибка streaming форматирования:', error);
      alert(`Ошибка AI форматирования: ${error.message}`);
      stopGeneration();
    }
  );
}

/**
 * Останавливает генерацию текста
 */
function stopGeneration() {
  if (abortController) {
    abortController.abort();
  }

  isGenerating = false;
  abortController = null;

  const aiButton = document.getElementById('btn-ai-format');
  const originalHTML = '<svg class="icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0 0 2.22c1.58-.64 3.129-.82 4.186-.82s2.606.18 4.186.82a1.54 1.54 0 0 0 0-2.22c-.658-.215-1.777-.57-2.887-.87C9.843.266 8.69 0 8 0zM5.264 1.441c.646-.311 1.353-.441 2.736-.441s2.09.13 2.736.44l.783.38c.68.329 1.059.497 1.659.741.601.246 1.305.49 2.049.679A1.5 1.5 0 0 1 16 5.53c0 .449-.131.807-.508 1.07-.377.265-.91.43-1.514.511a3.746 3.746 0 0 1-.666.082c-.551 0-1.057-.062-1.47-.104a3.75 3.75 0 0 1-1.026-.25c-.595-.283-1.267-.465-2.041-.465s-1.446.182-2.041.465a3.75 3.75 0 0 1-1.026.25c-.413.042-.919.104-1.47.104a3.746 3.746 0 0 1-.666-.082c-.604-.08-1.137-.246-1.514-.511A1.495 1.495 0 0 1 0 5.53a1.5 1.5 0 0 1 1.076-1.408c.744-.189 1.448-.433 2.049-.679.6-.244.979-.412 1.659-.741l.783-.38z"/><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>';

  aiButton.innerHTML = originalHTML;
  aiButton.title = 'Форматировать текст через AI (MD AI)';
  aiButton.style.backgroundColor = '';
  aiButton.style.color = '';
}

/**
 * Создает HTML для селектора модели
 */
function createModelSelectorHTML(provider, selectedModel) {
  const models = getAvailableModels(provider);
  const options = models.map(model =>
    `<option value="${model.id}" ${selectedModel === model.id ? 'selected' : ''}>${model.name}</option>`
  ).join('');

  return `
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">Модель:</label>
      <select id="ai-model" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: var(--bg-color, white); color: var(--text-color, black);">
        ${options}
      </select>
    </div>
  `;
}

/**
 * Показывает диалог настроек AI
 */
function showAISettings() {
  const settings = getAISettingsPublic();

  // Создаем модальный диалог
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg-color, white);
    color: var(--text-color, black);
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    min-width: 400px;
    max-width: 500px;
  `;

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: var(--text-color, black);">Настройки AI</h3>

    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">Провайдер:</label>
      <select id="ai-provider" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: var(--bg-color, white); color: var(--text-color, black);">
        <option value="deepseek" ${settings.provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
        <option value="gemini" ${settings.provider === 'gemini' ? 'selected' : ''}>Gemini</option>
        <option value="groq" ${settings.provider === 'groq' ? 'selected' : ''}>Groq</option>
      </select>
    </div>

    ${createModelSelectorHTML(settings.provider, settings.model)}

    <div id="deepseek-settings" style="margin-bottom: 16px; ${settings.provider === 'deepseek' ? '' : 'display: none;'}">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">DeepSeek API Key:</label>
      <input type="password" id="deepseek-key" value="${settings.deepseekKey}" placeholder="sk-..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: var(--bg-color, white); color: var(--text-color, black);">
      <small style="color: #666; font-size: 12px;">Получить ключ: <a href="https://platform.deepseek.com" target="_blank" style="color: #007bff;">platform.deepseek.com</a></small>
    </div>

    <div id="gemini-settings" style="margin-bottom: 16px; ${settings.provider === 'gemini' ? '' : 'display: none;'}">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">Gemini API Key:</label>
      <input type="password" id="gemini-key" value="${settings.geminiKey}" placeholder="AIza..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: var(--bg-color, white); color: var(--text-color, black);">
      <small style="color: #666; font-size: 12px;">Получить ключ: <a href="https://makersuite.google.com/app/apikey" target="_blank" style="color: #007bff;">makersuite.google.com</a></small>
    </div>

    <div id="groq-settings" style="margin-bottom: 16px; ${settings.provider === 'groq' ? '' : 'display: none;'}">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">Groq API Key:</label>
      <input type="password" id="groq-key" value="${settings.groqKey}" placeholder="gsk-..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: var(--bg-color, white); color: var(--text-color, black);">
      <small style="color: #666; font-size: 12px;">Получить ключ: <a href="https://console.groq.com/keys" target="_blank" style="color: #007bff;">console.groq.com</a></small>
    </div>

    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
      <button id="test-connection" style="padding: 8px 16px; border: 1px solid #ccc; background: var(--bg-color, white); color: var(--text-color, black); border-radius: 4px; cursor: pointer;">Тест</button>
      <button id="save-settings" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">Сохранить</button>
      <button id="cancel-settings" style="padding: 8px 16px; border: 1px solid #ccc; background: var(--bg-color, white); color: var(--text-color, black); border-radius: 4px; cursor: pointer;">Отмена</button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Обработчики событий
  const providerSelect = modalContent.querySelector('#ai-provider');
  const modelSelect = modalContent.querySelector('#ai-model');
  const deepseekSettings = modalContent.querySelector('#deepseek-settings');
  const geminiSettings = modalContent.querySelector('#gemini-settings');
  const groqSettings = modalContent.querySelector('#groq-settings');

  const updateModelSelector = () => {
    const provider = providerSelect.value;
    const models = getAvailableModels(provider);
    const currentModel = modelSelect.value;

    // Проверяем, доступна ли текущая модель для нового провайдера
    const modelExists = models.some(m => m.id === currentModel);
    const defaultModel = models[0]?.id || '';

    modelSelect.innerHTML = models.map(model =>
      `<option value="${model.id}" ${(!modelExists && model.id === defaultModel) || (modelExists && currentModel === model.id) ? 'selected' : ''}>${model.name}</option>`
    ).join('');
  };

  providerSelect.addEventListener('change', () => {
    const provider = providerSelect.value;
    deepseekSettings.style.display = provider === 'deepseek' ? 'block' : 'none';
    geminiSettings.style.display = provider === 'gemini' ? 'block' : 'none';
    groqSettings.style.display = provider === 'groq' ? 'block' : 'none';
    updateModelSelector();
  });

  modalContent.querySelector('#save-settings').addEventListener('click', () => {
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const deepseekKey = modalContent.querySelector('#deepseek-key').value;
    const geminiKey = modalContent.querySelector('#gemini-key').value;
    const groqKey = modalContent.querySelector('#groq-key').value;

    saveAISettings({
      provider,
      model,
      deepseekKey,
      geminiKey,
      groqKey
    });

    document.body.removeChild(modal);
  });

  modalContent.querySelector('#cancel-settings').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  modalContent.querySelector('#test-connection').addEventListener('click', async () => {
    const provider = providerSelect.value;
    const testBtn = modalContent.querySelector('#test-connection');
    const originalText = testBtn.textContent;

    testBtn.textContent = 'Тестируем...';
    testBtn.disabled = true;

    try {
      const result = await testAPIConnection(provider);
      if (result.success) {
        alert('Подключение успешно!');
      } else {
        alert(`Ошибка подключения: ${result.error}`);
      }
    } catch (error) {
      alert(`Ошибка тестирования: ${error.message}`);
    } finally {
      testBtn.textContent = originalText;
      testBtn.disabled = false;
    }
  });

  // Закрытие по клику вне модала
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}
