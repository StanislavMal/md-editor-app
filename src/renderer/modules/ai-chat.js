// src/renderer/modules/ai-chat.js

import { getAISettingsPublic as getAISettings } from './ai.js';
import { getEditorView } from './editor.js';
import { chatWithAIStreaming } from './ai.js';

console.log('[Module Loaded] ai-chat.js');

// Chat state
let chatHistory = [];
let currentMode = 'chat';
let isPanelOpen = false;
let isLoading = false;

// DOM elements
let panelElement = null;
let messagesContainer = null;
let inputElement = null;
let sendButton = null;
let modeSelect = null;
let statusElement = null;
let closeButton = null;

// Initialize AI Chat
export function initializeAIChat() {
  console.log('[AI Chat] Initializing...');

  // Get DOM elements
  panelElement = document.getElementById('ai-chat-panel');
  messagesContainer = document.getElementById('ai-chat-messages');
  inputElement = document.getElementById('ai-chat-input');
  sendButton = document.getElementById('ai-chat-send');
  modeSelect = document.getElementById('ai-chat-mode-select');
  statusElement = document.getElementById('ai-chat-status-text');
  closeButton = document.getElementById('ai-chat-close');

  if (!panelElement || !messagesContainer || !inputElement) {
    console.error('[AI Chat] Required DOM elements not found');
    return;
  }

  // Load chat history from localStorage
  loadChatHistory();

  // Setup event listeners
  setupEventListeners();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

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

  // Mode select
  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      currentMode = e.target.value;
      updateStatus();
    });
  }

  // No more auto-hide on click outside - panel stays open until explicitly closed
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+A to toggle AI chat
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
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
}

// Handle sending message
async function handleSendMessage() {
  if (!inputElement || isLoading) return;

  const message = inputElement.value.trim();
  if (!message) return;

  // Clear input
  inputElement.value = '';
  adjustInputHeight();

  // Add user message
  addMessage('user', message);

  // Process message based on mode
  await processMessage(message);

  // Save history
  saveChatHistory();
}

// Process message based on current mode
async function processMessage(message) {
  setLoading(true);

  try {
    switch (currentMode) {
      case 'chat':
        await handleChatMode(message);
        break;
      case 'edit-selected':
        await handleEditSelectedMode(message);
        break;
      case 'fix-syntax':
        await handleFixSyntaxMode(message);
        break;
      case 'creative':
        await handleCreativeMode(message);
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

// Handle edit selected mode
async function handleEditSelectedMode(message) {
  const editor = getEditorView();
  if (!editor) {
    addMessage('assistant', 'Редактор не найден');
    return;
  }

  const selection = editor.state.selection.main;
  if (selection.from === selection.to) {
    addMessage('assistant', 'Выделите текст в редакторе для редактирования');
    return;
  }

  const selectedText = editor.state.doc.sliceString(selection.from, selection.to);
  const prompt = `Редактируй следующий выделенный текст согласно инструкции: "${message}"\n\nТекст для редактирования:\n${selectedText}`;

  await callAIAPI(prompt, 'edit', selection);
}

// Handle fix syntax mode
async function handleFixSyntaxMode(message) {
  const editor = getEditorView();
  if (!editor) {
    addMessage('assistant', 'Редактор не найден');
    return;
  }

  const fullText = editor.state.doc.toString();
  const prompt = `Исправь ошибки синтаксиса Markdown в следующем тексте. Верни только исправленный текст:\n\n${fullText}`;

  await callAIAPI(prompt, 'fix-syntax');
}

// Handle creative mode
async function handleCreativeMode(message) {
  const prompt = `Творческий режим: ${message}`;
  await callAIAPI(prompt, 'creative');
}

// Call AI API with streaming
async function callAIAPI(message, mode, selection = null) {
  const settings = getAISettings();

  if (!settings || !settings.provider) {
    addMessage('assistant', 'AI не настроен. Проверьте настройки.');
    return;
  }

  // Add loading message
  const loadingMessageId = addMessage('assistant', '', true);

  try {
    let accumulatedText = '';

    await chatWithAIStreaming(
      message,
      (chunk) => {
        accumulatedText = chunk;
        updateMessage(loadingMessageId, accumulatedText, true);
      },
      (finalText) => {
        updateMessage(loadingMessageId, finalText, false);

        // Add apply button for certain modes
        if (mode === 'edit' && selection) {
          addApplyButton(loadingMessageId, finalText, selection);
        }
      },
      (error) => {
        console.error('[AI Chat] API Error:', error);
        updateMessage(loadingMessageId, `Ошибка: ${error.message}`, false);
      }
    );
  } catch (error) {
    console.error('[AI Chat] Call Error:', error);
    updateMessage(loadingMessageId, `Ошибка: ${error.message}`, false);
  }
}

// Add message to chat
function addMessage(role, content, isLoading = false) {
  if (!messagesContainer) return null;

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

  // Add to history
  chatHistory.push({
    id: messageId,
    role,
    content,
    timestamp: Date.now(),
    mode: currentMode
  });

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

  // Replace selected text
  editor.dispatch({
    changes: { from: selection.from, to: selection.to, insert: content },
    selection: { anchor: selection.from + content.length }
  });

  // Show success message
  addMessage('assistant', 'Изменения применены в редакторе');
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

// Update status text
function updateStatus() {
  if (!statusElement) return;

  if (isLoading) {
    statusElement.textContent = 'Думаю...';
  } else {
    const modeNames = {
      'chat': 'Чат',
      'edit-selected': 'Редакция выделенного',
      'fix-syntax': 'Исправление синтаксиса',
      'creative': 'Творческий режим'
    };
    statusElement.textContent = `Режим: ${modeNames[currentMode] || 'Неизвестный'}`;
  }
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

  // Clear existing messages except welcome
  const welcomeMessage = messagesContainer.querySelector('.ai-chat-welcome');
  messagesContainer.innerHTML = '';
  if (welcomeMessage) {
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
