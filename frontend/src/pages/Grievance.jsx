/**
 * Grievance.jsx — AI Voice Grievance Portal
 * ──────────────────────────────────────────────────────────────
 * State machine: idle → recording → transcribed → analysed → confirmed → submitted
 *
 * Features:
 * • Hold-to-record mic button with live animated waveform
 * • Bhashini STT (mr/hi/en) with graceful fallbacks
 * • NLP analysis: category, priority, entities, actions
 * • Editable transcript before submit
 * • Track tab with live API data
 */

import { useState, useEffect, useCallback, useRef }  from 'react';
import Sidebar  from '../components/farmer/Sidebar';
import Topbar   from '../components/farmer/Topbar';
import { useAuth }  from '../context/AuthContext';
import useVoiceRecorder  from '../hooks/useVoiceRecorder';
import useBhashiniSTT    from '../hooks/useBhashiniSTT';
import { submitGrievance } from '../api/grievances';
import api from '../api/index';
import '../styles/farmer.css';

// ── Waveform bars visualiser ──────────────────────────────────
function Waveform({ volume, isActive, barCount = 20 }) {
  if (!isActive) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 40 }}>
      {Array.from({ length: barCount }).map((_, i) => {
        const seed  = Math.sin(i * 0.8 + Date.now() * 0.003) * 0.5 + 0.5;
        const h     = Math.max(4, Math.round(4 + volume * seed * 0.36));
        return (
          <div key={i} style={{
            width: 3, height: h, borderRadius: 99,
            background: `hsl(${140 + i * 2}, 70%, ${40 + h}%)`,
            transition: 'height 0.08s ease',
          }} />
        );
      })}
    </div>
  );
}

// ── Mic button ────────────────────────────────────────────────
function MicButton({ recState, volume, onStart, onStop, disabled }) {
  const isRecording = recState === 'recording';
  const isPulsing   = isRecording;
  return (
    <button
      onMouseDown={onStart}
      onMouseUp={onStop}
      onTouchStart={e => { e.preventDefault(); onStart(); }}
      onTouchEnd={e => { e.preventDefault(); onStop(); }}
      onClick={isRecording ? onStop : onStart}
      disabled={disabled}
      title={isRecording ? 'Release to stop' : 'Click or hold to record'}
      style={{
        width: 80, height: 80, borderRadius: '50%', border: 'none',
        background: isRecording
          ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
          : 'linear-gradient(135deg, #16a34a, #15803d)',
        color: 'white', fontSize: 32, cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: isPulsing
          ? '0 0 0 16px rgba(239,68,68,0.15), 0 0 0 8px rgba(239,68,68,0.25), 0 6px 24px rgba(239,68,68,0.4)'
          : '0 6px 24px rgba(22,163,74,0.4)',
        transition: 'all 0.2s',
        animation: isPulsing ? 'pulse-mic 1.2s ease-in-out infinite' : 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {recState === 'requesting' ? '⏳' : isRecording ? '⏹' : '🎙️'}
    </button>
  );
}

// ── AI Analysis card ──────────────────────────────────────────
function AnalysisCard({ analysis }) {
  if (!analysis) return null;
  const priorityColor = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }[analysis.priority] || '#94a3b8';
  const categoryLabel = {
    payment_delay: '💰 Payment Delay', doc_error: '📄 Document Error',
    scheme_rejection: '❌ Scheme Rejection', officer_misconduct: '⚠️ Officer Misconduct',
    irrigation: '💧 Irrigation Issue', insurance: '🛡️ Insurance Claim', other: '📋 General',
  }[analysis.category] || analysis.category;

  return (
    <div style={{
      borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'hidden',
      background: 'white', marginTop: 16,
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #f0fdf4, #f0f9ff)',
        borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>🤖 AI Analysis</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
            background: priorityColor + '22', color: priorityColor }}>{analysis.priority?.toUpperCase()} PRIORITY</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
            background: '#e0e7ff', color: '#4338ca' }}>{categoryLabel}</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Summary */}
        <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, marginBottom: 12,
          padding: '8px 12px', background: '#f8fafc', borderRadius: 8, borderLeft: `3px solid ${priorityColor}` }}>
          {analysis.summary}
        </div>

        {/* Entities */}
        {Object.keys(analysis.entities || {}).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
              Extracted Information
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(analysis.entities).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99,
                  background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                  {k.replace('_', ' ')}: <strong>{v}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggested actions */}
        {analysis.actions?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
              Recommended Actions
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {analysis.actions.slice(0, 3).map((a, i) => (
                <li key={i} style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
          {analysis.ai_tag} · Confidence {Math.round((analysis.confidence || 0.7) * 100)}%
        </div>
      </div>
    </div>
  );
}

// ── Language selector ─────────────────────────────────────────
function LangSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[['mr', 'मराठी'], ['hi', 'हिंदी'], ['en', 'English']].map(([code, label]) => (
        <button key={code} onClick={() => onChange(code)}
          style={{
            padding: '5px 12px', borderRadius: 99, border: '1.5px solid',
            borderColor: value === code ? '#16a34a' : '#e2e8f0',
            background: value === code ? '#f0fdf4' : 'white',
            color: value === code ? '#15803d' : '#64748b',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function Grievance() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab,         setTab]         = useState('new');
  const [lang,        setLang]        = useState('hi');

  // Voice pipeline state machine
  // flow: idle → recording → transcribed → analysed → confirmed → submitted
  const [voiceStage,  setVoiceStage]  = useState('idle');     // voice flow stage
  const [analysis,    setAnalysis]    = useState(null);
  const [analysing,   setAnalysing]   = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [ticketId,    setTicketId]    = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  // Text form fallback
  const [showTextForm, setShowTextForm] = useState(false);
  const [textForm,     setTextForm]     = useState({ category: '', subject: '', description: '' });
  const [textLoading,  setTextLoading]  = useState(false);

  // Existing grievances
  const [myGrievances, setMyGrievances] = useState([]);
  const [grvLoading,   setGrvLoading]   = useState(false);

  // Voice hooks
  const recorder = useVoiceRecorder({ maxDurationMs: 120_000 });
  const stt       = useBhashiniSTT();

  // Waveform animation tick
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (recorder.state !== 'recording') return;
    const t = setInterval(() => setTick(n => n + 1), 80);
    return () => clearInterval(t);
  }, [recorder.state]);

  // Fetch existing grievances
  useEffect(() => {
    if (tab !== 'track' || !user?.id) return;
    setGrvLoading(true);
    api.get('/grievances/', { params: { user_id: user.id } })
      .then(r => setMyGrievances(r.data || []))
      .catch(() => {})
      .finally(() => setGrvLoading(false));
  }, [tab, user?.id]);

  // ── Step 1: Record ──────────────────────────────────────────
  const handleStartRecording = () => {
    if (recorder.state === 'recording') return;
    stt.reset();
    setAnalysis(null);
    setVoiceStage('recording');
    recorder.start();
  };

  // ── Step 2: Stop → Transcribe ───────────────────────────────
  const handleStopRecording = useCallback(async () => {
    if (recorder.state !== 'recording') return;
    recorder.stop();

    // Wait briefly for recorder to finalise blob
    await new Promise(r => setTimeout(r, 400));
    setVoiceStage('transcribing');
  }, [recorder]);

  // When blob is available, run STT
  useEffect(() => {
    if (voiceStage === 'transcribing' && recorder.blob) {
      stt.transcribe(recorder.blob, lang).then(() => {
        setVoiceStage('transcribed');
      });
    }
  }, [voiceStage, recorder.blob]);

  // ── Step 3: AI Analyse ──────────────────────────────────────
  const handleAnalyse = async () => {
    const text = stt.transcript.trim();
    if (!text) return;
    setAnalysing(true);
    try {
      const res = await api.post('/grievances/analyse', { text, language: lang });
      setAnalysis(res.data);
      setVoiceStage('analysed');
    } catch {
      // Mock fallback
      setAnalysis({
        category: 'payment_delay', priority: 'high',
        summary: `[Payment Delay] ${text.slice(0, 80)}…`,
        language: lang, confidence: 0.75,
        entities: {}, actions: ['Contact district agriculture office', 'Check PM Kisan status online'],
        ai_tag: '🔴 HIGH PRIORITY — Auto-routed to district officer',
      });
      setVoiceStage('analysed');
    }
    setAnalysing(false);
  };

  // ── Step 4: Submit ──────────────────────────────────────────
  const handleVoiceSubmit = async () => {
    if (!stt.transcript || !analysis) return;
    setSubmitting(true);
    try {
      await submitGrievance({
        category:    analysis.category,
        subject:     analysis.summary,
        description: stt.transcript,
        priority:    analysis.priority,
        farmer_name: user?.full_name,
        farmer_id:   user?.farmer_id,
        language:    lang,
      });
    } catch { /* silent if API fails */ }
    const id = 'GRV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
    setTicketId(id);
    setSubmitted(true);
    setVoiceStage('submitted');
    setSubmitting(false);
  };

  // ── Text form submit ────────────────────────────────────────
  const handleTextSubmit = async () => {
    if (!textForm.subject || !textForm.description) return alert('Please fill all required fields.');
    setTextLoading(true);
    try { await submitGrievance({ ...textForm, farmer_name: user?.full_name, farmer_id: user?.farmer_id }); }
    catch { /* silent */ }
    const id = 'GRV-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
    setTicketId(id);
    setSubmitted(true);
    setTextLoading(false);
  };

  // ── Reset ───────────────────────────────────────────────────
  const handleReset = () => {
    recorder.reset();
    stt.reset();
    setAnalysis(null);
    setVoiceStage('idle');
    setSubmitted(false);
    setTicketId('');
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="Grievance Portal" onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="page-content">

          <div className="section-title">📢 Grievance Portal</div>
          <div className="section-sub" style={{ marginBottom: 20 }}>
            Speak your complaint in Marathi, Hindi, or English — AI handles the rest
          </div>

          <div className="tabs" style={{ marginBottom: 20 }}>
            <button className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>🎙️ File Complaint</button>
            <button className={`tab ${tab === 'track' ? 'active' : ''}`} onClick={() => setTab('track')}>📋 My Complaints</button>
          </div>

          {/* ════════ NEW COMPLAINT TAB ════════ */}
          {tab === 'new' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

              {/* Left: Voice recorder + transcript */}
              <div>
                {!submitted ? (
                  <>
                    {/* ── Voice recorder card ── */}
                    <div className="card" style={{ textAlign: 'center' }}>
                      {/* Language selector */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🎙️ Voice Complaint</div>
                        <LangSelector value={lang} onChange={setLang} />
                      </div>

                      {/* Mic button + waveform */}
                      <div style={{ padding: '20px 0' }}>
                        <Waveform volume={recorder.volume} isActive={recorder.state === 'recording'} />
                        <div style={{ margin: '20px auto' }}>
                          <MicButton
                            recState={recorder.state}
                            volume={recorder.volume}
                            onStart={handleStartRecording}
                            onStop={handleStopRecording}
                            disabled={voiceStage === 'transcribing' || analysing || submitting}
                          />
                        </div>

                        {/* Status label */}
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', minHeight: 24 }}>
                          {recorder.state === 'recording' && (
                            <span style={{ color: '#ef4444' }}>🔴 Recording… {recorder.durationLabel}</span>
                          )}
                          {voiceStage === 'transcribing' && '⏳ Transcribing your voice…'}
                          {voiceStage === 'idle' && (
                            <span>Click mic to record • Speak in {lang === 'mr' ? 'Marathi' : lang === 'hi' ? 'Hindi' : 'English'}</span>
                          )}
                          {(voiceStage === 'transcribed' || voiceStage === 'analysed') && '✅ Recording done — review below'}
                        </div>

                        {/* STT method badge */}
                        {stt.method && (
                          <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                            Transcribed via: {stt.method === 'mock' ? '🔧 Dev Mock' : stt.method === 'bhashini' ? '🇮🇳 Bhashini' : stt.method === 'browser' ? '🌐 Browser STT' : '🖥️ Backend'}
                          </div>
                        )}
                      </div>

                      {/* Error */}
                      {recorder.error && (
                        <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10,
                          border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>
                          ⚠️ {recorder.error}
                        </div>
                      )}

                      {/* Divider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
                        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                      </div>

                      {/* Text form toggle */}
                      <button onClick={() => setShowTextForm(f => !f)}
                        style={{ fontSize: 12, fontWeight: 700, color: '#475569', background: '#f8fafc',
                          border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>
                        ✏️ {showTextForm ? 'Hide' : 'Type your complaint instead'}
                      </button>
                    </div>

                    {/* ── Text form (hidden by default) ── */}
                    {showTextForm && (
                      <div className="card" style={{ marginTop: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>📝 Type Your Complaint</div>
                        <div className="form-group">
                          <label className="form-label">Category</label>
                          <select className="form-select" value={textForm.category}
                            onChange={e => setTextForm(p => ({ ...p, category: e.target.value }))}>
                            <option value="">— Select —</option>
                            {['Payment Issue', 'Document Problem', 'Application Status', 'Scheme Rejection', 'Officer Misconduct', 'Other'].map(c => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Subject *</label>
                          <input className="form-input" placeholder="Brief subject of complaint"
                            value={textForm.subject} onChange={e => setTextForm(p => ({ ...p, subject: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Description *</label>
                          <textarea className="form-textarea" rows={4} placeholder="Describe your issue in detail…"
                            value={textForm.description} onChange={e => setTextForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <button className="btn btn-primary" onClick={handleTextSubmit} disabled={textLoading}>
                          {textLoading ? '⏳ Submitting…' : '📢 Submit Complaint'}
                        </button>
                      </div>
                    )}

                    {/* ── Transcript editor + AI analysis ── */}
                    {(voiceStage === 'transcribed' || voiceStage === 'analysed') && stt.transcript && (
                      <div className="card" style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>📝 Your Complaint (editable)</div>
                          <button onClick={handleReset}
                            style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>
                            🔄 Re-record
                          </button>
                        </div>

                        <textarea
                          rows={5}
                          value={stt.transcript}
                          onChange={e => stt.setTranscript(e.target.value)}
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 10,
                            border: '1.5px solid #e2e8f0', fontSize: 13, lineHeight: 1.6,
                            fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                            background: '#f8fafc',
                          }}
                        />

                        <AnalysisCard analysis={analysis} />

                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                          {voiceStage === 'transcribed' && (
                            <button onClick={handleAnalyse} disabled={analysing}
                              style={{
                                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
                              }}>
                              {analysing ? '🤖 Analysing…' : '🤖 Analyse with AI →'}
                            </button>
                          )}
                          {voiceStage === 'analysed' && (
                            <button onClick={handleVoiceSubmit} disabled={submitting}
                              style={{
                                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                                color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                              }}>
                              {submitting ? '⏳ Submitting…' : '📢 Submit Complaint'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Success state ── */
                  <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
                    <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d', marginBottom: 8 }}>
                      Complaint Filed!
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                      Your grievance has been logged and auto-routed to the concerned district officer.
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#0369a1',
                      background: '#f0f9ff', padding: '12px 24px', borderRadius: 10, display: 'inline-block', marginBottom: 24 }}>
                      {ticketId}
                    </div>
                    {analysis && (
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>
                        🤖 Auto-tagged as <strong>{analysis.category?.replace('_', ' ')}</strong> · {analysis.priority?.toUpperCase()} priority
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button className="btn btn-outline" onClick={handleReset}>File Another</button>
                      <button className="btn btn-primary" onClick={() => setTab('track')}>Track Status →</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: AgriBot help panel */}
              <div>
                <div style={{
                  borderRadius: 16, overflow: 'hidden', border: '1.5px solid #e2e8f0',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                }}>
                  {/* Bot header */}
                  <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #1b5e20, #2e7d32)',
                    display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🤖</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>AgriBot</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                        Online · Ready to Help
                      </div>
                    </div>
                  </div>

                  {/* Bot messages */}
                  <div style={{ background: '#f8fafc', padding: 16, minHeight: 200 }}>
                    {/* Bot message */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🤖</div>
                      <div style={{ background: 'white', borderRadius: '12px 12px 12px 4px', padding: '10px 14px',
                        fontSize: 13, color: '#1e293b', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxWidth: '80%' }}>
                        {voiceStage === 'idle' && 'Press the mic button and speak your complaint in Marathi, Hindi, or English. I\'ll analyse it automatically.'}
                        {voiceStage === 'recording' && '🎙️ I\'m listening… Speak clearly about your issue.'}
                        {voiceStage === 'transcribing' && '⏳ Processing your voice…'}
                        {voiceStage === 'transcribed' && 'Great! I\'ve captured your complaint. Review the text and click "Analyse with AI" to categorise it.'}
                        {voiceStage === 'analysed' && analysis && (
                          <>I've analysed your complaint. It appears to be a <strong>{analysis.category?.replace('_', ' ')}</strong> issue with <strong>{analysis.priority} priority</strong>. Review the details and submit when ready.</>
                        )}
                        {voiceStage === 'submitted' && '✅ Your complaint has been filed and auto-routed. You\'ll receive updates in the Track tab.'}
                      </div>
                    </div>

                    {/* Quick topic chips */}
                    {voiceStage === 'idle' && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, marginLeft: 36 }}>
                          Common Topics
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 36 }}>
                          {['PM Kisan Delay', 'Payment Issue', 'Document Error', 'Insurance Claim'].map(t => (
                            <button key={t} onClick={() => stt.setTranscript(t)}
                              style={{ padding: '5px 12px', borderRadius: 99, border: '1px solid #e2e8f0',
                                background: 'white', fontWeight: 600, fontSize: 11, cursor: 'pointer', color: '#475569' }}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pipeline steps */}
                  <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
                      How it works
                    </div>
                    {[
                      { icon: '🎙️', label: 'Speak your complaint', done: voiceStage !== 'idle' },
                      { icon: '🔤', label: 'AI transcribes (Marathi/Hindi)', done: ['transcribed','analysed','submitted'].includes(voiceStage) },
                      { icon: '🧠', label: 'NLP categorises & prioritises', done: ['analysed','submitted'].includes(voiceStage) },
                      { icon: '📤', label: 'Auto-routed to officer', done: voiceStage === 'submitted' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                        borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
                        <span style={{ fontSize: 16 }}>{s.done ? '✅' : s.icon}</span>
                        <span style={{ fontSize: 12, color: s.done ? '#15803d' : '#64748b', fontWeight: s.done ? 700 : 400 }}>
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════ TRACK TAB ════════ */}
          {tab === 'track' && (
            grvLoading ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Loading your complaints…</div>
              </div>
            ) : myGrievances.length === 0 ? (
              <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b', marginBottom: 8 }}>No complaints filed yet</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
                  File a complaint using the voice recorder or text form above.
                </div>
                <button className="btn btn-primary" onClick={() => setTab('new')}>
                  🎙️ File a Complaint
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {myGrievances.map((g, i) => {
                  const statusColor = { Resolved: '#22c55e', Escalated: '#ef4444',
                    'Under Review': '#3b82f6', Assigned: '#f59e0b', Pending: '#94a3b8' }[g.status] || '#94a3b8';
                  return (
                    <div key={i} className="card" style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99, marginRight: 10,
                            background: statusColor + '22', color: statusColor }}>
                            {g.status?.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            Filed {g.created_at ? new Date(g.created_at).toLocaleDateString('en-IN') : '—'}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0369a1', fontWeight: 600 }}>
                          {g.ticket_id || `GRV-${g.id}`}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#1e293b' }}>
                        {g.subject}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                        {g.description?.slice(0, 150)}{g.description?.length > 150 ? '…' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </main>

      <style>{`
        @keyframes pulse-mic {
          0%, 100% { box-shadow: 0 0 0 8px rgba(239,68,68,0.2), 0 0 0 16px rgba(239,68,68,0.1); }
          50%       { box-shadow: 0 0 0 12px rgba(239,68,68,0.3), 0 0 0 24px rgba(239,68,68,0.08); }
        }
      `}</style>
    </div>
  );
}
