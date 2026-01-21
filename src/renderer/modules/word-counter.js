// src/renderer/modules/word-counter.js
import { EditorView } from '@codemirror/view';

console.log('[Module Loaded] word-counter.js');

/**
 * Подсчет слов в тексте
 * @param {string} text - Текст для анализа
 * @returns {number} Количество слов
 */
export function countWords(text) {
  if (!text) return 0;
  // Удаляем Markdown синтаксис и подсчитываем слова
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '') // Удаляем кодовые блоки
    .replace(/`[^`]*`/g, '') // Удаляем инлайновый код
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Заменяем ссылки на текст
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // Заменяем изображения на alt текст
    .replace(/#{1,6}\s+/g, '') // Удаляем заголовки
    .replace(/^\s*[-*+]\s+/gm, '') // Удаляем маркеры списков
    .replace(/^\s*\d+\.\s+/gm, '') // Удаляем нумерованные списки
    .replace(/^\s*>\s+/gm, '') // Удаляем цитаты
    .replace(/^\s*[-*_]{3,}\s*$/gm, '') // Удаляем разделители
    .replace(/[*_`~\[\]()]/g, '') // Удаляем остальные Markdown символы
    .trim();

  return cleanText.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Подсчет символов в тексте
 * @param {string} text - Текст для анализа
 * @param {boolean} includeSpaces - Включать ли пробелы
 * @returns {number} Количество символов
 */
export function countChars(text, includeSpaces = true) {
  if (!text) return 0;
  return includeSpaces ? text.length : text.replace(/\s/g, '').length;
}

/**
 * Подсчет строк в тексте
 * @param {string} text - Текст для анализа
 * @returns {number} Количество строк
 */
export function countLines(text) {
  if (!text) return 1;
  return text.split('\n').length;
}

/**
 * Оценка времени чтения текста (средняя скорость 200 слов в минуту)
 * @param {number} wordCount - Количество слов
 * @returns {string} Время чтения в формате "Xm Ys" или "X мин"
 */
export function estimateReadingTime(wordCount) {
  if (wordCount === 0) return '0 сек';

  const wordsPerMinute = 200;
  const totalSeconds = Math.round((wordCount / wordsPerMinute) * 60);

  if (totalSeconds < 60) {
    return `${totalSeconds} сек`;
  } else {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds > 0 ? `${minutes} мин ${seconds} сек` : `${minutes} мин`;
  }
}

/**
 * Обновление отображения статистики в статус-баре
 * @param {string} text - Текущий текст редактора
 */
export function updateStats(text) {
  const words = countWords(text);
  const charsWithSpaces = countChars(text, true);
  const charsWithoutSpaces = countChars(text, false);
  const lines = countLines(text);
  const readingTime = estimateReadingTime(words);

  // Обновляем элементы в статус-баре
  const wordCountEl = document.getElementById('word-count');
  const charCountEl = document.getElementById('char-count');
  const lineCountEl = document.getElementById('line-count');
  const readingTimeEl = document.getElementById('reading-time');

  if (wordCountEl) wordCountEl.textContent = `${words}`;
  if (charCountEl) charCountEl.textContent = `${charsWithSpaces} (${charsWithoutSpaces})`;
  if (lineCountEl) lineCountEl.textContent = `${lines}`;
  if (readingTimeEl) readingTimeEl.textContent = readingTime;
}

/**
 * Инициализация счетчика слов
 * @param {EditorView} editorView - Экземпляр редактора CodeMirror
 */
export function initializeWordCounter(editorView) {
  console.log('[WordCounter] Инициализация счетчика слов');

  // Первоначальное обновление
  updateStats(editorView.state.doc.toString());
}
