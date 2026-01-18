// src/renderer/modules/toolbar.js
console.log('[Module Loaded] toolbar.js');

import { applyMarkdown, insertLineBreak, getEditorView } from './editor.js';
import { toggleTheme, togglePreview, zoomIn, zoomOut, resetZoom } from './state.js';
import { handleQuickSave } from './file-io.js';
import { formatTextWithAI, saveAISettings, getAISettingsPublic, testAPIConnection } from './ai.js';

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

  // --- AI форматирование ---
  document.getElementById('btn-ai-format').addEventListener('click', () => handleAIFormat(editorView));
  document.getElementById('btn-ai-settings').addEventListener('click', () => showAISettings());

  // --- Кнопки управления видом ---
  document.getElementById('toggle-preview').addEventListener('click', () => togglePreview(editorView));
  document.getElementById('zoom-in').addEventListener('click', zoomIn);
  document.getElementById('zoom-out').addEventListener('click', zoomOut);
  document.getElementById('zoom-reset').addEventListener('click', resetZoom);

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
    if (e.ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      togglePreview(editorView);
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      toggleTheme();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleQuickSave();
    }
  });

}

/**
 * Обрабатывает AI форматирование текста
 * @param {import('@codemirror/view').EditorView} editorView - Экземпляр редактора
 */
async function handleAIFormat(editorView) {
  if (!editorView) return;

  const text = editorView.state.doc.toString().trim();

  if (!text) {
    alert('Нет текста для форматирования. Введите текст в редактор.');
    return;
  }

  // Показываем индикатор загрузки
  const aiButton = document.getElementById('btn-ai-format');
  const originalText = aiButton.innerHTML;
  aiButton.innerHTML = '<div class="spinner" style="width: 12px; height: 12px; border: 2px solid #ccc; border-top: 2px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
  aiButton.disabled = true;

  try {
    console.log('[AI] Начинаем форматирование текста...');
    const formattedText = await formatTextWithAI(text);

    // Заменяем весь текст в редакторе
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: formattedText
      },
      selection: { anchor: formattedText.length }
    });

    console.log('[AI] Форматирование завершено успешно');
  } catch (error) {
    console.error('[AI] Ошибка форматирования:', error);
    alert(`Ошибка AI форматирования: ${error.message}`);
  } finally {
    // Восстанавливаем кнопку
    aiButton.innerHTML = originalText;
    aiButton.disabled = false;
  }
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
      </select>
    </div>

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
  const deepseekSettings = modalContent.querySelector('#deepseek-settings');
  const geminiSettings = modalContent.querySelector('#gemini-settings');

  providerSelect.addEventListener('change', () => {
    if (providerSelect.value === 'deepseek') {
      deepseekSettings.style.display = 'block';
      geminiSettings.style.display = 'none';
    } else {
      deepseekSettings.style.display = 'none';
      geminiSettings.style.display = 'block';
    }
  });

  modalContent.querySelector('#save-settings').addEventListener('click', () => {
    const provider = providerSelect.value;
    const deepseekKey = modalContent.querySelector('#deepseek-key').value;
    const geminiKey = modalContent.querySelector('#gemini-key').value;

    saveAISettings({
      provider,
      deepseekKey,
      geminiKey
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
