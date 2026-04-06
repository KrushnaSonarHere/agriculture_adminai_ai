/**
 * Admin Panel — Shared Components
 * Sidebar, Topbar, Auth Guard
 *
 * NOTE: Each page declares its own  const API = 'http://127.0.0.1:8000'
 * do NOT redeclare it here (would cause SyntaxError & break all JS).
 */

// Detect if we're inside admin/pages/ or at admin/ root
const _inPages = window.location.pathname.includes('/pages/');
const _base    = _inPages ? '..' : '.';

// ─── AUTH GUARD ───────────────────────────────────────────────
// IMPORTANT: Admin panel is served from the same origin (port 8000)
// as the farmer portal, so they share sessionStorage. A farmer may
// be logged in with role='farmer'. We always override with admin
// session when visiting admin pages (dev-friendly behaviour).
function adminCheckAuth() {
  const role = sessionStorage.getItem('role');
  if (role === 'admin') return; // Already an admin — good

  // Force-inject admin demo session (overrides any farmer session)
  sessionStorage.setItem('user_id',          'demo-admin');
  sessionStorage.setItem('role',             'admin');
  sessionStorage.setItem('full_name',        'Officer Sharma');
  sessionStorage.setItem('email',            'admin@agriportal.gov.in');
  sessionStorage.setItem('mobile',           '9000000001');
  sessionStorage.setItem('district',         'Nashik');
  sessionStorage.setItem('profile_complete', 'true');
}

function adminLogout() {
  sessionStorage.clear();
  window.location.href = 'http://127.0.0.1:8000/frontend/pages/login.html';
}

function adminGetName() {
  return sessionStorage.getItem('full_name') || 'Officer';
}

// ─── SIDEBAR ──────────────────────────────────────────────────
function renderAdminSidebar(active) {
  const navItems = [
    { id: 'dashboard',    icon: '⊞',  label: 'Dashboard',             href: `${_base}/index.html` },
    { id: 'applications', icon: '☰',  label: 'Applications',          href: `${_base}/pages/applications.html` },
    { id: 'doc-verify',   icon: '□',  label: 'Document Verification', href: `${_base}/pages/document-verification.html` },
    { id: 'ai-decisions', icon: '◈',  label: 'AI Decisions',          href: `${_base}/pages/ai-decisions.html` },
    { id: 'farmers',      icon: '👥', label: 'Farmers',               href: `${_base}/pages/farmers.html` },
    { id: 'grievances',   icon: '☏',  label: 'Grievances',            href: `${_base}/pages/grievances.html` },
    { id: 'escalated',    icon: '↑',  label: 'Escalated Cases',       href: `${_base}/pages/escalated.html` },
    { id: 'reports',      icon: '↗',  label: 'Reports & Analytics',   href: `${_base}/pages/reports.html` },
  ];

  let html = `
    <div class="admin-sidebar-brand">
      <div class="admin-brand-logo">AG</div>
      <div class="admin-brand-text">AgriPortal</div>
      <div class="admin-sidebar-close" onclick="toggleSidebar()">✕</div>
    </div>
    <nav class="admin-nav">`;

  navItems.forEach(item => {
    const isActive = item.id === active ? 'active' : '';
    html += `
      <a class="admin-nav-item ${isActive}" href="${item.href}">
        <span class="admin-nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>`;
  });

  html += `</nav>
    <div class="admin-sidebar-footer">
      <div class="admin-officer-info">
        <div class="admin-officer-avatar">👤</div>
        <div>
          <div class="admin-officer-name">${escHtml(adminGetName())}</div>
          <div class="admin-officer-role">Admin Officer</div>
        </div>
      </div>
      <a class="admin-sidebar-portal"
         href="http://127.0.0.1:8000/frontend/index.html"
         style="cursor:pointer;color:rgba(255,255,255,0.5);font-size:10px;text-decoration:none;">
        🌿 Farmer Portal →
      </a>
    </div>`;

  const el = document.getElementById('admin-sidebar');
  if (el) el.innerHTML = html;
}

// ─── TOPBAR ───────────────────────────────────────────────────
function renderAdminTopbar() {
  const el = document.getElementById('admin-topbar');
  if (!el) return;
  const initials = adminGetName().split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
  el.innerHTML = `
    <div class="admin-topbar-left">
      <button class="admin-menu-btn" onclick="toggleSidebar()">☰</button>
      <div class="admin-search-wrap">
        <span class="admin-search-icon">🔍</span>
        <input class="admin-search-input" type="text" placeholder="Search farmers, applications...">
      </div>
    </div>
    <div class="admin-topbar-right">
      <div class="admin-notif-btn" title="3 notifications">
        🔔
        <span class="admin-notif-badge">3</span>
      </div>
      <div class="admin-profile-btn" onclick="adminLogout()" title="Click to logout">
        <div class="admin-profile-avatar">${initials}</div>
        <div>
          <div class="admin-profile-name">${escHtml(adminGetName())}</div>
          <div class="admin-profile-label">Admin · Logout</div>
        </div>
      </div>
    </div>`;
}

function toggleSidebar() {
  document.getElementById('admin-sidebar')?.classList.toggle('collapsed');
}

function escHtml(s) {
  return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
}

// ─── STATUS BADGE ─────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    'Approved':     'badge-approved',
    'Pending':      'badge-pending',
    'Under Review': 'badge-review',
    'Rejected':     'badge-rejected',
    'Filed':        'badge-filed',
    'Received':     'badge-filed',
    'Assigned':     'badge-review',
    'Action':       'badge-pending',
    'Resolved':     'badge-approved',
    'Processing':   'badge-review',
  };
  return `<span class="badge ${map[status]||'badge-pending'}">${status}</span>`;
}

// ─── AI SCORE BADGE ───────────────────────────────────────────
function aiScoreBadge(score) {
  const n = parseInt(score);
  let cls = 'ai-score-low';
  if (n >= 80) cls = 'ai-score-high';
  else if (n >= 60) cls = 'ai-score-mid';
  return `<span class="ai-score ${cls}">${score}</span>`;
}

// ─── SAFE API FETCH (uses page-level API constant) ────────────
async function adminFetch(url) {
  const base = (typeof API !== 'undefined') ? API : 'http://127.0.0.1:8000';
  const r = await fetch(base + url);
  if (!r.ok) throw new Error('API error ' + r.status);
  return r.json();
}
