import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/farmer/Navbar';
import Footer from '../components/farmer/Footer';
import '../styles/farmer.css';

// Landing page inline styles (migrated from index.html)
const landingStyles = `
.landing-navbar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,0.92);backdrop-filter:blur(20px);border-bottom:1px solid #E8F0E8;padding:0 48px;height:64px;display:flex;align-items:center;justify-content:space-between;}
.nav-brand{display:flex;align-items:center;gap:10px;text-decoration:none;}
.nav-logo{width:38px;height:38px;background:linear-gradient(135deg,#1B5E20,#2E7D32);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;}
.nav-brand-text{font-size:18px;font-weight:800;color:#1B5E20;}
.nav-links{display:flex;align-items:center;gap:8px;}
.nav-link{color:#525252;font-size:14px;font-weight:500;padding:8px 16px;border-radius:8px;transition:all 0.2s;text-decoration:none;}
.nav-link:hover{background:#E8F5E9;color:#2E7D32;}
.btn-nav-login{background:transparent;border:1.5px solid #2E7D32;color:#2E7D32;font-size:14px;font-weight:600;padding:8px 20px;border-radius:10px;cursor:pointer;text-decoration:none;transition:all 0.2s;}
.btn-nav-login:hover{background:#2E7D32;color:#fff;}
.btn-nav-register{background:#2E7D32;color:#fff;font-size:14px;font-weight:600;padding:9px 22px;border-radius:10px;border:none;cursor:pointer;text-decoration:none;transition:all 0.2s;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 12px rgba(46,125,50,0.3);}
.btn-nav-register:hover{background:#1B5E20;transform:translateY(-1px);}
.hero{min-height:100vh;background:linear-gradient(135deg,#F0F7F0 0%,#E8F5E9 40%,#EEF4FB 100%);display:flex;align-items:center;padding:80px 48px 60px;position:relative;overflow:hidden;}
.hero-inner{max-width:1200px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:#E8F5E9;border:1px solid rgba(46,125,50,0.3);color:#2E7D32;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px;margin-bottom:20px;}
.hero h1{font-family:'Playfair Display',serif;font-size:52px;font-weight:900;line-height:1.15;color:#1A1A2E;margin-bottom:20px;}
.hero h1 .accent{color:#2E7D32;}
.hero-desc{font-size:16px;color:#525252;line-height:1.7;margin-bottom:36px;max-width:480px;}
.hero-btns{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:48px;}
.btn-primary-hero{background:#2E7D32;color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;border:none;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all 0.25s;box-shadow:0 4px 16px rgba(46,125,50,0.35);}
.btn-primary-hero:hover{background:#1B5E20;transform:translateY(-2px);}
.btn-secondary-hero{background:#fff;color:#1A1A2E;font-size:15px;font-weight:600;padding:14px 28px;border-radius:12px;border:1.5px solid #E8F0E8;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all 0.2s;}
.btn-secondary-hero:hover{border-color:#2E7D32;color:#2E7D32;}
.hero-card{background:#fff;border-radius:24px;padding:32px;box-shadow:0 16px 48px rgba(0,0,0,0.12);border:1px solid #E8F0E8;position:relative;}
.hero-card::before{content:'🌾';position:absolute;top:-20px;right:24px;font-size:40px;}
.stat-item{display:flex;align-items:center;gap:16px;padding:16px;background:#F7FAF7;border-radius:14px;margin-bottom:12px;border:1px solid #E8F0E8;transition:all 0.2s;}
.stat-item:hover{background:#E8F5E9;}
.stat-item:last-child{margin-bottom:0;}
.stat-icon-hero{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.stat-icon-hero.green{background:linear-gradient(135deg,#2E7D32,#4CAF50);}
.stat-icon-hero.blue{background:linear-gradient(135deg,#1565C0,#1E88E5);}
.stat-icon-hero.gold{background:linear-gradient(135deg,#E65100,#FF8F00);}
.stat-num{font-size:22px;font-weight:800;color:#1A1A2E;}
.stat-lbl{font-size:12px;color:#9CA3AF;font-weight:500;}
.features-section{padding:88px 48px;background:#fff;}
.section-header{text-align:center;margin-bottom:56px;}
.section-tag{display:inline-block;background:#E8F5E9;color:#2E7D32;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:6px 16px;border-radius:20px;margin-bottom:12px;}
.section-title-home{font-family:'Playfair Display',serif;font-size:38px;font-weight:700;color:#1A1A2E;margin-bottom:12px;}
.features-grid{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;}
.feature-card{background:#F7FAF7;border:1.5px solid #E8F0E8;border-radius:20px;padding:28px 24px;transition:all 0.25s;}
.feature-card:hover{background:#E8F5E9;border-color:rgba(46,125,50,0.3);transform:translateY(-4px);box-shadow:0 12px 32px rgba(46,125,50,0.1);}
.feature-icon-wrap{width:52px;height:52px;border-radius:14px;background:#E8F5E9;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:16px;}
.feature-card h3{font-size:15px;font-weight:700;margin-bottom:8px;}
.feature-card p{font-size:13px;color:#525252;line-height:1.6;}
.services-section{padding:88px 48px;background:#F7FAF7;}
.services-grid{max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
.service-card{background:#fff;border:1.5px solid #E8F0E8;border-radius:20px;padding:32px 24px;text-align:center;transition:all 0.25s;}
.service-card:hover{transform:translateY(-4px);box-shadow:0 16px 48px rgba(0,0,0,0.12);}
.service-icon{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#1B5E20,#2E7D32);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;box-shadow:0 8px 20px rgba(46,125,50,0.25);}
.cta-section{background:linear-gradient(135deg,#1B5E20 0%,#2E7D32 50%,#388E3C 100%);padding:88px 48px;text-align:center;}
.cta-section h2{font-family:'Playfair Display',serif;font-size:40px;font-weight:700;color:#fff;margin-bottom:16px;}
.cta-section p{font-size:16px;color:rgba(255,255,255,0.8);max-width:560px;margin:0 auto 36px;}
.btn-cta{background:#fff;color:#2E7D32;font-size:15px;font-weight:700;padding:15px 36px;border-radius:12px;border:none;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all 0.25s;box-shadow:0 8px 24px rgba(0,0,0,0.15);}
.btn-cta:hover{transform:translateY(-2px);}
.landing-footer{background:#0D1F0D;color:rgba(255,255,255,0.7);padding:56px 48px 32px;}
.footer-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px;}
.footer-brand-text{font-size:20px;font-weight:800;color:#fff;display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.footer-icon{width:32px;height:32px;background:#2E7D32;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;}
.footer-desc{font-size:13px;line-height:1.7;color:rgba(255,255,255,0.5);}
.footer-col h4{font-size:13px;font-weight:700;color:#fff;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px;}
.footer-col a{display:block;color:rgba(255,255,255,0.5);font-size:13px;text-decoration:none;margin-bottom:8px;transition:color 0.2s;}
.footer-col a:hover{color:#81C784;}
.footer-col p{font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:6px;}
.footer-divider{border:none;border-top:1px solid rgba(255,255,255,0.08);margin-bottom:24px;}
.footer-bottom{max-width:1100px;margin:0 auto;text-align:center;font-size:12px;color:rgba(255,255,255,0.35);}
@media(max-width:1024px){.hero-inner{grid-template-columns:1fr;gap:48px;}.features-grid{grid-template-columns:repeat(2,1fr);}.footer-inner{grid-template-columns:1fr 1fr;gap:32px;}}
@media(max-width:768px){.landing-navbar{padding:0 20px;}.hero{padding:80px 20px 48px;}.hero h1{font-size:34px;}.features-section,.services-section,.cta-section{padding:56px 20px;}.features-grid{grid-template-columns:1fr 1fr;}.services-grid{grid-template-columns:1fr;}.footer-inner{grid-template-columns:1fr 1fr;}.nav-links{display:none;}}
@media(max-width:480px){.features-grid{grid-template-columns:1fr;}.footer-inner{grid-template-columns:1fr;}}
`;

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <style>{landingStyles}</style>
      <Navbar />

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div>
            <div className="hero-badge">🇮🇳 Government of India Initiative</div>
            <h1>Smart Agriculture<br /><span className="accent">Administration</span><br />Platform</h1>
            <p className="hero-desc">Empowering farmers with AI-powered tools for scheme applications, subsidies, and instant support.</p>
            <div className="hero-btns">
              <Link to={user ? '/dashboard' : '/register'} className="btn-primary-hero">
                {user ? 'Go to Dashboard →' : 'Register Now →'}
              </Link>
              {!user && <Link to="/login" className="btn-secondary-hero">Login</Link>}
            </div>
          </div>
          <div className="hero-card">
            <div className="stat-item">
              <div className="stat-icon-hero green">👥</div>
              <div><div className="stat-num">50,000+</div><div className="stat-lbl">Registered Farmers</div></div>
            </div>
            <div className="stat-item">
              <div className="stat-icon-hero blue">📋</div>
              <div><div className="stat-num">1,00,000+</div><div className="stat-lbl">Applications Processed</div></div>
            </div>
            <div className="stat-item">
              <div className="stat-icon-hero gold">🤖</div>
              <div><div className="stat-num">98%</div><div className="stat-lbl">AI Accuracy Rate</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <div className="section-header">
          <div className="section-tag">Platform Features</div>
          <h2 className="section-title-home">Built for farmers,<br />designed for efficiency</h2>
        </div>
        <div className="features-grid">
          {[
            { icon: '🌾', title: 'Smart Agriculture Management', desc: 'Comprehensive platform for farmers to access government schemes and subsidies' },
            { icon: '🤖', title: 'AI-Powered Assistance',        desc: 'Intelligent document verification, decision support, and automated complaint handling' },
            { icon: '🛡️', title: 'Secure & Transparent',         desc: 'Government-grade security with complete transparency in all processes' },
            { icon: '👥', title: 'Role-Based Access',            desc: 'Separate portals for farmers and government officers for efficient management' },
          ].map((f, i) => (
            <div className="feature-card" key={i}>
              <div className="feature-icon-wrap">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="services-section" id="services">
        <div className="section-header">
          <div className="section-tag">Our Services</div>
          <h2 className="section-title-home">Everything you need<br />in one platform</h2>
        </div>
        <div className="services-grid">
          {[
            { icon: '📋', title: 'Scheme Applications',  desc: 'Easy online application process for agricultural schemes and subsidies' },
            { icon: '💬', title: 'AI Chatbot Support',   desc: '24/7 automated support for complaints and queries' },
            { icon: '📈', title: 'Real-time Tracking',   desc: 'Track application status and receive timely updates at every step' },
          ].map((s, i) => (
            <div className="service-card" key={i}>
              <div className="service-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Ready to Get Started?</h2>
        <p>Join thousands of farmers already benefiting from our platform. Register today and access all agricultural schemes and subsidies.</p>
        <Link to="/register" className="btn-cta">Create Your Account →</Link>
      </section>

      <Footer />
    </>
  );
}
