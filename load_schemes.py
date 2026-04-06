"""
load_schemes.py  (v2)
─────────────────────
Re-parses the updated final_full_dataset.csv and reloads ALL
scheme records fresh into the PostgreSQL 'Agri_tech' database.

Table: schemes
Columns: id, Scheme_Name, Department, Summary, Grant,
         Eligibility, Required_Documents, created_at
"""

import re
import psycopg2

# ─── DB CONNECTION ─────────────────────────────────────────
DB_CONFIG = {
    "dbname":   "Agri_tech",
    "user":     "postgres",
    "password": "root",
    "host":     "localhost",
    "port":     5432,
}

# ─── PARSE CSV ─────────────────────────────────────────────
LABELS = [
    "Scheme_Name",
    "Department",
    "Summary",
    "Grant",
    "Eligibility",
    "Required_[Dd]ocuments?",   # handles Required_documents / Required_Documents
    "Required documents",
]

# Pattern that matches ANY of the labels followed by optional space + colon
LABEL_PAT = re.compile(
    r'^(%s)\s*:' % '|'.join(LABELS),
    re.IGNORECASE
)


def parse_schemes(filepath):
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        raw = f.read()

    # Normalise line endings
    raw = raw.replace('\r\n', '\n').replace('\r', '\n')

    # Split into scheme blocks on "Scheme_Name :"
    blocks = re.split(r'(?=Scheme_Name\s*:)', raw, flags=re.IGNORECASE)
    blocks = [b.strip() for b in blocks if b.strip()]

    schemes = []
    for block in blocks:
        # Split the block into labelled segments
        # Find every position where a new label starts
        segment_starts = [(m.start(), m.group(1)) for m in
                          re.finditer(r'^(Scheme_Name|Department|Summary|Grant|Eligibility|Required[_ ]?[Dd]ocuments?)\s*:',
                                      block, re.IGNORECASE | re.MULTILINE)]

        if not segment_starts:
            continue

        segments = {}
        for i, (start, label) in enumerate(segment_starts):
            end = segment_starts[i + 1][0] if i + 1 < len(segment_starts) else len(block)
            # Get the text after the colon
            seg_text = block[start:end]
            # Remove the label+colon prefix
            value = re.sub(r'^[^:]+:\s*', '', seg_text, count=1).strip()
            # Clean up stray quotes, trailing commas
            value = value.strip('"').strip("'").rstrip(',').strip()
            # Normalize whitespace (collapse multiple blank lines to one)
            value = re.sub(r'\n{3,}', '\n\n', value)
            # Normalise label key
            norm = re.sub(r'[_ ]', '_', label).lower()
            if 'required' in norm:
                norm = 'required_documents'
            segments[norm] = value

        record = {
            "Scheme_Name":        segments.get("scheme_name", "").rstrip(',').strip(),
            "Department":         segments.get("department", "").rstrip(',').strip(),
            "Summary":            segments.get("summary", ""),
            "Grant":              segments.get("grant", ""),
            "Eligibility":        segments.get("eligibility", ""),
            "Required_Documents": segments.get("required_documents", ""),
        }

        if record["Scheme_Name"]:
            schemes.append(record)

    return schemes


# ─── SQL ───────────────────────────────────────────────────
DROP_TABLE_SQL = 'DROP TABLE IF EXISTS schemes;'

CREATE_TABLE_SQL = """
CREATE TABLE schemes (
    id                    SERIAL PRIMARY KEY,
    "Scheme_Name"         TEXT NOT NULL,
    "Department"          TEXT,
    "Summary"             TEXT,
    "Grant"               TEXT,
    "Eligibility"         TEXT,
    "Required_Documents"  TEXT,
    created_at            TIMESTAMP DEFAULT NOW()
);
"""

INSERT_SQL = """
INSERT INTO schemes
  ("Scheme_Name","Department","Summary","Grant","Eligibility","Required_Documents")
VALUES (%s,%s,%s,%s,%s,%s);
"""


# ─── MAIN ──────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  KisanSetu — Schemes DB Loader  (v2)")
    print("=" * 55)

    print("\n📂  Parsing final_full_dataset.csv ...")
    schemes = parse_schemes("final_full_dataset.csv")
    print(f"    ✔ Parsed {len(schemes)} scheme records\n")

    if not schemes:
        print("❌  No schemes found. Check the CSV file.")
        return

    # Print summary of what was found
    for i, s in enumerate(schemes, 1):
        print(f"  [{i:02d}] {s['Scheme_Name'][:65]}")
    print()

    print("🔌  Connecting to PostgreSQL (Agri_tech) ...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()
    print("    ✔ Connected\n")

    print("🗑   Dropping old 'schemes' table ...")
    cur.execute(DROP_TABLE_SQL)
    conn.commit()
    print("    ✔ Dropped\n")

    print("🛠   Creating fresh 'schemes' table ...")
    cur.execute(CREATE_TABLE_SQL)
    conn.commit()
    print("    ✔ Created\n")

    print("📥  Inserting records ...")
    success = 0
    for i, s in enumerate(schemes, 1):
        try:
            cur.execute(INSERT_SQL, (
                s["Scheme_Name"],
                s["Department"],
                s["Summary"],
                s["Grant"],
                s["Eligibility"],
                s["Required_Documents"],
            ))
            success += 1
            print(f"    [{i:02d}] ✔  {s['Scheme_Name'][:55]}")
        except Exception as e:
            conn.rollback()
            print(f"    [{i:02d}] ✖  SKIPPED — {e}")

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n{'='*55}")
    print(f"  ✅  Done! {success}/{len(schemes)} schemes loaded.")
    print(f"  👉  Open pgAdmin → Agri_tech → Tables → schemes")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()
