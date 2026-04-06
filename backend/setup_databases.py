"""
setup_databases.py
------------------
One-shot script to create & initialise BOTH PostgreSQL databases:

  1. agri_farmer_db  => farmer raw data (7 tables)
  2. agri_admin_db   => OCR / AI / verification (6 tables)

Also applies schemas using SQLAlchemy (FarmerBase + AdminBase).

Usage:
    cd backend
    python setup_databases.py

Requirements:
    pip install sqlalchemy psycopg2-binary python-dotenv
"""

import os
import sys

# Force UTF-8 output to avoid Windows charmap errors
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv()

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

from database import (
    farmer_engine, FarmerBase,
    admin_engine,  AdminBase,
    engine,        Base,
)

import farmer_models   # noqa: F401  registers Farmer DB tables
import admin_models    # noqa: F401  registers Admin DB tables
import models          # noqa: F401  registers legacy tables

PG_USER = os.getenv("FARMER_DB_USER",     "postgres")
PG_PASS = os.getenv("FARMER_DB_PASSWORD", "root")
PG_HOST = os.getenv("FARMER_DB_HOST",     "localhost")
PG_PORT = int(os.getenv("FARMER_DB_PORT", "5432"))

FARMER_DB = os.getenv("FARMER_DB_NAME", "agri_farmer_db")
ADMIN_DB  = os.getenv("ADMIN_DB_NAME",  "agri_admin_db")
LEGACY_DB = os.getenv("DB_NAME",        "Agri_tech")


def connect_postgres(dbname="postgres"):
    conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT,
        user=PG_USER, password=PG_PASS,
        dbname=dbname,
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    return conn


def create_db_if_missing(dbname: str):
    try:
        conn = connect_postgres("postgres")
        cur  = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (dbname,))
        exists = cur.fetchone()
        if exists:
            print("  [OK] Database '{}' already exists - skipping.".format(dbname))
        else:
            cur.execute('CREATE DATABASE "{}"'.format(dbname))
            print("  [CREATED] Database '{}'".format(dbname))
        cur.close()
        conn.close()
    except Exception as exc:
        print("  [ERROR] Could not create '{}': {}".format(dbname, exc))
        raise


def run_sql_file(filepath: str, dbname: str):
    if not os.path.isfile(filepath):
        print("  [SKIP] SQL file not found: {}".format(filepath))
        return
    try:
        conn = connect_postgres(dbname)
        cur  = conn.cursor()
        with open(filepath, "r", encoding="utf-8") as f:
            sql = f.read()
        cur.execute(sql)
        cur.close()
        conn.close()
        print("  [OK] Applied {} => {}".format(os.path.basename(filepath), dbname))
    except Exception as exc:
        print("  [WARN] {} on '{}': {}".format(os.path.basename(filepath), dbname, exc))


def create_sqlalchemy_tables():
    print("\n[STEP 3] Creating SQLAlchemy ORM tables ...")

    try:
        FarmerBase.metadata.create_all(bind=farmer_engine)
        farmer_tables = list(FarmerBase.metadata.tables.keys())
        print("  [OK] Farmer DB tables created: {}".format(", ".join(farmer_tables)))
    except Exception as exc:
        print("  [ERROR] Farmer DB: {}".format(exc))

    try:
        AdminBase.metadata.create_all(bind=admin_engine)
        admin_tables = list(AdminBase.metadata.tables.keys())
        print("  [OK] Admin DB tables created:  {}".format(", ".join(admin_tables)))
    except Exception as exc:
        print("  [ERROR] Admin DB: {}".format(exc))

    try:
        Base.metadata.create_all(bind=engine)
        print("  [OK] Legacy DB tables created ({})".format(LEGACY_DB))
    except Exception as exc:
        print("  [WARN] Legacy DB: {}".format(exc))


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sql_dir  = os.path.join(base_dir, "sql")

    print("=" * 58)
    print("  KisanSetu - Dual Database Setup")
    print("=" * 58)

    # Step 1 - Create databases
    print("\n[STEP 1] Creating PostgreSQL databases ...")
    create_db_if_missing(LEGACY_DB)
    create_db_if_missing(FARMER_DB)
    create_db_if_missing(ADMIN_DB)

    # Step 2 - Apply raw SQL schema files
    print("\n[STEP 2] Applying SQL schema files ...")
    run_sql_file(os.path.join(sql_dir, "01_farmer_db_schema.sql"), FARMER_DB)
    run_sql_file(os.path.join(sql_dir, "02_admin_db_schema.sql"),  ADMIN_DB)

    # Step 3 - SQLAlchemy create_all (safe, idempotent)
    create_sqlalchemy_tables()

    print("\n" + "=" * 58)
    print("  Setup complete!")
    print("")
    print("  Farmer DB  : postgresql://{}:{}/{}".format(PG_HOST, PG_PORT, FARMER_DB))
    print("  Admin DB   : postgresql://{}:{}/{}".format(PG_HOST, PG_PORT, ADMIN_DB))
    print("  Legacy DB  : postgresql://{}:{}/{}".format(PG_HOST, PG_PORT, LEGACY_DB))
    print("=" * 58)
    print("")
    print("  Tables summary:")
    print("    Farmer DB  (agri_farmer_db)  - 7 tables")
    print("      farmers, farmer_address, farmer_land_details,")
    print("      farmer_bank_details, farmer_farming_details,")
    print("      applications, application_documents")
    print("")
    print("    Admin DB   (agri_admin_db)   - 6 tables")
    print("      ocr_documents, ocr_extracted_fields,")
    print("      field_comparisons, ai_scores,")
    print("      verification_summary, admin_actions")
    print("")
    print("    Legacy DB  (Agri_tech)       - existing tables")
    print("=" * 58)


if __name__ == "__main__":
    main()
