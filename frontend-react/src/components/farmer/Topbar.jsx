import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotif } from '../../context/NotifContext';
import NotifPanel from './NotifPanel';

export default function Topbar({ title, onMenuClick }) {
  const { user }    = useAuth();
  const { unreadCount } = useNotif();
  const navigate    = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="mobile-menu-btn" onClick={onMenuClick}>☰</button>
        <div className="topbar-title">{title}</div>
      </div>
      <div className="topbar-right">
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🌦️</span> 28°C · Nashik
        </div>

        {/* 🔔 Bell with live badge */}
        <button
          className="notif-btn"
          onClick={() => setNotifOpen(o => !o)}
          style={{ position: 'relative' }}
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ef4444',
              color: '#fff',
              borderRadius: '50%',
              fontSize: 10,
              fontWeight: 700,
              minWidth: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
              boxShadow: '0 0 0 2px rgba(255,255,255,0.3)',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          onClick={() => navigate('/profile')}
        >
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👨‍🌾</div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.full_name || 'Farmer'}
          </span>
        </div>
      </div>
      <NotifPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
