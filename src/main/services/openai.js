const { OpenAI } = require('openai');
const HttpsProxyAgent = require('https-proxy-agent');

/**
 * Creates and returns an OpenAI client instance based on config or .env fallbacks
 */
async function getOpenAIClient(config) {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  const baseURL = config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const proxyUrl = config.proxyUrl || process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.https_proxy;

  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('未检测到有效的 OpenAI API 密钥。请在“设置”页面中配置您的 API Key。');
  }

  const clientOptions = {
    apiKey,
    baseURL,
    timeout: 25000, // 25 seconds timeout
  };

  if (proxyUrl && proxyUrl.trim() !== '') {
    clientOptions.httpAgent = new HttpsProxyAgent(proxyUrl.trim());
  }

  return new OpenAI(clientOptions);
}

/**
 * Wraps a promise in a hard timeout to prevent indefinite hangs (especially on Windows DNS/TCP stalls)
 */
async function requestWithTimeout(promise, ms = 20000) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`请求超时 (${ms / 1000}秒)。请检查网络连接或 VPN 代理设置。在 Windows 上，请确保 VPN 开启了「TUN 模式」或「虚拟网卡模式」以接管 Node.js 流量；或者在“设置”中配置国内中转 API 地址。`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Executes a function with simple retry logic for connection/server errors
 */
async function requestWithRetry(fn, retries = 2) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      // Wrap the function call in a hard timeout
      return await requestWithTimeout(fn(), 20000);
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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Translates customer service messages into Taiwan customer style traditional Chinese and natural English.
 */
async function translateCustomerMessage(text, config = {}) {
  const client = await getOpenAIClient(config);
  const model = config.modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  let systemPrompt = config.translatePrompt || DEFAULT_TRANSLATE_PROMPT;

  // Use explicitly configured translation blocks as headers
  const headers = config.translationBlocks || ['台湾繁体', 'English'];


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
    return parseOpenAiResponse(content, headers);
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
          content: ''
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
function parseOpenAiResponse(text, headers = ['台湾繁体', 'English']) {
  const outputs = [];
  let foundAny = false;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const nextH = headers[i + 1];
    const pattern = nextH 
      ? new RegExp(`【${escapeRegExp(h)}】([\\s\\S]*?)(?=【${escapeRegExp(nextH)}】|$)`, 'i')
      : new RegExp(`【${escapeRegExp(h)}】([\\s\\S]*?)$`, 'i');
    
    const match = text.match(pattern);
    const content = match ? match[1].trim() : '';
    if (match) {
      foundAny = true;
    }
    outputs.push({ label: h, text: content });
  }

  if (!foundAny && headers.length > 0) {
    outputs[0].text = text.trim();
  }

  // Fallback / legacy support: find a taiwan-like header and english-like header
  const twOutput = outputs.find(o => o.label.includes('繁体') || o.label.toLowerCase().includes('taiwan') || o.label.toLowerCase().includes('tw'));
  const enOutput = outputs.find(o => o.label.toLowerCase().includes('english') || o.label.toLowerCase().includes('en') || o.label.includes('英文'));

  return {
    raw: text,
    outputs,
    taiwan: twOutput ? twOutput.text : (outputs[0] ? outputs[0].text : ''),
    english: enOutput ? enOutput.text : (outputs[1] ? outputs[1].text : ''),
  };
}

module.exports = {
  translateCustomerMessage,
  normalChat,
};
