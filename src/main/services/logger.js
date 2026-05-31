const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const logFilePath = path.join(app.getPath('userData'), 'logs.txt');
const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2MB

function rotateLogFileIfNeeded() {
  try {
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size > MAX_LOG_SIZE) {
        const content = fs.readFileSync(logFilePath, 'utf-8');
        const lines = content.split('\n');
        // Keep the latter 50% lines of the log file
        const keptLines = lines.slice(Math.floor(lines.length / 2));
        fs.writeFileSync(logFilePath, keptLines.join('\n'), 'utf-8');
      }
    }
  } catch (error) {
    console.error('Error rotating log file:', error);
  }
}

function writeLog(level, category, message) {
  try {
    rotateLogFileIfNeeded();
    
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let logMsg = `[${timestamp}] [${level}] [${category}]`;
    if (typeof message === 'object') {
      logMsg += '\n' + JSON.stringify(message, null, 2);
    } else {
      logMsg += ' ' + message;
    }
    logMsg += '\n\n';

    fs.appendFileSync(logFilePath, logMsg, 'utf-8');
  } catch (error) {
    console.error('Error writing log:', error);
  }
}

function getLogs() {
  try {
    if (fs.existsSync(logFilePath)) {
      return fs.readFileSync(logFilePath, 'utf-8');
    }
  } catch (error) {
    console.error('Error reading log file:', error);
  }
  return '';
}

function clearLogs() {
  try {
    fs.writeFileSync(logFilePath, '', 'utf-8');
    return true;
  } catch (error) {
    console.error('Error clearing log file:', error);
    return false;
  }
}

function getLogFilePath() {
  return logFilePath;
}

module.exports = {
  logInfo: (category, message) => writeLog('INFO', category, message),
  logError: (category, message) => writeLog('ERROR', category, message),
  getLogs,
  clearLogs,
  getLogFilePath
};
