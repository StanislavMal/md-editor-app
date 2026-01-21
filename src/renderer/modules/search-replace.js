import { getEditorView } from './editor.js';
import { openSearchPanel, closeSearchPanel } from '@codemirror/search';

console.log('[Module Loaded] search-replace.js');

/**
 * Переключает панель поиска и замены CodeMirror
 */
export function openSearchDialog() {
  const editorView = getEditorView();
  if (!editorView) return;

  const searchPanel = editorView.dom.querySelector('.cm-search');
  if (searchPanel) {
    // Если открыта, закрываем
    closeSearchPanel(editorView);
  } else {
    // Если закрыта, открываем
    openSearchPanel(editorView);
    // Даем время на рендеринг, затем локализуем
    setTimeout(() => localizeSearchPanel(editorView), 10);
  }
}

/**
 * Локализует текст в панели поиска
 */
function localizeSearchPanel(editorView) {
  const searchPanel = editorView.dom.querySelector('.cm-search');
  if (!searchPanel) return;

  // Заменяем плейсхолдеры
  const findInput = searchPanel.querySelector('input[name="search"]');
  if (findInput && findInput.placeholder === 'Find') {
    findInput.placeholder = 'Найти';
  }

  const replaceInput = searchPanel.querySelector('input[name="replace"]');
  if (replaceInput && replaceInput.placeholder === 'Replace') {
    replaceInput.placeholder = 'Заменить';
  }

  // Заменяем текст кнопок
  const buttons = searchPanel.querySelectorAll('button');
  buttons.forEach(button => {
    if (button.textContent === 'next') {
      button.textContent = 'далее';
    } else if (button.textContent === 'previous') {
      button.textContent = 'выше';
    } else if (button.textContent === 'all') {
      button.textContent = 'все';
    } else if (button.textContent === 'replace') {
      button.textContent = 'заменить';
    } else if (button.textContent === 'replace all') {
      button.textContent = 'заменить все';
    }
  });

  // Заменяем текст в чекбоксах
  const labels = searchPanel.querySelectorAll('label');
  labels.forEach(label => {
    // Находим текстовый узел и заменяем только его
    const textNode = Array.from(label.childNodes).find(node =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim()
    );
    if (textNode) {
      const originalText = textNode.textContent.trim();
      if (originalText === 'match case') {
        textNode.textContent = ' учитывать регистр';
      } else if (originalText === 'regexp') {
        textNode.textContent = ' регулярное выражение';
      } else if (originalText === 'by word') {
        textNode.textContent = ' по словам';
      }
    }
  });
}

/**
 * Закрывает панель поиска
 */
export function closeSearchDialog() {
  const editorView = getEditorView();
  if (!editorView) return;

  closeSearchPanel(editorView);
}
