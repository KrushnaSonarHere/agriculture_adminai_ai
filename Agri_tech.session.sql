-- ================================================
--  KisanSetu — Verify Schemes Table
--  Run this in pgAdmin or VS Code SQL session
--  Database: Agri_tech
-- ================================================

-- 1. Count total records
SELECT COUNT(*) AS total_schemes FROM schemes;

-- 2. List all schemes with name and department
SELECT
    id,
    "Scheme_Name",
    "Department"
FROM schemes
ORDER BY id;

-- 3. Check all fields are populated (none should be 0 or null)
SELECT
    id,
    LEFT("Scheme_Name", 40)         AS scheme,
    LENGTH("Summary")               AS summary_chars,
    LENGTH("Grant")                 AS grant_chars,
    LENGTH("Eligibility")           AS eligibility_chars,
    LENGTH("Required_Documents")    AS docs_chars
FROM schemes
ORDER BY id;

-- 4. Preview full data for scheme 1
SELECT * FROM schemes WHERE id = 1;

-- 5. Preview full data for scheme 2
SELECT * FROM schemes WHERE id = 2;

