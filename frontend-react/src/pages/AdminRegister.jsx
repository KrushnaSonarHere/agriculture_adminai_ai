import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerAdmin } from '../api/auth';

export default function AdminRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', mobile: '', password: '', district: '', department: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!form.full_name || !form.email || !form.password) return setError('Please fill all required fields.');
    setLoading(true);
    try {
      await registerAdmin({ ...form, role: 'admin' });
      navigate('/login');
    } catch (e) {
      setError(e.response?.data?.detail || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const s = { minHeight: '100vh', background: 'linear-gradient(135deg,#E8F0FB,#EBF5EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter',sans-serif" };
  const card = { background: '#fff', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' };

  return (
    <div style={s}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#1B5E20,#2E7D32)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👮</div>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: '#1B5E20' }}>AgriPortal</div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Officer Registration</div></div>
        </div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Register as Officer</div>
        <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 28 }}>Create a government officer account to access the admin panel</div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid rgba(211,47,47,0.3)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#D32F2F', marginBottom: 16 }}>⚠️ {error}</div>}

        {[
          { label: 'Full Name *',       key: 'full_name',  type: 'text',     ph: 'Officer Sharma' },
          { label: 'Official Email *',  key: 'email',      type: 'email',    ph: 'officer@gov.in' },
          { label: 'Mobile Number',     key: 'mobile',     type: 'tel',      ph: '9000000001' },
          { label: 'Department',        key: 'department', type: 'text',     ph: 'Agriculture Ministry' },
          { label: 'District',          key: 'district',   type: 'text',     ph: 'Nashik' },
          { label: 'Password *',        key: 'password',   type: 'password', ph: 'Create a strong password' },
        ].map(f => (
          <div style={{ marginBottom: 18 }} key={f.key}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{f.label}</label>
            <input style={{ width: '100%', padding: '11px 14px', border: '1px solid #E2E8E2', borderRadius: 10, fontSize: 14, outline: 'none', background: '#FAFCFA' }}
              type={f.type} placeholder={f.ph} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}

        <button
          style={{ width: '100%', background: 'linear-gradient(135deg,#1565C0,#1E88E5)', color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer' }}
          onClick={handleSubmit} disabled={loading}
        >
          {loading ? 'Creating Account…' : '👮 Register as Officer'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#9CA3AF' }}>
          Already registered? <a href="/login" style={{ color: '#1565C0', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
        </div>
      </div>
    </div>
  );
}
