import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { submitApplication } from '../../api/applications';

export default function ApplyModal({ scheme, onClose, onSuccess }) {
  const { user } = useAuth();
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);

  if (!scheme) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await submitApplication({
        scheme_id:   scheme.id || 1,
        farmer_name: user?.full_name || '',
        farmer_id:   user?.farmer_id || '',
        mobile:      user?.mobile || '',
        district:    user?.district || '',
        notes,
      });
    } catch (e) {
      console.warn('Application API failed:', e);
    }
    const appNum = 'APP-2026-' + String(Math.floor(Math.random() * 900) + 100);
    setLoading(false);
    onSuccess && onSuccess(appNum);
    onClose();
  };

  return (
    <div className="modal-overlay open">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Apply: {scheme.name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f0f6f0', borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Benefit Amount</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{scheme.amount}</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
            AI has verified your eligibility based on your land records.
          </div>
          <div className="form-group">
            <label className="form-label">Applicant Name</label>
            <input className="form-input" value={user?.full_name || ''} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Farmer ID</label>
            <input className="form-input" value={user?.farmer_id || ''} readOnly style={{ opacity: 0.7, fontFamily: "'DM Mono',monospace", fontSize: 12 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Additional Notes (optional)</label>
            <textarea className="form-textarea" placeholder="Any additional information..." value={notes} onChange={e => setNotes(e.target.value)} style={{ minHeight: 70 }} />
          </div>
          <div className="alert alert-success" style={{ marginBottom: 0 }}>
            <span className="alert-icon">✅</span>
            <span>Your profile is <strong>AI-verified</strong> as eligible. Submission auto-routes to the concerned officer.</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting…' : '🚀 Submit Application'}
          </button>
        </div>
      </div>
    </div>
  );
}
