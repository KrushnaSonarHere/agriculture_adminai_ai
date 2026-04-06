"""
models.py
─────────
SQLAlchemy ORM models — map directly to the PostgreSQL tables
in the Agri_tech database.
"""

from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, String, Boolean, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


# ── Farmer Account (Auth) ───────────────────────────────────
class FarmerUser(Base):
    __tablename__ = "farmer_users"

    id              = Column(Integer, primary_key=True, index=True)
    full_name       = Column(Text, nullable=False)
    email           = Column(String(200), unique=True, nullable=False, index=True)
    mobile          = Column(String(15), unique=True, nullable=False)
    state           = Column(String(100), default="Maharashtra")
    district        = Column(String(100))
    password_hash   = Column(Text, nullable=False)           # plain text for now (no JWT yet)
    role            = Column(String(20), default="farmer")   # farmer / admin
    farmer_id       = Column(String(30), unique=True)        # generated: KID-MH-XXXX
    profile_complete = Column(Boolean, default=False)        # True after detailed registration
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    # One-to-one link to full profile
    profile = relationship("FarmerProfile", back_populates="user", uselist=False)


# ── Farmer Full Profile (after detailed registration) ───────
class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("farmer_users.id"), unique=True, nullable=False)

    # ── Personal ──
    father_name     = Column(Text)
    dob             = Column(String(20))
    gender          = Column(String(10))

    # ── Identity ──
    aadhaar         = Column(String(20))
    pan             = Column(String(15))
    voter_id        = Column(Text)

    # ── Bank ──
    bank_account    = Column(Text)
    ifsc            = Column(String(15))
    bank_name       = Column(Text)
    branch_name     = Column(Text)
    account_type    = Column(String(30))

    # ── Address ──
    taluka          = Column(Text)
    village         = Column(Text)
    pincode         = Column(String(10))
    full_address    = Column(Text)

    # ── Land ──
    gat_number      = Column(Text)
    land_area       = Column(Text)
    satbara         = Column(Text)
    eight_a         = Column(Text)
    ownership_type  = Column(Text)

    # ── Farming ──
    crop_type       = Column(Text)
    irrigation_type = Column(Text)
    farming_type    = Column(Text)
    electricity     = Column(Text)

    # ── Category ──
    caste_category  = Column(String(20))
    income_bracket  = Column(String(30))
    bpl_status      = Column(String(5))
    prev_scheme     = Column(String(5))
    agristack_id    = Column(Text)

    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("FarmerUser", back_populates="profile")


# ── Schemes table (already populated via load_schemes.py) ──
class Scheme(Base):
    __tablename__ = "schemes"

    id                   = Column(Integer, primary_key=True, index=True)
    Scheme_Name          = Column("Scheme_Name",         Text, nullable=False)
    Department           = Column("Department",          Text)
    Summary              = Column("Summary",             Text)
    Grant                = Column("Grant",               Text)
    Eligibility          = Column("Eligibility",         Text)
    Required_Documents   = Column("Required_Documents",  Text)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to applications
    applications = relationship("Application", back_populates="scheme")


# ── Applications table ──────────────────────────────────────
class Application(Base):
    __tablename__ = "applications"

    id              = Column(Integer, primary_key=True, index=True)
    app_number      = Column(String(30), unique=True, nullable=False)   # e.g. APP-2026-001
    scheme_id       = Column(Integer, ForeignKey("schemes.id"), nullable=False)

    # Farmer details
    farmer_name     = Column(Text, nullable=False)
    farmer_id       = Column(String(30))                                # KID-MH-XXXX
    mobile          = Column(String(15))
    district        = Column(String(100))
    land_acres      = Column(Text)
    crop_type       = Column(Text)
    bank_account    = Column(Text)
    notes           = Column(Text)

    # Status tracking
    status          = Column(String(20), default="Pending")             # Pending / Approved / Rejected / Processing
    admin_remarks   = Column(Text)

    applied_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship back to scheme
    scheme = relationship("Scheme", back_populates="applications")


# ── Grievances table ────────────────────────────────────────
class Grievance(Base):
    __tablename__ = "grievances"

    id              = Column(Integer, primary_key=True, index=True)
    grv_number      = Column(String(30), unique=True, nullable=False)   # GRV-2026-001
    farmer_name     = Column(Text, nullable=False)
    farmer_id       = Column(String(30))
    category        = Column(Text)
    title           = Column(Text, nullable=False)
    description     = Column(Text)
    priority        = Column(String(10), default="medium")              # low / medium / high
    related_app_id  = Column(Integer, ForeignKey("applications.id"), nullable=True)
    status          = Column(String(30), default="Filed")               # Filed / Received / Assigned / Resolved
    assigned_to     = Column(Text)
    resolution_note = Column(Text)
    filed_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())


# ── Farmer Documents table ───────────────────────────────────
class FarmerDocument(Base):
    __tablename__ = "farmer_documents"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("farmer_users.id"), nullable=False, index=True)
    doc_type    = Column(String(30), nullable=False)   # aadhaar / satbara / bank / photo / caste / income / elec / other
    filename    = Column(Text, nullable=False)          # original filename
    filepath    = Column(Text, nullable=False)          # relative path on server: uploads/{user_id}/{filename}
    file_size   = Column(Integer)                       # bytes
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("FarmerUser", backref="documents")


# ── OCR Extracted Data per Document ─────────────────────────
class ExtractedDocumentData(Base):
    __tablename__ = "extracted_document_data"

    id          = Column(Integer, primary_key=True, index=True)
    doc_id      = Column(Integer, ForeignKey("farmer_documents.id"), unique=True, nullable=False)
    user_id     = Column(Integer, ForeignKey("farmer_users.id"), nullable=False, index=True)
    doc_type    = Column(String(30))            # aadhaar / satbara / bank / income / caste / elec

    # Common extracted fields (nullable — not every doc has every field)
    extracted_name      = Column(Text)
    extracted_aadhaar   = Column(String(20))
    extracted_dob       = Column(String(20))
    extracted_gender    = Column(String(10))
    extracted_address   = Column(Text)
    extracted_survey_no = Column(Text)
    extracted_land_area = Column(Text)
    extracted_village   = Column(Text)
    extracted_taluka    = Column(Text)
    extracted_account   = Column(Text)
    extracted_ifsc      = Column(String(20))
    extracted_bank_name = Column(Text)
    extracted_income    = Column(Text)
    extracted_category  = Column(String(20))    # SC/ST/OBC/General
    extracted_consumer  = Column(Text)          # electricity bill consumer name

    raw_text    = Column(Text)                  # full raw OCR text (for debugging)
    ocr_status  = Column(String(20), default="pending")  # pending / done / failed / simulated
    processed_at = Column(DateTime(timezone=True), server_default=None)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


# ── AI Decision per Farmer / Application ────────────────────
class AIDecision(Base):
    __tablename__ = "ai_decisions"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("farmer_users.id"), nullable=False, index=True)
    application_id  = Column(Integer, ForeignKey("applications.id"), nullable=True)

    # Scores (0-100)
    overall_score       = Column(Float, default=0.0)   # weighted average
    name_score          = Column(Float, default=0.0)
    aadhaar_score       = Column(Float, default=0.0)
    land_score          = Column(Float, default=0.0)
    bank_score          = Column(Float, default=0.0)
    address_score       = Column(Float, default=0.0)
    income_score        = Column(Float, default=0.0)

    # Decision
    decision            = Column(String(30))   # auto_approved / manual_review / flagged
    fraud_risk          = Column(Float, default=0.0)   # 0-100
    confidence          = Column(Float, default=0.0)   # 0-100
    approval_probability = Column(Float, default=0.0)  # 0-100

    # Positive / negative factors (stored as pipe-separated strings)
    positive_factors    = Column(Text)   # e.g. "Aadhaar match|Name match"
    risk_factors        = Column(Text)   # e.g. "Land area mismatch|Low confidence"

    # Duplicate / fraud flags
    duplicate_aadhaar   = Column(Boolean, default=False)
    mismatch_fields     = Column(Text)   # pipe-separated field names that mismatched

    # Admin override
    admin_decision      = Column(String(20))   # approved / rejected / flagged
    admin_remarks       = Column(Text)
    decided_by          = Column(Text)
    decided_at          = Column(DateTime(timezone=True))

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


# ── Notifications table ─────────────────────────────────────
class Notification(Base):
    """
    Shared notification table for both farmers and admins.

    role = "farmer" → targeted at a specific farmer (user_id = their ID)
    role = "admin"  → broadcast to all admins (user_id = 0 sentinel)
    """
    __tablename__ = "notifications"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, nullable=False, index=True)   # farmer user_id OR 0 for admin
    role           = Column(String(20), nullable=False)            # "farmer" / "admin"
    message        = Column(Text, nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    is_read        = Column(Boolean, default=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
