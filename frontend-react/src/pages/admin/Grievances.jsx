/**
 * Grievances.jsx — AI-Enhanced Admin Grievance Management
 * ──────────────────────────────────────────────────────────────
 * • AI-priority sorted queue (HIGH → MEDIUM → LOW)
 * • SLA countdown bar per ticket (24h / 72h / 168h)
 * • 2-line AI summary + suggested action on every row
 * • One-click reply templates → auto-sends farmer notification
 * • Resolve / Assign / Reply modal
 */

import { useState, useEffect, useCallback } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar  from '../../components/admin/AdminTopbar';
import api from '../../api/index';
import '../../styles/admin.css';

// ── Constants ─────────────────────────────────────────────────

const CATEGORY_ICONS = {
  Payment: '💳', Subsidy: '💰', Document: '📄',
  Scheme: '📋', Technical: '⚙️', Other: '📌',
};

const PRIORITY_COLOR = {
  high:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444', badge: '#dc2626' },
  medium: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#f59e0b', badge: '#d97706' },
  low:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', dot: '#10b981', badge: '#059669' },
};

const STATUS_STYLE = {
  Filed:    { bg: '#f5f3ff', color: '#6d28d9' },
  Received: { bg: '#eff6ff', color: '#1d4ed8' },
  Assigned: { bg: '#e0f2fe', color: '#0369a1' },
  Action:   { bg: '#fff7ed', color: '#c2410c' },
  Resolved: { bg: '#f0fdf4', color: '#15803d' },
};

const REPLY_TEMPLATES = {
  Payment:  [
    'Your PM-KISAN payment is being traced. Aadhaar bank seeding status has been verified. Resolution expected within 48 hours.',
    'We have raised a query with the District Treasury. You will receive an SMS update once the transfer is confirmed.',
  ],
  Document: [
    'Your document has been re-reviewed by our AI verification system. Please re-upload a clearer copy at the portal.',
    'The document mismatch has been manually overridden after field verification. Your application is proceeding.',
  ],
  Scheme:   [
    'Your application has been escalated to the scheme coordinator. Current SLA: 7 working days.',
    'Status updated. Your application is now Under Review and will be processed within 3 working days.',
  ],
  Subsidy:  [
    'Subsidy calculation has been re-verified. A corrected payment of the balance amount will be credited within 5 days.',
    'The discrepancy has been flagged to the Finance Department. You will receive a confirmation SMS.',
  ],
  Technical:[
    'The technical issue has been logged with our IT team (Ticket #IT-{ref}). Expected resolution: 24 hours.',
    'Please clear your browser cache and try again. If the issue persists, call helpline 1800-180-1551.',
  ],
  Other:    [
    'Thank you for your complaint. It has been assigned to the concerned officer and will be resolved within 7 days.',
    'Your grievance is under review. We apologise for the inconvenience caused.',
  ],
};

// ── SLA Progress Bar ─────────────────────────────────────────
function SlaBar({ hoursLeft, totalHours, breached }) {
  if (hoursLeft == null) return null;
  const pct    = Math.max(0, Math.min(100, (hoursLeft / totalHours) * 100));
  const color  = breached ? '#ef4444' : pct < 25 ? '#f59e0b' : '#10b981';
  const label  = breached
    ? `⚠ SLA BREACHED by ${Math.abs(hoursLeft).toFixed(0)}h`
    : `${hoursLeft.toFixed(0)}h left`;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: breached ? '#ef4444' : '#64748b', fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ── Reply Modal ───────────────────────────────────────────────
function ReplyModal({ grv, onClose, onSave }) {
  const [reply,   setReply]   = useState('');
  const [status,  setStatus]  = useState(grv.status === 'Filed' ? 'Received' : grv.status);
  const [officer, setOfficer] = useState(grv.assigned_to || '');
  const [loading, setLoading] = useState(false);
  const templates = REPLY_TEMPLATES[grv.category] || REPLY_TEMPLATES.Other;

  const handleSend = async () => {
    if (!reply.trim()) return;
    setLoading(true);
    await onSave({ reply_text: reply, new_status: status, assigned_to: officer || undefined });
    setLoading(false);
    onClose();
  };

  const pc = PRIORITY_COLOR[grv.priority] || PRIORITY_COLOR.medium;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,#1e293b,#334155)`, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Admin Reply</div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{grv.grv_number} — {grv.farmer_name}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>{grv.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>

          {/* AI summary */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>🤖 AI Summary & Suggested Action</div>
            <div style={{ fontSize: 12, color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{grv.ai_summary}</div>
          </div>

          {/* Quick templates */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>⚡ One-Click Reply Templates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates.map((t, i) => (
                <button key={i} onClick={() => setReply(t)}
                  style={{
                    textAlign: 'left', padding: '9px 12px', borderRadius: 8,
                    border: reply === t ? '1.5px solid #2e7d32' : '1.5px solid #e2e8f0',
                    background: reply === t ? '#f0fdf4' : '#f8fafc',
                    fontSize: 12, cursor: 'pointer', color: '#374151', lineHeight: 1.5,
                    transition: 'all 0.15s',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Custom reply */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>✏️ Custom Reply (will notify farmer)</div>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Type a custom reply for the farmer..."
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor = '#2e7d32'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Status + Assign row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Update Status</div>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                {['Filed', 'Received', 'Assigned', 'Action', 'Resolved'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Assign to Officer</div>
              <select value={officer} onChange={e => setOfficer(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                <option value="">— Unassigned —</option>
                {['Officer Sharma', 'Officer Tiwari', 'Officer Ram', 'Officer Deshpande', 'Officer Patil'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#64748b' }}>
              Cancel
            </button>
            <button onClick={handleSend} disabled={!reply.trim() || loading}
              style={{
                flex: 2, padding: '11px', borderRadius: 8, border: 'none',
                background: reply.trim() ? 'linear-gradient(135deg,#1b5e20,#2e7d32)' : '#e2e8f0',
                color: reply.trim() ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 700, cursor: reply.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              {loading ? 'Sending...' : '📨 Send Reply + Notify Farmer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grievance Detail Slide-Over ───────────────────────────────
function GrievanceDetail({ grv, onClose, onReply }) {
  if (!grv) return null;
  const pc = PRIORITY_COLOR[grv.priority] || PRIORITY_COLOR.medium;
  const ss = STATUS_STYLE[grv.status]    || STATUS_STYLE.Filed;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 900, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520, background: '#fff', height: '100vh', overflow: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', animation: 'slideIn 0.22s ease' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', padding: '24px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{grv.grv_number}</div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginTop: 4, lineHeight: 1.35 }}>{grv.title}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ background: pc.badge, color: '#fff', fontSize: 10, padding: '3px 10px', borderRadius: 6, fontWeight: 800 }}>
                  {(grv.priority || 'medium').toUpperCase()}
                </span>
                <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 10, padding: '3px 10px', borderRadius: 6, fontWeight: 700 }}>
                  {grv.status}
                </span>
                <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 10, padding: '3px 10px', borderRadius: 6 }}>
                  {CATEGORY_ICONS[grv.category] || '📌'} {grv.category}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>

          {/* SLA bar in header */}
          <div style={{ marginTop: 16 }}>
            <SlaBar hoursLeft={grv.sla_hours_left} totalHours={grv.sla_total_hours} breached={grv.sla_breached} />
          </div>
        </div>

        <div style={{ padding: 24 }}>

          {/* AI Summary */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>🤖 AI assessment</div>
            <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{grv.ai_summary}</div>
          </div>

          {/* Farmer info */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#2e7d32', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                {grv.farmer_name?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>{grv.farmer_name}</div>
                <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{grv.farmer_id}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Filed: {grv.filed_at ? new Date(grv.filed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Complaint</div>
            <p style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#1e293b', lineHeight: 1.7, margin: 0 }}>
              {grv.description}
            </p>
          </div>

          {grv.assigned_to && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>👤</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>Assigned to</div>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{grv.assigned_to}</div>
              </div>
            </div>
          )}

          {grv.resolution_note && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: 6 }}>✅ Resolution</div>
              <div style={{ fontSize: 14, color: '#166534' }}>{grv.resolution_note}</div>
            </div>
          )}

          {/* Reply button */}
          {grv.status !== 'Resolved' && (
            <button onClick={() => onReply(grv)}
              style={{
                width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff',
                fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              📨 Reply & Update Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════ MAIN PAGE ══════════════════════════════════════
export default function Grievances() {
  const [collapsed,  setCollapsed]  = useState(false);
  const [grievances, setGrievances] = useState([]);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('All');
  const [priFilter,  setPriFilter]  = useState('all');
  const [detail,     setDetail]     = useState(null);
  const [replyGrv,   setReplyGrv]   = useState(null);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/grievances/', { params: { limit: 200 } })
      .then(r => setGrievances(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter ────────────────────────────────────────────────
  const filtered = grievances.filter(g => {
    const q = search.toLowerCase();
    const matchStatus = filter === 'All' || g.status === filter;
    const matchPri    = priFilter === 'all' || g.priority === priFilter;
    const matchSearch = !q
      || (g.farmer_name || '').toLowerCase().includes(q)
      || (g.title       || '').toLowerCase().includes(q)
      || (g.grv_number  || '').toLowerCase().includes(q);
    return matchStatus && matchPri && matchSearch;
  });

  const counts = {
    total:    grievances.length,
    high:     grievances.filter(g => g.priority === 'high' && g.status !== 'Resolved').length,
    open:     grievances.filter(g => g.status !== 'Resolved').length,
    resolved: grievances.filter(g => g.status === 'Resolved').length,
    breached: grievances.filter(g => g.sla_breached && g.status !== 'Resolved').length,
  };

  // ── Reply handler ─────────────────────────────────────────
  const handleReply = async (grv, payload) => {
    try {
      await api.post(`/grievances/${grv.id}/reply`, payload);
    } catch (e) { console.warn('Reply error:', e.message); }
    // Optimistic update
    setGrievances(prev => prev.map(g =>
      g.id === grv.id
        ? { ...g, status: payload.new_status || g.status, assigned_to: payload.assigned_to || g.assigned_to, resolution_note: payload.new_status === 'Resolved' ? payload.reply_text : g.resolution_note }
        : g
    ));
    setDetail(null);
  };

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        <div className="admin-content">

          {/* ── Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>📢 AI Grievance Management</h1>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                Queue sorted by AI priority · SLA tracked per ticket · One-click reply templates
              </p>
            </div>
            <button onClick={load}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
              🔄 Refresh
            </button>
          </div>

          {/* ── Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total',        val: counts.total,    color: '#64748b', bg: '#f8fafc' },
              { label: 'Open',         val: counts.open,     color: '#1d4ed8', bg: '#eff6ff' },
              { label: 'High Priority',val: counts.high,     color: '#dc2626', bg: '#fef2f2' },
              { label: 'SLA Breached', val: counts.breached, color: '#b45309', bg: '#fffbeb' },
              { label: 'Resolved',     val: counts.resolved, color: '#059669', bg: '#ecfdf5' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${s.color}22` }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Filters ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
              <input
                style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                placeholder="Search by name, ticket ID, or subject…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#475569', background: 'white' }}>
              {['All', 'Filed', 'Received', 'Assigned', 'Action', 'Resolved'].map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={priFilter} onChange={e => setPriFilter(e.target.value)}
              style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#475569', background: 'white' }}>
              <option value="all">All Priorities</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>

          {/* ── Ticket Cards (AI-sorted) ── */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>
                🤖 AI-Prioritised Queue
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{filtered.length} tickets</div>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading grievances…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700 }}>No grievances found</div>
              </div>
            ) : (
              filtered.map((g, idx) => {
                const pc = PRIORITY_COLOR[g.priority] || PRIORITY_COLOR.medium;
                const ss = STATUS_STYLE[g.status]    || STATUS_STYLE.Filed;
                const isHighSla = g.sla_breached || (g.sla_hours_left != null && g.sla_hours_left < 24 && g.status !== 'Resolved');

                return (
                  <div
                    key={g.id}
                    style={{
                      padding: '16px 20px',
                      borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: isHighSla && g.status !== 'Resolved' ? '#fffbeb' : '#fff',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={e => e.currentTarget.style.background = isHighSla && g.status !== 'Resolved' ? '#fffbeb' : '#fff'}
                    onClick={() => setDetail(g)}
                  >
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                      {/* Priority indicator */}
                      <div style={{ width: 4, borderRadius: 99, background: pc.dot, alignSelf: 'stretch', flexShrink: 0, minHeight: 60 }} />

                      {/* Main content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Row 1 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b', fontWeight: 700 }}>{g.grv_number}</span>
                              <span style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, fontSize: 10, padding: '1px 7px', borderRadius: 99, fontWeight: 800 }}>
                                {(g.priority || 'medium').toUpperCase()}
                              </span>
                              <span style={{ background: ss.bg, color: ss.color, fontSize: 10, padding: '1px 7px', borderRadius: 6, fontWeight: 700 }}>
                                {g.status}
                              </span>
                              <span style={{ color: '#94a3b8', fontSize: 11 }}>
                                {CATEGORY_ICONS[g.category] || '📌'} {g.category}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {g.title}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            {g.status !== 'Resolved' && (
                              <button
                                onClick={() => setReplyGrv(g)}
                                style={{
                                  padding: '6px 14px', borderRadius: 7, border: 'none',
                                  background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff',
                                  fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                                }}>
                                📨 Reply
                              </button>
                            )}
                            {g.status === 'Resolved' && (
                              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, padding: '6px 0' }}>✅ Resolved</span>
                            )}
                          </div>
                        </div>

                        {/* Farmer + date row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                              {g.farmer_name?.[0]}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{g.farmer_name}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{g.farmer_id}</span>
                          </div>
                          <span style={{ color: '#cbd5e1', fontSize: 11 }}>·</span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {g.filed_at ? new Date(g.filed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          </span>
                          {g.assigned_to && (
                            <>
                              <span style={{ color: '#cbd5e1', fontSize: 11 }}>·</span>
                              <span style={{ fontSize: 11, color: '#3b82f6' }}>👤 {g.assigned_to}</span>
                            </>
                          )}
                        </div>

                        {/* AI summary (2 lines) */}
                        {g.ai_summary && (
                          <div style={{ background: '#f8fafc', borderRadius: 6, padding: '6px 10px', marginBottom: 6, borderLeft: '2px solid #10b981' }}>
                            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                              <span style={{ color: '#059669', fontWeight: 700 }}>🤖 </span>
                              {g.ai_summary}
                            </div>
                          </div>
                        )}

                        {/* SLA Bar */}
                        {g.status !== 'Resolved' && (
                          <SlaBar hoursLeft={g.sla_hours_left} totalHours={g.sla_total_hours} breached={g.sla_breached} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Detail Slide-Over */}
      {detail && (
        <GrievanceDetail
          grv={detail}
          onClose={() => setDetail(null)}
          onReply={grv => { setDetail(null); setReplyGrv(grv); }}
        />
      )}

      {/* Reply Modal */}
      {replyGrv && (
        <ReplyModal
          grv={replyGrv}
          onClose={() => setReplyGrv(null)}
          onSave={payload => handleReply(replyGrv, payload)}
        />
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes slideIn { from { transform:translateX(40px); opacity:0; } to { transform:translateX(0); opacity:1; } }
      `}</style>
    </div>
  );
}
