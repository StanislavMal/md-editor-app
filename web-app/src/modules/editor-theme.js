// src/renderer/modules/editor-theme.js

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark'; // Импортируем готовую темную тему как основу

// --- 1. Шрифты и базовые метрики ---
// Используем те же переменные, что и в вашем style.css для консистентности
const fontSettings = EditorView.theme({
  '&': {
    fontFamily: 'var(--font-mono)',
    fontSize: '15px',
  },
  '.cm-scroller': {
    lineHeight: '1.7',
  },
});

// --- 2. Палитра цветов для подсветки синтаксиса ---
// Вдохновлено палитрами GitHub и VS Code для максимальной читаемости

const lightColors = {
  keyword: '#d73a49',
  comment: '#6a737d',
  string: '#032f62',
  number: '#005cc5',
  variableName: '#e36209',
  className: '#6f42c1',
  functionName: '#6f42c1',
  propertyName: '#005cc5',
  operator: '#d73a49',
  punctuation: '#24292e',
  meta: '#005cc5',
  heading: '#005cc5',
  link: '#032f62',
};

const darkColors = {
  keyword: '#ff7b72',
  comment: '#8b949e',
  string: '#a5d6ff',
  number: '#79c0ff',
  variableName: '#ffa657',
  className: '#d2a8ff',
  functionName: '#d2a8ff',
  propertyName: '#79c0ff',
  operator: '#ff7b72',
  punctuation: '#c9d1d9',
  meta: '#79c0ff',
  heading: '#79c0ff',
  link: '#a5d6ff',
};

// --- 3. Создание кастомного HighlightStyle ---
// Это семантический способ стилизации. Мы говорим "все ключевые слова должны быть такого цвета",
// а CodeMirror сам разбирается, как их найти в разных языках.

const customSyntaxHighlighting = HighlightStyle.define([
  // Светлая тема (по умолчанию)
  { tag: t.keyword, color: lightColors.keyword },
  { tag: [t.comment, t.docComment], color: lightColors.comment, fontStyle: 'italic' },
  { tag: [t.string, t.special(t.string)], color: lightColors.string },
  { tag: [t.number, t.bool, t.null], color: lightColors.number },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: lightColors.variableName },
  { tag: [t.className, t.typeName], color: lightColors.className },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: lightColors.functionName },
  { tag: t.propertyName, color: lightColors.propertyName },
  { tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator], color: lightColors.operator },
  { tag: t.punctuation, color: lightColors.punctuation },
  { tag: t.meta, color: lightColors.meta },
  { tag: [t.heading1, t.heading2, t.heading3], color: lightColors.heading, fontWeight: 'bold' },
  { tag: t.url, color: lightColors.link, textDecoration: 'underline' },

  // Темная тема (применяется, когда есть родительский [data-theme="dark"])
  // Знак '&' здесь означает "применить к элементу с этим классом"
  {
    tag: t.keyword,
    color: darkColors.keyword,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: [t.comment, t.docComment],
    color: darkColors.comment,
    fontStyle: 'italic',
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: [t.string, t.special(t.string)],
    color: darkColors.string,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: [t.number, t.bool, t.null],
    color: darkColors.number,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: [t.name, t.deleted, t.character, t.macroName],
    color: darkColors.variableName,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: [t.className, t.typeName],
    color: darkColors.className,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: darkColors.functionName,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: t.propertyName,
    color: darkColors.propertyName,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator],
    color: darkColors.operator,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: t.punctuation,
    color: darkColors.punctuation,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: t.meta,
    color: darkColors.meta,
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: [t.heading1, t.heading2, t.heading3],
    color: darkColors.heading,
    fontWeight: 'bold',
    '&': '[data-theme="dark"] .cm-editor'
  },
  {
    tag: t.url,
    color: darkColors.link,
    textDecoration: 'underline',
    '&': '[data-theme="dark"] .cm-editor'
  },
]);


// --- 4. Собираем всё вместе ---

// Тема для светлого режима
export const lightTheme = [
  fontSettings,
  syntaxHighlighting(customSyntaxHighlighting),
];

// Тема для темного режима
// Мы используем oneDark как основу и добавляем поверх нашу кастомную подсветку
export const darkTheme = [
  oneDark,
  fontSettings,
  syntaxHighlighting(customSyntaxHighlighting),
];
