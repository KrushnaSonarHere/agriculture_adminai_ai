"""
seed_admin_demo.py
Seeds demo schemes, farmers, applications and grievances for admin panel testing.
Run from project root: python seed_admin_demo.py
"""
import requests, json, sys

API = 'http://127.0.0.1:8000'

def post(url, data):
    try:
        r = requests.post(API + url, json=data, timeout=8)
        return r.status_code, r.json()
    except Exception as e:
        return 0, str(e)

def get(url):
    try:
        r = requests.get(API + url, timeout=8)
        return r.json()
    except Exception as e:
        return []

# ─── 1. Health check ──────────────────────────────────────────
print('\n[0] Checking API...')
try:
    r = requests.get(f'{API}/health', timeout=5)
    print(f'  ✓ API healthy: {r.json()}')
except Exception as e:
    print(f'  ✗ API not reachable: {e}')
    print('     Make sure: uvicorn main:app --reload --port 8000 (in backend/)')
    sys.exit(1)

# ─── 2. Get existing scheme IDs ───────────────────────────────
print('\n[1] Fetching schemes...')
schemes = get('/schemes/')
if not schemes:
    print('  ✗ No schemes found! Run load_schemes.py first.')
    sys.exit(1)
scheme_map = {s['Scheme_Name']: s['id'] for s in schemes}
print(f'  ✓ {len(schemes)} schemes found: {list(scheme_map.keys())[:4]}...')

# Helper to get scheme_id by partial name
def sid(name):
    for k, v in scheme_map.items():
        if name.lower() in k.lower():
            return v
    return schemes[0]['id']  # fallback to first

# ─── 3. Create admin user ─────────────────────────────────────
print('\n[2] Creating admin user...')
sc, data = post('/auth/register', {
    'full_name': 'Officer Sharma', 'email': 'admin@agriportal.gov.in',
    'mobile': '9000000001', 'state': 'Maharashtra', 'district': 'Nashik',
    'password': 'admin123', 'role': 'admin'
})
if sc == 201:
    print(f'  ✓ Admin created: {data.get("full_name")}')
elif sc == 400:
    print(f'  ↩ Admin already exists')
else:
    print(f'  ✗ {sc}: {data}')

# ─── 4. Create demo farmers ───────────────────────────────────
print('\n[3] Creating demo farmers...')
FARMERS = [
    ('Ramesh Kumar',  'ramesh2@farm.in',  '9876543211', 'Nashik',     'Maharashtra'),
    ('Sunita Devi',   'sunita2@farm.in',  '9123456780', 'Pune',       'Maharashtra'),
    ('Vijay Singh',   'vijay2@farm.in',   '9988776656', 'Nagpur',     'Maharashtra'),
    ('Lakshmi Patel', 'lakshmi2@farm.in', '9871234568', 'Kolhapur',   'Maharashtra'),
    ('Mohan Reddy',   'mohan2@farm.in',   '9765432101', 'Solapur',    'Maharashtra'),
    ('Geeta Sharma',  'geeta2@farm.in',   '9654321099', 'Aurangabad', 'Maharashtra'),
    ('Ravi Tiwari',   'ravi2@farm.in',    '9543210988', 'Nashik',     'Maharashtra'),
    ('Anjali Desai',  'anjali2@farm.in',  '9432109877', 'Pune',       'Maharashtra'),
]

farmer_ids = {}  # name -> farmer_id string
for name, email, mobile, district, state in FARMERS:
    sc, data = post('/auth/register', {
        'full_name': name, 'email': email, 'mobile': mobile,
        'state': state, 'district': district,
        'password': 'farmer123', 'role': 'farmer'
    })
    if sc == 201:
        fid = data.get('farmer_id', f'KID-MH-{data.get("id")}')
        farmer_ids[name] = {'uid': data['id'], 'farmer_id': fid, 'name': name, 'district': district, 'mobile': mobile}
        print(f'  ✓ {name} (farmer_id={fid})')
    elif sc == 400:
        # Try login to get existing
        lr = requests.post(f'{API}/auth/login', json={'credential': email, 'password': 'farmer123'}, timeout=5)
        if lr.status_code == 200:
            d = lr.json()
            fid = d.get('farmer_id', f'KID-MH-{d.get("id")}')
            farmer_ids[name] = {'uid': d['id'], 'farmer_id': fid, 'name': name, 'district': district, 'mobile': mobile}
            print(f'  ↩ {name} exists (farmer_id={fid})')
    else:
        print(f'  ✗ {name}: {data}')

# ─── 5. Submit demo applications ─────────────────────────────
print('\n[4] Submitting demo applications...')
APPS = [
    ('Ramesh Kumar',  'PM-KISAN',           'Pending',      'MH-001-A'),
    ('Sunita Devi',   'Crop Insurance',     'Pending',      'MH-002-B'),
    ('Vijay Singh',   'PM-KISAN',           'Pending',      'MH-003-C'),
    ('Lakshmi Patel', 'Crop Insurance',     'Pending',      'MH-004-D'),
    ('Mohan Reddy',   'PM-KISAN',           'Pending',      'MH-005-E'),
    ('Geeta Sharma',  'Crop Insurance',     'Pending',      'MH-006-F'),
    ('Ravi Tiwari',   'PM-KISAN',           'Pending',      'MH-007-G'),
    ('Anjali Desai',  'Crop Insurance',     'Pending',      'MH-008-H'),
]

app_ids = []
for farmer_name, scheme_kw, status, bank in APPS:
    f = farmer_ids.get(farmer_name, {})
    payload = {
        'scheme_id':    sid(scheme_kw),
        'farmer_name':  farmer_name,
        'farmer_id':    f.get('farmer_id', ''),
        'mobile':       f.get('mobile', ''),
        'district':     f.get('district', 'Nashik'),
        'bank_account': bank,
        'notes':        f'Demo application for {scheme_kw}',
    }
    sc, data = post('/applications/', payload)
    if sc == 201:
        aid = data.get('id')
        app_ids.append(aid)
        print(f'  ✓ {farmer_name} → {data.get("app_number")} ({scheme_kw})')
        # Update status via PUT
        if status != 'Pending':
            requests.put(f'{API}/applications/{aid}/status',
                json={'status': status, 'admin_remarks': 'Demo data'},
                timeout=5)
    else:
        print(f'  ✗ {farmer_name}: {sc} {str(data)[:80]}')

# Set varied statuses for visual testing
status_cycle = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Pending', 'Under Review', 'Approved', 'Pending']
print('\n  Updating statuses...')
for i, aid in enumerate(app_ids):
    st = status_cycle[i % len(status_cycle)]
    if st != 'Pending':
        r = requests.put(f'{API}/applications/{aid}/status',
            json={'status': st, 'admin_remarks': 'Demo status update'},
            timeout=5)
        print(f'  ✓ App #{aid} → {st}' if r.status_code == 200 else f'  ✗ App #{aid}: {r.status_code}')

# ─── 6. Submit demo grievances ────────────────────────────────
print('\n[5] Submitting demo grievances...')
GRIEVANCES = [
    ('Ramesh Kumar',   'KID-MH-001', 'Payment Issue',   'PM Kisan amount not received for Q4',         'high',   None),
    ('Sunita Devi',    'KID-MH-002', 'Delay',           'Application pending for 45 days',             'medium', None),
    ('Vijay Singh',    'KID-MH-003', 'Technical Issue', 'Portal login not working on mobile',          'low',    None),
    ('Anjali Desai',   'KID-MH-008', 'Document',        'Document re-upload required but link broken', 'high',   None),
    ('Geeta Sharma',   'KID-MH-006', 'Payment Issue',   'Subsidy amount mismatch in credit',           'medium', None),
]

for fname, fid, cat, title, priority, related in GRIEVANCES:
    sc, data = post('/grievances/', {
        'farmer_name':    fname,
        'farmer_id':      fid,
        'category':       cat,
        'title':          title,
        'description':    f'Demo grievance filed by {fname}: {title}',
        'priority':       priority,
        'related_app_id': related,
    })
    if sc == 201:
        print(f'  ✓ {data.get("grv_number")} — {title[:45]}')
    else:
        print(f'  ✗ {cat}: {sc} {str(data)[:80]}')

# ─── Summary ──────────────────────────────────────────────────
print('\n' + '='*52)
print('  ✅ Demo data seeded successfully!')
print('='*52)
print(f'  Farmers created : {len(farmer_ids)}')
print(f'  Applications    : {len(app_ids)}')
print(f'  Grievances      : {len(GRIEVANCES)}')
print()
print('  Admin Panel  → http://127.0.0.1:7891/index.html')
print('  Farmer Portal→ http://127.0.0.1:7890/pages/login.html')
print()
print('  Admin login  → admin@agriportal.gov.in / admin123')
print('  Farmer login → ramesh2@farm.in / farmer123')
print('='*52 + '\n')
