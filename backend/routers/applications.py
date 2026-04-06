"""
routers/applications.py
───────────────────────
POST /applications           → submit a new application  (triggers admin notification)
GET  /applications           → list all applications (admin)
GET  /applications/{id}      → get single application
GET  /applications/farmer/{farmer_id} → get all apps for a farmer
PUT  /applications/{id}/status → update status (admin)  (triggers farmer notification)
PATCH /applications/{id}     → update status (admin, same as PUT, used by frontend)
"""

import random, string
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
import models, schemas
from routers.notifications import create_notification

router = APIRouter(prefix="/applications", tags=["Applications"])


class PatchPayload(BaseModel):
    status:        Optional[str] = None
    admin_remarks: Optional[str] = None


def generate_app_number():
    """Generate a unique application number like APP-2026-042"""
    year = datetime.now().year
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"APP-{year}-{suffix}"


def _notify_admin_new_application(db: Session, app: models.Application, scheme_name: str):
    """Send notification to all admins when a new application is submitted."""
    create_notification(
        db,
        user_id        = 0,   # 0 = broadcast to all admins
        role           = "admin",
        message        = (
            f"📋 New Application: {app.app_number} | "
            f"Farmer: {app.farmer_name} | "
            f"Scheme: {scheme_name} | "
            f"Status: Pending Verification"
        ),
        application_id = app.id,
    )


def _notify_farmer_decision(db: Session, app: models.Application, scheme_name: str, farmer_user_id: int):
    """Send notification to farmer after admin approves/rejects."""
    if app.status == "Approved":
        icon = "✅"
        verb = "APPROVED"
    elif app.status == "Rejected":
        icon = "❌"
        verb = "REJECTED"
    else:
        return  # No notification for other status changes

    msg = f"{icon} Your application ({app.app_number}) for '{scheme_name}' has been {verb}."
    if app.admin_remarks:
        msg += f" Remarks: {app.admin_remarks}"

    create_notification(
        db,
        user_id        = farmer_user_id,
        role           = "farmer",
        message        = msg,
        application_id = app.id,
    )


def _get_farmer_user_id(db: Session, farmer_id: str) -> int:
    """Look up the integer user_id from the farmer_id string (e.g. KID-MH-1234)."""
    if not farmer_id:
        return 0
    user = db.query(models.FarmerUser).filter(models.FarmerUser.farmer_id == farmer_id).first()
    return user.id if user else 0


# ── POST — Submit new application ───────────────────────────
@router.post("/", response_model=schemas.ApplicationResponse, status_code=201)
def create_application(
    payload: schemas.ApplicationCreate,
    db: Session = Depends(get_db)
):
    # Verify scheme exists
    scheme = db.query(models.Scheme).filter(models.Scheme.id == payload.scheme_id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    app = models.Application(
        app_number   = generate_app_number(),
        scheme_id    = payload.scheme_id,
        farmer_name  = payload.farmer_name,
        farmer_id    = payload.farmer_id,
        mobile       = payload.mobile,
        district     = payload.district,
        land_acres   = payload.land_acres,
        crop_type    = payload.crop_type,
        bank_account = payload.bank_account,
        notes        = payload.notes,
        status       = "Pending",
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # 🔔 Notify admin about new application
    _notify_admin_new_application(db, app, scheme.Scheme_Name)

    return app


# ── GET all applications ─────────────────────────────────────
@router.get("/", response_model=List[schemas.ApplicationResponse])
def get_all_applications(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return db.query(models.Application).offset(skip).limit(limit).all()


# ── GET applications for a specific farmer ───────────────────
@router.get("/farmer/{farmer_id}", response_model=List[schemas.ApplicationResponse])
def get_farmer_applications(farmer_id: str, db: Session = Depends(get_db)):
    apps = db.query(models.Application).filter(
        models.Application.farmer_id == farmer_id
    ).all()
    return apps


# ── GET single application by ID ─────────────────────────────
@router.get("/{app_id}", response_model=schemas.ApplicationResponse)
def get_application(app_id: int, db: Session = Depends(get_db)):
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


# ── PUT — Update application status (admin) ──────────────────
@router.put("/{app_id}/status", response_model=schemas.ApplicationResponse)
def update_status(
    app_id: int,
    payload: schemas.ApplicationStatusUpdate,
    db: Session = Depends(get_db)
):
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    valid_statuses = ["Pending", "Approved", "Rejected", "Processing"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    app.status        = payload.status
    app.admin_remarks = payload.admin_remarks
    db.commit()
    db.refresh(app)

    # 🔔 Notify farmer of the decision
    scheme = db.query(models.Scheme).filter(models.Scheme.id == app.scheme_id).first()
    scheme_name = scheme.Scheme_Name if scheme else "Unknown Scheme"
    farmer_user_id = _get_farmer_user_id(db, app.farmer_id)
    if farmer_user_id:
        _notify_farmer_decision(db, app, scheme_name, farmer_user_id)

    return app


# ── PATCH — Update status (used by React frontend) ───────────
@router.patch("/{app_id}", response_model=schemas.ApplicationResponse)
def patch_status(
    app_id: int,
    payload: PatchPayload,
    db: Session = Depends(get_db)
):
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    valid_statuses = ["Pending", "Approved", "Rejected", "Processing"]
    if payload.status and payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    if payload.status is not None:
        app.status = payload.status
    if payload.admin_remarks is not None:
        app.admin_remarks = payload.admin_remarks
    db.commit()
    db.refresh(app)

    # 🔔 Notify farmer of the decision (only for terminal statuses)
    if payload.status in ("Approved", "Rejected"):
        scheme = db.query(models.Scheme).filter(models.Scheme.id == app.scheme_id).first()
        scheme_name = scheme.Scheme_Name if scheme else "Unknown Scheme"
        farmer_user_id = _get_farmer_user_id(db, app.farmer_id)
        if farmer_user_id:
            _notify_farmer_decision(db, app, scheme_name, farmer_user_id)

    return app
