/**
 * AgriBot.jsx — Floating AI Farmer Assistant
 * ──────────────────────────────────────────────────────────────
 * • Floating 🤖 button (bottom-right), appears on all farmer pages
 * • Real NLP responses via POST /agribot/chat
 * • Bold **text** rendering, quick-reply chips, CTA link buttons
 * • 🎙️ Mic input — Web Speech API for hands-free voice queries
 * • Animated typing indicator, smooth slide-up panel
 * • Unread badge when closed and bot has replied
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }      from '../../context/AuthContext';
import api from '../../api/index';

// ─── Helpers ──────────────────────────────────────────────────

// Render **bold** markdown in message text
function RichText({ text }) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      )}
    </>
  );
}

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Message bubble ───────────────────────────────────────────
function Bubble({ msg }) {
  const isBot = msg.role === 'bot';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isBot ? 'flex-start' : 'flex-end',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 12,
      animation: 'fadeSlideIn 0.18s ease',
    }}>
      {isBot && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#1b5e20,#2e7d32)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}>🤖</div>
      )}

      <div style={{ maxWidth: '76%' }}>
        <div style={{
          padding: '10px 14px',
          borderRadius: isBot ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
          background: isBot ? 'white' : 'linear-gradient(135deg,#16a34a,#15803d)',
          color: isBot ? '#1e293b' : 'white',
          fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line',
          border: isBot ? '1px solid #e8f5e9' : 'none',
          boxShadow: isBot ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(22,163,74,0.25)',
        }}>
          <RichText text={msg.text} />
        </div>
        <div style={{
          fontSize: 10, color: '#94a3b8', marginTop: 3,
          textAlign: isBot ? 'left' : 'right',
          paddingLeft: isBot ? 4 : 0, paddingRight: isBot ? 0 : 4,
        }}>
          {formatTime(msg.time || new Date())}
        </div>
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#1b5e20,#2e7d32)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
      }}>🤖</div>
      <div style={{
        background: 'white', borderRadius: '16px 16px 16px 4px',
        padding: '12px 18px', border: '1px solid #e8f5e9',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
            animation: `typingDot 1.2s ease infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function AgriBot() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [unread,   setUnread]   = useState(0);   // badge when closed
  const [pulse,    setPulse]    = useState(true); // initial attention pulse
  const [isListening, setIsListening] = useState(false);  // mic state

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const greetedRef = useRef(false);
  const recognRef  = useRef(null);

  // Stop pulsing after 6s
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 6000);
    return () => clearTimeout(t);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Send message to backend ───────────────────────────────────
  const sendToBot = useCallback(async (text, silent = false) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!silent) {
      setMessages(prev => [...prev, { role: 'user', text: trimmed, time: new Date() }]);
      setInput('');
    }
    setLoading(true);

    try {
      const res = await api.post('/agribot/chat', {
        message:  trimmed,
        user_id:  user?.id || null,
        language: 'en',
      });
      const d = res.data;
      const botMsg = { role: 'bot', text: d.reply, chips: d.chips, link: d.link, link_label: d.link_label, time: new Date() };
      setMessages(prev => [...prev, botMsg]);
      // Badge when panel is closed
      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: "I'm having trouble connecting right now.\n\n📞 Helpline: **1800-180-1551**",
        chips: ['Try again', 'Helpline numbers'],
        time: new Date(),
      }]);
    }
    setLoading(false);
  }, [user?.id, loading, open]);

  // ── Open / close ──────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    setOpen(o => {
      if (!o) {
        setUnread(0);
        // Greet on first open
        if (!greetedRef.current) {
          greetedRef.current = true;
          setTimeout(() => sendToBot('hello', true), 300);
        }
        setTimeout(() => inputRef.current?.focus(), 250);
      }
      return !o;
    });
  }, [sendToBot]);

  // ── Web Speech API mic ────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recog = new SR();
    recognRef.current = recog;
    recog.lang = 'hi-IN';   // Works for Hindi; switch to 'mr-IN' for Marathi
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    recog.onstart  = () => setIsListening(true);
    recog.onend    = () => setIsListening(false);
    recog.onerror  = () => setIsListening(false);

    recog.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      setInput(transcript);
      // Auto-send on final result
      if (e.results[e.results.length - 1].isFinal) {
        setIsListening(false);
        sendToBot(transcript);
      }
    };

    recog.start();
  }, [isListening, sendToBot]);

  // Cleanup mic on unmount
  useEffect(() => () => recognRef.current?.stop(), []);

  // ── Keyboard handler ──────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendToBot(input);
    }
  };

  // ── Quick-reply chip click ────────────────────────────────────
  const handleChip = (chip) => sendToBot(chip);

  // ── CTA link handler ──────────────────────────────────────────
  const handleLink = (link) => { navigate(link); setOpen(false); };

  // Last bot message for chips/link
  const lastBot = [...messages].reverse().find(m => m.role === 'bot');

  // ─── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* ── FAB Button ── */}
      <button
        onClick={handleToggle}
        title="AgriBot — Your farming assistant"
        aria-label="Open AgriBot chat"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
          width: 58, height: 58, borderRadius: '50%', border: 'none',
          background: open
            ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
            : 'linear-gradient(135deg,#1b5e20,#2e7d32)',
          color: 'white', fontSize: 26, cursor: 'pointer',
          boxShadow: open
            ? '0 6px 24px rgba(239,68,68,0.45)'
            : '0 6px 24px rgba(22,163,74,0.5)',
          animation: pulse && !open ? 'botPulse 2s ease-in-out infinite' : 'none',
          transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.3s',
          lineHeight: 1,
        }}>
          {open ? '✕' : '🤖'}
        </span>

        {/* Unread badge */}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: 'white',
            borderRadius: '50%', width: 20, height: 20, fontSize: 11,
            fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px white',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Tooltip (before first open) ── */}
      {pulse && !open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 8999,
          background: '#1b5e20', color: 'white', borderRadius: 10,
          padding: '8px 14px', fontSize: 12, fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          animation: 'fadeSlideIn 0.4s ease',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          🌾 Need help? Ask AgriBot!
          <div style={{
            position: 'absolute', bottom: -5, right: 20, width: 10, height: 10,
            background: '#1b5e20', transform: 'rotate(45deg)', borderRadius: 2,
          }} />
        </div>
      )}

      {/* ── Chat Panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 94, right: 24, zIndex: 8998,
          width: 360, height: 530, borderRadius: 20,
          background: 'white',
          boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.07)',
          animation: 'slideUpIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg,#1b5e20 0%,#2e7d32 60%,#33691e 100%)',
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'white', letterSpacing: '-0.3px' }}>
                AgriBot
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', flexShrink: 0 }} />
                Online · Replies in seconds
              </div>
            </div>
            <button
              onClick={() => { setMessages([]); greetedRef.current = false; }}
              title="Clear conversation"
              style={{
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, color: 'rgba(255,255,255,0.85)', fontSize: 11,
                padding: '5px 10px', cursor: 'pointer', fontWeight: 600, flexShrink: 0,
              }}>
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px', background: '#f0fdf4' }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌾</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Welcome to AgriBot!</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Ask me about schemes, applications, payments, or documents.</div>
              </div>
            )}

            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
            {loading && <TypingIndicator />}

            {/* Quick-reply chips */}
            {!loading && lastBot?.chips?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {lastBot.chips.map((chip, i) => (
                  <button key={i} onClick={() => handleChip(chip)}
                    style={{
                      padding: '6px 13px', borderRadius: 99,
                      border: '1.5px solid #bbf7d0', background: 'white',
                      color: '#15803d', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#4ade80'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* CTA navigate button */}
            {!loading && lastBot?.link && (
              <button onClick={() => handleLink(lastBot.link)}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#16a34a,#15803d)',
                  color: 'white', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', marginBottom: 12,
                  boxShadow: '0 3px 10px rgba(22,163,74,0.3)',
                }}>
                {lastBot.link_label || 'Go →'}
              </button>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid #e8f5e9',
            display: 'flex', alignItems: 'flex-end', gap: 8,
            background: 'white', flexShrink: 0,
          }}>
            {/* Mic button */}
            <button
              onClick={toggleVoice}
              title={isListening ? 'Stop listening' : 'Speak your question (Hindi/English)'}
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: isListening
                  ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
                  : '#f1f5f9',
                color: isListening ? 'white' : '#64748b',
                cursor: 'pointer', fontSize: 17,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: isListening ? 'botPulse 1s ease-in-out infinite' : 'none',
                transition: 'all 0.2s',
              }}>
              🎙️
            </button>

            {/* Text input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? '🎙️ Listening...' : 'Ask anything… (Enter to send)'}
              rows={1}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 12,
                border: '1.5px solid #e2e8f0', fontSize: 13,
                resize: 'none', outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.45, maxHeight: 80, overflowY: 'auto',
                background: isListening ? '#fef2f2' : 'white',
                transition: 'border-color 0.15s, background 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#4ade80'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />

            {/* Send button */}
            <button
              onClick={() => sendToBot(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg,#16a34a,#15803d)'
                  : '#e2e8f0',
                color: input.trim() && !loading ? 'white' : '#94a3b8',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, transition: 'all 0.2s',
              }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes botPulse {
          0%, 100% { box-shadow: 0 6px 24px rgba(22,163,74,0.5), 0 0 0 0 rgba(22,163,74,0.3); }
          50%       { box-shadow: 0 6px 24px rgba(22,163,74,0.5), 0 0 0 10px rgba(22,163,74,0); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.35; }
          30%           { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
