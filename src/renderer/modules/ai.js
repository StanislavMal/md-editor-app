// src/renderer/modules/ai.js
import axios from 'axios';

console.log('[Module Loaded] ai.js');

// Конфигурация API
const API_CONFIG = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxTokens: 4000
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-1.5-flash',
    maxTokens: 8000
  }
};

// Получение настроек из localStorage
function getAISettings() {
  return {
    provider: localStorage.getItem('ai-provider') || 'deepseek',
    deepseekKey: localStorage.getItem('deepseek-api-key') || '',
    geminiKey: localStorage.getItem('gemini-api-key') || ''
  };
}

// Сохранение настроек
export function saveAISettings(settings) {
  if (settings.provider) localStorage.setItem('ai-provider', settings.provider);
  if (settings.deepseekKey !== undefined) localStorage.setItem('deepseek-api-key', settings.deepseekKey);
  if (settings.geminiKey !== undefined) localStorage.setItem('gemini-api-key', settings.geminiKey);
}

// Получение настроек
export function getAISettingsPublic() {
  return getAISettings();
}

// Разделение текста на логические части
function splitTextIntoChunks(text, maxLength = 4000) {
  if (text.length <= maxLength) {
    return [text];
  }

  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk && (currentChunk + '\n\n' + paragraph).length > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Вызов DeepSeek API
async function callDeepSeekAPI(text, apiKey) {
  const response = await axios.post(`${API_CONFIG.deepseek.baseURL}/chat/completions`, {
    model: API_CONFIG.deepseek.model,
    messages: [{
      role: 'user',
      content: `Преобразуй следующий текст в корректный Markdown формат. Сделай его структурированным и читаемым:\n\n${text}`
    }],
    max_tokens: API_CONFIG.deepseek.maxTokens,
    temperature: 0.3
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content;
}

// Вызов Gemini API
async function callGeminiAPI(text, apiKey) {
  const response = await axios.post(`${API_CONFIG.gemini.baseURL}/models/${API_CONFIG.gemini.model}:generateContent?key=${apiKey}`, {
    contents: [{
      parts: [{
        text: `Преобразуй следующий текст в корректный Markdown формат. Сделай его структурированным и читаемым:\n\n${text}`
      }]
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: API_CONFIG.gemini.maxTokens
    }
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  return response.data.candidates[0].content.parts[0].text;
}

// Основная функция форматирования текста через AI
export async function formatTextWithAI(text) {
  const settings = getAISettings();

  if (!text || text.trim().length === 0) {
    throw new Error('Текст для форматирования пуст');
  }

  // Проверка наличия API ключа
  const apiKey = settings.provider === 'deepseek' ? settings.deepseekKey : settings.geminiKey;
  if (!apiKey) {
    throw new Error(`API ключ для ${settings.provider} не настроен. Добавьте ключ в настройках.`);
  }

  try {
    const chunks = splitTextIntoChunks(text);
    const results = [];

    for (const chunk of chunks) {
      let formattedChunk;
      if (settings.provider === 'deepseek') {
        formattedChunk = await callDeepSeekAPI(chunk, apiKey);
      } else {
        formattedChunk = await callGeminiAPI(chunk, apiKey);
      }
      results.push(formattedChunk);
    }

    return results.join('\n\n');
  } catch (error) {
    console.error('[AI] Ошибка форматирования:', error);

    if (error.response) {
      if (error.response.status === 401) {
        throw new Error('Неверный API ключ');
      } else if (error.response.status === 429) {
        throw new Error('Превышен лимит запросов к API');
      } else if (error.response.status === 400) {
        throw new Error('Некорректный запрос к API');
      } else {
        throw new Error(`Ошибка API: ${error.response.status} ${error.response.statusText}`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Не удалось подключиться к API серверу');
    } else {
      throw new Error(`Ошибка: ${error.message}`);
    }
  }
}

// Проверка подключения к API
export async function testAPIConnection(provider) {
  const settings = getAISettings();
  const apiKey = provider === 'deepseek' ? settings.deepseekKey : settings.geminiKey;

  if (!apiKey) {
    return { success: false, error: 'API ключ не настроен' };
  }

  try {
    if (provider === 'deepseek') {
      await callDeepSeekAPI('Тестовое сообщение', apiKey);
    } else {
      await callGeminiAPI('Тестовое сообщение', apiKey);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
