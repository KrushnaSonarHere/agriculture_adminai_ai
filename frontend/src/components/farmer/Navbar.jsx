import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="landing-navbar">
      <Link to="/" className="nav-brand">
        <div className="nav-logo">🌿</div>
        <span className="nav-brand-text">AgriPortal</span>
      </Link>
      <div className="nav-links">
        <a href="#features" className="nav-link">Features</a>
        <a href="#services" className="nav-link">Services</a>
        <a href="#" className="nav-link">About</a>
        <a href="#" className="nav-link">Contact</a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user ? (
          <button
            className="btn-nav-register"
            onClick={() => navigate(user.role === 'admin' ? '/admin' : '/dashboard')}
          >
            Dashboard →
          </button>
        ) : (
          <>
            <Link to="/login" className="btn-nav-login">Login</Link>
            <Link to="/register" className="btn-nav-register">Get Started →</Link>
          </>
        )}
      </div>
    </nav>
  );
}
