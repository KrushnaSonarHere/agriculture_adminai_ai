import { useState, useEffect } from 'react';
import { Link }         from 'react-router-dom';
import AdminSidebar     from '../../components/admin/AdminSidebar';
import AdminTopbar      from '../../components/admin/AdminTopbar';
import '../../styles/admin.css';

const SCHEME_COLORS = ['#1565C0','#43A047','#FFB300','#66BB6A','#78909C','#EC407A'];
const BASE = 'http://127.0.0.1:8000';

// Helper: safely extract scheme name whether it's a string or nested object
const getSchemeName = (a) => {
  if (a.scheme_name) return a.scheme_name;
  if (typeof a.scheme === 'string') return a.scheme;
  if (a.scheme && typeof a.scheme === 'object') return a.scheme.Scheme_Name || 'Other';
  return 'Other';
};

/* Simple CSS-only bar chart — no Chart.js */
function MiniBarChart({ data, max }) {
  const peak = max || Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '8px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{d.value}</span>
          <div
            style={{
              width: '100%',
              height: `${Math.round((d.value / peak) * 88)}px`,
              background: d.color,
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.5s ease',
              minHeight: 4,
            }}
          />
          <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', lineHeight: 1.2 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [collapsed,  setCollapsed]  = useState(false);
  const [stats,      setStats]      = useState({ total: 0, farmers: 0, pending: 0, approved: 0, rejected: 0 });
  const [recentApps, setRecentApps] = useState([]);
  const [schemeData, setSchemeData] = useState([
    { label: 'PM-KISAN',       value: 38, color: '#1565C0' },
    { label: 'Crop Insurance', value: 27, color: '#43A047' },
    { label: 'Soil Health',    value: 13, color: '#FDD835' },
    { label: 'Kisan Credit',   value: 13, color: '#66BB6A' },
    { label: 'Others',         value:  9, color: '#78909C' },
  ]);
  const [aiMetrics, setAiMetrics] = useState({ total: 0, approved: 0, flagged: 0, manual: 0, highRisk: 0 });
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/applications/?limit=500`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${BASE}/farmers/`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${BASE}/ocr/all-decisions`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([apps, farmers, decisions]) => {
      const realFarmers = Array.isArray(farmers)    ? farmers.filter(f => f.role !== 'admin') : [];
      const appArr      = Array.isArray(apps)       ? apps       : [];
      const decArr      = Array.isArray(decisions)  ? decisions  : [];

      setStats({
        total:    appArr.length,
        farmers:  realFarmers.length,
        pending:  appArr.filter(a => ['Pending','Processing'].includes(a.status)).length,
        approved: appArr.filter(a => a.status === 'Approved').length,
        rejected: appArr.filter(a => a.status === 'Rejected').length,
      });
      setRecentApps(appArr.slice(0, 5));

      if (appArr.length > 0) {
        const schemeCount = {};
        appArr.forEach(a => {
          const name = getSchemeName(a);
          schemeCount[name] = (schemeCount[name] || 0) + 1;
        });
        const total  = appArr.length;
        const sorted = Object.entries(schemeCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
        setSchemeData(sorted.map(([label, count], i) => ({
          label: label.length > 12 ? label.slice(0,12)+'…' : label,
          value: Math.round((count / total) * 100),
          color: SCHEME_COLORS[i] || '#94a3b8',
        })));
      }

      setAiMetrics({
        total:    decArr.length,
        approved: decArr.filter(d => d.decision === 'auto_approved').length,
        flagged:  decArr.filter(d => d.decision === 'flagged').length,
        manual:   decArr.filter(d => d.decision === 'manual_review').length,
        highRisk: decArr.filter(d => (d.fraud_risk || 0) > 70).length,
      });
    }).finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status) =>
    ({ Approved:'badge-approved', Pending:'badge-pending', Processing:'badge-review', Rejected:'badge-rejected' })[status] || 'badge-pending';

  const STAT_CARDS = [
    { label:'Total Applications', val: loading ? '…' : stats.total.toLocaleString(),    trend:'▲ Live count',         icon:'📄', cls:'blue'  },
    { label:'Registered Farmers', val: loading ? '…' : stats.farmers.toLocaleString(),  trend:'✅ Verified farmers',   icon:'👥', cls:'green' },
    { label:'Pending Reviews',    val: loading ? '…' : stats.pending,                   trend:'⚠ Awaiting action',     icon:'⚠️', cls:'amber', down: true },
    { label:'Total Approved',     val: loading ? '…' : stats.approved,                  trend:'▲ All time approvals',  icon:'✅', cls:'check' },
  ];

  const TREND_MONTHS = [
    { label:'Oct', approved: 95, pending: 40, rejected: 15 },
    { label:'Nov', approved:140, pending: 55, rejected: 20 },
    { label:'Dec', approved:125, pending: 60, rejected: 25 },
    { label:'Jan', approved:180, pending: 70, rejected: 20 },
    { label:'Feb', approved:165, pending: 65, rejected: 18 },
    { label:'Mar', approved: Math.max(stats.approved,30), pending: Math.max(stats.pending,20), rejected: Math.max(stats.rejected,5) },
  ];

  const fallbackApps = [
    { farmer_name:'Suresh Patil',  app_number:'APP-001', scheme_name:'PM-KISAN',       status:'Pending'  },
    { farmer_name:'Lakshmi Devi',  app_number:'APP-002', scheme_name:'Crop Insurance', status:'Approved' },
    { farmer_name:'Rajesh Kumar',  app_number:'APP-003', scheme_name:'Subsidy',        status:'Pending'  },
  ];

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        <div className="admin-content">

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:22, fontWeight:800, color:'#1e293b' }}>Admin Dashboard</div>
              <div style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Overview of agricultural scheme administration</div>
            </div>
            <div style={{ fontSize:11, color:'#94a3b8', background:'#f8fafc', padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0' }}>
              🕐 {new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })} · Live
            </div>
          </div>

          <div className="stats-grid">
            {STAT_CARDS.map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-card-label">{s.label}</div>
                <div className="stat-card-val">{s.val}</div>
                <div className={`stat-card-trend ${s.down ? 'down' : ''}`}>{s.trend}</div>
                <div className={`stat-card-icon ${s.cls}`}>{s.icon}</div>
              </div>
            ))}
          </div>

          {/* AI Banner */}
          <div className="admin-card" style={{ marginBottom:16, background:'linear-gradient(135deg,#1e293b,#0f172a)', border:'none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:15, color:'#fff' }}>🤖 AI Document Intelligence — Live</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>PaddleOCR-powered verification</div>
              </div>
              <Link to="/admin/ai" style={{ background:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', padding:'6px 14px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:600 }}>
                Full Report →
              </Link>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
              {[
                { label:'AI Verified',       val: aiMetrics.total,                        color:'#60a5fa', icon:'🧠' },
                { label:'Auto-Approved',     val: aiMetrics.approved,                     color:'#34d399', icon:'✅' },
                { label:'Manual Review',     val: aiMetrics.manual,                       color:'#fbbf24', icon:'📋' },
                { label:'High Risk/Flagged', val: aiMetrics.flagged + aiMetrics.highRisk, color:'#f87171', icon:'🚩' },
              ].map(m => (
                <div key={m.label} style={{ background:'rgba(255,255,255,0.06)', borderRadius:10, padding:'14px 16px', borderLeft:`3px solid ${m.color}` }}>
                  <div style={{ fontSize:22, fontWeight:900, color:m.color }}>{m.val}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, textTransform:'uppercase', letterSpacing:0.4 }}>{m.icon} {m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts (pure CSS) */}
          <div className="grid-2">
            <div className="admin-card">
              <div className="card-title">📈 Application Trends (Monthly)</div>
              <div className="card-sub">6-month overview of application outcomes</div>
              {/* Grouped bars */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:12, height:140, padding:'8px 0 0', borderBottom:'1px solid #f1f5f9' }}>
                {TREND_MONTHS.map((m, i) => {
                  const maxVal = 200;
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:110, width:'100%' }}>
                        {[
                          { val: m.approved, color:'#2E7D32' },
                          { val: m.pending,  color:'#FFB300' },
                          { val: m.rejected, color:'#C62828' },
                        ].map((b, j) => (
                          <div key={j} style={{ flex:1, display:'flex', alignItems:'flex-end' }}>
                            <div
                              style={{
                                width:'100%',
                                height:`${Math.round((b.val / maxVal) * 105)}px`,
                                background: b.color,
                                borderRadius:'3px 3px 0 0',
                                minHeight:3,
                                transition:'height 0.6s ease',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize:10, color:'#94a3b8' }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:16, marginTop:10, justifyContent:'center' }}>
                {[{ color:'#2E7D32', label:'Approved' }, { color:'#FFB300', label:'Pending' }, { color:'#C62828', label:'Rejected' }].map(l => (
                  <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#64748b' }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <div className="card-title">🍩 Scheme Distribution</div>
              <div className="card-sub">Applications by scheme type</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:12 }}>
                {schemeData.map(d => (
                  <div key={d.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:d.color, flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:12, color:'#475569' }}>{d.label}</span>
                    <div style={{ width:110, height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
                      <div style={{ width:`${d.value}%`, height:'100%', background:d.color, borderRadius:3 }} />
                    </div>
                    <strong style={{ fontSize:12, color:'#1e293b', minWidth:32, textAlign:'right' }}>{d.value}%</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Apps + Quick Actions */}
          <div className="grid-2" style={{ marginTop:16 }}>
            <div className="admin-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div>
                  <div className="card-title">📋 Recent Applications</div>
                  <div className="card-sub" style={{ marginBottom:0 }}>Latest entries</div>
                </div>
                <Link to="/admin/applications" className="btn btn-outline btn-sm">View All</Link>
              </div>
              {(recentApps.length > 0 ? recentApps : fallbackApps).map((a, i) => (
                <div className="recent-item" key={i}>
                  <div style={{ display:'flex', alignItems:'center' }}>
                    <div className="recent-icon">📄</div>
                    <div>
                      <div className="recent-name">{a.farmer_name || '—'}</div>
                      <div className="recent-code">
                        {a.app_number || (a.id ? `APP-${a.id}` : '—')} · {getSchemeName(a)}
                      </div>
                    </div>
                  </div>
                  <div className="recent-right">
                    <div className={`priority-dot ${a.status === 'Rejected' ? 'high' : a.status === 'Approved' ? 'low' : 'medium'}`} />
                    <span className={`badge ${getStatusBadge(a.status)}`}>{a.status || 'Pending'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-card">
              <div className="card-title" style={{ marginBottom:6 }}>⚡ Quick Actions</div>
              <div className="card-sub" style={{ marginBottom:14 }}>Common administrative tasks</div>
              <div className="quick-actions">
                <Link to="/admin/applications" className="quick-action-item primary">
                  ⊞ Review Applications
                  <span style={{ marginLeft:'auto', background:'rgba(255,255,255,0.2)', borderRadius:8, padding:'1px 7px', fontSize:11 }}>{stats.pending}</span>
                </Link>
                <Link to="/admin/documents"  className="quick-action-item">□ Verify Documents (OCR)</Link>
                <Link to="/admin/ai"         className="quick-action-item">
                  ◈ AI Decisions
                  <span style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8' }}>{aiMetrics.total} verified</span>
                </Link>
                <Link to="/admin/ai-tool"    className="quick-action-item">✨ AI Master Prompt Tool</Link>
                <Link to="/admin/grievances" className="quick-action-item">☏ Manage Grievances</Link>
                <Link to="/admin/reports"    className="quick-action-item">↗ Reports &amp; Analytics</Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
