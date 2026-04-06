import { useState } from 'react';
import Sidebar from '../components/farmer/Sidebar';
import Topbar from '../components/farmer/Topbar';
import ApplyModal from '../components/farmer/ApplyModal';
import '../styles/farmer.css';

const SUBSIDIES = [
  { id: 1, name: 'PM Kusum Solar Pump Scheme', amount: '₹90,000', deadline: 'Jun 30', desc: '90% subsidy on solar water pumps for farmers. Reduces electricity cost.' },
  { id: 2, name: 'Drip Irrigation Subsidy', amount: '₹15,000', deadline: 'May 31', desc: 'Up to 55% subsidy on drip irrigation equipment purchase.' },
  { id: 3, name: 'Farm Machinery Scheme', amount: '₹40,000', deadline: 'Apr 30', desc: 'Subsidy on tractors and farm equipment for small and marginal farmers.' },
];

export default function Subsidies() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null);
  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="Subsidies" onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="page-content">
          <div className="section-title">Available Subsidies</div>
          <div className="section-sub">Government subsidies available for eligible farmers</div>
          <div className="grid-3">
            {SUBSIDIES.map(s => (
              <div className="scheme-card" key={s.id}>
                <div className="scheme-header">
                  <div><div className="scheme-name">{s.name}</div><div className="scheme-dept">Subsidy Program</div></div>
                  <div className="scheme-amount">{s.amount}</div>
                </div>
                <div className="scheme-desc">{s.desc}</div>
                <div className="scheme-footer">
                  <span className="scheme-deadline">⏰ {s.deadline}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => setModal(s)}>Apply</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      {modal && <ApplyModal scheme={modal} onClose={() => setModal(null)} onSuccess={() => {}} />}
    </div>
  );
}
