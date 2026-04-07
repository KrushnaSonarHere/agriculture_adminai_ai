"""
database.py
───────────
Dual-database configuration for the KisanSetu AI Agriculture System.

  ┌─────────────────────────────────────────┐
  │  FARMER DB  (agri_farmer_db)            │
  │  Raw farmer form submissions            │
  │  7 tables: farmers, address, land,      │
  │            bank, farming, applications, │
  │            application_documents        │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │  ADMIN DB   (agri_admin_db)             │
  │  OCR results, AI decisions, admin ops   │
  │  6 tables: ocr_documents,               │
  │            ocr_extracted_fields,        │
  │            field_comparisons,           │
  │            ai_scores,                   │
  │            verification_summary,        │
  │            admin_actions               │
  └─────────────────────────────────────────┘

Usage in FastAPI routes:
    from database import get_farmer_db, get_admin_db
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

# ─────────────────────────────────────────────────────────────
def _url(user, pw, host, port, dbname):
    # If a global DATABASE_URL is provided (like on Render), use it for everything
    render_url = os.getenv("DATABASE_URL")
    if render_url:
        # Render sometimes provides 'postgres://', SQLAlchemy needs 'postgresql://'
        if render_url.startswith("postgres://"):
            render_url = render_url.replace("postgres://", "postgresql://", 1)
        return render_url

    # Otherwise fallback to local PostgreSQL credentials
    return f"postgresql://{user}:{pw}@{host}:{port}/{dbname}"

# Postgres specific arguments
engine_kwargs = {
    "pool_pre_ping": True
}


# ─────────────────────────────────────────────────────────────
# DATABASE 1  — Farmer DB  (raw submissions)
# ─────────────────────────────────────────────────────────────
FARMER_DB_URL = _url(
    user   = os.getenv("FARMER_DB_USER",     "postgres"),
    pw     = os.getenv("FARMER_DB_PASSWORD", "root"),
    host   = os.getenv("FARMER_DB_HOST",     "localhost"),
    port   = os.getenv("FARMER_DB_PORT",     "5432"),
    dbname = os.getenv("FARMER_DB_NAME",     "agri_farmer_db"),
)

farmer_engine      = create_engine(FARMER_DB_URL, **engine_kwargs)
FarmerSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=farmer_engine)
FarmerBase         = declarative_base()


# ─────────────────────────────────────────────────────────────
# DATABASE 2  — Admin DB  (OCR / AI / verification)
# ─────────────────────────────────────────────────────────────
ADMIN_DB_URL = _url(
    user   = os.getenv("ADMIN_DB_USER",     "postgres"),
    pw     = os.getenv("ADMIN_DB_PASSWORD", "root"),
    host   = os.getenv("ADMIN_DB_HOST",     "localhost"),
    port   = os.getenv("ADMIN_DB_PORT",     "5432"),
    dbname = os.getenv("ADMIN_DB_NAME",     "agri_admin_db"),
)

admin_engine      = create_engine(ADMIN_DB_URL, **engine_kwargs)
AdminSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=admin_engine)
AdminBase         = declarative_base()


# ─────────────────────────────────────────────────────────────
# Legacy single-DB  (kept for existing routers that still use it)
# ─────────────────────────────────────────────────────────────
LEGACY_DB_URL = _url(
    user   = os.getenv("DB_USER",     "postgres"),
    pw     = os.getenv("DB_PASSWORD", "root"),
    host   = os.getenv("DB_HOST",     "localhost"),
    port   = os.getenv("DB_PORT",     "5432"),
    dbname = os.getenv("DB_NAME",     "Agri_tech"),
)

engine        = create_engine(LEGACY_DB_URL, **engine_kwargs)
SessionLocal  = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base          = declarative_base()


# ─────────────────────────────────────────────────────────────
# FastAPI dependency injection helpers
# ─────────────────────────────────────────────────────────────
def get_db():
    """Legacy DB session (used by existing auth/applications/etc. routers)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_farmer_db():
    """Farmer DB session — raw farmer submissions."""
    db = FarmerSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_admin_db():
    """Admin DB session — OCR results, AI decisions, admin actions."""
    db = AdminSessionLocal()
    try:
        yield db
    finally:
        db.close()
