import { useState, useEffect } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar from '../../components/admin/AdminTopbar';
import { getAllDecisions, updateAiDecision, analyzeFarmer } from '../../api/ocr';
import '../../styles/admin.css';

export default function AiDecisions() {
  const [collapsed, setCollapsed] = useState(false);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchDecisions = async () => {
    setLoading(true);
    try {
      const res = await getAllDecisions();
      setDecisions(res.data);
    } catch (err) {
      setError('Failed to fetch AI decisions. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
  }, []);

  const handleAdminAction = async (decisionId, action) => {
    setProcessingId(decisionId);
    try {
      await updateAiDecision(decisionId, { 
        admin_decision: action,
        admin_remarks: `Processed by Admin on ${new Date().toLocaleDateString()}`
      });
      // Refresh local state or re-fetch
      fetchDecisions();
    } catch (err) {
      alert('Action failed. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReAnalyze = async (userId) => {
    setProcessingId(userId);
    try {
      await analyzeFarmer(userId);
      fetchDecisions();
    } catch (err) {
      alert('Analysis failed.');
    } finally {
      setProcessingId(null);
    }
  };

  // Stats calculation
  const total = decisions.length;
  const approved = decisions.filter(d => d.admin_decision === 'approved' || (d.decision === 'auto_approved' && !d.admin_decision)).length;
  const flagged = decisions.filter(d => d.decision === 'flagged' || d.admin_decision === 'flagged').length;
  const manual = decisions.filter(d => d.decision === 'manual_review' && !d.admin_decision).length;

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        <div className="admin-content">
          <div className="admin-header-row">
            <div>
              <h1 className="admin-title">◈ AI Strategic Decisions</h1>
              <p className="admin-subtitle">AI-powered recommendations for application verification</p>
            </div>
            <button className="btn-outline" onClick={fetchDecisions} disabled={loading}>
              {loading ? '...' : '🔄 Refresh Data'}
            </button>
          </div>

          {/* AI Decision Stats */}
          <div className="admin-card" style={{ marginBottom: 24 }}>
            <div className="grid-4" style={{ padding: '8px 0' }}>
              {[
                { label: 'Total Verified', val: total, color: '#64748b' },
                { label: 'Auto-Approved',  val: Math.round((approved/total)*100 || 0) + '%', color: '#10b981' },
                { label: 'High Risk/Flagged', val: flagged, color: '#ef4444' },
                { label: 'Manual Review',  val: manual, color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.val}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="admin-card" style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: 16 }}>Loading AI Intelligence Decisions...</p>
            </div>
          ) : error ? (
            <div className="alert-error">{error}</div>
          ) : decisions.length === 0 ? (
            <div className="admin-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
              <h3>No AI Decisions Found Yet</h3>
              <p>Applications will appear here once farmers upload documents and AI processing is complete.</p>
            </div>
          ) : (
            <div className="ai-rec-list">
              {decisions.map(d => (
                <div key={d.id} className={`ai-rec-card ${d.admin_decision ? 'processed' : ''}`}>
                  <div className={`ai-rec-header ${
                    d.decision === 'auto_approved' ? 'approve-bg' : 
                    d.decision === 'manual_review' ? 'review-bg' : 'flag-bg'
                  }`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="ai-rec-avatar">{d.farmer_name[0]}</div>
                      <div>
                        <div className="ai-rec-name">
                          {d.farmer_name} 
                          <span className={`badge ${
                            d.decision === 'auto_approved' ? 'badge-approved' : 
                            d.decision === 'manual_review' ? 'badge-review' : 'badge-rejected'
                          }`} style={{ marginLeft: 8 }}>
                            {d.decision.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="ai-rec-sub">{d.farmer_id} · {d.district} · {new Date(d.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="ai-score-container">
                      <div className="ai-score-label">AI Score</div>
                      <span className={`ai-score ${d.overall_score >= 85 ? 'ai-score-high' : d.overall_score >= 65 ? 'ai-score-mid' : 'ai-score-low'}`}>
                        {Math.round(d.overall_score)}
                      </span>
                    </div>
                  </div>

                  <div className="ai-rec-body">
                    <div className="ai-factors">
                      <h4 style={{ fontSize: 12, marginBottom: 8, color: 'var(--text2)' }}>Confidence Signals</h4>
                      <div className="ai-factors-grid">
                        <div className="ai-factor-group">
                          {/* We'd normally map d.positive_factors string if it were a list, but DB stores pipe-separated string */}
                          <div className="ai-factor-ok">📊 Confidence: {Math.round(d.confidence)}%</div>
                          <div className="ai-factor-ok">🎲 Approval Prob: {Math.round(d.approval_probability)}%</div>
                          {d.overall_score > 80 && <div className="ai-factor-ok">✅ Document Authenticity Verified</div>}
                        </div>
                        <div className="ai-factor-group">
                          <div className="ai-factor-risk">📉 Fraud Risk: {Math.round(d.fraud_risk)}%</div>
                          {d.duplicate_aadhaar && <div className="ai-factor-risk">⚠️ Duplicate Aadhaar Found</div>}
                          {d.mismatch_fields && d.mismatch_fields.length > 0 && (
                            <div className="ai-factor-risk">❌ Mismatches: {d.mismatch_fields.replace(/\|/g, ', ')}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ai-rec-actions">
                      {d.admin_decision ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span className={`badge badge-${d.admin_decision}`}>
                            ADMIN {d.admin_decision.toUpperCase()}
                          </span>
                          <button className="btn-text-sm" onClick={() => handleReAnalyze(d.user_id)}>↺ Recalculate</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-outline btn-sm" disabled={processingId === d.id} onClick={() => handleAdminAction(d.id, 'rejected')}>Reject</button>
                            <button className="btn-outline btn-sm" disabled={processingId === d.id} onClick={() => handleAdminAction(d.id, 'flagged')}>Flag</button>
                            <button className="btn-primary btn-sm" disabled={processingId === d.id} onClick={() => handleAdminAction(d.id, 'approved')}>Approve</button>
                          </div>
                          <button className="btn-text-sm" disabled={processingId === d.id} onClick={() => handleReAnalyze(d.user_id)}>↺ Re-Analyze</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ai-rec-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .ai-rec-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        .ai-rec-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          border-color: #cbd5e1;
        }
        .ai-rec-card.processed {
          opacity: 0.85;
          grayscale: 0.5;
        }
        .ai-rec-header {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .approve-bg { background: linear-gradient(to right, #f0fdf4, #ffffff); border-bottom: 1px solid #dcfce7; }
        .review-bg  { background: linear-gradient(to right, #fffbeb, #ffffff); border-bottom: 1px solid #fef3c7; }
        .flag-bg    { background: linear-gradient(to right, #fef2f2, #ffffff); border-bottom: 1px solid #fee2e2; }

        .ai-rec-avatar {
          width: 40px;
          height: 40px;
          background: #334155;
          color: white;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
        }
        .ai-rec-name {
          font-weight: 700;
          font-size: 16px;
          color: #1e293b;
          display: flex;
          align-items: center;
        }
        .ai-rec-sub {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
        .ai-score-container {
          text-align: right;
        }
        .ai-score-label {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: -2px;
        }
        .ai-score {
          font-size: 32px;
          font-weight: 900;
        }
        .ai-score-high { color: #10b981; }
        .ai-score-mid  { color: #f59e0b; }
        .ai-score-low  { color: #ef4444; }

        .ai-rec-body {
          padding: 16px 20px;
        }
        .ai-factors {
          margin-bottom: 16px;
        }
        .ai-factors-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .ai-factor-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ai-factor-ok {
          font-size: 13px;
          color: #15803d;
          background: #f0fdf4;
          padding: 6px 10px;
          border-radius: 6px;
          border-left: 3px solid #10b981;
        }
        .ai-factor-risk {
          font-size: 13px;
          color: #b91c1c;
          background: #fef2f2;
          padding: 6px 10px;
          border-radius: 6px;
          border-left: 3px solid #ef4444;
        }
        .ai-rec-actions {
          padding-top: 16px;
          border-top: 1px dashed #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .btn-text-sm {
          background: none;
          border: none;
          color: #1e293b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          opacity: 0.6;
        }
        .btn-text-sm:hover { opacity: 1; text-decoration: underline; }
        
        .badge-approved { background: #dcfce7; color: #166534; }
        .badge-rejected { background: #fee2e2; color: #991b1b; }
        .badge-review   { background: #fef3c7; color: #92400e; }
        .badge-flagged  { background: #fee2e2; color: #991b1b; }
      `}} />
    </div>
  );
}
