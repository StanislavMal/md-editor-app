// src/renderer/modules/ai.js
import { markdown } from '@codemirror/lang-markdown';
import axios from 'axios';
import Groq from 'groq-sdk';

console.log('[Module Loaded] ai.js');

// Конфигурация API
const API_CONFIG = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', maxTokens: 8000 },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', maxTokens: 64000 }
    ],
    defaultModel: 'deepseek-chat'
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', maxTokens: 80000 }
    ],
    defaultModel: 'gemini-3-flash-preview'
  },
  groq: {
    models: [
      { id: 'groq/compound', name: 'Groq Compound', maxTokens: 8192 },
      { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B Versatile', maxTokens: 32768 },
      { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'LLaMA 4 Maverick 17B', maxTokens: 8192 },
      { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', maxTokens: 8192 },
      { id: 'groq/compound-mini', name: 'Groq Compound Mini', maxTokens: 8192 },
      { id: 'llama-3.1-8b-instant', name: 'LLaMA 3.1 8B Instant', maxTokens: 8192 }
    ],
    defaultModel: 'groq/compound'
  }
};

// Получение настроек из localStorage
function getAISettings() {
  const provider = localStorage.getItem('ai-provider') || 'deepseek';
  const model = localStorage.getItem(`ai-model-${provider}`) || API_CONFIG[provider].defaultModel;

  return {
    provider,
    model,
    deepseekKey: localStorage.getItem('deepseek-api-key') || '',
    geminiKey: localStorage.getItem('gemini-api-key') || '',
    groqKey: localStorage.getItem('groq-api-key') || ''
  };
}

// Сохранение настроек
export function saveAISettings(settings) {
  if (settings.provider) localStorage.setItem('ai-provider', settings.provider);
  if (settings.model) localStorage.setItem(`ai-model-${settings.provider}`, settings.model);
  if (settings.deepseekKey !== undefined) localStorage.setItem('deepseek-api-key', settings.deepseekKey);
  if (settings.geminiKey !== undefined) localStorage.setItem('gemini-api-key', settings.geminiKey);
  if (settings.groqKey !== undefined) localStorage.setItem('groq-api-key', settings.groqKey);
}

// Получение настроек
export function getAISettingsPublic() {
  return getAISettings();
}

// Получение доступных моделей для провайдера
export function getAvailableModels(provider) {
  return API_CONFIG[provider]?.models || [];
}

// Получение конфигурации выбранной модели
function getModelConfig(provider, modelId) {
  const models = API_CONFIG[provider]?.models || [];
  return models.find(m => m.id === modelId) || models[0];
}

// Единый промпт для форматирования текста
const FORMATTING_PROMPT = `Роль: ИИ Оформитель в Markdown приложении. Задача:Оформи следующий текст в чистый Markdown формат. Учитывай контекст, стремись сделать профессионально и красиво, используя весь инструментарий md. Для математических формул используй LaTeX синтаксис: инлайновые формулы в $...$, блочные в $$...$$.Выведи ТОЛЬКО отформатированный Markdown текст, без пояснений и без оберток. Ничего не сокращай и не удаляй из исходного текста, а также ничего не добавляй, твоя задача только оформление. Текст для оформления:\n\n`;

// Функция для создания сообщения пользователя
function createUserMessage(content) {
  return { role: 'user', content };
}

// Функция для создания промпта форматирования
function createFormattingPrompt(text) {
  return createUserMessage(FORMATTING_PROMPT + text);
}

// Очистка текста от обертки ```markdown ```
function cleanMarkdownWrapper(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```markdown') && trimmed.endsWith('```')) {
    // Удаляем начальный ```markdown и конечный ```
    let cleaned = trimmed.slice('```markdown'.length);
    if (cleaned.startsWith('\n')) cleaned = cleaned.slice(1);
    if (cleaned.endsWith('\n```')) cleaned = cleaned.slice(0, -4);
    else if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    return cleaned.trim();
  }
  return text;
}

// Очистка текста от символов замены и других артефактов кодировки
function cleanTextArtifacts(text) {
  if (!text) return text;
  // Удаляем символы замены Unicode
  return text.replace(/\uFFFD/g, '').trim();
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
async function callDeepSeekAPI(text, apiKey, modelConfig) {
  const response = await axios.post(`${API_CONFIG.deepseek.baseURL}/chat/completions`, {
    model: modelConfig.id,
    messages: [createFormattingPrompt(text)],
    max_tokens: modelConfig.maxTokens,
    temperature: 0.3
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return cleanMarkdownWrapper(response.data.choices[0].message.content);
}

// Вызов Gemini API
async function callGeminiAPI(text, apiKey, modelConfig) {
  const response = await axios.post(`${API_CONFIG.gemini.baseURL}/chat/completions`, {
    model: modelConfig.id,
    messages: [createFormattingPrompt(text)],
    max_tokens: modelConfig.maxTokens,
    temperature: 0.1
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return cleanMarkdownWrapper(response.data.choices[0].message.content);
}

// Вызов Groq API
async function callGroqAPI(text, apiKey, modelConfig) {
  const groq = new Groq({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  const completion = await groq.chat.completions.create({
    model: modelConfig.id,
    messages: [createFormattingPrompt(text)],
    temperature: 1,
    max_tokens: modelConfig.maxTokens,
    top_p: 1,
    stream: false,
    stop: null
  });

  return cleanMarkdownWrapper(completion.choices[0].message.content);
}

// Универсальная функция для streaming API
async function streamAPI(provider, messages, apiKey, onChunk, onComplete, onError, modelConfig) {
  try {
    let response;
    const isGroq = provider === 'groq';

    if (isGroq) {
      // Groq использует свою библиотеку
      const groq = new Groq({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      const stream = await groq.chat.completions.create({
        model: modelConfig.id,
        messages: messages,
        temperature: provider === 'deepseek' ? 0.3 : provider === 'gemini' ? 0.3 : 0.7,
        max_tokens: modelConfig.maxTokens,
        top_p: 1,
        stream: true,
        stop: null
      });

      let accumulatedText = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        accumulatedText += content;
        onChunk(accumulatedText);
      }
      onComplete(cleanTextArtifacts(provider === 'deepseek' || provider === 'gemini' ? cleanMarkdownWrapper(accumulatedText) : accumulatedText));
      return;
    }

    // Для DeepSeek и Gemini используем fetch
    const config = API_CONFIG[provider];
    response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelConfig.id,
        messages: messages,
        max_tokens: modelConfig.maxTokens,
        temperature: provider === 'deepseek' ? 0.3 : 0.7,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let buffer = []; // Буфер для накопления всех байтов

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Финализируем декодирование всех накопленных байтов
        const allBytes = new Uint8Array(buffer.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of buffer) {
          allBytes.set(chunk, offset);
          offset += chunk.length;
        }
        const finalText = decoder.decode(allBytes);

        // Парсим финальный текст
        const lines = finalText.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') {
        onComplete(cleanTextArtifacts(cleanMarkdownWrapper(accumulatedText)));
              return;
            }
            try {
              const data = JSON.parse(jsonStr);
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedText += content;
              }
            } catch (e) {
              // Игнорируем невалидный JSON
            }
          }
        }
        onComplete(cleanMarkdownWrapper(accumulatedText));
        break;
      }

      // Накопляем байты
      buffer.push(value);

      // Декодируем для промежуточных обновлений с stream: true
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);

          if (jsonStr === '[DONE]') {
            onComplete(cleanMarkdownWrapper(accumulatedText));
            return;
          }

          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              accumulatedText += content;
              onChunk(accumulatedText);
            }
          } catch (e) {
            // Игнорируем невалидный JSON
          }
        }
      }
    }
  } catch (error) {
    onError(new Error(`Ошибка стрима ${provider}: ${error.message}`));
  }
}

// Streaming DeepSeek API
async function streamDeepSeekAPI(text, apiKey, onChunk, onComplete, onError, modelConfig) {
  const messages = [createFormattingPrompt(text)];
  await streamAPI('deepseek', messages, apiKey, onChunk, onComplete, onError, modelConfig);
}

// Streaming Gemini API
async function streamGeminiAPI(text, apiKey, onChunk, onComplete, onError, modelConfig) {
  const messages = [createFormattingPrompt(text)];
  await streamAPI('gemini', messages, apiKey, onChunk, onComplete, onError, modelConfig);
}

// Streaming Groq API
async function streamGroqAPI(text, apiKey, onChunk, onComplete, onError, modelConfig) {
  const messages = [createFormattingPrompt(text)];
  await streamAPI('groq', messages, apiKey, onChunk, onComplete, onError, modelConfig);
}

// Основная функция форматирования текста через AI (синхронная)
export async function formatTextWithAI(text) {
  const settings = getAISettings();

  if (!text || text.trim().length === 0) {
    throw new Error('Текст для форматирования пуст');
  }

  // Проверка наличия API ключа
  const apiKey = settings.provider === 'deepseek' ? settings.deepseekKey :
                 settings.provider === 'gemini' ? settings.geminiKey :
                 settings.groqKey;
  if (!apiKey) {
    throw new Error(`API ключ для ${settings.provider} не настроен. Добавьте ключ в настройках.`);
  }

  const modelConfig = getModelConfig(settings.provider, settings.model);

  try {
    const chunks = splitTextIntoChunks(text);
    const results = [];

    for (const chunk of chunks) {
      let formattedChunk;
      if (settings.provider === 'deepseek') {
        formattedChunk = await callDeepSeekAPI(chunk, apiKey, modelConfig);
      } else if (settings.provider === 'gemini') {
        formattedChunk = await callGeminiAPI(chunk, apiKey, modelConfig);
      } else {
        formattedChunk = await callGroqAPI(chunk, apiKey, modelConfig);
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

// Streaming версия для постепенного отображения текста
export async function formatTextWithAIStreaming(text, onChunk, onComplete, onError) {
  const settings = getAISettings();

  if (!text || text.trim().length === 0) {
    onError(new Error('Текст для форматирования пуст'));
    return;
  }

  // Проверка наличия API ключа
  const apiKey = settings.provider === 'deepseek' ? settings.deepseekKey :
                 settings.provider === 'gemini' ? settings.geminiKey :
                 settings.groqKey;
  if (!apiKey) {
    onError(new Error(`API ключ для ${settings.provider} не настроен. Добавьте ключ в настройках.`));
    return;
  }

  const modelConfig = getModelConfig(settings.provider, settings.model);

  try {
    const chunks = splitTextIntoChunks(text);

    if (chunks.length === 1) {
      // Для одного чанка используем streaming
      if (settings.provider === 'deepseek') {
        await streamDeepSeekAPI(chunks[0], apiKey, onChunk, onComplete, onError, modelConfig);
      } else if (settings.provider === 'gemini') {
        await streamGeminiAPI(chunks[0], apiKey, onChunk, onComplete, onError, modelConfig);
      } else {
        await streamGroqAPI(chunks[0], apiKey, onChunk, onComplete, onError, modelConfig);
      }
    } else {
      // Для нескольких чанков обрабатываем последовательно, но без streaming
      const results = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let formattedChunk;
        if (settings.provider === 'deepseek') {
          formattedChunk = await callDeepSeekAPI(chunk, apiKey, modelConfig);
        } else if (settings.provider === 'gemini') {
          formattedChunk = await callGeminiAPI(chunk, apiKey, modelConfig);
        } else {
          formattedChunk = await callGroqAPI(chunk, apiKey, modelConfig);
        }
        results.push(formattedChunk);

        // Отправляем промежуточный результат
        const currentResult = results.join('\n\n');
        onChunk(currentResult);

        // Небольшая пауза между чанками для лучшего UX
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      onComplete(cleanTextArtifacts(results.join('\n\n')));
    }
  } catch (error) {
    console.error('[AI] Ошибка streaming форматирования:', error);
    onError(error);
  }
}

// Вызов DeepSeek API для общего чата
async function callDeepSeekChatAPI(text, apiKey, modelConfig) {
  const response = await axios.post(`${API_CONFIG.deepseek.baseURL}/chat/completions`, {
    model: modelConfig.id,
    messages: [createUserMessage(text)],
    max_tokens: modelConfig.maxTokens,
    temperature: 0.7
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return cleanTextArtifacts(response.data.choices[0].message.content);
}

// Вызов Gemini API для общего чата
async function callGeminiChatAPI(text, apiKey, modelConfig) {
  const response = await axios.post(`${API_CONFIG.gemini.baseURL}/chat/completions`, {
    model: modelConfig.id,
    messages: [createUserMessage(text)],
    max_tokens: modelConfig.maxTokens,
    temperature: 0.7
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return cleanTextArtifacts(response.data.choices[0].message.content);
}

// Вызов Groq API для общего чата
async function callGroqChatAPI(text, apiKey, modelConfig) {
  const groq = new Groq({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  const completion = await groq.chat.completions.create({
    model: modelConfig.id,
    messages: [createUserMessage(text)],
    temperature: 0.7,
    max_tokens: modelConfig.maxTokens,
    top_p: 1,
    stream: false,
    stop: null
  });

  return cleanTextArtifacts(completion.choices[0].message.content);
}

// Streaming DeepSeek для общего чата
async function streamDeepSeekChatAPI(messages, apiKey, onChunk, onComplete, onError, modelConfig) {
  await streamAPI('deepseek', messages, apiKey, onChunk, onComplete, onError, modelConfig);
}

// Streaming Gemini для общего чата
async function streamGeminiChatAPI(messages, apiKey, onChunk, onComplete, onError, modelConfig) {
  await streamAPI('gemini', messages, apiKey, onChunk, onComplete, onError, modelConfig);
}

// Streaming Groq для общего чата
async function streamGroqChatAPI(messages, apiKey, onChunk, onComplete, onError, modelConfig) {
  await streamAPI('groq', messages, apiKey, onChunk, onComplete, onError, modelConfig);
}

// Основная функция для общего чата
export async function chatWithAI(text) {
  const settings = getAISettings();

  if (!text || text.trim().length === 0) {
    throw new Error('Текст для чата пуст');
  }

  // Проверка наличия API ключа
  const apiKey = settings.provider === 'deepseek' ? settings.deepseekKey :
                 settings.provider === 'gemini' ? settings.geminiKey :
                 settings.groqKey;
  if (!apiKey) {
    throw new Error(`API ключ для ${settings.provider} не настроен. Добавьте ключ в настройках.`);
  }

  const modelConfig = getModelConfig(settings.provider, settings.model);

  try {
    if (settings.provider === 'deepseek') {
      return await callDeepSeekChatAPI(text, apiKey, modelConfig);
    } else if (settings.provider === 'gemini') {
      return await callGeminiChatAPI(text, apiKey, modelConfig);
    } else {
      return await callGroqChatAPI(text, apiKey, modelConfig);
    }
  } catch (error) {
    console.error('[AI] Ошибка чата:', error);

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

// Streaming версия для общего чата с контекстом
export async function chatWithAIStreaming(messagesOrText, onChunk, onComplete, onError) {
  const settings = getAISettings();

  // Определяем, передан ли массив сообщений или просто текст
  let messages;
  if (Array.isArray(messagesOrText)) {
    messages = messagesOrText;
  } else {
    // Для обратной совместимости, если передан текст
    if (!messagesOrText || messagesOrText.trim().length === 0) {
      onError(new Error('Текст для чата пуст'));
      return;
    }
    messages = [{ role: 'user', content: messagesOrText }];
  }

  // Проверка наличия API ключа
  const apiKey = settings.provider === 'deepseek' ? settings.deepseekKey :
                 settings.provider === 'gemini' ? settings.geminiKey :
                 settings.groqKey;
  if (!apiKey) {
    onError(new Error(`API ключ для ${settings.provider} не настроен. Добавьте ключ в настройках.`));
    return;
  }

  const modelConfig = getModelConfig(settings.provider, settings.model);

  try {
    if (settings.provider === 'deepseek') {
      await streamDeepSeekChatAPI(messages, apiKey, onChunk, onComplete, onError, modelConfig);
    } else if (settings.provider === 'gemini') {
      await streamGeminiChatAPI(messages, apiKey, onChunk, onComplete, onError, modelConfig);
    } else {
      await streamGroqChatAPI(messages, apiKey, onChunk, onComplete, onError, modelConfig);
    }
  } catch (error) {
    console.error('[AI] Ошибка streaming чата:', error);
    onError(error);
  }
}

// Проверка подключения к API
export async function testAPIConnection(provider) {
  const settings = getAISettings();
  const apiKey = provider === 'deepseek' ? settings.deepseekKey :
                 provider === 'gemini' ? settings.geminiKey :
                 settings.groqKey;

  if (!apiKey) {
    return { success: false, error: 'API ключ не настроен' };
  }

  const modelConfig = getModelConfig(provider, settings.model);

  try {
    if (provider === 'deepseek') {
      await callDeepSeekAPI('Тестовое сообщение', apiKey, modelConfig);
    } else if (provider === 'gemini') {
      await callGeminiAPI('Тестовое сообщение', apiKey, modelConfig);
    } else {
      await callGroqAPI('Тестовое сообщение', apiKey, modelConfig);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
