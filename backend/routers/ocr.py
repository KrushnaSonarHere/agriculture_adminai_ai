"""
routers/ocr.py
──────────────
Endpoints:
  POST /ocr/process/{doc_id}        → Run PaddleOCR on one document, store AI-extracted data
  POST /ocr/analyze-text            → Process raw OCR text through AI pipeline (master prompt)
  POST /ocr/analyze/{user_id}       → Run full AI comparison for a farmer, store decision
  GET  /ocr/result/{user_id}        → Get OCR + comparison results per farmer
  GET  /ocr/decision/{user_id}      → Get latest AI decision for a farmer
  PUT  /ocr/decision/{decision_id}  → Admin override (approve/reject/flag)
  GET  /ocr/all-decisions           → All AI decisions (admin list view)
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
import models
from ocr_engine import (
    extract_fields, extract_text_from_raw,
    compare_with_form, calculate_decision,
    simulate_ocr_from_profile, PADDLE_AVAILABLE
)


router = APIRouter(prefix="/ocr", tags=["OCR & AI Verification"])

UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


# ── Helpers ───────────────────────────────────────────────────────

def _profile_to_dict(user: models.FarmerUser) -> dict:
    """Flatten FarmerUser + FarmerProfile into a single dict for comparison."""
    p = user.profile
    base = {
        'full_name':     user.full_name,
        'district':      user.district,
        'state':         user.state,
    }
    if p:
        base.update({
            'aadhaar':       p.aadhaar,
            'dob':           p.dob,
            'bank_account':  p.bank_account,
            'ifsc':          p.ifsc,
            'bank_name':     p.bank_name,
            'gat_number':    p.gat_number,
            'land_area':     p.land_area,
            'village':       p.village,
            'taluka':        p.taluka,
            'full_address':  p.full_address,
            'income_bracket':p.income_bracket,
            'caste_category':p.caste_category,
        })
    return base


def _merge_ocr_fields(extracted_rows) -> dict:
    """Merge OCR fields from multiple documents into one composite dict."""
    merged = {}
    for row in extracted_rows:
        for field in ['extracted_name','extracted_aadhaar','extracted_dob',
                      'extracted_gender','extracted_address','extracted_survey_no',
                      'extracted_land_area','extracted_village','extracted_taluka',
                      'extracted_account','extracted_ifsc','extracted_bank_name',
                      'extracted_income','extracted_category','extracted_consumer']:
            val = getattr(row, field, None)
            short = field.replace('extracted_', '')
            # Rename to match compare_with_form keys
            key_map = {
                'name': 'name', 'aadhaar': 'aadhaar', 'dob': 'dob',
                'gender': 'gender', 'address': 'address',
                'survey_no': 'survey_no', 'land_area': 'land_area',
                'village': 'village', 'taluka': 'taluka',
                'account': 'account', 'ifsc': 'ifsc',
                'bank_name': 'bank_name', 'income': 'income',
                'category': 'category', 'consumer': 'consumer',
            }
            k = key_map.get(short, short)
            if val and not merged.get(k):
                merged[k] = val
    return merged


# ── Background OCR task (uses AI pipeline) ───────────────────────────

def _run_ocr_for_doc(doc_id: int, db_session_factory):
    """Run PaddleOCR + AI Intelligence on a document. Called in background."""
    db = db_session_factory()
    try:
        doc = db.query(models.FarmerDocument).filter(models.FarmerDocument.id == doc_id).first()
        if not doc:
            return

        filepath = os.path.join(UPLOAD_ROOT, doc.filepath)
        user     = db.query(models.FarmerUser).filter(models.FarmerUser.id == doc.user_id).first()

        # ── Run AI pipeline ──
        if os.path.exists(filepath) and PADDLE_AVAILABLE:
            result    = extract_fields(filepath, doc.doc_type)
            db_fields = result.get('db_fields', {})
            ocr_status = result['status']
            raw_text   = result['raw_text']
        else:
            # Simulate from profile when PaddleOCR not available
            profile_dict = _profile_to_dict(user) if user else {}
            simulated    = simulate_ocr_from_profile(profile_dict, doc.doc_type)
            # Map simulated fields
            db_fields = {
                'extracted_name':    simulated.get('name'),
                'extracted_aadhaar': simulated.get('aadhaar'),
                'extracted_dob':     simulated.get('dob'),
                'extracted_address': simulated.get('address'),
                'extracted_survey_no': simulated.get('survey_no'),
                'extracted_land_area': simulated.get('land_area'),
                'extracted_village': simulated.get('village'),
                'extracted_taluka':  simulated.get('taluka'),
                'extracted_account': simulated.get('account'),
                'extracted_ifsc':    simulated.get('ifsc'),
                'extracted_bank_name': simulated.get('bank_name'),
                'extracted_income':  simulated.get('income'),
                'extracted_category':simulated.get('category'),
            }
            ocr_status = 'simulated'
            raw_text   = ''

        # ── Upsert ExtractedDocumentData ──
        existing = db.query(models.ExtractedDocumentData).filter(
            models.ExtractedDocumentData.doc_id == doc_id
        ).first()

        common = {
            'ocr_status':   ocr_status,
            'processed_at': datetime.now(),
            'raw_text':     raw_text,
            **db_fields,
        }

        if existing:
            for k, v in common.items():
                setattr(existing, k, v)
        else:
            ext = models.ExtractedDocumentData(
                doc_id   = doc_id,
                user_id  = doc.user_id,
                doc_type = doc.doc_type,
                **common,
            )
            db.add(ext)

        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Background OCR failed for doc {doc_id}: {e}")
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════
#  NEW ENDPOINT — POST /ocr/analyze-text  (Master Prompt Pipeline)
# ═══════════════════════════════════════════════════════════════════════

class AnalyzeTextPayload(BaseModel):
    ocr_text:       str
    doc_type_hint:  Optional[str] = None   # 'aadhaar' | 'satbara' | 'bank' | ...
    user_id:        Optional[int] = None   # if set, also save to DB


@router.post("/analyze-text", summary="Process raw OCR text through AI pipeline (Master Prompt)")
def analyze_ocr_text(payload: AnalyzeTextPayload, db: Session = Depends(get_db)):
    """
    Run the full AI Document Intelligence pipeline on raw OCR text.
    Input: pasted PaddleOCR output or any raw text from a document.
    Output: SQL-ready JSON with extracted fields, confidence scores.
    """
    if not payload.ocr_text.strip():
        raise HTTPException(status_code=400, detail="ocr_text cannot be empty")

    result = extract_text_from_raw(payload.ocr_text, doc_type_hint=payload.doc_type_hint)

    response = {
        "document_type":    result["document_type"],
        "extracted_data":   result["fields"],
        "confidence_score": result["confidence"],
        "ocr_mode":         result["status"],
        "db_ready_fields":  result["db_fields"],
    }

    # Optionally save to DB if user_id provided
    if payload.user_id:
        existing = (
            db.query(models.ExtractedDocumentData)
            .filter(
                models.ExtractedDocumentData.user_id == payload.user_id,
                models.ExtractedDocumentData.doc_type == (payload.doc_type_hint or 'other'),
            ).first()
        )
        db_fields = result.get('db_fields', {})
        common = {
            'ocr_status':   'done',
            'processed_at': datetime.now(),
            'raw_text':     payload.ocr_text,
            **db_fields,
        }
        if existing:
            for k, v in common.items():
                setattr(existing, k, v)
        else:
            ext = models.ExtractedDocumentData(
                user_id  = payload.user_id,
                doc_type = payload.doc_type_hint or 'other',
                doc_id   = 0,   # no file
                **common,
            )
            db.add(ext)
        db.commit()
        response["saved_to_db"] = True

    return response



# ═══════════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

# ── POST /ocr/process/{doc_id} ─────────────────────────────────────────
@router.post("/process/{doc_id}", summary="Run OCR on a single document")
async def process_document(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    doc = db.query(models.FarmerDocument).filter(models.FarmerDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    from database import SessionLocal
    background_tasks.add_task(_run_ocr_for_doc, doc_id, SessionLocal)
    return {"message": f"OCR processing started for document {doc_id}", "doc_type": doc.doc_type}


# ── POST /ocr/analyze/{user_id} ────────────────────────────────────────
@router.post("/analyze/{user_id}", summary="Run full AI comparison for a farmer")
def analyze_farmer(user_id: int, application_id: Optional[int] = None, db: Session = Depends(get_db)):
    user = db.query(models.FarmerUser).filter(models.FarmerUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Farmer not found")

    # Get all OCR extractions for this user
    extractions = db.query(models.ExtractedDocumentData).filter(
        models.ExtractedDocumentData.user_id == user_id
    ).all()

    form_data = _profile_to_dict(user)

    # Merge OCR data from all docs or simulate from profile
    if extractions:
        ocr_data = _merge_ocr_fields(extractions)
    else:
        ocr_data = simulate_ocr_from_profile(form_data, 'aadhaar')

    # Fill missing OCR fields with simulation if partial
    for key in ['name', 'aadhaar', 'account', 'ifsc', 'survey_no', 'land_area']:
        if not ocr_data.get(key):
            simulated = simulate_ocr_from_profile(form_data, 'aadhaar')
            ocr_data[key] = simulated.get(key)

    # Check for duplicate Aadhaar across OTHER farmers
    aadhaar = ocr_data.get('aadhaar') or form_data.get('aadhaar', '')
    dup = False
    if aadhaar:
        existing_profile = (
            db.query(models.FarmerProfile)
            .filter(
                models.FarmerProfile.aadhaar == aadhaar,
                models.FarmerProfile.user_id != user_id,
            ).first()
        )
        dup = existing_profile is not None

    # Compare
    comparison = compare_with_form(ocr_data, form_data)

    # AI decision
    doc_count = db.query(models.FarmerDocument).filter(
        models.FarmerDocument.user_id == user_id
    ).count()
    decision_data = calculate_decision(comparison, doc_count=doc_count, duplicate_aadhaar=dup)

    # Save / update AIDecision
    ai_dec = db.query(models.AIDecision).filter(
        models.AIDecision.user_id == user_id
    ).first()

    def to_pipe(lst): return '|'.join(lst) if lst else ''

    dec_kwargs = {
        'overall_score':       decision_data['overall_score'],
        'aadhaar_score':       comparison['field_scores'].get('aadhaar', 0),
        'name_score':          comparison['field_scores'].get('name', 0),
        'land_score':          comparison['field_scores'].get('land', 0),
        'bank_score':          comparison['field_scores'].get('bank', 0),
        'address_score':       comparison['field_scores'].get('address', 0),
        'income_score':        comparison['field_scores'].get('income', 0),
        'decision':            decision_data['decision'],
        'fraud_risk':          decision_data['fraud_risk'],
        'confidence':          decision_data['confidence'],
        'approval_probability':decision_data['approval_probability'],
        'positive_factors':    to_pipe(decision_data['positive_factors']),
        'risk_factors':        to_pipe(decision_data['risk_factors']),
        'duplicate_aadhaar':   dup,
        'mismatch_fields':     to_pipe(comparison['mismatches']),
        'application_id':      application_id,
    }

    if ai_dec:
        for k, v in dec_kwargs.items():
            setattr(ai_dec, k, v)
    else:
        ai_dec = models.AIDecision(user_id=user_id, **dec_kwargs)
        db.add(ai_dec)
    db.commit()
    db.refresh(ai_dec)

    return {
        'decision_id':          ai_dec.id,
        'overall_score':        ai_dec.overall_score,
        'decision':             ai_dec.decision,
        'fraud_risk':           ai_dec.fraud_risk,
        'confidence':           ai_dec.confidence,
        'approval_probability': ai_dec.approval_probability,
        'positive_factors':     decision_data['positive_factors'],
        'risk_factors':         decision_data['risk_factors'],
        'duplicate_aadhaar':    dup,
        'mismatches':           comparison['mismatches'],
        'comparisons':          comparison['comparisons'],
        'ocr_mode':             'real' if PADDLE_AVAILABLE else 'simulated',
    }


# ── GET /ocr/result/{user_id} ──────────────────────────────────────────
@router.get("/result/{user_id}", summary="Get OCR extraction results for all farmer docs")
def get_ocr_results(user_id: int, db: Session = Depends(get_db)):
    rows = db.query(models.ExtractedDocumentData).filter(
        models.ExtractedDocumentData.user_id == user_id
    ).all()

    return [
        {
            'id':           r.id,
            'doc_id':       r.doc_id,
            'doc_type':     r.doc_type,
            'ocr_status':   r.ocr_status,
            'processed_at': str(r.processed_at) if r.processed_at else None,
            'fields': {
                'name':       r.extracted_name,
                'aadhaar':    r.extracted_aadhaar,
                'dob':        r.extracted_dob,
                'gender':     r.extracted_gender,
                'address':    r.extracted_address,
                'survey_no':  r.extracted_survey_no,
                'land_area':  r.extracted_land_area,
                'village':    r.extracted_village,
                'taluka':     r.extracted_taluka,
                'account':    r.extracted_account,
                'ifsc':       r.extracted_ifsc,
                'bank_name':  r.extracted_bank_name,
                'income':     r.extracted_income,
                'category':   r.extracted_category,
                'consumer':   r.extracted_consumer,
            },
        }
        for r in rows
    ]


# ── GET /ocr/decision/{user_id} ────────────────────────────────────────
@router.get("/decision/{user_id}", summary="Get latest AI decision for a farmer")
def get_decision(user_id: int, db: Session = Depends(get_db)):
    dec = db.query(models.AIDecision).filter(
        models.AIDecision.user_id == user_id
    ).order_by(models.AIDecision.created_at.desc()).first()

    if not dec:
        raise HTTPException(status_code=404, detail="No AI decision found. Run /ocr/analyze first.")

    return {
        'id':                   dec.id,
        'user_id':              dec.user_id,
        'overall_score':        dec.overall_score,
        'decision':             dec.decision,
        'fraud_risk':           dec.fraud_risk,
        'confidence':           dec.confidence,
        'approval_probability': dec.approval_probability,
        'positive_factors':     dec.positive_factors.split('|') if dec.positive_factors else [],
        'risk_factors':         dec.risk_factors.split('|') if dec.risk_factors else [],
        'duplicate_aadhaar':    dec.duplicate_aadhaar,
        'mismatch_fields':      dec.mismatch_fields.split('|') if dec.mismatch_fields else [],
        'admin_decision':       dec.admin_decision,
        'admin_remarks':        dec.admin_remarks,
        'created_at':           str(dec.created_at),
    }


# ── GET /ocr/all-decisions ──────────────────────────────────────────────
@router.get("/all-decisions", summary="All AI decisions for admin list view")
def list_all_decisions(db: Session = Depends(get_db)):
    decisions = (
        db.query(models.AIDecision, models.FarmerUser)
        .join(models.FarmerUser, models.AIDecision.user_id == models.FarmerUser.id)
        .order_by(models.AIDecision.created_at.desc())
        .all()
    )
    result = []
    for dec, user in decisions:
        result.append({
            'id':                   dec.id,
            'user_id':              dec.user_id,
            'farmer_name':          user.full_name,
            'farmer_id':            user.farmer_id,
            'district':             user.district,
            'overall_score':        dec.overall_score,
            'decision':             dec.decision,
            'fraud_risk':           dec.fraud_risk,
            'confidence':           dec.confidence,
            'approval_probability': dec.approval_probability,
            'duplicate_aadhaar':    dec.duplicate_aadhaar,
            'mismatch_fields':      dec.mismatch_fields.split('|') if dec.mismatch_fields else [],
            'admin_decision':       dec.admin_decision,
            'created_at':           str(dec.created_at),
        })
    return result


# ── PUT /ocr/decision/{decision_id} ────────────────────────────────────
class AdminDecisionPayload(BaseModel):
    admin_decision: str   # approved / rejected / flagged
    admin_remarks:  Optional[str] = None
    decided_by:     Optional[str] = "Admin"

@router.put("/decision/{decision_id}", summary="Admin override: approve/reject/flag")
def admin_override(decision_id: int, payload: AdminDecisionPayload, db: Session = Depends(get_db)):
    dec = db.query(models.AIDecision).filter(models.AIDecision.id == decision_id).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Decision not found")

    dec.admin_decision = payload.admin_decision
    dec.admin_remarks  = payload.admin_remarks
    dec.decided_by     = payload.decided_by
    dec.decided_at     = datetime.now()

    # Also update linked application status if any
    if dec.application_id:
        app = db.query(models.Application).filter(
            models.Application.id == dec.application_id
        ).first()
        if app:
            status_map = {
                'approved': 'Approved',
                'rejected': 'Rejected',
                'flagged':  'Flagged',
            }
            app.status = status_map.get(payload.admin_decision, 'Processing')
            app.admin_remarks = payload.admin_remarks

    db.commit()
    return {"message": f"Decision updated to '{payload.admin_decision}'", "id": dec.id}
