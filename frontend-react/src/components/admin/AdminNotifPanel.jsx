import { useNavigate } from 'react-router-dom';
import { useNotif } from '../../context/NotifContext';

/**
 * AdminNotifPanel
 * Dropdown notification panel for admin users.
 * Shows new farmer applications and system events.
 */
export default function AdminNotifPanel({ isOpen, onClose }) {
  const { notifications, markAllRead, markRead } = useNotif();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getIcon = (msg = '') => {
    if (msg.includes('APPROVED') || msg.includes('✅')) return '✅';
    if (msg.includes('REJECTED') || msg.includes('❌')) return '❌';
    if (msg.includes('📋') || msg.includes('New Application')) return '📋';
    if (msg.includes('Pending')) return '⏳';
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

  const handleClick = async (notif) => {
    await markRead(notif.id);
    onClose();
    if (notif.application_id) {
      navigate('/admin/applications');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 8,
        width: 380,
        maxHeight: 480,
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1e293b, #334155)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>🔔 Notifications</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {notifications.filter(n => !n.is_read).length} unread · Admin panel
            </div>
          </div>
          <button
            onClick={markAllRead}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#cbd5e1',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Mark all read
          </button>
        </div>

        {/* Notification list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13 }}>No notifications yet</div>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 20px',
                  borderBottom: '1px solid #f8fafc',
                  cursor: 'pointer',
                  background: n.is_read ? '#fff' : '#f0f9ff',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? '#fff' : '#f0f9ff'}
              >
                {/* Icon */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: n.is_read ? '#f1f5f9' : '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}>
                  {getIcon(n.message)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: n.is_read ? 400 : 600,
                    color: '#1e293b',
                    lineHeight: 1.4,
                    marginBottom: 4,
                  }}>
                    {n.message.length > 80 ? n.message.slice(0, 80) + '…' : n.message}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 8 }}>
                    <span>{formatTime(n.created_at)}</span>
                    {n.application_id && (
                      <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                        · View Application →
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread dot */}
                {!n.is_read && (
                  <div style={{
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: '#3b82f6',
                    flexShrink: 0,
                    marginTop: 4,
                  }} />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div
            onClick={() => { navigate('/admin/applications'); onClose(); }}
            style={{
              padding: '12px 20px',
              textAlign: 'center',
              fontSize: 12,
              color: '#3b82f6',
              fontWeight: 600,
              cursor: 'pointer',
              borderTop: '1px solid #f1f5f9',
              background: '#fafbff',
            }}
          >
            View All Applications →
          </div>
        )}
      </div>
    </>
  );
}
