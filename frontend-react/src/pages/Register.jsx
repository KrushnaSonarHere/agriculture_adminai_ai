import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/auth';
import { saveProfile  } from '../api/farmers';
import { uploadDocument } from '../api/documents';
import '../styles/register-wizard.css';

/* ─────────────── CONSTANTS ─────────────── */
const DISTRICTS = [
  'Nashik','Pune','Nagpur','Aurangabad','Solapur','Kolhapur','Amravati','Satara',
  'Sangli','Latur','Nanded','Ahmednagar','Jalgaon','Beed','Dhule','Jalna',
  'Osmanabad','Parbhani','Hingoli','Buldhana','Akola','Washim','Yavatmal','Wardha',
  'Chandrapur','Gadchiroli','Gondia','Bhandara','Raigad','Ratnagiri','Sindhudurg',
  'Thane','Mumbai','Nandurbar',
];

const DOC_TYPES = [
  { key: 'aadhaar',  icon: '🪪',  label: 'Aadhaar Card',                   required: true  },
  { key: 'satbara',  icon: '🗺️', label: '7/12 Extract (Satbara)',           required: true  },
  { key: '8a',       icon: '📋',  label: '8-A Certificate',                 required: false },
  { key: 'bank',     icon: '🏦',  label: 'Bank Passbook / Cancelled Cheque',required: true  },
  { key: 'photo',    icon: '📷',  label: 'Passport Photo',                  required: true  },
  { key: 'caste',    icon: '📜',  label: 'Caste Certificate (SC/ST/OBC)',   required: false },
  { key: 'income',   icon: '📄',  label: 'Income Certificate',              required: false },
  { key: 'elec',     icon: '⚡',  label: 'Electricity Bill',                required: false },
];

const STEPS = [
  { num: 0, icon: '🔐', label: 'Account\nSetup'    },
  { num: 1, icon: '👤', label: 'Personal\nDetails'  },
  { num: 2, icon: '🪪', label: 'Identity\nInfo'     },
  { num: 3, icon: '🏦', label: 'Bank\nDetails'      },
  { num: 4, icon: '🌍', label: 'Address\n& Land'    },
  { num: 5, icon: '🌱', label: 'Farming\nDetails'   },
  { num: 6, icon: '📑', label: 'Documents\nUpload'  },
];

/* ─────────────── HELPERS ─────────────── */
function Field({ label, required, hint, children }) {
  return (
    <div className="rw-field">
      <label className="rw-label">
        {label}{required && <span className="rw-req">*</span>}
      </label>
      {children}
      {hint && <span className="rw-hint">{hint}</span>}
    </div>
  );
}

function RadioGroup({ name, options, value, onChange }) {
  return (
    <div className="rw-radio-group">
      {options.map(o => (
        <label key={o.value} className={`rw-radio-btn ${value === o.value ? 'selected' : ''}`}>
          <input type="radio" name={name} value={o.value}
            checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/* ─────────────── MAIN COMPONENT ─────────────── */
export default function Register() {
  const navigate = useNavigate();
  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [success, setSuccess] = useState(null); // { farmerId }

  // Step 0 — account
  const [acc, setAcc] = useState({
    full_name: '', email: '', mobile: '', state: 'Maharashtra',
    district: '', password: '', confirm_password: '',
  });
  // Store user id after step 0
  const [userId, setUserId]     = useState(null);
  const [farmerId, setFarmerId] = useState(null);

  // Step 1 — personal
  const [personal, setPersonal] = useState({ father_name: '', dob: '', gender: '' });

  // Step 2 — identity
  const [identity, setIdentity] = useState({ aadhaar: '', pan: '', voter_id: '' });

  // Step 3 — bank
  const [bank, setBank] = useState({
    bank_account: '', bank_account2: '', ifsc: '', bank_name: '', branch_name: '',
    account_type: 'savings', aadhaar_linked: false,
  });

  // Step 4 — address + land
  const [addressLand, setAddressLand] = useState({
    taluka: '', village: '', pincode: '', full_address: '',
    gat_number: '', land_area: '', satbara: '', eight_a: '', ownership_type: '',
  });

  // Step 5 — farming + category
  const [farming, setFarming] = useState({
    crop_type: '', irrigation_type: '', farming_type: 'traditional', electricity: 'yes',
    caste_category: '', income_bracket: '', bpl_status: 'no', prev_scheme: 'no', agristack_id: '',
  });

  // Step 6 — documents
  const [docFiles, setDocFiles] = useState({}); // { aadhaar: File, ... }
  const fileRefs = useRef({});

  /* ── Aadhaar formatting ── */
  const fmtAadhaar = (val) => {
    const d = val.replace(/\D/g, '').substring(0, 12);
    return d.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  /* ── Validate per step ── */
  const validate = () => {
    if (step === 0) {
      if (!acc.full_name.trim())   return 'Please enter your full name.';
      if (!acc.email.includes('@')) return 'Please enter a valid email address.';
      if (acc.mobile.length < 10)  return 'Please enter a valid 10-digit mobile number.';
      if (!acc.district)           return 'Please select your district.';
      if (acc.password.length < 6) return 'Password must be at least 6 characters.';
      if (acc.password !== acc.confirm_password) return 'Passwords do not match.';
    }
    if (step === 1) {
      if (!personal.father_name.trim()) return 'Please enter father / husband name.';
      if (!personal.dob) return 'Please enter your date of birth.';
      if (!personal.gender) return 'Please select your gender.';
    }
    if (step === 2) {
      if (identity.aadhaar.replace(/\s/g, '').length < 12) return 'Please enter a valid 12-digit Aadhaar number.';
    }
    if (step === 3) {
      if (!bank.bank_account) return 'Please enter bank account number.';
      if (bank.bank_account !== bank.bank_account2) return 'Bank account numbers do not match.';
      if (!bank.ifsc) return 'Please enter IFSC code.';
      if (!bank.bank_name) return 'Please enter bank name.';
    }
    if (step === 4) {
      if (!addressLand.taluka) return 'Please enter taluka.';
      if (!addressLand.village) return 'Please enter village.';
      if (!addressLand.gat_number) return 'Please enter Survey / Gat number.';
      if (!addressLand.land_area) return 'Please enter land area.';
    }
    if (step === 5) {
      if (!farming.crop_type) return 'Please select primary crop type.';
      if (!farming.irrigation_type) return 'Please select irrigation type.';
      if (!farming.caste_category) return 'Please select caste category.';
    }
    if (step === 6) {
      const required = DOC_TYPES.filter(d => d.required).map(d => d.key);
      for (const k of required) {
        if (!docFiles[k]) return `Please upload: ${DOC_TYPES.find(d=>d.key===k)?.label}`;
      }
    }
    return null;
  };

  /* ── Step 0: Register Account ── */
  const registerAccount = async () => {
    setLoading(true);
    try {
      const res = await registerUser({
        full_name: acc.full_name.trim(),
        email:     acc.email.trim(),
        mobile:    acc.mobile.trim(),
        state:     acc.state,
        district:  acc.district,
        password:  acc.password,
        role:      'farmer',
      });
      setUserId(res.data.id);
      setFarmerId(res.data.farmer_id);
      return true;
    } catch (e) {
      setError(e.response?.data?.detail || 'Registration failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /* ── Final Submit (steps 1-6 collected) ── */
  const submitAll = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Save full profile
      await saveProfile(userId, {
        father_name:    personal.father_name,
        dob:            personal.dob,
        gender:         personal.gender,
        aadhaar:        identity.aadhaar.replace(/\s/g, ''),
        pan:            identity.pan || null,
        voter_id:       identity.voter_id || null,
        bank_account:   bank.bank_account,
        ifsc:           bank.ifsc.toUpperCase(),
        bank_name:      bank.bank_name,
        branch_name:    bank.branch_name || null,
        account_type:   bank.account_type,
        taluka:         addressLand.taluka,
        village:        addressLand.village,
        pincode:        addressLand.pincode || null,
        full_address:   addressLand.full_address || null,
        gat_number:     addressLand.gat_number,
        land_area:      addressLand.land_area,
        satbara:        addressLand.satbara || null,
        eight_a:        addressLand.eight_a || null,
        ownership_type: addressLand.ownership_type || null,
        crop_type:      farming.crop_type,
        irrigation_type:farming.irrigation_type,
        farming_type:   farming.farming_type,
        electricity:    farming.electricity,
        caste_category: farming.caste_category,
        income_bracket: farming.income_bracket || null,
        bpl_status:     farming.bpl_status,
        prev_scheme:    farming.prev_scheme,
        agristack_id:   farming.agristack_id || null,
      });

      // 2. Upload each document
      for (const [docType, file] of Object.entries(docFiles)) {
        const fd = new FormData();
        fd.append('doc_type', docType);
        fd.append('file', file);
        try { await uploadDocument(userId, fd); } catch (_) { /* non-fatal */ }
      }

      // 3. Success
      setSuccess({ farmerId: farmerId || `KID-MH-${userId}` });
      setTimeout(() => navigate('/login'), 6000);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Next button handler ── */
  const goNext = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');

    if (step === 0) {
      const ok = await registerAccount();
      if (!ok) return;
    }
    if (step === STEPS.length - 1) {
      await submitAll();
      return;
    }
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPrev = () => {
    setError('');
    setStep(s => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Document file handler ── */
  const handleFile = (key, file) => {
    if (file) setDocFiles(prev => ({ ...prev, [key]: file }));
  };

  /* ── SUCCESS SCREEN ── */
  if (success) {
    return (
      <div className="rw-bg">
        <div className="rw-success-wrap">
          <div className="rw-success-icon">✅</div>
          <h2>Registration Successful!</h2>
          <p>Your farmer profile has been created and all documents saved securely.</p>
          <div className="rw-id-badge">
            <div className="rw-id-label">Your Farmer ID</div>
            <div className="rw-id-value">{success.farmerId}</div>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
            Save this ID — you'll need it for scheme applications. Redirecting to login...
          </p>
          <Link to="/login" className="rw-btn-primary">Login Now →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rw-bg">
      {/* ── Header ── */}
      <header className="rw-header">
        <div className="rw-header-logo">🌾</div>
        <div>
          <div className="rw-header-title">AgriPortal — Farmer Registration</div>
          <div className="rw-header-sub">Maharashtra Government Agriculture Portal</div>
        </div>
        <Link to="/login" className="rw-back-link">← Back to Login</Link>
      </header>

      {/* ── Progress ── */}
      <div className="rw-progress-wrap">
        <div className="rw-steps">
          {STEPS.map(s => (
            <div key={s.num} className={`rw-step ${step === s.num ? 'active' : step > s.num ? 'done' : ''}`}>
              <div className="rw-step-num">{step > s.num ? '✓' : s.num}</div>
              <div className="rw-step-label">{s.label.split('\n').map((l,i) => <span key={i}>{l}{i===0&&<br/>}</span>)}</div>
            </div>
          ))}
        </div>
        <div className="rw-progress-bar">
          <div className="rw-progress-fill" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
        </div>
      </div>

      {/* ── Form ── */}
      <div className="rw-body">
        {error && <div className="rw-alert">{error}</div>}

        {/* STEP 0 — Account Setup */}
        {step === 0 && (
          <div className="rw-card">
            <div className="rw-card-head"><h2>🔐 Create Your Account</h2><p>Login credentials to access the portal</p></div>
            <div className="rw-card-body">
              <div className="rw-grid-2">
                <Field label="Full Name" required>
                  <input className="rw-input" placeholder="e.g. Ramesh Shankar Patil"
                    value={acc.full_name} onChange={e => setAcc(p => ({...p, full_name: e.target.value}))} />
                </Field>
                <Field label="Email Address" required>
                  <input className="rw-input" type="email" placeholder="your@email.com"
                    value={acc.email} onChange={e => setAcc(p => ({...p, email: e.target.value}))} />
                </Field>
                <Field label="Mobile Number" required>
                  <input className="rw-input" type="tel" placeholder="10-digit mobile" maxLength={10}
                    value={acc.mobile} onChange={e => setAcc(p => ({...p, mobile: e.target.value.replace(/\D/g,'')}))} />
                </Field>
                <Field label="State">
                  <select className="rw-input" value={acc.state} onChange={e => setAcc(p => ({...p, state: e.target.value}))}>
                    {['Maharashtra','Karnataka','Gujarat','Rajasthan','Punjab','Haryana','Uttar Pradesh','Madhya Pradesh','Andhra Pradesh','Telangana'].map(s =>
                      <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="District" required>
                  <select className="rw-input" value={acc.district} onChange={e => setAcc(p => ({...p, district: e.target.value}))}>
                    <option value="">— Select District —</option>
                    {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Password" required>
                  <input className="rw-input" type="password" placeholder="At least 6 characters"
                    value={acc.password} onChange={e => setAcc(p => ({...p, password: e.target.value}))} />
                </Field>
                <Field label="Confirm Password" required>
                  <input className="rw-input" type="password" placeholder="Re-enter password"
                    value={acc.confirm_password} onChange={e => setAcc(p => ({...p, confirm_password: e.target.value}))} />
                </Field>
              </div>
              <div style={{marginTop:8,fontSize:12,color:'#6b7280'}}>
                Already have an account? <Link to="/login" style={{color:'#2e7d32',fontWeight:600}}>Login here</Link>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 — Personal Details */}
        {step === 1 && (
          <div className="rw-card">
            <div className="rw-card-head"><h2>👤 Personal Details</h2><p>Basic personal information required for registration</p></div>
            <div className="rw-card-body">
              <div className="rw-grid-2">
                <Field label="Father's / Husband's Name" required>
                  <input className="rw-input" placeholder="e.g. Shankar Patil"
                    value={personal.father_name} onChange={e => setPersonal(p => ({...p, father_name: e.target.value}))} />
                </Field>
                <Field label="Date of Birth" required>
                  <input className="rw-input" type="date"
                    value={personal.dob} onChange={e => setPersonal(p => ({...p, dob: e.target.value}))} />
                </Field>
              </div>
              <div className="rw-divider"/>
              <Field label="Gender" required>
                <RadioGroup name="gender"
                  options={[{value:'male',label:'Male'},{value:'female',label:'Female'},{value:'other',label:'Other'}]}
                  value={personal.gender} onChange={v => setPersonal(p => ({...p, gender: v}))} />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 2 — Identity */}
        {step === 2 && (
          <div className="rw-card">
            <div className="rw-card-head"><h2>🪪 Identity Details</h2><p>Aadhaar verification is mandatory for scheme benefits</p></div>
            <div className="rw-card-body">
              <Field label="Aadhaar Number" required>
                <div className="rw-otp-row">
                  <input className="rw-input" placeholder="XXXX XXXX XXXX" maxLength={14}
                    value={identity.aadhaar}
                    onChange={e => setIdentity(p => ({...p, aadhaar: fmtAadhaar(e.target.value)}))} />
                  <button className="rw-otp-btn" onClick={() => {
                    if (identity.aadhaar.replace(/\s/g,'').length < 12) { setError('Enter valid 12-digit Aadhaar first.'); return; }
                    setError(''); setOtpSent(true);
                  }}>Send OTP</button>
                </div>
              </Field>
              {otpSent && (
                <div className="rw-otp-success">✅ OTP sent to mobile linked with Aadhaar. (Demo: any 6 digits will work)</div>
              )}
              <div className="rw-divider"/>
              <div className="rw-grid-2">
                <Field label="PAN Card" hint="Optional">
                  <input className="rw-input" placeholder="ABCDE1234F" maxLength={10}
                    value={identity.pan} onChange={e => setIdentity(p => ({...p, pan: e.target.value.toUpperCase()}))} />
                </Field>
                <Field label="Voter ID" hint="Optional">
                  <input className="rw-input" placeholder="Voter ID number"
                    value={identity.voter_id} onChange={e => setIdentity(p => ({...p, voter_id: e.target.value}))} />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Bank Details */}
        {step === 3 && (
          <div className="rw-card">
            <div className="rw-card-head"><h2>🏦 Bank Details</h2><p>For Direct Benefit Transfer (DBT) — must match Aadhaar</p></div>
            <div className="rw-card-body">
              <div className="rw-grid-2">
                <Field label="Bank Account Number" required>
                  <input className="rw-input" placeholder="Account number"
                    value={bank.bank_account} onChange={e => setBank(p => ({...p, bank_account: e.target.value}))} />
                </Field>
                <Field label="Confirm Account Number" required>
                  <input className="rw-input" placeholder="Re-enter account number"
                    value={bank.bank_account2} onChange={e => setBank(p => ({...p, bank_account2: e.target.value}))} />
                </Field>
                <Field label="IFSC Code" required>
                  <input className="rw-input" placeholder="e.g. SBIN0004321" maxLength={11}
                    value={bank.ifsc} onChange={e => setBank(p => ({...p, ifsc: e.target.value.toUpperCase()}))} />
                </Field>
                <Field label="Bank Name" required>
                  <input className="rw-input" placeholder="e.g. State Bank of India"
                    value={bank.bank_name} onChange={e => setBank(p => ({...p, bank_name: e.target.value}))} />
                </Field>
                <Field label="Branch Name" hint="Optional">
                  <input className="rw-input" placeholder="e.g. Nashik Main Branch"
                    value={bank.branch_name} onChange={e => setBank(p => ({...p, branch_name: e.target.value}))} />
                </Field>
                <Field label="Account Type">
                  <select className="rw-input" value={bank.account_type} onChange={e => setBank(p => ({...p, account_type: e.target.value}))}>
                    <option value="savings">Savings Account</option>
                    <option value="current">Current Account</option>
                    <option value="jan-dhan">Jan Dhan Account</option>
                  </select>
                </Field>
              </div>
              <div className="rw-divider"/>
              <label className="rw-checkbox">
                <input type="checkbox" checked={bank.aadhaar_linked}
                  onChange={e => setBank(p => ({...p, aadhaar_linked: e.target.checked}))} />
                &nbsp; I confirm this bank account is linked to my Aadhaar
              </label>
            </div>
          </div>
        )}

        {/* STEP 4 — Address & Land */}
        {step === 4 && (
          <div className="rw-card">
            <div className="rw-card-head"><h2>🌍 Address &amp; Land Details</h2><p>Location and land information for scheme eligibility</p></div>
            <div className="rw-card-body">
              <div className="rw-section-sub">📍 Address</div>
              <div className="rw-grid-2">
                <Field label="Taluka" required>
                  <input className="rw-input" placeholder="e.g. Niphad"
                    value={addressLand.taluka} onChange={e => setAddressLand(p => ({...p, taluka: e.target.value}))} />
                </Field>
                <Field label="Village" required>
                  <input className="rw-input" placeholder="e.g. Nandur Madhyameshwar"
                    value={addressLand.village} onChange={e => setAddressLand(p => ({...p, village: e.target.value}))} />
                </Field>
                <Field label="Pin Code">
                  <input className="rw-input" placeholder="6-digit pin code" maxLength={6}
                    value={addressLand.pincode} onChange={e => setAddressLand(p => ({...p, pincode: e.target.value.replace(/\D/g,'')}))} />
                </Field>
                <Field label="Full Address" hint="Optional">
                  <input className="rw-input" placeholder="House no., Street name"
                    value={addressLand.full_address} onChange={e => setAddressLand(p => ({...p, full_address: e.target.value}))} />
                </Field>
              </div>
              <div className="rw-divider"/>
              <div className="rw-section-sub">🌾 Land Details</div>
              <div className="rw-grid-2">
                <Field label="Survey / Gat Number" required>
                  <input className="rw-input" placeholder="e.g. Gat No. 42, 43"
                    value={addressLand.gat_number} onChange={e => setAddressLand(p => ({...p, gat_number: e.target.value}))} />
                </Field>
                <Field label="Land Area" required>
                  <input className="rw-input" placeholder="e.g. 2.5 acres / 1 hectare"
                    value={addressLand.land_area} onChange={e => setAddressLand(p => ({...p, land_area: e.target.value}))} />
                </Field>
                <Field label="7/12 Extract Number" required>
                  <input className="rw-input" placeholder="7/12 Satbara number"
                    value={addressLand.satbara} onChange={e => setAddressLand(p => ({...p, satbara: e.target.value}))} />
                </Field>
                <Field label="8-A Certificate Number" hint="Optional">
                  <input className="rw-input" placeholder="8-A Certificate number"
                    value={addressLand.eight_a} onChange={e => setAddressLand(p => ({...p, eight_a: e.target.value}))} />
                </Field>
                <Field label="Land Ownership Type" required>
                  <select className="rw-input" value={addressLand.ownership_type}
                    onChange={e => setAddressLand(p => ({...p, ownership_type: e.target.value}))}>
                    <option value="">— Select —</option>
                    <option value="own">Self-owned</option>
                    <option value="joint">Joint ownership</option>
                    <option value="lease">Leased land</option>
                    <option value="forest">Forest lease (Rights Act 2006)</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 — Farming & Category */}
        {step === 5 && (
          <div className="rw-card">
            <div className="rw-card-head"><h2>🌱 Farming &amp; Category Details</h2><p>Crop and social category information for scheme eligibility</p></div>
            <div className="rw-card-body">
              <div className="rw-section-sub">🌾 Farming Information</div>
              <div className="rw-grid-2">
                <Field label="Primary Crop Type" required>
                  <select className="rw-input" value={farming.crop_type}
                    onChange={e => setFarming(p => ({...p, crop_type: e.target.value}))}>
                    <option value="">— Select Crop —</option>
                    {['Wheat','Rice','Cotton','Sugarcane','Soybean','Tur (Arhar)','Gram / Chickpea',
                      'Jowar','Bajra','Maize','Sunflower','Groundnut','Onion','Grapes','Pomegranate',
                      'Banana','Mango','Orange','Vegetables (Mixed)','Horticulture'].map(c =>
                      <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Irrigation Type" required>
                  <select className="rw-input" value={farming.irrigation_type}
                    onChange={e => setFarming(p => ({...p, irrigation_type: e.target.value}))}>
                    <option value="">— Select —</option>
                    <option value="drip">Drip Irrigation</option>
                    <option value="sprinkler">Sprinkler Irrigation</option>
                    <option value="canal">Canal Irrigation</option>
                    <option value="well">Well / Borewell</option>
                    <option value="rainfed">Rainfed (No irrigation)</option>
                  </select>
                </Field>
                <Field label="Farming Type" required>
                  <select className="rw-input" value={farming.farming_type}
                    onChange={e => setFarming(p => ({...p, farming_type: e.target.value}))}>
                    <option value="traditional">Traditional Farming</option>
                    <option value="organic">Organic Farming</option>
                    <option value="natural">Natural Farming</option>
                    <option value="mixed">Mixed (Traditional + Organic)</option>
                  </select>
                </Field>
                <Field label="Electricity Connection">
                  <select className="rw-input" value={farming.electricity}
                    onChange={e => setFarming(p => ({...p, electricity: e.target.value}))}>
                    <option value="yes">Yes — Agricultural Connection</option>
                    <option value="no">No</option>
                    <option value="pending">Applied / Pending</option>
                  </select>
                </Field>
              </div>
              <div className="rw-divider"/>
              <div className="rw-section-sub">🧾 Category Details</div>
              <div className="rw-grid-2">
                <Field label="Caste Category" required>
                  <RadioGroup name="caste"
                    options={[{value:'general',label:'General'},{value:'obc',label:'OBC'},
                      {value:'sc',label:'SC'},{value:'st',label:'ST'},{value:'vjnt',label:'VJNT'}]}
                    value={farming.caste_category}
                    onChange={v => setFarming(p => ({...p, caste_category: v}))} />
                </Field>
                <Field label="Annual Household Income">
                  <select className="rw-input" value={farming.income_bracket}
                    onChange={e => setFarming(p => ({...p, income_bracket: e.target.value}))}>
                    <option value="">— Select —</option>
                    <option value="below1">Below ₹1 Lakh</option>
                    <option value="1to2">₹1 – 2 Lakh</option>
                    <option value="2to5">₹2 – 5 Lakh</option>
                    <option value="above5">Above ₹5 Lakh</option>
                  </select>
                </Field>
                <Field label="BPL Status">
                  <select className="rw-input" value={farming.bpl_status}
                    onChange={e => setFarming(p => ({...p, bpl_status: e.target.value}))}>
                    <option value="no">Not BPL</option>
                    <option value="yes">BPL Card Holder</option>
                  </select>
                </Field>
                <Field label="Previous Scheme Benefits">
                  <select className="rw-input" value={farming.prev_scheme}
                    onChange={e => setFarming(p => ({...p, prev_scheme: e.target.value}))}>
                    <option value="no">No previous benefits</option>
                    <option value="yes">Yes — received before</option>
                  </select>
                </Field>
                <Field label="AgriStack Farmer ID" hint="Leave blank if not registered">
                  <input className="rw-input" placeholder="e.g. KID-MH-2024-XXXXX"
                    value={farming.agristack_id} onChange={e => setFarming(p => ({...p, agristack_id: e.target.value}))} />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6 — Documents Upload */}
        {step === 6 && (
          <div className="rw-card">
            <div className="rw-card-head"><h2>📑 Documents Upload</h2><p>Upload scanned copies or clear photos of required documents</p></div>
            <div className="rw-card-body">
              <div className="rw-doc-grid">
                {DOC_TYPES.map(dt => {
                  const file = docFiles[dt.key];
                  return (
                    <div key={dt.key}
                      className={`rw-doc-card ${file ? 'uploaded' : ''}`}
                      onClick={() => fileRefs.current[dt.key]?.click()}>
                      <input
                        type="file" accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        ref={el => fileRefs.current[dt.key] = el}
                        onChange={e => handleFile(dt.key, e.target.files[0])}
                      />
                      <div className="rw-doc-icon">{dt.icon}</div>
                      <div className="rw-doc-name">{dt.label}</div>
                      <div className="rw-doc-status">
                        {file
                          ? `✅ ${file.name.substring(0, 20)}${file.name.length > 20 ? '…' : ''}`
                          : dt.required ? 'Click to upload *' : 'Click to upload (Optional)'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rw-divider"/>
              <label className="rw-checkbox">
                <input type="checkbox" id="declaration" required />
                &nbsp; I hereby declare that all the information provided is true and correct to the best of my knowledge.
                I understand that providing false information may lead to cancellation of benefits.
              </label>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="rw-nav">
          {step > 0 && (
            <button className="rw-btn-back" onClick={goPrev} disabled={loading}>← Back</button>
          )}
          <span className="rw-step-counter">Step {step + 1} of {STEPS.length}</span>
          <button className="rw-btn-primary" onClick={goNext} disabled={loading}>
            {loading ? '⏳ Please wait…' : step === STEPS.length - 1 ? '✓ Submit Registration' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
