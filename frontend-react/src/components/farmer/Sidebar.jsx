import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';

const navItems = [
  { id: 'dashboard',    icon: '🏡', label: 'Dashboard',       section: 'OVERVIEW', path: '/dashboard' },
  { id: 'schemes',      icon: '📋', label: 'Schemes',          section: 'APPLY',    path: '/schemes' },
  { id: 'subsidies',    icon: '💰', label: 'Subsidies',                             path: '/subsidies' },
  { id: 'insurance',    icon: '🛡️', label: 'Insurance',                             path: '/insurance' },
  { id: 'applications', icon: '📁', label: 'My Applications',  section: 'TRACK',    path: '/applications' },
  { id: 'grievance',    icon: '📢', label: 'Grievances',                            path: '/grievance' },
  { id: 'profile',      icon: '👤', label: 'My Profile',       section: 'ACCOUNT',  path: '/profile' },
  { id: 'documents',    icon: '📄', label: 'My Documents',                          path: '/documents' },

];

export default function Sidebar({ isOpen, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">🌿</div>
          <span className="logo-text">AgriPortal</span>
        </div>
        <div className="logo-sub">Farmer Service Portal</div>
      </div>

      <div className="farmer-badge">
        <div className="farmer-avatar">👨‍🌾</div>
        <div className="farmer-info">
          <div className="farmer-name">{user?.full_name || 'Farmer'}</div>
          <div className="farmer-id">{user?.farmer_id || '—'}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <span key={item.id}>
            {item.section && (
              <div className="nav-section-label">{item.section}</div>
            )}
            <Link
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => onToggle && onToggle(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          </span>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="status-dot"></span>
          Portal Online ·&nbsp;
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{time}</span>
        </div>
        <button
          onClick={logout}
          style={{ width: '100%', background: 'rgba(211,47,47,0.1)', color: '#D32F2F', border: '1px solid rgba(211,47,47,0.3)', borderRadius: 8, padding: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}
