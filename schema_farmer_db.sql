-- ============================================================
--  KisanSetu Smart Agriculture Administration System
--  DATABASE 1: FARMER DATABASE (farmer_db)
--  Author  : KisanSetu Dev Team
--  Created : 2026-04-03
--  Engine  : PostgreSQL 14+
--
--  TABLES (7):
--    1. farmers
--    2. farmer_address
--    3. farmer_land_details
--    4. farmer_bank_details
--    5. farmer_farming_details
--    6. applications
--    7. application_documents
-- ============================================================

-- ------------------------------------------------------------
-- Safety: Run this inside the 'farmer_db' database
-- ------------------------------------------------------------
-- CREATE DATABASE farmer_db;
-- \c farmer_db;

-- Enable UUID extension (optional, for UUID PKs)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS — Reusable domain types
-- ============================================================

CREATE TYPE gender_type       AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE category_type     AS ENUM ('SC', 'ST', 'OBC', 'General');
CREATE TYPE account_type      AS ENUM ('Savings', 'Current', 'Jan Dhan');
CREATE TYPE land_ownership    AS ENUM ('Owned', 'Leased', 'Shared', 'Government');
CREATE TYPE irrigation_type   AS ENUM ('Canal', 'Well', 'Borewell', 'Rain-fed', 'Drip', 'Sprinkler');
CREATE TYPE farming_type_enum AS ENUM ('Organic', 'Traditional', 'Mixed', 'Commercial');
CREATE TYPE app_status        AS ENUM ('submitted', 'under_review', 'approved', 'rejected');
CREATE TYPE doc_type          AS ENUM ('aadhaar', '7_12', 'bank', 'income', 'caste', 'electricity');

-- ============================================================
-- TABLE 1: farmers  (Main Farmer Profile)
-- ============================================================

CREATE TABLE IF NOT EXISTS farmers (
    id               SERIAL          PRIMARY KEY,

    -- Personal Information
    full_name        VARCHAR(150)    NOT NULL,
    father_name      VARCHAR(150),
    dob              DATE            NOT NULL,
    gender           gender_type     NOT NULL,
    mobile_number    VARCHAR(15)     NOT NULL,

    -- Identity
    aadhaar_number   CHAR(12)        NOT NULL UNIQUE,    -- 12-digit Aadhaar
    category         category_type   NOT NULL DEFAULT 'General',

    -- Financial
    annual_income    NUMERIC(12, 2)  CHECK (annual_income >= 0),
    bpl_status       BOOLEAN         NOT NULL DEFAULT FALSE,  -- Below Poverty Line

    -- AgriStack Unique Farmer ID (Government)
    agristack_id     VARCHAR(50)     UNIQUE,

    -- Audit
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by Aadhaar, mobile, AgriStack
CREATE INDEX idx_farmers_aadhaar     ON farmers (aadhaar_number);
CREATE INDEX idx_farmers_mobile      ON farmers (mobile_number);
CREATE INDEX idx_farmers_agristack   ON farmers (agristack_id);
CREATE INDEX idx_farmers_created_at  ON farmers (created_at DESC);

COMMENT ON TABLE  farmers                IS 'Core farmer profile table. One record per unique individual.';
COMMENT ON COLUMN farmers.aadhaar_number IS '12-digit Aadhaar number — must be unique per farmer.';
COMMENT ON COLUMN farmers.agristack_id   IS 'Farmer ID from Government AgriStack registry.';
COMMENT ON COLUMN farmers.bpl_status     IS 'TRUE = Below Poverty Line beneficiary.';

-- ============================================================
-- TABLE 2: farmer_address
-- ============================================================

CREATE TABLE IF NOT EXISTS farmer_address (
    id           SERIAL       PRIMARY KEY,
    farmer_id    INT          NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,

    -- Location Hierarchy (India)
    state        VARCHAR(100) NOT NULL,
    district     VARCHAR(100) NOT NULL,
    taluka       VARCHAR(100),
    village      VARCHAR(100),
    pincode      CHAR(6)      CHECK (pincode ~ '^\d{6}$'),

    -- Full denormalized address for display / search
    full_address TEXT,

    -- Audit
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_farmer_address_farmer_id ON farmer_address (farmer_id);
CREATE INDEX idx_farmer_address_district  ON farmer_address (district);
CREATE INDEX idx_farmer_address_pincode   ON farmer_address (pincode);

COMMENT ON TABLE farmer_address IS 'Residential / village address for each farmer.';

-- ============================================================
-- TABLE 3: farmer_land_details
-- ============================================================

CREATE TABLE IF NOT EXISTS farmer_land_details (
    id                   SERIAL               PRIMARY KEY,
    farmer_id            INT                  NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,

    -- Land Identity
    survey_number        VARCHAR(50),          -- Gat / Survey Number
    land_area            NUMERIC(10, 4),       -- in Hectares
    land_ownership_type  land_ownership        NOT NULL DEFAULT 'Owned',

    -- Government Land Records
    seven_twelve_number  VARCHAR(50),          -- 7/12 Utara Number (Maharashtra)
    eight_a_number       VARCHAR(50),          -- 8-A Record Number

    -- Audit
    created_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_land_farmer_id      ON farmer_land_details (farmer_id);
CREATE INDEX idx_land_survey_number  ON farmer_land_details (survey_number);

COMMENT ON TABLE  farmer_land_details               IS 'Agricultural land holdings for a farmer. One farmer may have multiple parcels.';
COMMENT ON COLUMN farmer_land_details.land_area     IS 'Land area in Hectares.';
COMMENT ON COLUMN farmer_land_details.seven_twelve_number IS 'Maharashtra 7/12 Satbara Utara extract reference number.';

-- ============================================================
-- TABLE 4: farmer_bank_details
-- ============================================================

CREATE TABLE IF NOT EXISTS farmer_bank_details (
    id               SERIAL         PRIMARY KEY,
    farmer_id        INT            NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,

    -- Bank Account
    account_number   VARCHAR(25)    NOT NULL,
    ifsc_code        VARCHAR(11)    NOT NULL CHECK (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
    bank_name        VARCHAR(150)   NOT NULL,
    branch_name      VARCHAR(150),
    account_type     account_type   NOT NULL DEFAULT 'Savings',

    -- Aadhaar Seeding
    aadhaar_linked   BOOLEAN        NOT NULL DEFAULT FALSE,

    -- Audit
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    -- Prevent duplicate account per farmer
    UNIQUE (farmer_id, account_number)
);

CREATE INDEX idx_bank_farmer_id      ON farmer_bank_details (farmer_id);
CREATE INDEX idx_bank_ifsc           ON farmer_bank_details (ifsc_code);
CREATE INDEX idx_bank_account_number ON farmer_bank_details (account_number);

COMMENT ON TABLE  farmer_bank_details              IS 'Bank account details for subsidy / DBT (Direct Benefit Transfer) payments.';
COMMENT ON COLUMN farmer_bank_details.ifsc_code    IS '11-character RBI IFSC code. Validated by regex.';
COMMENT ON COLUMN farmer_bank_details.aadhaar_linked IS 'TRUE = Aadhaar-seeded account eligible for DBT.';

-- ============================================================
-- TABLE 5: farmer_farming_details
-- ============================================================

CREATE TABLE IF NOT EXISTS farmer_farming_details (
    id                     SERIAL               PRIMARY KEY,
    farmer_id              INT                  NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,

    -- Crop & Method
    primary_crop           VARCHAR(100),
    irrigation_type        irrigation_type      DEFAULT 'Rain-fed',
    farming_type           farming_type_enum    DEFAULT 'Traditional',

    -- Infrastructure
    electricity_connection BOOLEAN              NOT NULL DEFAULT FALSE,

    -- Audit
    created_at             TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_farming_farmer_id ON farmer_farming_details (farmer_id);

COMMENT ON TABLE farmer_farming_details IS 'Agronomic profile: crops grown, irrigation method, farming approach.';

-- ============================================================
-- NOTE: 'schemes' table already exists in Agri_tech DB.
-- The FK below references it logically. In a shared DB setup,
-- ensure the schemes table is accessible or replicate as needed.
-- ============================================================

-- ============================================================
-- TABLE 6: applications  (Scheme Applications)
-- ============================================================

CREATE TABLE IF NOT EXISTS applications (
    id                 SERIAL       PRIMARY KEY,
    farmer_id          INT          NOT NULL REFERENCES farmers (id) ON DELETE RESTRICT,

    -- Scheme reference (FK to schemes table)
    scheme_id          INT          NOT NULL,   -- FK → schemes.id (in Agri_tech DB)

    -- Workflow State
    application_status app_status   NOT NULL DEFAULT 'submitted',

    -- Timestamps
    applied_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- One farmer can apply to a scheme only once (active)
    UNIQUE (farmer_id, scheme_id)
);

CREATE INDEX idx_applications_farmer_id  ON applications (farmer_id);
CREATE INDEX idx_applications_scheme_id  ON applications (scheme_id);
CREATE INDEX idx_applications_status     ON applications (application_status);
CREATE INDEX idx_applications_applied_at ON applications (applied_at DESC);

COMMENT ON TABLE  applications                    IS 'Farmer scheme application workflow tracker.';
COMMENT ON COLUMN applications.application_status IS 'submitted → under_review → approved | rejected.';

-- ============================================================
-- TABLE 7: application_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS application_documents (
    id              SERIAL       PRIMARY KEY,
    application_id  INT          NOT NULL REFERENCES applications (id) ON DELETE CASCADE,

    -- Document Metadata
    document_type   doc_type     NOT NULL,
    file_url        TEXT         NOT NULL,           -- S3 / MinIO / local path

    -- Audit
    uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_docs_application_id ON application_documents (application_id);
CREATE INDEX idx_app_docs_doc_type       ON application_documents (document_type);

COMMENT ON TABLE  application_documents          IS 'Uploaded supporting documents for scheme applications.';
COMMENT ON COLUMN application_documents.file_url IS 'Storage URL: S3 key, MinIO path, or local filesystem path.';

-- ============================================================
-- TRIGGER: Auto-update updated_at columns
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to all tables that have updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'farmers',
        'farmer_address',
        'farmer_land_details',
        'farmer_bank_details',
        'farmer_farming_details',
        'applications'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
            t, t
        );
    END LOOP;
END;
$$;

-- ============================================================
-- ANALYTICS VIEW: Farmer overview (used in Admin Dashboard)
-- ============================================================

CREATE OR REPLACE VIEW v_farmer_overview AS
SELECT
    f.id                                          AS farmer_id,
    f.full_name,
    f.aadhaar_number,
    f.mobile_number,
    f.category,
    f.bpl_status,
    fa.district,
    fa.state,
    fld.land_area,
    ffd.primary_crop,
    COUNT(a.id)                                   AS total_applications,
    SUM(CASE WHEN a.application_status = 'approved'     THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN a.application_status = 'rejected'     THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN a.application_status = 'under_review' THEN 1 ELSE 0 END) AS under_review_count,
    f.created_at
FROM
    farmers f
    LEFT JOIN farmer_address        fa  ON fa.farmer_id  = f.id
    LEFT JOIN farmer_land_details   fld ON fld.farmer_id = f.id
    LEFT JOIN farmer_farming_details ffd ON ffd.farmer_id = f.id
    LEFT JOIN applications           a  ON a.farmer_id   = f.id
GROUP BY
    f.id, f.full_name, f.aadhaar_number, f.mobile_number,
    f.category, f.bpl_status, fa.district, fa.state,
    fld.land_area, ffd.primary_crop, f.created_at;

COMMENT ON VIEW v_farmer_overview IS 'Denormalized farmer summary for admin dashboard and analytics.';

-- ============================================================
-- ANALYTICS VIEW: Application statistics per scheme
-- ============================================================

CREATE OR REPLACE VIEW v_scheme_application_stats AS
SELECT
    scheme_id,
    COUNT(*)                                                     AS total_applications,
    SUM(CASE WHEN application_status = 'submitted'    THEN 1 ELSE 0 END) AS submitted,
    SUM(CASE WHEN application_status = 'under_review' THEN 1 ELSE 0 END) AS under_review,
    SUM(CASE WHEN application_status = 'approved'     THEN 1 ELSE 0 END) AS approved,
    SUM(CASE WHEN application_status = 'rejected'     THEN 1 ELSE 0 END) AS rejected,
    ROUND(
        100.0 * SUM(CASE WHEN application_status = 'approved' THEN 1 ELSE 0 END)
              / NULLIF(COUNT(*), 0), 2
    )                                                            AS approval_rate_pct
FROM
    applications
GROUP BY
    scheme_id;

COMMENT ON VIEW v_scheme_application_stats IS 'Per-scheme application funnel and approval rate for analytics.';

-- ============================================================
-- END OF FARMER DATABASE SCHEMA
-- Total Tables: 7
-- ============================================================
