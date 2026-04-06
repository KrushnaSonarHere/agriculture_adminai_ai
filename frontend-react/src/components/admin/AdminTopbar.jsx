import { useState } from 'react';
import { useAuth }  from '../../context/AuthContext';
import { useNotif } from '../../context/NotifContext';
import AdminNotifPanel from './AdminNotifPanel';

export default function AdminTopbar({ onMenuClick }) {
  const { user, logout }    = useAuth();
  const { unreadCount }     = useNotif();
  const [panelOpen, setPanelOpen] = useState(false);
  const initials = (user?.full_name || 'OA').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="admin-topbar">
      <div className="admin-topbar-left">
        <button className="admin-menu-btn" onClick={onMenuClick}>☰</button>
        <div className="admin-search-wrap">
          <span className="admin-search-icon">🔍</span>
          <input className="admin-search-input" type="text" placeholder="Search farmers, applications..." />
        </div>
      </div>

      <div className="admin-topbar-right">
        {/* 🔔 Bell with live badge */}
        <div style={{ position: 'relative' }}>
          <button
            className="admin-notif-btn"
            onClick={() => setPanelOpen(o => !o)}
            style={{ position: 'relative' }}
          >
            🔔
            {unreadCount > 0 && (
              <span
                className="admin-notif-badge"
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '50%',
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  boxShadow: '0 0 0 2px #fff',
                  animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification panel dropdown */}
          {panelOpen && (
            <AdminNotifPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
          )}
        </div>

        <button className="admin-profile-btn" onClick={logout} title="Click to logout">
          <div className="admin-profile-avatar">{initials}</div>
          <div>
            <div className="admin-profile-name">{user?.full_name || 'Officer'}</div>
            <div className="admin-profile-label">Admin · Logout</div>
          </div>
        </button>
      </div>
    </div>
  );
}
