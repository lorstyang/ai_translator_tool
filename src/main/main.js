const { app, BrowserWindow, ipcMain, clipboard, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let originalBounds = null;
let isFloatingBall = false;
let wasAlwaysOnTop = false;
const historyFilePath = path.join(app.getPath('userData'), 'history.json');
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
const memoFilePath = path.join(app.getPath('userData'), 'memo.txt');

// Import OpenAI service helpers
const { translateCustomerMessage, normalChat } = require('./services/openai');
const { logInfo, logError, getLogs, clearLogs, getLogFilePath } = require('./services/logger');

// Utility to recursively calculate folder size
function getFolderSize(dirPath) {
  let size = 0;
  try {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          size += stats.size;
        } else if (stats.isDirectory()) {
          size += getFolderSize(filePath);
        }
      }
    }
  } catch (error) {
    console.error('Error calculating folder size:', error);
  }
  return size;
}

// Utility to format bytes into readable string
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Utility to read memo
function readMemo() {
  try {
    if (fs.existsSync(memoFilePath)) {
      const content = fs.readFileSync(memoFilePath, 'utf-8').trim();
      if (content.startsWith('[')) {
        return JSON.parse(content);
      } else if (content) {
        // Migration: convert legacy single-string memo to a list-based item
        return [{
          id: Date.now(),
          text: content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }];
      }
    }
  } catch (error) {
    console.error('Error reading memo file:', error);
  }
  return [];
}

// Utility to write memo
function writeMemo(memos) {
  try {
    const list = Array.isArray(memos) ? memos : [];
    fs.writeFileSync(memoFilePath, JSON.stringify(list, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing memo file:', error);
  }
}

// Utility to read history
function readHistory() {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf-8').trim();
      if (!data) {
        return { translations: [], chats: [] };
      }
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

// Utility to snap window size to exact 380/580 aspect ratio (19:29 ratio)
function getSnappedSize(width) {
  let k = Math.round((width || 380) / 19);
  if (k < 17) k = 17; // minWidth 323, minHeight 493
  if (k > 31) k = 31; // maxWidth 589, maxHeight 899
  return {
    width: k * 19,
    height: k * 29
  };
}

// Utility to read settings
function readSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, 'utf-8').trim();
      if (!data) {
        return { 
          width: 380, 
          height: 580,
          baseUrl: 'https://api.openai.com/v1',
          modelName: 'gpt-4o-mini',
          translatePrompt: DEFAULT_PROMPT,
          proxyUrl: 'http://127.0.0.1:7890',
          memoCategories: []
        };
      }
      const parsed = JSON.parse(data);
      const snapped = getSnappedSize(parsed.width || 380);
      return {
        width: snapped.width,
        height: snapped.height,
        x: parsed.x,
        y: parsed.y,
        apiKey: parsed.apiKey || '',
        baseUrl: parsed.baseUrl || 'https://api.openai.com/v1',
        modelName: parsed.modelName || 'gpt-4o-mini',
        translatePrompt: parsed.translatePrompt || DEFAULT_PROMPT,
        proxyUrl: parsed.proxyUrl !== undefined ? parsed.proxyUrl : 'http://127.0.0.1:7890',
        memoCategories: parsed.memoCategories || []
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
    translatePrompt: DEFAULT_PROMPT,
    proxyUrl: 'http://127.0.0.1:7890',
    memoCategories: []
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
    minWidth: 323,
    minHeight: 493, // Aligned with 380/580 aspect ratio (19 * 17 = 323, 29 * 17 = 493)
    maxWidth: 589,  // Aligned with 380/580 aspect ratio (19 * 31 = 589, 29 * 31 = 899)
    maxHeight: 899,
    frame: false, // Frameless UI
    alwaysOnTop: true, // Always on top
    transparent: false, // Disable transparency
    backgroundColor: '#0f172a', // Set window background color matching the app theme
    hasShadow: true, // Enable native shadow
    show: false, // Hide initially to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Enforce proportional resizing (380x580 aspect ratio)
  mainWindow.setAspectRatio(380 / 580);

  // Show window only when ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    // Force bounds correction if restored size is too small (e.g. from closing in floating ball state)
    const bounds = mainWindow.getBounds();
    if (bounds.width < 323 || bounds.height < 493) {
      const snapped = getSnappedSize(settings.width || 380);
      mainWindow.setSize(snapped.width, snapped.height);
    }
    mainWindow.show();
  });

  // Prevent resizing when in floating ball mode
  mainWindow.on('will-resize', (event, newBounds) => {
    const current = mainWindow.getBounds();
    console.log(`[Main Process] [Event: will-resize] isFloatingBall: ${isFloatingBall}, current: ${current.width}x${current.height} @ (${current.x}, ${current.y}), target: ${newBounds.width}x${newBounds.height} @ (${newBounds.x}, ${newBounds.y})`);
    if (isFloatingBall) {
      console.log('[Main Process] [Event: will-resize] Prevented window resize in floating ball mode.');
      event.preventDefault();
    }
  });

  // mainWindow.on('resize', () => {
  //   const current = mainWindow.getBounds();
  //   console.log(`[Main Process] [Event: resize] isFloatingBall: ${isFloatingBall}, size: ${current.width}x${current.height} @ (${current.x}, ${current.y})`);
  // });

  // mainWindow.on('move', () => {
  //   const current = mainWindow.getBounds();
  //   console.log(`[Main Process] [Event: move] isFloatingBall: ${isFloatingBall}, size: ${current.width}x${current.height} @ (${current.x}, ${current.y})`);
  // });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Save window bounds on resize/move finished or window close to optimize drag performance
  const saveBounds = (triggerEvent) => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    console.log(`[Main Process] saveBounds [Trigger: ${triggerEvent || 'unknown'}]. isFloatingBall: ${isFloatingBall}, bounds: ${bounds.width}x${bounds.height} @ (${bounds.x}, ${bounds.y})`);
    if (isFloatingBall) return;
    writeSettings({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y
    });
  };

  // mainWindow.on('resized', () => {
  //   console.log(`[Main Process] [Event: resized] isFloatingBall: ${isFloatingBall}`);
  //   saveBounds('resized');
  // });
  // mainWindow.on('moved', () => {
  //   console.log(`[Main Process] [Event: moved] isFloatingBall: ${isFloatingBall}`);
  //   saveBounds('moved');
  // });
  // mainWindow.on('close', () => {
  //   console.log(`[Main Process] [Event: close]`);
  //   saveBounds('close');
  // });

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
ipcMain.on('window-control', (event, action, data) => {
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
  } else if (action === 'shrink-to-icon') {
    console.log('[Main Process] [shrink-to-icon] Start. isFloatingBall:', isFloatingBall);
    if (isFloatingBall) return;
    isFloatingBall = true;
    originalBounds = mainWindow.getBounds();
    console.log('[Main Process] [shrink-to-icon] Saved originalBounds:', originalBounds);
    
    // Save current pin status to always keep floating ball on top
    wasAlwaysOnTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(true);
    
    // Lock size limits to exactly 60x60 in floating ball mode
    const ballSize = 60;
    mainWindow.setMinimumSize(ballSize, ballSize);
    mainWindow.setMaximumSize(ballSize, ballSize);
    mainWindow.setAspectRatio(0);
    
    // Disable resizable: Electron docs warn transparent + resizable breaks on macOS
    mainWindow.setResizable(false);
    
    // Position floating ball at top-right of original window
    const targetBounds = {
      x: Math.round(originalBounds.x + originalBounds.width - ballSize),
      y: Math.round(originalBounds.y),
      width: ballSize,
      height: ballSize
    };
    
    console.log('[Main Process] [shrink-to-icon] Setting targetBounds:', targetBounds);
    // Perform animated window resize to floating ball position/size
    mainWindow.setBounds(targetBounds, true);
    console.log('[Main Process] [shrink-to-icon] End. Current Bounds:', mainWindow.getBounds());
  } else if (action === 'restore-from-icon') {
    console.log('[Main Process] [restore-from-icon] Start. isFloatingBall:', isFloatingBall, 'originalBounds:', originalBounds);
    if (!isFloatingBall || !originalBounds) return;
    isFloatingBall = false;
    
    const ballBounds = mainWindow.getBounds();
    console.log('[Main Process] [restore-from-icon] Current ballBounds:', ballBounds);
    let restoreX = ballBounds.x + ballBounds.width - originalBounds.width;
    let restoreY = ballBounds.y;

    // If ball is dragged near left edge of screen, expand to the right
    if (ballBounds.x < 100) {
      restoreX = ballBounds.x;
    }

    // Ensure it doesn't go off screen
    const display = screen.getDisplayMatching(ballBounds);
    const workArea = display.workArea;

    if (restoreX < workArea.x) {
      restoreX = workArea.x;
    } else if (restoreX + originalBounds.width > workArea.x + workArea.width) {
      restoreX = workArea.x + workArea.width - originalBounds.width;
    }

    if (restoreY < workArea.y) {
      restoreY = workArea.y;
    } else if (restoreY + originalBounds.height > workArea.y + workArea.height) {
      restoreY = workArea.y + workArea.height - originalBounds.height;
    }

    // Restore size constraints and aspect ratio
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(323, 493);
    mainWindow.setMaximumSize(589, 899);
    mainWindow.setAspectRatio(380 / 580);
    
    // Restore original pin status
    mainWindow.setAlwaysOnTop(wasAlwaysOnTop);
    
    const restoreBounds = {
      x: Math.round(restoreX),
      y: Math.round(restoreY),
      width: originalBounds.width,
      height: originalBounds.height
    };
    
    console.log('[Main Process] [restore-from-icon] Setting restoreBounds:', restoreBounds);
    // Perform animated window restore to original bounds
    mainWindow.setBounds(restoreBounds, true);
    mainWindow.focus();
    console.log('[Main Process] [restore-from-icon] End. Current Bounds:', mainWindow.getBounds());
  } else if (action === 'move-window') {
    if (!data) return;
    const bounds = mainWindow.getBounds();
    const targetX = Math.round(bounds.x + data.dx);
    const targetY = Math.round(bounds.y + data.dy);
    console.log(`[Main Process] [move-window] dx: ${data.dx}, dy: ${data.dy}, oldPosition: (${bounds.x}, ${bounds.y}), targetPosition: (${targetX}, ${targetY}), oldSize: ${bounds.width}x${bounds.height}`);
    if (isFloatingBall) {
      mainWindow.setBounds({
        x: targetX,
        y: targetY,
        width: 60,
        height: 60
      });
    } else {
      mainWindow.setPosition(targetX, targetY);
    }
    const postBounds = mainWindow.getBounds();
    console.log(`[Main Process] [move-window] Done. postBounds: (${postBounds.x}, ${postBounds.y}) size: ${postBounds.width}x${postBounds.height}`);
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
  const settings = readSettings();
  const config = {
    apiKey: settings.apiKey ? (settings.apiKey.substring(0, 8) + '...' + settings.apiKey.substring(settings.apiKey.length - 4)) : '未配置',
    baseUrl: settings.baseUrl,
    modelName: settings.modelName,
    translatePrompt: settings.translatePrompt,
    proxyUrl: settings.proxyUrl
  };
  
  logInfo('TRANSLATE_REQUEST', {
    text,
    config
  });

  try {
    const fullConfig = {
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      modelName: settings.modelName,
      translatePrompt: settings.translatePrompt,
      proxyUrl: settings.proxyUrl
    };
    const result = await translateCustomerMessage(text, fullConfig);
    logInfo('TRANSLATE_RESPONSE', {
      success: true,
      outputs: result.outputs,
      raw: result.raw
    });
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
    logError('TRANSLATE_ERROR', {
      errorMsg,
      stack: error.stack
    });
    return { success: false, error: errorMsg };
  }
});

// IPC: Call OpenAI normal chat
ipcMain.handle('normal-chat', async (event, messages) => {
  const settings = readSettings();
  const config = {
    apiKey: settings.apiKey ? (settings.apiKey.substring(0, 8) + '...' + settings.apiKey.substring(settings.apiKey.length - 4)) : '未配置',
    baseUrl: settings.baseUrl,
    modelName: settings.modelName,
    proxyUrl: settings.proxyUrl
  };
  
  logInfo('CHAT_REQUEST', {
    messagesCount: messages.length,
    messages,
    config
  });

  try {
    const fullConfig = {
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      modelName: settings.modelName,
      proxyUrl: settings.proxyUrl
    };
    const reply = await normalChat(messages, fullConfig);
    logInfo('CHAT_RESPONSE', {
      success: true,
      reply
    });
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
    logError('CHAT_ERROR', {
      errorMsg,
      stack: error.stack
    });
    return { success: false, error: errorMsg };
  }
});

// IPC: Log Management
ipcMain.handle('get-logs', async () => {
  return getLogs();
});

ipcMain.handle('clear-logs', async () => {
  return clearLogs();
});

ipcMain.handle('open-logs', async () => {
  try {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath)) {
      await shell.openPath(logPath);
      return true;
    }
    fs.writeFileSync(logPath, '', 'utf-8');
    await shell.openPath(logPath);
    return true;
  } catch (error) {
    console.error('Failed to open log file:', error);
    return false;
  }
});

// IPC: Storage, Directory Diagnostics and Memo management
ipcMain.handle('get-db-info', async () => {
  const userDataPath = app.getPath('userData');
  const sizeBytes = getFolderSize(userDataPath);
  return {
    path: userDataPath,
    size: formatBytes(sizeBytes)
  };
});

ipcMain.handle('open-db-folder', async () => {
  const userDataPath = app.getPath('userData');
  await shell.openPath(userDataPath);
  return true;
});

ipcMain.handle('get-memo', async () => {
  return readMemo();
});

ipcMain.handle('save-memo', async (event, text) => {
  writeMemo(text);
  return true;
});
