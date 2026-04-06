import { useState } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar from '../../components/admin/AdminTopbar';
import { analyzeRawText } from '../../api/ocr';
import '../../styles/admin.css';

export default function AiMasterPrompt() {
  const [collapsed, setCollapsed] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [docTypeHint, setDocTypeHint] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!ocrText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeRawText(ocrText, docTypeHint || null);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Check your input.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />
        
        <div className="admin-content">
          <div className="admin-header-row">
            <div>
              <h1 className="admin-title">🤖 AI Document Intelligence — Master Prompt Tool</h1>
              <p className="admin-subtitle">Process raw OCR text into structured SQL-ready JSON</p>
            </div>
          </div>

          <div className="admin-grid-two-cols">
            {/* Input Panel */}
            <div className="admin-card">
              <div className="admin-card-title">Input: Raw OCR Text</div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Select Document Type (Hint)</label>
                <select 
                  className="form-control" 
                  value={docTypeHint} 
                  onChange={(e) => setDocTypeHint(e.target.value)}
                >
                  <option value="">Auto-Detect Type</option>
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="bank">Bank Passbook</option>
                  <option value="satbara">7/12 Land Record (Satbara)</option>
                  <option value="income">Income Certificate</option>
                  <option value="elec">Electricity Bill</option>
                  <option value="caste">Caste Certificate</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Paste Noise/Raw OCR Text Here</label>
                <textarea 
                  className="form-control" 
                  style={{ minHeight: '400px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}
                  placeholder="Example: UIDAI Aadhaar 1234 5678 9012 DOB: 15/06/1990 MALE..."
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                />
              </div>

              <button 
                className="btn-primary" 
                style={{ width: '100%', height: '48px', fontSize: '16px' }}
                onClick={handleAnalyze}
                disabled={loading || !ocrText.trim()}
              >
                {loading ? '🧠 Processing Intelligence...' : '✨ Run AI Extraction (SQL Ready)'}
              </button>
              
              {error && <div className="alert-error" style={{ marginTop: 16 }}>{error}</div>}
            </div>

            {/* Results Panel */}
            <div className="admin-card">
              <div className="admin-card-title">Output: Structured SQL JSON</div>
              
              {!result ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>⬅️</div>
                  Paste OCR text and click Analyze to see structured data.
                </div>
              ) : (
                <div className="ai-result-view">
                  <div className="ai-result-meta">
                    <span className="badge badge-primary">{result.document_type}</span>
                    <span className="ai-confidence-tag" style={{ marginLeft: 8 }}>
                      Overall Confidence: {(result.confidence_score.overall * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="ai-section-title">Extracted Data</div>
                  <div className="ai-json-block">
                    <pre>{JSON.stringify(result.extracted_data, null, 2)}</pre>
                  </div>

                  <div className="ai-section-title">Confidence Breakdown</div>
                  <div className="ai-grid">
                    {Object.entries(result.confidence_score.fields).map(([field, score]) => (
                      <div key={field} className="ai-field-score">
                        <div className="doc-field-label">{field}</div>
                        <div className="ai-score-bar-bg">
                          <div 
                            className="ai-score-bar-fill" 
                            style={{ 
                              width: `${(score * 100)}%`, 
                              backgroundColor: score > 0.8 ? '#10b981' : score > 0.5 ? '#f59e0b' : '#ef4444' 
                            }} 
                          />
                        </div>
                        <div style={{ fontSize: 10, textAlign: 'right' }}>{(score * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>

                  <div className="ai-section-title">DB Ready Fields (SQL Mapping)</div>
                  <div className="ai-json-block" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                    <pre style={{ color: '#94a3b8' }}>{JSON.stringify(result.db_ready_fields, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .admin-grid-two-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .ai-json-block {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          overflow: auto;
          max-height: 300px;
        }
        .ai-json-block pre {
          margin: 0;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          color: #334155;
        }
        .ai-section-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 20px 0 8px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }
        .ai-score-bar-bg {
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          margin: 4px 0;
        }
        .ai-score-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .ai-field-score {
          margin-bottom: 12px;
        }
        .ai-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .alert-error {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
        }
      `}} />
    </div>
  );
}
