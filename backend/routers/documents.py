"""
routers/documents.py
─────────────────────────────────────────────────
POST /documents/upload/{user_id}      → upload a doc (auto-triggers OCR)
GET  /documents/{user_id}             → farmer's full document vault
GET  /documents/smart-check/{user_id} → smart availability check for a scheme
DELETE /documents/{doc_id}            → remove a document
"""

import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta, timezone

from database import get_db, SessionLocal
import models

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# ─────────────────────────────────────────────────────────────
# Core intelligence: Scheme → Required document types
# ─────────────────────────────────────────────────────────────
SCHEME_DOCS = {
    "_default": [
        {"type": "aadhaar",  "label": "Aadhaar Card",      "expires_months": None, "critical": True},
        {"type": "bank",     "label": "Bank Passbook",      "expires_months": None, "critical": True},
        {"type": "photo",    "label": "Passport Photo",     "expires_months": 60,   "critical": True},
    ],
    "pm-kisan": [
        {"type": "aadhaar",  "label": "Aadhaar Card",       "expires_months": None, "critical": True},
        {"type": "satbara",  "label": "7/12 Land Record",   "expires_months": 12,   "critical": True},
        {"type": "eight_a",  "label": "8-A Certificate",    "expires_months": 12,   "critical": True},
        {"type": "bank",     "label": "Bank Passbook",      "expires_months": None, "critical": True},
        {"type": "photo",    "label": "Passport Photo",     "expires_months": 60,   "critical": False},
    ],
    "fasal-bima": [
        {"type": "aadhaar",  "label": "Aadhaar Card",       "expires_months": None, "critical": True},
        {"type": "satbara",  "label": "7/12 Land Record",   "expires_months": 12,   "critical": True},
        {"type": "bank",     "label": "Bank Passbook",      "expires_months": None, "critical": True},
        {"type": "income",   "label": "Income Certificate", "expires_months": 12,   "critical": True},
        {"type": "caste",    "label": "Caste Certificate",  "expires_months": None, "critical": False},
        {"type": "photo",    "label": "Passport Photo",     "expires_months": 60,   "critical": False},
    ],
    "pmksy": [
        {"type": "aadhaar",      "label": "Aadhaar Card",       "expires_months": None, "critical": True},
        {"type": "satbara",      "label": "7/12 Land Record",   "expires_months": 12,   "critical": True},
        {"type": "eight_a",      "label": "8-A Certificate",    "expires_months": 12,   "critical": True},
        {"type": "bank",         "label": "Bank Passbook",      "expires_months": None, "critical": True},
        {"type": "electricity",  "label": "Electricity Bill",   "expires_months": 3,    "critical": False},
    ],
    "kisan-credit": [
        {"type": "aadhaar",  "label": "Aadhaar Card",       "expires_months": None, "critical": True},
        {"type": "satbara",  "label": "7/12 Land Record",   "expires_months": 12,   "critical": True},
        {"type": "bank",     "label": "Bank Passbook",      "expires_months": None, "critical": True},
        {"type": "income",   "label": "Income Certificate", "expires_months": 12,   "critical": True},
        {"type": "photo",    "label": "Passport Photo",     "expires_months": 60,   "critical": False},
    ],
    "soil-health": [
        {"type": "aadhaar",  "label": "Aadhaar Card",       "expires_months": None, "critical": True},
        {"type": "satbara",  "label": "7/12 Land Record",   "expires_months": 12,   "critical": True},
        {"type": "photo",    "label": "Passport Photo",     "expires_months": 60,   "critical": False},
    ],
}

SCHEME_ALIASES = {
    "pm kisan": "pm-kisan",   "pm-kisan": "pm-kisan",   "pmkisan": "pm-kisan",
    "fasal bima": "fasal-bima", "fasal-bima": "fasal-bima", "crop insurance": "fasal-bima",
    "pmksy": "pmksy",         "irrigation": "pmksy",    "micro irrigation": "pmksy",
    "kisan credit": "kisan-credit", "kcc": "kisan-credit",
    "soil health": "soil-health",   "shc":  "soil-health",
}

def _resolve_scheme_key(scheme_name: str) -> str:
    name_lower = (scheme_name or "").lower()
    for alias, key in SCHEME_ALIASES.items():
        if alias in name_lower:
            return key
    return "_default"


def _build_doc_status(doc, req: dict, db: Session, now: datetime) -> dict:
    if doc is None:
        return {**req, "status": "missing", "uploaded_at": None, "url": None,
                "doc_id": None, "filename": None, "file_size": None,
                "ocr_verified": False, "ocr_status": "not_run"}

    expires_months = req.get("expires_months")
    expired = False
    if expires_months and doc.uploaded_at:
        try:
            # Handle both offset-aware and offset-naive uploaded_at
            uploaded = doc.uploaded_at
            expiry   = uploaded + timedelta(days=expires_months * 30)
            now_cmp  = datetime.now(timezone.utc) if expiry.tzinfo else datetime.utcnow()
            if now_cmp > expiry:
                expired = True
        except Exception:
            pass

    # OCR verification status lives in admin_db — skip here, default False
    return {
        **req,
        "status":       "expired" if expired else "available",
        "uploaded_at":  doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "url":          f"/uploads/{doc.filepath}",
        "doc_id":       doc.id,
        "filename":     doc.filename,
        "file_size":    doc.file_size,
        "ocr_verified": False,
        "ocr_status":   "not_run",
    }


# ── POST — Upload a document ─────────────────────────────────
@router.post("/upload/{user_id}", status_code=201)
async def upload_document(
    user_id:          int,
    background_tasks: BackgroundTasks,
    doc_type:         str        = Form(...),
    file:             UploadFile = File(...),
    db:               Session   = Depends(get_db),
):
    user = db.query(models.FarmerUser).filter(models.FarmerUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Farmer not found")

    allowed = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}
    if (file.content_type or "") not in allowed:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, PDF allowed")

    user_dir = os.path.join(UPLOAD_ROOT, str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{doc_type}_{timestamp}_{file.filename}"
    dest_path = os.path.join(user_dir, safe_name)

    try:
        content   = await file.read()
        file_size = len(content)
        if file_size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large — max 10 MB")
        with open(dest_path, "wb") as f:
            f.write(content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File save failed: {e}")

    # Replace existing record for same doc_type (one-per-type policy)
    existing = (
        db.query(models.FarmerDocument)
        .filter(models.FarmerDocument.user_id == user_id,
                models.FarmerDocument.doc_type == doc_type)
        .first()
    )
    if existing:
        old = os.path.join(UPLOAD_ROOT, existing.filepath)
        if os.path.exists(old):
            os.remove(old)
        db.delete(existing)

    relative_path = f"{user_id}/{safe_name}"
    doc = models.FarmerDocument(
        user_id   = user_id,
        doc_type  = doc_type,
        filename  = file.filename,
        filepath  = relative_path,
        file_size = file_size,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        from routers.ocr import _run_ocr_for_doc
        background_tasks.add_task(_run_ocr_for_doc, doc.id, SessionLocal)
    except Exception:
        pass

    return {
        "id":          doc.id,
        "doc_type":    doc.doc_type,
        "filename":    doc.filename,
        "url":         f"/uploads/{relative_path}",
        "file_size":   file_size,
        "uploaded_at": str(doc.uploaded_at),
        "ocr_status":  "processing",
    }


# ── GET — Smart document check for a scheme ──────────────────
@router.get("/smart-check/{user_id}")
def smart_check(
    user_id:     int,
    scheme_name: str     = Query("", description="Scheme name to check requirements for"),
    db:          Session = Depends(get_db),
):
    """
    Core intelligence endpoint.
    Returns per-document status (available | missing | expired) for a farmer
    applying to a given scheme, plus a readiness score and AI hint.
    """
    user = db.query(models.FarmerUser).filter(models.FarmerUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Farmer not found")

    docs    = db.query(models.FarmerDocument).filter(models.FarmerDocument.user_id == user_id).all()
    doc_map = {d.doc_type: d for d in docs}

    scheme_key   = _resolve_scheme_key(scheme_name)
    requirements = SCHEME_DOCS.get(scheme_key, SCHEME_DOCS["_default"])
    now          = datetime.utcnow()

    results = [_build_doc_status(doc_map.get(req["type"]), req, db, now) for req in requirements]

    available        = [r for r in results if r["status"] == "available"]
    missing          = [r for r in results if r["status"] == "missing"]
    expired          = [r for r in results if r["status"] == "expired"]
    critical_missing = [r for r in missing if r.get("critical")]
    critical_expired = [r for r in expired if r.get("critical")]
    total            = len(results)
    score            = round(len(available) / total * 100) if total else 0
    can_apply        = not critical_missing and not critical_expired

    hint = f"✅ {len(available)} of {total} documents auto-filled from your profile."
    if missing: hint += f" ⚠️ Please upload {len(missing)} missing document(s)."
    if expired: hint += f" 🔄 {len(expired)} document(s) expired and need re-upload."

    return {
        "user_id":     user_id,
        "scheme_name": scheme_name,
        "scheme_key":  scheme_key,
        "documents":   results,
        "summary": {
            "total":            total,
            "available":        len(available),
            "missing":          len(missing),
            "expired":          len(expired),
            "critical_missing": len(critical_missing),
            "critical_expired": len(critical_expired),
            "readiness_score":  score,
            "can_apply":        can_apply,
        },
        "ai_hint": hint,
    }


# ── GET — All documents for a farmer (document vault) ────────
@router.get("/{user_id}")
def get_farmer_documents(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.FarmerUser).filter(models.FarmerUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Farmer not found")

    docs = (
        db.query(models.FarmerDocument)
        .filter(models.FarmerDocument.user_id == user_id)
        .order_by(models.FarmerDocument.uploaded_at.desc())
        .all()
    )

    result = []
    for d in docs:
        result.append({
            "id":           d.id,
            "doc_type":     d.doc_type,
            "filename":     d.filename,
            "url":          f"/uploads/{d.filepath}",
            "file_size":    d.file_size,
            "uploaded_at":  d.uploaded_at.isoformat() if d.uploaded_at else None,
            "ocr_status":   "not_run",
            "ocr_verified": False,
        })
    return result


# ── DELETE — Remove a document ────────────────────────────────
@router.delete("/{doc_id}", status_code=200)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.FarmerDocument).filter(models.FarmerDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    full_path = os.path.join(UPLOAD_ROOT, doc.filepath)
    if os.path.exists(full_path):
        os.remove(full_path)

    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully"}
