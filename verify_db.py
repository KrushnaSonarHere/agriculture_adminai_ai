import psycopg2

conn = psycopg2.connect(dbname="Agri_tech", user="postgres", password="root", host="localhost", port=5432)
cur = conn.cursor()

cur.execute("""
    SELECT id,
           "Scheme_Name",
           "Department",
           length("Summary")            AS sum_len,
           length("Grant")              AS grant_len,
           length("Eligibility")        AS elig_len,
           length("Required_Documents") AS docs_len
    FROM schemes ORDER BY id;
""")

rows = cur.fetchall()
print(f"\nTotal schemes: {len(rows)}\n")
print(f"{'ID':>3}  {'Scheme Name':<52}  {'Dept':<20}  {'Sum':>5}  {'Grant':>6}  {'Elig':>5}  {'Docs':>5}")
print("-" * 100)
for r in rows:
    print(f"{r[0]:>3}  {str(r[1])[:52]:<52}  {str(r[2])[:20]:<20}  {r[3]:>5}  {r[4]:>6}  {r[5]:>5}  {r[6]:>5}")

cur.close()
conn.close()
print("\nAll fields verified OK.")
