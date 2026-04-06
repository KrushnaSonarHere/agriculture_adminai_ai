"""
routers/auth.py
───────────────
POST /auth/register  → create account (farmer_users table)
POST /auth/login     → verify credentials
GET  /auth/me/{id}   → get current user info
"""

import random, string
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
import models

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Schemas ──────────────────────────────────────────────────
class RegisterPayload(BaseModel):
    full_name: str
    email:     str
    mobile:    str
    state:     Optional[str] = "Maharashtra"
    district:  Optional[str] = None
    password:  str
    role:      Optional[str] = "farmer"   # farmer / admin


class LoginPayload(BaseModel):
    credential: str   # email OR mobile
    password:   str


class UserResponse(BaseModel):
    id:               int
    full_name:        str
    email:            str
    mobile:           str
    district:         Optional[str]
    role:             str
    farmer_id:        Optional[str]
    profile_complete: bool

    class Config:
        from_attributes = True


# ── Generate unique farmer ID ─────────────────────────────────
def generate_farmer_id():
    year = datetime.now().year
    suffix = ''.join(random.choices(string.digits, k=5))
    return f"KID-MH-{year}-{suffix}"


# ── POST /auth/register ───────────────────────────────────────
@router.post("/register", response_model=UserResponse, status_code=201)
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    # Check email/mobile uniqueness
    if db.query(models.FarmerUser).filter(models.FarmerUser.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(models.FarmerUser).filter(models.FarmerUser.mobile == payload.mobile).first():
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    farmer_id = generate_farmer_id() if payload.role == "farmer" else None

    user = models.FarmerUser(
        full_name     = payload.full_name,
        email         = payload.email,
        mobile        = payload.mobile,
        state         = payload.state or "Maharashtra",
        district      = payload.district,
        password_hash = payload.password,   # plain text (prototype)
        role          = payload.role,
        farmer_id     = farmer_id,
        profile_complete = False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── POST /auth/login ──────────────────────────────────────────
@router.post("/login", response_model=UserResponse)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = (
        db.query(models.FarmerUser)
          .filter(
              (models.FarmerUser.email  == payload.credential) |
              (models.FarmerUser.mobile == payload.credential)
          ).first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.password_hash != payload.password:
        raise HTTPException(status_code=401, detail="Incorrect password")
    return user


# ── GET /auth/me/{id} ─────────────────────────────────────────
@router.get("/me/{user_id}", response_model=UserResponse)
def get_me(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.FarmerUser).filter(models.FarmerUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── POST /auth/register-admin ─────────────────────────────────
@router.post("/register-admin", response_model=UserResponse, status_code=201)
def register_admin(payload: RegisterPayload, db: Session = Depends(get_db)):
    """Register a government officer / admin account."""
    # Force role to admin
    payload.role = "admin"
    # Check email/mobile uniqueness
    if db.query(models.FarmerUser).filter(models.FarmerUser.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(models.FarmerUser).filter(models.FarmerUser.mobile == payload.mobile).first():
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    user = models.FarmerUser(
        full_name     = payload.full_name,
        email         = payload.email,
        mobile        = payload.mobile,
        state         = payload.state or "Maharashtra",
        district      = payload.district,
        password_hash = payload.password,
        role          = "admin",
        farmer_id     = None,
        profile_complete = True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
