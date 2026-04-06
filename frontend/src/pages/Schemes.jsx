import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/farmer/Sidebar';
import Topbar from '../components/farmer/Topbar';
import ApplyModal from '../components/farmer/ApplyModal';
import '../styles/farmer.css';

const SCHEMES = [
  { id: 1, name: 'PM Kisan Samman Nidhi', dept: 'Agriculture Ministry', amount: '₹6,000/yr', deadline: 'Ongoing', desc: 'Direct income support of ₹6000 per year to small and marginal farmers.', tags: ['Small Farmer', 'All Crops'] },
  { id: 2, name: 'PM Fasal Bima Yojana', dept: 'Agriculture Ministry', amount: '₹25,000', deadline: 'Apr 15', desc: 'Comprehensive crop insurance scheme for all types of crops.', tags: ['Crop Insurance', 'All States'] },
  { id: 3, name: 'PMKSY Irrigation', dept: 'Jal Shakti Ministry', amount: '₹15,000', deadline: 'May 1', desc: 'Drip and sprinkler irrigation systems subsidy for small farmers.', tags: ['Irrigation', 'Small Farmer'] },
  { id: 4, name: 'Kisan Credit Card', dept: 'NABARD', amount: 'Up to ₹3L', deadline: 'Open Enrollment', desc: 'Low-interest credit for crop cultivation, harvest and allied activities.', tags: ['Credit', 'All Farmers'] },
  { id: 5, name: 'Soil Health Card Scheme', dept: 'Agriculture Ministry', amount: 'Free', deadline: 'Ongoing', desc: 'Soil testing and health card for better crop yield and soil management.', tags: ['Soil Health', 'All States'] },
  { id: 6, name: 'National Horticulture Mission', dept: 'Horticulture Dept', amount: '₹50,000', deadline: 'Jun 30', desc: 'Support for horticulture development including fruits and vegetables.', tags: ['Horticulture', 'All Farmers'] },
];

const CATEGORIES = [
  { icon: '🌾', name: 'All Schemes', count: '24 schemes', value: 'all' },
  { icon: '💰', name: 'Subsidies',   count: '8 schemes',  value: 'subsidy' },
  { icon: '🛡️', name: 'Insurance',   count: '6 schemes',  value: 'insurance' },
  { icon: '💳', name: 'Credit',      count: '4 schemes',  value: 'credit' },
  { icon: '🚜', name: 'Equipment',   count: '4 schemes',  value: 'equipment' },
  { icon: '🌱', name: 'Seeds & Soil',count: '2 schemes',  value: 'seeds' },
];

export default function Schemes() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal]             = useState(null);
  const [search, setSearch]           = useState('');
  const [category, setCategory]       = useState('all');

  const filtered = SCHEMES.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.dept.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="Schemes" onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="page-content">
          <div className="section-title">Government Schemes</div>
          <div className="section-sub">Browse and apply for agricultural schemes, subsidies, and support programs</div>

          <div className="category-grid">
            {CATEGORIES.map(c => (
              <div
                key={c.value}
                className={`category-card ${category === c.value ? 'selected' : ''}`}
                onClick={() => setCategory(c.value)}
              >
                <div className="cat-icon">{c.icon}</div>
                <div className="cat-name">{c.name}</div>
                <div className="cat-count">{c.count}</div>
              </div>
            ))}
          </div>

          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder="Search schemes by name or department…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="grid-3">
            {filtered.map(s => (
              <div className="scheme-card" key={s.id} onClick={() => navigate(`/schemes/${s.id}`)}>
                <div className="scheme-header">
                  <div>
                    <div className="scheme-name">{s.name}</div>
                    <div className="scheme-dept">{s.dept}</div>
                  </div>
                  <div className="scheme-amount">{s.amount}</div>
                </div>
                <div className="scheme-desc">{s.desc}</div>
                <div className="scheme-footer">
                  <span className="scheme-deadline">⏰ {s.deadline}</span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={e => { e.stopPropagation(); setModal(s); }}
                  >Apply</button>
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
