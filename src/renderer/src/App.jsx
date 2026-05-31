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
  ChevronRight,
  StickyNote,
  Database,
  FolderOpen,
  Plus,
  Minimize2,
  Languages,
  Terminal
} from 'lucide-react';

const getHeadersFromPrompt = (prompt) => {
  if (!prompt) return ['台湾繁体', 'English'];
  const headers = [];
  const headerRegex = /【([^】]+)】/g;
  let match;
  while ((match = headerRegex.exec(prompt)) !== null) {
    const h = match[1].trim();
    if (!headers.includes(h)) {
      headers.push(h);
    }
  }
  return headers.length > 0 ? headers : ['台湾繁体', 'English'];
};

const handleModifierEnter = (e, value, setValue) => {
  e.preventDefault();
  const textarea = e.target;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const newValue = value.substring(0, start) + '\n' + value.substring(end);
  setValue(newValue);
  setTimeout(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 1;
  }, 0);
};

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('translate'); // 'translate' | 'chat' | 'memo' | 'history' | 'settings'

  // Floating Ball / uTools style mini icon mode
  const [isFloating, setIsFloating] = useState(false);
  const [isVisualFloating, setIsVisualFloating] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const isRestoringRef = useRef(false);

  const handleBallPointerDown = (e) => {
    console.log(`[Renderer] pointerdown - button: ${e.button}, client: (${e.clientX}, ${e.clientY}), screen: (${e.screenX}, ${e.screenY}), isRestoring: ${isRestoringRef.current}`);
    if (e.button !== 0 || isRestoringRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.screenX, y: e.screenY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handleBallPointerMove = (e) => {
    if (!isDraggingRef.current || isRestoringRef.current) return;
    const dx = e.screenX - dragStartRef.current.x;
    const dy = e.screenY - dragStartRef.current.y;
    console.log(`[Renderer] pointermove - screenX: ${e.screenX}, screenY: ${e.screenY}, dragStartX: ${dragStartRef.current.x}, dragStartY: ${dragStartRef.current.y}, dx: ${dx}, dy: ${dy}`);
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      hasMovedRef.current = true;
    }
    if (dx !== 0 || dy !== 0) {
      window.api?.windowControls.moveWindow(dx, dy);
      dragStartRef.current = { x: e.screenX, y: e.screenY };
    }
  };

  const handleBallPointerUp = (e) => {
    console.log(`[Renderer] pointerup - isDragging: ${isDraggingRef.current}, hasMoved: ${hasMovedRef.current}, isRestoring: ${isRestoringRef.current}`);
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!hasMovedRef.current && !isRestoringRef.current) {
      console.log('[Renderer] pointerup - Triggering handleRestore');
      handleRestore();
    }
  };

  const handleShrink = () => {
    if (isFloating || isVisualFloating) return;
    setIsVisualFloating(true);
    setTimeout(() => {
      setIsFloating(true);
      window.api?.windowControls.shrinkToIcon();
    }, 40);
  };

  const handleRestore = () => {
    if (isRestoringRef.current) return;
    isRestoringRef.current = true;
    window.api?.windowControls.restoreFromIcon();
    setIsFloating(false);
    setTimeout(() => {
      setIsVisualFloating(false);
      isRestoringRef.current = false;
      
      // Auto-focus input fields when restoring normal window
      const focusInput = () => {
        if (activeTab === 'translate') {
          inputRef.current?.focus();
        } else if (activeTab === 'chat') {
          chatInputRef.current?.focus();
        }
      };

      focusInput();
      // Retry at different stages of window layout stabilization to ensure focus succeeds
      setTimeout(focusInput, 50);
      setTimeout(focusInput, 150);
      setTimeout(focusInput, 300);
      setTimeout(focusInput, 500);
    }, 100);
  };

  // Window pin status
  const [isPinned, setIsPinned] = useState(true);

  // Memo State
  const [memos, setMemos] = useState([]);
  const [memoSaveStatus, setMemoSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newMemoText, setNewMemoText] = useState('');
  const [editingMemoId, setEditingMemoId] = useState(null);
  const [editingMemoText, setEditingMemoText] = useState('');
  const [copiedMemoId, setCopiedMemoId] = useState(null);
  const isSavingRef = useRef(false);

  const editingMemoIdRef = useRef(null);
  const isAddingNewRef = useRef(false);

  useEffect(() => {
    editingMemoIdRef.current = editingMemoId;
  }, [editingMemoId]);

  useEffect(() => {
    isAddingNewRef.current = isAddingNew;
  }, [isAddingNew]);

  // Memo Tab Category States
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newMemoCategory, setNewMemoCategory] = useState(undefined);
  const [editingMemoCategory, setEditingMemoCategory] = useState(undefined);

  // Local storage diagnostic state
  const [dbInfo, setDbInfo] = useState({ path: '', size: '' });

  // Global settings state
  const [settings, setSettings] = useState({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
    translatePrompt: '',
    proxyUrl: 'http://127.0.0.1:7890',
    memoCategories: []
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [currentHeaders, setCurrentHeaders] = useState(['台湾繁体', 'English']);

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
  const [translateOutputs, setTranslateOutputs] = useState([]);
  const [copiedLabel, setCopiedLabel] = useState(null);
  const [showTranslateHistory, setShowTranslateHistory] = useState(false);
  const inputRef = useRef(null);

  // --- Normal Chat Tab State ---
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInputText, setChatInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const chatBottomRef = useRef(null);
  const chatInputRef = useRef(null);

  // --- Logs Tab State ---
  const [logsContent, setLogsContent] = useState('');
  const logsBottomRef = useRef(null);

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
              proxyUrl: savedSettings.proxyUrl !== undefined ? savedSettings.proxyUrl : 'http://127.0.0.1:7890',
              memoCategories: savedSettings.memoCategories || []
            });
            setCurrentHeaders(getHeadersFromPrompt(savedSettings.translatePrompt));
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

      // Load Memo
      window.api.storage.getMemo()
        .then((data) => {
          if (Array.isArray(data)) {
            setMemos(data);
          } else {
            setMemos([]);
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

  // Load DB Info whenever Settings tab gets focused
  useEffect(() => {
    if (activeTab === 'settings') {
      loadDbInfo();
    }
  }, [activeTab]);

  // Auto-focus input fields when switching to Translate or Chat tabs
  useEffect(() => {
    if (activeTab === 'translate') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else if (activeTab === 'chat') {
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 50);
    }
  }, [activeTab]);

  // Load logs whenever Logs tab gets focused
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs().then(() => {
        setTimeout(() => {
          if (logsBottomRef.current) {
            logsBottomRef.current.scrollIntoView({ behavior: 'auto' });
          }
        }, 50);
      });
    }
  }, [activeTab]);

  const saveMemosToStorage = (updatedMemos) => {
    if (window.api && window.api.storage) {
      setMemoSaveStatus('saving');
      window.api.storage.saveMemo(updatedMemos)
        .then(() => setMemoSaveStatus('saved'))
        .catch((err) => {
          console.error(err);
          setMemoSaveStatus('error');
        });
    }
  };

  const handleSaveNewMemo = (textToSave = newMemoText) => {
    if (!isAddingNewRef.current) return;
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    const trimmed = textToSave.trim();
    if (!trimmed) {
      setIsAddingNew(false);
      setNewMemoText('');
      setNewMemoCategory(undefined);
      isSavingRef.current = false;
      return;
    }

    const newMemo = {
      id: Date.now(),
      text: trimmed,
      category: newMemoCategory,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMemos = [newMemo, ...memos];
    setMemos(updatedMemos);
    saveMemosToStorage(updatedMemos);

    setIsAddingNew(false);
    setNewMemoText('');
    setNewMemoCategory(undefined);

    setTimeout(() => {
      isSavingRef.current = false;
    }, 50);
  };

  const handleNewMemoBlur = (e) => {
    setTimeout(() => {
      if (document.activeElement && document.activeElement.closest('.memo-card-new')) {
        return;
      }
      handleSaveNewMemo();
    }, 150);
  };

  const handleStartEdit = (memo) => {
    // First, save any other active inputs
    if (isAddingNew) {
      handleSaveNewMemo();
    }
    if (editingMemoId !== null && editingMemoId !== memo.id) {
      handleSaveEditMemo(editingMemoId);
    }

    setEditingMemoId(memo.id);
    setEditingMemoText(memo.text);
    setEditingMemoCategory(memo.category);
  };

  const handleSaveEditMemo = (id, textToSave = editingMemoText) => {
    if (editingMemoIdRef.current !== id) return;
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    const trimmed = textToSave.trim();
    if (!trimmed) {
      handleDeleteMemo(id);
      setTimeout(() => {
        isSavingRef.current = false;
      }, 50);
      return;
    }

    const updatedMemos = memos.map(m => {
      if (m.id === id) {
        return { ...m, text: trimmed, category: editingMemoCategory };
      }
      return m;
    });

    setMemos(updatedMemos);
    saveMemosToStorage(updatedMemos);
    setEditingMemoId(null);
    setEditingMemoText('');
    setEditingMemoCategory(undefined);

    setTimeout(() => {
      isSavingRef.current = false;
    }, 50);
  };

  const handleEditMemoBlur = (id, e) => {
    setTimeout(() => {
      if (document.activeElement && document.activeElement.closest(`.memo-card-${id}`)) {
        return;
      }
      handleSaveEditMemo(id);
    }, 150);
  };

  const handleDeleteMemo = (id) => {
    const updatedMemos = memos.filter(m => m.id !== id);
    setMemos(updatedMemos);
    saveMemosToStorage(updatedMemos);
    if (editingMemoId === id) {
      setEditingMemoId(null);
      setEditingMemoText('');
      setEditingMemoCategory(undefined);
    }
  };

  const handleCopyMemo = async (id, text) => {
    if (!text) return;
    try {
      if (window.api) {
        await window.api.clipboard.copyText(text);
        setCopiedMemoId(id);
        setTimeout(() => setCopiedMemoId(null), 2000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMemoKeyDown = (e, isNew, id) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        if (isNew) {
          handleModifierEnter(e, newMemoText, setNewMemoText);
        } else {
          handleModifierEnter(e, editingMemoText, setEditingMemoText);
        }
      } else {
        e.preventDefault();
        if (isNew) {
          handleSaveNewMemo();
        } else {
          handleSaveEditMemo(id);
        }
      }
    }
  };

  const handleAddNewMemoClick = () => {
    if (editingMemoId !== null) {
      handleSaveEditMemo(editingMemoId);
    }
    const defaultCat = (selectedCategory !== '全部' && selectedCategory !== '未分类') ? selectedCategory : undefined;
    setNewMemoCategory(defaultCat);
    setIsAddingNew(true);
    setNewMemoText('');
  };

  const handleAddCategory = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (settings.memoCategories.includes(trimmed) || trimmed === '全部' || trimmed === '未分类') {
      alert('分类名称已存在或不合法');
      return;
    }
    const updatedCategories = [...settings.memoCategories, trimmed];
    const newSettings = { ...settings, memoCategories: updatedCategories };
    setSettings(newSettings);
    if (window.api) {
      await window.api.settings.save(newSettings);
    }
  };

  const handleDeleteCategory = async (catName) => {
    if (confirm(`确定要删除分类 "${catName}" 吗？此分类下的备忘录将被移至 "未分类"`)) {
      const updatedCategories = settings.memoCategories.filter(c => c !== catName);
      const newSettings = { ...settings, memoCategories: updatedCategories };
      setSettings(newSettings);
      if (window.api) {
        await window.api.settings.save(newSettings);
      }

      // Update memos that were in this category to be undefined
      const updatedMemos = memos.map(m => {
        if (m.category === catName) {
          return { ...m, category: undefined };
        }
        return m;
      });
      setMemos(updatedMemos);
      saveMemosToStorage(updatedMemos);

      // If the deleted category was selected, fall back to '全部'
      if (selectedCategory === catName) {
        setSelectedCategory('全部');
      }
    }
  };

  const loadDbInfo = () => {
    if (window.api && window.api.storage) {
      window.api.storage.getDbInfo()
        .then(info => setDbInfo(info))
        .catch(console.error);
    }
  };

  const handleOpenDbFolder = () => {
    if (window.api && window.api.storage) {
      window.api.storage.openDbFolder();
    }
  };

  const fetchLogs = async () => {
    if (window.api && window.api.logs) {
      try {
        const content = await window.api.logs.get();
        setLogsContent(content);
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    }
  };

  const handleClearLogs = async () => {
    if (confirm('确认清空运行日志吗？')) {
      if (window.api && window.api.logs) {
        try {
          await window.api.logs.clear();
          setLogsContent('');
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const handleOpenLogsFolder = async () => {
    if (window.api && window.api.logs) {
      try {
        await window.api.logs.open();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Window actions
  const handleMinimize = () => window.api?.windowControls.minimize();
  const handleClose = () => window.api?.windowControls.close();
  const togglePin = () => window.api?.windowControls.togglePin();

  // Clipboard copy helper
  const copyToClipboard = async (text, label) => {
    if (!text) return;
    try {
      if (window.api) {
        await window.api.clipboard.copyText(text);
        setCopiedLabel(label);
        setTimeout(() => setCopiedLabel(null), 2000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Translation Actions ---
  const handleTranslateKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        handleModifierEnter(e, inputText, setInputText);
      } else {
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
      
      setTaiwanOutput(result.taiwan || '');
      setEnglishOutput(result.english || '');
      setTranslateOutputs(result.outputs || []);

      // Save translation item to history
      const newTranslation = {
        id: Date.now(),
        original: inputText.trim(),
        taiwan: result.taiwan || '',
        english: result.english || '',
        outputs: result.outputs || [],
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
    setTaiwanOutput(item.taiwan || '');
    setEnglishOutput(item.english || '');
    if (item.outputs && Array.isArray(item.outputs)) {
      setTranslateOutputs(item.outputs);
    } else {
      setTranslateOutputs([
        { label: '台湾繁体', text: item.taiwan || '' },
        { label: 'English', text: item.english || '' }
      ]);
    }
    setTranslateError('');
    setShowTranslateHistory(false);
  };

  // --- Normal Chat Actions ---
  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        handleModifierEnter(e, chatInputText, setChatInputText);
      } else {
        e.preventDefault();
        handleSendChatMessage();
      }
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
        setCurrentHeaders(getHeadersFromPrompt(settings.translatePrompt));
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
    <div
      onPointerDown={isFloating ? handleBallPointerDown : undefined}
      onPointerMove={isFloating ? handleBallPointerMove : undefined}
      onPointerUp={isFloating ? handleBallPointerUp : undefined}
      title={isFloating ? "拖拽移动，点击恢复窗口" : undefined}
      className={`w-screen h-screen overflow-hidden select-none relative bg-gradient-to-br from-[#0b0f19] via-[#131a35] to-[#251845] transition-all duration-200
        ${isFloating 
          ? "cursor-move flex items-center justify-center border border-indigo-500/30 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.25)] hover:shadow-[0_0_22px_rgba(99,102,241,0.5)] hover:border-indigo-400/40 active:scale-95" 
          : "cursor-default border-none shadow-none"
        }`}
    >
      {/* Mini floating ball content */}
      <div 
        className={`absolute top-1.5 right-1.5 w-[48px] h-[48px] flex items-center justify-center transition-all duration-75 bg-transparent
          ${isFloating ? "pointer-events-auto" : "pointer-events-none"}
          ${isVisualFloating ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
      >
        <Sparkles className="w-6 h-6 text-indigo-300 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
      </div>

      {/* Main UI Content */}
      <div 
        className={`w-full h-full glass-panel rounded-2xl border border-slate-800 flex flex-col transition-all duration-75 origin-top-right
          ${isVisualFloating ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100"}`}
      >
        {/* Frameless Top Drag Bar */}
        <header className={`${isFloating ? "no-drag-area" : "drag-area"} h-10 shrink-0 bg-slate-950/60 flex items-center justify-between px-4 border-b border-slate-900/40`}>
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider bg-gradient-to-r from-indigo-300 to-purple-400 bg-clip-text text-transparent uppercase">
            AI 客服助手
          </span>
        </div>
        
        {/* Window controls */}
        <div className="no-drag-area flex items-center space-x-1">
          <button 
            onClick={handleShrink} 
            title="迷你悬浮球"
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition-colors duration-150"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
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
          onClick={() => setActiveTab('memo')}
          className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'memo' 
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-inner' 
              : 'hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
          }`}
        >
          <StickyNote className="w-3.5 h-3.5 shrink-0" />
          <span>备忘</span>
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

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'logs' 
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-inner' 
              : 'hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 shrink-0" />
          <span>日志</span>
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
              {(translateOutputs.length > 0 ? translateOutputs : currentHeaders.map(h => ({ label: h, text: '' }))).map((output) => {
                const header = output.label;
                const text = output.text;
                const isCopied = copiedLabel === header;
                return (
                  <div key={header} className="flex-1 min-h-[90px] flex flex-col bg-slate-900/30 rounded-lg p-2.5 border border-slate-800/40 relative">
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                      <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                        {header}
                      </span>
                      {text && (
                        <button
                          onClick={() => copyToClipboard(text, header)}
                          className={`p-1.5 rounded-lg transition-all duration-150 ${
                            isCopied 
                              ? 'text-emerald-400 bg-emerald-500/10 scale-105' 
                              : 'text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300'
                          }`}
                          title={isCopied ? "已复制" : `复制${header}`}
                        >
                          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto text-xs leading-relaxed select-text selection:bg-indigo-500/30 pr-1">
                      {text ? (
                        <p className="whitespace-pre-wrap font-sans">{text}</p>
                      ) : (
                        <p className="text-slate-650 italic text-[11px]">等待智能编译输出...</p>
                      )}
                    </div>
                  </div>
                );
              })}
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
                ref={chatInputRef}
                rows={1}
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="发送给 AI (Enter 发送，Shift+Enter 换行)..."
                className="glass-input flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none placeholder:text-slate-650 text-slate-100 leading-relaxed font-sans max-h-20 resize-none"
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
                          {item.outputs && Array.isArray(item.outputs) ? (
                            <div className="flex items-center space-x-1.5 truncate max-w-[90%]">
                              {item.outputs.slice(0, 2).map((out, idx) => (
                                <React.Fragment key={idx}>
                                  {idx > 0 && <span className="text-slate-600 font-mono">•</span>}
                                  <span className="truncate text-slate-400">
                                    {out.label}: {out.text}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <>
                              <span className="truncate max-w-[45%] text-slate-400">繁: {item.taiwan}</span>
                              <span className="text-slate-600">•</span>
                              <span className="truncate max-w-[45%] text-slate-500 font-sans">EN: {item.english}</span>
                            </>
                          )}
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

              {/* Local Storage & Diagnostics Section */}
              <div className="space-y-2 pt-3 border-t border-slate-900 shrink-0">
                <h2 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>本地存储与诊断</span>
                </h2>
                <div className="bg-slate-900/40 rounded-lg p-2.5 border border-slate-800/60 space-y-2">
                  <div className="flex flex-col space-y-1">
                    <span className="text-[9px] font-bold text-slate-400">数据文件夹路径</span>
                    <span className="text-[10px] text-slate-350 font-mono break-all bg-slate-950/40 p-1.5 rounded border border-slate-900/60 select-text">
                      {dbInfo.path || '正在读取...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400">文件夹大小</span>
                      <span className="text-xs font-medium text-slate-200">{dbInfo.size || '正在计算...'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenDbFolder}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors flex items-center space-x-1"
                    >
                      <FolderOpen className="w-3 h-3" />
                      <span>打开文件夹</span>
                    </button>
                  </div>
                </div>
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

        {/* --- 5. MEMO TAB VIEW --- */}
        {activeTab === 'memo' && (
          <div className="flex-1 flex flex-row overflow-hidden h-full">
            {/* Left Sidebar for Categories */}
            <div className="w-[105px] shrink-0 bg-slate-950/20 border-r border-slate-900/60 flex flex-col p-2 min-h-0 space-y-1.5 select-none text-[11px] no-drag-area">
              <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
                {/* All Memos */}
                <button
                  onClick={() => setSelectedCategory('全部')}
                  className={`w-full text-left px-2 py-1.5 rounded-md font-medium transition-all truncate flex items-center justify-between ${
                    selectedCategory === '全部'
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-inner'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <span>全部</span>
                  <span className="text-[9px] text-slate-500 font-mono">({memos.length})</span>
                </button>

                {/* Uncategorized */}
                <button
                  onClick={() => setSelectedCategory('未分类')}
                  className={`w-full text-left px-2 py-1.5 rounded-md font-medium transition-all truncate flex items-center justify-between ${
                    selectedCategory === '未分类'
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-inner'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <span>未分类</span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    ({memos.filter(m => !m.category).length})
                  </span>
                </button>

                {/* Custom Categories */}
                {settings.memoCategories.map(cat => {
                  const count = memos.filter(m => m.category === cat).length;
                  return (
                    <div
                      key={cat}
                      className={`group flex items-center justify-between rounded-md transition-all border relative ${
                        selectedCategory === cat
                          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/20 shadow-inner'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedCategory(cat)}
                        className="flex-1 text-left px-2 py-1.5 font-medium truncate pr-6 text-left"
                      >
                        {cat}
                      </button>
                      <span className="absolute right-2 text-[9px] text-slate-500 font-mono group-hover:hidden">
                        ({count})
                      </span>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="hidden group-hover:flex absolute right-1.5 p-0.5 rounded text-slate-400 hover:text-red-400 transition-colors"
                        title="删除分类"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Category Form */}
              <div className="pt-1.5 border-t border-slate-900/60 shrink-0">
                {isAddingCategory ? (
                  <div className="flex flex-col space-y-1">
                    <input
                      autoFocus
                      type="text"
                      placeholder="分类名称..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddCategory(newCategoryName);
                          setIsAddingCategory(false);
                          setNewCategoryName('');
                        } else if (e.key === 'Escape') {
                          setIsAddingCategory(false);
                          setNewCategoryName('');
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          if (newCategoryName.trim()) {
                            handleAddCategory(newCategoryName);
                          }
                          setIsAddingCategory(false);
                          setNewCategoryName('');
                        }, 150);
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/30 rounded px-1.5 py-1 text-[10px] text-slate-100 placeholder:text-slate-650 focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[9px] px-0.5">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsAddingCategory(false);
                          setNewCategoryName('');
                        }}
                        className="text-slate-500 hover:text-slate-350"
                      >
                        取消
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddCategory(newCategoryName);
                          setIsAddingCategory(false);
                          setNewCategoryName('');
                        }}
                        className="text-indigo-450 font-medium hover:text-indigo-350"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingCategory(true)}
                    className="w-full py-1 text-slate-500 hover:text-indigo-400 border border-dashed border-slate-800 hover:border-indigo-500/20 rounded flex items-center justify-center space-x-0.5 transition-colors font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加分类</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Memos Flow */}
            <div className="flex-1 flex flex-col p-3.5 space-y-2.5 overflow-hidden h-full">
              {/* Header section */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-2.5 shrink-0">
                <div className="flex items-center space-x-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  <h2 className="text-xs font-semibold text-slate-200">
                    {selectedCategory === '全部' ? '工作备忘录' : selectedCategory}
                  </h2>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                    ({
                      memos.filter(memo => {
                        if (selectedCategory === '全部') return true;
                        if (selectedCategory === '未分类') return !memo.category;
                        return memo.category === selectedCategory;
                      }).length
                    })
                  </span>
                </div>
                
                {/* Status Indicator */}
                <div className="flex items-center">
                  {memoSaveStatus === 'saving' && (
                    <span className="text-[9.5px] text-slate-500 flex items-center space-x-1 font-sans">
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400" />
                      <span>正在保存...</span>
                    </span>
                  )}
                  {memoSaveStatus === 'saved' && (
                    <span className="text-[9.5px] text-emerald-400 flex items-center space-x-1 font-sans">
                      <Check className="w-2.5 h-2.5" />
                      <span>已存盘</span>
                    </span>
                  )}
                  {memoSaveStatus === 'error' && (
                    <span className="text-[9.5px] text-red-400 flex items-center space-x-1 font-sans">
                      <AlertCircle className="w-2.5 h-2.5" />
                      <span>保存失败</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable Container */}
              <div className="flex-1 overflow-y-auto pr-0.5 space-y-2.5 min-h-0">
                {/* Add New Memo Panel or Centered Plus Button */}
                {isAddingNew ? (
                  <div className="memo-card-new p-3.5 rounded-xl bg-slate-900/60 border border-indigo-500/20 shadow-md animate-fadeIn flex flex-col space-y-2">
                    <textarea
                      autoFocus
                      rows={6}
                      value={newMemoText}
                      onChange={(e) => setNewMemoText(e.target.value)}
                      onKeyDown={(e) => handleMemoKeyDown(e, true)}
                      onBlur={handleNewMemoBlur}
                      placeholder="在此输入新备忘内容，按 Enter 保存，Ctrl/Shift/Alt+Enter 换行..."
                      className="glass-input w-full rounded-lg p-2.5 text-xs focus:outline-none placeholder:text-slate-500 text-slate-100 leading-relaxed font-sans resize-y bg-slate-950/40 border border-slate-800/40 focus:border-indigo-500/30"
                    />
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] text-slate-500 font-mono">
                          {newMemoText.length} 字
                        </span>
                        
                        {/* Category Dropdown */}
                        <select
                          value={newMemoCategory || ''}
                          onChange={(e) => {
                            const val = e.target.value || undefined;
                            setNewMemoCategory(val);
                            const card = e.target.closest('.memo-card-new');
                            setTimeout(() => {
                              card?.querySelector('textarea')?.focus();
                            }, 50);
                          }}
                          onBlur={handleNewMemoBlur}
                          className="text-[10px] bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-350 focus:outline-none"
                        >
                          <option value="">未分类</option>
                          {settings.memoCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setIsAddingNew(false);
                            setNewMemoText('');
                            setNewMemoCategory(undefined);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-slate-200 transition-colors text-[10px] font-medium"
                        >
                          取消
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSaveNewMemo();
                          }}
                          className="px-2.5 py-1 rounded bg-indigo-650/80 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-650/15 transition-all text-[10px] font-medium"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleAddNewMemoClick}
                    className="w-full py-3.5 rounded-xl border border-dashed border-slate-800 hover:border-indigo-500/30 bg-slate-900/10 hover:bg-indigo-600/5 text-slate-500 hover:text-indigo-400 flex items-center justify-center transition-all duration-200 shrink-0"
                    title="新增备忘"
                  >
                    <Plus className="w-4 h-4 text-slate-450 hover:text-indigo-400 transition-colors" />
                  </button>
                )}

                {/* Memos List */}
                {memos.filter(memo => {
                  if (selectedCategory === '全部') return true;
                  if (selectedCategory === '未分类') return !memo.category;
                  return memo.category === selectedCategory;
                }).length === 0 ? (
                  !isAddingNew && (
                    <div className="flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2.5 mt-8">
                      <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
                        <StickyNote className="w-5 h-5 text-indigo-400/80" />
                      </div>
                      <h3 className="text-xs font-semibold text-slate-300">暂无工作备忘</h3>
                      <p className="text-[10px] leading-relaxed max-w-[200px]">
                        点击上方的“+”号按钮，记录您的日常备忘、常用快捷回复或工作记录。
                      </p>
                    </div>
                  )
                ) : (
                  memos.filter(memo => {
                    if (selectedCategory === '全部') return true;
                    if (selectedCategory === '未分类') return !memo.category;
                    return memo.category === selectedCategory;
                  }).map((memo) => {
                    const isEditing = editingMemoId === memo.id;
                    return (
                      <div
                        key={memo.id}
                        className={`memo-card-${memo.id} group rounded-xl border transition-all duration-200 ${
                          isEditing
                            ? 'bg-slate-900/60 border-indigo-500/20 shadow-md p-3.5 space-y-2'
                            : 'bg-slate-900/30 hover:bg-slate-900/50 border-slate-900 hover:border-slate-850 py-2.5 px-3 flex flex-col justify-center cursor-pointer relative overflow-hidden'
                        }`}
                        onClick={() => {
                          if (!isEditing) {
                            handleStartEdit(memo);
                          }
                        }}
                      >
                        {isEditing ? (
                          /* Expanded Editing View */
                          <>
                            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono select-none">
                              <span>编辑于 {memo.timestamp}</span>
                              <span className="text-slate-600 font-mono">{editingMemoText.length} 字</span>
                            </div>
                            
                            <textarea
                              autoFocus
                              rows={6}
                              value={editingMemoText}
                              onChange={(e) => setEditingMemoText(e.target.value)}
                              onKeyDown={(e) => handleMemoKeyDown(e, false, memo.id)}
                              onBlur={(e) => handleEditMemoBlur(memo.id, e)}
                              placeholder="在此输入备忘内容，按 Enter 保存，Ctrl/Shift/Alt+Enter 换行..."
                              className="glass-input w-full rounded-lg p-2.5 text-xs focus:outline-none placeholder:text-slate-500 text-slate-100 leading-relaxed font-sans resize-y bg-slate-950/40 border border-slate-800/40 focus:border-indigo-500/30"
                            />
                            
                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex items-center space-x-2">
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleCopyMemo(memo.id, editingMemoText);
                                  }}
                                  className={`p-1.5 rounded-lg transition-all duration-150 ${
                                    copiedMemoId === memo.id
                                      ? 'text-emerald-400 bg-emerald-500/10 scale-105'
                                      : 'text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-300'
                                  }`}
                                  title={copiedMemoId === memo.id ? "已复制" : "复制"}
                                >
                                  {copiedMemoId === memo.id ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (confirm('确认删除此条备忘吗？')) {
                                      handleDeleteMemo(memo.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Category Selection Dropdown */}
                                <select
                                  value={editingMemoCategory || ''}
                                  onChange={(e) => {
                                    const val = e.target.value || undefined;
                                    setEditingMemoCategory(val);
                                    const card = e.target.closest(`.memo-card-${memo.id}`);
                                    setTimeout(() => {
                                      card?.querySelector('textarea')?.focus();
                                    }, 50);
                                  }}
                                  onBlur={(e) => handleEditMemoBlur(memo.id, e)}
                                  className="text-[10px] bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-355 focus:outline-none"
                                >
                                  <option value="">未分类</option>
                                  {settings.memoCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </div>

                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSaveEditMemo(memo.id);
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-650/80 hover:bg-indigo-600 text-white shadow-lg transition-all text-[10px] font-medium"
                              >
                                保存
                              </button>
                            </div>
                          </>
                        ) : (
                          /* Collapsed Preview View */
                          <>
                            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono mb-1 select-none">
                              <div className="flex items-center space-x-1.5">
                                <span>{memo.timestamp}</span>
                                {selectedCategory === '全部' && memo.category && (
                                  <span className="px-1 py-0.2 rounded text-[8px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                                    {memo.category}
                                  </span>
                                )}
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1.5 transition-all duration-150">
                                <button
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleCopyMemo(memo.id, memo.text);
                                  }}
                                  className={`p-1 transition-colors duration-150 ${
                                    copiedMemoId === memo.id
                                      ? 'text-emerald-400'
                                      : 'text-slate-400 hover:text-indigo-300'
                                  }`}
                                  title="复制"
                                >
                                  {copiedMemoId === memo.id ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (confirm('确认删除此条备忘吗？')) {
                                      handleDeleteMemo(memo.id);
                                    }
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors duration-150"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            
                            <p className="text-xs text-slate-200 truncate select-none leading-relaxed font-sans pr-4 font-medium">
                              {memo.text}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- 6. LOGS TAB VIEW --- */}
        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col p-3.5 overflow-hidden h-full">
            {/* Header info */}
            <div className="space-y-1 border-b border-slate-900 pb-2 shrink-0 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5 font-sans">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>运行日志</span>
                </h2>
                <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                  展示 API 交互详情与错误堆栈。
                </p>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleOpenLogsFolder}
                  className="text-[10px] px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  title="在系统编辑器中打开 logs.txt"
                >
                  打开日志
                </button>
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="text-[10px] px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-red-400 transition-colors"
                  title="清空当前日志文件"
                >
                  清空
                </button>
              </div>
            </div>

            {/* Logs display container */}
            <div className="flex-1 min-h-0 mt-3 flex flex-col">
              <div className="flex-1 bg-slate-950/60 rounded-lg p-2.5 border border-slate-900/80 overflow-y-auto text-[10px] font-mono leading-relaxed select-text pr-1 whitespace-pre-wrap text-slate-350 selection:bg-indigo-500/20">
                {logsContent ? (
                  logsContent
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 text-slate-650 h-full italic">
                    暂无日志内容
                  </div>
                )}
                <div ref={logsBottomRef} />
              </div>
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  );
}
