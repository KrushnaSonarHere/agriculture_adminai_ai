import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../api/farmers';
import { getDocuments } from '../api/documents';
import Sidebar from '../components/farmer/Sidebar';
import Topbar  from '../components/farmer/Topbar';
import '../styles/farmer.css';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const DOC_ICONS = {
  aadhaar: '🪪', satbara: '🗺️', '8a': '📋', bank: '🏦',
  photo: '📷', caste: '📜', income: '📄', elec: '⚡', other: '📎',
};

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: value ? 'var(--text)' : 'var(--text3)', fontStyle: value ? 'normal' : 'italic' }}>
          {value || 'Not provided'}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData]     = useState(null);
  const [docs, setDocs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      getProfile(user.id),
      getDocuments(user.id),
    ])
      .then(([profileRes, docsRes]) => {
        setData(profileRes.data);
        setDocs(docsRes.data || []);
      })
      .catch(e => setError(e.response?.data?.detail || 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const p = data?.profile;

  /* ── helpers ── */
  const maskAadhaar = (a) => a ? `XXXX XXXX ${a.slice(-4)}` : null;
  const maskAccount = (a) => a ? `••••••••${a.slice(-4)}` : null;
  const address     = p ? [p.village, p.taluka, data?.district, p.pincode].filter(Boolean).join(', ') : null;

  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="My Profile" onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="page-content">

          {/* ── Incomplete Banner ── */}
          {!loading && data && !data.profile_complete && (
            <div style={{
              background: '#FFF3E0', border: '1px solid rgba(239,108,0,0.4)',
              borderRadius: 12, padding: '14px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#E65100', fontSize: 14 }}>Profile Incomplete</div>
                <div style={{ fontSize: 12, color: '#BF360C' }}>
                  Complete your registration to apply for schemes.{' '}
                  <Link to="/register?complete=1" style={{ color: '#E65100', fontWeight: 600 }}>Complete Now →</Link>
                </div>
              </div>
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <div>Loading your profile…</div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid rgba(211,47,47,0.3)', borderRadius: 12, padding: 16, color: '#D32F2F', fontSize: 14 }}>
              {error} — <Link to="/login" style={{ color: '#2e7d32' }}>Login again</Link>
            </div>
          )}

          {/* ── Profile Content ── */}
          {!loading && data && (
            <>
              {/* ── Hero card ── */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg,#2e7d32,#66bb6a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>
                    👨‍🌾
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {data.full_name}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {data.farmer_id || '—'}
                    </div>
                    <span style={{
                      display: 'inline-flex', marginTop: 8, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: data.profile_complete ? '#e8f5e9' : '#FFF3E0',
                      color:      data.profile_complete ? '#2e7d32'  : '#E65100',
                      border: `1px solid ${data.profile_complete ? '#a5d6a7' : 'rgba(239,108,0,0.3)'}`,
                    }}>
                      {data.profile_complete ? '✔ Verified Farmer' : '⚠ Profile Incomplete'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text3)' }}>
                    <div>Member since</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {data.created_at ? new Date(data.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                  <InfoRow icon="📞" label="Mobile"   value={data.mobile ? '+91 ' + data.mobile : null} />
                  <InfoRow icon="📧" label="Email"    value={data.email} />
                  <InfoRow icon="📍" label="District" value={data.district} />
                  <InfoRow icon="🏠" label="State"    value={data.state} />
                </div>
              </div>

              {/* ── 2-col grid ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Left col */}
                <div>
                  <SectionCard title="👤 Personal Details">
                    <InfoRow icon="👨‍👧" label="Father / Husband Name" value={p?.father_name} />
                    <InfoRow icon="🎂" label="Date of Birth"         value={p?.dob} />
                    <InfoRow icon="⚥"  label="Gender"                value={p?.gender} />
                  </SectionCard>

                  <SectionCard title="🪪 Identity Details">
                    <InfoRow icon="🔵" label="Aadhaar Number" value={maskAadhaar(p?.aadhaar)} />
                    <InfoRow icon="💳" label="PAN Card"        value={p?.pan} />
                    <InfoRow icon="🗳️" label="Voter ID"        value={p?.voter_id} />
                  </SectionCard>

                  <SectionCard title="🏦 Bank Details (DBT)">
                    <InfoRow icon="💰" label="Account Number" value={maskAccount(p?.bank_account)} />
                    <InfoRow icon="🏛️" label="IFSC Code"       value={p?.ifsc} />
                    <InfoRow icon="🏦" label="Bank Name"       value={p?.bank_name} />
                    <InfoRow icon="🏢" label="Branch"          value={p?.branch_name} />
                    <InfoRow icon="📋" label="Account Type"    value={p?.account_type} />
                  </SectionCard>
                </div>

                {/* Right col */}
                <div>
                  <SectionCard title="🌍 Address Details">
                    <InfoRow icon="🏠" label="Full Address"    value={address} />
                    <InfoRow icon="🏘️" label="Village"         value={p?.village} />
                    <InfoRow icon="📍" label="Taluka"          value={p?.taluka} />
                    <InfoRow icon="📮" label="Pin Code"        value={p?.pincode} />
                  </SectionCard>

                  <SectionCard title="🗺️ Land Details">
                    <InfoRow icon="📐" label="Land Area"         value={p?.land_area} />
                    <InfoRow icon="🔢" label="Survey / Gat No."  value={p?.gat_number} />
                    <InfoRow icon="📄" label="7/12 Satbara No."  value={p?.satbara} />
                    <InfoRow icon="📋" label="8-A Cert. No."     value={p?.eight_a} />
                    <InfoRow icon="📜" label="Ownership Type"    value={p?.ownership_type} />
                  </SectionCard>

                  <SectionCard title="🌱 Farming & Category">
                    <InfoRow icon="🌾" label="Primary Crop"      value={p?.crop_type} />
                    <InfoRow icon="💧" label="Irrigation Type"   value={p?.irrigation_type} />
                    <InfoRow icon="🌿" label="Farming Method"    value={p?.farming_type} />
                    <InfoRow icon="👥" label="Caste Category"    value={p?.caste_category?.toUpperCase()} />
                    <InfoRow icon="₹"  label="Income Bracket"    value={p?.income_bracket} />
                    <InfoRow icon="🏷️" label="BPL Status"        value={p?.bpl_status === 'yes' ? 'BPL Card Holder' : 'Not BPL'} />
                    <InfoRow icon="⚡" label="Electricity Conn." value={p?.electricity} />
                    <InfoRow icon="🔖" label="AgriStack ID"      value={p?.agristack_id} />
                  </SectionCard>
                </div>
              </div>

              {/* ── Documents Section ── */}
              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>📎 Uploaded Documents</div>
                  <span style={{ background: docs.length > 0 ? '#e8f5e9' : '#f3f4f6', color: docs.length > 0 ? '#2e7d32' : '#6b7280', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                    {docs.length} file{docs.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {docs.length === 0 ? (
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                    No documents uploaded yet.
                    <Link to="/register?complete=1" style={{ display: 'block', marginTop: 8, color: 'var(--green)', fontWeight: 600 }}>
                      Upload Documents →
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12 }}>
                    {docs.map(doc => (
                      <div key={doc.id} style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, textAlign: 'center', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{DOC_ICONS[doc.doc_type] || '📎'}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', marginBottom: 4 }}>
                          {doc.doc_type}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, wordBreak: 'break-all' }}>
                          {doc.filename?.substring(0, 24)}{doc.filename?.length > 24 ? '…' : ''}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
                          {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                        </div>
                        <a href={`${API}${doc.url}`} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-block', background: 'var(--green)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 8, textDecoration: 'none' }}>
                          View →
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
