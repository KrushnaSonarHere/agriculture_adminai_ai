import { useState, useEffect } from 'react';
import Sidebar from '../components/farmer/Sidebar';
import Topbar from '../components/farmer/Topbar';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/index';
import '../styles/farmer.css';

const STATUS_CLASS = {
  Approved:       'tag-approved',
  Pending:        'tag-pending',
  'Under Review': 'tag-processing',
  Processing:     'tag-processing',
  Rejected:       'tag-rejected',
  Submitted:      'tag-submitted',
};

const STATUS_ICON = {
  Approved: '✅', Pending: '⏳', Processing: '📋',
  'Under Review': '📋', Rejected: '❌', Submitted: '📨',
};

export default function Applications() {
  const { user }                      = useAuth();
  const navigate                      = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apps, setApps]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('All');

  useEffect(() => {
    if (!user?.farmer_id) { setLoading(false); return; }

    // Fetch ONLY this farmer's applications via /applications/farmer/{farmer_id}
    api.get(`/applications/farmer/${user.farmer_id}`)
      .then(r => setApps(r.data || []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [user?.farmer_id]);

  const getSchemeName = (a) =>
    typeof a.scheme === 'object'
      ? a.scheme?.Scheme_Name
      : (a.scheme_name || a.scheme || '—');

  const filtered = apps.filter(a => {
    const matchFilter = filter === 'All' || a.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      getSchemeName(a)?.toLowerCase().includes(q) ||
      (a.app_number || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts = {
    All:            apps.length,
    Pending:        apps.filter(a => a.status === 'Pending').length,
    'Under Review': apps.filter(a => a.status === 'Processing' || a.status === 'Under Review').length,
    Approved:       apps.filter(a => a.status === 'Approved').length,
    Rejected:       apps.filter(a => a.status === 'Rejected').length,
  };

  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="My Applications" onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="page-content">
          <div className="section-title">My Applications</div>
          <div className="section-sub">Track all your scheme applications and their current status</div>

          {/* Search */}
          <div className="search-bar" style={{ marginBottom: 12 }}>
            <span className="search-icon">🔍</span>
            <input
              placeholder="Search by scheme or application ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter tabs with counts */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {['All', 'Pending', 'Under Review', 'Approved', 'Rejected'].map(t => (
              <button
                key={t}
                className={`tab ${filter === t ? 'active' : ''}`}
                onClick={() => setFilter(t)}
              >
                {t}
                {counts[t] > 0 && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, fontWeight: 800,
                    background: filter === t ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: filter === t ? 'white' : '#64748b',
                    padding: '1px 6px', borderRadius: 99,
                  }}>
                    {counts[t]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" />
              <p style={{ marginTop: 12, color: 'var(--text3)' }}>Loading your applications…</p>
            </div>

          ) : apps.length === 0 ? (
            /* Empty state for new farmers with no applications */
            <div className="card" style={{ padding: '56px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
              <h3 style={{ fontWeight: 800, color: 'var(--text1)', margin: '0 0 8px' }}>
                No applications yet
              </h3>
              <p style={{ color: 'var(--text3)', maxWidth: 360, margin: '0 auto 28px', lineHeight: 1.6 }}>
                You haven't applied for any government schemes yet.
                Explore available schemes and apply in just a few clicks.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/schemes')}
                  style={{
                    padding: '12px 24px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, var(--green, #16a34a), #15803d)',
                    color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                  }}
                >
                  🌾 Browse Schemes
                </button>
                <button
                  onClick={() => navigate('/apply')}
                  style={{
                    padding: '12px 24px', borderRadius: 10,
                    border: '1.5px solid #e2e8f0', background: 'white',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#1e293b',
                  }}
                >
                  ➕ Apply Now
                </button>
              </div>
            </div>

          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
              No applications match your search or filter.
            </div>

          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Scheme</th>
                    <th>Date Applied</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.id ?? a.app_number}>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>
                        {a.app_number || `APP-${a.id}`}
                      </td>
                      <td style={{ fontWeight: 600 }}>{getSchemeName(a)}</td>
                      <td style={{ color: 'var(--text3)' }}>
                        {a.applied_at ? new Date(a.applied_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: 'var(--gold)', fontWeight: 600 }}>
                        {a.amount || '—'}
                      </td>
                      <td>
                        <span className={`tag ${STATUS_CLASS[a.status] || 'tag-pending'}`}>
                          {STATUS_ICON[a.status] || '⏳'} {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
