-- ============================================================
--  KisanSetu Smart Agriculture Administration System
--  DATABASE 2: ADMIN DATABASE (admin_db)
--  Author  : KisanSetu Dev Team
--  Created : 2026-04-03
--  Engine  : PostgreSQL 14+
--
--  TABLES (6):
--    1. ocr_documents
--    2. ocr_extracted_fields
--    3. field_comparisons
--    4. ai_scores
--    5. verification_summary
--    6. admin_actions
-- ============================================================

-- ------------------------------------------------------------
-- Safety: Run this inside the 'admin_db' database
-- ------------------------------------------------------------
-- CREATE DATABASE admin_db;
-- \c admin_db;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS — Admin-specific domain types
-- ============================================================

CREATE TYPE comparison_status AS ENUM ('match', 'mismatch', 'partial');
CREATE TYPE final_decision     AS ENUM ('approve', 'review', 'reject');
CREATE TYPE admin_action_type  AS ENUM ('approve', 'reject', 'flag', 'request_resubmit', 'escalate');
CREATE TYPE ocr_doc_type       AS ENUM ('aadhaar', '7_12', 'bank', 'income', 'caste', 'electricity');

-- ============================================================
-- TABLE 1: ocr_documents
--   Stores FULL raw text output from PaddleOCR per document
-- ============================================================

CREATE TABLE IF NOT EXISTS ocr_documents (
    id              SERIAL          PRIMARY KEY,

    -- Reference to the application in farmer_db (cross-DB FK — enforced in app layer)
    application_id  INT             NOT NULL,

    -- Which document type was OCR-processed
    document_type   ocr_doc_type    NOT NULL,

    -- Complete raw text from PaddleOCR (may be multi-page / multi-block)
    raw_text        TEXT            NOT NULL,

    -- PaddleOCR confidence score 0-100 (average across all detected boxes)
    ocr_confidence  NUMERIC(5, 2)   CHECK (ocr_confidence BETWEEN 0 AND 100),

    -- Original file path / S3 URL that was processed
    source_file_url TEXT,

    -- Timing
    processed_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Allow re-processing: track version
    ocr_version     VARCHAR(20)     DEFAULT '1.0',

    UNIQUE (application_id, document_type, ocr_version)
);

CREATE INDEX idx_ocr_documents_app_id        ON ocr_documents (application_id);
CREATE INDEX idx_ocr_documents_doc_type      ON ocr_documents (document_type);
CREATE INDEX idx_ocr_documents_processed_at  ON ocr_documents (processed_at DESC);

COMMENT ON TABLE  ocr_documents             IS 'Stores complete raw OCR text output per document per application.';
COMMENT ON COLUMN ocr_documents.raw_text    IS 'Full text extracted by PaddleOCR — unfiltered, unparsed.';
COMMENT ON COLUMN ocr_documents.ocr_version IS 'PaddleOCR model version used for reproducibility.';

-- ============================================================
-- TABLE 2: ocr_extracted_fields
--   Parsed key-value pairs extracted from raw OCR text
-- ============================================================

CREATE TABLE IF NOT EXISTS ocr_extracted_fields (
    id              SERIAL          PRIMARY KEY,
    application_id  INT             NOT NULL,

    -- Which document this field came from
    document_type   ocr_doc_type    NOT NULL,

    -- Field identifier  (e.g. 'aadhaar_number', 'dob', 'name')
    field_name      VARCHAR(100)    NOT NULL,

    -- Raw extracted value (always stored as text; app layer casts)
    field_value     TEXT,

    -- Per-field OCR confidence 0–100
    field_confidence NUMERIC(5, 2)  CHECK (field_confidence BETWEEN 0 AND 100),

    -- Normalized / cleaned value after post-processing
    normalized_value TEXT,

    extracted_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Reference back to the raw OCR document
    ocr_document_id INT             REFERENCES ocr_documents (id) ON DELETE SET NULL
);

CREATE INDEX idx_ocr_fields_app_id      ON ocr_extracted_fields (application_id);
CREATE INDEX idx_ocr_fields_doc_type    ON ocr_extracted_fields (document_type);
CREATE INDEX idx_ocr_fields_field_name  ON ocr_extracted_fields (field_name);

-- Composite: fast lookup of a specific field for a specific application
CREATE INDEX idx_ocr_fields_app_field   ON ocr_extracted_fields (application_id, field_name);

COMMENT ON TABLE  ocr_extracted_fields                  IS 'Structured key-value fields parsed from OCR raw text.';
COMMENT ON COLUMN ocr_extracted_fields.field_name       IS 'Standardized field key: name | aadhaar_number | dob | address | survey_number | land_area | bank_account | ifsc_code | income';
COMMENT ON COLUMN ocr_extracted_fields.field_value      IS 'Raw OCR-extracted string value.';
COMMENT ON COLUMN ocr_extracted_fields.normalized_value IS 'Clean value after regex/NLP normalization (e.g. dates → ISO, Aadhaar → 12-digit).';

-- ============================================================
-- TABLE 3: field_comparisons
--   Side-by-side comparison: Farmer Form Value vs OCR Value
--   Populated by the Comparison Engine (FastAPI service)
-- ============================================================

CREATE TABLE IF NOT EXISTS field_comparisons (
    id                SERIAL              PRIMARY KEY,
    application_id    INT                 NOT NULL,

    -- Which field was compared
    field_name        VARCHAR(100)        NOT NULL,

    -- Value as entered by the farmer in the web form
    farmer_value      TEXT,

    -- Value extracted by OCR from the uploaded document
    ocr_value         TEXT,

    -- Similarity score 0–100 (fuzzy match / Levenshtein / exact)
    match_percentage  NUMERIC(5, 2)       CHECK (match_percentage BETWEEN 0 AND 100),

    -- Weighted importance of this field in overall AI score
    field_weight      NUMERIC(4, 2)       NOT NULL DEFAULT 1.0
                                          CHECK (field_weight BETWEEN 0 AND 1),

    -- Match classification
    status            comparison_status   NOT NULL DEFAULT 'mismatch',

    -- Optional human-readable diff note
    mismatch_reason   TEXT,

    compared_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comparisons_app_id     ON field_comparisons (application_id);
CREATE INDEX idx_comparisons_field_name ON field_comparisons (field_name);
CREATE INDEX idx_comparisons_status     ON field_comparisons (status);

-- Composite: get all comparisons for one application quickly
CREATE UNIQUE INDEX idx_comparisons_app_field
    ON field_comparisons (application_id, field_name);

COMMENT ON TABLE  field_comparisons                 IS 'Stores per-field comparison between farmer form submission and OCR extracted data.';
COMMENT ON COLUMN field_comparisons.match_percentage IS 'Fuzzy similarity score: 100 = exact match. Uses Levenshtein / token_sort_ratio.';
COMMENT ON COLUMN field_comparisons.field_weight    IS 'Weight used in weighted-average AI score. Aadhaar=1.0, Name=0.9, Land=0.85, Bank=0.85, Income=0.70.';

-- ============================================================
-- TABLE 4: ai_scores
--   Final AI-computed scores per application
--   Weighted average of all field_comparisons
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_scores (
    id                   SERIAL          PRIMARY KEY,
    application_id       INT             NOT NULL UNIQUE,  -- One score per application

    -- Core Scores (all 0.0 – 100.0)
    overall_score        NUMERIC(5, 2)   NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    approval_probability NUMERIC(5, 2)   NOT NULL CHECK (approval_probability BETWEEN 0 AND 100),
    fraud_risk           NUMERIC(5, 2)   NOT NULL CHECK (fraud_risk BETWEEN 0 AND 100),
    confidence_score     NUMERIC(5, 2)   NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),

    -- Per-domain sub-scores (0–100)
    identity_score       NUMERIC(5, 2)   CHECK (identity_score BETWEEN 0 AND 100),
    land_score           NUMERIC(5, 2)   CHECK (land_score BETWEEN 0 AND 100),
    bank_score           NUMERIC(5, 2)   CHECK (bank_score BETWEEN 0 AND 100),
    income_score         NUMERIC(5, 2)   CHECK (income_score BETWEEN 0 AND 100),

    -- AI model details for audit/reproducibility
    model_version        VARCHAR(30)     DEFAULT 'v1.0',
    scored_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_scores_app_id       ON ai_scores (application_id);
CREATE INDEX idx_ai_scores_overall      ON ai_scores (overall_score DESC);
CREATE INDEX idx_ai_scores_fraud_risk   ON ai_scores (fraud_risk DESC);

COMMENT ON TABLE  ai_scores                    IS 'AI computed decision scores per application.';
COMMENT ON COLUMN ai_scores.overall_score      IS 'Weighted average score. ≥90 = Approve, 70–89 = Review, <70 = Reject.';
COMMENT ON COLUMN ai_scores.approval_probability IS 'Probability (%) that application meets scheme eligibility.';
COMMENT ON COLUMN ai_scores.fraud_risk         IS 'Fraud risk score. High value = suspicious discrepancy.';
COMMENT ON COLUMN ai_scores.confidence_score   IS 'How confident the AI is in its decision (based on OCR quality + field completeness).';

-- ============================================================
-- TABLE 5: verification_summary
--   Aggregated result for each application (Admin Dashboard)
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_summary (
    id                 SERIAL          PRIMARY KEY,
    application_id     INT             NOT NULL UNIQUE,

    -- Field Counts (populated from field_comparisons)
    total_fields       INT             NOT NULL DEFAULT 0,
    matched_fields     INT             NOT NULL DEFAULT 0  CHECK (matched_fields >= 0),
    mismatched_fields  INT             NOT NULL DEFAULT 0  CHECK (mismatched_fields >= 0),
    partial_fields     INT             NOT NULL DEFAULT 0  CHECK (partial_fields >= 0),

    -- Derived match percentage
    overall_match_pct  NUMERIC(5, 2)
        GENERATED ALWAYS AS (
            CASE
                WHEN total_fields = 0 THEN 0
                ELSE ROUND(100.0 * matched_fields / total_fields, 2)
            END
        ) STORED,

    -- AI Final Decision
    final_decision     final_decision  NOT NULL,

    -- Decision flags for quick filtering
    requires_manual_review BOOLEAN    NOT NULL DEFAULT FALSE,
    is_flagged_for_fraud   BOOLEAN    NOT NULL DEFAULT FALSE,

    verified_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_app_id       ON verification_summary (application_id);
CREATE INDEX idx_verification_decision     ON verification_summary (final_decision);
CREATE INDEX idx_verification_fraud_flag   ON verification_summary (is_flagged_for_fraud)
    WHERE is_flagged_for_fraud = TRUE;

COMMENT ON TABLE  verification_summary                  IS 'Final aggregated verification result for each application.';
COMMENT ON COLUMN verification_summary.overall_match_pct IS 'Auto-computed: 100 * matched_fields / total_fields.';
COMMENT ON COLUMN verification_summary.final_decision   IS 'AI recommended action: approve | review | reject.';

-- ============================================================
-- TABLE 6: admin_actions
--   Audit log of all manual decisions made by admin users
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_actions (
    id              SERIAL              PRIMARY KEY,

    -- Admin user who acted (FK to admin_users / auth system)
    admin_id        INT                 NOT NULL,

    -- Which application was acted upon
    application_id  INT                 NOT NULL,

    -- What action was taken
    action          admin_action_type   NOT NULL,

    -- Optional free-text justification / remarks
    remarks         TEXT,

    -- Was AI recommendation overridden?
    override_ai     BOOLEAN             NOT NULL DEFAULT FALSE,
    ai_recommendation final_decision,   -- what AI had suggested

    timestamp       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_admin_id      ON admin_actions (admin_id);
CREATE INDEX idx_admin_actions_app_id        ON admin_actions (application_id);
CREATE INDEX idx_admin_actions_action        ON admin_actions (action);
CREATE INDEX idx_admin_actions_timestamp     ON admin_actions (timestamp DESC);
CREATE INDEX idx_admin_actions_override      ON admin_actions (override_ai)
    WHERE override_ai = TRUE;

COMMENT ON TABLE  admin_actions               IS 'Immutable audit log of every admin action. Never updated — only appended.';
COMMENT ON COLUMN admin_actions.override_ai   IS 'TRUE when admin decision differs from AI recommendation.';

-- ============================================================
-- AUTO-UPDATE TRIGGER for verification_summary
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_vs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verification_summary_updated_at
    BEFORE UPDATE ON verification_summary
    FOR EACH ROW EXECUTE FUNCTION trigger_set_vs_updated_at();

-- ============================================================
-- VIEW: Admin Dashboard — Application Verification Status
-- ============================================================

CREATE OR REPLACE VIEW v_admin_application_dashboard AS
SELECT
    vs.application_id,
    vs.total_fields,
    vs.matched_fields,
    vs.mismatched_fields,
    vs.partial_fields,
    vs.overall_match_pct,
    vs.final_decision,
    vs.requires_manual_review,
    vs.is_flagged_for_fraud,
    vs.verified_at,

    -- AI Scores
    ai.overall_score,
    ai.approval_probability,
    ai.fraud_risk,
    ai.confidence_score,

    -- Last admin action
    aa.action          AS last_admin_action,
    aa.admin_id        AS last_admin_id,
    aa.remarks         AS last_admin_remarks,
    aa.timestamp       AS last_action_at,

    -- OCR quality
    od.ocr_confidence  AS avg_ocr_confidence,
    od.document_type   AS primary_doc_type

FROM verification_summary vs
LEFT JOIN ai_scores        ai ON ai.application_id = vs.application_id
LEFT JOIN LATERAL (
    SELECT * FROM admin_actions
    WHERE application_id = vs.application_id
    ORDER BY timestamp DESC
    LIMIT 1
) aa ON TRUE
LEFT JOIN LATERAL (
    SELECT * FROM ocr_documents
    WHERE application_id = vs.application_id
    ORDER BY processed_at DESC
    LIMIT 1
) od ON TRUE;

COMMENT ON VIEW v_admin_application_dashboard IS
    'Main admin dashboard view — joins verification summary, AI scores, last admin action, and latest OCR metadata.';

-- ============================================================
-- VIEW: Fraud Risk Report
-- ============================================================

CREATE OR REPLACE VIEW v_fraud_risk_report AS
SELECT
    vs.application_id,
    ai.fraud_risk,
    ai.overall_score,
    vs.mismatched_fields,
    vs.final_decision,
    vs.is_flagged_for_fraud,
    vs.verified_at
FROM verification_summary vs
JOIN ai_scores ai ON ai.application_id = vs.application_id
WHERE
    ai.fraud_risk > 50          -- High fraud risk
    OR vs.is_flagged_for_fraud = TRUE
ORDER BY
    ai.fraud_risk DESC;

COMMENT ON VIEW v_fraud_risk_report IS
    'Applications flagged as high fraud risk. Threshold: fraud_risk > 50 OR manually flagged.';

-- ============================================================
-- VIEW: Analytics — Daily verification throughput
-- ============================================================

CREATE OR REPLACE VIEW v_daily_verification_stats AS
SELECT
    DATE(verified_at)                             AS verification_date,
    COUNT(*)                                      AS total_verified,
    SUM(CASE WHEN final_decision = 'approve' THEN 1 ELSE 0 END) AS auto_approved,
    SUM(CASE WHEN final_decision = 'review'  THEN 1 ELSE 0 END) AS sent_to_review,
    SUM(CASE WHEN final_decision = 'reject'  THEN 1 ELSE 0 END) AS auto_rejected,
    SUM(CASE WHEN is_flagged_for_fraud THEN 1 ELSE 0 END)       AS fraud_flagged,
    ROUND(AVG(overall_match_pct), 2)              AS avg_match_pct
FROM verification_summary
GROUP BY DATE(verified_at)
ORDER BY DATE(verified_at) DESC;

COMMENT ON VIEW v_daily_verification_stats IS 'Daily aggregated verification metrics for admin analytics dashboard.';

-- ============================================================
-- USEFUL ANALYTICS QUERIES
-- ============================================================

/*
-- 1. Total farmers registered (run against farmer_db)
SELECT COUNT(*) AS total_farmers FROM farmers;

-- 2. Total applications per scheme (run against farmer_db)
SELECT scheme_id, COUNT(*) AS total_applications
FROM applications
GROUP BY scheme_id ORDER BY total_applications DESC;

-- 3. Approval rate per scheme (run against farmer_db)
SELECT * FROM v_scheme_application_stats ORDER BY approval_rate_pct DESC;

-- 4. Fraud detection % (run against admin_db)
SELECT
    ROUND(100.0 * SUM(CASE WHEN is_flagged_for_fraud THEN 1 ELSE 0 END) / COUNT(*), 2)
        AS fraud_detection_pct
FROM verification_summary;

-- 5. Pending verifications (applications with no summary yet — run cross-DB or in app layer)
SELECT application_id FROM applications
WHERE application_status = 'under_review'
AND   application_id NOT IN (SELECT application_id FROM verification_summary);

-- 6. Admin override rate
SELECT
    COUNT(*) FILTER (WHERE override_ai = TRUE)  AS ai_overrides,
    COUNT(*)                                     AS total_actions,
    ROUND(100.0 * COUNT(*) FILTER (WHERE override_ai = TRUE) / COUNT(*), 2) AS override_pct
FROM admin_actions;
*/

-- ============================================================
-- END OF ADMIN DATABASE SCHEMA
-- Total Tables: 6
-- ============================================================
