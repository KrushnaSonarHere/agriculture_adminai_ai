"""
routers/farmer_registration.py
────────────────────────────────
FastAPI router for creating and reading farmer profiles in the
NEW agri_farmer_db (Farmer Database).

All endpoints use get_farmer_db() — NOT the legacy Agri_tech DB.

Endpoints:
  POST /v2/farmers/register          → full farmer onboarding (all 5 tables)
  GET  /v2/farmers/{farmer_id}       → complete farmer profile
  GET  /v2/farmers/                  → list farmers (with pagination)
  POST /v2/farmers/{farmer_id}/apply → submit scheme application
  GET  /v2/applications/{app_id}     → get application details
  POST /v2/applications/{app_id}/documents → upload supporting document
  GET  /v2/farmers/{farmer_id}/applications → farmer's application history
"""

from __future__ import annotations

import os, shutil
import re
from datetime import datetime
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session

from database import get_farmer_db
import farmer_models as FM

router = APIRouter(prefix="/v2", tags=["Farmer DB (v2)"])

UPLOAD_ROOT = os.path.join(os.path.dirname(__file__), "..", "uploads")


# ─────────────────────────────────────────────────────────────
# Pydantic request / response schemas
# ─────────────────────────────────────────────────────────────

class AddressIn(BaseModel):
    state:        str = "Maharashtra"
    district:     Optional[str] = None
    taluka:       Optional[str] = None
    village:      Optional[str] = None
    pincode:      Optional[str] = None
    full_address: Optional[str] = None

class LandIn(BaseModel):
    survey_number:       Optional[str]   = None
    land_area:           Optional[float] = None   # acres
    land_ownership_type: Optional[str]   = "owned"
    seven_twelve_number: Optional[str]   = None
    eight_a_number:      Optional[str]   = None

class BankIn(BaseModel):
    account_number: str
    ifsc_code:      str
    bank_name:      Optional[str] = None
    branch_name:    Optional[str] = None
    account_type:   Optional[str] = "savings"
    aadhaar_linked: Optional[bool] = False

class FarmingIn(BaseModel):
    primary_crop:            Optional[str]  = None
    irrigation_type:         Optional[str]  = None
    farming_type:            Optional[str]  = None
    electricity_connection:  Optional[bool] = False

class FarmerRegisterPayload(BaseModel):
    """Complete onboarding payload — one request creates all 5 farmer tables."""
    # Core identity (TABLE 1: farmers)
    full_name:      str
    father_name:    Optional[str]  = None
    dob:            Optional[str]  = None    # DD-MM-YYYY
    gender:         Optional[str]  = None
    mobile_number:  str
    aadhaar_number: str
    category:       Optional[str]  = "General"
    annual_income:  Optional[float]= None
    bpl_status:     Optional[bool] = False
    agristack_id:   Optional[str]  = None

    # Sub-tables
    address:  Optional[AddressIn]  = None
    land:     Optional[List[LandIn]] = None    # multiple land parcels
    bank:     Optional[BankIn]     = None
    farming:  Optional[FarmingIn]  = None

    @validator("aadhaar_number")
    def clean_aadhaar(cls, v):
        return re.sub(r"\s+", "", v) if v else v

class ApplicationIn(BaseModel):
    scheme_id:   int
    scheme_name: Optional[str] = None

class FarmerOut(BaseModel):
    id:             int
    full_name:      str
    mobile_number:  str
    aadhaar_number: str
    category:       Optional[str]
    bpl_status:     bool
    agristack_id:   Optional[str]
    created_at:     Optional[datetime]

    class Config:
        from_attributes = True

class ApplicationOut(BaseModel):
    id:                 int
    farmer_id:          int
    scheme_id:          int
    scheme_name:        Optional[str]
    application_status: str
    applied_at:         Optional[datetime]

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────────────────
# POST /v2/farmers/register
# ─────────────────────────────────────────────────────────────
@router.post(
    "/farmers/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new farmer (all 5 tables in Farmer DB)",
)
def register_farmer(payload: FarmerRegisterPayload, db: Session = Depends(get_farmer_db)):
    # ── Uniqueness checks ──────────────────────────────────────
    if db.query(FM.Farmer).filter(FM.Farmer.aadhaar_number == payload.aadhaar_number).first():
        raise HTTPException(status_code=400, detail="Aadhaar number already registered")
    if db.query(FM.Farmer).filter(FM.Farmer.mobile_number == payload.mobile_number).first():
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    # ── TABLE 1: farmers ──────────────────────────────────────
    farmer = FM.Farmer(
        full_name      = payload.full_name,
        father_name    = payload.father_name,
        dob            = payload.dob,
        gender         = payload.gender,
        mobile_number  = payload.mobile_number,
        aadhaar_number = payload.aadhaar_number,
        category       = payload.category or "General",
        annual_income  = payload.annual_income,
        bpl_status     = payload.bpl_status or False,
        agristack_id   = payload.agristack_id,
    )
    db.add(farmer)
    db.flush()   # get farmer.id

    # ── TABLE 2: farmer_address ───────────────────────────────
    if payload.address:
        addr = FM.FarmerAddress(
            farmer_id    = farmer.id,
            state        = payload.address.state,
            district     = payload.address.district,
            taluka       = payload.address.taluka,
            village      = payload.address.village,
            pincode      = payload.address.pincode,
            full_address = payload.address.full_address,
        )
        db.add(addr)

    # ── TABLE 3: farmer_land_details (multiple parcels) ───────
    for land in (payload.land or []):
        land_rec = FM.FarmerLandDetails(
            farmer_id            = farmer.id,
            survey_number        = land.survey_number,
            land_area            = land.land_area,
            land_ownership_type  = land.land_ownership_type or "owned",
            seven_twelve_number  = land.seven_twelve_number,
            eight_a_number       = land.eight_a_number,
        )
        db.add(land_rec)

    # ── TABLE 4: farmer_bank_details ──────────────────────────
    if payload.bank:
        bank_rec = FM.FarmerBankDetails(
            farmer_id      = farmer.id,
            account_number = payload.bank.account_number,
            ifsc_code      = payload.bank.ifsc_code,
            bank_name      = payload.bank.bank_name,
            branch_name    = payload.bank.branch_name,
            account_type   = payload.bank.account_type or "savings",
            aadhaar_linked = payload.bank.aadhaar_linked or False,
        )
        db.add(bank_rec)

    # ── TABLE 5: farmer_farming_details ───────────────────────
    if payload.farming:
        farm_rec = FM.FarmerFarmingDetails(
            farmer_id              = farmer.id,
            primary_crop           = payload.farming.primary_crop,
            irrigation_type        = payload.farming.irrigation_type,
            farming_type           = payload.farming.farming_type,
            electricity_connection = payload.farming.electricity_connection or False,
        )
        db.add(farm_rec)

    db.commit()
    db.refresh(farmer)

    return {
        "message":   "Farmer registered successfully",
        "farmer_id": farmer.id,
        "full_name": farmer.full_name,
        "aadhaar":   farmer.aadhaar_number[-4:].rjust(12, "X"),   # masked
    }


# ─────────────────────────────────────────────────────────────
# GET /v2/farmers/  — paginated list
# ─────────────────────────────────────────────────────────────
@router.get("/farmers/", response_model=List[FarmerOut], summary="List all farmers (Farmer DB)")
def list_farmers(
    skip: int = 0,
    limit: int = 100,
    district: Optional[str] = None,
    db: Session = Depends(get_farmer_db),
):
    q = db.query(FM.Farmer)
    if district:
        q = q.join(FM.FarmerAddress).filter(FM.FarmerAddress.district.ilike(f"%{district}%"))
    return q.offset(skip).limit(limit).all()


# ─────────────────────────────────────────────────────────────
# GET /v2/farmers/{farmer_id}  — full profile
# ─────────────────────────────────────────────────────────────
@router.get("/farmers/{farmer_id}", summary="Get full farmer profile")
def get_farmer_profile(farmer_id: int, db: Session = Depends(get_farmer_db)):
    farmer = db.query(FM.Farmer).filter(FM.Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    # Build full profile response
    address = db.query(FM.FarmerAddress).filter(FM.FarmerAddress.farmer_id == farmer_id).first()
    lands   = db.query(FM.FarmerLandDetails).filter(FM.FarmerLandDetails.farmer_id == farmer_id).all()
    bank    = db.query(FM.FarmerBankDetails).filter(FM.FarmerBankDetails.farmer_id == farmer_id).first()
    farming = db.query(FM.FarmerFarmingDetails).filter(FM.FarmerFarmingDetails.farmer_id == farmer_id).first()

    def _mask(s):
        return ("X" * (len(s) - 4) + s[-4:]) if s and len(s) > 4 else s

    return {
        "farmer": {
            "id":             farmer.id,
            "full_name":      farmer.full_name,
            "father_name":    farmer.father_name,
            "dob":            farmer.dob,
            "gender":         str(farmer.gender.value) if farmer.gender else None,
            "mobile_number":  _mask(farmer.mobile_number),
            "aadhaar_number": _mask(farmer.aadhaar_number),
            "category":       str(farmer.category.value) if farmer.category else None,
            "annual_income":  float(farmer.annual_income) if farmer.annual_income else None,
            "bpl_status":     farmer.bpl_status,
            "agristack_id":   farmer.agristack_id,
            "created_at":     farmer.created_at,
        },
        "address": {
            "state":        address.state if address else None,
            "district":     address.district if address else None,
            "taluka":       address.taluka if address else None,
            "village":      address.village if address else None,
            "pincode":      address.pincode if address else None,
            "full_address": address.full_address if address else None,
        } if address else None,
        "land_parcels": [
            {
                "survey_number":       l.survey_number,
                "land_area":           float(l.land_area) if l.land_area else None,
                "land_ownership_type": str(l.land_ownership_type.value) if l.land_ownership_type else None,
                "seven_twelve_number": l.seven_twelve_number,
                "eight_a_number":      l.eight_a_number,
            }
            for l in lands
        ],
        "bank": {
            "account_number": _mask(bank.account_number) if bank else None,
            "ifsc_code":      bank.ifsc_code if bank else None,
            "bank_name":      bank.bank_name if bank else None,
            "branch_name":    bank.branch_name if bank else None,
            "account_type":   str(bank.account_type.value) if bank and bank.account_type else None,
            "aadhaar_linked": bank.aadhaar_linked if bank else None,
        } if bank else None,
        "farming": {
            "primary_crop":           farming.primary_crop if farming else None,
            "irrigation_type":        str(farming.irrigation_type.value) if farming and farming.irrigation_type else None,
            "farming_type":           str(farming.farming_type.value) if farming and farming.farming_type else None,
            "electricity_connection": farming.electricity_connection if farming else None,
        } if farming else None,
    }


# ─────────────────────────────────────────────────────────────
# POST /v2/farmers/{farmer_id}/apply  — submit application
# ─────────────────────────────────────────────────────────────
@router.post(
    "/farmers/{farmer_id}/apply",
    status_code=status.HTTP_201_CREATED,
    response_model=ApplicationOut,
    summary="Submit a scheme application (Farmer DB)",
)
def submit_application(
    farmer_id: int,
    payload:   ApplicationIn,
    db:        Session = Depends(get_farmer_db),
):
    if not db.query(FM.Farmer).filter(FM.Farmer.id == farmer_id).first():
        raise HTTPException(status_code=404, detail="Farmer not found")

    app = FM.FarmerApplication(
        farmer_id          = farmer_id,
        scheme_id          = payload.scheme_id,
        scheme_name        = payload.scheme_name,
        application_status = "submitted",
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


# ─────────────────────────────────────────────────────────────
# GET /v2/applications/{app_id}
# ─────────────────────────────────────────────────────────────
@router.get("/applications/{app_id}", response_model=ApplicationOut, summary="Get application details")
def get_application(app_id: int, db: Session = Depends(get_farmer_db)):
    app = db.query(FM.FarmerApplication).filter(FM.FarmerApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


# ─────────────────────────────────────────────────────────────
# GET /v2/farmers/{farmer_id}/applications
# ─────────────────────────────────────────────────────────────
@router.get(
    "/farmers/{farmer_id}/applications",
    response_model=List[ApplicationOut],
    summary="All applications by a farmer",
)
def farmer_applications(farmer_id: int, db: Session = Depends(get_farmer_db)):
    return db.query(FM.FarmerApplication).filter(FM.FarmerApplication.farmer_id == farmer_id).all()


# ─────────────────────────────────────────────────────────────
# POST /v2/applications/{app_id}/documents  — upload document
# ─────────────────────────────────────────────────────────────
@router.post(
    "/applications/{app_id}/documents",
    status_code=status.HTTP_201_CREATED,
    summary="Upload a supporting document for an application",
)
async def upload_document(
    app_id:       int,
    document_type: str  = Form(...),
    file:         UploadFile = File(...),
    db:           Session = Depends(get_farmer_db),
):
    app = db.query(FM.FarmerApplication).filter(FM.FarmerApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Save to /uploads/v2/{app_id}/
    save_dir = Path(UPLOAD_ROOT) / "v2" / str(app_id)
    save_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{document_type}_{timestamp}_{file.filename}"
    dest      = save_dir / safe_name

    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    file_url = f"/uploads/v2/{app_id}/{safe_name}"

    doc = FM.ApplicationDocument(
        application_id = app_id,
        document_type  = document_type,
        file_url       = file_url,
        file_size      = dest.stat().st_size,
        original_name  = file.filename,
        mime_type      = file.content_type,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "message":       "Document uploaded successfully",
        "document_id":   doc.id,
        "file_url":      file_url,
        "document_type": document_type,
    }


# ─────────────────────────────────────────────────────────────
# GET /v2/applications/{app_id}/documents  — list documents
# ─────────────────────────────────────────────────────────────
@router.get("/applications/{app_id}/documents", summary="List documents for an application")
def list_documents(app_id: int, db: Session = Depends(get_farmer_db)):
    docs = db.query(FM.ApplicationDocument).filter(FM.ApplicationDocument.application_id == app_id).all()
    return [
        {
            "id":            d.id,
            "document_type": str(d.document_type.value) if hasattr(d.document_type, "value") else d.document_type,
            "file_url":      d.file_url,
            "original_name": d.original_name,
            "file_size":     d.file_size,
            "uploaded_at":   d.uploaded_at,
        }
        for d in docs
    ]
