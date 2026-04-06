import { useState } from 'react';
import Sidebar from '../components/farmer/Sidebar';
import Topbar from '../components/farmer/Topbar';
import '../styles/farmer.css';

export default function Insurance() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const PLANS = [
    { name: 'PM Fasal Bima Yojana',    premium: '2%',   coverage: '₹25,000', crops: 'All Crops',     desc: 'Comprehensive crop insurance covering natural calamities and pests.' },
    { name: 'Weather-Based Crop Insurance', premium: '3%', coverage: '₹30,000', crops: 'Fruits & Veg', desc: 'Insurance based on weather parameters like rainfall and temperature.' },
    { name: 'Coconut Palm Insurance',   premium: '1.5%', coverage: '₹10,000', crops: 'Coconut',       desc: 'Specific insurance for coconut palm trees against natural disasters.' },
  ];
  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="Insurance" onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="page-content">
          <div className="section-title">Crop Insurance Plans</div>
          <div className="section-sub">Government-backed insurance schemes to protect your crops</div>
          <div className="grid-3">
            {PLANS.map((p, i) => (
              <div className="card" key={i} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>{p.desc}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 16 }}>
                  <div><div style={{ color: 'var(--text3)' }}>Premium</div><div style={{ fontWeight: 700, color: 'var(--gold)' }}>{p.premium} of sum insured</div></div>
                  <div><div style={{ color: 'var(--text3)' }}>Max Coverage</div><div style={{ fontWeight: 700 }}>{p.coverage}</div></div>
                  <div><div style={{ color: 'var(--text3)' }}>Eligible Crops</div><div style={{ fontWeight: 700 }}>{p.crops}</div></div>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Apply Now</button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
