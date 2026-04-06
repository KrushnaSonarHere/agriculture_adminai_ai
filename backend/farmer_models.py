"""
farmer_models.py
────────────────
SQLAlchemy ORM models for DATABASE 1: Farmer DB (agri_farmer_db)

Tables (7 total):
  1. farmers                — main profile with identity & personal info
  2. farmer_address         — address details
  3. farmer_land_details    — land ownership, survey numbers
  4. farmer_bank_details    — bank account for DBT transfers
  5. farmer_farming_details — crop, irrigation, farming method
  6. applications           — scheme applications
  7. application_documents  — uploaded supporting documents
"""

from sqlalchemy import (
    Column, Integer, BigInteger, String, Text,
    Boolean, DateTime, Numeric, ForeignKey, Enum
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from database import FarmerBase


# ─────────────────────────────────────────────────────────────
# Enum types
# ─────────────────────────────────────────────────────────────
class GenderEnum(str, enum.Enum):
    male   = "male"
    female = "female"
    other  = "other"

class CategoryEnum(str, enum.Enum):
    General = "General"
    OBC     = "OBC"
    SC      = "SC"
    ST      = "ST"

class ApplicationStatusEnum(str, enum.Enum):
    submitted    = "submitted"
    under_review = "under_review"
    approved     = "approved"
    rejected     = "rejected"

class DocumentTypeEnum(str, enum.Enum):
    aadhaar     = "aadhaar"
    seven_twelve = "7_12"
    bank        = "bank"
    income      = "income"
    caste       = "caste"
    electricity = "electricity"
    photo       = "photo"
    other       = "other"

class LandOwnershipEnum(str, enum.Enum):
    owned  = "owned"
    leased = "leased"
    shared = "shared"

class AccountTypeEnum(str, enum.Enum):
    savings = "savings"
    current = "current"

class IrrigationEnum(str, enum.Enum):
    drip      = "drip"
    sprinkler = "sprinkler"
    canal     = "canal"
    rain_fed  = "rain_fed"
    borewell  = "borewell"
    other     = "other"

class FarmingTypeEnum(str, enum.Enum):
    organic    = "organic"
    traditional= "traditional"
    mixed      = "mixed"


# ─────────────────────────────────────────────────────────────
# TABLE 1: farmers
# ─────────────────────────────────────────────────────────────
class Farmer(FarmerBase):
    """
    Core identity table for every registered farmer.
    All other farmer tables reference this via farmer_id FK.
    """
    __tablename__ = "farmers"

    id              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name       = Column(String(200), nullable=False, index=True)
    father_name     = Column(String(200))
    dob             = Column(String(20))                          # stored as DD-MM-YYYY string
    gender          = Column(Enum(GenderEnum, native_enum=False), nullable=True)
    mobile_number   = Column(String(15),  unique=True, nullable=False, index=True)
    aadhaar_number  = Column(String(20),  unique=True, nullable=False, index=True)

    # Classification
    category        = Column(Enum(CategoryEnum, native_enum=False), default=CategoryEnum.General)
    annual_income   = Column(Numeric(12, 2))
    bpl_status      = Column(Boolean, default=False)              # Below Poverty Line card holder
    agristack_id    = Column(String(50), unique=True)             # GOI AgriStack digital ID

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ──────────────────────────────────────
    address         = relationship("FarmerAddress",        back_populates="farmer", uselist=False, cascade="all, delete-orphan")
    land_details    = relationship("FarmerLandDetails",    back_populates="farmer", cascade="all, delete-orphan")
    bank_details    = relationship("FarmerBankDetails",    back_populates="farmer", uselist=False, cascade="all, delete-orphan")
    farming_details = relationship("FarmerFarmingDetails", back_populates="farmer", uselist=False, cascade="all, delete-orphan")
    applications    = relationship("FarmerApplication",    back_populates="farmer", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────
# TABLE 2: farmer_address
# ─────────────────────────────────────────────────────────────
class FarmerAddress(FarmerBase):
    """
    Residential / farm address.
    One-to-one with Farmer (each farmer has one current address record).
    """
    __tablename__ = "farmer_address"

    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    farmer_id    = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Location hierarchy
    state        = Column(String(100), nullable=False, default="Maharashtra")
    district     = Column(String(100))
    taluka       = Column(String(100))
    village      = Column(String(100))
    pincode      = Column(String(10))
    full_address = Column(Text)

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    farmer       = relationship("Farmer", back_populates="address")


# ─────────────────────────────────────────────────────────────
# TABLE 3: farmer_land_details
# ─────────────────────────────────────────────────────────────
class FarmerLandDetails(FarmerBase):
    """
    Land parcel records.
    One farmer can have MULTIPLE land parcels (one-to-many).
    """
    __tablename__ = "farmer_land_details"

    id                   = Column(Integer, primary_key=True, index=True, autoincrement=True)
    farmer_id            = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False, index=True)

    survey_number        = Column(String(100))             # Gat / Survey no.
    land_area            = Column(Numeric(10, 4))          # Area in acres (4 decimal places)
    land_ownership_type  = Column(Enum(LandOwnershipEnum, native_enum=False), default=LandOwnershipEnum.owned)

    # Maharashtra-specific land records
    seven_twelve_number  = Column(String(100))             # 7/12 Satbara extract number
    eight_a_number       = Column(String(100))             # 8-A certificate number

    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    farmer               = relationship("Farmer", back_populates="land_details")


# ─────────────────────────────────────────────────────────────
# TABLE 4: farmer_bank_details
# ─────────────────────────────────────────────────────────────
class FarmerBankDetails(FarmerBase):
    """
    Bank account for Direct Benefit Transfer (DBT).
    One-to-one with Farmer.
    """
    __tablename__ = "farmer_bank_details"

    id              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    farmer_id       = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    account_number  = Column(String(30), nullable=False)
    ifsc_code       = Column(String(15), nullable=False)
    bank_name       = Column(String(200))
    branch_name     = Column(String(200))
    account_type    = Column(Enum(AccountTypeEnum, native_enum=False), default=AccountTypeEnum.savings)
    aadhaar_linked  = Column(Boolean, default=False)       # True = seeded with Aadhaar

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    farmer          = relationship("Farmer", back_populates="bank_details")


# ─────────────────────────────────────────────────────────────
# TABLE 5: farmer_farming_details
# ─────────────────────────────────────────────────────────────
class FarmerFarmingDetails(FarmerBase):
    """
    Agricultural practice information.
    One-to-one with Farmer.
    """
    __tablename__ = "farmer_farming_details"

    id                   = Column(Integer, primary_key=True, index=True, autoincrement=True)
    farmer_id            = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    primary_crop         = Column(String(200))             # e.g., Wheat, Onion, Cotton
    irrigation_type      = Column(Enum(IrrigationEnum, native_enum=False))
    farming_type         = Column(Enum(FarmingTypeEnum, native_enum=False))
    electricity_connection = Column(Boolean, default=False) # Has farm electricity connection

    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    farmer               = relationship("Farmer", back_populates="farming_details")


# ─────────────────────────────────────────────────────────────
# TABLE 6: applications  (scheme applications by farmers)
# ─────────────────────────────────────────────────────────────
class FarmerApplication(FarmerBase):
    """
    A farmer's application for a specific government scheme.
    scheme_id references the schemes table in the legacy DB
    (cross-DB reference kept as plain integer, not FK).
    """
    __tablename__ = "applications"

    id                 = Column(Integer, primary_key=True, index=True, autoincrement=True)
    farmer_id          = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False, index=True)

    # Cross-DB reference (scheme lives in legacy Agri_tech DB)
    scheme_id          = Column(Integer, nullable=False, index=True)
    scheme_name        = Column(String(300))               # denormalised for quick display

    application_status = Column(
        Enum(ApplicationStatusEnum, native_enum=False),
        default=ApplicationStatusEnum.submitted,
        nullable=False,
        index=True,
    )
    applied_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), onupdate=func.now())

    farmer             = relationship("Farmer", back_populates="applications")
    documents          = relationship("ApplicationDocument", back_populates="application", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────
# TABLE 7: application_documents
# ─────────────────────────────────────────────────────────────
class ApplicationDocument(FarmerBase):
    """
    Documents uploaded in support of a scheme application.
    Each application can have multiple documents of different types.
    """
    __tablename__ = "application_documents"

    id             = Column(Integer, primary_key=True, index=True, autoincrement=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)

    document_type  = Column(Enum(DocumentTypeEnum, native_enum=False), nullable=False)
    file_url       = Column(Text, nullable=False)          # S3 path or local /uploads/... path
    file_size      = Column(Integer)                       # bytes
    original_name  = Column(String(300))                   # original filename
    mime_type      = Column(String(100))                   # e.g. application/pdf, image/jpeg

    uploaded_at    = Column(DateTime(timezone=True), server_default=func.now())

    application    = relationship("FarmerApplication", back_populates="documents")
