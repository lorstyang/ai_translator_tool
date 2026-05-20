const { OpenAI } = require('openai');

/**
 * Creates and returns an OpenAI client instance based on config or .env fallbacks
 */
async function getOpenAIClient(config) {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  const baseURL = config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('未检测到有效的 OpenAI API 密钥。请在“设置”页面中配置您的 API Key。');
  }

  return new OpenAI({
    apiKey,
    baseURL,
    timeout: 25000, // 25 seconds timeout
  });
}

/**
 * Executes a function with simple retry logic for connection/server errors
 */
async function requestWithRetry(fn, retries = 2) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error.status;
      
      // Do not retry on client errors (400-499) unless it's a timeout (408)
      if (status && status >= 400 && status < 500 && status !== 408) {
        throw error;
      }
      
      if (i < retries) {
        console.warn(`OpenAI 请求失败，正在尝试重试 (${i + 1}/${retries})... 错误原因:`, error.message);
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

const DEFAULT_TRANSLATE_PROMPT = `你是专业客服翻译助手。
请把用户输入内容：
1. 转换成台湾客服常用繁体中文口吻
2. 翻译成自然英文客服口吻

要求：
* 语气礼貌
* 自然
* 不要机器翻译感
* 保留原意
* 符合电商/客服聊天场景

输出格式必须严格为以下，不要有其他解释性文字：
【台湾繁体】
[台湾客服风格的繁体中文翻译]

【English】
[自然的英文客服口吻翻译]`;

/**
 * Translates customer service messages into Taiwan customer style traditional Chinese and natural English.
 */
async function translateCustomerMessage(text, config = {}) {
  const client = await getOpenAIClient(config);
  const model = config.modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt = config.translatePrompt || DEFAULT_TRANSLATE_PROMPT;

  return requestWithRetry(async () => {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    return parseOpenAiResponse(content);
  });
}

/**
 * Conducts a normal AI chat conversation with full memory context
 */
async function normalChat(messages, config = {}) {
  const client = await getOpenAIClient(config);
  const model = config.modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  return requestWithRetry(async () => {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是专业客服助手。请使用专业、礼貌、温和的客服语气解答用户问题。'
        },
        ...messages
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  });
}

/**
 * Parses raw OpenAI text blocks into structured translation components
 */
function parseOpenAiResponse(text) {
  const twMatch = text.match(/【台湾繁体】([\s\S]*?)(?=【English】|$)/i);
  const enMatch = text.match(/【English】([\s\S]*?)$/i);

  let taiwan = twMatch ? twMatch[1].trim() : '';
  let english = enMatch ? enMatch[1].trim() : '';

  // Fallback parsing if formatting differs
  if (!taiwan && !english) {
    const parts = text.split('\n\n');
    taiwan = parts[0] || '';
    english = parts.slice(1).join('\n\n') || '';
  }

  return {
    raw: text,
    taiwan,
    english,
  };
}

module.exports = {
  translateCustomerMessage,
  normalChat,
};
