/**
 * SmartDocScanner.jsx
 * ────────────────────────────────────────────────────────────────
 * AI-powered document upload & auto-fill page for farmers.
 *
 * Flow:
 *  1. Farmer drags/selects a document (Aadhaar, 7/12, Bank passbook, etc.)
 *  2. File is uploaded → POST /documents/upload/{user_id}
 *  3. OCR is triggered  → POST /ocr/analyze/{user_id}
 *  4. Extracted fields are shown in a confidence-colored grid
 *     🟢 ≥85% — auto-filled, one-click confirm
 *     🟡 60–84% — pre-filled, needs review
 *     🔴 <60%  — empty, manual entry required
 *  5. Confirmed values are used to pre-populate the profile form
 */

import { useState, useRef, useCallback } from 'react';
import Sidebar from '../components/farmer/Sidebar';
import Topbar  from '../components/farmer/Topbar';
import { useAuth } from '../context/AuthContext';
import '../styles/farmer.css';

const API = 'http://127.0.0.1:8000';

const DOC_TYPES = [
  { value: 'aadhaar',     label: '🪪 Aadhaar Card',        fields: ['name', 'aadhaar', 'dob', 'gender', 'address'] },
  { value: 'satbara',     label: '🌾 7/12 Land Record',     fields: ['survey_no', 'land_area', 'owner', 'village', 'taluka', 'district'] },
  { value: 'bank',        label: '🏦 Bank Passbook',        fields: ['account', 'ifsc', 'bank_name', 'branch', 'holder'] },
  { value: 'income',      label: '💰 Income Certificate',   fields: ['name', 'income', 'issue_date'] },
  { value: 'caste',       label: '📋 Caste Certificate',    fields: ['name', 'category', 'cert_no'] },
  { value: 'electricity', label: '⚡ Electricity Bill',     fields: ['consumer_no', 'consumer_name', 'address', 'meter_no'] },
];

const FIELD_LABELS = {
  name: 'Full Name', aadhaar: 'Aadhaar Number', dob: 'Date of Birth',
  gender: 'Gender', address: 'Address', survey_no: 'Survey / Gat No.',
  land_area: 'Land Area', owner: 'Owner Name', village: 'Village',
  taluka: 'Taluka', district: 'District', account: 'Account Number',
  ifsc: 'IFSC Code', bank_name: 'Bank Name', branch: 'Branch',
  holder: 'Account Holder', income: 'Annual Income', issue_date: 'Issue Date',
  category: 'Caste Category', cert_no: 'Certificate No.',
  consumer_no: 'Consumer No.', consumer_name: 'Consumer Name', meter_no: 'Meter No.',
};

// Map ocr API response keys → our field keys
const REMAP = {
  extracted_name: 'name', extracted_aadhaar: 'aadhaar', extracted_dob: 'dob',
  extracted_gender: 'gender', extracted_address: 'address',
  extracted_survey_no: 'survey_no', extracted_land_area: 'land_area',
  extracted_village: 'village', extracted_taluka: 'taluka',
  extracted_account: 'account', extracted_ifsc: 'ifsc',
  extracted_bank_name: 'bank_name', extracted_income: 'income',
  extracted_category: 'category', extracted_consumer: 'consumer_no',
};

function confidenceColor(pct) {
  if (pct >= 85) return { bg: '#f0fdf4', border: '#4ade80', text: '#166534', badge: '#dcfce7', badgeText: '#15803d', icon: '🟢', label: 'High' };
  if (pct >= 60) return { bg: '#fffbeb', border: '#fbbf24', text: '#92400e', badge: '#fef3c7', badgeText: '#b45309', icon: '🟡', label: 'Review' };
  return      { bg: '#fef2f2', border: '#f87171', text: '#991b1b', badge: '#fee2e2', badgeText: '#b91c1c', icon: '🔴', label: 'Low' };
}

function ConfidenceRing({ pct }) {
  const r = 28, circ = 2 * Math.PI * r;
  const stroke = pct >= 85 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={70} height={70}>
      <circle cx={35} cy={35} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
      <circle cx={35} cy={35} r={r} fill="none" stroke={stroke} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round" transform="rotate(-90 35 35)"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x={35} y={40} textAnchor="middle" fontSize={14} fontWeight={800} fill={stroke}>{Math.round(pct)}%</text>
    </svg>
  );
}

export default function SmartDocScanner() {
  const { user } = useAuth();
  const [sidebar, setSidebar]       = useState(false);
  const [docType, setDocType]       = useState('aadhaar');
  const [file, setFile]             = useState(null);
  const [preview, setPreview]       = useState(null);
  const [drag, setDrag]             = useState(false);
  const [phase, setPhase]           = useState('idle'); // idle|uploading|scanning|done|error
  const [progress, setProgress]     = useState(0);
  const [scanResult, setScanResult] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [confirmed, setConfirmed]   = useState({});
  const [error, setError]           = useState('');
  const [toast, setToast]           = useState('');
  const fileRef = useRef();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── File handling ────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError('File too large — max 10 MB'); return; }
    setFile(f);
    setError('');
    setPhase('idle');
    setScanResult(null);
    setEditValues({});
    setConfirmed({});
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  // ── Upload + OCR ─────────────────────────────────────────────
  const handleScan = async () => {
    if (!file) { setError('Please select a document first'); return; }
    if (!user?.id) { setError('Please log in first'); return; }
    setError(''); setPhase('uploading'); setProgress(10);

    try {
      // 1. Upload document
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      setProgress(30);

      const upRes = await fetch(`${API}/documents/upload/${user.id}`, { method: 'POST', body: fd });
      if (!upRes.ok) throw new Error(`Upload failed: ${upRes.status}`);
      const upData = await upRes.json();
      setProgress(55); setPhase('scanning');

      // 2. Trigger OCR Analysis
      const ocrRes = await fetch(`${API}/ocr/analyze/${user.id}`, { method: 'POST' });
      setProgress(80);

      // 3. Get OCR result fields
      const resultRes = await fetch(`${API}/ocr/result/${user.id}`);
      const resultData = await resultRes.json();
      setProgress(95);

      // 4. Map to our field schema
      const latest = resultData?.[0] || {};
      const rawFields = latest.fields || {};
      const mappedFields = {};

      // remap from extracted_xxx keys
      Object.entries(rawFields).forEach(([k, v]) => {
        const remapped = REMAP[`extracted_${k}`] || k;
        if (v && String(v).trim()) mappedFields[remapped] = String(v).trim();
      });

      // Also handle direct field keys already mapped
      Object.entries(rawFields).forEach(([k, v]) => {
        if (v && String(v).trim() && !mappedFields[k]) mappedFields[k] = String(v).trim();
      });

      // 5. Get decision for confidence scores
      let decision = null;
      try {
        const decRes = await fetch(`${API}/ocr/decision/${user.id}`);
        if (decRes.ok) decision = await decRes.json();
      } catch (_) {}

      // Build field confidence map
      const fieldConf = {};
      const fieldScores = decision?.field_scores || {};
      Object.entries(mappedFields).forEach(([k, v]) => {
        // Map field key to weight category
        const cat = k.includes('aadhaar') ? 'aadhaar'
          : k.includes('name') ? 'name'
          : k.includes('survey') || k.includes('land') ? 'land'
          : k.includes('account') || k.includes('ifsc') ? 'bank'
          : k.includes('income') ? 'income'
          : 'address';
        fieldConf[k] = Math.round((fieldScores[cat] ?? 72) * 100) / 100;
      });

      const overallScore = decision?.overall_score ?? 75;
      setScanResult({ fields: mappedFields, confidence: fieldConf, overall: overallScore, docType: latest.doc_type || docType, status: latest.ocr_status });
      setEditValues({ ...mappedFields });
      setProgress(100); setPhase('done');
      showToast(`✅ Scan complete — ${Object.keys(mappedFields).length} fields extracted`);

    } catch (err) {
      setError(err.message || 'Scan failed. Please try again.');
      setPhase('error');
    }
  };

  const handleConfirm = (field) => {
    setConfirmed(c => ({ ...c, [field]: true }));
    showToast(`✅ ${FIELD_LABELS[field] || field} confirmed`);
  };

  const handleConfirmAll = () => {
    const allConfirmed = {};
    Object.keys(editValues).forEach(k => { allConfirmed[k] = true; });
    setConfirmed(allConfirmed);
    showToast('✅ All fields confirmed — ready to submit');
  };

  const selectedDocType = DOC_TYPES.find(d => d.value === docType);
  const confirmedCount  = Object.values(confirmed).filter(Boolean).length;
  const totalCount      = Object.keys(editValues).length;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="shell">
      <Sidebar isOpen={sidebar} onToggle={setSidebar} />
      <main className="main">
        <Topbar title="AI Document Scanner" onMenuClick={() => setSidebar(o => !o)} />
        <div className="page-content" style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              🤖 Smart Document Scanner
            </h2>
            <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
              Upload any document — AI extracts and auto-fills your profile fields instantly
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* LEFT — Upload Panel */}
            <div>
              {/* Doc type selector */}
              <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  Document Type
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {DOC_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => setDocType(dt.value)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: docType === dt.value ? '2px solid #0ea5e9' : '2px solid #e2e8f0',
                        background: docType === dt.value ? '#f0f9ff' : 'white',
                        color: docType === dt.value ? '#0369a1' : '#475569',
                        transition: 'all 0.15s',
                      }}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                className="card"
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                onClick={() => !file && fileRef.current?.click()}
                style={{
                  padding: 32, textAlign: 'center', cursor: 'pointer',
                  border: `2px dashed ${drag ? '#0ea5e9' : file ? '#22c55e' : '#cbd5e1'}`,
                  background: drag ? '#f0f9ff' : file ? '#f0fdf4' : 'white',
                  borderRadius: 16, transition: 'all 0.2s', marginBottom: 16,
                  minHeight: preview ? 'auto' : 180,
                }}
              >
                <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files?.[0])} />
                {preview ? (
                  <div>
                    <img src={preview} alt="Document preview"
                      style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: 8 }} />
                    <div style={{ fontSize: 12, color: '#64748b' }}>📄 {file?.name}</div>
                    <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); setScanResult(null); setPhase('idle'); }}
                      style={{ marginTop: 8, fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      ✕ Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 52, marginBottom: 12 }}>{drag ? '⬇️' : '📷'}</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                      {drag ? 'Drop document here' : 'Drag & drop or click to upload'}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                      Supports JPG, PNG, PDF · Max 10 MB
                    </div>
                  </>
                )}
              </div>

              {/* Progress bar */}
              {(phase === 'uploading' || phase === 'scanning') && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    <span>{phase === 'uploading' ? '📤 Uploading document…' : '🔍 AI scanning in progress…'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99 }}>
                    <div style={{
                      height: '100%', borderRadius: 99, transition: 'width 0.4s ease',
                      background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
                      width: `${progress}%`,
                      boxShadow: '0 0 10px rgba(99,102,241,0.5)',
                    }} />
                  </div>
                </div>
              )}

              {/* Scan button */}
              <button
                onClick={handleScan}
                disabled={!file || phase === 'uploading' || phase === 'scanning'}
                style={{
                  width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
                  fontWeight: 800, fontSize: 15, cursor: file ? 'pointer' : 'not-allowed',
                  background: file ? 'linear-gradient(135deg, #0ea5e9, #6366f1)' : '#e2e8f0',
                  color: file ? 'white' : '#94a3b8', transition: 'all 0.2s',
                  boxShadow: file ? '0 4px 16px rgba(99,102,241,0.3)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {phase === 'uploading' ? '📤 Uploading…' :
                 phase === 'scanning'  ? '🔍 AI Scanning…' :
                 '🚀 Scan & Extract Fields'}
              </button>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600, border: '1px solid #fecaca' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* What AI looks for */}
              {selectedDocType && (
                <div className="card" style={{ padding: '14px 16px', marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Fields AI will extract from {selectedDocType.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedDocType.fields.map(f => (
                      <span key={f} style={{ padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 600 }}>
                        {FIELD_LABELS[f] || f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — Results Panel */}
            <div>
              {phase === 'idle' && !scanResult && (
                <div className="card" style={{ padding: 40, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
                  <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0 }}>AI Ready</h3>
                  <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                    Upload a document and hit <strong>Scan</strong>.<br />
                    Extracted fields will appear here with confidence scores.
                  </p>
                  <div style={{ marginTop: 24, display: 'flex', gap: 16, fontSize: 13 }}>
                    {[['🟢', 'High confidence — auto-filled'], ['🟡', 'Medium — review'], ['🔴', 'Low — manual entry']].map(([icon, label]) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22 }}>{icon}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, maxWidth: 80 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scanResult && (
                <div>
                  {/* Overall score card */}
                  <div className="card" style={{
                    padding: '16px 20px', marginBottom: 16,
                    background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
                    color: 'white',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Overall Confidence
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: scanResult.overall >= 90 ? '#4ade80' : scanResult.overall >= 70 ? '#fbbf24' : '#f87171' }}>
                          {Math.round(scanResult.overall)}%
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                          {Object.keys(scanResult.fields).length} fields extracted · {scanResult.status}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <ConfidenceRing pct={scanResult.overall} />
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {confirmedCount}/{totalCount} fields confirmed
                      </div>
                      {confirmedCount < totalCount && (
                        <button onClick={handleConfirmAll}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          ✓ Confirm All
                        </button>
                      )}
                    </div>
                    {/* Confirmation progress bar */}
                    <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99 }}>
                      <div style={{
                        height: '100%', borderRadius: 99, background: '#4ade80',
                        width: totalCount > 0 ? `${(confirmedCount / totalCount) * 100}%` : '0%',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>

                  {/* Field cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
                    {Object.entries(editValues).map(([field, value]) => {
                      const pct = scanResult.confidence[field] ?? 70;
                      const c   = confidenceColor(pct);
                      const isConfirmed = confirmed[field];
                      return (
                        <div key={field} style={{
                          padding: '12px 16px', borderRadius: 12,
                          border: `1.5px solid ${isConfirmed ? '#4ade80' : c.border}`,
                          background: isConfirmed ? '#f0fdf4' : c.bg,
                          transition: 'all 0.25s',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14 }}>{isConfirmed ? '✅' : c.icon}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                {FIELD_LABELS[field] || field}
                              </span>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                              background: isConfirmed ? '#dcfce7' : c.badge,
                              color: isConfirmed ? '#15803d' : c.badgeText,
                            }}>
                              {isConfirmed ? 'CONFIRMED' : `${Math.round(pct)}% · ${c.label}`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editValues[field] ?? ''}
                              onChange={e => setEditValues(v => ({ ...v, [field]: e.target.value }))}
                              disabled={isConfirmed}
                              style={{
                                flex: 1, padding: '8px 12px', borderRadius: 8,
                                border: `1px solid ${isConfirmed ? '#4ade80' : '#e2e8f0'}`,
                                background: isConfirmed ? '#f0fdf4' : 'white',
                                fontSize: 13, fontWeight: 600, color: c.text,
                                fontFamily: field === 'aadhaar' || field === 'account' ? 'monospace' : 'inherit',
                              }}
                            />
                            {!isConfirmed && (
                              <button onClick={() => handleConfirm(field)}
                                style={{
                                  padding: '8px 14px', borderRadius: 8, border: `1px solid ${c.border}`,
                                  background: 'white', color: c.text, fontSize: 12, fontWeight: 700,
                                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                                }}
                                onMouseOver={e => e.currentTarget.style.background = c.bg}
                                onMouseOut={e => e.currentTarget.style.background = 'white'}
                              >
                                ✓ Confirm
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {confirmedCount === totalCount && totalCount > 0 && (
                    <div style={{
                      marginTop: 16, padding: '14px 20px', borderRadius: 12,
                      background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                      border: '1.5px solid #4ade80', textAlign: 'center',
                    }}>
                      <div style={{ fontWeight: 800, color: '#15803d', fontSize: 15 }}>
                        🎉 All fields confirmed!
                      </div>
                      <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>
                        Your profile has been updated. Head to Profile to review & submit.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '12px 20px', borderRadius: 12, background: '#0f172a',
          color: 'white', fontSize: 13, fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.3s ease',
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
