/**
 * Apply.jsx — Smart Scheme Application
 * ─────────────────────────────────────────────
 * 4-step wizard. When ?scheme_id= is in URL (from SchemeDetail),
 * starts directly at Step 2 (document checklist) — no extra click needed.
 *
 * Step 1 → Choose scheme
 * Step 2 → Smart document checklist  ✅ auto-filled | ⚠️ upload required | 🔄 expired
 * Step 3 → Farm details
 * Step 4 → Review & Submit → Success
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/farmer/Sidebar';
import Topbar  from '../components/farmer/Topbar';
import { useAuth }          from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/index';
import '../styles/farmer.css';

const API_BASE = 'http://127.0.0.1:8000';
const STEPS    = ['Select Scheme', 'Documents', 'Farm Details', 'Submit'];

// ── helpers ──────────────────────────────────────────────────
function statusColor(s) {
  return s === 'available' ? '#22c55e' : s === 'expired' ? '#f59e0b' : '#ef4444';
}
function statusBg(s) {
  return s === 'available' ? '#f0fdf4' : s === 'expired' ? '#fffbeb' : '#fef2f2';
}
function statusBorder(s) {
  return s === 'available' ? '#86efac' : s === 'expired' ? '#fde68a' : '#fca5a5';
}
function statusLabel(s) {
  return s === 'available' ? '✅ Auto-filled from vault'
       : s === 'expired'   ? '🔄 Expired — re-upload needed'
       : '⚠️ Upload required';
}

// ── Inline mini upload zone ───────────────────────────────────
function MiniUpload({ docType, label, userId, onDone }) {
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);
  const ref               = useRef();

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', docType);
    try {
      await fetch(`${API_BASE}/documents/upload/${userId}`, { method: 'POST', body: fd });
      setDone(true);
      onDone(docType);
    } catch { alert('Upload failed — please try again.'); }
    setBusy(false);
  };

  if (done) return (
    <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8,
      fontSize: 12, fontWeight: 700, color: '#15803d', marginTop: 8 }}>
      ✅ Uploaded successfully
    </div>
  );

  return (
    <div onClick={() => ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
      style={{
        marginTop: 10, border: '2px dashed #fca5a5', borderRadius: 10,
        padding: '12px', textAlign: 'center', cursor: 'pointer',
        background: '#fef9f9', fontSize: 12, color: '#b91c1c', fontWeight: 600,
      }}>
      <input ref={ref} type="file" accept="image/*,application/pdf"
        style={{ display: 'none' }} onChange={e => upload(e.target.files?.[0])} />
      {busy ? '⏳ Uploading…' : `📤 Click or drag to upload ${label}`}
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>JPG, PNG, PDF · Max 10 MB</div>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────
function Stepper({ step }) {
  const currentStep = step > 3.5 ? 4 : Math.ceil(step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done   = currentStep > n;
        const active = currentStep === n;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13,
                background: done ? '#22c55e' : active ? '#0f172a' : '#e2e8f0',
                color:      done ? 'white'   : active ? 'white'   : '#94a3b8',
                flexShrink: 0, transition: 'all 0.3s',
              }}>
                {done ? '✓' : n}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, marginTop: 4, whiteSpace: 'nowrap',
                color: active ? '#0f172a' : '#94a3b8',
              }}>
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 6px', marginBottom: 16,
                background: done ? '#22c55e' : '#e2e8f0', transition: 'all 0.4s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function Apply() {
  const { user }          = useAuth();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();

  // Initialise from URL params immediately (don't wait for schemes to load)
  const initSchemeId   = searchParams.get('scheme_id');
  const initSchemeName = searchParams.get('scheme_name');
  const hasPreSelected = Boolean(initSchemeId && initSchemeName);

  const [step, setStep]       = useState(hasPreSelected ? 2 : 1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Step 1
  const [schemes, setSchemes] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState(
    hasPreSelected ? { id: Number(initSchemeId), Scheme_Name: decodeURIComponent(initSchemeName) } : null
  );

  // Step 2
  const [smartCheck, setSmartCheck]     = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [uploaded, setUploaded]         = useState(new Set()); // doc types uploaded this session

  // Step 3
  const [form, setForm] = useState({ land_area: '', crop_type: '', notes: '' });

  // Step 4
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(null);

  // ── Load schemes for Step 1 picker ─────────────────────────
  useEffect(() => {
    api.get('/schemes/').then(r => setSchemes(r.data || [])).catch(() => {});
  }, []);

  // ── When scheme changes, upgrade pre-selected with full data ──
  useEffect(() => {
    if (!hasPreSelected || !schemes.length || !selectedScheme) return;
    const found = schemes.find(s => String(s.id) === String(initSchemeId));
    if (found && found.Department) setSelectedScheme(found); // upgrade with full data
  }, [schemes]);

  // ── Fetch smart document check ──────────────────────────────
  const fetchSmartCheck = useCallback(async (scheme) => {
    if (!user?.id || !scheme) return;
    setCheckLoading(true);
    try {
      const res = await api.get(`/documents/smart-check/${user.id}`, {
        params: { scheme_name: scheme.Scheme_Name || '' },
      });
      setSmartCheck(res.data);
    } catch {
      setSmartCheck(null);
    }
    setCheckLoading(false);
  }, [user?.id]);

  // Run check when we land on step 2 with a scheme
  useEffect(() => {
    if (step === 2 && selectedScheme && user?.id) {
      fetchSmartCheck(selectedScheme);
    }
  }, [step, selectedScheme?.id, user?.id]);

  // ── Step 1 → 2 ──────────────────────────────────────────────
  const chooseScheme = (scheme) => {
    setSelectedScheme(scheme);
    setUploaded(new Set());
    setSmartCheck(null);
    setStep(2);
  };

  // ── Can proceed past step 2? ─────────────────────────────────
  const canProceed = () => {
    if (!smartCheck) return false;
    const { critical_missing = 0, critical_expired = 0 } = smartCheck.summary || {};
    return critical_missing === 0 && critical_expired === 0;
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !selectedScheme) return;
    setSubmitting(true);
    try {
      const res = await api.post('/applications/', {
        scheme_id:   selectedScheme.id,
        farmer_name: user.full_name,
        farmer_id:   user.farmer_id  || '',
        mobile:      user.mobile     || '',
        district:    user.district   || '',
        land_acres:  form.land_area,
        crop_type:   form.crop_type,
        notes:       form.notes,
      });
      setSubmitted(res.data);
      setStep(5);
    } catch {
      alert('Submission failed — please try again.');
    }
    setSubmitting(false);
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="Apply for Scheme" onMenuClick={() => setSidebarOpen(o => !o)} />

        <div className="page-content" style={{ maxWidth: 660, margin: '0 auto' }}>
          <div className="section-title" style={{ marginBottom: 4 }}>🚀 Apply for a Scheme</div>
          <div className="section-sub" style={{ marginBottom: 28 }}>
            Documents already in your vault are attached automatically — no re-uploads needed
          </div>

          <Stepper step={step} />

          <div className="card" style={{ padding: 28 }}>

            {/* ════════ STEP 1 — Choose scheme ════════ */}
            {step === 1 && (
              <div>
                <h3 style={{ margin: '0 0 18px', fontWeight: 800, fontSize: 16, color: '#1e293b' }}>
                  Choose a Scheme
                </h3>
                {schemes.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>Loading schemes…</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                    {schemes.map(s => (
                      <button key={s.id} onClick={() => chooseScheme(s)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 12, padding: '12px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                          background: 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = '#86efac'; e.currentTarget.style.background = '#f0fdf4'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                            {s.Scheme_Name}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.Department}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', flexShrink: 0,
                          background: '#dcfce7', padding: '3px 10px', borderRadius: 99 }}>
                          Apply →
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════ STEP 2 — Smart document checklist ════════ */}
            {step === 2 && (
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#1e293b' }}>
                      📋 Document Checklist
                    </h3>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      {selectedScheme?.Scheme_Name}
                    </div>
                  </div>
                  {smartCheck && (
                    <div style={{ textAlign: 'center', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: smartCheck.summary.readiness_score >= 80 ? '#22c55e' : '#f59e0b' }}>
                        {smartCheck.summary.readiness_score}%
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>READY</div>
                    </div>
                  )}
                </div>

                {/* AI hint */}
                {smartCheck?.ai_hint && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                    background: '#f0fdf4', border: '1px solid #86efac',
                    fontSize: 12, fontWeight: 600, color: '#166534',
                  }}>
                    🤖 {smartCheck.ai_hint}
                  </div>
                )}

                {/* Document list */}
                {checkLoading ? (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Checking your document vault…</div>
                  </div>
                ) : smartCheck ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                    {smartCheck.documents.map(doc => (
                      <div key={doc.type} style={{
                        padding: '12px 14px', borderRadius: 10,
                        border: `1.5px solid ${statusBorder(uploaded.has(doc.type) ? 'available' : doc.status)}`,
                        background: statusBg(uploaded.has(doc.type) ? 'available' : doc.status),
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{doc.label}</span>
                            {doc.critical && (
                              <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#ef4444',
                                background: '#fee2e2', padding: '1px 5px', borderRadius: 4 }}>REQUIRED</span>
                            )}
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, whiteSpace: 'nowrap',
                            background: uploaded.has(doc.type) ? '#dcfce7' : statusBg(doc.status) + 'cc',
                            color: statusColor(uploaded.has(doc.type) ? 'available' : doc.status),
                          }}>
                            {uploaded.has(doc.type) ? '✅ Just uploaded' : statusLabel(doc.status)}
                          </span>
                        </div>

                        {/* Upload zone for missing/expired docs not yet uploaded */}
                        {(doc.status === 'missing' || doc.status === 'expired') && !uploaded.has(doc.type) && (
                          <MiniUpload
                            docType={doc.type}
                            label={doc.label}
                            userId={user?.id}
                            onDone={(type) => setUploaded(prev => new Set([...prev, type]))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    Could not load document requirements.
                    <button onClick={() => fetchSmartCheck(selectedScheme)}
                      style={{ display: 'block', margin: '12px auto 0', padding: '8px 16px',
                        borderRadius: 8, border: '1px solid #e2e8f0', background: 'white',
                        cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      Retry
                    </button>
                  </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!canProceed()}
                    style={{
                      flex: 1, padding: '10px 20px', borderRadius: 10, border: 'none',
                      fontWeight: 700, fontSize: 14, cursor: canProceed() ? 'pointer' : 'not-allowed',
                      background: canProceed() ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#e2e8f0',
                      color: canProceed() ? 'white' : '#94a3b8', transition: 'all 0.2s',
                    }}
                  >
                    {canProceed()
                      ? 'Continue →'
                      : `⚠️ Upload ${smartCheck?.summary?.critical_missing || 0} required document(s) first`}
                  </button>
                </div>
              </div>
            )}

            {/* ════════ STEP 3 — Farm details ════════ */}
            {step === 3 && (
              <div>
                <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: 16, color: '#1e293b' }}>
                  🌾 Farm Details
                </h3>
                {[
                  { key: 'land_area', label: 'Land Area (acres)',  placeholder: 'e.g. 3.5', type: 'input' },
                  { key: 'crop_type', label: 'Primary Crop',       placeholder: 'e.g. Wheat, Onion', type: 'input' },
                  { key: 'notes',     label: 'Additional Notes',   placeholder: 'Any remarks (optional)', type: 'textarea' },
                ].map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">{f.label}</label>
                    {f.type === 'textarea'
                      ? <textarea className="form-input" placeholder={f.placeholder} rows={3}
                          value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                          style={{ resize: 'vertical' }} />
                      : <input className="form-input" placeholder={f.placeholder}
                          value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    }
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-outline" onClick={() => setStep(2)}>← Back</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3.5)}>
                    Review →
                  </button>
                </div>
              </div>
            )}

            {/* ════════ STEP 3.5 — Review & Submit ════════ */}
            {step === 3.5 && (
              <div>
                <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: 16, color: '#1e293b' }}>
                  📝 Review & Submit
                </h3>

                {/* Scheme */}
                <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 16px', marginBottom: 12, border: '1px solid #86efac' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Scheme</div>
                  <div style={{ fontWeight: 700, color: '#15803d' }}>{selectedScheme?.Scheme_Name}</div>
                </div>

                {/* Documents */}
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', marginBottom: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>Attached Documents</div>
                  {smartCheck?.documents.filter(d => d.status === 'available' || uploaded.has(d.type)).map(d => (
                    <div key={d.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#475569' }}>{d.label}</span>
                      <span style={{ color: '#15803d', fontWeight: 700 }}>
                        ✅ {uploaded.has(d.type) ? 'Just uploaded' : 'From vault'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Farm details */}
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', marginBottom: 20, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>Farm Details</div>
                  {[['Farmer', user?.full_name], ['District', user?.district || '—'],
                    ['Land Area', form.land_area ? `${form.land_area} acres` : '—'],
                    ['Crop', form.crop_type || '—']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>{k}</span>
                      <span style={{ fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-outline" onClick={() => setStep(3)}>← Edit</button>
                  <button
                    disabled={submitting}
                    onClick={handleSubmit}
                    style={{
                      flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none',
                      fontWeight: 800, fontSize: 14, cursor: 'pointer',
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: 'white', boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? '⏳ Submitting…' : '🚀 Submit Application'}
                  </button>
                </div>
              </div>
            )}

            {/* ════════ STEP 5 — Success ════════ */}
            {step === 5 && submitted && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d', marginBottom: 10 }}>
                  Application Submitted!
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#0369a1',
                  background: '#f0f9ff', padding: '10px 24px', borderRadius: 10,
                  display: 'inline-block', marginBottom: 8,
                }}>
                  {submitted.app_number}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', margin: '8px 0 28px' }}>
                  Your application is under review. You'll be notified of any updates.
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" onClick={() => navigate('/applications')}>
                    My Applications
                  </button>
                  <button className="btn btn-primary" onClick={() => {
                    setStep(1); setSelectedScheme(null); setSmartCheck(null); setSubmitted(null); setUploaded(new Set());
                  }}>
                    Apply for Another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
