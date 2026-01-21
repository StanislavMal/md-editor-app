import { getEditorView } from './editor.js';
import { openSearchPanel, closeSearchPanel } from '@codemirror/search';

console.log('[Module Loaded] search-replace.js');

/**
 * Открывает панель поиска и замены CodeMirror
 */
export function openSearchDialog() {
  const editorView = getEditorView();
  if (!editorView) return;

  openSearchPanel(editorView);
}

/**
 * Закрывает панель поиска
 */
export function closeSearchDialog() {
  const editorView = getEditorView();
  if (!editorView) return;

  closeSearchPanel(editorView);
}
