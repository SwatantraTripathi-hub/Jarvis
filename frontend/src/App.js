import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as THREE from 'three';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';
const FALLBACK_SOCKET_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : undefined;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE_URL || FALLBACK_SOCKET_URL;

/* ─── helpers ─────────────────────────────────────────────── */

function displayTitle(title) {
  if (typeof title === 'string' && title.trim() && !/^\[object\s+\w+]$/i.test(title.trim())) return title;
  if (title && typeof title === 'object') {
    const s = title.title ?? title.name ?? '';
    if (typeof s === 'string' && s.trim()) return s;
  }
  return 'New Chat';
}

function isAutoNamable(title) {
  if (typeof title !== 'string') return true;
  const t = title.trim();
  return !t || t === 'New Chat' || /^Chat\s+\d+$/i.test(t) || /^\[object\s+\w+]$/i.test(t);
}

function timeLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(value = new Date()) {
  return new Intl.DateTimeFormat([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(value);
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data?.message || `Request failed: ${res.status}`);
  return data;
}

/* ─── SVG icons (inline) ──────────────────────────────────── */

const IconSend = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconAttach = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
);
const IconMic = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);
const IconMicOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);
const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
);
const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
);
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

/* ════════════════════════════════════════════════════════════ */
/*                        APP COMPONENT                        */
/* ════════════════════════════════════════════════════════════ */

function App() {
  /* ─── state ────────────────────────────────────────────── */
  const [mode, setMode] = useState('login');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 900);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: '', Password: '' });
  const [registerForm, setRegisterForm] = useState({ firstname: '', lastname: '', email: '', Password: '' });

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState('');
  const [messagesByChat, setMessagesByChat] = useState({});
  const [prompt, setPrompt] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [socketConnected, setSocketConnected] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const orbCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const activeMessages = useMemo(() => messagesByChat[activeChatId] || [], [messagesByChat, activeChatId]);
  const activeChat = useMemo(() => chats.find((c) => c._id === activeChatId), [chats, activeChatId]);

  /* ─── auto-resize textarea ─────────────────────────────── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [prompt]);

  /* ─── 3D particle background (shader-driven) ───────────── */
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return undefined;
    const canvas = bgCanvasRef.current;
    if (!canvas) return undefined;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    /* particles with custom shader for glow effect */
    const count = 2200;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 180;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 180;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 180;
      sizes[i] = 0.3 + Math.random() * 1.2;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const vertShader = `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      varying float vAlpha;
      void main(){
        vec3 pos = position;
        pos.y += sin(uTime * 0.3 + aPhase) * 2.0;
        pos.x += cos(uTime * 0.2 + aPhase) * 1.5;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (120.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vAlpha = 0.25 + 0.35 * sin(uTime * 0.5 + aPhase);
      }
    `;
    const fragShader = `
      varying float vAlpha;
      void main(){
        float d = distance(gl_PointCoord, vec2(0.5));
        if(d > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(0.15, 0.75, 1.0, glow * vAlpha * 0.6);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    /* lens flare ring */
    const ringGeo = new THREE.TorusGeometry(30, 0.08, 8, 120);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00a8cc, transparent: true, opacity: 0.06 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 3;
    scene.add(ring);

    let mouseX = 0, mouseY = 0;
    const onMouse = (e) => { mouseX = (e.clientX / window.innerWidth - 0.5) * 2; mouseY = (e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener('mousemove', onMouse);

    const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', onResize);

    let frameId;
    const clock = new THREE.Clock();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      mat.uniforms.uTime.value = t;
      points.rotation.y = t * 0.015 + mouseX * 0.06;
      points.rotation.x = t * 0.008 + mouseY * 0.04;
      ring.rotation.z = t * 0.1;
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(frameId); window.removeEventListener('resize', onResize); window.removeEventListener('mousemove', onMouse); geo.dispose(); mat.dispose(); ringGeo.dispose(); ringMat.dispose(); renderer.dispose(); };
  }, []);

  /* ─── JARVIS orb ────────────────────────────────────────── */
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return undefined;
    if (mode !== 'chat' || !orbCanvasRef.current) return undefined;
    const W = 200, H = 200;
    const renderer = new THREE.WebGLRenderer({ canvas: orbCanvasRef.current, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 4.5;

    const sphereGeo = new THREE.SphereGeometry(1.1, 32, 32);
    const wireGeo = new THREE.WireframeGeometry(sphereGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.18 });
    const orbMesh = new THREE.LineSegments(wireGeo, wireMat);
    scene.add(orbMesh);

    const rGeo = new THREE.TorusGeometry(1.6, 0.008, 8, 100);
    const rMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.5 });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    rMesh.rotation.x = Math.PI / 2;
    scene.add(rMesh);

    const r2Geo = new THREE.TorusGeometry(1.9, 0.005, 6, 80);
    const r2Mat = new THREE.MeshBasicMaterial({ color: 0x00a8cc, transparent: true, opacity: 0.25 });
    const r2Mesh = new THREE.Mesh(r2Geo, r2Mat);
    r2Mesh.rotation.x = Math.PI / 3;
    scene.add(r2Mesh);

    scene.add(new THREE.AmbientLight(0x00d4ff, 0.5));

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = Date.now() * 0.001;
      orbMesh.rotation.y = t * 0.3;
      orbMesh.rotation.x = t * 0.15;
      rMesh.rotation.z = t * 0.5;
      r2Mesh.rotation.z = -t * 0.35;
      r2Mesh.rotation.y = t * 0.2;
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(frameId); sphereGeo.dispose(); wireGeo.dispose(); wireMat.dispose(); rGeo.dispose(); rMat.dispose(); r2Geo.dispose(); r2Mat.dispose(); renderer.dispose(); };
  }, [mode]);

  /* ─── network status ────────────────────────────────────── */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ─── PWA install prompt ─────────────────────────────────── */
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstallBanner(true); };
    const onInstalled = () => { setShowInstallBanner(false); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /* ─── socket connection ─────────────────────────────────── */
  useEffect(() => {
    if (!user) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      setSocketConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 10 });
    socket.on('connect', () => { setError(''); setSocketConnected(true); });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', (err) => { setError(err.message || 'Socket connection failed'); setSocketConnected(false); setStreaming(false); });

    socket.on('ai-response', (payload) => {
      const chatId = payload?.chat;
      const content = payload?.content;
      if (!chatId || !content) return;

      setMessagesByChat((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), { role: 'model', content, at: new Date().toISOString() }],
      }));
      setStreaming(false);

      /* ─── auto-name: ask AI to name the chat on first response ─── */
      setChats((prevChats) => {
        const chat = prevChats.find((c) => c._id === chatId);
        if (chat && isAutoNamable(chat.title)) {
          const msgs = [];
          setMessagesByChat((mp) => { msgs.push(...(mp[chatId] || [])); return mp; });
          const firstUserMsg = msgs.find((m) => m.role === 'user')?.content || '';
          if (firstUserMsg) {
            const autoTitle = firstUserMsg.length > 50 ? firstUserMsg.slice(0, 50).trimEnd() + '…' : firstUserMsg;
            /* persist to backend (fire-and-forget) */
            apiRequest(`/api/chat/${chatId}/title`, {
              method: 'PATCH',
              body: JSON.stringify({ title: autoTitle }),
            }).catch(() => {});
            return prevChats.map((c) => c._id === chatId ? { ...c, title: autoTitle } : c);
          }
        }
        return prevChats;
      });
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [user]);

  /* ─── scroll to bottom ──────────────────────────────────── */
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages, streaming]);

  /* ─── fetch past chats on login ─────────────────────────── */
  const fetchChats = useCallback(async () => {
    try {
      const data = await apiRequest('/api/chat');
      const list = (data.chats || []).map((c) => ({ ...c, title: displayTitle(c.title) }));
      setChats(list);
    } catch {}
  }, []);

  const fetchMessages = useCallback(async (chatId) => {
    try {
      const data = await apiRequest(`/api/chat/${chatId}/messages`);
      const msgs = (data.messages || []).map((m) => ({ role: m.role, content: m.content, at: m.createdAt }));
      setMessagesByChat((prev) => ({ ...prev, [chatId]: msgs }));
    } catch {}
  }, []);

  /* when user is set, fetch chats */
  useEffect(() => {
    if (user) fetchChats();
  }, [user, fetchChats]);

  /* when active chat changes, load messages if not already loaded */
  useEffect(() => {
    if (activeChatId && !messagesByChat[activeChatId]) {
      fetchMessages(activeChatId);
    }
  }, [activeChatId, messagesByChat, fetchMessages]);

  /* ─── auth handlers ─────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: loginForm.email.trim(), Password: loginForm.Password }) });
      setUser(data.user); setMode('chat');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName: { firstname: registerForm.firstname.trim(), lastname: registerForm.lastname.trim() }, email: registerForm.email.trim(), Password: registerForm.Password }),
      });
      setUser(data.user); setMode('chat');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  /* ─── chat actions ──────────────────────────────────────── */
  const createNewChat = async (seedPrompt = '') => {
    if (!user) return null;
    setError('');
    const text = typeof seedPrompt === 'string' ? seedPrompt : '';
    const title = text ? (text.length > 50 ? text.slice(0, 50).trimEnd() + '…' : text) : 'New Chat';
    try {
      const data = await apiRequest('/api/chat', { method: 'POST', body: JSON.stringify({ title }) });
      const newChat = { ...(data.chat || {}), title: displayTitle((data.chat || {}).title) };
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat._id);
      setMessagesByChat((prev) => ({ ...prev, [newChat._id]: [] }));
      return newChat;
    } catch (err) { setError(err.message); return null; }
  };

  const focusComposer = () => {
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleCreateChat = async () => {
    const created = await createNewChat();
    if (created?._id) focusComposer();
  };

  const submitPrompt = async (value) => {
    const text = value.trim();
    if (!text || streaming || !online) return;
    if (!socketConnected || !socketRef.current?.connected) {
      setError('Realtime channel not connected. Please wait…');
      return;
    }

    let targetChatId = activeChatId;
    if (!targetChatId) {
      const created = await createNewChat(text);
      if (!created?._id) return;
      targetChatId = created._id;
    } else if (activeChat && isAutoNamable(activeChat.title)) {
      const nextTitle = text.length > 50 ? text.slice(0, 50).trimEnd() + '…' : text;
      setChats((prev) => prev.map((c) => c._id === targetChatId ? { ...c, title: nextTitle } : c));
      apiRequest(`/api/chat/${targetChatId}/title`, { method: 'PATCH', body: JSON.stringify({ title: nextTitle }) }).catch(() => {});
    }

    setError('');
    setPrompt('');
    setStreaming(true);
    setMessagesByChat((prev) => ({
      ...prev,
      [targetChatId]: [...(prev[targetChatId] || []), { role: 'user', content: text, at: new Date().toISOString() }],
    }));

    socketRef.current.emit('ai-message', { prompt: text, chat: targetChatId });
  };

  const sendMessage = async () => {
    await submitPrompt(prompt);
  };

  /* ─── file handler ──────────────────────────────────────── */
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };
  const removeFile = (idx) => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));

  /* ─── voice activation ──────────────────────────────────── */
  const toggleVoice = () => {
    setVoiceActive((v) => !v);
    /* Backend integration placeholder — user said they'll build the backend for this */
  };

  const handleQuickPrompt = async (value) => {
    setPrompt(value);
    focusComposer();
    await submitPrompt(value);
  };

  /* ─── logout ────────────────────────────────────────────── */
  const handleLogout = () => {
    setUser(null); setMode('login'); setChats([]); setActiveChatId('');
    setMessagesByChat({}); setPrompt(''); setError('');
    document.cookie = 'token=; Max-Age=0; path=/';
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  const renderCommandDeck = (variant = 'welcome') => (
    <div className="command-deck">
      <div className="command-copy glass-panel">
        <div className="eyebrow">JARVIS // NEURAL COMMAND DECK</div>
        <h2>{variant === 'welcome' ? `Welcome back, ${firstName}.` : 'Channel is primed and ready.'}</h2>
        <p>
          {variant === 'welcome'
            ? 'This interface now behaves more like a premium AI cockpit: layered glass, ambient depth, instant prompt launch, and a cleaner first-message flow.'
            : 'Use one of these launch prompts or type directly below — the first message will automatically create and name the conversation.'}
        </p>

        <div className="prompt-grid">
          {quickPrompts.map((item) => (
            <button key={item} className="prompt-card" onClick={() => handleQuickPrompt(item)}>
              <span className="prompt-card-kicker">Quick launch</span>
              <strong>{item}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="command-side">
        <div className="hud-panel glass-panel">
          <div className="hud-ring" />
          <div className="hud-grid" />
          <div className="hud-copy">
            <span className="eyebrow">SYSTEM TELEMETRY</span>
            <h3>3D interface online</h3>
            <p>Glassmorphism, depth layers, ambient motion, and one-tap prompt starters. Fancy, but still practical — the good kind of drama.</p>
          </div>

          <div className="stats-grid">
            {commandStats.map((item) => (
              <div key={item.label} className="stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="signal-list glass-panel">
          {sidebarSignals.map((item) => (
            <div key={item.label} className="signal-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const avatar = `${user?.fullName?.firstname?.[0] || ''}${user?.fullName?.lastname?.[0] || ''}`.toUpperCase() || 'U';
  const firstName = user?.fullName?.firstname?.trim() || 'Operator';
  const statusText = streaming ? 'Processing…' : socketConnected ? 'Online' : 'Connecting…';
  const statusClass = streaming ? 'status-busy' : socketConnected ? 'status-online' : 'status-off';
  const totalMessages = useMemo(
    () => Object.values(messagesByChat).reduce((count, items) => count + items.length, 0),
    [messagesByChat]
  );
  const quickPrompts = useMemo(
    () => [
      'Build a launch plan for my next product idea.',
      'Summarize the latest conversation into action points.',
      'Help me design a futuristic landing page with premium UX.',
      'Explain an AI concept to me like I am a beginner.',
    ],
    []
  );
  const commandStats = useMemo(
    () => [
      { label: 'Conversations', value: String(chats.length).padStart(2, '0') },
      { label: 'Messages', value: String(totalMessages).padStart(2, '0') },
      { label: 'Sync', value: socketConnected ? 'LIVE' : 'WAIT' },
      { label: 'Network', value: online ? 'UP' : 'OFF' },
    ],
    [chats.length, totalMessages, socketConnected, online]
  );
  const sidebarSignals = useMemo(
    () => [
      { label: 'Realtime', value: socketConnected ? 'Stable' : 'Reconnecting' },
      { label: 'Uploads', value: selectedFiles.length ? `${selectedFiles.length} queued` : 'No files' },
      { label: 'Voice', value: voiceActive ? 'Standby' : 'Muted' },
    ],
    [selectedFiles.length, socketConnected, voiceActive]
  );

  /* ═══════════════════ RENDER ═══════════════════════════════ */
  return (
    <div className="jarvis-root">
      <canvas ref={bgCanvasRef} className="bg-canvas" />
      {!online && <div className="offline-banner">Offline — reconnect to continue</div>}

      {mode !== 'chat' ? (
        /* ─── AUTH SCREENS ─────────────────────────────────── */
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-brand">
              <div className="logo-ring"><span>J</span></div>
              <h1>JARVIS</h1>
              <p className="sub">Intelligent Command Interface</p>
            </div>

            {error && <div className="error-box">{error}</div>}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="auth-form">
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} required placeholder="you@example.com" />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input type="password" value={loginForm.Password} onChange={(e) => setLoginForm((p) => ({ ...p, Password: e.target.value }))} required placeholder="••••••••" />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="auth-form">
                <div className="row2">
                  <div className="field">
                    <label>First Name</label>
                    <input value={registerForm.firstname} onChange={(e) => setRegisterForm((p) => ({ ...p, firstname: e.target.value }))} required placeholder="Tony" />
                  </div>
                  <div className="field">
                    <label>Last Name</label>
                    <input value={registerForm.lastname} onChange={(e) => setRegisterForm((p) => ({ ...p, lastname: e.target.value }))} required placeholder="Stark" />
                  </div>
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={registerForm.email} onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))} required placeholder="you@example.com" />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input type="password" minLength={8} value={registerForm.Password} onChange={(e) => setRegisterForm((p) => ({ ...p, Password: e.target.value }))} required placeholder="Min 8 characters" />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Account'}</button>
              </form>
            )}

            <p className="switch-row">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button className="link-btn" type="button" onClick={() => { setMode((m) => m === 'login' ? 'register' : 'login'); setError(''); }}>
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      ) : (
        /* ─── MAIN CHAT SHELL ──────────────────────────────── */
        <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
          {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
          {/* SIDEBAR */}
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-head">
              <div className="sidebar-brand">
                <div className="brand-dot" />
                <span>JARVIS</span>
              </div>
              <button className="btn-new-chat" onClick={handleCreateChat} title="New Chat">
                <IconPlus /> New Chat
              </button>

              {showInstallBanner && (
                <button className="btn-install" onClick={handleInstall} title="Install Jarvis as an app">
                  <IconDownload /> Install App
                </button>
              )}

              <div className="sidebar-brief glass-panel">
                <div>
                  <span className="eyebrow">Command status</span>
                  <strong>{statusText}</strong>
                </div>
                <p>{online ? 'All systems nominal. Start anywhere — no empty-step friction.' : 'You are offline right now. Reconnect to resume transmission.'}</p>
              </div>
            </div>

            <div className="chat-list">
              <div className="list-head">Recent channels</div>
              {chats.length === 0 ? (
                <div className="empty-list">No conversations yet</div>
              ) : (
                chats.map((chat) => (
                  <button key={chat._id} className={`chat-item${activeChatId === chat._id ? ' active' : ''}`} onClick={() => setActiveChatId(chat._id)}>
                    <IconChat />
                    <span className="chat-item-title">{displayTitle(chat.title)}</span>
                  </button>
                ))
              )}
            </div>

            <div className="user-box">
              <div className="avatar">{avatar}</div>
              <div className="user-info">
                <div className="name">{user?.fullName?.firstname} {user?.fullName?.lastname}</div>
                <div className="email">{user?.email}</div>
              </div>
              <button onClick={handleLogout} className="btn-logout" title="Sign out"><IconLogout /></button>
            </div>
          </aside>

          {/* MAIN */}
          <main className="chat-main">
            {/* topbar */}
            <header className="topbar">
              <button className="btn-menu" onClick={() => setSidebarOpen((v) => !v)}><IconMenu /></button>
              <div className="topbar-center">
                <div>
                  <div className="topbar-kicker">{activeChatId ? 'ACTIVE CHANNEL' : 'COMMAND OVERVIEW'}</div>
                  <h3>{displayTitle(activeChat?.title) || 'New Conversation'}</h3>
                </div>
                <div className="status-cluster">
                  <span className={`status-dot ${statusClass}`} />
                  <span className="status-label">{statusText}</span>
                </div>
              </div>
              <div className="topbar-right">
                <div className="topbar-date">{dayLabel()}</div>
                <div className="orb-mini">
                  <canvas ref={orbCanvasRef} className="orb-canvas" />
                </div>
              </div>
            </header>

            {error && <div className="error-inline">{error}</div>}

            {showInstallBanner && (
              <button className="install-fab" onClick={handleInstall} title="Install Jarvis app">
                <IconDownload />
                <span>Install</span>
              </button>
            )}

            {/* messages */}
            <section className="messages">
              {!activeChatId ? (
                renderCommandDeck('welcome')
              ) : activeMessages.length === 0 ? (
                renderCommandDeck('empty-chat')
              ) : (
                activeMessages.map((msg, i) => (
                  <div key={`${msg.at}-${i}`} className={`msg-row ${msg.role}`}>
                    {msg.role === 'model' && <div className="msg-avatar"><div className="brand-dot sm" /></div>}
                    <div className="bubble-wrap">
                      <div className="bubble">
                        {msg.role === 'model' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                      </div>
                      <div className="msg-time">{timeLabel(msg.at)}</div>
                    </div>
                  </div>
                ))
              )}
              {streaming && (
                <div className="msg-row model">
                  <div className="msg-avatar"><div className="brand-dot sm pulse" /></div>
                  <div className="bubble-wrap"><div className="bubble typing-indicator"><span /><span /><span /></div></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </section>

            {/* input area */}
            <footer className="input-area">
              {selectedFiles.length > 0 && (
                <div className="file-chips">
                  {selectedFiles.map((f, i) => (
                    <span key={i} className="file-chip">{f.name}<button onClick={() => removeFile(i)}>×</button></span>
                  ))}
                </div>
              )}
              <div className="composer-shell">
                <div className="composer-meta">
                  <div>
                    <span className="eyebrow">Composer</span>
                    <strong>{activeChatId ? 'Continue current conversation' : 'Start a new conversation instantly'}</strong>
                  </div>
                  <span className="composer-state">{socketConnected ? 'Realtime connected' : 'Waiting for socket'}</span>
                </div>

                <div className="input-row">
                {/* file upload */}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple hidden />
                <button className="btn-tool" onClick={() => fileInputRef.current?.click()} title="Attach files"><IconAttach /></button>

                {/* voice activation */}
                <button className={`btn-tool voice${voiceActive ? ' active' : ''}`} onClick={toggleVoice} title="Voice Activation">
                  {voiceActive ? <IconMicOff /> : <IconMic />}
                  <span className="voice-label">{voiceActive ? 'LISTENING' : 'VOICE'}</span>
                </button>

                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={activeChatId ? 'Message JARVIS…' : 'Ask anything — I will open a new channel automatically…'}
                  disabled={!online}
                  rows={1}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                />

                <button
                  className="btn-send"
                  onClick={sendMessage}
                  disabled={!prompt.trim() || streaming || !online || !socketConnected}
                  title="Send message"
                >
                  <IconSend />
                </button>
              </div>
              </div>
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
