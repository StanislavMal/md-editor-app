// src/renderer/modules/ai-chat.js

import { getAISettingsPublic as getAISettings } from './ai.js';
import { getEditorView } from './editor.js';
import { chatWithAIStreaming } from './ai.js';
import { updateEditorPaneFullwidth } from './state.js';
import { showSpinner, hideSpinner, saveOriginalText, showFeedbackModal } from './ai-feedback.js';

console.log('[Module Loaded] ai-chat.js');

// Constants
const EDITING_PROMPT_SUFFIX = `Execute ONLY the user's editing request precisely.

CRITICAL CONSTRAINTS:
1. Preserve the original language of the text - NEVER change it unless translation is explicitly requested
2. When correcting text, follow the grammatical rules and conventions of the text's original language
3. NEVER add explanations, comments, or meta-commentary
4. For mathematical formulas:
   - Inline formulas: use $...$ syntax
   - Block formulas: use $$...$$ syntax
   - Consider A4 page width for formula formatting
5. Return ONLY the edited text with no additional text before or after

Your output must contain nothing but the modified text.`;

// Chat state
let conversations = [];
let currentConversationId = null;
let currentMode = 'chat';
let isPanelOpen = false;
let isLoading = false;

// For backward compatibility - points to current conversation messages
let chatHistory = [];

// Helper to get current conversation
function getCurrentConversation() {
  return conversations.find(conv => conv.id === currentConversationId);
}

// Helper to get current chat history (messages of current conversation)
function getCurrentChatHistory() {
  const currentConv = getCurrentConversation();
  return currentConv ? currentConv.messages.filter(msg => msg.mode === currentMode) : [];
}

// Update chatHistory reference
function updateChatHistoryReference() {
  chatHistory = getCurrentChatHistory();
}

// Create new conversation
function createNewConversation() {
  const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const newConversation = {
    id: conversationId,
    title: 'Новый диалог',
    messages: [],
    timestamp: Date.now()
  };

  conversations.unshift(newConversation); // Add to beginning
  currentConversationId = conversationId;
  updateChatHistoryReference();

  // Update title if we have first message
  if (conversations.length > 10) {
    conversations = conversations.slice(0, 10); // Keep only 10
  }

  renderMessages();
  saveConversations();
  updatePanelTitle();
}

// Load conversation by ID
function loadConversation(conversationId) {
  const conversation = conversations.find(conv => conv.id === conversationId);
  if (conversation) {
    currentConversationId = conversationId;
    // If user is in editing mode, switch to chat mode
    if (currentMode === 'editing') {
      currentMode = 'chat';
      updateModeButtons();
    }
    updateChatHistoryReference();
    renderMessages();
    updatePanelTitle();
  }
}

// Save conversations to localStorage
function saveConversations() {
  try {
    localStorage.setItem('ai-chat-conversations', JSON.stringify(conversations));
  } catch (error) {
    console.warn('[AI Chat] Failed to save conversations:', error);
  }
}

// Load conversations from localStorage
function loadConversations() {
  try {
    const saved = localStorage.getItem('ai-chat-conversations');
    if (saved) {
      conversations = JSON.parse(saved);
      // Ensure we have at least one conversation
      if (conversations.length === 0) {
        createNewConversation();
      } else {
        // Load last conversation or create new if none
        if (!currentConversationId || !conversations.find(conv => conv.id === currentConversationId)) {
          currentConversationId = conversations[0].id;
        }
        updateChatHistoryReference();
      }
    } else {
      // No saved conversations, create new
      createNewConversation();
    }
  } catch (error) {
    console.warn('[AI Chat] Failed to load conversations:', error);
    conversations = [];
    createNewConversation();
  }
}

// Update conversation title based on first user message
function updateConversationTitle() {
  const currentConv = getCurrentConversation();
  if (currentConv && currentConv.title === 'Новый диалог' && chatHistory.length > 0) {
    const firstUserMessage = chatHistory.find(msg => msg.role === 'user');
    if (firstUserMessage) {
      currentConv.title = firstUserMessage.content.length > 50
        ? firstUserMessage.content.substring(0, 50) + '...'
        : firstUserMessage.content;
      updatePanelTitle();
      saveConversations();
    }
  }
}

// Update panel title
function updatePanelTitle() {
  const titleElement = document.querySelector('.ai-chat-title span');
  if (titleElement) {
    const currentConv = getCurrentConversation();
    titleElement.textContent = currentConv ? currentConv.title : 'AI Чат';
  }
}

// Delete conversation by ID
function deleteConversation(conversationId) {
  const index = conversations.findIndex(conv => conv.id === conversationId);
  if (index === -1) return;

  // Remove from array
  conversations.splice(index, 1);

  // If deleted current conversation, switch to another or create new
  if (conversationId === currentConversationId) {
    if (conversations.length > 0) {
      // Switch to first conversation
      currentConversationId = conversations[0].id;
      updateChatHistoryReference();
      renderMessages();
      updatePanelTitle();
    } else {
      // No conversations left, create new
      createNewConversation();
    }
  }

  // Save changes
  saveConversations();
}

// Show conversation history dropdown
function showConversationHistory() {
  console.log('[AI Chat] History button clicked, conversations:', conversations);

  // Remove existing dropdown
  const existingDropdown = document.querySelector('.ai-chat-history-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
    return;
  }

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'ai-chat-history-dropdown';

  // Add conversations
  conversations.forEach((conv, index) => {
    const item = document.createElement('div');
    item.className = `ai-chat-history-item${conv.id === currentConversationId ? ' active' : ''}`;

    // Main click handler for loading conversation
    item.onclick = (e) => {
      // Don't load if clicking delete button
      if (e.target.closest('.ai-chat-history-delete')) return;
      loadConversation(conv.id);
      dropdown.remove();
    };

    const date = new Date(conv.timestamp).toLocaleString();
    const lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
    const preview = lastMessage
      ? `${lastMessage.role === 'user' ? 'Вы' : 'ИИ'}: ${lastMessage.content.substring(0, 30)}${lastMessage.content.length > 30 ? '...' : ''}`
      : 'Пустой диалог';

    item.innerHTML = `
      <div class="ai-chat-history-content">
        <div class="ai-chat-history-title">${conv.title}</div>
        <div class="ai-chat-history-meta">${date} • ${conv.messages.length} сообщений</div>
        <div class="ai-chat-history-preview">${preview}</div>
      </div>
      <button class="ai-chat-history-delete" title="Удалить диалог">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
        </svg>
      </button>
    `;

    // Add delete button event listener
    const deleteButton = item.querySelector('.ai-chat-history-delete');
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
      dropdown.remove();
      showConversationHistory(); // Re-show dropdown
    });

    dropdown.appendChild(item);
  });

  // Add to header
  const header = document.querySelector('.ai-chat-header');
  if (header) {
    header.appendChild(dropdown);

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeDropdown(e) {
        if (!dropdown.contains(e.target) && !e.target.closest('#ai-chat-history')) {
          dropdown.remove();
          document.removeEventListener('click', closeDropdown);
        }
      });
    }, 0);
  }
}

// DOM elements
let panelElement = null;
let messagesContainer = null;
let inputElement = null;
let sendButton = null;
let modeChatBtn = null;
let modeEditingBtn = null;
let closeButton = null;

// Initialize AI Chat
export function initializeAIChat() {
  console.log('[AI Chat] Initializing...');

  // Get DOM elements
  panelElement = document.getElementById('ai-chat-panel');
  messagesContainer = document.getElementById('ai-chat-messages');
  inputElement = document.getElementById('ai-chat-input');
  sendButton = document.getElementById('ai-chat-send');
  modeChatBtn = document.getElementById('mode-chat');
  modeEditingBtn = document.getElementById('mode-editing');
  closeButton = document.getElementById('ai-chat-close');

  if (!panelElement || !messagesContainer || !inputElement) {
    console.error('[AI Chat] Required DOM elements not found');
    return;
  }

  // Load conversations from localStorage
  loadConversations();

  // Update mode button states
  updateModeButtons();

  // Setup event listeners
  setupEventListeners();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Initialize context menu
  initializeContextMenu();

  // Setup context menu handlers
  setupContextMenuHandlers();

  // Setup global function for example buttons
  window.sendExampleMessage = (message) => {
    if (inputElement) {
      inputElement.value = message;
      handleSendMessage();
    }
  };

  console.log('[AI Chat] Initialized successfully');
}

// Setup event listeners
function setupEventListeners() {
  // Toggle panel button (toolbar)
  const toggleButton = document.getElementById('btn-ai-chat');
  if (toggleButton) {
    toggleButton.addEventListener('click', togglePanel);
  }

  // Toggle panel button (side)
  const sideToggleButton = document.getElementById('ai-chat-toggle');
  if (sideToggleButton) {
    sideToggleButton.addEventListener('click', togglePanel);
  }

  // History button
  const historyButton = document.getElementById('ai-chat-history');
  console.log('[AI Chat] History button element:', historyButton);
  if (historyButton) {
    historyButton.addEventListener('click', (e) => {
      console.log('[AI Chat] History button clicked event fired');
      e.stopPropagation();
      showConversationHistory();
    });
  } else {
    console.warn('[AI Chat] History button not found');
  }

  // New conversation button
  const newButton = document.getElementById('ai-chat-new');
  if (newButton) {
    newButton.addEventListener('click', createNewConversation);
  }

  // Close button
  if (closeButton) {
    closeButton.addEventListener('click', closePanel);
  }

  // Send button
  if (sendButton) {
    sendButton.addEventListener('click', handleSendMessage);
  }

  // Input field
  if (inputElement) {
    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    inputElement.addEventListener('input', adjustInputHeight);
  }

  // Mode buttons
  if (modeChatBtn) {
    modeChatBtn.addEventListener('click', () => {
      if (currentMode === 'chat') return;
      currentMode = 'chat';
      updateModeButtons();

      // Switch to last chat conversation
      const chatConv = conversations.find(conv => conv.messages.some(msg => msg.mode === 'chat'));
      if (chatConv) {
        loadConversation(chatConv.id);
      } else {
        // If no chat conversations, create new
        createNewConversation();
      }
    });
  }

  if (modeEditingBtn) {
    modeEditingBtn.addEventListener('click', () => {
      if (currentMode === 'editing') return;
      currentMode = 'editing';
      updateModeButtons();

      // Clear messages for editing mode
      if (messagesContainer) {
        messagesContainer.innerHTML = '';
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'ai-chat-welcome';
        welcomeMessage.innerHTML = `<div class="ai-message ai-message-assistant"><div class="ai-message-avatar">🤖</div><div class="ai-message-content"><p><strong>Режим редактирования</strong><br><br>В этом режиме я могу помогать с изменением текста в вашем Markdown-редакторе. Есть два варианта работы:<br><br>1. <strong>По умолчанию</strong>: задание применяется ко всему тексту в редакторе<br>2. <strong>Для части текста</strong>: выделите нужный фрагмент, затем введите задание - изменения будут применены только к выделенному тексту<br><br><strong>Примеры заданий (щелкните для быстрого применения):</strong><br>• <button onclick="window.sendExampleMessage('Проверь и исправь синтаксис Markdown')" class="ai-example-btn">Проверь и исправь синтаксис Markdown</button><br>• <button onclick="window.sendExampleMessage('Переведи текст на английский')" class="ai-example-btn">Переведи текст на английский</button><br>• <button onclick="window.sendExampleMessage('Исправь ошибки и улучши стиль')" class="ai-example-btn">Исправь ошибки и улучши стиль</button><br>• <button onclick="window.sendExampleMessage('Проверь пунктуацию и грамматику')" class="ai-example-btn">Проверь пунктуацию и грамматику</button><br>• <button onclick="window.sendExampleMessage('Сократи текст до 200 слов')" class="ai-example-btn">Сократи текст до 200 слов</button><br>• <button onclick="window.sendExampleMessage('Перепиши в более формальном стиле')" class="ai-example-btn">Перепиши в более формальном стиле</button><br><br>Просто введите ваше задание и я применю изменения автоматически.</p></div></div>`;
        messagesContainer.appendChild(welcomeMessage);
      }
    });
  }

}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+A to toggle AI chat (works in both English and Russian layouts)
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.code === 'KeyA')) {
      e.preventDefault();
      togglePanel();
    }

    // Escape to close panel
    if (e.key === 'Escape' && isPanelOpen) {
      closePanel();
    }
  });
}

// Toggle panel visibility
function togglePanel() {
  if (isPanelOpen) {
    closePanel();
  } else {
    openPanel();
  }
}

// Open panel
function openPanel() {
  if (!panelElement) return;

  isPanelOpen = true;
  panelElement.classList.add('open');

  // Update editor pane layout
  updateEditorPaneFullwidth();

  // Focus input
  setTimeout(() => {
    if (inputElement) {
      inputElement.focus();
    }
  }, 300);

  updateStatus();
}

// Close panel
function closePanel() {
  if (!panelElement) return;

  isPanelOpen = false;
  panelElement.classList.remove('open');

  // Update editor pane layout
  updateEditorPaneFullwidth();
}

// Handle sending message
async function handleSendMessage() {
  if (!inputElement || isLoading) return;

  const message = inputElement.value.trim();
  if (!message) return;

  // Clear input
  inputElement.value = '';
  adjustInputHeight();

  // In editing mode, clear previous messages (keep welcome)
  if (currentMode === 'editing' && messagesContainer) {
    const welcomeMessage = messagesContainer.querySelector('.ai-chat-welcome');
    messagesContainer.innerHTML = '';
    if (welcomeMessage) {
      messagesContainer.appendChild(welcomeMessage);
    }
  }

  // Add user message
  addMessage('user', message);
  updateChatHistoryReference(); // Update after adding message

  // Update conversation title if needed
  updateConversationTitle();

  // Process message based on mode
  await processMessage(message);

  // Save conversations
  saveConversations();

  // Refocus input for next message
  if (inputElement) {
    inputElement.focus();
  }
}

// Process message based on current mode
async function processMessage(message) {
  setLoading(true);

  try {
    switch (currentMode) {
      case 'chat':
        await handleChatMode(message);
        break;
      case 'editing':
        await handleEditingMode(message);
        break;
      default:
        await handleChatMode(message);
    }
  } catch (error) {
    console.error('[AI Chat] Error processing message:', error);
    addMessage('assistant', `Ошибка: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

// Handle chat mode
async function handleChatMode(message) {
  await callAIAPI(message, 'general');
}

// Handle editing mode
async function handleEditingMode(message) {
  const editor = getEditorView();
  if (!editor) {
    addMessage('assistant', 'Редактор не найден');
    return;
  }

  const selection = editor.state.selection.main;
  const hasSelection = selection.from !== selection.to;

  let textToEdit, prompt, modeSelection;

  if (hasSelection) {
    // Edit selected text
    textToEdit = editor.state.doc.sliceString(selection.from, selection.to);
    prompt = `Task: [${message}]\n\n${EDITING_PROMPT_SUFFIX}\n\nText to edit:[\n${textToEdit}]`;
    modeSelection = selection;
  } else {
    // Edit entire document content
    textToEdit = editor.state.doc.toString();
    prompt = `Task: ${message}\n\n${EDITING_PROMPT_SUFFIX}\n\nText to edit:\n${textToEdit}`;
    modeSelection = { from: 0, to: textToEdit.length };
  }

  // Сохраняем сообщение для возможного retry
  window._aiChatLastMessage = message;

  await callAIAPI(prompt, 'edit', modeSelection);
}



// Call AI API with streaming
async function callAIAPI(message, mode, selection = null) {
  const settings = getAISettings();

  if (!settings || !settings.provider) {
    addMessage('assistant', 'AI не настроен. Проверьте настройки.');
    return;
  }

  // Показываем спинер для AI операций
  showSpinner();

  // Add loading message
  const loadingMessageId = addMessage('assistant', '', true);

  try {
    let accumulatedText = '';
    let messagesForAI;

    if (mode === 'edit') {
      // For editing mode, send only the current task + content
      messagesForAI = [{
        role: 'user',
        content: message
      }];
    } else {
      // For chat mode, send full conversation context
      messagesForAI = chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    }

    await chatWithAIStreaming(
      messagesForAI,
      (chunk) => {
        accumulatedText = chunk;
        updateMessage(loadingMessageId, accumulatedText, true);
      },
      (finalText) => {
        // Скрываем спинер при завершении
        hideSpinner();

        updateMessage(loadingMessageId, finalText, false);

        // For editing mode, apply changes immediately
        if (mode === 'edit' && selection) {
          applyChanges(finalText, selection);
          updateMessage(loadingMessageId, 'Готово. Что ещё?', false);
        }
      },
      (error) => {
        console.error('[AI Chat] API Error:', error);
        // Скрываем спинер при ошибке
        hideSpinner();
        updateMessage(loadingMessageId, `Ошибка: ${error.message}`, false);
      }
    );
  } catch (error) {
    console.error('[AI Chat] Call Error:', error);
    // Скрываем спинер при ошибке
    hideSpinner();
    updateMessage(loadingMessageId, `Ошибка: ${error.message}`, false);
  }
}

// Add message to chat
function addMessage(role, content, isLoading = false) {
  if (!messagesContainer) return null;

  // Remove welcome message if user sends first message (only in chat mode)
  if (role === 'user' && currentMode === 'chat') {
    const welcomeMessage = messagesContainer.querySelector('.ai-chat-welcome');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
  }

  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-message ai-message-${role}${isLoading ? ' ai-message-loading' : ''}`;
  messageDiv.setAttribute('data-message-id', messageId);

  messageDiv.innerHTML = `
    <div class="ai-message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="ai-message-content">
      ${formatMessageContent(content)}
    </div>
  `;

  messagesContainer.appendChild(messageDiv);

  // Scroll to bottom
  scrollToBottom();

  // Add to current conversation only for chat mode
  if (currentMode === 'chat') {
    const currentConv = getCurrentConversation();
    if (currentConv) {
      currentConv.messages.push({
        id: messageId,
        role,
        content,
        timestamp: Date.now(),
        mode: currentMode
      });
    }
  }

  return messageId;
}

// Update existing message
function updateMessage(messageId, content, isLoading = false) {
  const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageElement) return;

  const contentElement = messageElement.querySelector('.ai-message-content');
  if (contentElement) {
    contentElement.innerHTML = formatMessageContent(content);
  }

  if (isLoading) {
    messageElement.classList.add('ai-message-loading');
  } else {
    messageElement.classList.remove('ai-message-loading');
  }

  // Update content in conversation messages array only for chat mode
  if (currentMode === 'chat') {
    const currentConv = getCurrentConversation();
    if (currentConv) {
      const msg = currentConv.messages.find(m => m.id === messageId);
      if (msg) {
        msg.content = content;
      }
    }
  }
}

// Add apply button for edit mode
function addApplyButton(messageId, content, selection) {
  const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageElement) return;

  const contentElement = messageElement.querySelector('.ai-message-content');

  const applyButton = document.createElement('button');
  applyButton.className = 'ai-apply-btn';
  applyButton.textContent = 'Применить изменения';
  applyButton.onclick = () => applyChanges(content, selection);

  contentElement.appendChild(applyButton);
}

// Apply changes to editor
function applyChanges(content, selection) {
  const editor = getEditorView();
  if (!editor) return;

  // Показываем спинер
  showSpinner();

  // Сохраняем оригинальный текст (весь документ)
  saveOriginalText(editor, selection);

  // Сохраняем оригинальный текст выделенного фрагмента ДО изменений
  const originalSelectedText = editor.state.doc.sliceString(selection.from, selection.to);
  // Сохраняем полный оригинальный текст документа ДО изменений
  const fullOriginalText = editor.state.doc.toString();
  window._aiChatFullOriginalText = fullOriginalText;

  // Replace selected text
  editor.dispatch({
    changes: { from: selection.from, to: selection.to, insert: content },
    selection: { anchor: selection.from + content.length }
  });

  // Скрываем спинер
  hideSpinner();

  // Сохраняем контекст для возможного retry
  const context = {
    editor,
    selection,
    originalText: originalSelectedText, // текст выделенного фрагмента до изменений
    fullOriginalText,
    lastMessage: window._aiChatLastMessage || (inputElement ? inputElement.value.trim() : '')
  };
  window._aiChatLastContext = context;

  // Показываем модальное окно обратной связи
  showFeedbackModal(
    () => {
      // Принять изменения - ничего не делаем, изменения уже применены
      console.log('[AI Chat] Изменения приняты');
      // Очищаем контекст
      window._aiChatLastContext = null;
    },
    () => {
      // Попробовать ещё раз - повторяем последний запрос
      console.log('[AI Chat] Повторная генерация');
      if (window._aiChatLastContext) {
        const { editor, selection, originalText, lastMessage } = window._aiChatLastContext;
        // Повторно вызываем AI с тем же запросом
        handleEditingRetry(editor, selection, originalText, lastMessage);
      }
    },
    () => {
      // Отменить изменения - текст уже восстановлен в handleCancel
      console.log('[AI Chat] Изменения отменены');
      // Очищаем контекст
      window._aiChatLastContext = null;
    }
  );

  // No additional message - AI response will show "Готово. Что ещё?"
}

// Handle editing retry
function handleEditingRetry(editor, selection, originalText, lastMessage) {
  if (!editor || !lastMessage) return;

  // Показываем спинер
  showSpinner();

  // Восстанавливаем полный оригинальный текст документа перед повторной генерацией
  const fullOriginalText = window._aiChatFullOriginalText;
  if (fullOriginalText) {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: fullOriginalText },
      selection: { anchor: 0 }
    });
    // Восстанавливаем выделение
    editor.dispatch({
      selection: { anchor: selection.from, head: selection.to }
    });
  } else {
    // Fallback: восстанавливаем только выделенный фрагмент
    editor.dispatch({
      changes: { from: selection.from, to: selection.to, insert: originalText },
      selection: { anchor: selection.from + originalText.length }
    });
  }

  // Скрываем спинер
  hideSpinner();

  // Повторно вызываем AI с тем же запросом
  const prompt = `Task: [${lastMessage}]\n\n${EDITING_PROMPT_SUFFIX}\n\nText to edit:[\n${originalText}]`;
  callAIAPI(prompt, 'edit', selection);
}

// Format message content (basic markdown support)
function formatMessageContent(content) {
  if (!content) return '';

  // Escape HTML
  content = content
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');

  // Basic markdown formatting
  content = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  return content;
}

// Adjust input height
function adjustInputHeight() {
  if (!inputElement) return;

  inputElement.style.height = 'auto';
  inputElement.style.height = Math.min(inputElement.scrollHeight, 120) + 'px';
}

// Scroll to bottom
function scrollToBottom() {
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Set loading state
function setLoading(loading) {
  isLoading = loading;

  if (sendButton) {
    sendButton.disabled = loading;
  }

  if (inputElement) {
    inputElement.disabled = loading;
  }

  updateStatus();
}

// Update mode button states
function updateModeButtons() {
  if (modeChatBtn) {
    modeChatBtn.classList.toggle('active', currentMode === 'chat');
  }
  if (modeEditingBtn) {
    modeEditingBtn.classList.toggle('active', currentMode === 'editing');
  }
}

// Update status (no-op since status element removed)
function updateStatus() {
  // Status display removed, keeping function for compatibility
}

// Save chat history to localStorage
function saveChatHistory() {
  try {
    // Keep only last 50 messages
    const recentHistory = chatHistory.slice(-50);
    localStorage.setItem('ai-chat-history', JSON.stringify(recentHistory));
  } catch (error) {
    console.warn('[AI Chat] Failed to save history:', error);
  }
}

// Load chat history from localStorage
function loadChatHistory() {
  try {
    const saved = localStorage.getItem('ai-chat-history');
    if (saved) {
      chatHistory = JSON.parse(saved);

      // Re-render messages
      renderMessages();
    }
  } catch (error) {
    console.warn('[AI Chat] Failed to load history:', error);
    chatHistory = [];
  }
}

// Render messages from history
function renderMessages() {
  if (!messagesContainer) return;

  // Clear existing messages
  messagesContainer.innerHTML = '';

  // Add welcome message if no messages in current mode
  if (chatHistory.length === 0) {
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'ai-chat-welcome';
    if (currentMode === 'chat') {
      welcomeMessage.innerHTML = `<div class="ai-message ai-message-assistant"><div class="ai-message-avatar">🤖</div><div class="ai-message-content"><p>Привет! Я ваш AI-ассистент. Задавайте вопросы, просите помощи с текстом или кодом. Просто введите сообщение!</p></div></div>`;
    } else if (currentMode === 'editing') {
      welcomeMessage.innerHTML = `<div class="ai-message ai-message-assistant"><div class="ai-message-avatar">🤖</div><div class="ai-message-content"><p><strong>Режим редактирования</strong><br><br>В этом режиме я могу помогать с изменением текста в вашем Markdown-редакторе. Есть два варианта работы:<br><br>1. <strong>По умолчанию</strong>: задание применяется ко всему тексту в редакторе<br>2. <strong>Для части текста</strong>: выделите нужный фрагмент, затем введите задание - изменения будут применены только к выделенному тексту<br><br><strong>Примеры заданий (щелкните для быстрого применения):</strong><br>• <button onclick="window.sendExampleMessage('Проверь и исправь синтаксис Markdown')" class="ai-example-btn">Проверь и исправь синтаксис Markdown</button><br>• <button onclick="window.sendExampleMessage('Переведи текст на английский')" class="ai-example-btn">Переведи текст на английский</button><br>• <button onclick="window.sendExampleMessage('Исправь ошибки и улучши стиль')" class="ai-example-btn">Исправь ошибки и улучши стиль</button><br>• <button onclick="window.sendExampleMessage('Проверь пунктуацию и грамматику')" class="ai-example-btn">Проверь пунктуацию и грамматику</button><br>• <button onclick="window.sendExampleMessage('Сократи текст до 200 слов')" class="ai-example-btn">Сократи текст до 200 слов</button><br>• <button onclick="window.sendExampleMessage('Перепиши в более формальном стиле')" class="ai-example-btn">Перепиши в более формальном стиле</button><br><br>Просто введите ваше задание и я применю изменения автоматически.</p></div></div>`;
    }
    messagesContainer.appendChild(welcomeMessage);
  }

  // Add messages from history
  chatHistory.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ai-message-${msg.role}`;
    messageDiv.setAttribute('data-message-id', msg.id);

    messageDiv.innerHTML = `
      <div class="ai-message-avatar">${msg.role === 'user' ? '👤' : '🤖'}</div>
      <div class="ai-message-content">
        ${formatMessageContent(msg.content)}
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
  });

  scrollToBottom();
}

// Clear chat history
export function clearChatHistory() {
  chatHistory = [];
  saveChatHistory();
  renderMessages();
}

// Get chat statistics
export function getChatStats() {
  return {
    totalMessages: chatHistory.length,
    userMessages: chatHistory.filter(m => m.role === 'user').length,
    assistantMessages: chatHistory.filter(m => m.role === 'assistant').length
  };
}

// Get panel open state
export function getPanelOpenState() {
  return isPanelOpen;
}

// Context Menu functionality
let contextMenuElement = null;
let contextMenuTarget = null;

// Initialize context menu
function initializeContextMenu() {
  // Create context menu element
  contextMenuElement = document.createElement('div');
  contextMenuElement.className = 'ai-context-menu';
  contextMenuElement.style.display = 'none';
  document.body.appendChild(contextMenuElement);

  // Hide menu on click outside
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.ai-chat-panel')) {
      hideContextMenu();
    }
  });
}

// Show context menu
function showContextMenu(x, y, target) {
  if (!contextMenuElement) return;

  contextMenuTarget = target;

  // Clear previous menu items
  contextMenuElement.innerHTML = '';

  // Determine if target is input field or message content
  const isInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
  const hasSelection = isInput ?
    (target.selectionStart !== target.selectionEnd) :
    (window.getSelection().toString().length > 0);

  // Copy option (always available if there's selection or content)
  const canCopy = hasSelection || (!isInput && target.textContent.trim().length > 0);
  if (canCopy) {
    addContextMenuItem('Копировать', () => handleCopy(target, isInput));
  }

  // Cut option (only for input fields with selection)
  if (isInput && hasSelection) {
    addContextMenuItem('Вырезать', () => handleCut(target));
  }

  // Paste option (only for input fields)
  if (isInput) {
    addContextMenuItem('Вставить', () => handlePaste(target));
  }

  // Position menu
  contextMenuElement.style.left = x + 'px';
  contextMenuElement.style.top = y + 'px';
  contextMenuElement.style.display = 'block';

  // Adjust position if menu goes off screen
  const rect = contextMenuElement.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenuElement.style.left = (x - rect.width) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    contextMenuElement.style.top = (y - rect.height) + 'px';
  }
}

// Hide context menu
function hideContextMenu() {
  if (contextMenuElement) {
    contextMenuElement.style.display = 'none';
    contextMenuTarget = null;
  }
}

// Add menu item
function addContextMenuItem(text, callback) {
  const item = document.createElement('button');
  item.className = 'ai-context-menu-item';
  item.textContent = text;
  item.onclick = () => {
    callback();
    hideContextMenu();
  };
  contextMenuElement.appendChild(item);
}

// Handle copy operation
function handleCopy(target, isInput) {
  if (isInput) {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const selectedText = target.value.substring(start, end);
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
    }
  } else {
    const selection = window.getSelection();
    if (selection.toString()) {
      navigator.clipboard.writeText(selection.toString());
    } else {
      // Copy all content if no selection
      navigator.clipboard.writeText(target.textContent);
    }
  }
}

// Handle cut operation
function handleCut(target) {
  const start = target.selectionStart;
  const end = target.selectionEnd;
  const selectedText = target.value.substring(start, end);
  if (selectedText) {
    navigator.clipboard.writeText(selectedText);
    // Remove selected text
    target.value = target.value.substring(0, start) + target.value.substring(end);
    target.selectionStart = target.selectionEnd = start;
    // Trigger input event for height adjustment
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Handle paste operation
async function handlePaste(target) {
  try {
    const clipboardText = await navigator.clipboard.readText();
    if (clipboardText) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.value = target.value.substring(0, start) + clipboardText + target.value.substring(end);
      target.selectionStart = target.selectionEnd = start + clipboardText.length;
      // Trigger input event for height adjustment
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch (error) {
    console.warn('[AI Chat] Failed to paste:', error);
  }
}

// Setup context menu handlers
function setupContextMenuHandlers() {
  // Handler for input field
  if (inputElement) {
    inputElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, inputElement);
    });
  }

  // Handler for message contents (delegate to messages container)
  if (messagesContainer) {
    messagesContainer.addEventListener('contextmenu', (e) => {
      const messageContent = e.target.closest('.ai-message-content');
      if (messageContent) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, messageContent);
      }
    });
  }
}
