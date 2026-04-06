import { useState } from 'react';
import Sidebar from '../components/farmer/Sidebar';
import Topbar from '../components/farmer/Topbar';
import '../styles/farmer.css';

export default function Reports() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bars = [
    { label: 'PM Kisan',        pct: 85, val: '₹36,000' },
    { label: 'Fasal Bima',      pct: 60, val: '₹25,000' },
    { label: 'Irrigation',      pct: 45, val: '₹12,000' },
    { label: 'Kisan CC',        pct: 30, val: '₹8,000' },
  ];
  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="Reports" onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="page-content">
          <div className="section-title">My Reports</div>
          <div className="section-sub">Overview of your scheme benefits and application history</div>
          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📊 Benefits Received by Scheme</div>
              {bars.map(b => (
                <div className="chart-bar" key={b.label}>
                  <div className="chart-bar-label">{b.label}</div>
                  <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: `${b.pct}%`, background: '#2e7d32' }} /></div>
                  <div className="chart-bar-val">{b.val}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📈 Application Summary</div>
              <div className="grid-2" style={{ gap: 12 }}>
                {[
                  { label: 'Total Applied',  val: '5', color: 'var(--blue)' },
                  { label: 'Approved',       val: '2', color: 'var(--green)' },
                  { label: 'Pending',        val: '2', color: 'var(--amber)' },
                  { label: 'Rejected',       val: '1', color: 'var(--red)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 12, padding: '16px 8px' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
