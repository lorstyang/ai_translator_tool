const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
const historyFilePath = path.join(app.getPath('userData'), 'history.json');
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

// Import OpenAI service helpers
const { translateCustomerMessage, normalChat } = require('./services/openai');

// Utility to read history
function readHistory() {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        translations: parsed.translations || [],
        chats: parsed.chats || []
      };
    }
  } catch (error) {
    console.error('Error reading history file:', error);
  }
  return { translations: [], chats: [] };
}

// Utility to write history
function writeHistory(history) {
  try {
    const structure = {
      translations: history.translations || [],
      chats: history.chats || []
    };
    fs.writeFileSync(historyFilePath, JSON.stringify(structure, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing history file:', error);
  }
}

const DEFAULT_PROMPT = `你是专业客服翻译助手。
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

// Utility to read settings
function readSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        width: parsed.width || 380,
        height: parsed.height || 580,
        x: parsed.x,
        y: parsed.y,
        apiKey: parsed.apiKey || '',
        baseUrl: parsed.baseUrl || 'https://api.openai.com/v1',
        modelName: parsed.modelName || 'gpt-4o-mini',
        translatePrompt: parsed.translatePrompt || DEFAULT_PROMPT
      };
    }
  } catch (error) {
    console.error('Error reading settings file:', error);
  }
  return { 
    width: 380, 
    height: 580,
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
    translatePrompt: DEFAULT_PROMPT
  };
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
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Save window bounds on resize/move finished or window close to optimize drag performance
  const saveBounds = () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    writeSettings({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y
    });
  };

  mainWindow.on('resized', saveBounds);
  mainWindow.on('moved', saveBounds);
  mainWindow.on('close', saveBounds);

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

// IPC: Settings management
ipcMain.handle('get-settings', async () => {
  return readSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
  writeSettings(settings);
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
  try {
    const settings = readSettings();
    const config = {
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      modelName: settings.modelName,
      translatePrompt: settings.translatePrompt
    };
    const result = await translateCustomerMessage(text, config);
    return { success: true, ...result };
  } catch (error) {
    console.error('Translation IPC error:', error);
    let errorMsg = error.message;
    if (error.error && error.error.message) {
      errorMsg = error.error.message;
    }
    if (error.status) {
      errorMsg = `[中转站 API 报错 - HTTP ${error.status}] ${errorMsg}`;
    }
    return { success: false, error: errorMsg };
  }
});

// IPC: Call OpenAI normal chat
ipcMain.handle('normal-chat', async (event, messages) => {
  try {
    const settings = readSettings();
    const config = {
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      modelName: settings.modelName,
    };
    const reply = await normalChat(messages, config);
    return { success: true, reply };
  } catch (error) {
    console.error('Chat IPC error:', error);
    let errorMsg = error.message;
    if (error.error && error.error.message) {
      errorMsg = error.error.message;
    }
    if (error.status) {
      errorMsg = `[中转站 API 报错 - HTTP ${error.status}] ${errorMsg}`;
    }
    return { success: false, error: errorMsg };
  }
});
