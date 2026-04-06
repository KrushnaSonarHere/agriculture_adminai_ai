import { useNavigate } from 'react-router-dom';
import { useNotif } from '../../context/NotifContext';

export default function NotifPanel({ isOpen, onClose }) {
  const { notifications, markAllRead, markRead } = useNotif();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleItemClick = async (notif) => {
    await markRead(notif.id);
    onClose();
    if (notif.application_id) {
      navigate('/applications');
    }
  };

  const getIcon = (msg = '') => {
    if (msg.includes('APPROVED') || msg.includes('✅')) return '✅';
    if (msg.includes('REJECTED') || msg.includes('❌')) return '❌';
    if (msg.includes('📋') || msg.includes('New Application')) return '📋';
    return '🔔';
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={onClose} />
      <div className={`notif-panel ${isOpen ? 'open' : ''}`} style={{ zIndex: 200 }}>
        <div className="notif-header">
          <span className="notif-title-text">🔔 Notifications</span>
          <button className="notif-clear" onClick={markAllRead}>Mark all read</button>
        </div>

        {notifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            You're all caught up!
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.is_read ? 'unread' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemClick(n)}
            >
              <span className="notif-item-icon">{getIcon(n.message)}</span>
              <div className="notif-item-body">
                <div className="notif-item-title">
                  {n.message.length > 60 ? n.message.slice(0, 60) + '…' : n.message}
                </div>
                {n.application_id && (
                  <div className="notif-item-desc">Application #{n.application_id} • Tap to view</div>
                )}
                <div className="notif-item-time">{formatTime(n.created_at)}</div>
              </div>
              {!n.is_read && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 6 }} />
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
