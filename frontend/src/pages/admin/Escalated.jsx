import { useState } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar from '../../components/admin/AdminTopbar';
import '../../styles/admin.css';

const CASES = [
  { id: 'ESC-2026-012', farmer: 'Suresh Patil',  subject: 'Repeated PM Kisan rejection for valid farmer',  level: 'Level 2', days: 8,  priority: 'High' },
  { id: 'ESC-2026-009', farmer: 'Mohan Rao',     subject: 'Land record mismatch causing application block', level: 'Level 1', days: 5,  priority: 'Medium' },
  { id: 'ESC-2026-005', farmer: 'Anita Sharma',  subject: 'Officer non-responsive for 15 days',             level: 'Level 3', days: 15, priority: 'High' },
];

export default function Escalated() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        <div className="admin-content">
          <div className="page-heading">Escalated Cases</div>
          <div className="page-sub">High-priority cases requiring immediate attention</div>
          <div className="alert-banner warning" style={{ marginBottom: 16 }}>
            ⚠️ {CASES.length} escalated cases require senior officer review
          </div>
          {CASES.map(c => (
            <div className="admin-card" key={c.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span className="app-id" style={{ fontSize: 12 }}>{c.id}</span>
                    <span className={`badge ${c.priority === 'High' ? 'badge-high' : 'badge-medium'}`}>{c.priority}</span>
                    <span className="badge badge-review">{c.level}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{c.subject}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>Farmer: {c.farmer} · Pending for {c.days} days</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm">Assign Officer</button>
                  <button className="btn btn-primary btn-sm">Resolve</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
