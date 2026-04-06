$html = Get-Content 'd:\AI_Agri\farmer-portal.html' -Raw -Encoding UTF8

# 1. Replace root CSS variables
$html = $html -replace '--bg: #0f1a0e;', '--bg: #f0f6f0;'
$html = $html -replace '--bg2: #162315;', '--bg2: #ffffff;'
$html = $html -replace '--bg3: #1e301c;', '--bg3: #eef5ee;'
$html = $html -replace '--surface: #1a2b18;', '--surface: #ffffff;'
$html = $html -replace '--surface2: #233022;', '--surface2: #f0f6f0;'
$html = $html -replace '--border: #2d4029;', '--border: #c8ddc8;'
$html = $html -replace '--green: #4caf50;', '--green: #2e7d32;'
$html = $html -replace '--green2: #66bb6a;', '--green2: #388e3c;'
$html = $html -replace '--green-dim: #2e7d32;', '--green-dim: #1b5e20;'
$html = $html -replace '--gold: #f5c842;', '--gold: #e65100;'
$html = $html -replace '--gold2: #ffd54f;', '--gold2: #f57c00;'
$html = $html -replace '--amber: #ff8f00;', '--amber: #ef6c00;'
$html = $html -replace '--red: #ef5350;', '--red: #c62828;'
$html = $html -replace '--blue: #42a5f5;', '--blue: #1565c0;'
$html = $html -replace '--text: #e8f5e9;', '--text: #1a2e1a;'
$html = $html -replace '--text2: #a5c8a0;', '--text2: #2d4a2d;'
$html = $html -replace '--text3: #6a9166;', '--text3: #4a6e4a;'
$html = $html -replace '--muted: #4a6647;', '--muted: #6a8e6a;'

# 2. Inject extra overrides right after </style> opener to handle sidebar+topbar
$injection = @"
/* ─── LIGHT THEME OVERRIDES ─── */
body { background: #f0f6f0; }
.sidebar {
  background: linear-gradient(180deg, #1b5e20 0%, #2e7d32 60%, #388e3c 100%) !important;
  border-right-color: #1b5e20 !important;
}
.sidebar-logo { border-bottom: 1px solid rgba(255,255,255,0.15) !important; }
.logo-text { color: #ffffff !important; }
.logo-sub { color: rgba(255,255,255,0.65) !important; }
.farmer-badge { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.2) !important; }
.farmer-name { color: #ffffff !important; }
.farmer-id { color: rgba(255,255,255,0.65) !important; }
.nav-section-label { color: rgba(255,255,255,0.45) !important; }
.nav-item { color: rgba(255,255,255,0.8) !important; }
.nav-item:hover { background: rgba(255,255,255,0.12) !important; color: #ffffff !important; }
.nav-item.active { background: rgba(255,255,255,0.18) !important; color: #ffffff !important; border-color: rgba(255,255,255,0.3) !important; }
.nav-item.active::before { background: #a5d6a7 !important; }
.sidebar-footer { border-top-color: rgba(255,255,255,0.15) !important; color: rgba(255,255,255,0.55) !important; }
.topbar { background: #2e7d32 !important; border-bottom-color: #1b5e20 !important; }
.topbar-title { color: #ffffff !important; }
.notif-btn { background: rgba(255,255,255,0.15) !important; border-color: rgba(255,255,255,0.25) !important; color: #ffffff !important; }
.notif-btn:hover { background: rgba(255,255,255,0.25) !important; border-color: rgba(255,255,255,0.4) !important; }
.card { box-shadow: 0 2px 12px rgba(0,0,0,0.06); border-color: #d4e8d4; }
.stat-card { box-shadow: 0 2px 12px rgba(0,0,0,0.06); border-color: #d4e8d4; }
.stat-card:hover { border-color: var(--green) !important; }
.stat-val { color: #1a2e1a; }
.scheme-card { border-color: #d4e8d4; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.scheme-card:hover { box-shadow: 0 8px 24px rgba(46,125,50,0.15); }
.tabs { border-bottom-color: #d4e8d4; }
.tab.active { color: #2e7d32 !important; }
.notif-panel { background: #ffffff !important; border-color: #d4e8d4 !important; box-shadow: 0 20px 60px rgba(0,0,0,0.12) !important; }
.notif-item { border-bottom-color: #e8f5e8 !important; }
.notif-item.unread { border-left-color: #ef6c00 !important; }
.modal { background: #ffffff !important; border-color: #d4e8d4 !important; }
.modal-footer { border-top-color: #e8f5e8 !important; }
.section-title { color: #1a2e1a; }
.data-table th { color: #4a6e4a; border-bottom-color: #d4e8d4; }
.data-table td { border-bottom-color: #eef5ee; color: #2d4a2d; }
.data-table tr:hover td { background: rgba(46,125,50,0.04); }
.ribbon { background: linear-gradient(90deg, rgba(46,125,50,0.08), rgba(230,81,0,0.06)); border-color: rgba(46,125,50,0.2); }
.ribbon-text strong { color: #e65100; }
.btn-primary { background: linear-gradient(135deg, #2e7d32, #1b5e20); box-shadow: 0 4px 16px rgba(46,125,50,0.25); }
.btn-primary:hover { background: linear-gradient(135deg, #388e3c, #2e7d32); box-shadow: 0 6px 20px rgba(46,125,50,0.35); }
.btn-gold { background: linear-gradient(135deg, #ef6c00, #e65100); color: #fff !important; }
.btn-outline { border-color: #c8ddc8; color: #2d4a2d; }
.btn-outline:hover { border-color: #2e7d32; color: #2e7d32; background: rgba(46,125,50,0.05); }
.form-input, .form-select, .form-textarea { background: #f8fdf8; border-color: #c8ddc8; color: #1a2e1a; }
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #2e7d32; box-shadow: 0 0 0 3px rgba(46,125,50,0.12); }
.upload-zone { border-color: #c8ddc8; }
.upload-zone:hover { border-color: #2e7d32; background: rgba(46,125,50,0.04); }
.tag-approved { background: rgba(46,125,50,0.1); color: #1b5e20; border-color: rgba(46,125,50,0.3); }
.tag-pending { background: rgba(239,108,0,0.1); color: #bf360c; border-color: rgba(239,108,0,0.3); }
.tag-rejected { background: rgba(198,40,40,0.1); color: #b71c1c; border-color: rgba(198,40,40,0.3); }
.tag-processing { background: rgba(21,101,192,0.1); color: #0d47a1; border-color: rgba(21,101,192,0.3); }
.tag-submitted { background: rgba(239,108,0,0.1); color: #e65100; border-color: rgba(239,108,0,0.3); }
.alert-warning { background: rgba(239,108,0,0.08); border-color: rgba(239,108,0,0.3); color: #bf360c; }
.alert-success { background: rgba(46,125,50,0.08); border-color: rgba(46,125,50,0.3); color: #1b5e20; }
.alert-info { background: rgba(21,101,192,0.08); border-color: rgba(21,101,192,0.3); color: #0d47a1; }
.alert-error { background: rgba(198,40,40,0.08); border-color: rgba(198,40,40,0.3); color: #b71c1c; }
.success-banner { background: linear-gradient(135deg, rgba(46,125,50,0.08), rgba(239,108,0,0.05)); border-color: rgba(46,125,50,0.3); }
.success-title { color: #2e7d32; }
.empty-state { color: #4a6e4a; }
.chart-bar-track { background: #e8f5e8; }
.search-bar { background: #ffffff; border-color: #c8ddc8; }
::-webkit-scrollbar-track { background: #f0f6f0; }
::-webkit-scrollbar-thumb { background: #c8ddc8; }
::-webkit-scrollbar-thumb:hover { background: #a8c8a8; }
.category-card { background: #ffffff; border-color: #d4e8d4; }
.category-card.selected { border-color: #2e7d32; background: rgba(46,125,50,0.06); }
.cat-name { color: #1a2e1a; }
.stat-card.green::after { background: #2e7d32; }
.timeline::before { background: #d4e8d4; }
.timeline-dot { background: #d4e8d4; border-color: #f0f6f0; }
.grievance-stepper .step-item:not(:last-child)::after { background: #d4e8d4; }
.step-circle { background: #eef5ee; border-color: #d4e8d4; }
.header-hero { background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #388e3c 100%); }
"@

$html = $html -replace '(?s)(</style>)', "$injection`n</style>"

Set-Content 'd:\AI_Agri\farmer-portal.html' $html -Encoding UTF8
Write-Host "Theme restyle complete!"
