// src/renderer/modules/editor.js

import { EditorState, StateEffect, StateField, EditorSelection, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { lightTheme, darkTheme } from './editor-theme.js';
import { setUnsavedChanges } from './state.js';

console.log('[Module Loaded] editor.js');

let editorView;
let onScrollCallback = () => {};
let themeCompartment = new Compartment();

function getCurrentTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? darkTheme : lightTheme;
}

const addPlaceholder = StateEffect.define();
const updatePlaceholder = StateEffect.define();
const placeholderField = StateField.define({
  create() { return new Map(); },
  update(placeholders, tr) {
    let newPlaceholders = new Map();
    for (const [id, pos] of placeholders.entries()) {
      const from = tr.changes.mapPos(pos.from, -1);
      const to = tr.changes.mapPos(pos.to, 1);
      if (from < to) {
        newPlaceholders.set(id, { from, to });
      }
    }
    for (const effect of tr.effects) {
      if (effect.is(addPlaceholder)) {
        newPlaceholders.set(effect.value.id, { from: effect.value.from, to: effect.value.to });
      } else if (effect.is(updatePlaceholder)) {
        newPlaceholders.delete(effect.value.id);
      }
    }
    return newPlaceholders;
  },
});

export function initializeEditor(onUpdate) {
  const editorPane = document.querySelector('.editor-pane');

  const initialState = EditorState.create({
    doc: `# Добро пожаловать!\n\nЭто ваш новый Markdown-редактор.`,
    extensions: [
      lineNumbers(), history(), drawSelection(), EditorView.lineWrapping,
      markdown({
        base: markdownLanguage,
        codeLanguages: (info) => {
          const langMap = {
            javascript: javascript,
            js: javascript,
            typescript: javascript,
            ts: javascript,
            python: python,
            py: python,
            cpp: cpp,
            'c++': cpp,
            c: cpp,
            java: java,
            rust: rust,
            rs: rust,
            go: go,
            golang: go,
            php: php,
            sql: sql,
            html: html,
            css: css,
            json: json,
            xml: xml,
          };
          return langMap[info.toLowerCase()] || null;
        }
      }),
      themeCompartment.of(getCurrentTheme()),
      keymap.of([
        { key: 'Shift-Enter', run: (view) => insertLineBreak(view) },
        ...defaultKeymap, ...historyKeymap, indentWithTab,
        { key: 'Ctrl-b', run: (view) => applyMarkdown('bold', view) },
        { key: 'Ctrl-i', run: (view) => applyMarkdown('italic', view) },
        { key: 'Ctrl-h', run: (view) => applyMarkdown('heading', view) },
        { key: 'Ctrl-q', run: (view) => applyMarkdown('quote', view) },
        { key: 'Ctrl-u', run: (view) => applyMarkdown('ul', view) },
        { key: 'Ctrl-o', run: (view) => applyMarkdown('ol', view) },
        { key: 'Ctrl-k', run: (view) => applyMarkdown('link', view) },
        { key: 'Ctrl-g', run: (view) => applyMarkdown('image', view) },
        { key: 'Ctrl-t', run: (view) => applyMarkdown('table', view) },
        { key: 'Ctrl-Shift-l', run: (view) => applyMarkdown('tasklist', view) },
      ]),
      placeholderField,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            onUpdate(update.state.doc.toString());
            // Отмечаем, что есть несохраненные изменения
            setUnsavedChanges(true);
        }
      }),
      EditorView.domEventHandlers({
        paste: (event, view) => handlePaste(event, view),
        drop: (event, view) => handleDrop(event, view),
        dragover: (event) => event.preventDefault(),
        contextmenu: (event) => { event.preventDefault(); window.electronAPI.showContextMenu(); }
      })
    ],
  });

  editorView = new EditorView({ state: initialState, parent: editorPane });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        editorView.dispatch({
          effects: themeCompartment.reconfigure(getCurrentTheme())
        });
      }
    });
  });
  observer.observe(document.documentElement, { attributes: true });

  editorView.scrollDOM.addEventListener('scroll', () => {
    const scrollTop = editorView.scrollDOM.scrollTop;
    const lineBlock = editorView.lineBlockAtHeight(scrollTop);
    const lineNumber = editorView.state.doc.lineAt(lineBlock.from).number;
    onScrollCallback(lineNumber, editorView.scrollDOM);
  });

  return editorView;
}

export function setOnScrollCallback(callback) {
  onScrollCallback = callback;
}

export function scrollToText(line) {
  if (!editorView || !line) return;
  try {
    const linePos = editorView.state.doc.line(line).from;
    editorView.dispatch({ effects: EditorView.scrollIntoView(linePos, { y: 'start', yMargin: 10 }) });
  } catch (e) {
    console.warn(`[Editor] Не удалось прокрутить к строке ${line}:`, e.message);
  }
}


// --- НОВАЯ, УЛУЧШЕННАЯ ФУНКЦИЯ ФОРМАТИРОВАНИЯ ---
export function applyMarkdown(type, view = editorView) {
    if (!view) return false;
    view.focus();
    const { state, dispatch } = view;

    // --- НОВАЯ ЛОГИКА ДЛЯ СПИСКОВ И ЦИТАТ ---
    if (['ul', 'ol', 'quote', 'tasklist'].includes(type)) {
        const changes = [];
        const prefixes = {
            ul: /^\s*([-*+])\s+/,
            ol: /^\s*(\d+\.)\s+/,
            quote: /^\s*>\s?/,
            tasklist: /^\s*-\s+\[[\sx]\]\s+/
        };
        const newPrefixes = {
            ul: '- ',
            ol: '1. ',
            quote: '> ',
            tasklist: '- [ ] '
        };

        const { from, to } = state.selection.main;
        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);

        const lines = [];
        for (let i = startLine.number; i <= endLine.number; i++) {
            lines.push(state.doc.line(i));
        }

        const isAllLinesFormatted = lines.every(line => prefixes[type].test(line.text));
        let olCounter = 1;

        for (const line of lines) {
            if (line.length === 0) continue;
            
            let currentPrefixMatch = null;
            for (const key in prefixes) {
                const match = line.text.match(prefixes[key]);
                if (match) {
                    currentPrefixMatch = { type: key, prefix: match[0] };
                    break;
                }
            }

            if (isAllLinesFormatted) {
                // Снимаем форматирование
                changes.push({ from: line.from, to: line.from + currentPrefixMatch.prefix.length, insert: '' });
            } else {
                if (currentPrefixMatch) {
                    // Меняем один тип на другой
                    const newPrefix = (type === 'ol') ? `${olCounter++}. ` : newPrefixes[type];
                    changes.push({ from: line.from, to: line.from + currentPrefixMatch.prefix.length, insert: newPrefix });
                } else {
                    // Добавляем новый префикс
                    const newPrefix = (type === 'ol') ? `${olCounter++}. ` : newPrefixes[type];
                    changes.push({ from: line.from, insert: newPrefix });
                }
            }
        }
        if (changes.length > 0) {
            dispatch({ changes });
        }
        return true;
    }

    // --- СТАРАЯ ЛОГИКА ДЛЯ ОСТАЛЬНЫХ ТИПОВ ---
    const changes = [];
    const selectionRanges = [];
    
    for (const range of state.selection.ranges) {
        const text = state.doc.sliceString(range.from, range.to);

        if (type === 'heading') {
            const line = state.doc.lineAt(range.from);
            const lineText = line.text;
            let newHeading;
            if (lineText.startsWith('#')) {
                // Убираем все # и пробелы в начале
                newHeading = lineText.replace(/^#+\s*/, '');
            } else {
                // Добавляем # и пробел
                newHeading = `# ${lineText}`;
            }
            changes.push({ from: line.from, to: line.to, insert: newHeading });
            const newCursorPos = line.from + newHeading.length;
            selectionRanges.push(EditorSelection.range(newCursorPos, newCursorPos));
            break;
        }

        const templates = {
            'bold': { prefix: '**', suffix: '**', default: 'жирный текст' },
            'italic': { prefix: '*', suffix: '*', default: 'курсивный текст' },
            'link': { prefix: '[', suffix: '](https://)', default: 'текст ссылки' },
            'image': { prefix: '![описание изображения](https://){width="100%"}', suffix: '', default: '' },
            'table': { prefix: '\n| Заголовок 1 | Заголовок 2 |\n|---|---|\n| Ячейка 1 | Ячейка 2 |\n', suffix: '', default: '' },
        };
        const t = templates[type];
        if (!t) {
            selectionRanges.push(range);
            continue;
        };

        const content = text || t.default;
        const newText = t.prefix + content + t.suffix;
        changes.push({ from: range.from, to: range.to, insert: newText });
        
        const selectionStart = range.from + t.prefix.length;
        const selectionEnd = selectionStart + content.length;
        selectionRanges.push(EditorSelection.range(selectionStart, selectionEnd));
    }

    if (changes.length > 0) {
        view.dispatch({
            changes: changes,
            selection: EditorSelection.create(selectionRanges),
            scrollIntoView: true,
            userEvent: 'input'
        });
    }
    return true;
}


export function insertLineBreak(view = editorView) {
    if (!view) return false;
    const { state, dispatch } = view;
    const cursor = state.selection.main.head;
    const line = state.doc.lineAt(cursor);
    let textToInsert = '\n';
    if (line.text.trim() === '') {
        textToInsert = '\n&nbsp;\n';
    }
    dispatch({
        changes: { from: cursor, insert: textToInsert },
        selection: { anchor: cursor + textToInsert.length }
    });
    return true;
}

export function getEditorView() {
  return editorView;
}

async function handleImageUpload(base64Data, view) {
  const uploadId = `upload-${Date.now()}`;
  const placeholderText = `\n\n[Загрузка изображения ${uploadId}...]\n\n`;
  const insertPos = view.state.selection.main.head;
  const placeholderEnd = insertPos + placeholderText.length;

  view.dispatch({
    changes: { from: insertPos, insert: placeholderText },
    effects: addPlaceholder.of({ id: uploadId, from: insertPos, to: placeholderEnd })
  });

  try {
    const result = await window.electronAPI.saveImage(base64Data);
    let finalMarkdown;
    if (result.success) {
      const normalizedPath = result.filePath.replace(/\\/g, '/');
      finalMarkdown = `\n\n![изображение](${normalizedPath}){width="100%"}\n\n`;
    } else {
      finalMarkdown = `\n\n[Ошибка загрузки: ${result.error || 'Неизвестная ошибка'}]\n\n`;
    }
    const currentPlaceholders = view.state.field(placeholderField);
    const placeholderPos = currentPlaceholders.get(uploadId);
    if (placeholderPos) {
      view.dispatch({
        changes: { from: placeholderPos.from, to: placeholderPos.to, insert: finalMarkdown },
        effects: updatePlaceholder.of({ id: uploadId })
      });
    }
  } catch (error) {
    const errorMarkdown = `\n\n[Критическая ошибка загрузки: ${error.message}]\n\n`;
    const currentPlaceholders = view.state.field(placeholderField);
    const placeholderPos = currentPlaceholders.get(uploadId);
    if (placeholderPos) {
        view.dispatch({
            changes: { from: placeholderPos.from, to: placeholderPos.to, insert: errorMarkdown },
            effects: updatePlaceholder.of({ id: uploadId })
        });
    }
  }
}

function handlePaste(event, view) {
  const items = (event.clipboardData || window.clipboardData).items;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      event.preventDefault();
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (e) => handleImageUpload(e.target.result, view);
      reader.readAsDataURL(blob);
      return true; 
    }
  }
  return false;
}

function handleDrop(event, view) {
  event.preventDefault();
  const files = event.dataTransfer.files;
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => handleImageUpload(e.target.result, view);
      reader.readAsDataURL(file);
      return true;
    }
  }
  return false;
}
