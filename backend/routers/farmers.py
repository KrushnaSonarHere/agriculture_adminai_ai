"""
routers/farmers.py
──────────────────
POST /farmers/profile/{user_id}  → save detailed profile after registration
GET  /farmers/profile/{user_id}  → fetch full profile (for profile page)
PUT  /farmers/profile/{user_id}  → update profile
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
import models

router = APIRouter(prefix="/farmers", tags=["Farmers"])


# ── Full Profile Schema ─────────────────────────────────────
class FarmerProfilePayload(BaseModel):
    father_name:    Optional[str] = None
    dob:            Optional[str] = None
    gender:         Optional[str] = None
    aadhaar:        Optional[str] = None
    pan:            Optional[str] = None
    voter_id:       Optional[str] = None
    bank_account:   Optional[str] = None
    ifsc:           Optional[str] = None
    bank_name:      Optional[str] = None
    branch_name:    Optional[str] = None
    account_type:   Optional[str] = None
    taluka:         Optional[str] = None
    village:        Optional[str] = None
    pincode:        Optional[str] = None
    full_address:   Optional[str] = None
    gat_number:     Optional[str] = None
    land_area:      Optional[str] = None
    satbara:        Optional[str] = None
    eight_a:        Optional[str] = None
    ownership_type: Optional[str] = None
    crop_type:      Optional[str] = None
    irrigation_type:Optional[str] = None
    farming_type:   Optional[str] = None
    electricity:    Optional[str] = None
    caste_category: Optional[str] = None
    income_bracket: Optional[str] = None
    bpl_status:     Optional[str] = None
    prev_scheme:    Optional[str] = None
    agristack_id:   Optional[str] = None


# ── POST / PUT — Save full profile ──────────────────────────
@router.post("/profile/{user_id}", status_code=201)
def save_profile(user_id: int, payload: FarmerProfilePayload, db: Session = Depends(get_db)):
    user = db.query(models.FarmerUser).filter(models.FarmerUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Upsert profile
    profile = db.query(models.FarmerProfile).filter(models.FarmerProfile.user_id == user_id).first()
    if not profile:
        profile = models.FarmerProfile(user_id=user_id)
        db.add(profile)

    for field, value in payload.dict(exclude_none=True).items():
        setattr(profile, field, value)

    user.profile_complete = True
    db.commit()
    db.refresh(profile)
    return {"message": "Profile saved", "farmer_id": user.farmer_id}


# ── GET — Full profile for profile page ─────────────────────
@router.get("/profile/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.FarmerUser).filter(models.FarmerUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(models.FarmerProfile).filter(models.FarmerProfile.user_id == user_id).first()

    return {
        # Account info
        "id":               user.id,
        "full_name":        user.full_name,
        "email":            user.email,
        "mobile":           user.mobile,
        "state":            user.state,
        "district":         user.district,
        "role":             user.role,
        "farmer_id":        user.farmer_id,
        "profile_complete": user.profile_complete,
        "created_at":       str(user.created_at),
        # Detailed profile (if completed)
        "profile": {
            "father_name":    profile.father_name    if profile else None,
            "dob":            profile.dob            if profile else None,
            "gender":         profile.gender         if profile else None,
            "aadhaar":        profile.aadhaar        if profile else None,
            "pan":            profile.pan            if profile else None,
            "bank_account":   profile.bank_account   if profile else None,
            "ifsc":           profile.ifsc           if profile else None,
            "bank_name":      profile.bank_name      if profile else None,
            "taluka":         profile.taluka         if profile else None,
            "village":        profile.village        if profile else None,
            "pincode":        profile.pincode        if profile else None,
            "full_address":   profile.full_address   if profile else None,
            "gat_number":     profile.gat_number     if profile else None,
            "land_area":      profile.land_area      if profile else None,
            "satbara":        profile.satbara        if profile else None,
            "eight_a":        profile.eight_a        if profile else None,
            "ownership_type": profile.ownership_type if profile else None,
            "crop_type":      profile.crop_type      if profile else None,
            "irrigation_type":profile.irrigation_type if profile else None,
            "farming_type":   profile.farming_type   if profile else None,
            "electricity":    profile.electricity    if profile else None,
            "caste_category": profile.caste_category if profile else None,
            "income_bracket": profile.income_bracket if profile else None,
            "agristack_id":   profile.agristack_id   if profile else None,
        } if profile else None
    }


@router.get("/")
def get_all_farmers(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    results = (
        db.query(models.FarmerUser, models.AIDecision.decision, models.AIDecision.overall_score)
        .outerjoin(models.AIDecision, models.FarmerUser.id == models.AIDecision.user_id)
        .filter(models.FarmerUser.role == "farmer")
        .offset(skip).limit(limit).all()
    )
    return [
        {
            "id":               u.id,
            "full_name":        u.full_name,
            "farmer_id":        u.farmer_id,
            "email":            u.email,
            "mobile":           u.mobile,
            "state":            u.state,
            "district":         u.district,
            "profile_complete": u.profile_complete,
            "created_at":       str(u.created_at),
            "ai_status":        decision,
            "ai_score":         score,
        }
        for u, decision, score in results
    ]

