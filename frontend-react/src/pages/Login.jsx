import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../api/auth';

const loginStyles = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;}
.login-page{min-height:100vh;background:linear-gradient(135deg,#EBF5EB 0%,#E8F0FB 100%);display:flex;align-items:center;justify-content:center;padding:24px;}
.login-wrap{display:flex;gap:32px;align-items:center;max-width:900px;width:100%;}
.left-panel{background:#fff;border-radius:24px;padding:36px 32px;width:320px;flex-shrink:0;box-shadow:0 8px 32px rgba(0,0,0,0.08);border:1px solid rgba(46,125,50,0.1);}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:28px;}
.brand-icon{width:44px;height:44px;background:linear-gradient(135deg,#1B5E20,#2E7D32);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;}
.brand-name{font-size:20px;font-weight:800;color:#1B5E20;}
.brand-sub{font-size:11px;color:#9CA3AF;}
.welcome-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:8px;}
.welcome-desc{font-size:13px;color:#525252;line-height:1.6;margin-bottom:24px;}
.role-feature{display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;margin-bottom:10px;border:1px solid #E2E8E2;cursor:pointer;transition:all 0.2s;}
.role-feature.green{background:#E8F5E9;border-color:rgba(46,125,50,0.3);}
.role-feature.blue{background:#EEF4FE;border-color:rgba(21,101,192,0.2);}
.role-feature-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.role-feature.green .role-feature-icon{background:#2E7D32;}
.role-feature.blue .role-feature-icon{background:#1565C0;}
.role-feature-title{font-size:13px;font-weight:700;}
.role-feature-desc{font-size:11px;color:#9CA3AF;}
.right-panel{background:#fff;border-radius:24px;padding:40px 36px;flex:1;box-shadow:0 8px 32px rgba(0,0,0,0.08);border:1px solid rgba(46,125,50,0.1);}
.form-title{font-size:22px;font-weight:800;margin-bottom:4px;}
.form-sub{font-size:13px;color:#9CA3AF;margin-bottom:28px;}
.role-select-label{font-size:12px;font-weight:700;color:#525252;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
.role-options{display:flex;flex-direction:column;gap:8px;margin-bottom:24px;}
.role-option{display:flex;align-items:center;gap:12px;padding:12px 16px;border:1.5px solid #E2E8E2;border-radius:12px;cursor:pointer;transition:all 0.2s;user-select:none;}
.role-option.selected{border-color:#2E7D32;background:#E8F5E9;}
.role-option.selected.admin{border-color:#1565C0;background:#EEF4FE;}
.role-radio{width:18px;height:18px;border-radius:50%;border:2px solid #E2E8E2;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
.role-option.selected .role-radio{border-color:#2E7D32;background:#2E7D32;}
.role-option.selected.admin .role-radio{border-color:#1565C0;background:#1565C0;}
.role-radio-dot{width:6px;height:6px;border-radius:50%;background:#fff;}
.role-name{font-size:13px;font-weight:600;}
.role-desc{font-size:11px;color:#9CA3AF;}
.role-badge{margin-left:auto;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;}
.role-badge.green{background:#2E7D32;color:#fff;}
.role-badge.blue{background:#1565C0;color:#fff;}
.field-label{font-size:12px;font-weight:700;color:#525252;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:8px;}
.field-wrap{position:relative;margin-bottom:18px;}
.field-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:16px;color:#9CA3AF;pointer-events:none;}
.login-input{width:100%;padding:12px 14px 12px 40px;border:1.5px solid #E2E8E2;border-radius:12px;font-size:14px;font-family:'Inter',sans-serif;background:#FAFCFA;transition:all 0.2s;outline:none;}
.login-input:focus{border-color:#2E7D32;box-shadow:0 0 0 3px rgba(46,125,50,0.1);background:#fff;}
.login-input.error{border-color:#D32F2F;}
.forgot-link{text-align:right;margin-top:-10px;margin-bottom:18px;}
.forgot-link a{font-size:12px;color:#2E7D32;text-decoration:none;font-weight:500;}
.btn-submit{width:100%;background:linear-gradient(135deg,#1B5E20,#2E7D32);color:#fff;font-size:15px;font-weight:700;padding:14px;border-radius:12px;border:none;cursor:pointer;transition:all 0.25s;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(46,125,50,0.35);}
.btn-submit:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(46,125,50,0.4);}
.btn-submit:disabled{background:#9CA3AF;cursor:not-allowed;transform:none;box-shadow:none;}
.register-link{text-align:center;margin-top:16px;font-size:13px;color:#9CA3AF;}
.register-link a{color:#2E7D32;font-weight:600;text-decoration:none;}
.demo-box{background:#EEF4FE;border:1px solid rgba(21,101,192,0.2);border-radius:12px;padding:14px 16px;margin-top:20px;}
.demo-box-title{font-size:11px;font-weight:700;color:#1565C0;margin-bottom:8px;text-transform:uppercase;}
.demo-link{display:block;font-size:12px;color:#1565C0;text-decoration:none;margin-bottom:3px;cursor:pointer;background:none;border:none;padding:0;}
.demo-link:hover{text-decoration:underline;}
.error-msg{background:#FEF2F2;border:1px solid rgba(211,47,47,0.3);border-radius:10px;padding:12px 14px;font-size:13px;color:#D32F2F;margin-bottom:16px;}
@media(max-width:720px){.login-wrap{flex-direction:column;gap:20px;}.left-panel{width:100%;}}
`;

export default function Login() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const [role, setRole]         = useState('farmer');
  const [credential, setCred]   = useState('');
  const [password, setPass]     = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const fillDemo = (r) => {
    setRole(r);
    // Use real seeded credentials (run seed_admin_demo.py once to create these)
    setCred(r === 'farmer' ? 'ramesh2@farm.in' : 'admin@agriportal.gov.in');
    setPass(r === 'farmer' ? 'farmer123' : 'admin123');
  };

  const handleSubmit = async () => {
    setError('');
    if (!credential) return setError('Please enter your email or mobile number.');
    if (!password)   return setError('Please enter your password.');
    setLoading(true);
    try {
      const res  = await loginUser(credential, password);
      const user = res.data;
      if (role === 'admin'  && user.role !== 'admin')  throw new Error('This account does not have admin privileges.');
      if (role === 'farmer' && user.role !== 'farmer') throw new Error('Please use the Government Officer login for admin accounts.');
      login(user);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network')) {
        setError('Cannot reach the server. Make sure FastAPI backend is running on port 8000.');
      } else {
        setError(detail || err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{loginStyles}</style>
      <div className="login-page">
        <div className="login-wrap">
          {/* Left panel */}
          <div className="left-panel">
            <div className="brand">
              <div className="brand-icon">🌿</div>
              <div>
                <div className="brand-name">AgriPortal</div>
                <div className="brand-sub">Smart Agriculture Platform</div>
              </div>
            </div>
            <div className="welcome-title">Welcome Back!</div>
            <p className="welcome-desc">Access your dashboard to manage schemes, applications, and more.</p>
            <div className="role-feature green">
              <div className="role-feature-icon">🌾</div>
              <div>
                <div className="role-feature-title">For Farmers</div>
                <div className="role-feature-desc">Apply for schemes and track applications</div>
              </div>
            </div>
            <div className="role-feature blue">
              <div className="role-feature-icon">👮</div>
              <div>
                <div className="role-feature-title">For Officers</div>
                <div className="role-feature-desc">Manage applications and verify documents</div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="right-panel">
            <div className="form-title">Sign In</div>
            <div className="form-sub">Enter your credentials to access your account</div>

            {error && <div className="error-msg">⚠️ {error}</div>}

            <div className="role-select-label">Login As</div>
            <div className="role-options">
              <div className={`role-option ${role === 'farmer' ? 'selected' : ''}`} onClick={() => setRole('farmer')}>
                <div className="role-radio">{role === 'farmer' && <div className="role-radio-dot" />}</div>
                <div><div className="role-name">🌾 Farmer</div><div className="role-desc">Access farmer portal</div></div>
                <span className="role-badge green">Farmer</span>
              </div>
              <div className={`role-option admin ${role === 'admin' ? 'selected' : ''}`} onClick={() => setRole('admin')}>
                <div className="role-radio">{role === 'admin' && <div className="role-radio-dot" />}</div>
                <div><div className="role-name">👮 Government Officer / Admin</div><div className="role-desc">Access admin portal</div></div>
                <span className="role-badge blue">Admin</span>
              </div>
            </div>

            <label className="field-label">Email / Mobile Number</label>
            <div className="field-wrap">
              <span className="field-icon">👤</span>
              <input className="login-input" type="text" placeholder="Enter your email or mobile"
                value={credential} onChange={e => setCred(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            <label className="field-label">Password</label>
            <div className="field-wrap">
              <span className="field-icon">🔒</span>
              <input className="login-input" type="password" placeholder="Enter your password"
                value={password} onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            <div className="forgot-link"><a href="#">Forgot password?</a></div>

            <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Signing in…' : '🔐 Sign In'}
            </button>

            <div className="register-link">
              Don't have an account?&nbsp;
              <Link to={role === 'admin' ? '/admin/register' : '/register'}>
                {role === 'admin' ? 'Register as Officer' : 'Register here'}
              </Link>
            </div>

            <div className="demo-box">
              <div className="demo-box-title">Demo Credentials</div>
              <button className="demo-link" onClick={() => fillDemo('farmer')}>🌾 Farmer: ramesh2@farm.in / farmer123</button>
              <button className="demo-link" onClick={() => fillDemo('admin')}>👮 Admin: admin@agriportal.gov.in / admin123</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
