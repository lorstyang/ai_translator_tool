const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
const historyFilePath = path.join(app.getPath('userData'), 'history.json');
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

// Utility to read history
function readHistory() {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading history file:', error);
  }
  return [];
}

// Utility to write history
function writeHistory(history) {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing history file:', error);
  }
}

// Utility to read settings
function readSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading settings file:', error);
  }
  return { width: 380, height: 580 };
}

// Utility to write settings
function writeSettings(settings) {
  try {
    const current = readSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(settingsFilePath, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing settings file:', error);
  }
}

function createWindow() {
  const settings = readSettings();

  mainWindow = new BrowserWindow({
    width: settings.width || 380,
    height: settings.height || 580,
    x: settings.x,
    y: settings.y,
    minWidth: 320,
    minHeight: 480,
    maxWidth: 600,
    maxHeight: 900,
    frame: false, // Frameless UI
    alwaysOnTop: true, // Always on top
    transparent: true, // Enable window transparency
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open devtools in development if needed
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Debounced listener to persist window bounds (size & position)
  let saveTimeout;
  const handleBoundsChange = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (!mainWindow) return;
      const bounds = mainWindow.getBounds();
      writeSettings({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      });
    }, 500);
  };

  mainWindow.on('resize', handleBoundsChange);
  mainWindow.on('move', handleBoundsChange);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Window controls
ipcMain.on('window-control', (event, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') {
    mainWindow.minimize();
  } else if (action === 'close') {
    mainWindow.close();
  } else if (action === 'toggle-pin') {
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
    event.reply('pin-status-changed', !isAlwaysOnTop);
  } else if (action === 'get-pin-status') {
    event.returnValue = mainWindow.isAlwaysOnTop();
  }
});

// IPC: Clipboard copy helper
ipcMain.handle('clipboard-copy', async (event, text) => {
  clipboard.writeText(text);
  return true;
});

// IPC: History Store management
ipcMain.handle('get-history', async () => {
  return readHistory();
});

ipcMain.handle('save-history', async (event, history) => {
  writeHistory(history);
  return true;
});

// IPC: Call OpenAI translation
ipcMain.handle('translate-text', async (event, text) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('未检测到有效的 OPENAI_API_KEY。请在 .env 文件中配置您的 API 密钥。');
  }

  try {
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl,
    });

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: `你是专业客服翻译助手。
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
[自然的英文客服口吻翻译]`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    });

    const resultText = response.choices[0].message.content;
    return parseOpenAiResponse(resultText);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error(error.message || '翻译失败，请检查网络连接或 API 密钥配置。');
  }
});

// Helper function to parse output format
function parseOpenAiResponse(text) {
  // Regex to extract 전통 대만 and english parts
  const twMatch = text.match(/【台湾繁体】([\s\S]*?)(?=【English】|$)/i);
  const enMatch = text.match(/【English】([\s\S]*?)$/i);

  let taiwan = twMatch ? twMatch[1].trim() : '';
  let english = enMatch ? enMatch[1].trim() : '';

  // Fallback in case formatting fails
  if (!taiwan && !english) {
    // If we couldn't parse the headings, split by line breaks or return the raw text
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
