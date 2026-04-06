import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/farmer/Sidebar';
import Topbar from '../components/farmer/Topbar';
// ApplyModal replaced by Smart Apply wizard — see /apply route
import '../styles/farmer.css';
import '../styles/scheme-detail.css';

const API = 'http://localhost:8000';

// Language translations for UI labels
const LANG = {
  en: {
    back: '← Back to Schemes',
    about: 'About the Scheme',
    overview: 'Overview',
    benefits: 'Benefits',
    viewBenefits: 'View Benefits',
    hideBenefits: 'Hide Benefits',
    eligibility: 'Eligibility Criteria',
    documents: 'Required Documents',
    applyNow: '🚀 Apply Now',
    download: '📄 Download Info',
    department: 'Department',
    ministry: 'Government of India / Maharashtra',
    status: 'Active Scheme',
    loading: 'Loading scheme details…',
    notFound: 'Scheme not found',
    timeline: 'Application Timeline',
    step1: 'Apply Online',
    step2: 'Document Verification',
    step3: 'AI Screening',
    step4: 'Admin Review',
    step5: 'Disbursement',
  },
  mr: {
    back: '← योजनांकडे परत जा',
    about: 'योजनेबद्दल',
    overview: 'आढावा',
    benefits: 'फायदे',
    viewBenefits: 'फायदे पहा',
    hideBenefits: 'फायदे लपवा',
    eligibility: 'पात्रता निकष',
    documents: 'आवश्यक कागदपत्रे',
    applyNow: '🚀 अर्ज करा',
    download: '📄 माहिती डाउनलोड करा',
    department: 'विभाग',
    ministry: 'भारत सरकार / महाराष्ट्र',
    status: 'सक्रिय योजना',
    loading: 'योजनेची माहिती लोड होत आहे…',
    notFound: 'योजना सापडली नाही',
    timeline: 'अर्ज प्रक्रिया',
    step1: 'ऑनलाइन अर्ज',
    step2: 'कागदपत्र पडताळणी',
    step3: 'AI तपासणी',
    step4: 'प्रशासकीय आढावा',
    step5: 'वितरण',
  },
  hi: {
    back: '← योजनाओं पर वापस जाएं',
    about: 'योजना के बारे में',
    overview: 'अवलोकन',
    benefits: 'लाभ',
    viewBenefits: 'लाभ देखें',
    hideBenefits: 'लाभ छिपाएं',
    eligibility: 'पात्रता मानदंड',
    documents: 'आवश्यक दस्तावेज़',
    applyNow: '🚀 अभी आवेदन करें',
    download: '📄 जानकारी डाउनलोड करें',
    department: 'विभाग',
    ministry: 'भारत सरकार / महाराष्ट्र',
    status: 'सक्रिय योजना',
    loading: 'योजना विवरण लोड हो रहा है…',
    notFound: 'योजना नहीं मिली',
    timeline: 'आवेदन प्रक्रिया',
    step1: 'ऑनलाइन आवेदन',
    step2: 'दस्तावेज़ सत्यापन',
    step3: 'AI जांच',
    step4: 'प्रशासनिक समीक्षा',
    step5: 'वितरण',
  },
};

// Parse pipe-separated or JSON arrays from DB text fields
function parseList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return raw.split(/[|,\n]/).map(s => s.trim()).filter(Boolean);
}

// Status timeline component
function Timeline({ t }) {
  const steps = [t.step1, t.step2, t.step3, t.step4, t.step5];
  const icons = ['📝', '📄', '🤖', '👨‍💼', '💰'];
  return (
    <div className="sd-timeline">
      {steps.map((step, i) => (
        <div key={i} className="sd-timeline-step">
          <div className="sd-timeline-icon">{icons[i]}</div>
          <div className="sd-timeline-label">{step}</div>
          {i < steps.length - 1 && <div className="sd-timeline-arrow">→</div>}
        </div>
      ))}
    </div>
  );
}

// Collapsible section component
function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sd-section">
      <button className="sd-section-header" onClick={() => setOpen(o => !o)} type="button">
        <span className="sd-section-title">
          <span className="sd-section-icon">{icon}</span>
          {title}
        </span>
        <span className="sd-section-toggle">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="sd-section-body">{children}</div>}
    </div>
  );
}

export default function SchemeDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scheme,   setScheme]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [lang,     setLang]     = useState('en');
  const [benefitsOpen, setBenefitsOpen] = useState(false);

  const t = LANG[lang];

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/schemes/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => {
        setScheme(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="shell">
        <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
        <main className="main">
          <Topbar title="Scheme Details" onMenuClick={() => setSidebarOpen(o => !o)} />
          <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <div className="sd-loading">
              <div className="sd-spinner" />
              <p>{t.loading}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !scheme) {
    return (
      <div className="shell">
        <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
        <main className="main">
          <Topbar title="Scheme Details" onMenuClick={() => setSidebarOpen(o => !o)} />
          <div className="page-content" style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48 }}>😕</div>
            <p>{t.notFound}</p>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/schemes')}>← Back</button>
          </div>
        </main>
      </div>
    );
  }

  const eligibilityList = parseList(scheme.Eligibility);
  const documentList    = parseList(scheme.Required_Documents);
  const benefitsList    = parseList(scheme.Grant);

  // Ensure we always have items to display
  const defaultEligibility = [
    'Aadhaar Card required',
    '7/12 & 8-A land record required',
    'Caste certificate if applicable',
    'Banks account linked to Aadhaar',
    'Maharashtra resident farmer',
  ];
  const defaultDocuments = [
    'Aadhaar Card',
    '7/12 Certificate',
    '8-A Certificate',
    'Bank Passbook / Cancelled Cheque',
    'Caste Certificate (if applicable)',
    'Self Declaration',
    'Passport-size Photograph',
  ];

  const finalEligibility = eligibilityList.length > 0 ? eligibilityList : defaultEligibility;
  const finalDocuments   = documentList.length    > 0 ? documentList    : defaultDocuments;

  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="Scheme Details" onMenuClick={() => setSidebarOpen(o => !o)} />

        <div className="page-content sd-page" id="scheme-detail-print">

          {/* ── Top control bar ──────────────────────────────── */}
          <div className="sd-controls">
            <button
              className="btn btn-outline btn-sm sd-back-btn"
              onClick={() => navigate('/schemes')}
            >
              {t.back}
            </button>

            <div className="sd-lang-toggle">
              {['en', 'mr', 'hi'].map(l => (
                <button
                  key={l}
                  className={`sd-lang-btn ${lang === l ? 'active' : ''}`}
                  onClick={() => setLang(l)}
                >
                  {l === 'en' ? 'EN' : l === 'mr' ? 'मराठी' : 'हिंदी'}
                </button>
              ))}
            </div>

            <button
              className="btn btn-outline btn-sm sd-print-btn"
              onClick={handlePrint}
            >
              {t.download}
            </button>
          </div>

          {/* ── Hero header card ─────────────────────────────── */}
          <div className="sd-hero">
            <div className="sd-hero-badge">
              <span className="sd-status-dot" />
              {t.status}
            </div>

            <h1 className="sd-hero-title">{scheme.Scheme_Name}</h1>

            <div className="sd-hero-meta">
              <div className="sd-hero-meta-item">
                <span className="sd-meta-icon">🏛️</span>
                <div>
                  <div className="sd-meta-label">{t.department}</div>
                  <div className="sd-meta-value">{scheme.Department || 'Dept. of Agriculture'}</div>
                </div>
              </div>
              <div className="sd-hero-meta-item">
                <span className="sd-meta-icon">🇮🇳</span>
                <div>
                  <div className="sd-meta-label">Authority</div>
                  <div className="sd-meta-value">{t.ministry}</div>
                </div>
              </div>
              {scheme.Grant && (
                <div className="sd-hero-meta-item">
                  <span className="sd-meta-icon">💰</span>
                  <div>
                    <div className="sd-meta-label">Grant / Benefit</div>
                    <div className="sd-meta-value sd-meta-grant">
                      {typeof scheme.Grant === 'string' && scheme.Grant.length < 60
                        ? scheme.Grant
                        : 'View Benefits below'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sd-hero-tags">
              <span className="sd-tag green">✅ Active</span>
              <span className="sd-tag blue">🌾 Agriculture</span>
              <span className="sd-tag orange">📋 Scheme No. {id}</span>
            </div>
          </div>

          {/* ── Application Timeline ──────────────────────────── */}
          <div className="sd-card">
            <div className="sd-card-label">
              <span>🗺️</span> {t.timeline}
            </div>
            <Timeline t={t} />
          </div>

          {/* ── Overview ─────────────────────────────────────── */}
          <Section title={t.overview} icon="📖" defaultOpen={true}>
            <p className="sd-prose">
              {scheme.Summary
                || 'This government scheme provides financial assistance and technological support to eligible farmers in Maharashtra. Farmers meeting the eligibility criteria can apply online through the KisanSetu portal and benefit from direct support under this initiative.'}
            </p>
          </Section>

          {/* ── Benefits ─────────────────────────────────────── */}
          <Section title={t.benefits} icon="💎" defaultOpen={true}>
            {benefitsList.length > 0 ? (
              <ul className="sd-benefit-list">
                {benefitsList.map((b, i) => (
                  <li key={i} className="sd-benefit-item">
                    <span className="sd-benefit-icon">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                {!benefitsOpen ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                    <p className="sd-prose" style={{ margin: 0 }}>
                      This scheme provides substantial financial benefits to eligible farmers including direct subsidy support, crop insurance coverage, and technical assistance.
                    </p>
                    <button
                      className="sd-benefits-btn"
                      onClick={() => setBenefitsOpen(true)}
                    >
                      {t.viewBenefits} ▼
                    </button>
                  </div>
                ) : (
                  <div>
                    <ul className="sd-benefit-list">
                      {[
                        'Direct financial assistance to farmer bank accounts',
                        'Subsidised access to agricultural equipment',
                        'Crop loss compensation under insurance',
                        'Free soil testing and advisory services',
                        'Priority access to government loans at reduced rates',
                      ].map((b, i) => (
                        <li key={i} className="sd-benefit-item">
                          <span className="sd-benefit-icon">✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="sd-benefits-btn outline"
                      onClick={() => setBenefitsOpen(false)}
                    >
                      {t.hideBenefits} ▲
                    </button>
                  </div>
                )}
              </>
            )}
          </Section>

          {/* ── Two-column: Eligibility + Documents ──────────── */}
          <div className="sd-two-col">

            {/* Eligibility */}
            <Section title={t.eligibility} icon="✅" defaultOpen={true}>
              <ul className="sd-check-list">
                {finalEligibility.map((item, i) => (
                  <li key={i} className="sd-check-item">
                    <span className="sd-check-icon">✔</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Documents */}
            <Section title={t.documents} icon="📄" defaultOpen={true}>
              <ul className="sd-doc-list">
                {finalDocuments.map((doc, i) => (
                  <li key={i} className="sd-doc-item">
                    <span className="sd-doc-icon">📄</span>
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </Section>

          </div>

          {/* ── CTA Footer ───────────────────────────────────── */}
          <div className="sd-cta">
            <div className="sd-cta-text">
              <div className="sd-cta-heading">Ready to apply?</div>
              <div className="sd-cta-sub">Complete the application form to begin your journey</div>
            </div>
            <button
              className="sd-cta-btn"
              onClick={() => navigate(`/apply?scheme_id=${scheme.id}&scheme_name=${encodeURIComponent(scheme.Scheme_Name)}`)}
            >
              {t.applyNow}
            </button>
          </div>

        </div>
      </main>

    </div>
  );
}
