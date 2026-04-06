"""
schemas.py
──────────
Pydantic models for request validation and API response shapes.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Scheme Schemas ──────────────────────────────────────────
class SchemeBase(BaseModel):
    Scheme_Name:        str
    Department:         Optional[str] = None
    Summary:            Optional[str] = None
    Grant:              Optional[str] = None
    Eligibility:        Optional[str] = None
    Required_Documents: Optional[str] = None


class SchemeResponse(SchemeBase):
    id:         int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SchemeListItem(BaseModel):
    """Lightweight version for listing — no full text fields."""
    id:          int
    Scheme_Name: str
    Department:  Optional[str] = None

    class Config:
        from_attributes = True


# ── Application Schemas ─────────────────────────────────────
class ApplicationCreate(BaseModel):
    scheme_id:    int
    farmer_name:  str
    farmer_id:    Optional[str] = None
    mobile:       Optional[str] = None
    district:     Optional[str] = None
    land_acres:   Optional[str] = None
    crop_type:    Optional[str] = None
    bank_account: Optional[str] = None
    notes:        Optional[str] = None


class ApplicationResponse(BaseModel):
    id:           int
    app_number:   str
    scheme_id:    int
    farmer_name:  str
    farmer_id:    Optional[str] = None
    mobile:       Optional[str] = None
    district:     Optional[str] = None
    land_acres:   Optional[str] = None
    crop_type:    Optional[str] = None
    bank_account: Optional[str] = None
    status:       str
    admin_remarks: Optional[str] = None
    applied_at:   Optional[datetime] = None

    # Nested scheme info
    scheme:       Optional[SchemeListItem] = None

    # Flat scheme name for frontend convenience (avoids rendering object as React child)
    scheme_name:  Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        # Flatten scheme.Scheme_Name → scheme_name
        d = super().from_orm(obj)
        if d.scheme_name is None and d.scheme is not None:
            d.scheme_name = d.scheme.Scheme_Name
        return d


class ApplicationStatusUpdate(BaseModel):
    status:        str                    # Pending / Approved / Rejected / Processing
    admin_remarks: Optional[str] = None


# ── Grievance Schemas ───────────────────────────────────────
class GrievanceCreate(BaseModel):
    farmer_name:    str
    farmer_id:      Optional[str] = None
    category:       Optional[str] = None
    title:          str
    description:    Optional[str] = None
    priority:       Optional[str] = "medium"
    related_app_id: Optional[int] = None


class GrievanceResponse(BaseModel):
    id:              int
    grv_number:      str
    farmer_name:     str
    category:        Optional[str] = None
    title:           str
    priority:        str
    status:          str
    assigned_to:     Optional[str] = None
    resolution_note: Optional[str] = None
    filed_at:        Optional[datetime] = None

    class Config:
        from_attributes = True
