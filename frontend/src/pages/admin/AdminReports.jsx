import { useState } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar from '../../components/admin/AdminTopbar';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import '../../styles/admin.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function AdminReports() {
  const [collapsed, setCollapsed] = useState(false);

  const barData = {
    labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    datasets: [
      { label: 'Approved', data: [95, 140, 125, 180, 165, 210], backgroundColor: '#2E7D32', borderRadius: 4 },
      { label: 'Pending',  data: [40, 55,  60,  70,  65,  75],  backgroundColor: '#FFB300', borderRadius: 4 },
      { label: 'Rejected', data: [15, 20,  25,  20,  18,  12],  backgroundColor: '#C62828', borderRadius: 4 },
    ],
  };
  const barOpts = { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } };

  const PROGRESS = [
    { label: 'PM-KISAN Scheme',      pct: 78, cls: 'green' },
    { label: 'Crop Insurance',        pct: 62, cls: 'blue' },
    { label: 'PMKSY Irrigation',      pct: 45, cls: 'green' },
    { label: 'Kisan Credit Card',     pct: 30, cls: 'blue' },
    { label: 'Soil Health Card',      pct: 55, cls: 'green' },
  ];

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        <div className="admin-content">
          <div className="page-heading">Reports & Analytics</div>
          <div className="page-sub">Comprehensive reports on scheme performance and farmer outreach</div>

          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Disbursed', val: '₹2.4 Cr', icon: '💰', cls: 'green' },
              { label: 'Schemes Active',  val: '12',      icon: '📋', cls: 'blue' },
              { label: 'Approval Rate',   val: '68%',     icon: '✅', cls: 'check' },
              { label: 'Avg Processing',  val: '4.2 days',icon: '⏱️', cls: 'amber' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-card-label">{s.label}</div>
                <div className="stat-card-val">{s.val}</div>
                <div className={`stat-card-icon ${s.cls}`}>{s.icon}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            <div className="admin-card">
              <div className="card-title">Application Trends (Last 6 Months)</div>
              <div className="card-sub">Monthly breakdown by status</div>
              <Bar data={barData} options={barOpts} height={220} />
            </div>
            <div className="admin-card">
              <div className="card-title">Scheme-wise Approval Rate</div>
              <div className="card-sub">Percentage of approved applications per scheme</div>
              {PROGRESS.map(p => (
                <div className="progress-row" key={p.label}>
                  <div className="progress-label">{p.label}</div>
                  <div className="progress-bar"><div className={`progress-fill ${p.cls}`} style={{ width: `${p.pct}%` }} /></div>
                  <div className="progress-val">{p.pct}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card" style={{ marginTop: 16, textAlign: 'center' }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Export Reports</div>
            <div className="card-sub">Download reports for offline review</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8 }}>
              <button className="btn btn-outline">📊 Download Excel</button>
              <button className="btn btn-outline">📄 Download PDF</button>
              <button className="btn btn-primary">🖨️ Print Report</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
