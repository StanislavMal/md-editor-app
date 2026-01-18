// src/renderer/modules/ai.js
import { markdown } from '@codemirror/lang-markdown';
import axios from 'axios';
import Groq from 'groq-sdk';

console.log('[Module Loaded] ai.js');

// Конфигурация API
const API_CONFIG = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    //model: 'deepseek-reasoner',
    //maxTokens: 64000,
    model: 'deepseek-chat',
    maxTokens: 8000,
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3-flash-preview',
    maxTokens: 80000
  },
  groq: {
    //model: 'llama-3.3-70b-versatile',
    //maxTokens: 32768,
    //model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    //maxTokens: 8192,   
    //model: 'openai/gpt-oss-120b',
    model: 'groq/compound',
    maxTokens: 8192,
    //model: 'groq/compound-mini',
    //maxTokens: 8192,
    //model: 'llama-3.1-8b-instant',
  }
};

// Получение настроек из localStorage
function getAISettings() {
  return {
    provider: localStorage.getItem('ai-provider') || 'deepseek',
    deepseekKey: localStorage.getItem('deepseek-api-key') || '',
    geminiKey: localStorage.getItem('gemini-api-key') || '',
    groqKey: localStorage.getItem('groq-api-key') || ''
  };
}

// Сохранение настроек
export function saveAISettings(settings) {
  if (settings.provider) localStorage.setItem('ai-provider', settings.provider);
  if (settings.deepseekKey !== undefined) localStorage.setItem('deepseek-api-key', settings.deepseekKey);
  if (settings.geminiKey !== undefined) localStorage.setItem('gemini-api-key', settings.geminiKey);
  if (settings.groqKey !== undefined) localStorage.setItem('groq-api-key', settings.groqKey);
}

// Получение настроек
export function getAISettingsPublic() {
  return getAISettings();
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
    content: `Роль: ИИ Редактор в Markdown приложении. Задача:Оформи следующий текст в чистый Markdown формат. Учитывай контекст, стремись сделать профессионально и красиво, используя весь инструментарий md. Для математических формул используй LaTeX синтаксис: инлайновые формулы в $...$ или \\(...\\), блочные в $$...$$.Выведи ТОЛЬКО отформатированный Markdown текст, без пояснений и без оберток. Ничего не сокращай и не удаляй из исходного текста, а также ничего не добавляй, твоя задача только оформление:\n\n${text}`
    }],
    max_tokens: API_CONFIG.deepseek.maxTokens,
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
async function callGeminiAPI(text, apiKey) {
  const response = await axios.post(`${API_CONFIG.gemini.baseURL}/chat/completions`, {
    model: API_CONFIG.gemini.model,
    messages: [{
      role: 'user',
      content: `Роль: ИИ Редактор в Markdown приложении. Задача:Оформи следующий текст в чистый Markdown формат. Для математических формул используй LaTeX синтаксис: инлайновые формулы в $...$, блочные в $$...$$. Ничего не добавляй и не удаляй в исходном тексте, твоя задача сделать только оформление:\n\n${text}`
    }],
    max_tokens: API_CONFIG.gemini.maxTokens,
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
async function callGroqAPI(text, apiKey) {
  const groq = new Groq({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  const completion = await groq.chat.completions.create({
    model: API_CONFIG.groq.model,
    messages: [{
      role: 'user',
      content: `Роль: ИИ Редактор в Markdown приложении. Задача:Оформи следующий текст в чистый Markdown формат. Для математических формул используй LaTeX синтаксис: инлайновые формулы в $...$, блочные в $$...$$. Ничего не добавляй и не удаляй в исходном тексте, твоя задача сделать только оформление:\n\n${text}`
    }],
    temperature: 1,
    max_tokens: API_CONFIG.groq.maxTokens,
    top_p: 1,
    stream: false,
    stop: null
  });

  return cleanMarkdownWrapper(completion.choices[0].message.content);
}

// Streaming DeepSeek API
async function streamDeepSeekAPI(text, apiKey, onChunk, onComplete, onError) {
  try {
    // Используем fetch для streaming, так как axios не всегда корректно работает с потоками
    const response = await fetch(`${API_CONFIG.deepseek.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: API_CONFIG.deepseek.model,
        messages: [{
          role: 'user',
        content: `Роль: ИИ Редактор в Markdown приложении. Задача:Оформи следующий текст в чистый Markdown формат. Для математических формул используй LaTeX синтаксис: инлайновые формулы в $...$, блочные в $$...$$[образец:"$$\Longleftrightarrow\; 4n^{2}+11n+6=4n^{2}+11n+6.$$"]. Ничего не добавляй и не удаляй в исходном тексте, твоя задача сделать только оформление:\n\n${text}`
        }],
        max_tokens: API_CONFIG.deepseek.maxTokens,
        temperature: 0.3,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onComplete(cleanMarkdownWrapper(accumulatedText));
        break;
      }

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
    onError(new Error(`Ошибка стрима DeepSeek: ${error.message}`));
  }
}

// Streaming Gemini API
async function streamGeminiAPI(text, apiKey, onChunk, onComplete, onError) {
  try {
    // Используем fetch для streaming, так как axios не всегда корректно работает с потоками
    const response = await fetch(`${API_CONFIG.gemini.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: API_CONFIG.gemini.model,
        messages: [{
          role: 'user',
          content: `Роль: ИИ Редактор в Markdown приложении. Задача:Преобразуй следующий текст в чистый Markdown формат. Для математических формул используй LaTeX синтаксис: инлайновые формулы в $...$ или \\(...\\), блочные в $$...$$ или \\[...\\]. НЕ оборачивай результат в тройные обратные кавычки или блоки кода. Выведи ТОЛЬКО отформатированный Markdown текст, без пояснений и без оберток.:\n\n${text}`
        }],
        max_tokens: API_CONFIG.gemini.maxTokens,
        temperature: 0.3,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onComplete(cleanMarkdownWrapper(accumulatedText));
        break;
      }

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
    onError(new Error(`Ошибка стрима Gemini: ${error.message}`));
  }
}

// Streaming Groq API
async function streamGroqAPI(text, apiKey, onChunk, onComplete, onError) {
  try {
    const groq = new Groq({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });

    const stream = await groq.chat.completions.create({
      model: API_CONFIG.groq.model,
      messages: [{
        role: 'user',
        content: `Роль: ИИ Редактор в Markdown приложении. Задача:Преобразуй следующий текст в чистый Markdown формат. Учитывай контекст, стремись сделать профессионально и красиво, используя весь инструментарий md. Для математических формул используй LaTeX синтаксис: инлайновые формулы в $...$ или \\(...\\), блочные в $$...$$.Выведи ТОЛЬКО отформатированный Markdown текст, без пояснений и без оберток. Ничего не сокращай и не удаляй из исходного текста, а также ничего не добавляй, твоя задача только оформление:\n\n${text}`
      }],
      temperature: 1,
      max_tokens: API_CONFIG.groq.maxTokens,
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

    onComplete(cleanMarkdownWrapper(accumulatedText));
  } catch (error) {
    onError(new Error(`Ошибка стрима Groq: ${error.message}`));
  }
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

  try {
    const chunks = splitTextIntoChunks(text);
    const results = [];

    for (const chunk of chunks) {
      let formattedChunk;
      if (settings.provider === 'deepseek') {
        formattedChunk = await callDeepSeekAPI(chunk, apiKey);
      } else if (settings.provider === 'gemini') {
        formattedChunk = await callGeminiAPI(chunk, apiKey);
      } else {
        formattedChunk = await callGroqAPI(chunk, apiKey);
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

  try {
    const chunks = splitTextIntoChunks(text);

    if (chunks.length === 1) {
      // Для одного чанка используем streaming
      if (settings.provider === 'deepseek') {
        await streamDeepSeekAPI(chunks[0], apiKey, onChunk, onComplete, onError);
      } else if (settings.provider === 'gemini') {
        await streamGeminiAPI(chunks[0], apiKey, onChunk, onComplete, onError);
      } else {
        await streamGroqAPI(chunks[0], apiKey, onChunk, onComplete, onError);
      }
    } else {
      // Для нескольких чанков обрабатываем последовательно, но без streaming
      const results = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let formattedChunk;
        if (settings.provider === 'deepseek') {
          formattedChunk = await callDeepSeekAPI(chunk, apiKey);
        } else if (settings.provider === 'gemini') {
          formattedChunk = await callGeminiAPI(chunk, apiKey);
        } else {
          formattedChunk = await callGroqAPI(chunk, apiKey);
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
      onComplete(results.join('\n\n'));
    }
  } catch (error) {
    console.error('[AI] Ошибка streaming форматирования:', error);
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

  try {
    if (provider === 'deepseek') {
      await callDeepSeekAPI('Тестовое сообщение', apiKey);
    } else if (provider === 'gemini') {
      await callGeminiAPI('Тестовое сообщение', apiKey);
    } else {
      await callGroqAPI('Тестовое сообщение', apiKey);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
