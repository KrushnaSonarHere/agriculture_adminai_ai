/**
 * Documents.jsx — Smart Document Vault
 * ──────────────────────────────────────────────────────────────
 * Centralised farmer document repository.
 * - Shows all 8 standard doc types as cards
 * - Each card shows: status, OCR verification badge, upload date,
 *   expiry warning, and inline drag-drop upload
 * - No duplicate uploads — one-per-type policy enforced
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/farmer/Sidebar';
import Topbar  from '../components/farmer/Topbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/index';
import '../styles/farmer.css';

const API = 'http://127.0.0.1:8000';

const DOC_CATALOG = [
  { type: 'aadhaar',     label: 'Aadhaar Card',         icon: '🪪', desc: 'Government issued 12-digit identity',   category: 'Identity',   expires: null   },
  { type: 'photo',       label: 'Passport Photo',        icon: '📷', desc: 'Recent colour passport size photo',    category: 'Identity',   expires: 60     },
  { type: 'satbara',     label: '7/12 Land Record',      icon: '🌾', desc: 'Satbara Utara — land ownership proof', category: 'Land',       expires: 12     },
  { type: 'eight_a',     label: '8-A Certificate',       icon: '📜', desc: 'Soil and crop holding record',         category: 'Land',       expires: 12     },
  { type: 'bank',        label: 'Bank Passbook',         icon: '🏦', desc: 'First page with account details',      category: 'Financial',  expires: null   },
  { type: 'income',      label: 'Income Certificate',    icon: '💰', desc: 'Annual income proof from Tehsildar',   category: 'Financial',  expires: 12     },
  { type: 'caste',       label: 'Caste Certificate',     icon: '📋', desc: 'SC/ST/OBC caste certificate',         category: 'Social',     expires: null   },
  { type: 'electricity', label: 'Electricity Bill',      icon: '⚡', desc: 'Latest electricity bill (3 months)',   category: 'Address',    expires: 3      },
];

const CATEGORY_COLORS = {
  Identity:  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  Land:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  Financial: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  Social:    { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  Address:   { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
};

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isExpired(uploadedAt, expiresMonths) {
  if (!uploadedAt || !expiresMonths) return false;
  const expiry = new Date(uploadedAt);
  expiry.setMonth(expiry.getMonth() + expiresMonths);
  return new Date() > expiry;
}

function expiryLabel(uploadedAt, expiresMonths) {
  if (!uploadedAt || !expiresMonths) return null;
  const expiry = new Date(uploadedAt);
  expiry.setMonth(expiry.getMonth() + expiresMonths);
  const diffDays = Math.round((expiry - new Date()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)  return { text: `Expired ${Math.abs(diffDays)}d ago`, color: '#ef4444' };
  if (diffDays < 30) return { text: `Expires in ${diffDays}d`, color: '#f59e0b' };
  return { text: `Valid until ${expiry.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`, color: '#22c55e' };
}

// ── Single document card ──────────────────────────────────────
function DocCard({ catalog, uploaded, onUpload, onDelete, uploading }) {
  const { type, label, icon, desc, category, expires } = catalog;
  const c      = CATEGORY_COLORS[category] || CATEGORY_COLORS.Identity;
  const drag   = useRef(false);
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  const expired   = uploaded ? isExpired(uploaded.uploaded_at, expires) : false;
  const expiryInfo = uploaded ? expiryLabel(uploaded.uploaded_at, expires) : null;
  const isUploading = uploading === type;

  const handleFile = (file) => {
    if (!file) return;
    onUpload(type, file);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [type]);

  return (
    <div style={{
      background: 'white', borderRadius: 14,
      border: `2px solid ${uploaded ? (expired ? '#fca5a5' : '#86efac') : '#e2e8f0'}`,
      overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: dragging ? '0 0 0 3px #bfdbfe' : '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Card header */}
      <div style={{ padding: '14px 16px', background: c.bg, borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{desc}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: c.border, color: c.text }}>
          {category}
        </span>
      </div>

      {/* Status body */}
      <div style={{ padding: '14px 16px' }}>
        {uploaded ? (
          <>
            {/* Available / Expired badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{
                fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 99,
                background: expired ? '#fee2e2' : '#dcfce7',
                color: expired ? '#b91c1c' : '#15803d',
              }}>
                {expired ? '🔄 Expired' : '✅ Available'}
              </span>
              {uploaded.ocr_verified && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: '#dbeafe', color: '#1d4ed8' }}>
                  🤖 AI Verified
                </span>
              )}
            </div>

            {/* File meta */}
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 6, display: 'flex', gap: 12 }}>
              <span>📄 {uploaded.filename?.slice(0, 24)}{uploaded.filename?.length > 24 ? '…' : ''}</span>
              <span>{formatSize(uploaded.file_size)}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
              Uploaded {new Date(uploaded.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>

            {/* Expiry info */}
            {expiryInfo && (
              <div style={{ fontSize: 11, fontWeight: 600, color: expiryInfo.color, marginBottom: 12 }}>
                ⏱ {expiryInfo.text}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`${API}${uploaded.url}`} target="_blank" rel="noreferrer"
                style={{ flex: 1, padding: '7px 0', textAlign: 'center', borderRadius: 8, background: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                👁 Preview
              </a>
              <button onClick={() => fileRef.current?.click()} disabled={isUploading}
                style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {isUploading ? '⏳' : '🔄 Replace'}
              </button>
              <button onClick={() => onDelete(uploaded.id)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12, cursor: 'pointer' }}>
                🗑
              </button>
            </div>
          </>
        ) : (
          /* Drop zone for missing docs */
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#60a5fa' : '#cbd5e1'}`,
              borderRadius: 10, padding: '20px 12px', textAlign: 'center',
              cursor: 'pointer', background: dragging ? '#eff6ff' : '#f8fafc',
              transition: 'all 0.2s',
            }}
          >
            {isUploading ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Uploading…</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{dragging ? '⬇️' : '📤'}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                  {dragging ? 'Drop to upload' : 'Click or drag to upload'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>JPG, PNG, PDF · Max 10 MB</div>
              </>
            )}
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*,application/pdf"
        style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Documents() {
  const { user }                       = useAuth();
  const [sidebarOpen, setSidebarOpen]  = useState(false);
  const [docs, setDocs]                = useState({});  // { doc_type: docObj }
  const [loading, setLoading]          = useState(true);
  const [uploading, setUploading]      = useState(null); // doc_type being uploaded
  const [toast, setToast]              = useState('');
  const [filter, setFilter]            = useState('All');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchDocs = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    api.get(`/documents/${user.id}`)
      .then(r => {
        const map = {};
        (r.data || []).forEach(d => { map[d.doc_type] = d; });
        setDocs(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async (docType, file) => {
    if (!user?.id) return;
    setUploading(docType);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      await fetch(`${API}/documents/upload/${user.id}`, { method: 'POST', body: fd });
      showToast(`✅ ${DOC_CATALOG.find(d => d.type === docType)?.label || docType} uploaded — AI scanning started`);
      fetchDocs();
    } catch {
      showToast('❌ Upload failed. Please try again.');
    }
    setUploading(null);
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document from your vault?')) return;
    try {
      await api.delete(`/documents/${docId}`);
      showToast('🗑 Document removed');
      fetchDocs();
    } catch {
      showToast('❌ Delete failed');
    }
  };

  // Stats
  const uploaded = Object.keys(docs).length;
  const total    = DOC_CATALOG.length;
  const verified = Object.values(docs).filter(d => d.ocr_verified).length;
  const expired  = DOC_CATALOG.filter(c => docs[c.type] && isExpired(docs[c.type]?.uploaded_at, c.expires)).length;

  // Filter display
  const categories = ['All', ...new Set(DOC_CATALOG.map(d => d.category))];
  const filtered = DOC_CATALOG.filter(c => filter === 'All' || c.category === filter);

  return (
    <div className="shell">
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className="main">
        <Topbar title="Document Vault" onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="page-content">

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div className="section-title">🗄️ Smart Document Vault</div>
            <div className="section-sub">
              Upload once — reused automatically across all scheme applications
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Documents Uploaded', val: `${uploaded}/${total}`, color: '#0ea5e9', bg: '#f0f9ff' },
              { label: 'AI Verified',         val: verified,              color: '#22c55e', bg: '#f0fdf4' },
              { label: 'Expired / Expiring',  val: expired,               color: '#f59e0b', bg: '#fffbeb' },
              { label: 'Profile Strength',    val: `${Math.round((uploaded / total) * 100)}%`, color: '#8b5cf6', bg: '#faf5ff' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${s.color}22` }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 2 }}>{s.label}</div>
                {s.label === 'Profile Strength' && (
                  <div style={{ marginTop: 6, height: 4, background: '#e9d5ff', borderRadius: 99 }}>
                    <div style={{ height: '100%', borderRadius: 99, background: '#8b5cf6', width: s.val, transition: 'width 1s' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* AI hint banner */}
          {uploaded > 0 && (
            <div style={{
              marginBottom: 20, padding: '12px 18px', borderRadius: 12,
              background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
              border: '1.5px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>Smart Auto-Fill Active</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  When you apply for a scheme, your {uploaded} uploaded documents will be automatically attached.
                  Only missing documents will be requested.
                </div>
              </div>
            </div>
          )}

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                style={{
                  padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                  border: filter === cat ? 'none' : '1.5px solid #e2e8f0',
                  background: filter === cat ? '#0f172a' : 'white',
                  color: filter === cat ? 'white' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Document grid */}
          {loading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" />
              <p style={{ marginTop: 12, color: 'var(--text3)' }}>Loading your document vault…</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filtered.map(catalog => (
                <DocCard
                  key={catalog.type}
                  catalog={catalog}
                  uploaded={docs[catalog.type] || null}
                  onUpload={handleUpload}
                  onDelete={handleDelete}
                  uploading={uploading}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '12px 20px', borderRadius: 12, background: '#0f172a',
          color: 'white', fontSize: 13, fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', animation: 'slideUp 0.3s ease',
        }}>
          {toast}
        </div>
      )}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
