/**
 * NotifContext.jsx
 * ────────────────
 * Polls /notifications every 5 seconds to keep notification state fresh.
 * Provides { notifications, unreadCount, markAllRead, markRead } to any component.
 *
 * Admin:  user_id=0, role="admin"   → sees all admin-broadcast notifications
 * Farmer: user_id=<id>, role="farmer" → sees only own notifications
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotifContext = createContext({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  markRead: () => {},
  refresh: () => {},
});

const API = 'http://localhost:8000';
const POLL_INTERVAL = 5000; // 5 seconds

export function NotifProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const intervalRef = useRef(null);

  // ── Fetch notifications from API ──────────────────────────
  const fetchNotifs = useCallback(async () => {
    if (!user) return;

    const role   = user.role === 'admin' ? 'admin' : 'farmer';
    const userId = role === 'admin' ? 0 : (parseInt(user.id) || 0);

    try {
      const res = await fetch(
        `${API}/notifications?user_id=${userId}&role=${role}&limit=30`
      );
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch {
      // Fail silently — server may be temporarily unavailable
    }
  }, [user]);

  // ── Start/stop polling on user change ─────────────────────
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifs();                          // immediate first fetch
    intervalRef.current = setInterval(fetchNotifs, POLL_INTERVAL);

    return () => clearInterval(intervalRef.current);
  }, [user, fetchNotifs]);

  // ── Mark ALL as read ──────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!user) return;
    const role   = user.role === 'admin' ? 'admin' : 'farmer';
    const userId = role === 'admin' ? 0 : (parseInt(user.id) || 0);

    try {
      await fetch(`${API}/notifications/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {/* silent */}
  }, [user]);

  // ── Mark single notification as read ─────────────────────
  const markRead = useCallback(async (notifId) => {
    try {
      await fetch(`${API}/notifications/${notifId}/read`, { method: 'PATCH' });
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {/* silent */}
  }, []);

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, markAllRead, markRead, refresh: fetchNotifs }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotif = () => useContext(NotifContext);
