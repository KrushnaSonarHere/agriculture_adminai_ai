import { useState, useEffect } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar  from '../../components/admin/AdminTopbar';
import { getFarmers, getProfile } from '../../api/farmers';
import { getDocuments } from '../../api/documents';
import api from '../../api/index';
import '../../styles/admin.css';


const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const DOC_ICONS = {
  aadhaar:'🪪', satbara:'🗺️', '8a':'📋', bank:'🏦',
  photo:'📷', caste:'📜', income:'📄', elec:'⚡', other:'📎',
};

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-dark)' }}>
      <span style={{ minWidth: 160, fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{value || <em style={{ color: 'var(--text3)', fontWeight: 400 }}>Not provided</em>}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', background: 'rgba(46,125,50,0.07)', padding: '6px 12px', borderRadius: 8, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10, padding: '0 4px' }}>{children}</div>
    </div>
  );
}

/* ── Farmer Detail Modal ── */
function FarmerModal({ farmer, onClose }) {
  const [profile, setProfile] = useState(null);
  const [docs, setDocs]       = useState([]);
  const [aiDecision, setAiDecision] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmer?.id) return;
    Promise.all([
      getProfile(farmer.id),
      getDocuments(farmer.id),
      api.get(`/ocr/decision/${farmer.id}`).catch(() => ({ data: null }))
    ])
      .then(([pr, dr, ar]) => {
        setProfile(pr.data);
        setDocs(dr.data || []);
        setAiDecision(ar.data);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [farmer?.id]);


  const p = profile?.profile;
  const maskAcc = (a) => a ? `••••••••${a.slice(-4)}` : '—';
  const maskAad = (a) => a ? `XXXX XXXX ${a.slice(-4)}` : '—';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', backdropFilter: 'blur(2px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 680, height: '100vh', background: 'var(--card)', boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', overflow: 'auto', position: 'relative' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', padding: '24px 24px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👨‍🌾</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{farmer.full_name}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                {farmer.farmer_id || '—'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}>
                  {farmer.district || '—'}
                </span>
                <span style={{ background: farmer.profile_complete ? 'rgba(102,187,106,0.3)' : 'rgba(255,183,77,0.3)', color: farmer.profile_complete ? '#a5f3a8' : '#ffe082', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}>
                  {farmer.profile_complete ? '✔ Complete' : '⚠ Incomplete'}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>⏳ Loading farmer details…</div>
          )}

          {!loading && (
            <>
              {/* Account Info */}
              <Section title="📋 Account Information">
                <DetailRow label="User ID"    value={`#${farmer.id}`} />
                <DetailRow label="Farmer ID"  value={farmer.farmer_id} />
                <DetailRow label="Full Name"  value={farmer.full_name} />
                <DetailRow label="Mobile"     value={profile?.mobile ? '+91 ' + profile.mobile : null} />
                <DetailRow label="Email"      value={profile?.email} />
              </Section>

              {/* AI Verification Section */}
              <Section title="🤖 AI Document Intelligence">
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current AI Status</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: aiDecision ? (aiDecision.decision === 'auto_approved' ? '#10b981' : aiDecision.decision === 'flagged' ? '#ef4444' : '#f59e0b') : '#94a3b8' }}>
                        {aiDecision ? aiDecision.decision.replace('_', ' ').toUpperCase() : 'PENDING ANALYSIS'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Fuzzy Match Score</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: aiDecision?.overall_score >= 85 ? '#10b981' : '#f59e0b' }}>
                        {aiDecision ? Math.round(aiDecision.overall_score) : '—'}
                      </div>
                    </div>
                  </div>
                  
                  {aiDecision && (
                    <>
                      <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>FRAUD RISK</div>
                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${aiDecision.fraud_risk}%`, height: '100%', background: aiDecision.fraud_risk > 70 ? '#ef4444' : aiDecision.fraud_risk > 40 ? '#f59e0b' : '#10b981' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {aiDecision.risk_factors?.map(f => (
                          <span key={f} style={{ background: '#fee2e2', color: '#dc2626', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>⚠️ {f}</span>
                        ))}
                        {aiDecision.positive_factors?.map(f => (
                          <span key={f} style={{ background: '#dcfce7', color: '#166534', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>✅ {f}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Section>

              <Section title="🌎 State & District">
                <DetailRow label="State"      value={profile?.state} />
                <DetailRow label="District"   value={profile?.district} />

                <DetailRow label="Registered" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' }) : null} />
              </Section>

              {p ? (
                <>
                  <Section title="👤 Personal Details">
                    <DetailRow label="Father / Husband" value={p.father_name} />
                    <DetailRow label="Date of Birth"    value={p.dob} />
                    <DetailRow label="Gender"           value={p.gender} />
                  </Section>

                  <Section title="🪪 Identity Details">
                    <DetailRow label="Aadhaar" value={maskAad(p.aadhaar)} />
                    <DetailRow label="PAN"     value={p.pan} />
                    <DetailRow label="Voter ID"value={p.voter_id} />
                  </Section>

                  <Section title="🏦 Bank Details (DBT)">
                    <DetailRow label="Account No." value={maskAcc(p.bank_account)} />
                    <DetailRow label="IFSC"         value={p.ifsc} />
                    <DetailRow label="Bank Name"    value={p.bank_name} />
                    <DetailRow label="Branch"       value={p.branch_name} />
                    <DetailRow label="Account Type" value={p.account_type} />
                  </Section>

                  <Section title="🌍 Address & Land">
                    <DetailRow label="Village"       value={p.village} />
                    <DetailRow label="Taluka"        value={p.taluka} />
                    <DetailRow label="Pin Code"      value={p.pincode} />
                    <DetailRow label="Full Address"  value={p.full_address} />
                    <DetailRow label="Gat / Survey No." value={p.gat_number} />
                    <DetailRow label="Land Area"     value={p.land_area} />
                    <DetailRow label="7/12 Satbara"  value={p.satbara} />
                    <DetailRow label="8-A Cert. No." value={p.eight_a} />
                    <DetailRow label="Ownership"     value={p.ownership_type} />
                  </Section>

                  <Section title="🌱 Farming & Category">
                    <DetailRow label="Primary Crop"      value={p.crop_type} />
                    <DetailRow label="Irrigation Type"   value={p.irrigation_type} />
                    <DetailRow label="Farming Method"    value={p.farming_type} />
                    <DetailRow label="Electricity"       value={p.electricity} />
                    <DetailRow label="Caste Category"    value={p.caste_category?.toUpperCase()} />
                    <DetailRow label="Income Bracket"    value={p.income_bracket} />
                    <DetailRow label="BPL Status"        value={p.bpl_status === 'yes' ? 'BPL Card Holder' : 'Not BPL'} />
                    <DetailRow label="AgriStack ID"      value={p.agristack_id} />
                  </Section>
                </>
              ) : (
                <div style={{ background: '#FFF3E0', border: '1px solid rgba(239,108,0,0.3)', borderRadius: 10, padding: 16, fontSize: 13, color: '#E65100', marginBottom: 20 }}>
                  ⚠️ Farmer has not completed their profile yet.
                </div>
              )}

              {/* Documents */}
              <Section title={`📎 Uploaded Documents (${docs.length})`}>
                {docs.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>No documents uploaded yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
                    {docs.map(doc => (
                      <div key={doc.id} style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12, textAlign: 'center', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{DOC_ICONS[doc.doc_type] || '📎'}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', marginBottom: 4 }}>{doc.doc_type}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, wordBreak: 'break-all' }}>
                          {doc.filename?.substring(0,18)}{doc.filename?.length > 18 ? '…' : ''}
                        </div>
                        <a href={`${API}${doc.url}`} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-block', background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>
                          View →
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════ MAIN PAGE ══════════════ */
export default function Farmers() {
  const [collapsed, setCollapsed] = useState(false);
  const [farmers, setFarmers]     = useState([]);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null); // farmer row for modal

  useEffect(() => {
    getFarmers()
      .then(r => { if (r.data?.length > 0) setFarmers(r.data); })
      .catch(() => {});
  }, []);

  const filtered = farmers.filter(f =>
    (f.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.district || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.farmer_id || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        <div className="admin-content">
          <div className="page-heading">Registered Farmers</div>
          <div className="page-sub">Click any farmer row to view their complete profile and uploaded documents</div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Farmers',    value: farmers.length,                                             color: '#2e7d32', bg: '#e8f5e9' },
              { label: 'Profile Complete', value: farmers.filter(f => f.profile_complete).length,             color: '#1565C0', bg: '#E3F2FD' },
              { label: 'Pending Profile',  value: farmers.filter(f => !f.profile_complete).length,            color: '#E65100', bg: '#FFF3E0' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '12px 20px', flex: '1 1 140px', minWidth: 140 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="filters-bar">
              <div className="filter-search">
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>🔍</span>
                <input placeholder="Search by name, district or Farmer ID…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="table-header">
              <span className="table-header-title">Registered Farmers</span>
              <span className="table-header-count">{filtered.length} farmers</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Farmer</th>
                    <th>Farmer ID</th>
                    <th>AI Status</th>
                    <th>District</th>
                    <th>Profile</th>
                    <th>Action</th>
                  </tr>

                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>No farmers registered yet.</td></tr>
                  )}
                  {filtered.map(f => (
                    <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(f)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="farmer-avatar-admin">{(f.full_name || 'F')[0]}</div>
                          <div className="farmer-name">{f.full_name}</div>
                        </div>
                      </td>
                      <td className="app-id">{f.farmer_id || '—'}</td>
                      <td>
                        <span style={{ 
                          fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 8,
                          background: f.ai_status === 'auto_approved' ? '#dcfce7' : f.ai_status === 'flagged' ? '#fee2e2' : f.ai_status === 'manual_review' ? '#fef3c7' : '#f1f5f9',
                          color: f.ai_status === 'auto_approved' ? '#166534' : f.ai_status === 'flagged' ? '#991b1b' : f.ai_status === 'manual_review' ? '#92400e' : '#64748b'
                        }}>
                          {f.ai_status ? f.ai_status.replace('_', ' ').toUpperCase() : 'PENDING'}
                        </span>
                      </td>
                      <td>{f.district || '—'}</td>
                      <td>
                        <span className={`badge ${f.profile_complete ? 'badge-approved' : 'badge-pending'}`}>
                          {f.profile_complete ? '✔ Complete' : '⚠ Incomplete'}
                        </span>
                      </td>

                      <td>
                        <button className="action-btn action-btn-view"
                          onClick={e => { e.stopPropagation(); setSelected(f); }}>
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {selected && <FarmerModal farmer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
