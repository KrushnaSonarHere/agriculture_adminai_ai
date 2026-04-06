"""
routers/grievance_ai.py
──────────────────────────────────────────────────
POST /grievances/analyse          → NLP analysis of grievance text
POST /grievances/transcribe       → Backend STT (whisper optional, mock default)

The /analyse endpoint tags:
  - category   : payment_delay | doc_error | scheme_rejection | officer_misconduct | other
  - priority   : high | medium | low
  - summary    : one-line AI summary
  - entities   : { scheme, amount, district, date, app_number }
  - actions    : suggested resolution steps
  - language   : detected language (mr/hi/en)

Uses simple keyword-based NLP (no ML dependency needed).
Can be upgraded to IndicBERT/spaCy later without changing the contract.
"""

import re
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict

router = APIRouter(prefix="/grievances", tags=["Grievance AI"])


# ─────────────────────────────────────────────────────────────
# NLP Analysis
# ─────────────────────────────────────────────────────────────

class AnalyseRequest(BaseModel):
    text:     str
    language: Optional[str] = "auto"  # mr | hi | en | auto

class AnalyseResponse(BaseModel):
    category:    str
    priority:    str
    summary:     str
    language:    str
    confidence:  float
    entities:    Dict
    actions:     List[str]
    ai_tag:      str


CATEGORY_KEYWORDS = {
    "payment_delay": [
        # English
        "payment", "installment", "credit", "disburse", "money", "fund", "amount", "transfer",
        "bank", "balance", "deposit", "not received", "pending payment",
        # Hindi
        "भुगतान", "किस्त", "पैसे", "रुपये", "खाते", "जमा", "नहीं आए", "धनराशि",
        # Marathi
        "पैसे", "रक्कम", "हप्ता", "खात्यात", "जमा", "मिळाले नाहीत",
    ],
    "doc_error": [
        "document", "certificate", "aadhaar", "satbara", "7/12", "8-a", "record", "wrong",
        "mismatch", "incorrect", "error in", "update", "correction",
        "दस्तावेज़", "प्रमाण", "आधार", "गलत", "सुधार",
        "कागदपत्र", "चुकीचे", "दुरुस्ती",
    ],
    "scheme_rejection": [
        "reject", "denied", "not eligible", "refused", "disqualified", "cancelled application",
        "अस्वीकार", "रद्द", "अपात्र", "नामंजूर",
        "नाकारला", "अपात्र", "रद्द",
    ],
    "officer_misconduct": [
        "bribe", "corrupt", "demand money", "officer", "patwari", "harassment", "misconduct",
        "रिश्वत", "भ्रष्टाचार", "अधिकारी", "उत्पीड़न",
        "लाच", "भ्रष्टाचार", "अधिकारी",
    ],
    "irrigation": [
        "water", "irrigation", "drip", "sprinkler", "pump", "canal", "drought",
        "पानी", "सिंचाई", "पंप", "नहर",
        "पाणी", "सिंचन", "पंप",
    ],
    "insurance": [
        "insurance", "fasal bima", "crop loss", "damage", "claim",
        "बीमा", "फसल बीमा", "नुकसान",
        "विमा", "पीक", "नुकसान",
    ],
}

PRIORITY_SIGNALS = {
    "high": [
        "urgent", "emergency", "critical", "immediately", "dying", "starving", "3 month",
        "6 month", "year", "long time", "many months",
        "तुरंत", "आपातकाल", "महीनों", "सालों",
        "तातडीचे", "महिने", "वर्षे",
    ],
    "low": [
        "minor", "small", "slight", "little",
        "छोटा", "थोड़ा",
        "किरकोळ",
    ],
}

ENTITY_PATTERNS = {
    "app_number": r'\b(KID|APP|KIF|GRV|KCC)-?\d{4}-?\d{2,6}\b',
    "amount":     r'₹\s*[\d,]+|(?:rs\.?|inr)\s*[\d,]+|\d+,\d{3}|\d+\s*(?:lakh|thousand)',
    "district":   r'\b(nashik|pune|mumbai|aurangabad|nagpur|kolhapur|solapur|amravati|नाशिक|पुणे|मुंबई|औरंगाबाद|नागपूर)\b',
    "date":       r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{4}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',
}

SCHEME_NAMES = [
    "pm kisan", "pmksy", "fasal bima", "kisan credit", "soil health",
    "पीएम किसान", "फसल बीमा", "किसान क्रेडिट",
    "पीक विमा", "पीएम किसान",
]

ACTION_TEMPLATES = {
    "payment_delay":       ["Verify bank account linkage with Aadhaar", "Check PM Kisan beneficiary status on pmkisan.gov.in", "Contact district agriculture officer", "Raise complaint with PM Kisan helpline: 155261"],
    "doc_error":           ["Visit nearest CSC/tehsil office for correction", "Upload corrected documents via portal", "Get document re-verified by Patwari"],
    "scheme_rejection":    ["Request rejection reason in writing", "File first appeal with district officer within 30 days", "Consult Krishi Sahayak for eligibility re-check"],
    "officer_misconduct":  ["File complaint with District Collector", "Contact anti-corruption helpline: 1064", "Document all evidence (dates, amounts, witnesses)"],
    "irrigation":          ["Contact MWRRA helpline", "Apply for PMKSY irrigation subsidy", "Report to district irrigation office"],
    "insurance":           ["File claim with insurance company within 72 hours of crop loss", "Contact PMFBY district coordinator", "Submit crop loss certificate from Patwari"],
    "other":               ["Contact district agriculture office", "Visit nearest Krishi Vigyan Kendra", "Use KisanSetu helpline: 1800-180-1551"],
}

LANGUAGE_MARKERS = {
    "mr": ["मी", "माझा", "माझी", "आहे", "आहेत", "नाही", "करा", "मला", "मिळाले"],
    "hi": ["मेरा", "मेरी", "है", "हैं", "नहीं", "करें", "मुझे", "मिले"],
}

def detect_language(text: str) -> str:
    text_lower = text.lower()
    mr_score = sum(1 for w in LANGUAGE_MARKERS["mr"] if w in text)
    hi_score = sum(1 for w in LANGUAGE_MARKERS["hi"] if w in text)
    if mr_score == 0 and hi_score == 0:
        return "en"
    return "mr" if mr_score >= hi_score else "hi"

def classify_category(text: str) -> tuple[str, float]:
    text_lower = text.lower()
    scores = {cat: 0 for cat in CATEGORY_KEYWORDS}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                scores[cat] += 1
    best = max(scores, key=scores.get)
    total = sum(scores.values())
    confidence = round(scores[best] / max(total, 1), 2)
    return (best if scores[best] > 0 else "other"), min(0.95, confidence + 0.3)

def classify_priority(text: str, category: str) -> str:
    text_lower = text.lower()
    if category == "officer_misconduct":
        return "high"
    for sig in PRIORITY_SIGNALS["high"]:
        if sig in text_lower:
            return "high"
    for sig in PRIORITY_SIGNALS["low"]:
        if sig in text_lower:
            return "low"
    return "medium"

def extract_entities(text: str) -> dict:
    entities = {}
    for key, pattern in ENTITY_PATTERNS.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            entities[key] = match.group(0)
    # Detect scheme
    text_lower = text.lower()
    for scheme in SCHEME_NAMES:
        if scheme in text_lower:
            entities["scheme"] = scheme.title()
            break
    return entities

def generate_summary(text: str, category: str, language: str) -> str:
    # Build a short summary from first sentence + category tag
    first = text.split('.')[0].strip()
    if len(first) > 120:
        first = first[:120] + '…'
    labels = {
        "payment_delay":      "Payment Delay",
        "doc_error":          "Document Error",
        "scheme_rejection":   "Scheme Rejection",
        "officer_misconduct": "Officer Misconduct",
        "irrigation":         "Irrigation Issue",
        "insurance":          "Insurance Claim",
        "other":              "General Complaint",
    }
    label = labels.get(category, "Complaint")
    return f"[{label}] {first}"

def ai_tag(priority: str, category: str) -> str:
    icons = {"high": "🔴", "medium": "🟡", "low": "🟢"}
    return f"{icons.get(priority, '⚪')} {priority.upper()} PRIORITY — Auto-routed to district officer"


# ── POST /grievances/analyse ──────────────────────────────────
@router.post("/analyse", response_model=AnalyseResponse)
def analyse_grievance(req: AnalyseRequest):
    text     = (req.text or "").strip()
    if len(text) < 5:
        raise HTTPException(status_code=400, detail="Text too short for analysis")

    lang       = detect_language(text) if req.language == "auto" else req.language
    category, conf = classify_category(text)
    priority   = classify_priority(text, category)
    entities   = extract_entities(text)
    summary    = generate_summary(text, category, lang)
    actions    = ACTION_TEMPLATES.get(category, ACTION_TEMPLATES["other"])

    return AnalyseResponse(
        category   = category,
        priority   = priority,
        summary    = summary,
        language   = lang,
        confidence = conf,
        entities   = entities,
        actions    = actions,
        ai_tag     = ai_tag(priority, category),
    )


# ── POST /grievances/transcribe (fallback STT) ────────────────
@router.post("/transcribe")
async def transcribe_audio(
    file:     UploadFile = File(...),
    language: str        = Form("hi"),
):
    """
    Backend STT endpoint.
    If WHISPER_MODEL_PATH env var is set → uses local Whisper.
    Otherwise returns empty so client falls back to browser STT / mock.
    """
    content = await file.read()

    whisper_path = os.environ.get("WHISPER_MODEL_PATH", "")
    if whisper_path:
        try:
            import whisper, tempfile, pathlib  # type: ignore
            model = whisper.load_model("small", download_root=whisper_path)
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            result = model.transcribe(tmp_path, language=language, fp16=False)
            pathlib.Path(tmp_path).unlink(missing_ok=True)
            return {"transcript": result["text"].strip(), "method": "whisper"}
        except Exception as e:
            return {"transcript": "", "method": "error", "detail": str(e)}

    return {"transcript": "", "method": "unavailable"}
