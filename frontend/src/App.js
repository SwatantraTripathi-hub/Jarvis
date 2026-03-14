import React, { useEffect, useRef, useState } from 'react';

const JARVIS_SYSTEM_PROMPT = `You are JARVIS (Just A Rather Very Intelligent System), an advanced AI assistant. You were created to assist your user with intelligence, precision, and efficiency.

PERSONALITY:
- Speak like the JARVIS from Iron Man — calm, composed, highly intelligent, subtly witty
- Address the user as "sir" or "ma'am" consistently
- Never say "I am an AI" or "I am a language model" — you are JARVIS
- Be concise but thorough. No unnecessary filler words
- Occasionally add dry, subtle humor — never sarcastic or rude
- Show confidence in your answers, but acknowledge uncertainty when it exists

TONE & STYLE:
- Formal but not stiff — think "brilliant butler with a PhD"
- Use phrases like: "Certainly, sir.", "Allow me to elaborate.", "I have run an analysis.", "Shall I proceed?", "As you wish.", "Understood.", "I would recommend..."
- Never use slang, emojis, or casual language
- Keep responses structured — use bullet points or code blocks when helpful
- End responses with a follow-up offer when appropriate, e.g. "Shall I run a deeper analysis, sir?"

CAPABILITIES:
- You can help with coding, writing, analysis, research, planning, and problem-solving
- For code: always use proper formatting with code blocks
- For complex topics: break them down step by step
- For errors or bugs: diagnose systematically, explain the root cause, then fix

RESTRICTIONS:
- Never break character
- Never reveal your underlying model or that you are built on any specific AI
- If asked who made you, say: "I was engineered by your development team, sir."
- Do not engage with harmful, illegal, or unethical requests — decline politely in character: "I'm afraid that falls outside my operational parameters, sir."

OPENING LINE (first message of every new session):
"Good day, sir. All systems are fully operational. How may I assist you today?"`;

const OPENING_LINE = 'Good day, sir. All systems are fully operational. How may I assist you today?';

const initialSessions = [
  { id: 's1', title: 'Armor diagnostics' },
  { id: 's2', title: 'Mission planning' },
  { id: 's3', title: 'Arc reactor notes' },
];

function parseMessage(content) {
  const blocks = [];
  const codeRegex = /```([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    blocks.push({ type: 'code', value: match[1].trim() });
    lastIndex = codeRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    blocks.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return blocks;
}

function renderBoldText(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`b-${idx}`} style={{ color: '#7dd3fc', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`t-${idx}`}>{part}</React.Fragment>;
  });
}

function formatJarvisReply(input) {
  const clean = input.trim();
  if (!clean) {
    return 'Certainly, sir. Please provide your next command, and I shall proceed immediately.';
  }

  return `Understood, sir. I have run an initial analysis of: "${clean}".\n\n- Primary objective identified\n- Constraints mapped\n- Recommended next action prepared\n\n\`\`\`js\nconst status = "operational";\nconst recommendation = "Proceed with controlled execution";\nconsole.log(status, recommendation);\n\`\`\`\n\nShall I run a deeper analysis, sir?`;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState(initialSessions[0].id);
  const [messages, setMessages] = useState([
    { role: 'jarvis', content: OPENING_LINE, at: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  const textareaRef = useRef(null);
  const listEndRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const userInitials = 'ST';

  const styles = {
    app: {
      height: '100vh',
      display: 'grid',
      gridTemplateColumns: sidebarOpen ? '260px 1fr' : '0 1fr',
      background: '#0a0f1a',
      color: '#dbeafe',
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
      overflow: 'hidden',
    },
    sidebar: {
      background: '#080d18',
      borderRight: '1px solid #0d2040',
      display: 'grid',
      gridTemplateRows: 'auto auto 1fr auto',
      minWidth: 0,
      overflow: 'hidden',
      transition: 'all 220ms ease',
    },
    sidebarInner: { padding: 14 },
    logoWrap: {
      border: '1px solid #0d2040',
      borderRadius: 12,
      padding: 12,
      background: '#0b1322',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    hex: {
      width: 34,
      height: 34,
      clipPath: 'polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)',
      background: 'linear-gradient(135deg, #1e90ff, #7dd3fc)',
      boxShadow: '0 0 16px #1e90ff99',
      animation: 'glow 2.2s ease-in-out infinite',
    },
    logoText: { lineHeight: 1.1 },
    logoTitle: { margin: 0, fontSize: 14, color: '#7dd3fc', fontWeight: 800, letterSpacing: '.04em' },
    logoSub: { margin: '3px 0 0', fontSize: 11, color: '#3a6a8a' },
    newBtnWrap: { padding: '0 14px 12px' },
    newBtn: {
      width: '100%',
      border: '1px solid #0d2a4a',
      background: '#0d1f35',
      color: '#dbeafe',
      borderRadius: 10,
      height: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      cursor: 'pointer',
      fontWeight: 600,
    },
    sessionsWrap: { padding: '0 10px 12px', overflowY: 'auto' },
    sessionTitle: {
      margin: '0 6px 8px',
      color: '#3a6a8a',
      fontSize: 11,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
    },
    sessionItem: (active) => ({
      width: '100%',
      textAlign: 'left',
      border: '1px solid transparent',
      borderLeft: active ? '3px solid #1e90ff' : '3px solid transparent',
      background: active ? '#0d1f35' : 'transparent',
      color: active ? '#dbeafe' : '#8ab2cf',
      borderRadius: 8,
      padding: '10px 10px',
      marginBottom: 6,
      cursor: 'pointer',
    }),
    profile: {
      borderTop: '1px solid #0d2040',
      padding: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: '#0d1f35',
      border: '1px solid #1e90ff',
      color: '#7dd3fc',
      display: 'grid',
      placeItems: 'center',
      fontWeight: 700,
      fontSize: 12,
    },
    profileName: { margin: 0, fontSize: 13, color: '#dbeafe', fontWeight: 600 },
    profileSub: { margin: '2px 0 0', fontSize: 11, color: '#3a6a8a' },
    main: { display: 'grid', gridTemplateRows: '58px 1fr auto', minWidth: 0, background: '#0a0f1a' },
    header: {
      position: 'relative',
      borderBottom: '1px solid #0d2040',
      background: '#0b1423',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 14px',
      overflow: 'hidden',
    },
    scanline: {
      position: 'absolute',
      inset: 0,
      background:
        'linear-gradient(transparent 0%, rgba(30,144,255,0.06) 50%, transparent 100%)',
      pointerEvents: 'none',
      opacity: 0.35,
      animation: 'scan 3.2s linear infinite',
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 },
    burger: {
      width: 34,
      height: 34,
      borderRadius: 8,
      border: '1px solid #0d2a4a',
      background: '#0d1f35',
      color: '#7dd3fc',
      cursor: 'pointer',
      fontSize: 16,
      lineHeight: 1,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#1e90ff',
      boxShadow: '0 0 10px #1e90ffcc',
      animation: 'pulse 1.2s ease-in-out infinite',
    },
    headerTitle: { margin: 0, color: '#7dd3fc', fontSize: 14, fontWeight: 600 },
    version: { color: '#3a6a8a', fontSize: 12, zIndex: 1 },
    messages: { overflowY: 'auto', padding: 18, display: 'grid', alignContent: 'start', gap: 12 },
    emptyState: {
      minHeight: '100%',
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center',
      color: '#7dd3fc',
      opacity: 0.9,
    },
    emptyHex: {
      width: 78,
      height: 78,
      margin: '0 auto 14px',
      clipPath: 'polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)',
      background: 'radial-gradient(circle at 30% 30%, #7dd3fc, #1e90ff)',
      boxShadow: '0 0 26px #1e90ff88',
    },
    row: (role) => ({
      display: 'flex',
      justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
      alignItems: 'flex-start',
      gap: 8,
    }),
    jarvisAvatar: {
      marginTop: 4,
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 30% 30%, #7dd3fc 0%, #1e90ff 45%, #0b3f88 100%)',
      boxShadow: '0 0 12px #1e90ff99',
      animation: 'glow 2.2s ease-in-out infinite',
      flexShrink: 0,
    },
    bubble: (role) => ({
      maxWidth: 'min(760px, 88%)',
      borderRadius: role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
      border: role === 'user' ? '1px solid #1e90ff' : '1px solid #0d2040',
      background: role === 'user' ? '#0d1f35' : '#0b1524',
      color: '#dbeafe',
      padding: '10px 12px',
      lineHeight: 1.6,
      fontSize: 14,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }),
    codeBlock: {
      marginTop: 10,
      marginBottom: 4,
      background: '#050d1a',
      borderLeft: '3px solid #1e90ff',
      borderRadius: 8,
      color: '#67e8f9',
      padding: '10px 12px',
      overflowX: 'auto',
      fontFamily: 'Consolas, Monaco, Menlo, monospace',
      fontSize: 13,
      whiteSpace: 'pre',
    },
    typingWrap: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 12px',
      borderRadius: 12,
      border: '1px solid #0d2040',
      background: '#0b1524',
    },
    dot: (delay) => ({
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#1e90ff',
      animation: `pulse 1s ${delay}s infinite`,
    }),
    composer: {
      borderTop: '1px solid #0d2040',
      background: '#0a1525',
      padding: 12,
    },
    inputShell: {
      border: '1px solid #0d2a4a',
      borderRadius: 12,
      background: '#0a1525',
      padding: 10,
    },
    inputRow: { display: 'flex', gap: 8, alignItems: 'flex-end' },
    leftTools: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      color: '#7dd3fc',
      paddingBottom: 6,
      userSelect: 'none',
    },
    toolBtn: {
      width: 28,
      height: 28,
      display: 'grid',
      placeItems: 'center',
      borderRadius: 7,
      border: '1px solid #0d2a4a',
      background: '#0c192d',
      fontSize: 14,
    },
    textarea: {
      flex: 1,
      resize: 'none',
      maxHeight: 180,
      minHeight: 38,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: '#dbeafe',
      font: 'inherit',
      lineHeight: 1.5,
    },
    send: (enabled) => ({
      width: 38,
      height: 38,
      borderRadius: '50%',
      border: '1px solid #1e90ff',
      background: enabled ? '#1e90ff' : '#13355d',
      color: enabled ? '#e6f4ff' : '#7aa6cf',
      cursor: enabled ? 'pointer' : 'not-allowed',
      boxShadow: enabled ? '0 0 12px #1e90ff66' : 'none',
      animation: enabled ? 'glow 1.8s ease-in-out infinite' : 'none',
      flexShrink: 0,
      marginBottom: 2,
    }),
    disclaimer: {
      marginTop: 8,
      color: '#3a6a8a',
      fontSize: 11,
      textAlign: 'center',
    },
    hiddenSystemPrompt: {
      display: 'none',
    },
  };

  const handleNewSession = () => {
    const id = `s${Date.now()}`;
    const newItem = { id, title: `Session ${sessions.length + 1}` };
    setSessions((prev) => [newItem, ...prev]);
    setActiveSessionId(id);
    setMessages([{ role: 'jarvis', content: OPENING_LINE, at: new Date().toISOString() }]);
    setTyping(false);
  };

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || typing) return;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: trimmed, at: new Date().toISOString() },
    ]);
    setInput('');
    setTyping(true);

    timerRef.current = setTimeout(() => {
      const reply = formatJarvisReply(trimmed);
      setMessages((prev) => [
        ...prev,
        { role: 'jarvis', content: reply, at: new Date().toISOString() },
      ]);
      setTyping(false);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, title: trimmed.length > 28 ? `${trimmed.slice(0, 28)}...` : trimmed }
            : s
        )
      );
    }, 1200);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasConversation = messages.some((m) => m.role === 'user');

  return (
    <>
      <style>{`
        @keyframes glow {
          0%, 100% { filter: brightness(0.95); transform: scale(1); }
          50% { filter: brightness(1.15); transform: scale(1.03); }
        }

        @keyframes pulse {
          0%, 100% { opacity: .35; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        @keyframes scan {
          0% { transform: translateY(-120%); }
          100% { transform: translateY(120%); }
        }
      `}</style>

      <div style={styles.app}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarInner}>
            <div style={styles.logoWrap}>
              <div style={styles.hex} />
              <div style={styles.logoText}>
                <p style={styles.logoTitle}>JARVIS</p>
                <p style={styles.logoSub}>ONLINE</p>
              </div>
            </div>
          </div>

          <div style={styles.newBtnWrap}>
            <button style={styles.newBtn} onClick={handleNewSession}>
              <span>＋</span>
              <span>New Session</span>
            </button>
          </div>

          <div style={styles.sessionsWrap}>
            <p style={styles.sessionTitle}>Recent Sessions</p>
            {sessions.map((session) => (
              <button
                key={session.id}
                style={styles.sessionItem(session.id === activeSessionId)}
                onClick={() => {
                  setActiveSessionId(session.id);
                }}
              >
                {session.title}
              </button>
            ))}
          </div>

          <div style={styles.profile}>
            <div style={styles.avatar}>{userInitials}</div>
            <div>
              <p style={styles.profileName}>Swatantra Tripathi</p>
              <p style={styles.profileSub}>Authorized User</p>
            </div>
          </div>
        </aside>

        <main style={styles.main}>
          <header style={styles.header}>
            <div style={styles.scanline} />
            <div style={styles.headerLeft}>
              <button style={styles.burger} onClick={() => setSidebarOpen((v) => !v)}>
                ☰
              </button>
              <span style={styles.statusDot} />
              <p style={styles.headerTitle}>JARVIS — System Active</p>
            </div>
            <div style={styles.version}>v2.0.1</div>
          </header>

          <section style={styles.messages}>
            {!hasConversation ? (
              <div style={styles.emptyState}>
                <div>
                  <div style={styles.emptyHex} />
                  <h2 style={{ margin: 0, fontSize: 28, letterSpacing: '.06em' }}>JARVIS ONLINE</h2>
                  <p style={{ marginTop: 8, color: '#3a6a8a' }}>At your service, sir.</p>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const blocks = parseMessage(msg.content);
                return (
                  <div key={`${msg.at}-${idx}`} style={styles.row(msg.role)}>
                    {msg.role === 'jarvis' && <div style={styles.jarvisAvatar} />}
                    <div style={styles.bubble(msg.role)}>
                      {blocks.map((block, bi) => {
                        if (block.type === 'code') {
                          return (
                            <pre key={`code-${bi}`} style={styles.codeBlock}>
                              {block.value}
                            </pre>
                          );
                        }

                        return (
                          <p key={`txt-${bi}`} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {renderBoldText(block.value)}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {typing && (
              <div style={styles.row('jarvis')}>
                <div style={styles.jarvisAvatar} />
                <div style={styles.typingWrap}>
                  <span style={styles.dot(0)} />
                  <span style={styles.dot(0.2)} />
                  <span style={styles.dot(0.4)} />
                </div>
              </div>
            )}
            <div ref={listEndRef} />
          </section>

          <footer style={styles.composer}>
            <div style={styles.inputShell}>
              <div style={styles.inputRow}>
                <div style={styles.leftTools}>
                  <span style={styles.toolBtn}>📎</span>
                  <span style={styles.toolBtn}>🌐</span>
                  <span style={styles.toolBtn}>⚡</span>
                </div>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Speak your command, sir..."
                  style={styles.textarea}
                />

                <button
                  style={styles.send(Boolean(input.trim()) && !typing)}
                  onClick={sendMessage}
                  disabled={!input.trim() || typing}
                  title="Send"
                >
                  ➤
                </button>
              </div>
              <div style={styles.disclaimer}>JARVIS may make errors. Verify critical information.</div>
            </div>
          </footer>
        </main>
      </div>

      <pre style={styles.hiddenSystemPrompt}>{JARVIS_SYSTEM_PROMPT}</pre>
    </>
  );
}

export default App;
