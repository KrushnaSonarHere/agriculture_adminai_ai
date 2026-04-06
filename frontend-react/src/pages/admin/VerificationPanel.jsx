/**
 * VerificationPanel.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Premium Admin AI Verification Dashboard
 *  
 * Shows for each application:
 *  Tab 1 — 📄 Document  → document image preview + raw OCR text
 *  Tab 2 — ⚖️ Compare  → side-by-side farmer form vs OCR with match %
 *  Tab 3 — 🤖 AI Score → animated dials + per-field breakdown
 *  Tab 4 — ✅ Decide  → admin action panel (approve/reject/flag + remarks)
 *
 * Route: /admin/verify/:applicationId
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar  from '../../components/admin/AdminTopbar';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin.css';

const API = 'http://127.0.0.1:8000';

// ── Helpers ──────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct >= 85) return '#22c55e';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}
function pctBg(pct) {
  if (pct >= 85) return '#f0fdf4';
  if (pct >= 60) return '#fffbeb';
  return '#fef2f2';
}
function pctBadge(pct) {
  if (pct >= 85) return { bg: '#dcfce7', text: '#15803d', label: 'MATCH' };
  if (pct >= 60) return { bg: '#fef3c7', text: '#b45309', label: 'PARTIAL' };
  return { bg: '#fee2e2', text: '#b91c1c', label: 'MISMATCH' };
}

// Animated arc gauge
function ScoreGauge({ score, label, size = 120 }) {
  const r = size / 2 - 12;
  const circ = Math.PI * r; // half circle
  const pct  = Math.min(Math.max(score, 0), 100);
  const fill  = (pct / 100) * circ;
  const color = pctColor(pct);

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size / 2 + 20} style={{ overflow: 'visible' }}>
        {/* Track */}
        <path d={`M ${12} ${size/2} A ${r} ${r} 0 0 1 ${size-12} ${size/2}`}
          fill="none" stroke="#e2e8f0" strokeWidth={10} strokeLinecap="round" />
        {/* Fill */}
        <path d={`M ${12} ${size/2} A ${r} ${r} 0 0 1 ${size-12} ${size/2}`}
          fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }} />
        {/* Score text */}
        <text x={size/2} y={size/2 + 2} textAnchor="middle" fontSize={22} fontWeight={900} fill={color}>
          {Math.round(pct)}
        </text>
        <text x={size/2} y={size/2 + 18} textAnchor="middle" fontSize={10} fill="#94a3b8" fontWeight={700}>
          {label}
        </text>
      </svg>
    </div>
  );
}

// Horizontal field match bar
function FieldBar({ field, farmerVal, ocrVal, matchPct, weight }) {
  const badge = pctBadge(matchPct);
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10, marginBottom: 10,
      background: pctBg(matchPct), border: `1.5px solid ${pctColor(matchPct)}22`,
      transition: 'all 0.25s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          {field.replace(/_/g, ' ')}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>w={weight.toFixed(2)}</span>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: badge.bg, color: badge.text }}>
            {badge.label}
          </span>
          <span style={{ fontSize: 14, fontWeight: 900, color: pctColor(matchPct) }}>
            {Math.round(matchPct)}%
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[['👨‍🌾 Farmer Form', farmerVal], ['🤖 OCR Extracted', ocrVal]].map(([label, val]) => (
          <div key={label} style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'white', border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: val ? '#1e293b' : '#cbd5e1', fontFamily: field.includes('aadhaar') || field.includes('account') ? 'monospace' : 'inherit' }}>
              {val || '—'}
            </div>
          </div>
        ))}
      </div>
      {/* Match bar */}
      <div style={{ marginTop: 8, height: 4, background: '#e2e8f0', borderRadius: 99 }}>
        <div style={{
          height: '100%', borderRadius: 99, background: pctColor(matchPct),
          width: `${matchPct}%`, transition: 'width 1s ease',
        }} />
      </div>
    </div>
  );
}

const TABS = ['📄 Document', '⚖️ Compare', '🤖 AI Score', '✅ Decide'];

export default function VerificationPanel() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState(null);
  const [ocrDocs, setOcrDocs] = useState([]);
  const [decision, setDecision] = useState('');
  const [remarks, setRemarks]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decided, setDecided] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  // Fetch verification data
  useEffect(() => {
    const appId = applicationId || 1;
    const load = async () => {
      setLoading(true); setError('');
      try {
        // Trigger pipeline first (idempotent)
        await fetch(`${API}/verify/${appId}`, { method: 'POST' }).catch(() => {});

        // Get status
        const stRes = await fetch(`${API}/verify/${appId}/status`);
        const stData = stRes.ok ? await stRes.json() : {};
        setStatus(stData);

        // Get full report
        const rpRes = await fetch(`${API}/verify/${appId}/report`);
        if (rpRes.ok) {
          setReport(await rpRes.json());
        } else if (rpRes.status === 404) {
          // Still processing — use status
          setReport(null);
        }
      } catch (e) {
        setError('Failed to load verification data. Ensure backend is running.');
      }
      setLoading(false);
    };
    load();
  }, [applicationId]);

  const handleDecide = async () => {
    if (!decision) { showToast('Please select a decision first'); return; }
    if (!user?.id) { showToast('Not authenticated'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/verify/${applicationId || 1}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id:   user.id,
          admin_name: user.full_name || 'Admin',
          decision,
          remarks,
        }),
      });
      if (!res.ok) throw new Error('Decision failed');
      setDecided(decision);
      showToast(`✅ Decision recorded: ${decision.toUpperCase()}`);
    } catch (e) {
      showToast('❌ Failed to record decision');
    }
    setSubmitting(false);
  };

  const score = status?.overall_score ?? report?.overall_score ?? 0;
  const fraud = status?.fraud_risk ?? report?.fraud_risk ?? 0;
  const rec   = status?.final_decision ?? report?.recommendation ?? 'review';
  const fieldReports = report?.field_reports ?? [];

  const recBadge = rec === 'approve'
    ? { bg: '#dcfce7', text: '#15803d', label: '✅ AUTO-APPROVE', border: '#4ade80' }
    : rec === 'reject'
    ? { bg: '#fee2e2', text: '#b91c1c', label: '❌ AUTO-REJECT', border: '#f87171' }
    : { bg: '#fef3c7', text: '#b45309', label: '⚠️ MANUAL REVIEW', border: '#fbbf24' };

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        <div className="admin-content">

          {/* Header */}
          <div className="admin-header-row" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => navigate('/admin/applications')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }}>
                ←
              </button>
              <div>
                <h1 className="admin-title">🔬 AI Verification Panel</h1>
                <p className="admin-subtitle">Application #{applicationId} · Full document intelligence report</p>
              </div>
            </div>
            {!loading && (
              <div style={{
                padding: '8px 16px', borderRadius: 10,
                background: recBadge.bg, border: `1.5px solid ${recBadge.border}`,
                color: recBadge.text, fontWeight: 800, fontSize: 13,
              }}>
                {recBadge.label}
              </div>
            )}
          </div>

          {loading ? (
            <div className="admin-card" style={{ padding: 60, textAlign: 'center' }}>
              <div className="spinner" />
              <p style={{ marginTop: 16, color: 'var(--text3)' }}>Running AI verification pipeline…</p>
            </div>
          ) : error ? (
            <div className="alert-error">{error}</div>
          ) : (
            <>
              {/* Score Summary Strip */}
              <div className="admin-card" style={{ padding: '16px 24px', marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <ScoreGauge score={score}  label="Overall"    size={110} />
                <ScoreGauge score={Math.max(0, 100 - fraud)} label="Trust Score" size={110} />
                <ScoreGauge score={report?.positive_factors?.length ? 85 : 65} label="Doc Quality" size={110} />
                <div style={{ flex: 1, borderLeft: '1px solid #e2e8f0', paddingLeft: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                    Field Summary
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Total Fields',  val: fieldReports.length,                                        color: '#64748b' },
                      { label: 'Matched',        val: fieldReports.filter(f => f.status === 'match').length,      color: '#22c55e' },
                      { label: 'Partial',        val: fieldReports.filter(f => f.status === 'partial').length,    color: '#f59e0b' },
                      { label: 'Mismatched',     val: fieldReports.filter(f => f.status === 'mismatch').length,   color: '#ef4444' },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>{m.val}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f1f5f9', padding: 4, borderRadius: 12, width: 'fit-content' }}>
                {TABS.map((t, i) => (
                  <button key={t} onClick={() => setTab(i)}
                    style={{
                      padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
                      background: tab === i ? 'white' : 'transparent',
                      color:      tab === i ? '#0f172a' : '#64748b',
                      boxShadow:  tab === i ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                    }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* ── TAB 0: Document ── */}
              {tab === 0 && (
                <div className="admin-card" style={{ padding: 24 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
                    📄 Document Preview & Raw OCR Text
                  </h3>
                  {report?.field_reports?.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Document Image</div>
                        <div style={{
                          height: 300, background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid #e2e8f0', fontSize: 48,
                        }}>
                          📄
                        </div>
                        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
                          Preview available when file is stored locally
                        </p>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Raw OCR Output</div>
                        <div style={{
                          height: 300, background: '#0f172a', color: '#e2e8f0', borderRadius: 12,
                          padding: 16, fontFamily: 'monospace', fontSize: 12, overflowY: 'auto',
                          lineHeight: 1.7,
                        }}>
                          {report?.field_reports?.map(f => `${f.field_name}: ${f.ocr_value || '—'}`).join('\n') || 'No raw OCR text available'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                      <div style={{ fontSize: 48 }}>📭</div>
                      <p style={{ marginTop: 12 }}>No OCR data found. Documents may not have been uploaded yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 1: Compare ── */}
              {tab === 1 && (
                <div className="admin-card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
                      ⚖️ Field-by-Field Comparison
                    </h3>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      Sorted by field weight (highest impact first)
                    </div>
                  </div>
                  {fieldReports.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>⚖️</div>
                      <p>No comparison data yet. Trigger verification first.</p>
                      <button onClick={() => fetch(`${API}/verify/${applicationId || 1}`, { method: 'POST' }).then(() => window.location.reload())}
                        style={{ marginTop: 12, padding: '10px 20px', borderRadius: 8, background: '#0ea5e9', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                        🚀 Run Verification
                      </button>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 540, overflowY: 'auto', paddingRight: 4 }}>
                      {fieldReports.sort((a, b) => b.weight - a.weight).map(f => (
                        <FieldBar key={f.field_name}
                          field={f.field_name}
                          farmerVal={f.farmer_value}
                          ocrVal={f.ocr_value}
                          matchPct={f.match_percentage}
                          weight={f.weight} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: AI Score ── */}
              {tab === 2 && (
                <div>
                  {/* Fraud risk alert */}
                  {fraud > 50 && (
                    <div style={{
                      padding: '12px 20px', borderRadius: 10, marginBottom: 16,
                      background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#b91c1c',
                      fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      ⚠️ High fraud risk detected ({Math.round(fraud)}%) — manual review recommended
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="admin-card" style={{ padding: 24 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 20, color: '#1e293b' }}>🤖 AI Score Breakdown</div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 24 }}>
                        <ScoreGauge score={score}  label="Overall"      size={100} />
                        <ScoreGauge score={100 - fraud} label="Trust"  size={100} />
                        <ScoreGauge score={report?.positive_factors?.length * 20 || 60} label="Evidence" size={100} />
                      </div>

                      {/* Per-field score bars */}
                      <div>
                        {fieldReports.slice(0, 6).map(f => (
                          <div key={f.field_name} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: '#475569', textTransform: 'capitalize' }}>
                                {f.field_name.replace(/_/g, ' ')}
                              </span>
                              <span style={{ fontWeight: 800, color: pctColor(f.match_percentage) }}>
                                {Math.round(f.match_percentage)}%
                              </span>
                            </div>
                            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99 }}>
                              <div style={{
                                height: '100%', borderRadius: 99,
                                background: `linear-gradient(90deg, ${pctColor(f.match_percentage)}, ${pctColor(f.match_percentage)}99)`,
                                width: `${f.match_percentage}%`, transition: 'width 1s ease',
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="admin-card" style={{ padding: 24 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: '#1e293b' }}>📊 Decision Factors</div>

                      {report?.positive_factors?.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>✅ Positive Signals</div>
                          {report.positive_factors.map((f, i) => (
                            <div key={i} style={{ padding: '8px 12px', marginBottom: 6, background: '#f0fdf4', borderLeft: '3px solid #22c55e', borderRadius: '0 8px 8px 0', fontSize: 13, color: '#166534', fontWeight: 600 }}>
                              {f}
                            </div>
                          ))}
                        </div>
                      )}

                      {report?.risk_factors?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Risk Signals</div>
                          {report.risk_factors.map((f, i) => (
                            <div key={i} style={{ padding: '8px 12px', marginBottom: 6, background: '#fef2f2', borderLeft: '3px solid #ef4444', borderRadius: '0 8px 8px 0', fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
                              {f}
                            </div>
                          ))}
                        </div>
                      )}

                      {!report?.positive_factors?.length && !report?.risk_factors?.length && (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>
                          Run verification to generate AI factor analysis
                        </div>
                      )}

                      {/* Decision threshold guide */}
                      <div style={{ marginTop: 20, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>Threshold Guide</div>
                        {[['≥ 90%', 'AUTO APPROVE', '#22c55e'], ['70–89%', 'MANUAL REVIEW', '#f59e0b'], ['< 70%', 'AUTO REJECT', '#ef4444']].map(([range, label, color]) => (
                          <div key={range} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace', fontWeight: 700 }}>{range}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 99, background: color + '22', color }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 3: Decide ── */}
              {tab === 3 && (
                <div className="admin-card" style={{ padding: 28, maxWidth: 640 }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                    ✅ Admin Decision
                  </h3>

                  {decided ? (
                    <div style={{
                      padding: '24px', borderRadius: 14, textAlign: 'center',
                      background: decided === 'approve' ? '#f0fdf4' : decided === 'reject' ? '#fef2f2' : '#fffbeb',
                      border: `2px solid ${decided === 'approve' ? '#4ade80' : decided === 'reject' ? '#f87171' : '#fbbf24'}`,
                    }}>
                      <div style={{ fontSize: 52 }}>{decided === 'approve' ? '✅' : decided === 'reject' ? '❌' : '🚩'}</div>
                      <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8, color: '#1e293b' }}>
                        Decision Recorded: {decided.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Audit log entry created · Application status updated</div>
                    </div>
                  ) : (
                    <>
                      {/* AI recommendation banner */}
                      <div style={{
                        padding: '12px 16px', borderRadius: 10, marginBottom: 20,
                        background: recBadge.bg, border: `1.5px solid ${recBadge.border}`,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>AI Recommendation</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: recBadge.text, marginTop: 2 }}>{recBadge.label}</div>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: recBadge.text }}>{Math.round(score)}%</div>
                      </div>

                      {/* Decision buttons */}
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                        Your Decision
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                        {[
                          { val: 'approve', icon: '✅', label: 'Approve',  bg: '#f0fdf4', border: '#4ade80', color: '#15803d' },
                          { val: 'reject',  icon: '❌', label: 'Reject',   bg: '#fef2f2', border: '#f87171', color: '#b91c1c' },
                          { val: 'flag',    icon: '🚩', label: 'Flag',     bg: '#fffbeb', border: '#fbbf24', color: '#b45309' },
                        ].map(d => (
                          <button key={d.val} onClick={() => setDecision(d.val)}
                            style={{
                              padding: '16px 8px', borderRadius: 12, cursor: 'pointer', fontWeight: 800,
                              fontSize: 13, border: `2px solid ${decision === d.val ? d.border : '#e2e8f0'}`,
                              background: decision === d.val ? d.bg : 'white', color: decision === d.val ? d.color : '#64748b',
                              transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                              boxShadow: decision === d.val ? `0 4px 12px ${d.border}66` : 'none',
                            }}>
                            <span style={{ fontSize: 24 }}>{d.icon}</span>
                            {d.label}
                          </button>
                        ))}
                      </div>

                      {/* Remarks */}
                      <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                          Remarks / Notes
                        </label>
                        <textarea
                          rows={4} placeholder="Optional: Add remarks about this decision…"
                          value={remarks} onChange={e => setRemarks(e.target.value)}
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                            fontSize: 13, resize: 'vertical', fontFamily: 'inherit', color: '#1e293b',
                            boxSizing: 'border-box', outline: 'none',
                          }}
                        />
                      </div>

                      <button onClick={handleDecide} disabled={submitting || !decision}
                        style={{
                          width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
                          fontWeight: 800, fontSize: 15, cursor: decision ? 'pointer' : 'not-allowed',
                          background: decision
                            ? decision === 'approve' ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                            : decision === 'reject'  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                            : 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : '#e2e8f0',
                          color: decision ? 'white' : '#94a3b8',
                          boxShadow: decision ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
                          transition: 'all 0.2s',
                        }}>
                        {submitting ? '⏳ Recording…' : decision ? `Submit: ${decision.toUpperCase()}` : 'Select a decision above'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '12px 20px', borderRadius: 12, background: '#0f172a',
          color: 'white', fontSize: 13, fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.3s ease',
        }}>
          {toast}
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
