"""
routers/verification.py
───────────────────────
Verification Engine Router — ties together PaddleOCR + AI Scoring

Endpoints:
  POST /verify/{application_id}          → trigger full verification pipeline
  GET  /verify/{application_id}/status   → get current verification status
  GET  /verify/{application_id}/report   → full comparison report for admin UI
  GET  /verify/pending                   → all applications awaiting review
  GET  /verify/stats                     → dashboard analytics
  POST /verify/{application_id}/decide   → admin override decision

Pipeline flow:
  1. Fetch farmer form data from Farmer DB
  2. Fetch document file_url from Farmer DB
  3. Run PaddleOCR on each document → store in ocr_documents
  4. Parse extracted fields → store in ocr_extracted_fields
  5. Compare farmer values vs OCR values → store in field_comparisons
  6. Compute weighted AI score → store in ai_scores
  7. Save consolidated result → verification_summary
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_farmer_db, get_admin_db
import farmer_models as FM
import admin_models  as AM

router = APIRouter(prefix="/verify", tags=["Verification Engine"])


# ─────────────────────────────────────────────────────────────
# Field weights  (Aadhaar → highest, others → lower)
# ─────────────────────────────────────────────────────────────
FIELD_WEIGHTS: dict[str, float] = {
    "aadhaar_number":      1.00,
    "name":                0.90,
    "land_area":           0.85,
    "account_number":      0.85,
    "annual_income":       0.70,
    "address":             0.65,
    "dob":                 0.70,
    "ifsc_code":           0.80,
    "seven_twelve_number": 0.75,
    "survey_number":       0.75,
    "district":            0.60,
    "bank_name":           0.55,
}
DEFAULT_WEIGHT = 0.60

# Decision thresholds
THRESHOLD_APPROVE = 90.0
THRESHOLD_REVIEW  = 70.0


# ─────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────
class DecidePayload(BaseModel):
    admin_id:   int
    admin_name: str
    decision:   str        # approve / reject / flag
    remarks:    Optional[str] = None


class FieldReport(BaseModel):
    field_name:       str
    farmer_value:     Optional[str]
    ocr_value:        Optional[str]
    match_percentage: float
    status:           str
    weight:           float


class VerificationReport(BaseModel):
    application_id:   int
    farmer_name:      Optional[str]
    overall_score:    float
    fraud_risk:       float
    recommendation:   str
    positive_factors: list
    risk_factors:     list
    field_reports:    List[FieldReport]
    verified_at:      Optional[datetime]


# ─────────────────────────────────────────────────────────────
# Fuzzy matching helper (uses rapidfuzz if available else simple)
# ─────────────────────────────────────────────────────────────
def _fuzzy_ratio(a: str, b: str) -> float:
    """Return 0-100 fuzzy similarity between two strings."""
    if not a or not b:
        return 0.0
    a, b = str(a).strip().lower(), str(b).strip().lower()
    if a == b:
        return 100.0
    try:
        from rapidfuzz import fuzz
        return fuzz.ratio(a, b)
    except ImportError:
        # Fallback: simple character overlap
        common = sum((min(a.count(c), b.count(c)) for c in set(a)))
        return round(200.0 * common / (len(a) + len(b)), 2)


# ─────────────────────────────────────────────────────────────
# OCR helper — wired to ai_document_intelligence pipeline
# ─────────────────────────────────────────────────────────────

import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.dirname(__file__)))

def _run_ocr(file_url: str, doc_type: str) -> tuple[dict[str, str], str, float, list]:
    """
    Run the full AI Document Intelligence pipeline on a file.

    Returns:
        (field_map, raw_text, ocr_avg_confidence, word_results)

    field_map keys match FIELD_WEIGHTS in this router:
        name, aadhaar_number, dob, annual_income, address,
        district, account_number, ifsc_code, bank_name,
        survey_number, land_area, seven_twelve_number
    """
    try:
        from ai_document_intelligence import process_document, PADDLE_AVAILABLE

        # file_url is stored as /uploads/... — resolve to absolute
        backend_dir = _os.path.dirname(_os.path.dirname(__file__))
        if file_url.startswith("/uploads/"):
            abs_path = _os.path.join(backend_dir, "uploads", file_url[len("/uploads/"):])
        elif file_url.startswith("uploads/"):
            abs_path = _os.path.join(backend_dir, file_url)
        else:
            abs_path = file_url

        if not _os.path.exists(abs_path):
            import logging
            logging.getLogger(__name__).warning(
                f"[OCR] File not found on disk: {abs_path} (url={file_url})"
            )
            return {}, "", 0.0, []

        result = process_document(abs_path, doc_type_hint=doc_type)
        raw_data    = result.get("extracted_data", {})
        raw_text    = result.get("raw_text", "")
        avg_conf    = result.get("ocr_avg_confidence", 0.0)
        word_results= result.get("word_results", [])

        # ── Map AI pipeline field names → verification FIELD_WEIGHTS keys ──
        field_map: dict[str, str] = {}

        # Identity
        for key in ("name", "owner_name", "account_holder_name", "consumer_name"):
            if raw_data.get(key):
                field_map.setdefault("name", str(raw_data[key]))

        if raw_data.get("aadhaar_number"):
            field_map["aadhaar_number"] = str(raw_data["aadhaar_number"])
        if raw_data.get("date_of_birth") or raw_data.get("dob"):
            field_map["dob"] = str(raw_data.get("date_of_birth") or raw_data.get("dob"))
        if raw_data.get("total_annual_income"):
            field_map["annual_income"] = str(raw_data["total_annual_income"])

        # Address
        if raw_data.get("address"):
            field_map["address"] = str(raw_data["address"])
        if raw_data.get("district"):
            field_map["district"] = str(raw_data["district"])

        # Bank
        if raw_data.get("account_number"):
            field_map["account_number"] = str(raw_data["account_number"])
        if raw_data.get("ifsc_code"):
            field_map["ifsc_code"] = str(raw_data["ifsc_code"])
        if raw_data.get("bank_name"):
            field_map["bank_name"] = str(raw_data["bank_name"])

        # Land
        if raw_data.get("survey_number"):
            field_map["survey_number"] = str(raw_data["survey_number"])
        if raw_data.get("land_area"):
            field_map["land_area"] = str(raw_data["land_area"])
        if raw_data.get("seven_twelve_number"):
            field_map["seven_twelve_number"] = str(raw_data["seven_twelve_number"])

        import logging
        mode = "PaddleOCR" if PADDLE_AVAILABLE else "simulated"
        logging.getLogger(__name__).info(
            f"[OCR] {mode} extracted {len(field_map)} fields from {doc_type}"
        )
        return field_map, raw_text, avg_conf, word_results

    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"[OCR] Pipeline error for {file_url}: {exc}", exc_info=True)
        return {}, str(exc), 0.0, []


# ─────────────────────────────────────────────────────────────
# Core pipeline
# ─────────────────────────────────────────────────────────────
def _compute_decision(score: float) -> AM.FinalDecisionEnum:
    if score >= THRESHOLD_APPROVE:
        return AM.FinalDecisionEnum.approve
    if score >= THRESHOLD_REVIEW:
        return AM.FinalDecisionEnum.review
    return AM.FinalDecisionEnum.reject


def _run_pipeline(application_id: int, fdb: Session, adb: Session):
    """Full verification pipeline — runs synchronously (call in background task)."""

    # ── 1. Fetch application + farmer from Farmer DB ──────────
    app: Optional[FM.FarmerApplication] = fdb.query(FM.FarmerApplication).filter(
        FM.FarmerApplication.id == application_id
    ).first()
    if not app:
        return

    farmer: Optional[FM.Farmer] = fdb.query(FM.Farmer).filter(
        FM.Farmer.id == app.farmer_id
    ).first()
    address: Optional[FM.FarmerAddress] = fdb.query(FM.FarmerAddress).filter(
        FM.FarmerAddress.farmer_id == app.farmer_id
    ).first()
    bank: Optional[FM.FarmerBankDetails] = fdb.query(FM.FarmerBankDetails).filter(
        FM.FarmerBankDetails.farmer_id == app.farmer_id
    ).first()
    land_list: list[FM.FarmerLandDetails] = fdb.query(FM.FarmerLandDetails).filter(
        FM.FarmerLandDetails.farmer_id == app.farmer_id
    ).all()

    # Build farmer value map (canonical field → value)
    farmer_values: dict[str, str] = {}
    if farmer:
        farmer_values.update({
            "name":           farmer.full_name or "",
            "aadhaar_number": farmer.aadhaar_number or "",
            "dob":            farmer.dob or "",
            "annual_income":  str(farmer.annual_income or ""),
        })
    if address:
        farmer_values.update({
            "district": address.district or "",
            "address":  address.full_address or "",
        })
    if bank:
        farmer_values.update({
            "account_number": bank.account_number or "",
            "ifsc_code":      bank.ifsc_code or "",
            "bank_name":      bank.bank_name or "",
        })
    if land_list:
        first = land_list[0]
        farmer_values.update({
            "survey_number":       first.survey_number or "",
            "land_area":           str(first.land_area or ""),
            "seven_twelve_number": first.seven_twelve_number or "",
        })

    # ── 2. Fetch documents and run OCR ────────────────────────
    docs: list[FM.ApplicationDocument] = fdb.query(FM.ApplicationDocument).filter(
        FM.ApplicationDocument.application_id == application_id
    ).all()

    all_extracted: dict[str, str] = {}   # merged across all docs

    for doc in docs:
        # Check if OCR already done
        existing_ocr = adb.query(AM.OcrDocument).filter(
            AM.OcrDocument.application_id == application_id,
            AM.OcrDocument.document_id    == doc.id,
        ).first()
        if existing_ocr and existing_ocr.ocr_status == "done":
            # Re-use existing extracted fields
            for ef in existing_ocr.extracted_fields:
                if ef.field_value:
                    all_extracted[ef.field_name] = ef.field_value
            continue

        # Run OCR
        ocr_rec = existing_ocr or AM.OcrDocument(
            application_id=application_id,
            document_id=doc.id,
            document_type=doc.document_type.value if hasattr(doc.document_type, "value") else doc.document_type,
            file_url=doc.file_url,
            ocr_status=AM.OcrStatusEnum.running,
        )
        if not existing_ocr:
            adb.add(ocr_rec)
            adb.flush()

        try:
            extracted, raw_text, avg_conf, word_results = _run_ocr(
                doc.file_url, ocr_rec.document_type
            )
            ocr_rec.raw_text       = raw_text or "\n".join(f"{k}: {v}" for k, v in extracted.items())
            ocr_rec.ocr_status     = AM.OcrStatusEnum.done if extracted else AM.OcrStatusEnum.simulated
            ocr_rec.confidence_avg = round(avg_conf * 100, 2) if avg_conf <= 1 else round(avg_conf, 2)
            ocr_rec.processed_at   = datetime.utcnow()

            # Store per-field extracted values in ocr_extracted_fields
            for fname, fvalue in extracted.items():
                ef = AM.OcrExtractedField(
                    ocr_document_id=ocr_rec.id,
                    application_id=application_id,
                    document_type=ocr_rec.document_type,
                    field_name=fname,
                    field_value=fvalue,
                    confidence=round(avg_conf * 100, 2) if avg_conf <= 1 else round(avg_conf, 2),
                    normalized_value=fvalue,  # already normalized by ai_document_intelligence
                )
                adb.add(ef)
                all_extracted[fname] = fvalue

        except Exception as exc:
            ocr_rec.ocr_status = "failed"
            ocr_rec.raw_text   = str(exc)

    adb.flush()

    # ── 3. Compare farmer values vs OCR values ────────────────
    # Delete old comparisons for this application
    adb.query(AM.FieldComparison).filter(
        AM.FieldComparison.application_id == application_id
    ).delete()

    comparison_records: list[AM.FieldComparison] = []
    all_fields = set(farmer_values.keys()) | set(all_extracted.keys())

    for fname in all_fields:
        fval  = farmer_values.get(fname, "")
        oval  = all_extracted.get(fname, "")
        pct   = _fuzzy_ratio(fval, oval) if fval and oval else 0.0
        weight= FIELD_WEIGHTS.get(fname, DEFAULT_WEIGHT)

        if pct >= 85:
            status = AM.MatchStatusEnum.match
        elif pct >= 50:
            status = AM.MatchStatusEnum.partial
        elif oval:
            status = AM.MatchStatusEnum.mismatch
        else:
            status = AM.MatchStatusEnum.not_found

        comp = AM.FieldComparison(
            application_id=application_id,
            field_name=str(fname),
            farmer_value=str(fval) if fval else None,
            ocr_value=str(oval) if oval else None,
            match_percentage=round(float(pct), 2),
            status=status,
            field_weight=float(weight),
        )
        adb.add(comp)
        comparison_records.append(comp)

    try:
        adb.flush()
        print("  [OK] FieldComparison flush successful")
    except Exception as e:
        print(f"  [CRITICAL] FieldComparison flush failed: {e}")
        adb.rollback()
        return

    # ── 4. Compute AI score ───────────────────────────────────
    total_w  = sum(FIELD_WEIGHTS.get(c.field_name, DEFAULT_WEIGHT) for c in comparison_records if c.ocr_value)
    if total_w == 0:
        total_w = 1.0

    weighted_sum = sum(
        c.match_percentage * FIELD_WEIGHTS.get(c.field_name, DEFAULT_WEIGHT)
        for c in comparison_records if c.ocr_value
    )
    overall = round(weighted_sum / total_w, 2) if total_w else 0.0

    # Individual dimension scores
    def _dim(field: str) -> float:
        for c in comparison_records:
            if c.field_name == field:
                return c.match_percentage
        return 0.0

    aadhaar_s = _dim("aadhaar_number")
    name_s    = _dim("name")
    land_s    = _dim("land_area")
    bank_s    = _dim("account_number")
    income_s  = _dim("annual_income")
    address_s = _dim("address")

    fraud_risk = round(max(0, 100 - overall), 2)
    approval_p = round(overall, 2)
    confidence = round(sum(c.match_percentage for c in comparison_records) / max(len(comparison_records), 1), 2)

    pos = [c.field_name for c in comparison_records if c.status == "match"]
    neg = [c.field_name for c in comparison_records if c.status in ("mismatch", "not_found")]

    recommendation = _compute_decision(overall)

    # Upsert ai_scores
    existing_score = adb.query(AM.AiScore).filter(AM.AiScore.application_id == application_id).first()
    score_rec = existing_score or AM.AiScore(application_id=application_id)
    score_rec.aadhaar_score        = aadhaar_s
    score_rec.name_score           = name_s
    score_rec.land_score           = land_s
    score_rec.bank_score           = bank_s
    score_rec.income_score         = income_s
    score_rec.address_score        = address_s
    score_rec.overall_score        = overall
    score_rec.approval_probability = approval_p
    score_rec.fraud_risk           = fraud_risk
    score_rec.confidence_score     = confidence
    score_rec.positive_factors     = pos
    score_rec.risk_factors         = neg
    score_rec.recommendation       = recommendation
    score_rec.updated_at           = datetime.utcnow()
    if not existing_score:
        adb.add(score_rec)
    adb.flush()

    # ── 5. Verification summary ───────────────────────────────
    existing_summary = adb.query(AM.VerificationSummary).filter(
        AM.VerificationSummary.application_id == application_id
    ).first()
    vs = existing_summary or AM.VerificationSummary(application_id=application_id)
    vs.farmer_id         = app.farmer_id
    vs.farmer_name       = farmer.full_name if farmer else None
    vs.total_fields      = len(comparison_records)
    vs.matched_fields    = sum(1 for c in comparison_records if c.status == "match")
    vs.mismatched_fields = sum(1 for c in comparison_records if c.status == "mismatch")
    vs.not_found_fields  = sum(1 for c in comparison_records if c.status == "not_found")
    vs.overall_score     = overall
    vs.fraud_risk        = fraud_risk
    vs.final_decision    = recommendation
    vs.decision_reason   = (
        f"Weighted score {overall:.1f}/100 — "
        f"{vs.matched_fields} fields matched, {vs.mismatched_fields} mismatched"
    )
    vs.updated_at        = datetime.utcnow()
    if not existing_summary:
        adb.add(vs)

    adb.commit()


# ─────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────

@router.post("/{application_id}", summary="Trigger verification pipeline")
def trigger_verification(
    application_id: int,
    background_tasks: BackgroundTasks,
    fdb: Session = Depends(get_farmer_db),
    adb: Session = Depends(get_admin_db),
):
    """
    Start the verification pipeline for an application.
    Runs OCR → extraction → comparison → AI scoring in the background.
    """
    # Validate application exists
    app = fdb.query(FM.FarmerApplication).filter(FM.FarmerApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found in Farmer DB")

    background_tasks.add_task(_run_pipeline, application_id, fdb, adb)
    return {"message": f"Verification pipeline started for application {application_id}", "application_id": application_id}


@router.get("/{application_id}/status", summary="Get verification status")
def get_status(
    application_id: int,
    adb: Session = Depends(get_admin_db),
):
    summary = adb.query(AM.VerificationSummary).filter(
        AM.VerificationSummary.application_id == application_id
    ).first()
    if not summary:
        return {"application_id": application_id, "status": "not_started"}
    return {
        "application_id":   application_id,
        "status":           "complete",
        "final_decision":   summary.final_decision,
        "overall_score":    summary.overall_score,
        "fraud_risk":       summary.fraud_risk,
        "admin_override":   summary.admin_override,
        "verified_at":      summary.verified_at,
    }


@router.get("/{application_id}/report", response_model=VerificationReport, summary="Full admin comparison report")
def get_report(
    application_id: int,
    adb: Session = Depends(get_admin_db),
):
    summary = adb.query(AM.VerificationSummary).filter(
        AM.VerificationSummary.application_id == application_id
    ).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Verification not yet run for this application")

    score = adb.query(AM.AiScore).filter(AM.AiScore.application_id == application_id).first()
    comps = adb.query(AM.FieldComparison).filter(AM.FieldComparison.application_id == application_id).all()

    return VerificationReport(
        application_id   =application_id,
        farmer_name      =summary.farmer_name,
        overall_score    =summary.overall_score,
        fraud_risk       =summary.fraud_risk,
        recommendation   =summary.final_decision,
        positive_factors =score.positive_factors or [] if score else [],
        risk_factors     =score.risk_factors or []     if score else [],
        verified_at      =summary.verified_at,
        field_reports    =[
            FieldReport(
                field_name      =c.field_name,
                farmer_value    =c.farmer_value,
                ocr_value       =c.ocr_value,
                match_percentage=c.match_percentage,
                status          =c.status,
                weight          =c.field_weight,
            )
            for c in sorted(comps, key=lambda x: -x.field_weight)
        ],
    )


@router.get("/pending", summary="All applications pending manual review")
def get_pending(
    limit: int = 50,
    adb: Session = Depends(get_admin_db),
):
    rows = (
        adb.query(AM.VerificationSummary)
           .filter(AM.VerificationSummary.final_decision == "review",
                   AM.VerificationSummary.admin_override == False)  # noqa: E712
           .order_by(AM.VerificationSummary.fraud_risk.desc())
           .limit(limit)
           .all()
    )
    return [
        {
            "application_id":  r.application_id,
            "farmer_name":     r.farmer_name,
            "overall_score":   r.overall_score,
            "fraud_risk":      r.fraud_risk,
            "matched_fields":  r.matched_fields,
            "total_fields":    r.total_fields,
            "verified_at":     r.verified_at,
        }
        for r in rows
    ]


@router.get("/stats", summary="Dashboard analytics")
def get_stats(adb: Session = Depends(get_admin_db)):
    """Returns aggregate stats for the admin dashboard."""
    from sqlalchemy import func as sqlfunc

    total       = adb.query(AM.VerificationSummary).count()
    approved    = adb.query(AM.VerificationSummary).filter(AM.VerificationSummary.final_decision == "approve").count()
    review      = adb.query(AM.VerificationSummary).filter(AM.VerificationSummary.final_decision == "review").count()
    rejected    = adb.query(AM.VerificationSummary).filter(AM.VerificationSummary.final_decision == "reject").count()
    high_risk   = adb.query(AM.VerificationSummary).filter(AM.VerificationSummary.fraud_risk >= 70).count()
    avg_row     = adb.query(sqlfunc.avg(AM.VerificationSummary.overall_score)).scalar()

    return {
        "total_verified":    total,
        "ai_approved":       approved,
        "ai_review":         review,
        "ai_rejected":       rejected,
        "high_risk_count":   high_risk,
        "avg_overall_score": round(float(avg_row or 0), 2),
    }


@router.post("/{application_id}/decide", summary="Admin override decision")
def admin_decide(
    application_id: int,
    payload: DecidePayload,
    fdb: Session = Depends(get_farmer_db),
    adb: Session = Depends(get_admin_db),
):
    """Admin manually overrides the AI recommendation."""
    valid_decisions = {"approve", "reject", "flag"}
    if payload.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"decision must be one of {valid_decisions}")

    # Update verification_summary
    summary = adb.query(AM.VerificationSummary).filter(
        AM.VerificationSummary.application_id == application_id
    ).first()
    if summary:
        summary.admin_override = True
        summary.admin_decision = payload.decision if payload.decision != "flag" else "review"
        summary.override_reason = payload.remarks
        summary.updated_at = datetime.utcnow()

    # Log admin action
    action = AM.AdminAction(
        admin_id=payload.admin_id,
        admin_name=payload.admin_name,
        application_id=application_id,
        action=payload.decision,
        remarks=payload.remarks,
    )
    adb.add(action)

    # Sync status back to Farmer DB
    app_obj = fdb.query(FM.FarmerApplication).filter(FM.FarmerApplication.id == application_id).first()
    if app_obj:
        app_obj.application_status = (
            "approved" if payload.decision == "approve"
            else "rejected" if payload.decision == "reject"
            else "under_review"
        )
        fdb.commit()

    adb.commit()
    return {"message": f"Decision '{payload.decision}' recorded for application {application_id}"}
