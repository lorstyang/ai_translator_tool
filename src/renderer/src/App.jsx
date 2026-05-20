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
  ChevronUp,
  MessageSquare,
  Send,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  ChevronRight
} from 'lucide-react';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('translate'); // 'translate' | 'chat' | 'history' | 'settings'

  // Window pin status
  const [isPinned, setIsPinned] = useState(true);

  // Global settings state
  const [settings, setSettings] = useState({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
    translatePrompt: '',
    proxyUrl: 'http://127.0.0.1:7890'
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Global history state
  const [history, setHistory] = useState({
    translations: [],
    chats: []
  });

  // History Tab specific states
  const [historyType, setHistoryType] = useState('translations'); // 'translations' | 'chats'

  // --- Translation Tab State ---
  const [inputText, setInputText] = useState('');
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const [taiwanOutput, setTaiwanOutput] = useState('');
  const [englishOutput, setEnglishOutput] = useState('');
  const [copiedTw, setCopiedTw] = useState(false);
  const [copiedEn, setCopiedEn] = useState(false);
  const [showTranslateHistory, setShowTranslateHistory] = useState(false);
  const inputRef = useRef(null);

  // --- Normal Chat Tab State ---
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInputText, setChatInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const chatBottomRef = useRef(null);

  // Initialize data on mount
  useEffect(() => {
    if (window.api) {
      // Pin status listener
      setIsPinned(window.api.windowControls.getPinStatus());
      const unsubscribe = window.api.windowControls.onPinStatusChanged((status) => {
        setIsPinned(status);
      });

      // Load Settings
      window.api.settings.get()
        .then((savedSettings) => {
          if (savedSettings) {
            setSettings({
              apiKey: savedSettings.apiKey || '',
              baseUrl: savedSettings.baseUrl || 'https://api.openai.com/v1',
              modelName: savedSettings.modelName || 'gpt-4o-mini',
              translatePrompt: savedSettings.translatePrompt || '',
              proxyUrl: savedSettings.proxyUrl !== undefined ? savedSettings.proxyUrl : 'http://127.0.0.1:7890'
            });
          }
        })
        .catch(console.error);

      // Load History
      window.api.history.get()
        .then((savedHistory) => {
          if (savedHistory) {
            setHistory({
              translations: savedHistory.translations || [],
              chats: savedHistory.chats || []
            });
          }
        })
        .catch(console.error);

      return () => unsubscribe();
    }
  }, []);

  // Auto-scroll chat window
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Window actions
  const handleMinimize = () => window.api?.windowControls.minimize();
  const handleClose = () => window.api?.windowControls.close();
  const togglePin = () => window.api?.windowControls.togglePin();

  // Clipboard copy helper
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
      console.error(err);
    }
  };

  // --- Translation Actions ---
  const handleTranslateKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        handleTranslate();
      }
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setTranslateLoading(true);
    setTranslateError('');

    try {
      if (!window.api) throw new Error('无法连接到主进程。');
      const result = await window.api.translation.translate(inputText.trim());
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setTaiwanOutput(result.taiwan);
      setEnglishOutput(result.english);

      // Save translation item to history
      const newTranslation = {
        id: Date.now(),
        original: inputText.trim(),
        taiwan: result.taiwan,
        english: result.english,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString()
      };

      const updatedTranslations = [newTranslation, ...history.translations].slice(0, 50);
      const newHistory = { ...history, translations: updatedTranslations };
      setHistory(newHistory);
      await window.api.history.save(newHistory);

    } catch (err) {
      console.error(err);
      setTranslateError(err.message || '翻译失败，请检查网络或设置。');
    } finally {
      setTranslateLoading(false);
    }
  };

  const selectTranslateHistoryItem = (item) => {
    setInputText(item.original);
    setTaiwanOutput(item.taiwan);
    setEnglishOutput(item.english);
    setTranslateError('');
    setShowTranslateHistory(false);
  };

  // --- Normal Chat Actions ---
  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChatMessage();
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInputText.trim() || chatLoading) return;
    
    const userMessageContent = chatInputText.trim();
    setChatInputText('');
    setChatLoading(true);
    setChatError('');

    const userMessage = {
      role: 'user',
      content: userMessageContent,
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);

    try {
      if (!window.api) throw new Error('无法连接到主进程。');

      // Map chat messages format for API consumption
      const apiMessages = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const result = await window.api.translation.chat(apiMessages);

      if (!result.success) {
        throw new Error(result.error);
      }

      const assistantMessage = {
        role: 'assistant',
        content: result.reply,
        id: Date.now() + 1,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setChatMessages(finalMessages);

      // Save/Update conversation session in history
      let updatedChats = [...history.chats];
      const sessionId = currentSessionId || Date.now();

      const chatSession = {
        id: sessionId,
        title: userMessageContent.slice(0, 24) + (userMessageContent.length > 24 ? '...' : ''),
        messages: finalMessages,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString()
      };

      if (currentSessionId) {
        const index = updatedChats.findIndex(c => c.id === currentSessionId);
        if (index !== -1) {
          updatedChats[index] = chatSession;
        } else {
          updatedChats = [chatSession, ...updatedChats];
        }
      } else {
        setCurrentSessionId(sessionId);
        updatedChats = [chatSession, ...updatedChats];
      }

      const newHistory = { ...history, chats: updatedChats };
      setHistory(newHistory);
      await window.api.history.save(newHistory);

    } catch (err) {
      console.error(err);
      setChatError(err.message || '对话调用出错，请重试。');
    } finally {
      setChatLoading(false);
    }
  };

  const handleResetChat = () => {
    setChatMessages([]);
    setCurrentSessionId(null);
    setChatInputText('');
    setChatError('');
  };

  // --- Settings Actions ---
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      if (window.api) {
        await window.api.settings.save(settings);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- History Tab Actions ---
  const handleDeleteItem = async (id, type) => {
    let newHistory = { ...history };
    if (type === 'translations') {
      newHistory.translations = history.translations.filter(t => t.id !== id);
    } else {
      newHistory.chats = history.chats.filter(c => c.id !== id);
      // If deleting the active chat session, reset chat view
      if (currentSessionId === id) {
        handleResetChat();
      }
    }
    setHistory(newHistory);
    if (window.api) {
      await window.api.history.save(newHistory);
    }
  };

  const handleClearAllHistory = async () => {
    if (confirm(`确认清空所有${historyType === 'translations' ? '翻译' : '聊天'}历史记录吗？`)) {
      let newHistory = { ...history };
      if (historyType === 'translations') {
        newHistory.translations = [];
      } else {
        newHistory.chats = [];
        handleResetChat();
      }
      setHistory(newHistory);
      if (window.api) {
        await window.api.history.save(newHistory);
      }
    }
  };

  const loadChatFromHistory = (chatSession) => {
    setChatMessages(chatSession.messages);
    setCurrentSessionId(chatSession.id);
    setChatError('');
    setActiveTab('chat');
  };

  return (
    <div className="glass-panel w-screen h-screen rounded-2xl overflow-hidden flex flex-col shadow-2xl text-slate-100 border border-slate-800">
      
      {/* Frameless Top Drag Bar */}
      <header className="drag-area h-10 shrink-0 bg-slate-950/60 flex items-center justify-between px-4 border-b border-slate-900/40">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider bg-gradient-to-r from-indigo-300 to-purple-400 bg-clip-text text-transparent uppercase">
            AI 客服助手
          </span>
        </div>
        
        {/* Window controls */}
        <div className="no-drag-area flex items-center space-x-1">
          <button 
            onClick={togglePin} 
            title={isPinned ? "取消置顶" : "置顶悬浮"}
            className={`p-1 rounded-lg transition-colors duration-150 ${isPinned ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Pin className={`w-3 h-3 ${isPinned ? 'rotate-45' : ''}`} />
          </button>
          <button 
            onClick={handleMinimize} 
            title="最小化"
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-150"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button 
            onClick={handleClose} 
            title="关闭"
            className="p-1 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors duration-150"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Tab Navigation Menu */}
      <nav className="shrink-0 h-10 bg-slate-950/40 border-b border-slate-900/60 flex items-center justify-around px-2 gap-1 text-[11px] font-medium text-slate-400">
        <button
          onClick={() => setActiveTab('translate')}
          className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'translate' 
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-inner' 
              : 'hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>翻译</span>
        </button>
        
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'chat' 
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-inner' 
              : 'hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>提问</span>
        </button>
        
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'history' 
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-inner' 
              : 'hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
          }`}
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span>历史</span>
        </button>
        
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'settings' 
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-inner' 
              : 'hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span>设置</span>
        </button>
      </nav>

      {/* Main Workspace Frame */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        
        {/* --- 1. TRANSLATION TAB VIEW --- */}
        {activeTab === 'translate' && (
          <div className="flex-1 flex flex-col p-3.5 space-y-3.5 overflow-hidden">
            {translateError && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-lg p-2.5 flex items-start space-x-2 animate-fadeIn shrink-0">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-red-200 leading-normal">{translateError}</span>
              </div>
            )}

            {/* Input card */}
            <div className="space-y-1 shrink-0">
              <label className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                简体中文原文
              </label>
              <div className="relative">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleTranslateKeyDown}
                  placeholder="请输入客服原文，按 Enter 翻译，Ctrl + Enter 换行..."
                  className="glass-input w-full rounded-lg p-2.5 text-xs resize-none focus:outline-none placeholder:text-slate-500 text-slate-100 leading-relaxed font-sans"
                />
                <div className="absolute bottom-2 right-2 text-[9px] text-slate-500 font-mono">
                  {inputText.length} 字
                </div>
              </div>
            </div>

            {/* Submit button */}
            <button
              onClick={handleTranslate}
              disabled={translateLoading || !inputText.trim()}
              className={`glow-button w-full py-2 rounded-lg font-medium text-xs transition-all duration-200 flex items-center justify-center space-x-1.5 shrink-0 ${
                translateLoading 
                  ? 'bg-indigo-600/50 text-slate-300 cursor-not-allowed'
                  : !inputText.trim()
                    ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg active:scale-[0.98]'
              }`}
            >
              {translateLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-200" />
                  <span>正在智能润色...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                  <span>开始智能翻译</span>
                </>
              )}
            </button>

            {/* Display Outputs */}
            <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto pr-0.5">
              {/* Taiwan Output */}
              <div className="flex-1 min-h-[90px] flex flex-col bg-slate-900/30 rounded-lg p-2.5 border border-slate-800/40 relative">
                <div className="flex items-center justify-between mb-1.5 shrink-0">
                  <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                    台湾客服风格繁体
                  </span>
                  {taiwanOutput && (
                    <button
                      onClick={() => copyToClipboard(taiwanOutput, 'tw')}
                      className={`text-[9px] flex items-center space-x-1 px-1.5 py-0.5 rounded transition-all duration-150 ${
                        copiedTw 
                          ? 'text-emerald-400 bg-emerald-500/10' 
                          : 'text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300'
                      }`}
                    >
                      {copiedTw ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                      <span>{copiedTw ? '已复制' : '复制繁体'}</span>
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto text-xs leading-relaxed select-text selection:bg-indigo-500/30 pr-1">
                  {taiwanOutput ? (
                    <p className="whitespace-pre-wrap">{taiwanOutput}</p>
                  ) : (
                    <p className="text-slate-600 italic text-[11px]">等待智能编译输出...</p>
                  )}
                </div>
              </div>

              {/* English Output */}
              <div className="flex-1 min-h-[90px] flex flex-col bg-slate-900/30 rounded-lg p-2.5 border border-slate-800/40 relative">
                <div className="flex items-center justify-between mb-1.5 shrink-0">
                  <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                    英文客服口吻
                  </span>
                  {englishOutput && (
                    <button
                      onClick={() => copyToClipboard(englishOutput, 'en')}
                      className={`text-[9px] flex items-center space-x-1 px-1.5 py-0.5 rounded transition-all duration-150 ${
                        copiedEn 
                          ? 'text-emerald-400 bg-emerald-500/10' 
                          : 'text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300'
                      }`}
                    >
                      {copiedEn ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                      <span>{copiedEn ? '已复制' : '复制英文'}</span>
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto text-xs leading-relaxed select-text selection:bg-indigo-500/30 pr-1">
                  {englishOutput ? (
                    <p className="whitespace-pre-wrap font-sans">{englishOutput}</p>
                  ) : (
                    <p className="text-slate-600 italic text-[11px]">等待智能编译输出...</p>
                  )}
                </div>
              </div>
            </div>

            {/* History logs are managed in the History tab */}
          </div>
        )}

        {/* --- 2. NORMAL CHAT TAB VIEW --- */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col p-3 overflow-hidden bg-slate-950/10">
            
            {/* Header Control */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-900/60 shrink-0">
              <div className="flex items-center space-x-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-300">
                  {currentSessionId ? "对话咨询" : "新对话"}
                </span>
              </div>
              <button
                onClick={handleResetChat}
                className="text-[10px] flex items-center space-x-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
                title="清空上下文，开启新对话"
              >
                <RefreshCw className="w-2.5 h-2.5 text-indigo-400" />
                <span>重置对话</span>
              </button>
            </div>

            {/* Chat Error */}
            {chatError && (
              <div className="mt-2 bg-red-500/10 border border-red-500/25 rounded-md p-2 flex items-start space-x-2 shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-[10px] text-red-200">{chatError}</span>
              </div>
            )}

            {/* Message Flow Area */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 flex flex-col pr-1 min-h-0">
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-300">智能 AI 客服聊天</h3>
                  <p className="text-[10px] leading-relaxed max-w-[200px]">
                    输入任何客服场景的疑问，此窗口支持上下文联想，帮您梳理客服话术。
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-1 ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 text-[9px] text-slate-500 px-1 font-mono">
                      <span>{msg.role === 'user' ? '客服' : '助手'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    
                    <div
                      className={`px-3 py-2 rounded-2xl max-w-[85%] text-xs leading-relaxed whitespace-pre-wrap select-text font-sans ${
                        msg.role === 'user'
                          ? 'bg-indigo-600/30 border border-indigo-500/20 text-indigo-100 rounded-tr-none'
                          : 'bg-slate-900/60 border border-slate-800/80 text-slate-100 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}

              {/* Bot typing loader */}
              {chatLoading && (
                <div className="flex flex-col space-y-1 items-start">
                  <div className="flex items-center space-x-1 text-[9px] text-slate-500 px-1">
                    <span>助手</span>
                    <span>•</span>
                    <span>正在思考...</span>
                  </div>
                  <div className="px-3 py-2.5 rounded-2xl rounded-tl-none bg-slate-900/60 border border-slate-800/80 flex items-center space-x-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span className="text-[10px] text-slate-400">AI 正在回复中...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Bottom Input Area */}
            <div className="shrink-0 pt-2 border-t border-slate-900/60 flex items-end space-x-2">
              <textarea
                rows={1}
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="发送给 AI (Enter 发送，Shift+Enter 换行)..."
                className="glass-input flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none placeholder:text-slate-600 text-slate-100 leading-relaxed font-sans max-h-20 resize-none"
              />
              <button
                onClick={handleSendChatMessage}
                disabled={chatLoading || !chatInputText.trim()}
                className={`p-2 rounded-lg transition-all ${
                  !chatInputText.trim() || chatLoading
                    ? 'bg-slate-900 text-slate-600'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        )}

        {/* --- 3. HISTORY TAB VIEW --- */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col p-3.5 overflow-hidden">
            
            {/* Header selection */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-900/60 shrink-0">
              <div className="flex bg-slate-900/60 p-0.5 rounded-lg border border-slate-850">
                <button
                  onClick={() => setHistoryType('translations')}
                  className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${
                    historyType === 'translations'
                      ? 'bg-indigo-600/30 text-indigo-300'
                      : 'text-slate-500 hover:text-slate-355'
                  }`}
                >
                  翻译历史
                </button>
                <button
                  onClick={() => setHistoryType('chats')}
                  className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${
                    historyType === 'chats'
                      ? 'bg-indigo-600/30 text-indigo-300'
                      : 'text-slate-500 hover:text-slate-355'
                  }`}
                >
                  聊天对话
                </button>
              </div>

              {((historyType === 'translations' && history.translations.length > 0) ||
                (historyType === 'chats' && history.chats.length > 0)) && (
                <button
                  onClick={handleClearAllHistory}
                  className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg"
                  title="全部删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Content Scroll Flow */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-0 pr-0.5">
              
              {/* Translations List */}
              {historyType === 'translations' && (
                history.translations.length === 0 ? (
                  <p className="text-center text-slate-600 italic text-xs py-8">暂无翻译历史</p>
                ) : (
                  history.translations.map((item) => (
                    <div 
                      key={item.id}
                      className="group p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-900/80 border border-slate-900 hover:border-slate-850 transition-all flex flex-col relative"
                    >
                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono mb-1 shrink-0">
                        <span>{item.date} {item.timestamp}</span>
                        <button
                          onClick={() => handleDeleteItem(item.id, 'translations')}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-all"
                          title="删除记录"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div 
                        onClick={() => selectTranslateHistoryItem(item) || setActiveTab('translate')}
                        className="cursor-pointer"
                      >
                        <p className="text-xs text-slate-200 line-clamp-1 font-medium mb-1.5">{item.original}</p>
                        <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                          <span className="truncate max-w-[45%] text-slate-400">繁: {item.taiwan}</span>
                          <span className="text-slate-600">•</span>
                          <span className="truncate max-w-[45%] text-slate-500 font-sans">EN: {item.english}</span>
                          <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* Chats List */}
              {historyType === 'chats' && (
                history.chats.length === 0 ? (
                  <p className="text-center text-slate-600 italic text-xs py-8">暂无聊天历史</p>
                ) : (
                  history.chats.map((session) => (
                    <div 
                      key={session.id}
                      className="group p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-900/80 border border-slate-900 hover:border-slate-850 transition-all flex flex-col relative"
                    >
                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono mb-1 shrink-0">
                        <span>{session.date} {session.timestamp}</span>
                        <button
                          onClick={() => handleDeleteItem(session.id, 'chats')}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-all"
                          title="删除记录"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <div 
                        onClick={() => loadChatFromHistory(session)}
                        className="cursor-pointer"
                      >
                        <p className="text-xs text-slate-200 font-medium line-clamp-1 flex items-center space-x-1">
                          <MessageSquare className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>{session.title}</span>
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span>包含 {session.messages.length} 条消息</span>
                          <span className="flex items-center text-indigo-400 text-[9px]">
                            查看详情 <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}

            </div>
          </div>
        )}

        {/* --- 4. SETTINGS TAB VIEW --- */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="flex-1 flex flex-col p-3.5 overflow-hidden h-full">
            {/* Scrollable Form Fields */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 min-h-0 flex flex-col">
              <div className="space-y-1 border-b border-slate-900 pb-2 shrink-0">
                <h2 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                  <Settings className="w-3.5 h-3.5 text-indigo-400" />
                  <span>API 服务配置</span>
                </h2>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  配置您本地的 OpenAI 或兼容的中转 API 密钥及节点。
                </p>
              </div>

              {/* API Key */}
              <div className="space-y-1 shrink-0">
                <label className="text-[10px] font-bold text-slate-400">OpenAI API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="sk-proj-..."
                    className="glass-input w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none text-slate-100 font-mono pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-350"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div className="space-y-1 shrink-0">
                <label className="text-[10px] font-bold text-slate-400">API Base URL</label>
                <input
                  type="text"
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="glass-input w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none text-slate-100 font-mono"
                />
              </div>

              {/* Proxy URL */}
              <div className="space-y-1 shrink-0">
                <label className="text-[10px] font-bold text-slate-400">网络代理 (Proxy URL)</label>
                <input
                  type="text"
                  value={settings.proxyUrl}
                  onChange={(e) => setSettings({ ...settings, proxyUrl: e.target.value })}
                  placeholder="例如: http://127.0.0.1:7890 (留空则直连)"
                  className="glass-input w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none text-slate-100 font-mono"
                />
              </div>

              {/* Model Name */}
              <div className="space-y-1 shrink-0">
                <label className="text-[10px] font-bold text-slate-400">默认模型型号 (Model)</label>
                <input
                  type="text"
                  value={settings.modelName}
                  onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
                  placeholder="gpt-4o-mini"
                  className="glass-input w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none text-slate-100 font-mono"
                />
              </div>

              {/* Translate System Prompt */}
              <div className="flex-1 flex flex-col min-h-[140px] space-y-1">
                <label className="text-[10px] font-bold text-slate-400 shrink-0">翻译 System Prompt (前置提示词)</label>
                <textarea
                  value={settings.translatePrompt}
                  onChange={(e) => setSettings({ ...settings, translatePrompt: e.target.value })}
                  placeholder="请输入自定义翻译前置提示词..."
                  className="glass-input w-full flex-1 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-slate-100 font-mono resize-none min-h-[80px]"
                />
                <p className="text-[9px] text-slate-500 leading-normal shrink-0">
                  提示：请确保提示词指示 AI 输出的格式包含【台湾繁体】与【English】关键字，程序才能正确截取并分割成两栏。
                </p>
              </div>
            </div>

            {/* Actions (Fixed at Bottom) */}
            <div className="shrink-0 pt-2.5 border-t border-slate-900 mt-2">
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg text-xs shadow-lg transition-all active:scale-[0.98]"
              >
                保存设置
              </button>
              
              {settingsSaved && (
                <p className="text-[10px] text-center text-emerald-400 font-medium mt-1.5 animate-pulse">
                  ✓ 设置已成功保存，并在本地持久化。
                </p>
              )}
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
