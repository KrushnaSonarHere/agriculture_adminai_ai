-- =============================================================
-- DATABASE 1: agri_farmer_db
-- KisanSetu — AI Smart Agriculture Administration System
-- Farmer Database: Raw Farmer Submissions (7 Tables)
-- =============================================================
-- Run order: execute this file first, then 02_admin_db_schema.sql
-- PostgreSQL 14+
-- Usage:
--   psql -U postgres -c "CREATE DATABASE agri_farmer_db;"
--   psql -U postgres -d agri_farmer_db -f 01_farmer_db_schema.sql
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for fuzzy text search

-- Enums handled as VARCHAR by SQLAlchemy (native_enum=False)


-- =============================================================
-- TABLE 1: farmers  (core identity & profile)
-- =============================================================
CREATE TABLE IF NOT EXISTS farmers (
    id              SERIAL          PRIMARY KEY,
    full_name       VARCHAR(200)    NOT NULL,
    father_name     VARCHAR(200),
    dob             VARCHAR(20),                        -- DD-MM-YYYY
    gender          VARCHAR(50),
    mobile_number   VARCHAR(15)     NOT NULL UNIQUE,
    aadhaar_number  VARCHAR(20)     NOT NULL UNIQUE,

    -- Classification
    category        VARCHAR(50)     DEFAULT 'General',
    annual_income   NUMERIC(12,2),
    bpl_status      BOOLEAN         DEFAULT FALSE,      -- BPL card holder
    agristack_id    VARCHAR(50)     UNIQUE,             -- GOI AgriStack digital ID

    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

COMMENT ON TABLE  farmers                  IS 'Core identity table for every registered farmer';
COMMENT ON COLUMN farmers.aadhaar_number   IS 'Aadhaar UID — UNIQUE, used as primary identity key';
COMMENT ON COLUMN farmers.agristack_id     IS 'GOI AgriStack / Kisan ID digital identifier';

CREATE INDEX IF NOT EXISTS idx_farmers_mobile   ON farmers(mobile_number);
CREATE INDEX IF NOT EXISTS idx_farmers_aadhaar  ON farmers(aadhaar_number);
CREATE INDEX IF NOT EXISTS idx_farmers_name_trgm ON farmers USING gin(full_name gin_trgm_ops);


-- =============================================================
-- TABLE 2: farmer_address
-- =============================================================
CREATE TABLE IF NOT EXISTS farmer_address (
    id           SERIAL       PRIMARY KEY,
    farmer_id    INTEGER      NOT NULL UNIQUE REFERENCES farmers(id) ON DELETE CASCADE,

    state        VARCHAR(100) NOT NULL DEFAULT 'Maharashtra',
    district     VARCHAR(100),
    taluka       VARCHAR(100),
    village      VARCHAR(100),
    pincode      VARCHAR(10),
    full_address TEXT,

    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ
);

COMMENT ON TABLE farmer_address IS 'Residential or farm address — one-to-one with farmers';
CREATE INDEX IF NOT EXISTS idx_farmer_address_district ON farmer_address(district);


-- =============================================================
-- TABLE 3: farmer_land_details  (one farmer → many parcels)
-- =============================================================
CREATE TABLE IF NOT EXISTS farmer_land_details (
    id                   SERIAL            PRIMARY KEY,
    farmer_id            INTEGER           NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,

    survey_number        VARCHAR(100),                       -- Gat / Survey number
    land_area            NUMERIC(10,4),                      -- acres, 4 decimal precision
    land_ownership_type  VARCHAR(50)       DEFAULT 'owned',

    -- Maharashtra-specific land record numbers
    seven_twelve_number  VARCHAR(100),                       -- 7/12 Satbara extract
    eight_a_number       VARCHAR(100),                       -- 8-A certificate

    created_at           TIMESTAMPTZ       DEFAULT NOW(),
    updated_at           TIMESTAMPTZ
);

COMMENT ON TABLE  farmer_land_details                IS 'Land parcels — one farmer can have multiple records';
COMMENT ON COLUMN farmer_land_details.land_area      IS 'Area in acres (4-decimal precision for micro-parcels)';
COMMENT ON COLUMN farmer_land_details.seven_twelve_number IS 'Maharashtra 7/12 Satbara extract number';

CREATE INDEX IF NOT EXISTS idx_land_farmer ON farmer_land_details(farmer_id);


-- =============================================================
-- TABLE 4: farmer_bank_details  (one-to-one, for DBT)
-- =============================================================
CREATE TABLE IF NOT EXISTS farmer_bank_details (
    id              SERIAL            PRIMARY KEY,
    farmer_id       INTEGER           NOT NULL UNIQUE REFERENCES farmers(id) ON DELETE CASCADE,

    account_number  VARCHAR(30)       NOT NULL,
    ifsc_code       VARCHAR(15)       NOT NULL,
    bank_name       VARCHAR(200),
    branch_name     VARCHAR(200),
    account_type    VARCHAR(50)       DEFAULT 'savings',
    aadhaar_linked  BOOLEAN           DEFAULT FALSE,    -- Aadhaar seeded with NPCI

    created_at      TIMESTAMPTZ       DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

COMMENT ON TABLE  farmer_bank_details              IS 'Bank account for Direct Benefit Transfer (DBT)';
COMMENT ON COLUMN farmer_bank_details.aadhaar_linked IS 'TRUE = bank account seeded with Aadhaar in NPCI mapper';


-- =============================================================
-- TABLE 5: farmer_farming_details  (one-to-one)
-- =============================================================
CREATE TABLE IF NOT EXISTS farmer_farming_details (
    id                     SERIAL             PRIMARY KEY,
    farmer_id              INTEGER            NOT NULL UNIQUE REFERENCES farmers(id) ON DELETE CASCADE,

    primary_crop           VARCHAR(200),                    -- e.g. Wheat, Onion, Cotton
    irrigation_type        VARCHAR(50),
    farming_type           VARCHAR(50),
    electricity_connection BOOLEAN            DEFAULT FALSE, -- farm has electricity

    created_at             TIMESTAMPTZ        DEFAULT NOW(),
    updated_at             TIMESTAMPTZ
);

COMMENT ON TABLE farmer_farming_details IS 'Agricultural practice info — one-to-one with farmers';


-- =============================================================
-- TABLE 6: applications  (farmer → scheme application)
-- =============================================================
CREATE TABLE IF NOT EXISTS applications (
    id                 SERIAL          PRIMARY KEY,
    farmer_id          INTEGER         NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,

    -- Cross-DB reference: scheme_id lives in Agri_tech.schemes
    scheme_id          INTEGER         NOT NULL,
    scheme_name        VARCHAR(300),                        -- denormalised for display speed

    application_status VARCHAR(50)     NOT NULL DEFAULT 'submitted',

    applied_at         TIMESTAMPTZ     DEFAULT NOW(),
    updated_at         TIMESTAMPTZ
);

COMMENT ON TABLE  applications                   IS 'A farmer''s application for a government scheme';
COMMENT ON COLUMN applications.scheme_id         IS 'FK to schemes table in agri_admin_db (cross-DB, no constraint)';
COMMENT ON COLUMN applications.application_status IS 'submitted → under_review → approved / rejected';

CREATE INDEX IF NOT EXISTS idx_apps_farmer        ON applications(farmer_id);
CREATE INDEX IF NOT EXISTS idx_apps_scheme        ON applications(scheme_id);
CREATE INDEX IF NOT EXISTS idx_apps_status        ON applications(application_status);
CREATE INDEX IF NOT EXISTS idx_apps_applied_at    ON applications(applied_at DESC);


-- =============================================================
-- TABLE 7: application_documents
-- =============================================================
CREATE TABLE IF NOT EXISTS application_documents (
    id             SERIAL          PRIMARY KEY,
    application_id INTEGER         NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    document_type  VARCHAR(50)     NOT NULL,
    file_url       TEXT            NOT NULL,                -- /uploads/<user_id>/<filename>
    file_size      INTEGER,                                 -- bytes
    original_name  VARCHAR(300),                            -- original filename
    mime_type      VARCHAR(100),                            -- image/jpeg, application/pdf, etc.

    uploaded_at    TIMESTAMPTZ     DEFAULT NOW()
);

COMMENT ON TABLE  application_documents          IS 'Supporting documents uploaded per application';
COMMENT ON COLUMN application_documents.file_url IS 'Server path or S3 URL — passed to PaddleOCR engine';

CREATE INDEX IF NOT EXISTS idx_docs_application ON application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_docs_type        ON application_documents(document_type);


-- =============================================================
-- ANALYTICS VIEWS  (optimise dashboard queries)
-- =============================================================

-- View: total applications per scheme
CREATE OR REPLACE VIEW v_applications_per_scheme AS
SELECT
    scheme_id,
    scheme_name,
    COUNT(*)                                                         AS total_applications,
    COUNT(*) FILTER (WHERE application_status = 'approved')         AS approved,
    COUNT(*) FILTER (WHERE application_status = 'rejected')         AS rejected,
    COUNT(*) FILTER (WHERE application_status = 'under_review')     AS under_review,
    COUNT(*) FILTER (WHERE application_status = 'submitted')        AS submitted,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE application_status = 'approved') / NULLIF(COUNT(*), 0), 2
    )                                                                AS approval_rate_pct
FROM applications
GROUP BY scheme_id, scheme_name;

-- View: farmer registration summary
CREATE OR REPLACE VIEW v_farmer_summary AS
SELECT
    COUNT(*)                                                         AS total_farmers,
    COUNT(*) FILTER (WHERE bpl_status = TRUE)                       AS bpl_farmers,
    COUNT(*) FILTER (WHERE category = 'SC')                         AS sc_farmers,
    COUNT(*) FILTER (WHERE category = 'ST')                         AS st_farmers,
    COUNT(*) FILTER (WHERE category = 'OBC')                        AS obc_farmers,
    COUNT(*) FILTER (WHERE category = 'General')                    AS general_farmers
FROM farmers;

-- View: district-wise registration count
CREATE OR REPLACE VIEW v_district_registrations AS
SELECT
    fa.district,
    fa.state,
    COUNT(DISTINCT f.id)                                             AS total_farmers,
    COUNT(DISTINCT a.id)                                             AS total_applications
FROM farmers f
LEFT JOIN farmer_address   fa ON fa.farmer_id = f.id
LEFT JOIN applications     a  ON a.farmer_id  = f.id
GROUP BY fa.district, fa.state
ORDER BY total_farmers DESC;
