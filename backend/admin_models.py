"""
admin_models.py
───────────────
SQLAlchemy ORM models for DATABASE 2: Admin DB (agri_admin_db)

Tables (6 total):
  1. ocr_documents          — raw OCR text from PaddleOCR per document
  2. ocr_extracted_fields   — individual field values parsed from OCR text
  3. field_comparisons      — field-by-field comparison: farmer form vs OCR
  4. ai_scores              — weighted AI scoring per application
  5. verification_summary   — final verification result & decision
  6. admin_actions          — audit trail of all admin decisions

Data Flow:
  Farmer uploads document (Farmer DB)
       ↓
  Admin triggers OCR → PaddleOCR runs
       ↓
  raw_text → ocr_documents
       ↓
  parse fields → ocr_extracted_fields
       ↓
  compare with farmer form → field_comparisons
       ↓
  weighted score → ai_scores
       ↓
  final decision → verification_summary
       ↓
  admin acts → admin_actions
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float,
    DateTime, Enum, ForeignKey, Boolean, JSON
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from database import AdminBase


# ─────────────────────────────────────────────────────────────
# Enum types (Admin DB)
# ─────────────────────────────────────────────────────────────
class MatchStatusEnum(str, enum.Enum):
    match    = "match"
    mismatch = "mismatch"
    partial  = "partial"
    not_found= "not_found"

class FinalDecisionEnum(str, enum.Enum):
    approve = "approve"     # overall score ≥ 90
    review  = "review"      # score 70–89
    reject  = "reject"      # score < 70

class AdminActionEnum(str, enum.Enum):
    approve = "approve"
    reject  = "reject"
    flag    = "flag"
    escalate= "escalate"
    request_docs = "request_docs"

class OcrStatusEnum(str, enum.Enum):
    pending   = "pending"
    running   = "running"
    done      = "done"
    failed    = "failed"
    simulated = "simulated"   # demo mode — no real PaddleOCR available


# ─────────────────────────────────────────────────────────────
# TABLE 1: ocr_documents
# ─────────────────────────────────────────────────────────────
class OcrDocument(AdminBase):
    """
    Stores the full raw OCR text output from PaddleOCR for each
    uploaded document.  One record per (application_id, document_type).
    application_id cross-references application_documents in Farmer DB.
    """
    __tablename__ = "ocr_documents"

    id              = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Cross-DB references (plain integers, no FK constraint across DBs)
    application_id  = Column(Integer, nullable=False, index=True)
    document_id     = Column(Integer, index=True)          # application_documents.id in Farmer DB

    # Document metadata
    document_type   = Column(String(50), nullable=False)   # aadhaar / 7_12 / bank / income / ...
    file_url        = Column(Text)                         # path used for OCR input

    # OCR output
    raw_text        = Column(Text)                         # full concatenated OCR text
    ocr_status      = Column(Enum(OcrStatusEnum, native_enum=False), default=OcrStatusEnum.pending, nullable=False)
    ocr_engine      = Column(String(50), default="PaddleOCR")
    confidence_avg  = Column(Float, default=0.0)           # average confidence from PaddleOCR

    processed_at    = Column(DateTime(timezone=True))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    extracted_fields = relationship("OcrExtractedField",  back_populates="ocr_document", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────
# TABLE 2: ocr_extracted_fields
# ─────────────────────────────────────────────────────────────
class OcrExtractedField(AdminBase):
    """
    Individual field-value pairs extracted and parsed from OCR raw text.

    Supported field_names:
        name, father_name, dob, gender, aadhaar_number,
        mobile_number, address, pincode, district, state,
        survey_number, land_area, seven_twelve_number,
        account_number, ifsc_code, bank_name,
        annual_income, category
    """
    __tablename__ = "ocr_extracted_fields"

    id              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ocr_document_id = Column(Integer, ForeignKey("ocr_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id  = Column(Integer, nullable=False, index=True)   # denormalised for fast queries

    document_type   = Column(String(50))
    field_name      = Column(String(100), nullable=False)   # e.g. "aadhaar_number"
    field_value     = Column(Text)                          # extracted value (raw string)
    confidence      = Column(Float, default=0.0)            # PaddleOCR confidence for this field (0-1)
    normalized_value= Column(Text)                          # cleaned / normalised version

    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    ocr_document    = relationship("OcrDocument", back_populates="extracted_fields")


# ─────────────────────────────────────────────────────────────
# TABLE 3: field_comparisons
# ─────────────────────────────────────────────────────────────
class FieldComparison(AdminBase):
    """
    Field-by-field comparison between:
      - farmer_value  → what the farmer typed in the registration form
      - ocr_value     → what PaddleOCR extracted from the uploaded document

    match_percentage uses fuzzy string matching (e.g. RapidFuzz).

    Weight table (used by AI scoring):
      aadhaar_number → 1.00
      name           → 0.90
      land_area      → 0.85
      account_number → 0.85
      annual_income  → 0.70
      (all others)   → 0.60
    """
    __tablename__ = "field_comparisons"

    id               = Column(Integer, primary_key=True, index=True, autoincrement=True)
    application_id   = Column(Integer, nullable=False, index=True)

    field_name       = Column(String(100), nullable=False)
    farmer_value     = Column(Text)
    ocr_value        = Column(Text)
    match_percentage = Column(Float, default=0.0)        # 0.0 – 100.0
    status           = Column(Enum(MatchStatusEnum, native_enum=False), default=MatchStatusEnum.not_found)

    # Weights for AI scoring
    field_weight     = Column(Float, default=0.60)       # configurable per field

    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())


# ─────────────────────────────────────────────────────────────
# TABLE 4: ai_scores
# ─────────────────────────────────────────────────────────────
class AiScore(AdminBase):
    """
    AI scoring result per application.

    overall_score = Σ (field_weight × match_percentage) / Σ field_weight

    Decision thresholds:
      overall_score ≥ 90  →  auto APPROVE
      overall_score 70-89 →  flag for manual REVIEW
      overall_score < 70  →  REJECT

    approval_probability  — probability of approval (0-100)
    fraud_risk            — risk of fraudulent claim (0-100)
    confidence_score      — confidence of the AI model (0-100)
    """
    __tablename__ = "ai_scores"

    id                   = Column(Integer, primary_key=True, index=True, autoincrement=True)
    application_id       = Column(Integer, nullable=False, unique=True, index=True)

    # Individual dimension scores (0-100 each)
    aadhaar_score        = Column(Float, default=0.0)
    name_score           = Column(Float, default=0.0)
    land_score           = Column(Float, default=0.0)
    bank_score           = Column(Float, default=0.0)
    income_score         = Column(Float, default=0.0)
    address_score        = Column(Float, default=0.0)

    # Aggregate
    overall_score        = Column(Float, default=0.0)
    approval_probability = Column(Float, default=0.0)
    fraud_risk           = Column(Float, default=0.0)
    confidence_score     = Column(Float, default=0.0)

    # Flags
    duplicate_aadhaar    = Column(Boolean, default=False)  # another farmer already used this Aadhaar
    positive_factors     = Column(JSON)                    # list of strengths, e.g. ["Aadhaar match", "Name match"]
    risk_factors         = Column(JSON)                    # list of concerns

    # AI recommendation
    recommendation       = Column(Enum(FinalDecisionEnum, native_enum=False))

    computed_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())


# ─────────────────────────────────────────────────────────────
# TABLE 5: verification_summary
# ─────────────────────────────────────────────────────────────
class VerificationSummary(AdminBase):
    """
    One consolidated record per application summarising the entire
    verification outcome.  This is the table admin dashboards query first.
    """
    __tablename__ = "verification_summary"

    id                = Column(Integer, primary_key=True, index=True, autoincrement=True)
    application_id    = Column(Integer, nullable=False, unique=True, index=True)

    # Reference back to Farmer DB (farmer identity)
    farmer_id         = Column(Integer, index=True)
    farmer_name       = Column(String(200))

    # Field-level stats
    total_fields      = Column(Integer, default=0)
    matched_fields    = Column(Integer, default=0)
    mismatched_fields = Column(Integer, default=0)
    not_found_fields  = Column(Integer, default=0)

    # Scores (copied from ai_scores for quick access)
    overall_score     = Column(Float, default=0.0)
    fraud_risk        = Column(Float, default=0.0)

    # Decision
    final_decision    = Column(Enum(FinalDecisionEnum, native_enum=False), nullable=False, index=True)
    decision_reason   = Column(Text)                   # human-readable summary

    # Admin override (if human overrode AI decision)
    admin_override    = Column(Boolean, default=False)
    admin_decision    = Column(Enum(FinalDecisionEnum, native_enum=False))
    override_reason   = Column(Text)

    verified_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())


# ─────────────────────────────────────────────────────────────
# TABLE 6: admin_actions
# ─────────────────────────────────────────────────────────────
class AdminAction(AdminBase):
    """
    Full audit trail of every action taken by an admin on an application.
    Immutable — rows are INSERT-only, never updated.
    admin_id cross-references farmer_users.id in the legacy Agri_tech DB.
    """
    __tablename__ = "admin_actions"

    id             = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Who acted
    admin_id       = Column(Integer, nullable=False, index=True)  # farmer_users.id (admin role)
    admin_name     = Column(String(200))                          # denormalised for audit log

    # What was acted on
    application_id = Column(Integer, nullable=False, index=True)

    # Action detail
    action         = Column(Enum(AdminActionEnum, native_enum=False), nullable=False)
    remarks        = Column(Text)
    metadata_json  = Column(JSON)                   # flexible — extra data per action type

    timestamp      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
