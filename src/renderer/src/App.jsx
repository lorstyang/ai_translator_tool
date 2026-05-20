import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Minus, 
  X, 
  Pin, 
  History, 
  Trash2, 
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [taiwanOutput, setTaiwanOutput] = useState('');
  const [englishOutput, setEnglishOutput] = useState('');
  
  const [isPinned, setIsPinned] = useState(true);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Visual states for copy buttons
  const [copiedTw, setCopiedTw] = useState(false);
  const [copiedEn, setCopiedEn] = useState(false);
  
  const inputRef = useRef(null);

  // Initialize and load history/pin status on mount
  useEffect(() => {
    if (window.api) {
      // Get initial pin status from Electron
      setIsPinned(window.api.windowControls.getPinStatus());
      
      // Listen for changes in pin status
      const unsubscribe = window.api.windowControls.onPinStatusChanged((status) => {
        setIsPinned(status);
      });

      // Load history
      window.api.history.get()
        .then((savedHistory) => {
          if (Array.isArray(savedHistory)) {
            setHistory(savedHistory);
          }
        })
        .catch(console.error);

      return () => unsubscribe();
    }
  }, []);

  // Keyboard shortcut Ctrl + Enter or Cmd + Enter
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTranslate();
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError('');

    try {
      if (!window.api) {
        throw new Error('无法连接到 Electron 后端代理接口。');
      }

      const result = await window.api.translation.translate(inputText.trim());
      
      setTaiwanOutput(result.taiwan);
      setEnglishOutput(result.english);

      // Save to history
      const newHistoryItem = {
        id: Date.now(),
        original: inputText.trim(),
        taiwan: result.taiwan,
        english: result.english,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const updatedHistory = [newHistoryItem, ...history].slice(0, 30);
      setHistory(updatedHistory);
      await window.api.history.save(updatedHistory);

    } catch (err) {
      console.error(err);
      setError(err.message || '翻译过程中发生未知错误。');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, type) => {
    if (!text) return;
    try {
      if (window.api) {
        await window.api.clipboard.copyText(text);
        if (type === 'tw') {
          setCopiedTw(true);
          setTimeout(() => setCopiedTw(false), 2000);
        } else {
          setCopiedEn(true);
          setTimeout(() => setCopiedEn(false), 2000);
        }
      }
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const togglePin = () => {
    if (window.api) {
      window.api.windowControls.togglePin();
    }
  };

  const handleMinimize = () => {
    if (window.api) {
      window.api.windowControls.minimize();
    }
  };

  const handleClose = () => {
    if (window.api) {
      window.api.windowControls.close();
    }
  };

  const selectHistoryItem = (item) => {
    setInputText(item.original);
    setTaiwanOutput(item.taiwan);
    setEnglishOutput(item.english);
    setError('');
    // Focus back on textarea
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const clearHistory = async (e) => {
    e.stopPropagation(); // Prevent toggling the drawer
    if (confirm('确认清空所有历史翻译记录吗？')) {
      setHistory([]);
      if (window.api) {
        await window.api.history.save([]);
      }
    }
  };

  return (
    <div className="glass-panel w-screen h-screen rounded-2xl overflow-hidden flex flex-col shadow-2xl text-slate-100 border border-slate-800">
      
      {/* Frameless Top Drag Bar */}
      <header className="drag-area h-12 shrink-0 bg-slate-950/60 flex items-center justify-between px-4 border-b border-slate-800/60">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider bg-gradient-to-r from-indigo-300 to-purple-400 bg-clip-text text-transparent">
            AI 客服翻译助手
          </span>
        </div>
        
        {/* Top bar controls */}
        <div className="no-drag-area flex items-center space-x-1">
          <button 
            onClick={togglePin} 
            title={isPinned ? "取消置顶" : "固定置顶"}
            className={`p-1.5 rounded-lg transition-colors duration-150 ${isPinned ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Pin className={`w-3.5 h-3.5 ${isPinned ? 'rotate-45' : ''}`} />
          </button>
          <button 
            onClick={handleMinimize} 
            title="最小化"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-150"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleClose} 
            title="关闭"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-lg p-3 flex items-start space-x-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="text-xs text-red-200 leading-normal">{error}</span>
          </div>
        )}

        {/* Input Field */}
        <div className="space-y-1.5 shrink-0">
          <label className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            简体中文原文
          </label>
          <div className="relative">
            <textarea
              ref={inputRef}
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入简体中文客服回复，按 Ctrl + Enter 翻译..."
              className="glass-input w-full rounded-lg p-3 text-sm resize-none focus:outline-none placeholder:text-slate-500 text-slate-100 leading-relaxed"
            />
            <div className="absolute bottom-2.5 right-3 text-[10px] text-slate-500 pointer-events-none">
              {inputText.length} 字
            </div>
          </div>
        </div>

        {/* Translate Trigger Button */}
        <button
          onClick={handleTranslate}
          disabled={loading || !inputText.trim()}
          className={`glow-button w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center space-x-2 shrink-0 ${
            loading 
              ? 'bg-indigo-600/50 text-slate-300 cursor-not-allowed'
              : !inputText.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/15 hover:shadow-indigo-500/25 active:scale-[0.98]'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
              <span>正在润色翻译...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>开始智能翻译</span>
            </>
          )}
        </button>

        {/* Output Fields */}
        <div className="flex-1 flex flex-col space-y-3 min-h-0">
          
          {/* Taiwan traditional output */}
          <div className="flex-1 flex flex-col min-h-[90px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                台湾客服风格繁体
              </span>
              {taiwanOutput && (
                <button
                  onClick={() => copyToClipboard(taiwanOutput, 'tw')}
                  className={`text-[10px] flex items-center space-x-1 px-2 py-0.5 rounded transition-all duration-150 ${
                    copiedTw 
                      ? 'text-emerald-400 bg-emerald-500/10' 
                      : 'text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300'
                  }`}
                >
                  {copiedTw ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制台湾版</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="glass-output flex-1 rounded-lg p-3 text-sm leading-relaxed overflow-y-auto select-text selection:bg-indigo-500/30 selection:text-white">
              {taiwanOutput ? (
                <p className="whitespace-pre-wrap">{taiwanOutput}</p>
              ) : (
                <p className="text-slate-600 italic text-xs">等待翻译输出...</p>
              )}
            </div>
          </div>

          {/* English output */}
          <div className="flex-1 flex flex-col min-h-[90px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                英文客服口吻
              </span>
              {englishOutput && (
                <button
                  onClick={() => copyToClipboard(englishOutput, 'en')}
                  className={`text-[10px] flex items-center space-x-1 px-2 py-0.5 rounded transition-all duration-150 ${
                    copiedEn 
                      ? 'text-emerald-400 bg-emerald-500/10' 
                      : 'text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300'
                  }`}
                >
                  {copiedEn ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制英文版</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="glass-output flex-1 rounded-lg p-3 text-sm leading-relaxed overflow-y-auto select-text selection:bg-indigo-500/30 selection:text-white font-sans">
              {englishOutput ? (
                <p className="whitespace-pre-wrap">{englishOutput}</p>
              ) : (
                <p className="text-slate-600 italic text-xs">等待翻译输出...</p>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* History Collapsible Panel */}
      <footer className="shrink-0 bg-slate-950/80 border-t border-slate-800/80 flex flex-col">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-slate-400 hover:text-slate-200 transition-colors duration-150 text-xs"
        >
          <div className="flex items-center space-x-1.5">
            <History className="w-3.5 h-3.5" />
            <span>历史记录 ({history.length})</span>
          </div>
          <div className="flex items-center space-x-3">
            {history.length > 0 && (
              <span 
                onClick={clearHistory}
                className="hover:text-red-400 p-0.5 rounded transition-colors"
                title="清空记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            )}
            {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </div>
        </button>
        
        {/* History drawer list */}
        {showHistory && (
          <div className="max-h-40 overflow-y-auto border-t border-slate-900 px-3 py-2 space-y-1.5 bg-slate-950/40">
            {history.length === 0 ? (
              <p className="text-center text-slate-600 italic text-xs py-4">无历史记录</p>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => selectHistoryItem(item)}
                  className="p-2 rounded bg-slate-900/40 hover:bg-slate-900 border border-slate-800/40 hover:border-slate-800 cursor-pointer transition-all duration-150 flex flex-col space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">{item.timestamp}</span>
                    <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity duration-150">点击应用此记录</span>
                  </div>
                  <p className="text-xs text-slate-300 truncate font-medium">
                    {item.original}
                  </p>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                    <span className="truncate max-w-[48%]">TW: {item.taiwan}</span>
                    <span>•</span>
                    <span className="truncate max-w-[48%]">EN: {item.english}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </footer>

    </div>
  );
}
