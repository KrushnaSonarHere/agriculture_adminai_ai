import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand-text">
            <div className="footer-icon">🌿</div>
            AgriPortal
          </div>
          <p className="footer-desc">Empowering farmers through technology and AI-powered solutions.</p>
        </div>
        <div className="footer-col">
          <h4>Quick Links</h4>
          <a href="#">About Us</a>
          <a href="#services">Services</a>
          <a href="#">Contact</a>
        </div>
        <div className="footer-col">
          <h4>For Farmers</h4>
          <Link to="/schemes">Apply for Schemes</Link>
          <Link to="/applications">Track Application</Link>
          <Link to="/grievance">Support</Link>
        </div>
        <div className="footer-col">
          <h4>Contact</h4>
          <p>Email: support@agriportal.gov.in</p>
          <p>Phone: 1800-300-XXXX</p>
          <p>Timing: 9 AM – 6 PM</p>
        </div>
      </div>
      <hr className="footer-divider" />
      <div className="footer-bottom">© 2026 AgriPortal. All rights reserved. Government of India Initiative.</div>
    </footer>
  );
}
