import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar  from '../../components/admin/AdminTopbar';
import { getApplications, approveApplication, rejectApplication, reviewApplication } from '../../api/applications';
import '../../styles/admin.css';

const STATUS_CLS = {
  Approved:    'badge-approved',
  Pending:     'badge-pending',
  Processing:  'badge-review',
  Rejected:    'badge-rejected',
  Flagged:     'badge-filed',
};
const DEMO = [
  { id: 1, app_number: 'APP-2026-155', farmer_name: 'Suresh Patil',  farmer_id: 'KID-MH-2026-001', mobile: '9876543210', district: 'Nashik',    scheme_name: 'PM-KISAN',              status: 'Pending',    applied_at: '2026-03-25', land_acres: '2.5', crop_type: 'Wheat',  bank_account: '****4321' },
  { id: 2, app_number: 'APP-2026-107', farmer_name: 'Lakshmi Devi',  farmer_id: 'KID-MH-2026-002', mobile: '8765432109', district: 'Pune',      scheme_name: 'Pradhan Mantri Fasal Bima Yojana', status: 'Processing', applied_at: '2026-03-20', land_acres: '1.8', crop_type: 'Rice',   bank_account: '****9812' },
  { id: 3, app_number: 'APP-2026-188', farmer_name: 'Rajesh Kumar',  farmer_id: 'KID-MH-2026-003', mobile: '7654321098', district: 'Nagpur',    scheme_name: 'Soil Health Card',      status: 'Pending',    applied_at: '2026-03-18', land_acres: '3.2', crop_type: 'Soybean',bank_account: '****6677' },
  { id: 4, app_number: 'APP-2026-122', farmer_name: 'Priya Singh',   farmer_id: 'KID-MH-2026-004', mobile: '6543210987', district: 'Aurangabad',scheme_name: 'PM-KISAN',              status: 'Approved',   applied_at: '2026-03-15', land_acres: '4.0', crop_type: 'Cotton', bank_account: '****2211' },
  { id: 5, app_number: 'APP-2026-098', farmer_name: 'Mohan Reddy',   farmer_id: 'KID-MH-2026-005', mobile: '5432109876', district: 'Solapur',   scheme_name: 'PMKSY Micro Irrigation',status: 'Rejected',   applied_at: '2026-03-10', land_acres: '1.2', crop_type: 'Onion',  bank_account: '****8843' },
  { id: 6, app_number: 'APP-2026-091', farmer_name: 'Vijay Singh',   farmer_id: 'KID-MH-2026-006', mobile: '4321098765', district: 'Nashik',    scheme_name: 'Kisan Credit Card',     status: 'Pending',    applied_at: '2026-03-08', land_acres: '5.5', crop_type: 'Grapes', bank_account: '****5566' },
];

/* ── Action Modal ──────────────────────────────────────────── */
function DecisionModal({ app, action, onClose, onConfirm }) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const actionConfig = {
    Approved:   { label: '✅ Approve Application', bg: '#f0fdf4', border: '#10b981', btnBg: '#10b981', color: '#166534' },
    Rejected:   { label: '❌ Reject Application',  bg: '#fef2f2', border: '#ef4444', btnBg: '#ef4444', color: '#991b1b' },
    Processing: { label: '📋 Send for Review',    bg: '#eff6ff', border: '#3b82f6', btnBg: '#3b82f6', color: '#1d4ed8' },
  };
  const cfg = actionConfig[action] || actionConfig.Processing;

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(app.id || app.app_number, action, remarks);
    setLoading(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: cfg.bg, padding: '20px 24px', borderBottom: `1px solid ${cfg.border}44`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: cfg.color }}>{cfg.label}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{app.app_number} — {app.farmer_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: '#475569' }}>
            <strong>{app.farmer_name}</strong> applied for <strong>{app.scheme_name}</strong>.
            Land: {app.land_acres} acres · Crop: {app.crop_type}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: '#475569' }}>Admin Remarks (optional)</label>
            <textarea
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', minHeight: 90, resize: 'vertical', boxSizing: 'border-box' }}
              placeholder="Add remarks for farmer or internal record..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={loading} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: cfg.btnBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ MAIN PAGE ══════════════ */
export default function AdminApplications() {
  const [collapsed, setCollapsed] = useState(false);
  const [apps,      setApps]      = useState(DEMO);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('All');
  const [modal,     setModal]     = useState(null); // { app, action }
  const [loading,   setLoading]   = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getApplications({ limit: 200 })
      .then(r => { if (r.data?.length > 0) setApps(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = apps.filter(a => {
    const q = search.toLowerCase();
    const matchFilter = filter === 'All' || a.status === filter;
    const matchSearch = !q ||
      (a.farmer_name || '').toLowerCase().includes(q) ||
      (a.app_number   || a.id || '').toString().toLowerCase().includes(q) ||
      (a.scheme_name  || a.scheme || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const handleDecision = async (id, action, remarks) => {
    try {
      if (action === 'Approved')   await approveApplication(id, remarks);
      else if (action === 'Rejected')  await rejectApplication(id, remarks);
      else await reviewApplication(id, remarks);
    } catch (e) { console.warn(e); }
    setApps(prev => prev.map(a =>
      (a.id === id || a.app_number === id) ? { ...a, status: action, admin_remarks: remarks } : a
    ));
  };

  const counts = {
    total:     apps.length,
    pending:   apps.filter(a => a.status === 'Pending').length,
    approved:  apps.filter(a => a.status === 'Approved').length,
    rejected:  apps.filter(a => a.status === 'Rejected').length,
    review:    apps.filter(a => a.status === 'Processing').length,
  };

  const getSchemeLabel = (a) => {
    if (a.scheme_name) return a.scheme_name;
    if (typeof a.scheme === 'string') return a.scheme;
    if (a.scheme && typeof a.scheme === 'object') return a.scheme.Scheme_Name || '—';
    return '—';
  };
  const getDate = (a) => {
    const d = a.applied_at || a.date;
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
  };

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        <div className="admin-content">

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>☰ Applications</div>
              <div style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Review and process all scheme applications</div>
            </div>
          </div>


          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total',      val: counts.total,    color: '#475569', bg: '#f8fafc' },
              { label: 'Pending',    val: counts.pending,  color: '#d97706', bg: '#fffbeb' },
              { label: 'Approved',   val: counts.approved, color: '#059669', bg: '#ecfdf5' },
              { label: 'Rejected',   val: counts.rejected, color: '#dc2626', bg: '#fef2f2' },
              { label: 'In Review',  val: counts.review,   color: '#2563eb', bg: '#eff6ff' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${s.color}22` }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="filters-bar">
              <div className="filter-search">
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>🔍</span>
                <input placeholder="Search by name, application ID or scheme…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
                {['All', 'Pending', 'Processing', 'Approved', 'Rejected'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="table-header">
              <span className="table-header-title">Applications</span>
              <span className="table-header-count">{filtered.length} records</span>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>App ID</th>
                    <th>Farmer</th>
                    <th>Scheme</th>
                    <th>Land / Crop</th>
                    <th>Bank</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No applications found.</td></tr>
                  )}
                  {filtered.map(a => (
                    <tr key={a.id || a.app_number}>
                      <td className="app-id">{a.app_number || `APP-${a.id}`}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                            {a.farmer_name?.[0] || 'F'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.farmer_name}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{a.farmer_id || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 500, maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getSchemeLabel(a)}</div>
                        {a.district && <div style={{ fontSize: 11, color: '#94a3b8' }}>📍 {a.district}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{a.land_acres || '—'} acres</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.crop_type || '—'}</div>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>{a.bank_account || '—'}</td>
                      <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{getDate(a)}</td>
                      <td><span className={`badge ${STATUS_CLS[a.status] || 'badge-pending'}`}>{a.status}</span></td>
                      <td>
                        {a.status === 'Pending' || a.status === 'Processing' ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', padding: '4px 10px', fontWeight: 700 }}
                              onClick={() => navigate(`/admin/verify/${a.id}`)}
                              title="AI Verify"
                            >🔬</button>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '4px 10px' }}
                              onClick={() => setModal({ app: a, action: 'Approved' })}
                              title="Approve"
                            >✅</button>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '4px 10px' }}
                              onClick={() => setModal({ app: a, action: 'Processing' })}
                              title="Send for Review"
                            >📋</button>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '4px 10px' }}
                              onClick={() => setModal({ app: a, action: 'Rejected' })}
                              title="Reject"
                            >❌</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {a.status === 'Approved' ? '✅ Done' : a.status === 'Rejected' ? '❌ Closed' : '—'}
                          </span>

                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Decision Modal */}
      {modal && (
        <DecisionModal
          app={modal.app}
          action={modal.action}
          onClose={() => setModal(null)}
          onConfirm={handleDecision}
        />
      )}
    </div>
  );
}
