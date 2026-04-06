"""
ocr_engine.py  (v3 — AI Document Intelligence)
───────────────────────────────────────────────
Now delegates to ai_document_intelligence.py for:
  • PaddleOCR extraction with pre-processing
  • Document type detection
  • Entity extraction + confidence scoring
  • Fuzzy comparison engine
  • AI decision engine

Legacy functions preserved for backward compatibility.
"""

import re
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

# ── Import the new AI pipeline ───────────────────────────────────
from ai_document_intelligence import (
    process_document as _ai_process,
    process_text_only as _ai_process_text,
    map_to_db_fields,
    fuzzy_match,
    PADDLE_AVAILABLE,
    detect_document_type,
    clean_ocr_text,
    compute_confidence,
    _EXTRACTORS,
)


# ═══════════════════════════════════════════════════════════════
#  PUBLIC API — used by routers/ocr.py
# ═══════════════════════════════════════════════════════════════

def extract_fields(filepath: str, doc_type: str) -> dict:
    """
    Run full AI pipeline on a file.
    Returns:
      {
        "raw_text": str,
        "status": "done" | "simulated",
        "fields": { extracted fields dict },
        "document_type": str,
        "confidence": { "overall": float, "fields": {} },
        "ocr_avg_confidence": float,
        "word_count": int,
      }
    """
    result = _ai_process(filepath, doc_type_hint=doc_type)

    status = 'done' if result['ocr_mode'] == 'paddle' else 'simulated'

    return {
        "raw_text":          result["raw_text"],
        "status":            status,
        "fields":            result["extracted_data"],
        "document_type":     result["document_type"],
        "confidence":        result["confidence_score"],
        "ocr_avg_confidence":result["ocr_avg_confidence"],
        "word_count":        result["word_count"],
        # DB-mapped fields (directly usable for ExtractedDocumentData)
        "db_fields":         map_to_db_fields(result["document_type"], result["extracted_data"]),
    }


def extract_text_from_raw(ocr_text: str, doc_type_hint: Optional[str] = None) -> dict:
    """
    Process raw OCR text (no file) through the AI pipeline.
    Useful for the /ocr/analyze-text endpoint.
    """
    result = _ai_process_text(ocr_text, doc_type_hint=doc_type_hint)
    return {
        "raw_text":      result["raw_text"],
        "cleaned_text":  result["cleaned_text"],
        "status":        "done",
        "fields":        result["extracted_data"],
        "document_type": result["document_type"],
        "confidence":    result["confidence_score"],
        "db_fields":     map_to_db_fields(result["document_type"], result["extracted_data"]),
    }


# ═══════════════════════════════════════════════════════════════
#  FUZZY COMPARISON ENGINE  (unchanged interface)
# ═══════════════════════════════════════════════════════════════

FIELD_WEIGHTS = {
    'aadhaar':  1.00,
    'name':     0.90,
    'land':     0.85,
    'bank':     0.85,
    'address':  0.75,
    'income':   0.70,
    'dob':      0.70,
}


def _fuzzy_score(a: Optional[str], b: Optional[str]) -> float:
    return fuzzy_match(a, b)


def compare_with_form(ocr_data: dict, form_data: dict) -> dict:
    """
    Compare OCR-extracted fields with farmer's profile form data.
    ocr_data  = merged dict from all docs
    form_data = FarmerProfile dict from DB
    Returns detailed score breakdown + mismatch fields.
    """
    scores = {}
    mismatches = []
    comparisons = []

    def compare(label: str, ocr_val, form_val, weight_key: str):
        sc = _fuzzy_score(ocr_val, form_val)
        scores[weight_key] = max(scores.get(weight_key, 0.0), sc)
        comparisons.append({
            'field':      label,
            'ocr':        ocr_val  or '—',
            'form':       form_val or '—',
            'score':      round(sc, 1),
            'match':      sc >= 80,
            'weight':     FIELD_WEIGHTS.get(weight_key, 0.7),
        })
        if sc < 80 and (ocr_val or form_val):
            mismatches.append(label)

    compare('Full Name',       ocr_data.get('name'),       form_data.get('full_name'),    'name')
    compare('Aadhaar Number',  ocr_data.get('aadhaar'),    form_data.get('aadhaar'),      'aadhaar')
    compare('Bank Account',    ocr_data.get('account'),    form_data.get('bank_account'), 'bank')
    compare('IFSC Code',       ocr_data.get('ifsc'),       form_data.get('ifsc'),         'bank')
    compare('Survey/Gat No.',  ocr_data.get('survey_no'),  form_data.get('gat_number'),   'land')
    compare('Land Area',       ocr_data.get('land_area'),  form_data.get('land_area'),    'land')
    compare('Village',         ocr_data.get('village'),    form_data.get('village'),      'address')
    compare('Taluka',          ocr_data.get('taluka'),     form_data.get('taluka'),       'address')
    compare('Date of Birth',   ocr_data.get('dob'),        form_data.get('dob'),          'dob')
    compare('Annual Income',   ocr_data.get('income'),     form_data.get('income_bracket'),'income')

    # Weighted overall score
    filled = [c for c in comparisons if c['ocr'] != '—' or c['form'] != '—']
    if filled:
        total_weight = sum(c['weight'] for c in filled)
        weighted_sum = sum(c['score'] * c['weight'] for c in filled)
        overall = round(weighted_sum / total_weight, 1) if total_weight else 0.0
    else:
        overall = 0.0

    return {
        'overall_score': overall,
        'comparisons':   comparisons,
        'mismatches':    mismatches,
        'field_scores':  scores,
    }


# ═══════════════════════════════════════════════════════════════
#  AI DECISION ENGINE  (unchanged interface)
# ═══════════════════════════════════════════════════════════════

def calculate_decision(comparison_result: dict, doc_count: int = 0,
                       duplicate_aadhaar: bool = False) -> dict:
    score        = comparison_result['overall_score']
    mismatches   = comparison_result['mismatches']
    field_scores = comparison_result['field_scores']

    positive, risks = [], []

    aadhaar_sc = field_scores.get('aadhaar', 0)
    if aadhaar_sc >= 95:
        positive.append("Aadhaar number matches perfectly")
    elif aadhaar_sc >= 80:
        positive.append("Aadhaar number matches with high confidence")
    else:
        risks.append("Aadhaar number mismatch or not found in documents")

    name_sc = field_scores.get('name', 0)
    if name_sc >= 90:
        positive.append("Name matches across all documents")
    elif name_sc >= 75:
        positive.append("Name partially matches (possible spelling variation)")
    else:
        risks.append("Name mismatch detected")

    bank_sc = field_scores.get('bank', 0)
    if bank_sc >= 85:
        positive.append("Bank account details verified")
    elif bank_sc < 60:
        risks.append("Bank account details could not be verified")

    land_sc = field_scores.get('land', 0)
    if land_sc >= 85:
        positive.append("Land records match application data")
    elif land_sc < 60:
        risks.append("Land details mismatch or incomplete")

    if doc_count >= 4:
        positive.append(f"All {doc_count} required documents uploaded")
    elif doc_count >= 2:
        positive.append(f"{doc_count} documents uploaded and verified")
    else:
        risks.append("Insufficient documents uploaded")

    if duplicate_aadhaar:
        risks.append("⚠️ Duplicate Aadhaar — possible multiple applications")

    if mismatches:
        risks.append(f"Field mismatches: {', '.join(mismatches[:3])}")

    fraud_risk   = min(100.0, max(0.0, round(100 - score + (20 if duplicate_aadhaar else 0), 1)))
    doc_bonus    = min(doc_count * 2, 10)
    confidence   = min(100.0, round(score * 0.9 + doc_bonus, 1))
    approval_prob = max(0.0, min(100.0, round(score * 0.85 - (30 if duplicate_aadhaar else 0), 1)))

    if score >= 90 and not duplicate_aadhaar:
        decision = 'auto_approved'
    elif score >= 70:
        decision = 'manual_review'
    else:
        decision = 'flagged'

    return {
        'decision':            decision,
        'overall_score':       score,
        'fraud_risk':          fraud_risk,
        'confidence':          confidence,
        'approval_probability':approval_prob,
        'positive_factors':    positive,
        'risk_factors':        risks,
        'duplicate_aadhaar':   duplicate_aadhaar,
    }


# ═══════════════════════════════════════════════════════════════
#  SIMULATION FALLBACK  (used when Paddle unavailable)
# ═══════════════════════════════════════════════════════════════

def simulate_ocr_from_profile(profile: dict, doc_type: str) -> dict:
    import random

    def jitter(val: Optional[str], chance: float = 0.1) -> Optional[str]:
        if not val:
            return None
        if random.random() < chance:
            chars = list(val)
            idx = random.randint(0, len(chars) - 1)
            chars[idx] = random.choice('abcdefghijklmnopqrstuvwxyz')
            return ''.join(chars)
        return val

    return {
        'name':      jitter(profile.get('full_name'), 0.05),
        'aadhaar':   profile.get('aadhaar'),
        'dob':       profile.get('dob'),
        'address':   jitter(profile.get('full_address'), 0.1),
        'survey_no': jitter(profile.get('gat_number'), 0.08),
        'land_area': jitter(profile.get('land_area'), 0.08),
        'village':   jitter(profile.get('village'), 0.05),
        'taluka':    jitter(profile.get('taluka'), 0.05),
        'account':   profile.get('bank_account'),
        'ifsc':      profile.get('ifsc'),
        'bank_name': profile.get('bank_name'),
        'income':    profile.get('income_bracket'),
        'category':  profile.get('caste_category'),
    }
