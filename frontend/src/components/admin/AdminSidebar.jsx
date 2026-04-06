import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { id: 'dashboard',    icon: '⊞',  label: 'Dashboard',             path: '/admin' },
  { id: 'applications', icon: '☰',  label: 'Applications',          path: '/admin/applications' },
  { id: 'doc-verify',   icon: '□',  label: 'Document Verification', path: '/admin/documents' },
  { id: 'ai-decisions', icon: '◈',  label: 'AI Decisions',          path: '/admin/ai' },
  { id: 'farmers',      icon: '👥', label: 'Farmers',               path: '/admin/farmers' },
  { id: 'grievances',   icon: '☏',  label: 'Grievances',            path: '/admin/grievances' },
  { id: 'escalated',    icon: '↑',  label: 'Escalated Cases',       path: '/admin/escalated' },
  { id: 'reports',      icon: '↗',  label: 'Reports & Analytics',   path: '/admin/reports' },
];

export default function AdminSidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const initials = (user?.full_name || 'OA').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="admin-sidebar-brand">
        <div className="admin-brand-logo">AG</div>
        <span className="admin-brand-text">AgriPortal</span>
      </div>

      <nav className="admin-nav">
        {navItems.map(item => (
          <Link
            key={item.id}
            to={item.path}
            className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="admin-nav-icon">{item.icon}</span>
            <span className="admin-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-officer-info">
          <div className="admin-officer-avatar">{initials}</div>
          <div>
            <div className="admin-officer-name">{user?.full_name || 'Officer'}</div>
            <div className="admin-officer-role">Admin Officer</div>
          </div>
        </div>
        <Link to="/" className="admin-sidebar-portal">🌿 Farmer Portal →</Link>
        <button
          onClick={logout}
          style={{ width: '100%', background: 'rgba(211,47,47,0.15)', color: '#ff6b6b', border: '1px solid rgba(211,47,47,0.25)', borderRadius: 6, padding: '6px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}
