// src/renderer/modules/ai-feedback.js
console.log('[Module Loaded] ai-feedback.js');

// DOM элементы
let spinnerOverlay = null;
let feedbackModal = null;
let originalText = '';
let currentEditorView = null;
let currentSelection = null;

// Инициализация модуля
export function initializeAIFeedback(editorView) {
  currentEditorView = editorView;

  // Создаем оверлей спинера
  createSpinnerOverlay();

  // Создаем модальное окно обратной связи
  createFeedbackModal();
}

// Создание оверлея спинера
function createSpinnerOverlay() {
  if (spinnerOverlay) return;

  spinnerOverlay = document.createElement('div');
  spinnerOverlay.className = 'ai-spinner-overlay';
  spinnerOverlay.innerHTML = `
    <div class="ai-spinner-ring"></div>
  `;

  // Добавляем в body для центрирования по экрану
  document.body.appendChild(spinnerOverlay);
}

// Создание модального окна обратной связи
function createFeedbackModal() {
  if (feedbackModal) return;

  feedbackModal = document.createElement('div');
  feedbackModal.className = 'ai-feedback-modal';
  feedbackModal.innerHTML = `
    <div class="ai-feedback-content">
      <button class="ai-feedback-btn ai-feedback-accept">Принять изменения</button>
      <button class="ai-feedback-btn ai-feedback-retry">Попробовать ещё раз</button>
      <button class="ai-feedback-btn ai-feedback-cancel">Отменить изменения</button>
    </div>
  `;

  // Добавляем в контейнер редактора или в body как fallback
  const editorPane = document.querySelector('.editor-pane');
  if (editorPane) {
    editorPane.appendChild(feedbackModal);
  } else {
    // Если .editor-pane не найден, добавляем в body
    document.body.appendChild(feedbackModal);
  }

  // Обработчики кнопок
  const acceptBtn = feedbackModal.querySelector('.ai-feedback-accept');
  const retryBtn = feedbackModal.querySelector('.ai-feedback-retry');
  const cancelBtn = feedbackModal.querySelector('.ai-feedback-cancel');

  acceptBtn.addEventListener('click', handleAccept);
  retryBtn.addEventListener('click', handleRetry);
  cancelBtn.addEventListener('click', handleCancel);
}

// Показать спинер
export function showSpinner() {
  if (spinnerOverlay) {
    spinnerOverlay.style.display = 'flex';
  }
}

// Скрыть спинер
export function hideSpinner() {
  if (spinnerOverlay) {
    spinnerOverlay.style.display = 'none';
  }
}

// Сохранить оригинальный текст
export function saveOriginalText(editorView, selection = null) {
  currentEditorView = editorView;
  currentSelection = selection;

  // Всегда сохраняем весь текст документа для возможности полного восстановления
  originalText = editorView.state.doc.toString();
  console.log('[AI Feedback] Сохранен оригинальный текст (весь документ), длина:', originalText.length, 'selection:', selection);
}

// Показать модальное окно обратной связи
export function showFeedbackModal(onAccept, onRetry, onCancel) {
  if (!feedbackModal) {
    // Если модальное окно не создано, создаем его
    createFeedbackModal();
  }

  // Сохраняем коллбэки (перезаписываем предыдущие)
  feedbackModal._onAccept = onAccept;
  feedbackModal._onRetry = onRetry;
  feedbackModal._onCancel = onCancel;

  feedbackModal.style.display = 'flex';
}

// Скрыть модальное окно обратной связи
export function hideFeedbackModal() {
  if (feedbackModal) {
    feedbackModal.style.display = 'none';
  }
}

// Обработчики кнопок
function handleAccept() {
  hideFeedbackModal();
  if (feedbackModal._onAccept) {
    feedbackModal._onAccept();
  }
}

function handleRetry() {
  hideFeedbackModal();
  if (feedbackModal._onRetry) {
    feedbackModal._onRetry();
  }
}

function handleCancel() {
  console.log('[AI Feedback] Отмена изменений, originalText длина:', originalText.length, 'currentEditorView:', !!currentEditorView, 'currentSelection:', currentSelection);
  
  // Вызываем коллбэк перед восстановлением текста и скрытием модального окна
  if (feedbackModal._onCancel) {
    feedbackModal._onCancel();
  }

  // Восстанавливаем оригинальный текст (весь документ)
  if (currentEditorView && originalText !== '') {
    console.log('[AI Feedback] Восстановление всего документа, длина документа:', currentEditorView.state.doc.length, 'длина оригинального текста:', originalText.length);
    currentEditorView.dispatch({
      changes: { from: 0, to: currentEditorView.state.doc.length, insert: originalText },
      selection: { anchor: originalText.length }
    });
    console.log('[AI Feedback] Текст восстановлен');
  } else {
    console.warn('[AI Feedback] Не удалось восстановить текст: currentEditorView отсутствует или originalText пуст');
  }

  hideFeedbackModal();
}
