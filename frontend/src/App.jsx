import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';
const FALLBACK_SOCKET_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : undefined;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE_URL || FALLBACK_SOCKET_URL;
const MAX_CLIENT_FILE_SIZE = 2 * 1024 * 1024;

function JarvisLogo({ size = 34, className = '' }) {
  return (
    <svg
      className={`jarvis-logo ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <polygon className="jarvis-hex-outer" points="50,4 86,25 86,75 50,96 14,75 14,25" />
      <polygon className="jarvis-hex-inner" points="50,18 74,32 74,68 50,82 26,68 26,32" />

      <line className="jarvis-connector" x1="50" y1="50" x2="50" y2="4" />
      <line className="jarvis-connector" x1="50" y1="50" x2="86" y2="25" />
      <line className="jarvis-connector" x1="50" y1="50" x2="86" y2="75" />
      <line className="jarvis-connector" x1="50" y1="50" x2="50" y2="96" />
      <line className="jarvis-connector" x1="50" y1="50" x2="14" y2="75" />
      <line className="jarvis-connector" x1="50" y1="50" x2="14" y2="25" />

      <circle className="jarvis-core-ring" cx="50" cy="50" r="13" />
      <circle className="jarvis-core" cx="50" cy="50" r="8" />
    </svg>
  );
}

function IconAttach() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.2 9.2a6 6 0 01-8.49-8.49l9.2-9.2a4 4 0 015.66 5.66l-9.2 9.2a2 2 0 11-2.83-2.83l8.49-8.49" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
      <path d="M19 11v1a7 7 0 01-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M9 9v3a3 3 0 005.12 2.12" />
      <path d="M15 9V6a3 3 0 00-5.65-1.5" />
      <path d="M19 11v1a7 7 0 01-2.2 5.1" />
      <path d="M5 11v1a7 7 0 007 7" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconNewChat() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      <line x1="12" y1="7" x2="12" y2="13" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  );
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) throw new Error(data?.message || `Request failed: ${res.status}`);
  return data;
}

async function uploadContextFiles(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(`${API_BASE}/api/chat/upload-context`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) throw new Error(data?.message || `Upload failed: ${res.status}`);
  return data;
}

function tokenizeInline(text) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`b-${index}`} className="md-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={`e-${index}`}>{part.slice(1, -1)}</em>;
    }

    if (/^`[^`]+`$/.test(part)) {
      return <code key={`c-${index}`}>{part.slice(1, -1)}</code>;
    }

    return <span key={`t-${index}`}>{part}</span>;
  });
}

function parseMessage(content) {
  const blocks = [];
  const codeRegex = /```([\w-]+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let codeMatch;

  while ((codeMatch = codeRegex.exec(content)) !== null) {
    const textChunk = content.slice(lastIndex, codeMatch.index);
    if (textChunk) blocks.push({ type: 'text', text: textChunk });

    blocks.push({
      type: 'code',
      lang: (codeMatch[1] || 'txt').toUpperCase(),
      code: codeMatch[2].trimEnd(),
    });

    lastIndex = codeRegex.lastIndex;
  }

  const remainingText = content.slice(lastIndex);
  if (remainingText) blocks.push({ type: 'text', text: remainingText });

  const normalized = [];

  blocks.forEach((block) => {
    if (block.type === 'code') {
      normalized.push(block);
      return;
    }

    const lines = block.text.split('\n');

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        normalized.push({ type: 'spacer' });
        return;
      }

      if (trimmed.startsWith('## ')) {
        normalized.push({ type: 'heading', text: trimmed.slice(3) });
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        normalized.push({ type: 'list', text: trimmed.slice(2) });
        return;
      }

      normalized.push({ type: 'paragraph', text: line });
    });
  });

  return normalized;
}

function getDateGroupLabel(dateString) {
  const date = new Date(dateString || Date.now());
  const now = new Date();

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(dayStart);
  yesterdayStart.setDate(dayStart.getDate() - 1);

  if (date >= dayStart) return 'Today';
  if (date >= yesterdayStart) return 'Yesterday';
  return 'Earlier';
}

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [chatError, setChatError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ firstname: '', lastname: '', email: '', password: '' });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [typing, setTyping] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [activeChatId, setActiveChatId] = useState('');
  const [chats, setChats] = useState([]);
  const [messagesByChat, setMessagesByChat] = useState({});

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceActiveRef = useRef(false);

  const activeMessages = useMemo(() => messagesByChat[activeChatId] || [], [messagesByChat, activeChatId]);

  const groupedChats = useMemo(() => {
    const grouped = { Today: [], Yesterday: [], Earlier: [] };
    chats.forEach((chat) => {
      const key = getDateGroupLabel(chat.updatedAt || chat.createdAt || chat.lastActivity);
      grouped[key].push(chat);
    });
    return grouped;
  }, [chats]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [prompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, typing, activeChatId]);

  useEffect(() => {
    voiceActiveRef.current = voiceActive;
  }, [voiceActive]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => setChatError(''));
    socket.on('connect_error', (err) => {
      setTyping(false);
      setChatError(err.message || 'Realtime channel disconnected');
    });

    socket.on('ai-response', (payload) => {
      const chatId = payload?.chat;
      const content = payload?.content;
      if (!chatId || !content) return;

      setMessagesByChat((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), { role: 'assistant', content, at: new Date().toISOString() }],
      }));

      setChats((prev) => prev.map((chat) => (chat._id === chatId ? { ...chat, updatedAt: new Date().toISOString() } : chat)));
      setTyping(false);

      if (voiceActiveRef.current && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(String(content).replace(/```[\s\S]*?```/g, '').slice(0, 1200));
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.lang = 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [user]);

  const fetchChats = useCallback(async () => {
    const data = await apiRequest('/api/chat');
    const list = (data.chats || []).slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    setChats(list);

    if (!activeChatId && list.length > 0) {
      setActiveChatId(list[0]._id);
    }
  }, [activeChatId]);

  const fetchMessages = useCallback(async (chatId) => {
    if (!chatId || messagesByChat[chatId]) return;

    const data = await apiRequest(`/api/chat/${chatId}/messages`);
    const normalized = (data.messages || []).map((message) => ({
      role: message.role === 'model' ? 'assistant' : message.role,
      content: message.content,
      at: message.createdAt,
    }));

    setMessagesByChat((prev) => ({ ...prev, [chatId]: normalized }));
  }, [messagesByChat]);

  useEffect(() => {
    if (!user) return;

    fetchChats().catch((error) => setChatError(error.message || 'Failed to load chats'));
  }, [user, fetchChats]);

  useEffect(() => {
    if (!activeChatId || !user) return;

    fetchMessages(activeChatId).catch((error) => setChatError(error.message || 'Failed to load messages'));
  }, [activeChatId, user, fetchMessages]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError('');
    setChatError('');
    setAuthLoading(true);

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginForm.email.trim(),
          Password: loginForm.password,
        }),
      });

      setUser(data.user || { fullName: { firstname: 'User', lastname: '' }, email: loginForm.email.trim() });
      setChats([]);
      setMessagesByChat({});
      setActiveChatId('');
      setTyping(false);
    } catch (error) {
      setAuthError(error.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setAuthError('');
    setChatError('');
    setAuthLoading(true);

    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: {
            firstname: registerForm.firstname.trim(),
            lastname: registerForm.lastname.trim(),
          },
          email: registerForm.email.trim(),
          Password: registerForm.password,
        }),
      });

      setUser(data.user || {
        fullName: { firstname: registerForm.firstname.trim() || 'User', lastname: registerForm.lastname.trim() || '' },
        email: registerForm.email.trim(),
      });
      setChats([]);
      setMessagesByChat({});
      setActiveChatId('');
      setTyping(false);
    } catch (error) {
      setAuthError(error.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAuthMode('login');
    setAuthError('');
    setChatError('');
    setLoginForm({ email: '', password: '' });
    setRegisterForm({ firstname: '', lastname: '', email: '', password: '' });
    setChats([]);
    setMessagesByChat({});
    setActiveChatId('');
    setTyping(false);
    setPrompt('');
    document.cookie = 'token=; Max-Age=0; path=/';
  };

  const createNewSession = async () => {
    try {
      const data = await apiRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Session' }),
      });

      const chat = data.chat;
      if (!chat?._id) return null;

      setChats((prev) => [chat, ...prev]);
      setMessagesByChat((prev) => ({
        ...prev,
        [chat._id]: [
          {
            role: 'assistant',
            content: '**JARVIS ready, sir.**\n\nState your objective and I shall execute a structured analysis.',
            at: new Date().toISOString(),
          },
        ],
      }));
      setActiveChatId(chat._id);
      setChatError('');

      if (isMobile) setSidebarOpen(false);
      return chat._id;
    } catch (error) {
      setChatError(error.message || 'Failed to create chat');
      return null;
    }
  };

  const sendPrompt = async (overridePrompt) => {
    const rawValue = String(overridePrompt ?? prompt).trim();
    const hasFiles = selectedFiles.length > 0;
    if ((!rawValue && !hasFiles) || typing) return;
    const value = rawValue || 'Please analyze the attached file(s) and describe what you see.';

    let targetChatId = activeChatId;

    if (!targetChatId) {
      targetChatId = await createNewSession();
      if (!targetChatId) return;
    }

    let enrichedPrompt = value;
    let userVisiblePrompt = value;

    if (selectedFiles.length) {
      try {
        const uploadResult = await uploadContextFiles(selectedFiles);
        const fileNames = (uploadResult?.files || []).map((f) => f.fileName).filter(Boolean);
        const context = String(uploadResult?.combinedContext || '').trim();

        if (context) {
          enrichedPrompt = `${enrichedPrompt}\n\nUse this uploaded file context if relevant:\n${context}`;
          userVisiblePrompt = `${userVisiblePrompt}\n\n📎 Files: ${fileNames.join(', ')}`;
        }

        setSelectedFiles([]);
      } catch (error) {
        // Clear stuck file chips so user can retry
        setSelectedFiles([]);
        setChatError(error.message || 'File processing failed — sending message without file context.');
        // Don't block the message if user typed text; only block if message was auto-generated for file-only send
        if (!rawValue) return;
      }
    }

    setMessagesByChat((prev) => ({
      ...prev,
      [targetChatId]: [...(prev[targetChatId] || []), { role: 'user', content: userVisiblePrompt, at: new Date().toISOString() }],
    }));

    setPrompt('');
    setTyping(true);

    try {
      if (!socketRef.current?.connected) {
        throw new Error('Realtime channel not connected');
      }

      socketRef.current.emit('ai-message', { prompt: enrichedPrompt, chat: targetChatId });

      setChats((prev) =>
        prev
          .map((chat) =>
            chat._id === targetChatId
              ? {
                  ...chat,
                  title: chat.title === 'New Session' ? (value.length > 36 ? `${value.slice(0, 36)}...` : value) : chat.title,
                  updatedAt: new Date().toISOString(),
                }
              : chat
          )
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      );
    } catch (error) {
      setTyping(false);
      setChatError(error.message || 'Failed to send prompt');
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const oversized = files.find((file) => file.size > MAX_CLIENT_FILE_SIZE);

    if (oversized) {
      setChatError(`File too large: ${oversized.name}. Max size is 2MB.`);
      event.target.value = '';
      return;
    }

    if (files.length) {
      setChatError('');
      setSelectedFiles((prev) => [...prev, ...files].slice(0, 5));
    }

    event.target.value = '';
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleVoiceMode = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setChatError('Voice input is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    if (voiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = async (event) => {
      const transcript = Array.from(event.results)
        .filter((r) => r.isFinal)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();

      if (!transcript) return;
      await sendPrompt(transcript);
    };

    recognition.onerror = (event) => {
      setChatError(`Voice error: ${event.error || 'unknown'}`);
      setVoiceActive(false);
    };

    recognition.onend = () => {
      if (!voiceActiveRef.current) return;
      try {
        recognition.start();
      } catch {
        // no-op
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setChatError('');
    setVoiceActive(true);
  };

  const handleTextareaKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendPrompt();
    }
  };

  const renderParsedBlock = (block, index) => {
    if (block.type === 'spacer') return <div key={`s-${index}`} className="md-spacer" />;

    if (block.type === 'heading') {
      return (
        <h3 key={`h-${index}`} className="md-heading">
          {tokenizeInline(block.text)}
        </h3>
      );
    }

    if (block.type === 'list') {
      return (
        <div key={`l-${index}`} className="md-list-item">
          <span className="md-list-bullet">›</span>
          <span>{tokenizeInline(block.text)}</span>
        </div>
      );
    }

    if (block.type === 'code') {
      return (
        <div key={`code-${index}`} className="md-code-wrap">
          <div className="md-code-head">
            <span>{block.lang}</span>
            <button
              className="copy-btn"
              type="button"
              onClick={() => navigator.clipboard?.writeText(block.code)}
            >
              Copy
            </button>
          </div>
          <pre className="md-code-pre">
            <code>{block.code}</code>
          </pre>
        </div>
      );
    }

    return (
      <p key={`p-${index}`} className="md-p">
        {tokenizeInline(block.text)}
      </p>
    );
  };

  const firstName = user?.fullName?.firstname || 'Swatantra';
  const lastName = user?.fullName?.lastname || 'Tripathi';
  const initials = `${firstName[0] || 'S'}${lastName[0] || 'T'}`.toUpperCase();

  if (!user) {
    return (
      <div className="auth-root">
        <div className="auth-card">
          <div className="auth-brand">
            <JarvisLogo size={42} />
            <div>
              <h1>JARVIS</h1>
              <p>Secure Access Protocol</p>
            </div>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
            >
              Register
            </button>
          </div>

          {authError && <div className="auth-error">{authError}</div>}

          {authMode === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                  placeholder="you@example.com"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  placeholder="••••••••"
                />
              </label>

              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? 'Authenticating...' : 'Enter Command Deck'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="split-inputs">
                <label>
                  First Name
                  <input
                    value={registerForm.firstname}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, firstname: event.target.value }))}
                    required
                    placeholder="Swatantra"
                  />
                </label>

                <label>
                  Last Name
                  <input
                    value={registerForm.lastname}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, lastname: event.target.value }))}
                    required
                    placeholder="Tripathi"
                  />
                </label>
              </div>

              <label>
                Email
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                  placeholder="you@example.com"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  minLength={6}
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  placeholder="Create secure password"
                />
              </label>

              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? 'Creating account...' : 'Initialize JARVIS Access'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {isMobile && sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sidebar ${isMobile ? 'mobile' : ''} ${sidebarOpen ? 'show' : ''}`}>
          <div className="sidebar-top">
            <div className="brand-block">
              <JarvisLogo size={34} />
              <div>
                <p className="brand-title">JARVIS</p>
                <p className="brand-sub">
                  <span className="online-dot" /> ONLINE
                </p>
              </div>
            </div>

            <button type="button" className="new-session-btn" onClick={createNewSession}>
              <span className="plus">+</span>
              New Session
            </button>
          </div>

          <div className="chat-groups">
            {['Today', 'Yesterday', 'Earlier'].map((group) => {
              const groupChats = groupedChats[group] || [];
              if (!groupChats.length) return null;

              return (
                <div key={group} className="chat-group">
                  <p className="grp-label">{group}</p>
                  {groupChats.map((chat) => (
                    <button
                      key={chat._id}
                      className={`chat-item ${activeChatId === chat._id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveChatId(chat._id);
                        if (isMobile) setSidebarOpen(false);
                      }}
                    >
                      {chat.title}
                    </button>
                  ))}
                </div>
              );
            })}
            {!chats.length && <p className="chat-empty">No saved sessions yet</p>}
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">{initials}</div>
            <div>
              <p className="user-name">{firstName} {lastName}</p>
              <p className="user-role">Authorized User</p>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout" type="button">⎋</button>
          </div>
        </aside>

        <main className="main-panel">
          <header className="topbar">
            <div className="topbar-left">
              <button type="button" className="icon-btn" onClick={() => setSidebarOpen((v) => !v)}>
                <IconMenu />
              </button>
              <span className="pulse-dot" />
              <p className="top-title">JARVIS</p>
              <span className="mtag">Advanced</span>
            </div>

            <button type="button" className="icon-btn" onClick={createNewSession} title="New chat">
              <IconNewChat />
            </button>
          </header>

          {chatError && <div className="chat-error">{chatError}</div>}

          <section className="messages-wrap">
            <div className="messages-inner">
              {!activeChatId && (
                <div className="chat-empty-main">
                  <JarvisLogo size={48} />
                  <p>Create a new session to start chatting.</p>
                </div>
              )}

              {activeMessages.map((message, index) => {
                const parsed = parseMessage(message.content);
                const isUser = message.role === 'user';

                return (
                  <div key={`${message.role}-${index}-${message.at || ''}`} className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
                    {!isUser && (
                      <div className="msg-avatar assistant">
                        <JarvisLogo size={28} />
                      </div>
                    )}

                    {isUser ? (
                      <>
                        <div className="user-bubble">{parsed.map(renderParsedBlock)}</div>
                        <div className="msg-avatar user">{initials}</div>
                      </>
                    ) : (
                      <div className="assistant-plain">{parsed.map(renderParsedBlock)}</div>
                    )}
                  </div>
                );
              })}

              {typing && (
                <div className="msg-row assistant">
                  <div className="msg-avatar assistant">
                    <JarvisLogo size={28} />
                  </div>
                  <div className="typing-bubble">
                    <span className="typing-dot d1" />
                    <span className="typing-dot d2" />
                    <span className="typing-dot d3" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </section>

          <footer className="input-footer">
            <div className="input-shell">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={handleFileSelect}
              />

              {selectedFiles.length > 0 && (
                <div className="file-chips">
                  {selectedFiles.map((file, idx) => (
                    <span className="file-chip" key={`${file.name}-${idx}`}>
                      {file.name}
                      <button type="button" onClick={() => removeFile(idx)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="input-row">
                <div className="left-tools">
                  <button type="button" className="tool-icon tool-btn" onClick={() => fileInputRef.current?.click()} title="Attach files">
                    <IconAttach />
                  </button>
                  <button type="button" className={`tool-icon tool-btn ${voiceActive ? 'active' : ''}`} onClick={toggleVoiceMode} title="Toggle voice chat">
                    {voiceActive ? <IconMicOff /> : <IconMic />}
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  className="prompt-input"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Speak your command, sir..."
                  rows={1}
                />

                <button
                  type="button"
                  className={`send-btn ${(prompt.trim() || selectedFiles.length > 0) && !typing ? 'active' : ''}`}
                  onClick={sendPrompt}
                  disabled={(!prompt.trim() && selectedFiles.length === 0) || typing}
                >
                  ➤
                </button>
              </div>
            </div>

            <p className="disclaimer">JARVIS may make errors. Always verify critical information.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
