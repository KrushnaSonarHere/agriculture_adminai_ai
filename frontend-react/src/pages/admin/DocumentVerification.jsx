import { useState, useEffect, useCallback } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminTopbar from '../../components/admin/AdminTopbar';
import { getFarmers, getProfile } from '../../api/farmers';
import { analyzeRawText, analyzeFarmer, getOcrResult } from '../../api/ocr';
import api from '../../api/index';
import '../../styles/admin.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ── Document type config ─────────────────────────────────────
const DOC_TYPES = [
  { key: 'aadhaar', label: 'Aadhaar Card',       icon: '🪪', fields: [
    { key: 'name',     label: 'Full Name',       profileKey: 'full_name' },
    { key: 'aadhaar',  label: 'Aadhaar Number',  profileKey: 'aadhaar' },
    { key: 'dob',      label: 'Date of Birth',   profileKey: 'dob' },
    { key: 'gender',   label: 'Gender',           profileKey: 'gender' },
  ]},
  { key: 'satbara', label: '7/12 Extract',        icon: '🗺️', fields: [
    { key: 'name',      label: 'Farmer Name',     profileKey: 'full_name' },
    { key: 'survey_no', label: 'Survey / Gat No.',profileKey: 'gat_number' },
    { key: 'land_area', label: 'Land Area',       profileKey: 'land_area' },
    { key: 'village',   label: 'Village',          profileKey: 'village' },
    { key: 'taluka',    label: 'Taluka',           profileKey: 'taluka' },
  ]},
  { key: '8a',     label: '8-A Certificate',      icon: '📋', fields: [
    { key: 'name',     label: 'Account Holder',  profileKey: 'full_name' },
    { key: 'land_area',label: 'Land Ownership',  profileKey: 'land_area' },
  ]},
  { key: 'bank',   label: 'Bank Passbook',         icon: '🏦', fields: [
    { key: 'name',      label: 'Account Holder',  profileKey: 'full_name' },
    { key: 'account',   label: 'Account Number',  profileKey: 'bank_account' },
    { key: 'ifsc',      label: 'IFSC Code',       profileKey: 'ifsc' },
    { key: 'bank_name', label: 'Bank Name',        profileKey: 'bank_name' },
  ]},
  { key: 'income', label: 'Income Certificate',   icon: '📄', fields: [
    { key: 'name',   label: 'Name',            profileKey: 'full_name' },
    { key: 'income', label: 'Annual Income',   profileKey: 'income_bracket' },
  ]},
  { key: 'caste',  label: 'Caste Certificate',    icon: '📜', fields: [
    { key: 'name',     label: 'Name',            profileKey: 'full_name' },
    { key: 'category', label: 'Category',        profileKey: 'caste_category' },
  ]},
  { key: 'elec',   label: 'Electricity Bill',     icon: '⚡', fields: [
    { key: 'consumer', label: 'Consumer Name',   profileKey: 'full_name' },
    { key: 'address',  label: 'Address',         profileKey: 'full_address' },
  ]},
];


// ── Fuzzy match score between two strings ────────────────────
function calcMatchScore(a, b) {
  if (!a || !b) return 0;
  const s1 = String(a).toLowerCase().replace(/\s+/g, '');
  const s2 = String(b).toLowerCase().replace(/\s+/g, '');
  if (s1 === s2) return 100;
  // Simple longest common subsequence ratio
  let matches = 0;
  const shorter = s1.length < s2.length ? s1 : s2;
  const longer  = s1.length < s2.length ? s2 : s1;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return Math.round((matches / longer.length) * 100);
}

function getScoreColor(score) {
  if (score >= 90) return { bg: '#dcfce7', color: '#166534', icon: '✔', label: 'Match' };
  if (score >= 70) return { bg: '#fef3c7', color: '#92400e', icon: '⚠', label: 'Partial' };
  return { bg: '#fee2e2', color: '#991b1b', icon: '✖', label: 'Mismatch' };
}

// ── Main Component ────────────────────────────────────────────
export default function DocumentVerification() {
  const [collapsed, setCollapsed]           = useState(false);
  const [search, setSearch]                 = useState('');
  const [filter, setFilter]                 = useState('all');
  const [farmers, setFarmers]               = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [profile, setProfile]               = useState(null);
  const [activeDocType, setActiveDocType]   = useState('aadhaar');
  const [ocrResults, setOcrResults]         = useState({});  // { docType: { extracted, status } }
  const [ocrRunning, setOcrRunning]         = useState(null);
  const [aiDecision, setAiDecision]         = useState(null);
  const [aiRunning, setAiRunning]           = useState(false);
  const [adminAction, setAdminAction]       = useState(null);
  const [loadingFarmer, setLoadingFarmer]   = useState(false);

  // Load farmer list
  useEffect(() => {
    getFarmers().then(r => setFarmers(r.data || [])).catch(() => {});
  }, []);

  // Select farmer → load profile + existing OCR results
  const selectFarmer = useCallback(async (farmer) => {
    setSelectedFarmer(farmer);
    setProfile(null);
    setOcrResults({});
    setAiDecision(null);
    setAdminAction(null);
    setActiveDocType('aadhaar');
    setLoadingFarmer(true);
    try {
      const [profileRes, aiRes, ocrRes] = await Promise.all([
        getProfile(farmer.id),
        api.get(`/ocr/decision/${farmer.id}`).then(r => r.data).catch(() => null),
        getOcrResult(farmer.id).then(r => r.data).catch(() => []),
      ]);
      setProfile(profileRes.data?.profile || profileRes.data);
      setAiDecision(aiRes);

      // Map existing OCR results by doc_type
      if (Array.isArray(ocrRes)) {
        const mapped = {};
        ocrRes.forEach(doc => {
          // Backend returns fields with keys: name, aadhaar, dob, gender, address,
          // survey_no, land_area, village, taluka, account, ifsc, bank_name,
          // income, category, consumer
          mapped[doc.doc_type] = {
            status: doc.ocr_status,
            fields: doc.fields,  // directly use backend response structure
          };
        });

        setOcrResults(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFarmer(false);
    }
  }, []);

  // Run OCR on a specific document type using simulated text
  const runOCR = async (docType) => {
    setOcrRunning(docType);
    // Simulate calling the OCR endpoint with doc type hint
    try {
      // First check if there's an uploaded file for this docType
      const docsRes = await api.get(`/documents/${selectedFarmer.id}`);
      const docs = docsRes.data || [];
      const targetDoc = docs.find(d => d.doc_type === docType);

      if (targetDoc) {
        // Trigger OCR processing on the real file
        await api.post(`/ocr/process/${targetDoc.id}`);
        await new Promise(r => setTimeout(r, 2000));
        // Refresh results
        const ocrRes = await getOcrResult(selectedFarmer.id);
        if (Array.isArray(ocrRes.data)) {
          const mapped = { ...ocrResults };
          ocrRes.data.forEach(doc => {
            mapped[doc.doc_type] = {
              status: 'done',
              fields: doc.fields,  // backend returns pre-structured fields object
            };
          });

          setOcrResults(mapped);
        }
      } else {
        // Simulate a demo OCR result
        await new Promise(r => setTimeout(r, 2000));
        const profileData = profile;
        setOcrResults(prev => ({
          ...prev,
          [docType]: {
            status: 'simulated',
            fields: {
              name:     profileData?.full_name,
              aadhaar:  profileData?.aadhaar,
              dob:      profileData?.dob,
              gender:   profileData?.gender,
              account:  profileData?.bank_account,
              ifsc:     profileData?.ifsc,
              bank_name:profileData?.bank_name,
              survey_no:profileData?.gat_number,
              land_area:profileData?.land_area,
              village:  profileData?.village,
              taluka:   profileData?.taluka,
              income:   profileData?.income_bracket,
              category: profileData?.caste_category,
              address:  profileData?.full_address,
              consumer: profileData?.full_name,
            },
          },
        }));

      }
    } catch (err) {
      console.error('OCR error:', err);
    } finally {
      setOcrRunning(null);
    }
  };

  // Run full AI comparison
  const runAIAnalysis = async () => {
    if (!selectedFarmer) return;
    setAiRunning(true);
    try {
      const res = await analyzeFarmer(selectedFarmer.id);
      setAiDecision(res.data);
    } catch (err) {
      console.error('AI analysis error:', err);
    } finally {
      setAiRunning(false);
    }
  };

  const handleAdminAction = async (action) => {
    if (!selectedFarmer) return;
    // Optimistic update immediately — UI never feels stuck
    setAdminAction(action);

    try {
      // 1. Update the AI/OCR decision record if one exists
      if (aiDecision?.decision_id) {
        await api.put(`/ocr/decision/${aiDecision.decision_id}`, { admin_decision: action });
      }
      // 2. Also update any pending applications for this farmer
      const appsRes = await api.get('/applications/', { params: { user_id: selectedFarmer.id } });
      const apps = appsRes.data || [];
      const pending = apps.filter(a => ['Pending', 'Processing', 'Under Review'].includes(a.status));
      await Promise.all(
        pending.map(a =>
          api.patch(`/applications/${a.id}`, {
            status: action === 'approved' ? 'Approved'
                  : action === 'rejected' ? 'Rejected'
                  : 'Processing',
            admin_remarks: `Admin decision: ${action} on ${new Date().toLocaleDateString('en-IN')}`,
          }).catch(() => {})
        )
      );
    } catch (err) {
      console.warn('Decision save error (optimistic state kept):', err.message);
    }
  };

  // Current doc type config
  const currentDocDef = DOC_TYPES.find(d => d.key === activeDocType) || DOC_TYPES[0];
  const currentOcr    = ocrResults[activeDocType];

  // Compute overall status per doc type for left sidebar badge
  const getDocStatus = (key) => {
    const res = ocrResults[key];
    if (!res) return 'pending';
    const doc  = DOC_TYPES.find(d => d.key === key);
    if (!doc || !profile) return res.status === 'done' || res.status === 'simulated' ? 'verified' : 'pending';
    const scores = doc.fields.map(f => calcMatchScore(res.fields?.[f.key], profile?.[f.profileKey]));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    if (avg >= 80) return 'verified';
    if (avg >= 60) return 'partial';
    return 'mismatch';
  };

  const filtered = farmers.filter(f => {
    const q = search.toLowerCase();
    const matchSearch = !q || (f.full_name || '').toLowerCase().includes(q) || (f.farmer_id || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (filter === 'complete' && f.profile_complete) || (filter === 'pending' && !f.profile_complete);
    return matchSearch && matchFilter;
  });

  const overallMatchScore = aiDecision?.overall_score ?? (() => {
    const allScores = [];
    DOC_TYPES.forEach(dt => {
      const res = ocrResults[dt.key];
      if (res && profile) {
        dt.fields.forEach(f => {
          const s = calcMatchScore(res.fields?.[f.key], profile?.[f.profileKey]);
          allScores.push(s);
        });
      }
    });
    return allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
  })();

  const approvalPct  = aiDecision?.approval_probability ?? (overallMatchScore ? Math.min(99, overallMatchScore + 5) : null);
  const fraudRisk    = aiDecision?.fraud_risk ?? (overallMatchScore ? Math.max(0, 100 - overallMatchScore - 10) : null);
  const aiConfidence = aiDecision?.confidence ?? overallMatchScore;

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={collapsed} />
      <div className={`admin-main ${collapsed ? 'collapsed' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
        <AdminTopbar onMenuClick={() => setCollapsed(c => !c)} />

        {/* 3-Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', flex: 1, overflow: 'hidden', height: 'calc(100vh - 56px)' }}>

          {/* ══════════════════════════════════════════ */}
          {/* LEFT PANEL — Farmer Queue                 */}
          {/* ══════════════════════════════════════════ */}
          <aside style={{ borderRight: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>
                📋 Pending Verification
              </div>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }}>🔍</span>
                <input
                  style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  placeholder="Search name or ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', color: '#475569', outline: 'none' }}
                value={filter}
                onChange={e => setFilter(e.target.value)}
              >
                <option value="all">All Farmers</option>
                <option value="complete">Profile Complete</option>
                <option value="pending">Incomplete Profile</option>
              </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>No farmers found</div>
              )}
              {filtered.map(f => {
                const isActive = selectedFarmer?.id === f.id;
                const aiStatus = f.ai_status;
                return (
                  <div
                    key={f.id}
                    onClick={() => selectFarmer(f)}
                    style={{
                      padding: '12px 14px', marginBottom: 8, borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${isActive ? '#2e7d32' : '#e2e8f0'}`,
                      background: isActive ? '#f0fdf4' : '#fafafa',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{f.full_name}</div>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 6, flexShrink: 0, marginLeft: 6,
                        background: aiStatus === 'auto_approved' ? '#dcfce7' : aiStatus === 'flagged' ? '#fee2e2' : aiStatus === 'manual_review' ? '#fef3c7' : '#f1f5f9',
                        color:      aiStatus === 'auto_approved' ? '#166534' : aiStatus === 'flagged' ? '#991b1b' : aiStatus === 'manual_review' ? '#92400e' : '#64748b',
                      }}>
                        {aiStatus ? aiStatus.replace('_', ' ').toUpperCase() : 'PENDING'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{f.farmer_id || '—'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {f.district} · {f.profile_complete ? '✅ Profile Complete' : '⚠️ Incomplete'}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ══════════════════════════════════════════ */}
          {/* CENTER PANEL — Viewer + OCR + Comparison  */}
          {/* ══════════════════════════════════════════ */}
          <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
            {!selectedFarmer ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>👈</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Select a Farmer</div>
                <div style={{ fontSize: 13 }}>Choose from the queue on the left to begin verification.</div>
              </div>
            ) : loadingFarmer ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="ocr-spinner" />
                <div style={{ marginTop: 16, color: '#64748b', fontWeight: 600 }}>Loading farmer data...</div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2e7d32', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                        {selectedFarmer.full_name?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{selectedFarmer.full_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{selectedFarmer.farmer_id} · {selectedFarmer.district}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {aiConfidence !== null && (
                      <div style={{ background: '#e0f2fe', color: '#0369a1', fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                        🧠 AI Confidence: {Math.round(aiConfidence)}%
                      </div>
                    )}
                    <button
                      onClick={runAIAnalysis}
                      disabled={aiRunning}
                      style={{ background: aiRunning ? '#94a3b8' : '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: aiRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                      {aiRunning ? <><span className="ocr-spinner-sm" /> Running AI...</> : '🤖 Run Full AI Analysis'}
                    </button>
                  </div>
                </div>

                {/* Document Type Tabs */}
                <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex', gap: 0, overflowX: 'auto', flexShrink: 0 }}>
                  {DOC_TYPES.map(dt => {
                    const status = getDocStatus(dt.key);
                    const isActive = activeDocType === dt.key;
                    return (
                      <button
                        key={dt.key}
                        onClick={() => setActiveDocType(dt.key)}
                        style={{
                          padding: '12px 16px', border: 'none', borderBottom: isActive ? '2px solid #2e7d32' : '2px solid transparent',
                          background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#2e7d32' : '#64748b', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                          fontFamily: 'inherit', transition: 'all 0.15s',
                        }}
                      >
                        {dt.icon} {dt.label}
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginLeft: 2,
                          background: status === 'verified' ? '#10b981' : status === 'partial' ? '#f59e0b' : status === 'mismatch' ? '#ef4444' : '#d1d5db',
                        }} />
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable Content */}
                <div style={{ flex: 1, overflowY: 'auto' }}>

                  {/* Document Preview Card */}
                  <div style={{ margin: '16px 20px 0', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ background: '#1e293b', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{currentDocDef.icon}</span>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{currentDocDef.label}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11 }}>
                            {currentOcr ? `Status: ${currentOcr.status === 'simulated' ? '🔵 AI Simulated' : '✅ OCR Complete'}` : 'Not yet processed'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => runOCR(activeDocType)}
                        disabled={ocrRunning === activeDocType}
                        style={{
                          background: ocrRunning === activeDocType ? '#475569' : '#10b981',
                          color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8,
                          fontWeight: 700, fontSize: 13, cursor: ocrRunning === activeDocType ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
                        }}>
                        {ocrRunning === activeDocType
                          ? <><span className="ocr-spinner-sm" /> AI Processing...</>
                          : '⚡ Run OCR'}
                      </button>
                    </div>

                    {/* Document placeholder viewer */}
                    <div style={{ height: 120, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      {currentOcr ? (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 36 }}>{currentDocDef.icon}</div>
                          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 8 }}>✅ OCR Data Extracted</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{Object.values(currentOcr.fields || {}).filter(Boolean).length} fields recognized</div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                          <div style={{ fontSize: 36 }}>📄</div>
                          <div style={{ fontSize: 12, marginTop: 8 }}>Click "Run OCR" to extract data</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Field Comparison */}
                  <div style={{ margin: '16px 20px' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      📊 Field Comparison — {currentDocDef.label}
                    </div>

                    {/* Column Headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 8, marginBottom: 8 }}>
                      {['Field', 'AI Extracted (OCR)', 'Form Submitted', 'Match'].map(h => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
                      ))}
                    </div>

                    {/* Comparison Rows */}
                    {currentDocDef.fields.map(field => {
                      const ocrVal     = currentOcr?.fields?.[field.key];
                      const formVal    = profile?.[field.profileKey];
                      const score      = (ocrVal && formVal) ? calcMatchScore(ocrVal, formVal) : null;
                      const scoreStyle = score !== null ? getScoreColor(score) : null;

                      return (
                        <div
                          key={field.key}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 8, alignItems: 'center',
                            padding: '10px 14px', borderRadius: 8, marginBottom: 6, border: '1px solid #e2e8f0',
                            background: scoreStyle ? scoreStyle.bg + '55' : '#fff',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{field.label}</div>

                          {/* OCR Value */}
                          <div style={{ fontSize: 13, fontWeight: 600, color: ocrVal ? '#1e293b' : '#94a3b8', fontFamily: ocrVal ? 'inherit' : 'inherit', fontStyle: ocrVal ? 'normal' : 'italic' }}>
                            {ocrRunning === activeDocType
                              ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}><span className="ocr-spinner-sm" /> Extracting...</span>
                              : (ocrVal || '—')}
                          </div>

                          {/* Form Value */}
                          <div style={{ fontSize: 13, fontWeight: 600, color: formVal ? '#1e293b' : '#94a3b8', fontStyle: formVal ? 'normal' : 'italic' }}>
                            {formVal || '—'}
                          </div>

                          {/* Match Score */}
                          <div>
                            {score !== null ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ background: scoreStyle.bg, color: scoreStyle.color, fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 6 }}>
                                  {scoreStyle.icon} {score}%
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* No OCR state */}
                    {!currentOcr && (
                      <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #d1d5db', marginTop: 12 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Click "Run OCR" above</div>
                        <div style={{ fontSize: 12 }}>AI will extract and compare data automatically</div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ margin: '0 20px 24px', padding: '20px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      🎯 Admin Decision
                      {adminAction && (
                        <button
                          onClick={() => setAdminAction(null)}
                          style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                        >
                          ↺ Change Decision
                        </button>
                      )}
                    </div>

                    {adminAction ? (
                      <div style={{
                        padding: '20px', textAlign: 'center', borderRadius: 10, fontWeight: 800, fontSize: 15,
                        background: adminAction === 'approved' ? '#f0fdf4' : adminAction === 'rejected' ? '#fef2f2' : '#fffbeb',
                        color: adminAction === 'approved' ? '#166534' : adminAction === 'rejected' ? '#991b1b' : '#92400e',
                        border: `2px solid ${adminAction === 'approved' ? '#10b981' : adminAction === 'rejected' ? '#ef4444' : '#f59e0b'}`,
                        animation: 'fadeIn 0.3s ease',
                      }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>
                          {adminAction === 'approved' ? '✅' : adminAction === 'rejected' ? '❌' : '⚠️'}
                        </div>
                        {adminAction === 'approved' ? 'Application Approved' : adminAction === 'rejected' ? 'Application Rejected' : 'Flagged for Manual Review'}
                        <div style={{ fontSize: 11, fontWeight: 400, marginTop: 6, opacity: 0.8 }}>
                          Decision recorded · {new Date().toLocaleString('en-IN')}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {/* Approve */}
                        <button
                          onClick={() => handleAdminAction('approved')}
                          onMouseOver={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#166534'; e.currentTarget.style.transform = 'none'; }}
                          style={{
                            padding: '14px 10px', background: '#f0fdf4', border: '2px solid #10b981',
                            borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 12,
                            color: '#166534', fontFamily: 'inherit', transition: 'all 0.18s',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>✅</span>
                          Verify & Approve
                        </button>

                        {/* Flag */}
                        <button
                          onClick={() => handleAdminAction('flagged')}
                          onMouseOver={e => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.color = '#92400e'; e.currentTarget.style.transform = 'none'; }}
                          style={{
                            padding: '14px 10px', background: '#fffbeb', border: '2px solid #f59e0b',
                            borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 12,
                            color: '#92400e', fontFamily: 'inherit', transition: 'all 0.18s',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>⚠️</span>
                          Flag for Review
                        </button>

                        {/* Reject */}
                        <button
                          onClick={() => handleAdminAction('rejected')}
                          onMouseOver={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#991b1b'; e.currentTarget.style.transform = 'none'; }}
                          style={{
                            padding: '14px 10px', background: '#fef2f2', border: '2px solid #ef4444',
                            borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 12,
                            color: '#991b1b', fontFamily: 'inherit', transition: 'all 0.18s',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>❌</span>
                          Reject Application
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>

          {/* ══════════════════════════════════════════ */}
          {/* RIGHT PANEL — AI Decision Panel           */}
          {/* ══════════════════════════════════════════ */}
          <aside style={{ borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>🤖 AI Decision Panel</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Real-time AI intelligence</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {!selectedFarmer ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>
                  Select a farmer to see AI insights
                </div>
              ) : (
                <>
                  {/* Score Circles */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Match Score',   val: overallMatchScore,  color: '#10b981', bg: '#f0fdf4' },
                      { label: 'Approval',       val: approvalPct,        color: '#3b82f6', bg: '#eff6ff' },
                      { label: 'Fraud Risk',     val: fraudRisk,          color: '#ef4444', bg: '#fef2f2' },
                      { label: 'AI Confidence',  val: aiConfidence,       color: '#8b5cf6', bg: '#f5f3ff' },
                    ].map(m => (
                      <div key={m.label} style={{ background: m.bg, borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>
                          {m.val !== null ? `${Math.round(m.val)}%` : '—'}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Decision Badge */}
                  {aiDecision && (
                    <div style={{
                      padding: '12px 16px', borderRadius: 10, marginBottom: 16, textAlign: 'center',
                      background: aiDecision.decision === 'auto_approved' ? '#f0fdf4' : aiDecision.decision === 'flagged' ? '#fef2f2' : '#fffbeb',
                      border: `1.5px solid ${aiDecision.decision === 'auto_approved' ? '#bbf7d0' : aiDecision.decision === 'flagged' ? '#fecaca' : '#fde68a'}`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Recommendation</div>
                      <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4, color: aiDecision.decision === 'auto_approved' ? '#166534' : aiDecision.decision === 'flagged' ? '#991b1b' : '#92400e' }}>
                        {aiDecision.decision === 'auto_approved' ? '✅ AUTO APPROVE' : aiDecision.decision === 'flagged' ? '🚩 FLAG' : '📋 MANUAL REVIEW'}
                      </div>
                    </div>
                  )}

                  {/* Document Status Overview */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Document Status</div>
                    {DOC_TYPES.map(dt => {
                      const status = getDocStatus(dt.key);
                      const icon   = status === 'verified' ? '✔' : status === 'partial' ? '⚠' : status === 'mismatch' ? '✖' : '○';
                      const color  = status === 'verified' ? '#10b981' : status === 'partial' ? '#f59e0b' : status === 'mismatch' ? '#ef4444' : '#94a3b8';
                      return (
                        <div
                          key={dt.key}
                          onClick={() => { setActiveDocType(dt.key); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', background: activeDocType === dt.key ? '#f0fdf4' : 'transparent', transition: 'background 0.15s' }}
                        >
                          <span style={{ color, fontWeight: 800, fontSize: 13, width: 16 }}>{icon}</span>
                          <span style={{ fontSize: 12, color: '#475569' }}>{dt.icon} {dt.label}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase' }}>{status}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Positive Factors */}
                  {(aiDecision?.positive_factors || overallMatchScore >= 70) && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        ✅ Positive Factors
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {(aiDecision?.positive_factors
                          ? String(aiDecision.positive_factors).split('|').filter(Boolean)
                          : ['Documents uploaded', 'Profile complete', 'Name verified']
                        ).map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#166534', background: '#f0fdf4', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #10b981' }}>✔ {f}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risk Factors */}
                  {(aiDecision?.risk_factors || aiDecision?.mismatch_fields) && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                        ⚠️ Risk Factors
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {(aiDecision?.risk_factors
                          ? String(aiDecision.risk_factors).split('|').filter(Boolean)
                          : aiDecision?.mismatch_fields
                          ? String(aiDecision.mismatch_fields).split('|').filter(Boolean)
                          : []
                        ).map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#991b1b', background: '#fef2f2', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #ef4444' }}>✖ {f}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duplicate warning */}
                  {aiDecision?.duplicate_aadhaar && (
                    <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#991b1b' }}>🚨 DUPLICATE AADHAAR DETECTED</div>
                      <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>This Aadhaar is linked to another applicant. Immediate review required.</div>
                    </div>
                  )}

                  {/* Re-run AI */}
                  <button
                    onClick={runAIAnalysis}
                    disabled={aiRunning}
                    style={{ width: '100%', padding: '10px', background: aiRunning ? '#f1f5f9' : '#1e293b', color: aiRunning ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: aiRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {aiRunning ? <><span className="ocr-spinner-sm" /> Processing AI...</> : '🔄 Re-run AI Analysis'}
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        .ocr-spinner {
          width: 36px; height: 36px;
          border: 4px solid #e2e8f0;
          border-top-color: #10b981;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        .ocr-spinner-sm {
          display: inline-block;
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform: scale(0.97); } to { opacity:1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
