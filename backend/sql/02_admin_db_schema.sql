-- =============================================================
-- DATABASE 2: agri_admin_db
-- KisanSetu — AI Smart Agriculture Administration System
-- Admin Database: OCR, AI Verification & Decision Engine (6 Tables)
-- =============================================================
-- Run AFTER 01_farmer_db_schema.sql
-- PostgreSQL 14+
-- Usage:
--   psql -U postgres -c "CREATE DATABASE agri_admin_db;"
--   psql -U postgres -d agri_admin_db -f 02_admin_db_schema.sql
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enums handled as VARCHAR by SQLAlchemy (native_enum=False)


-- =============================================================
-- TABLE 1: ocr_documents
-- =============================================================
-- One record per uploaded document per application.
-- Stores the full raw text blob from PaddleOCR.
-- application_id matches application_documents.id in agri_farmer_db.
-- =============================================================
CREATE TABLE IF NOT EXISTS ocr_documents (
    id              SERIAL          PRIMARY KEY,

    -- Cross-DB references (no FK constraint — different DB)
    application_id  INTEGER         NOT NULL,             -- applications.id in agri_farmer_db
    document_id     INTEGER,                              -- application_documents.id

    -- Document info
    document_type   VARCHAR(50)     NOT NULL,             -- aadhaar / 7_12 / bank / income / caste / electricity
    file_url        TEXT,                                 -- path used as OCR input

    -- OCR output
    raw_text        TEXT,                                 -- full concatenated OCR text (may be several KB)
    ocr_status      VARCHAR(50)     DEFAULT 'pending'     NOT NULL,
    ocr_engine      VARCHAR(50)     DEFAULT 'PaddleOCR',
    confidence_avg  FLOAT           DEFAULT 0.0,          -- mean confidence score (0.0–1.0)

    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

COMMENT ON TABLE  ocr_documents             IS 'Raw PaddleOCR output — one row per (application, document_type)';
COMMENT ON COLUMN ocr_documents.raw_text    IS 'Full concatenated OCR text; may contain 1–5 KB per document';
COMMENT ON COLUMN ocr_documents.confidence_avg IS 'Mean confidence reported by PaddleOCR across all text regions';

CREATE INDEX IF NOT EXISTS idx_ocr_docs_app    ON ocr_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_ocr_docs_type   ON ocr_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_ocr_docs_status ON ocr_documents(ocr_status);


-- =============================================================
-- TABLE 2: ocr_extracted_fields
-- =============================================================
-- One row per (application, field_name).
-- Field names extracted from OCR raw text using regex / NLP.
--
-- Standard field names:
--   name, father_name, dob, gender, aadhaar_number,
--   mobile_number, address, pincode, district, state,
--   survey_number, land_area, seven_twelve_number,
--   account_number, ifsc_code, bank_name,
--   annual_income, category
-- =============================================================
CREATE TABLE IF NOT EXISTS ocr_extracted_fields (
    id               SERIAL       PRIMARY KEY,
    ocr_document_id  INTEGER      NOT NULL REFERENCES ocr_documents(id) ON DELETE CASCADE,
    application_id   INTEGER      NOT NULL,               -- denormalised for fast dashboard queries

    document_type    VARCHAR(50),
    field_name       VARCHAR(100) NOT NULL,               -- standardised canonical name
    field_value      TEXT,                                -- raw extracted string
    confidence       FLOAT        DEFAULT 0.0,            -- field-level extraction confidence (0.0–1.0)
    normalized_value TEXT,                                -- cleaned / formatted value

    created_at       TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  ocr_extracted_fields             IS 'Individual field values parsed from OCR raw text';
COMMENT ON COLUMN ocr_extracted_fields.field_name  IS 'Canonical name — must match field_comparisons.field_name';
COMMENT ON COLUMN ocr_extracted_fields.normalized_value IS 'Post-processed value (spaces removed, case-normalised)';

CREATE INDEX IF NOT EXISTS idx_ext_fields_app     ON ocr_extracted_fields(application_id);
CREATE INDEX IF NOT EXISTS idx_ext_fields_doc     ON ocr_extracted_fields(ocr_document_id);
CREATE INDEX IF NOT EXISTS idx_ext_fields_name    ON ocr_extracted_fields(field_name);


-- =============================================================
-- TABLE 3: field_comparisons
-- =============================================================
-- Core comparison engine table.
-- Each row compares ONE field from the farmer's form vs ONE
-- field extracted by OCR, using fuzzy string matching.
--
-- Scoring weights per field:
--   aadhaar_number → 1.00 (exact match expected)
--   name           → 0.90 (fuzzy, spelling variants allowed)
--   land_area      → 0.85 (numeric comparison)
--   account_number → 0.85
--   annual_income  → 0.70
--   address        → 0.65
--   (all others)   → 0.60
-- =============================================================
CREATE TABLE IF NOT EXISTS field_comparisons (
    id               SERIAL            PRIMARY KEY,
    application_id   INTEGER           NOT NULL,

    field_name       VARCHAR(100)      NOT NULL,
    farmer_value     TEXT,                               -- from agri_farmer_db (form input)
    ocr_value        TEXT,                               -- from ocr_extracted_fields
    match_percentage FLOAT             DEFAULT 0.0,      -- 0.0 – 100.0 (RapidFuzz ratio)
    status           VARCHAR(50)       DEFAULT 'not_found',

    -- Weight applied in overall_score calculation
    field_weight     FLOAT             DEFAULT 0.60,

    created_at       TIMESTAMPTZ       DEFAULT NOW(),
    updated_at       TIMESTAMPTZ
);

COMMENT ON TABLE  field_comparisons                IS 'Field-by-field comparison: farmer form vs OCR extracted value';
COMMENT ON COLUMN field_comparisons.match_percentage IS '0 = no match, 100 = exact match (fuzzy string ratio)';
COMMENT ON COLUMN field_comparisons.field_weight   IS 'Weight applied when computing weighted overall_score in ai_scores';

CREATE INDEX IF NOT EXISTS idx_comparisons_app    ON field_comparisons(application_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_status ON field_comparisons(status);
CREATE UNIQUE INDEX IF NOT EXISTS uix_comparison  ON field_comparisons(application_id, field_name);


-- =============================================================
-- TABLE 4: ai_scores
-- =============================================================
-- AI scoring per application.
--
-- overall_score = Σ(field_weight × match_pct) / Σ(field_weight)
--
-- Decision thresholds:
--   overall_score ≥ 90  →  recommendation = 'approve'
--   overall_score 70-89 →  recommendation = 'review'
--   overall_score  < 70 →  recommendation = 'reject'
-- =============================================================
CREATE TABLE IF NOT EXISTS ai_scores (
    id                   SERIAL            PRIMARY KEY,
    application_id       INTEGER           NOT NULL UNIQUE,

    -- Dimension scores (0–100)
    aadhaar_score        FLOAT DEFAULT 0.0,
    name_score           FLOAT DEFAULT 0.0,
    land_score           FLOAT DEFAULT 0.0,
    bank_score           FLOAT DEFAULT 0.0,
    income_score         FLOAT DEFAULT 0.0,
    address_score        FLOAT DEFAULT 0.0,

    -- Aggregates
    overall_score        FLOAT DEFAULT 0.0,              -- weighted average
    approval_probability FLOAT DEFAULT 0.0,              -- 0–100
    fraud_risk           FLOAT DEFAULT 0.0,              -- 0–100 (higher = riskier)
    confidence_score     FLOAT DEFAULT 0.0,              -- AI model confidence 0–100

    -- Flags
    duplicate_aadhaar    BOOLEAN DEFAULT FALSE,
    positive_factors     JSONB,                          -- e.g. ["Aadhaar match", "Name match"]
    risk_factors         JSONB,                          -- e.g. ["Land area mismatch"]

    -- AI recommendation
    recommendation       VARCHAR(50),

    computed_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ
);

COMMENT ON TABLE  ai_scores                      IS 'AI weighted scoring per application — computed after all field_comparisons';
COMMENT ON COLUMN ai_scores.overall_score        IS 'Weighted avg of all field match scores (0-100)';
COMMENT ON COLUMN ai_scores.fraud_risk           IS 'Higher value = higher suspicion of fraud (0-100)';
COMMENT ON COLUMN ai_scores.positive_factors     IS 'JSONB array: list of matched/strong fields';
COMMENT ON COLUMN ai_scores.risk_factors         IS 'JSONB array: list of mismatched/weak fields';

CREATE INDEX IF NOT EXISTS idx_ai_scores_app        ON ai_scores(application_id);
CREATE INDEX IF NOT EXISTS idx_ai_scores_decision   ON ai_scores(recommendation);
CREATE INDEX IF NOT EXISTS idx_ai_scores_score      ON ai_scores(overall_score DESC);


-- =============================================================
-- TABLE 5: verification_summary
-- =============================================================
-- One consolidated record per application that the admin dashboard
-- queries. Aggregates all field counts + scores into a single row.
-- =============================================================
CREATE TABLE IF NOT EXISTS verification_summary (
    id                SERIAL            PRIMARY KEY,
    application_id    INTEGER           NOT NULL UNIQUE,

    -- Farmer identity (denormalised from Farmer DB)
    farmer_id         INTEGER,
    farmer_name       VARCHAR(200),

    -- Field-level counts
    total_fields      INTEGER DEFAULT 0,
    matched_fields    INTEGER DEFAULT 0,
    mismatched_fields INTEGER DEFAULT 0,
    not_found_fields  INTEGER DEFAULT 0,

    -- Scores (copied from ai_scores for quick joins)
    overall_score     FLOAT   DEFAULT 0.0,
    fraud_risk        FLOAT   DEFAULT 0.0,

    -- AI decision
    final_decision    VARCHAR(50)       NOT NULL,
    decision_reason   TEXT,

    -- Human override
    admin_override    BOOLEAN DEFAULT FALSE,
    admin_decision    VARCHAR(50),
    override_reason   TEXT,

    verified_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE  verification_summary             IS 'Consolidated verification outcome — primary admin dashboard table';
COMMENT ON COLUMN verification_summary.admin_override IS 'TRUE = admin manually overrode the AI decision';

CREATE INDEX IF NOT EXISTS idx_vsummary_app        ON verification_summary(application_id);
CREATE INDEX IF NOT EXISTS idx_vsummary_decision   ON verification_summary(final_decision);
CREATE INDEX IF NOT EXISTS idx_vsummary_override   ON verification_summary(admin_override);
CREATE INDEX IF NOT EXISTS idx_vsummary_score      ON verification_summary(overall_score DESC);


-- =============================================================
-- TABLE 6: admin_actions  (immutable audit trail)
-- =============================================================
-- Every action an admin takes is INSERT-only — no updates.
-- admin_id references farmer_users.id in the legacy Agri_tech DB.
-- =============================================================
CREATE TABLE IF NOT EXISTS admin_actions (
    id             SERIAL            PRIMARY KEY,

    -- Who acted
    admin_id       INTEGER           NOT NULL,             -- farmer_users.id (admin role)
    admin_name     VARCHAR(200),                           -- denormalised snapshot

    -- What was acted on
    application_id INTEGER           NOT NULL,

    -- Action
    action         VARCHAR(50)       NOT NULL,
    remarks        TEXT,
    metadata_json  JSONB,                                  -- flexible extra payload

    timestamp      TIMESTAMPTZ       DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE  admin_actions IS 'Immutable audit log — every admin decision recorded here; INSERT-only';

CREATE INDEX IF NOT EXISTS idx_admin_actions_app    ON admin_actions(application_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin  ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_ts     ON admin_actions(timestamp DESC);


-- =============================================================
-- ANALYTICS VIEWS  (admin dashboard)
-- =============================================================

-- 1. Pending verifications
CREATE OR REPLACE VIEW v_pending_verifications AS
SELECT
    vs.application_id,
    vs.farmer_name,
    vs.overall_score,
    vs.fraud_risk,
    vs.total_fields,
    vs.matched_fields,
    vs.mismatched_fields,
    vs.verified_at
FROM verification_summary vs
WHERE vs.final_decision = 'review'
  AND vs.admin_override = FALSE
ORDER BY vs.fraud_risk DESC, vs.verified_at;

-- 2. Fraud detection summary
CREATE OR REPLACE VIEW v_fraud_summary AS
SELECT
    COUNT(*)                                                              AS total_verified,
    COUNT(*) FILTER (WHERE fraud_risk >= 70)                             AS high_risk_count,
    COUNT(*) FILTER (WHERE fraud_risk >= 40 AND fraud_risk < 70)         AS medium_risk_count,
    COUNT(*) FILTER (WHERE fraud_risk  < 40)                             AS low_risk_count,
    ROUND(AVG(fraud_risk)::NUMERIC, 2)                                   AS avg_fraud_risk,
    COUNT(*) FILTER (WHERE final_decision = 'approve')                   AS ai_approved,
    COUNT(*) FILTER (WHERE final_decision = 'review')                    AS ai_review,
    COUNT(*) FILTER (WHERE final_decision = 'reject')                    AS ai_rejected,
    COUNT(*) FILTER (WHERE admin_override = TRUE)                        AS manually_overridden
FROM verification_summary;

-- 3. Field match rate (which fields match most / least)
CREATE OR REPLACE VIEW v_field_match_rates AS
SELECT
    field_name,
    COUNT(*)                                                              AS total_comparisons,
    COUNT(*) FILTER (WHERE status = 'match')                             AS matched,
    COUNT(*) FILTER (WHERE status = 'mismatch')                          AS mismatched,
    COUNT(*) FILTER (WHERE status = 'partial')                           AS partial,
    ROUND(AVG(match_percentage)::NUMERIC, 2)                             AS avg_match_pct,
    AVG(field_weight)                                                    AS weight
FROM field_comparisons
GROUP BY field_name
ORDER BY avg_match_pct ASC;

-- 4. AI score distribution
CREATE OR REPLACE VIEW v_ai_score_distribution AS
SELECT
    CASE
        WHEN overall_score >= 90 THEN 'High (≥90)'
        WHEN overall_score >= 70 THEN 'Medium (70-89)'
        ELSE 'Low (<70)'
    END                                                                   AS score_band,
    COUNT(*)                                                              AS applications,
    ROUND(AVG(overall_score)::NUMERIC, 2)                                AS avg_score,
    ROUND(AVG(fraud_risk)::NUMERIC, 2)                                   AS avg_fraud_risk
FROM ai_scores
GROUP BY score_band
ORDER BY avg_score DESC;

-- 5. Admin action audit
CREATE OR REPLACE VIEW v_admin_audit AS
SELECT
    aa.timestamp,
    aa.admin_name,
    aa.application_id,
    aa.action,
    aa.remarks,
    vs.farmer_name,
    vs.overall_score,
    vs.final_decision                                                     AS ai_decision
FROM admin_actions  aa
LEFT JOIN verification_summary vs ON vs.application_id = aa.application_id
ORDER BY aa.timestamp DESC;
