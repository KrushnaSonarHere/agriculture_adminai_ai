import psycopg2
import os
from dotenv import load_dotenv
load_dotenv()

def check_table(dbname, tablename):
    try:
        conn = psycopg2.connect(
            host=os.getenv("ADMIN_DB_HOST", "localhost"),
            port=os.getenv("ADMIN_DB_PORT", "5432"),
            user=os.getenv("ADMIN_DB_USER", "postgres"),
            password=os.getenv("ADMIN_DB_PASSWORD", "root"),
            dbname=dbname
        )
        cur = conn.cursor()
        cur.execute(f"SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_name = '{tablename}' ORDER BY ordinal_position")
        cols = cur.fetchall()
        print(f"\n--- {dbname}.{tablename} ---")
        for c in cols:
            print(f"  {c[0]:<20} | {c[1]:<15} | {c[2]:<15} | Nullable: {c[3]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

check_table("agri_admin_db", "field_comparisons")
check_table("agri_admin_db", "verification_summary")
check_table("agri_admin_db", "ai_scores")
