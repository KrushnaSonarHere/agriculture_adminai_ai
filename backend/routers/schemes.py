"""
routers/schemes.py
──────────────────
GET  /schemes           → list all schemes
GET  /schemes/{id}      → get single scheme with full details
GET  /schemes/search    → search schemes by keyword
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import models, schemas

router = APIRouter(prefix="/schemes", tags=["Schemes"])


# ── GET all schemes ─────────────────────────────────────────
@router.get("/", response_model=List[schemas.SchemeResponse])
def get_all_schemes(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    schemes = db.query(models.Scheme).offset(skip).limit(limit).all()
    return schemes


# ── Search schemes by keyword ───────────────────────────────
@router.get("/search", response_model=List[schemas.SchemeResponse])
def search_schemes(
    q: str = Query(..., description="Keyword to search in scheme name or summary"),
    db: Session = Depends(get_db)
):
    keyword = f"%{q}%"
    schemes = db.query(models.Scheme).filter(
        models.Scheme.Scheme_Name.ilike(keyword) |
        models.Scheme.Summary.ilike(keyword) |
        models.Scheme.Department.ilike(keyword)
    ).all()
    return schemes


# ── GET one scheme by ID ────────────────────────────────────
@router.get("/{scheme_id}", response_model=schemas.SchemeResponse)
def get_scheme(scheme_id: int, db: Session = Depends(get_db)):
    scheme = db.query(models.Scheme).filter(models.Scheme.id == scheme_id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail=f"Scheme with id {scheme_id} not found")
    return scheme
