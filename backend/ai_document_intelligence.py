"""
ai_document_intelligence.py
═══════════════════════════════════════════════════════════════════
AI-Powered Document Intelligence System
Based on Master Prompt — Production-ready for PostgreSQL

Pipeline:
  1. PaddleOCR  →  Raw text extraction (multi-lang, angle correction)
  2. Text cleaning  →  OCR noise removal
  3. Document type detection  →  Auto-classify document
  4. Entity extraction  →  Per-type field parsers
  5. Data standardization  →  Dates, currency, normalization
  6. Confidence scoring  →  Per-field + overall confidence (0.0–1.0)
  7. SQL-ready JSON output  →  Flat structure, null for missing

Supported document types:
  AADHAAR_CARD | BANK_PASSBOOK | LAND_RECORD | INCOME_CERTIFICATE
  ELECTRICITY_BILL | CASTE_CERTIFICATE | IDENTITY_DOCUMENT | OTHER

Author: KisanSetu AI Team
"""

import re
import os
import json
import logging
import tempfile
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
#  MODULE-LEVEL IMPORTS — Graceful fallbacks
# ═══════════════════════════════════════════════════════════════

# ── PaddleOCR ────────────────────────────────────────────────
PADDLE_AVAILABLE = False
_ocr_instance = None

def _init_paddle():
    """Lazy-init PaddleOCR for perf — only once per process."""
    global _ocr_instance, PADDLE_AVAILABLE
    if _ocr_instance is not None:
        return _ocr_instance
    try:
        from paddleocr import PaddleOCR
        # use_angle_cls: corrects rotated/upside-down text (common in scanned docs)
        # lang='en': English + supports Devanagari numerals via fallback
        # use_gpu: auto-detects GPU, falls back to CPU
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            show_log=False,
            use_gpu=False,          # set True if CUDA available
            det_db_score_mode='slow',  # more accurate detection
            rec_algorithm='CRNN',
        )
        PADDLE_AVAILABLE = True
        logger.info("✅ PaddleOCR initialized (CPU mode)")
    except Exception as e:
        PADDLE_AVAILABLE = False
        logger.warning(f"⚠️  PaddleOCR unavailable: {e}. Fallback to regex-only mode.")
    return _ocr_instance

_init_paddle()  # attempt at import time

# ── RapidFuzz ────────────────────────────────────────────────
try:
    from rapidfuzz import fuzz as _fuzz
    FUZZ_AVAILABLE = True
except ImportError:
    FUZZ_AVAILABLE = False

# ── pdf2image ────────────────────────────────────────────────
try:
    from pdf2image import convert_from_path
    PDF_AVAILABLE = True
except Exception:
    PDF_AVAILABLE = False

# ── PIL ──────────────────────────────────────────────────────
try:
    from PIL import Image, ImageFilter, ImageEnhance
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════
#  STEP 1 — PaddleOCR Text Extraction
# ═══════════════════════════════════════════════════════════════

def _preprocess_image(img):
    """
    Pre-process PIL image for better OCR accuracy:
    - Convert to RGB
    - Sharpen edges  
    - Boost contrast
    - Min 300 DPI equivalent sizing
    """
    if not PIL_AVAILABLE:
        return img
    img = img.convert("RGB")
    # Upscale if too small (PaddleOCR works best at ~300dpi)
    w, h = img.size
    if min(w, h) < 600:
        scale = max(1, 600 // min(w, h))
        img = img.resize((w * scale, h * scale), Image.LANCZOS)
    # Sharpen + contrast boost
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(1.4)
    img = ImageEnhance.Sharpness(img).enhance(1.6)
    return img


def _load_file_as_image(filepath: str):
    """Load any supported file (JPG/PNG/PDF) as PIL Image."""
    if not PIL_AVAILABLE:
        return None
    ext = os.path.splitext(filepath)[1].lower()
    try:
        if ext == '.pdf':
            if PDF_AVAILABLE:
                pages = convert_from_path(filepath, dpi=300, first_page=1, last_page=1)
                return pages[0] if pages else None
            else:
                logger.warning("pdf2image not available — cannot process PDF")
                return None
        return Image.open(filepath)
    except Exception as e:
        logger.error(f"Failed to load image {filepath}: {e}")
        return None


def extract_raw_text_paddle(filepath: str) -> Tuple[str, List[dict]]:
    """
    Run PaddleOCR on file. Returns:
      - full_text: all lines joined
      - word_results: list of {text, confidence, box} for each word
    """
    ocr = _init_paddle()
    if not PADDLE_AVAILABLE or ocr is None:
        return "", []

    img = _load_file_as_image(filepath)
    if img is None:
        return "", []

    img = _preprocess_image(img)

    # Save preprocessed image to temp file for PaddleOCR
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
        tmp_path = tmp.name
        img.save(tmp_path, 'JPEG', quality=95)

    try:
        result = ocr.ocr(tmp_path, cls=True)
    except Exception as e:
        logger.error(f"PaddleOCR.ocr() failed: {e}")
        return "", []
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    if not result or not result[0]:
        return "", []

    lines = []
    word_results = []
    for page in result:
        if not page:
            continue
        for word_info in page:
            box, (text, conf) = word_info
            text = str(text).strip()
            if text:
                lines.append(text)
                word_results.append({
                    "text": text,
                    "confidence": round(float(conf), 4),
                    "box": box,
                })

    full_text = "\n".join(lines)
    return full_text, word_results


def get_average_ocr_confidence(word_results: List[dict]) -> float:
    """Compute mean PaddleOCR confidence across all detected words."""
    if not word_results:
        return 0.0
    return round(sum(w["confidence"] for w in word_results) / len(word_results), 4)


# ═══════════════════════════════════════════════════════════════
#  STEP 2 — Text Cleaning
# ═══════════════════════════════════════════════════════════════

# Common OCR substitution errors in Indian documents
_OCR_FIXES = [
    (r'\bO\b', '0'),           # Standalone O → 0 (in numbers)
    (r'(?<=[0-9])O(?=[0-9])', '0'),  # 2O45 → 2045
    (r'(?<=[0-9])l(?=[0-9])', '1'),  # 2l4 → 214
    (r'(?<=[0-9])I(?=[0-9])', '1'),  # 2I4 → 214
    (r'Rs\.?\s*', '₹'),            # Normalize currency
    (r'INR\s*', '₹'),
    (r'\bSAMPLE\b', ''),           # Remove watermarks
    (r'\bNOT A REAL DOCUMENT\b', '', re.IGNORECASE),
    (r'\bSPECIMEN\b', ''),
    (r'[ \t]+', ' '),              # Collapse spaces
]


def clean_ocr_text(raw: str) -> str:
    """Apply OCR noise corrections to raw text."""
    text = raw
    for pattern_args in _OCR_FIXES:
        if len(pattern_args) == 3:
            text = re.sub(pattern_args[0], pattern_args[1], text, flags=pattern_args[2])
        else:
            text = re.sub(pattern_args[0], pattern_args[1], text)
    # Normalize Unicode spaces
    text = text.replace('\u00a0', ' ').replace('\u200b', '')
    # Remove consecutive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


# ═══════════════════════════════════════════════════════════════
#  STEP 3 — Document Type Detection
# ═══════════════════════════════════════════════════════════════

_DOC_SIGNALS = {
    "AADHAAR_CARD": [
        r'\baadhaar\b', r'\bUIDAI\b', r'\bunique identification\b',
        r'\b\d{4}\s\d{4}\s\d{4}\b', r'\bVID\b', r'\bmera\s+aadhaar\b',
        r'\byour\s+aadhaar\b',
    ],
    "BANK_PASSBOOK": [
        r'\bpassbook\b', r'\bIFSC\b', r'\bMICR\b', r'\baccount\s+no\b',
        r'\bsavings\s+account\b', r'\bCIF\b', r'\bbank\s+statement\b',
        r'\btransaction\b', r'\bbalance\b', r'\bcheque\b',
    ],
    "LAND_RECORD": [
        r'\b7/12\b', r'\bsatbara\b', r'\bgat\s+no\b', r'\bsurvey\s+no\b',
        r'\bkhata\b', r'\bholder\s+of\s+land\b', r'\btaluka\b.*\bvillage\b',
        r'\bland\s+record\b', r'\bsatbara\s+utara\b', r'\b8-A\b',
    ],
    "INCOME_CERTIFICATE": [
        r'\bincome\s+certificate\b', r'\bannual\s+income\b',
        r'\bahay\s+praman\b', r'\btehsildar\b', r'\bincome\s+source\b',
        r'\btotal\s+annual\b', r'\bincome\s+from\b',
    ],
    "ELECTRICITY_BILL": [
        r'\belectricity\s+bill\b', r'\bMSEB\b', r'\bMSEDCL\b',
        r'\bconsumer\s+no\b', r'\bmeter\s+no\b', r'\bunits\s+consumed\b',
        r'\bkwh\b', r'\bdue\s+date\b.*\bbill\b', r'\btariff\b',
    ],
    "CASTE_CERTIFICATE": [
        r'\bcaste\s+certificate\b', r'\bjati\s+praman\b',
        r'\bscheduled\s+caste\b', r'\bscheduled\s+tribe\b',
        r'\bOBC\b', r'\bVJNT\b', r'\bSBC\b', r'\bNT\b.*\bcertificate\b',
    ],
}


def detect_document_type(text: str, hint: Optional[str] = None) -> str:
    """
    Classify document from OCR text.
    hint: doc_type stored in DB (e.g. 'aadhaar', 'satbara') — used as tiebreaker.
    """
    # Map DB doc_type hints → canonical type
    hint_map = {
        'aadhaar': 'AADHAAR_CARD', 'bank': 'BANK_PASSBOOK',
        'satbara': 'LAND_RECORD', '8a': 'LAND_RECORD',
        'income': 'INCOME_CERTIFICATE', 'elec': 'ELECTRICITY_BILL',
        'caste': 'CASTE_CERTIFICATE', 'photo': 'IDENTITY_DOCUMENT',
    }

    text_lower = text.lower()
    scores = {}
    for doc_type, patterns in _DOC_SIGNALS.items():
        score = sum(1 for p in patterns if re.search(p, text_lower, re.IGNORECASE))
        scores[doc_type] = score

    best_type, best_score = max(scores.items(), key=lambda x: x[1])

    # Use hint as tiebreaker if score is low
    if best_score == 0 and hint and hint in hint_map:
        return hint_map[hint]
    if best_score == 0:
        return "OTHER"

    # If hint strongly matches and score is tied, prefer hint
    if hint and hint in hint_map and hint_map[hint] == best_type:
        return best_type
    if hint and hint in hint_map and scores.get(hint_map[hint], 0) >= best_score - 1:
        return hint_map[hint]

    return best_type


# ═══════════════════════════════════════════════════════════════
#  STEP 4 — Entity Extraction (per document type)
# ═══════════════════════════════════════════════════════════════

def _find(pattern: str, text: str, group: int = 1, flags: int = re.IGNORECASE) -> Optional[str]:
    m = re.search(pattern, text, flags)
    return m.group(group).strip() if m else None


def _find_all(pattern: str, text: str, flags: int = re.IGNORECASE) -> List[str]:
    return [m.strip() for m in re.findall(pattern, text, flags)]


def _normalize_date(raw: Optional[str]) -> Optional[str]:
    """Convert any date format → YYYY-MM-DD. Returns None if unparseable."""
    if not raw:
        return None
    raw = raw.strip()
    formats = [
        '%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y',
        '%Y/%m/%d', '%Y-%m-%d',
        '%d %b %Y', '%d %B %Y',
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    # Try partial: DD/MM/YY → assume 2000s
    m = re.match(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$', raw)
    if m:
        d, mo, y = m.groups()
        return f"20{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return raw  # Return as-is if can't parse


def _normalize_currency(raw: Optional[str]) -> Optional[float]:
    """Strip ₹, Rs, commas → float."""
    if not raw:
        return None
    cleaned = re.sub(r'[₹Rs,\s]', '', str(raw))
    try:
        return float(cleaned)
    except ValueError:
        return None


def _clean_name(raw: Optional[str]) -> Optional[str]:
    """Remove common OCR artifacts from names."""
    if not raw:
        return None
    # Remove titles
    cleaned = re.sub(r'\b(Mr|Mrs|Ms|Shri|Smt|Kumar|Kumari)\.?\s*', '', raw, flags=re.IGNORECASE)
    # Remove non-alpha except spaces
    cleaned = re.sub(r'[^A-Za-z\u0900-\u097F\s]', '', cleaned)
    return cleaned.strip() or None


# ── AADHAAR CARD ────────────────────────────────────────────────

def _extract_aadhaar(text: str) -> dict:
    # Aadhaar: 12 digits, possibly spaced as XXXX XXXX XXXX
    aadhaar_raw = _find(r'\b(\d{4}\s?\d{4}\s?\d{4})\b', text)
    aadhaar = aadhaar_raw.replace(' ', '') if aadhaar_raw else None

    # VID (Virtual ID) — 16 digits
    vid = _find(r'VID\s*[:\-]?\s*(\d{16})', text)

    # DOB
    dob_raw = _find(
        r'(?:DOB|Date\s+of\s+Birth|d\.o\.b|जन्म\s+तिथि)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})',
        text
    )
    # Also try year-only on card backs
    if not dob_raw:
        dob_raw = _find(r'(?:Year\s+of\s+Birth|YOB)[:\s]+(\d{4})', text)

    # Gender
    gender_raw = _find(r'\b(MALE|FEMALE|Male|Female|THIRD\s+GENDER|पुरुष|महिला)\b', text)
    gender_map = {
        'male': 'Male', 'female': 'Female', 'पुरुष': 'Male', 'महिला': 'Female',
        'third gender': 'Other',
    }
    gender = gender_map.get(gender_raw.lower(), gender_raw) if gender_raw else None

    # Name: look for lines with proper case names (2–4 words)
    # Skip common header words
    skip_words = {'government', 'india', 'aadhaar', 'unique', 'identification', 'authority', 'uidai'}
    name_candidates = re.findall(r'^([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){1,3})$', text, re.MULTILINE)
    name = None
    for cand in name_candidates:
        if not any(w in cand.lower() for w in skip_words) and len(cand) > 4:
            name = cand.strip()
            break

    # Father/husband name via S/O, D/O, W/O, C/O
    father = _find(r'(?:S/O|D/O|W/O|Son of|Daughter of|Wife of|C/O)\s*:?\s*([A-Z][a-zA-Z ]{3,40})', text)

    # Mobile (10 digits, may appear on Aadhaar)
    mobile = _find(r'(?:Mobile|Ph)[:\s]*(\d{10})\b', text)

    # Address: everything after "Address:" up to a blank line or Aadhaar number
    addr_block = _find(r'(?:Address|पता)\s*[:\-]\s*(.+?)(?:\n\n|\d{4}\s\d{4}\s\d{4})', text, flags=re.IGNORECASE | re.DOTALL)
    address = ' '.join(addr_block.split()) if addr_block else None

    return {
        "name":          _clean_name(name),
        "father_name":   _clean_name(father),
        "date_of_birth": _normalize_date(dob_raw),
        "gender":        gender,
        "aadhaar_number": aadhaar,
        "vid":           vid,
        "mobile_number": mobile,
        "address":       address,
    }


# ── BANK PASSBOOK ────────────────────────────────────────────────

def _extract_bank(text: str) -> dict:
    # Account number — various formats
    acc = _find(r'(?:A/C\s*No\.?|Account\s*(?:No\.?|Number))[:\s]*(\d[\d\s]{7,18}\d)', text)
    if acc:
        acc = acc.replace(' ', '')

    # IFSC — 11 chars, 4 alpha + 0 + 6 alphanum
    ifsc = _find(r'\b([A-Z]{4}0[A-Z0-9]{6})\b', text)

    # Bank name — line containing "Bank" as keyword
    bank_name = _find(
        r'^([\w\s&]+(?:Bank|BANK|बैंक)[\w\s&]*?)$', text, flags=re.MULTILINE | re.IGNORECASE
    )

    # Account holder name
    holder = _find(r'(?:Account\s+Holder|Name|A/C\s+Holder)[:\s]+([A-Za-z ]{4,50})', text)

    # CIF number
    cif = _find(r'CIF\s*(?:No\.?|Number)?[:\s]*(\d{9,12})', text)

    # Branch name
    branch = _find(r'(?:Branch|शाखा)[:\s]+([A-Za-z\d ]{3,50})', text)

    # MICR
    micr = _find(r'MICR\s*[:\s]*(\d{9})', text)

    # Mobile
    mobile = _find(r'(?:Mobile|Cell|Ph\.?)[:\s]*(\d{10})', text)

    # Email
    email = _find(r'([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', text)

    # Account open date
    open_date_raw = _find(r'(?:Account\s+Open(?:ing)?\s+Date|Date\s+of\s+Opening)[:\s]+('
                           r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', text)

    # Address block
    addr = _find(r'(?:Address|पत्ता)[:\s]+(.+?)(?:\n\n|IFSC|Branch)', text, flags=re.IGNORECASE | re.DOTALL)

    return {
        "bank_name":           bank_name,
        "account_holder_name": _clean_name(holder),
        "account_number":      acc,
        "ifsc_code":           ifsc,
        "cif_number":          cif,
        "branch_name":         branch.strip() if branch else None,
        "micr_code":           micr,
        "address":             ' '.join(addr.split()) if addr else None,
        "mobile_number":       mobile,
        "email":               email,
        "account_open_date":   _normalize_date(open_date_raw),
    }


# ── LAND RECORD (7/12 Satbara) ─────────────────────────────────

def _extract_land(text: str) -> dict:
    # Survey / Gat number
    survey = _find(r'(?:Survey|Gat|गट|खसरा)\s*(?:No\.?|Number)?[:\s]+([A-Za-z0-9/ ,]+?)(?:\n|,)', text)

    # Land area — acres or hectares
    area = _find(r'(\d+\.?\d*)\s*(?:Acre|acre|एकर|हे\.?|Hect|hectare|R\.|Are)', text)

    # Owner name
    owner = _find(r'(?:Owner|Khatedar|खातेदार|धारक|Account)\s*(?:Name|नाव)?[:\s]+([A-Za-z\u0900-\u097F ]{4,50})', text)

    # Village
    village = _find(r'(?:Village|ग्राम|गाव|Grampanchayat)[:\s]+([A-Za-z\u0900-\u097F ]{3,40})', text)

    # Taluka
    taluka = _find(r'(?:Taluka|तालुका|Tehsil)[:\s]+([A-Za-z\u0900-\u097F ]{3,40})', text)

    # District
    district = _find(r'(?:District|जिल्हा|Zilla)[:\s]+([A-Za-z\u0900-\u097F ]{3,40})', text)

    # Crop details — multiple crops may appear
    crops = _find_all(r'(?:Crop|पीक)[:\s]+([A-Za-z\u0900-\u097F, ]+?)(?:\n|$)', text)
    crop_str = ', '.join(crops) if crops else _find(r'(?:Kharif|Rabi|खरीफ|रब्बी)[:\s]+([A-Za-z\u0900-\u097F, ]+)', text)

    return {
        "survey_number":  survey,
        "owner_name":     _clean_name(owner),
        "land_area":      area,
        "village_name":   village,
        "taluka":         taluka,
        "district":       district,
        "crop_details":   crop_str,
    }


# ── INCOME CERTIFICATE ──────────────────────────────────────────

def _extract_income(text: str) -> dict:
    name   = _find(r'(?:Name|नाव|Shri|Smt\.?)[:\s]+([A-Za-z\u0900-\u097F .]{4,50})', text)
    father = _find(r'(?:Father|Mother|Husband|S/O|D/O|W/O|C/O)[:\s]+([A-Za-z\u0900-\u097F .]{4,50})', text)

    dob_raw = _find(r'(?:DOB|Date\s+of\s+Birth)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', text)

    # Issue date
    issue_raw = _find(r'(?:Issue\s+Date|Date\s+of\s+Issue|Issued\s+on)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', text)

    # Certificate number
    cert_no = _find(r'(?:Certificate\s+No\.?|Cert\.?\s*No\.?)[:\s]+([A-Z0-9/\-]+)', text)

    # Total annual income — highest priority number after "income"
    income_raw = _find(
        r'(?:Total\s+Annual\s+Income|Annual\s+Income|Total\s+Income|वार्षिक\s+उत्पन्न)[:\s]*[₹Rs\s]*([\d,]+)',
        text
    )
    total_income = _normalize_currency(income_raw)

    # Income sources table rows: Source | Amount | Remarks
    rows = []
    source_pattern = re.finditer(
        r'^(Agriculture|Business|Salary|Labour|Pension|Other[\w\s]*?)\s+([\d,₹Rs.]+)\s*(.*?)$',
        text, re.MULTILINE | re.IGNORECASE
    )
    for m in source_pattern:
        src, amt, rem = m.group(1), m.group(2), m.group(3)
        rows.append({
            "source":  src.strip(),
            "amount":  _normalize_currency(amt),
            "remarks": rem.strip() or None,
        })

    address = _find(r'(?:Address|पत्ता|Residing)[:\s]+(.+?)(?:\n\n|Certificate|$)', text, flags=re.IGNORECASE | re.DOTALL)

    return {
        "name":               _clean_name(name),
        "father_name":        _clean_name(father),
        "dob":                _normalize_date(dob_raw),
        "issue_date":         _normalize_date(issue_raw),
        "certificate_number": cert_no,
        "total_annual_income": total_income,
        "income_sources":     rows,     # → separate SQL table
        "address":            ' '.join(address.split()) if address else None,
    }


# ── ELECTRICITY BILL ────────────────────────────────────────────

def _extract_electricity(text: str) -> dict:
    consumer_no = _find(r'(?:Consumer\s*No\.?|CA\s*No\.?|Customer\s*No\.?)[:\s]*([A-Z0-9\-]{5,20})', text)
    consumer_name = _find(r'(?:Consumer\s*Name|Name)[:\s]+([A-Za-z ]{4,50})', text)
    meter_no = _find(r'(?:Meter\s*No\.?|MR\s*No\.?)[:\s]*([A-Z0-9\-]{4,20})', text)

    bill_date_raw = _find(r'(?:Bill\s*Date|Billing\s*Date)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', text)
    due_date_raw  = _find(r'(?:Due\s*Date|Last\s*Date)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', text)

    # Bill period: "01/01/2025 to 31/01/2025" or "January 2025"
    period = _find(r'(?:Bill\s*Period|Period)[:\s]+(.{5,40}?)(?:\n|$)', text)

    # Units consumed
    units = _find(r'(?:Units\s+Consumed|kWh\s+Consumed|Net\s+kWh)[:\s]*([\d,]+)', text)

    # Total amount
    total_raw = _find(r'(?:Total\s+Amount|Gross\s+Amount|Amount\s+Due)[:\s]*[₹Rs\s]*([\d,]+)', text)
    net_raw   = _find(r'(?:Net\s+Amount|Amount\s+Payable|Net\s+Payable)[:\s]*[₹Rs\s]*([\d,]+)', text)

    address = _find(r'(?:Address|Installation\s+Address|Site\s+Address)[:\s]+(.+?)(?:\n\n|Consumer|$)',
                    text, flags=re.IGNORECASE | re.DOTALL)

    billing_unit = _find(r'(?:Division|Billing\s*Unit|Zone)[:\s]+([A-Za-z\d ]{3,40})', text)

    return {
        "consumer_number":  consumer_no,
        "consumer_name":    consumer_name,
        "meter_number":     meter_no,
        "bill_date":        _normalize_date(bill_date_raw),
        "due_date":         _normalize_date(due_date_raw),
        "bill_period":      period,
        "units_consumed":   units,
        "total_amount":     _normalize_currency(total_raw),
        "net_amount_due":   _normalize_currency(net_raw),
        "billing_unit":     billing_unit,
        "address":          ' '.join(address.split()) if address else None,
    }


# ── CASTE CERTIFICATE ──────────────────────────────────────────

def _extract_caste(text: str) -> dict:
    name   = _find(r'(?:Name|Shri|Smt\.?|Kumar|Kumari)[:\s]+([A-Za-z\u0900-\u097F .]{4,50})', text)
    father = _find(r'(?:Father|S/O|Son\s+of|Daughter\s+of|D/O)[:\s]+([A-Za-z\u0900-\u097F .]{4,50})', text)

    # Caste category — look for official categories
    category_raw = _find(
        r'\b(Scheduled\s+Caste|SC|Scheduled\s+Tribe|ST|OBC|VJNT|NT|SBC|SEBC|EWS|General)\b', text
    )
    # Map to short codes
    cat_map = {
        'scheduled caste': 'SC', 'scheduled tribe': 'ST',
        'obc': 'OBC', 'vjnt': 'VJNT', 'nt': 'NT',
        'sbc': 'SBC', 'sebc': 'SEBC', 'ews': 'EWS',
    }
    category = cat_map.get(category_raw.lower().strip(), category_raw) if category_raw else None

    cert_no = _find(r'(?:Certificate\s+No\.?|Cert\s*No\.?)[:\s]+([A-Z0-9/\-]+)', text)

    issue_raw = _find(r'(?:Date\s+of\s+Issue|Issued\s+on|Issue\s+Date)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', text)

    authority = _find(r'(?:Issuing\s+Authority|Signed\s+by|Authority)[:\s]+([A-Za-z, ]{5,60})', text)
    place     = _find(r'(?:Place|At)[:\s]+([A-Za-z\u0900-\u097F ]{3,40})(?:\n|$)', text)

    address = _find(r'(?:Address|Resident\s+of|आवास)[:\s]+(.+?)(?:\n\n|$)', text, flags=re.IGNORECASE | re.DOTALL)

    return {
        "name":               _clean_name(name),
        "father_name":        _clean_name(father),
        "caste_category":     category,
        "certificate_number": cert_no,
        "issue_date":         _normalize_date(issue_raw),
        "issuing_authority":  authority,
        "place":              place,
        "address":            ' '.join(address.split()) if address else None,
    }


# ── IDENTITY DOCUMENT ──────────────────────────────────────────

def _extract_identity(text: str) -> dict:
    name   = _find(r'(?:Name|नाव)[:\s]+([A-Za-z\u0900-\u097F .]{4,50})', text)
    gender = _find(r'\b(MALE|FEMALE|Male|Female)\b', text)
    return {
        "name":          _clean_name(name),
        "gender":        gender,
        "face_detected": False,   # PaddleOCR doesn't detect faces; set by caller
    }


# ── Dispatcher ────────────────────────────────────────────────

_EXTRACTORS = {
    "AADHAAR_CARD":       _extract_aadhaar,
    "BANK_PASSBOOK":      _extract_bank,
    "LAND_RECORD":        _extract_land,
    "INCOME_CERTIFICATE": _extract_income,
    "ELECTRICITY_BILL":   _extract_electricity,
    "CASTE_CERTIFICATE":  _extract_caste,
    "IDENTITY_DOCUMENT":  _extract_identity,
    "OTHER": lambda t: {},
}


def extract_fields_from_text(text: str, doc_type: str) -> dict:
    extractor = _EXTRACTORS.get(doc_type, lambda t: {})
    return extractor(text)


# ═══════════════════════════════════════════════════════════════
#  STEP 5 — Confidence Scoring
# ═══════════════════════════════════════════════════════════════

# How many characters does a field need to be "confident"
_MIN_LENGTHS = {
    "aadhaar_number": 12, "account_number": 8, "ifsc_code": 11,
    "name": 3, "date_of_birth": 10, "survey_number": 2,
    "consumer_number": 5, "certificate_number": 4,
}

# Field importance weights per document type
_FIELD_WEIGHTS = {
    "AADHAAR_CARD":       {"aadhaar_number": 1.0, "name": 0.9, "date_of_birth": 0.8, "gender": 0.7},
    "BANK_PASSBOOK":      {"account_number": 1.0, "ifsc_code": 0.95, "bank_name": 0.8, "account_holder_name": 0.9},
    "LAND_RECORD":        {"survey_number": 1.0, "owner_name": 0.9, "land_area": 0.85, "village_name": 0.7},
    "INCOME_CERTIFICATE": {"total_annual_income": 1.0, "name": 0.9, "issue_date": 0.75},
    "ELECTRICITY_BILL":   {"consumer_number": 1.0, "consumer_name": 0.9, "total_amount": 0.85, "meter_number": 0.8},
    "CASTE_CERTIFICATE":  {"caste_category": 1.0, "name": 0.9, "certificate_number": 0.85},
    "IDENTITY_DOCUMENT":  {"name": 1.0, "gender": 0.8},
}


def score_field(key: str, value, ocr_word_results: List[dict] = None) -> float:
    """
    Score a single extracted field:
    - 0.0  → value is None
    - 0.5  → value exists but very short / uncertain
    - 0.8  → value looks complete
    - 0.95 → high-confidence (specific pattern matched, good length)
    """
    if value is None:
        return 0.0
    val_str = str(value).strip()
    if not val_str:
        return 0.0

    min_len = _MIN_LENGTHS.get(key, 2)
    if len(val_str) < min_len:
        return 0.4

    # Pattern-specific boosts
    if key == "aadhaar_number" and re.fullmatch(r'\d{12}', val_str):
        return 0.98
    if key == "ifsc_code" and re.fullmatch(r'[A-Z]{4}0[A-Z0-9]{6}', val_str):
        return 0.97
    if key == "account_number" and re.fullmatch(r'\d{9,18}', val_str):
        return 0.95
    if key in ("date_of_birth", "issue_date", "bill_date", "due_date", "account_open_date"):
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', val_str):
            return 0.92
    if key in ("total_amount", "net_amount_due", "total_annual_income") and isinstance(value, float):
        return 0.90
    if key == "caste_category" and val_str in {"SC", "ST", "OBC", "VJNT", "NT", "SBC", "EWS", "SEBC"}:
        return 0.95

    # General: longer = more confident, capped at 0.85
    length_score = min(0.85, 0.5 + len(val_str) * 0.02)
    return round(length_score, 3)


def compute_confidence(
    doc_type: str,
    extracted: dict,
    ocr_avg_confidence: float = 0.0,
    word_results: List[dict] = None
) -> dict:
    """
    Compute per-field and overall confidence scores.
    Returns: { "overall": float, "fields": {field: score} }
    """
    weights = _FIELD_WEIGHTS.get(doc_type, {})
    field_scores = {}

    for key, value in extracted.items():
        if key == "income_sources":  # List — score separately
            field_scores[key] = 0.85 if value else 0.0
            continue
        field_scores[key] = score_field(key, value, word_results)

    # Calculate weighted overall score using important fields
    if weights:
        numerator   = sum(weights.get(k, 0.5) * field_scores.get(k, 0.0) for k in weights)
        denominator = sum(weights.values())
        field_weighted = numerator / denominator if denominator > 0 else 0.0
    else:
        vals = list(field_scores.values())
        field_weighted = sum(vals) / len(vals) if vals else 0.0

    # Blend with PaddleOCR average confidence
    if ocr_avg_confidence > 0:
        overall = round(0.7 * field_weighted + 0.3 * ocr_avg_confidence, 4)
    else:
        overall = round(field_weighted, 4)

    return {
        "overall": min(1.0, overall),
        "fields": field_scores,
    }


# ═══════════════════════════════════════════════════════════════
#  STEP 6 — Main Pipeline Function
# ═══════════════════════════════════════════════════════════════

def process_document(
    filepath: str,
    doc_type_hint: Optional[str] = None,
    raw_text_override: Optional[str] = None,
) -> dict:
    """
    Full AI Document Intelligence Pipeline.

    Args:
        filepath: Absolute path to uploaded file (JPG/PNG/PDF)
        doc_type_hint: DB doc_type string (e.g. 'aadhaar', 'satbara')
        raw_text_override: If provided, skip PaddleOCR and use this text

    Returns SQL-ready dict:
    {
        "document_type": str,
        "extracted_data": { ... flat fields ... },
        "confidence_score": { "overall": float, "fields": {...} },
        "raw_text": str,
        "ocr_mode": "paddle" | "regex_only",
        "ocr_avg_confidence": float,
        "word_count": int,
    }
    """
    # 1. Extract raw text via PaddleOCR
    if raw_text_override:
        raw_text    = raw_text_override
        word_results = []
        ocr_avg_conf = 0.0
        ocr_mode     = "text_override"
    elif PADDLE_AVAILABLE and filepath and os.path.exists(filepath):
        raw_text, word_results = extract_raw_text_paddle(filepath)
        ocr_avg_conf = get_average_ocr_confidence(word_results)
        ocr_mode     = "paddle"
    else:
        raw_text     = ""
        word_results = []
        ocr_avg_conf = 0.0
        ocr_mode     = "simulation"

    # 2. Clean text
    cleaned_text = clean_ocr_text(raw_text) if raw_text else ""

    # 3. Detect document type
    doc_type = detect_document_type(cleaned_text, hint=doc_type_hint)

    # 4. Extract fields
    extracted = extract_fields_from_text(cleaned_text, doc_type) if cleaned_text else {}

    # 5. Compute confidence
    confidence = compute_confidence(doc_type, extracted, ocr_avg_conf, word_results)

    return {
        "document_type":      doc_type,
        "extracted_data":     extracted,
        "confidence_score":   confidence,
        "raw_text":           raw_text,
        "cleaned_text":       cleaned_text,
        "ocr_mode":           ocr_mode,
        "ocr_avg_confidence": ocr_avg_conf,
        "word_count":         len(word_results),
    }


def process_text_only(
    ocr_text: str,
    doc_type_hint: Optional[str] = None,
) -> dict:
    """
    Process raw OCR text (no file) through the AI pipeline.
    Use this when PaddleOCR has already run externally or text is pasted directly.
    Returns the same SQL-ready structure as process_document().
    """
    return process_document(
        filepath=None,
        doc_type_hint=doc_type_hint,
        raw_text_override=ocr_text,
    )


# ═══════════════════════════════════════════════════════════════
#  STEP 7 — DB Field Mapping (for ExtractedDocumentData model)
# ═══════════════════════════════════════════════════════════════

def map_to_db_fields(doc_type: str, extracted: dict) -> dict:
    """
    Map extracted data fields → ExtractedDocumentData model columns.
    Returns a flat dict ready for setattr() on the SQLAlchemy model.
    """
    d = extracted
    base = {}

    if doc_type == "AADHAAR_CARD":
        base = {
            "extracted_name":    d.get("name"),
            "extracted_aadhaar": d.get("aadhaar_number"),
            "extracted_dob":     d.get("date_of_birth"),
            "extracted_gender":  d.get("gender"),
            "extracted_address": d.get("address"),
        }
    elif doc_type == "BANK_PASSBOOK":
        base = {
            "extracted_name":     d.get("account_holder_name"),
            "extracted_account":  d.get("account_number"),
            "extracted_ifsc":     d.get("ifsc_code"),
            "extracted_bank_name":d.get("bank_name"),
            "extracted_address":  d.get("address"),
        }
    elif doc_type == "LAND_RECORD":
        base = {
            "extracted_name":       d.get("owner_name"),
            "extracted_survey_no":  d.get("survey_number"),
            "extracted_land_area":  d.get("land_area"),
            "extracted_village":    d.get("village_name"),
            "extracted_taluka":     d.get("taluka"),
        }
    elif doc_type == "INCOME_CERTIFICATE":
        base = {
            "extracted_name":   d.get("name"),
            "extracted_income": str(d.get("total_annual_income")) if d.get("total_annual_income") else None,
        }
    elif doc_type == "ELECTRICITY_BILL":
        base = {
            "extracted_consumer": d.get("consumer_name"),
            "extracted_address":  d.get("address"),
        }
    elif doc_type == "CASTE_CERTIFICATE":
        base = {
            "extracted_name":     d.get("name"),
            "extracted_category": d.get("caste_category"),
        }

    return base


# ═══════════════════════════════════════════════════════════════
#  UTILITY — Fuzzy Comparison (re-exported for ocr.py)
# ═══════════════════════════════════════════════════════════════

def fuzzy_match(a: Optional[str], b: Optional[str]) -> float:
    """Return 0–100 similarity score."""
    if not a or not b:
        return 0.0
    a, b = str(a).strip().lower(), str(b).strip().lower()
    if a == b:
        return 100.0
    if FUZZ_AVAILABLE:
        return float(_fuzz.token_set_ratio(a, b))
    # Basic fallback
    common = sum(1 for c in a if c in b)
    return round(100 * common / max(len(a), len(b), 1), 1)
