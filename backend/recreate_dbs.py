import psycopg2
import os
import sys

# Force UTF-8 stdout
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv()

PG_USER = os.getenv("FARMER_DB_USER", "postgres")
PG_PASS = os.getenv("FARMER_DB_PASSWORD", "root")
PG_HOST = os.getenv("FARMER_DB_HOST", "localhost")
PG_PORT = int(os.getenv("FARMER_DB_PORT", "5432"))

FARMER_DB = os.getenv("FARMER_DB_NAME", "agri_farmer_db")
ADMIN_DB = os.getenv("ADMIN_DB_NAME", "agri_admin_db")

def connect_postgres(dbname="postgres"):
    conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT,
        user=PG_USER, password=PG_PASS,
        dbname=dbname,
    )
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    return conn

def drop_db(dbname):
    try:
        conn = connect_postgres("postgres")
        cur = conn.cursor()
        print(f"  [WAIT] Dropping {dbname}...")
        cur.execute(f'DROP DATABASE IF EXISTS "{dbname}" WITH (FORCE);')
        print(f"  [OK] Dropped {dbname}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"  [ERROR] Dropping {dbname}: {e}")

if __name__ == "__main__":
    print("-" * 40)
    print("  KisanSetu - DB Cleanup & Recreate")
    print("-" * 40)
    drop_db(FARMER_DB)
    drop_db(ADMIN_DB)
    print("\n  Rerunning setup_databases.py...")
    
    # Import setup_databases and run main
    sys.path.insert(0, os.getcwd())
    import setup_databases
    setup_databases.main()
    print("-" * 40)
    print("  System Reset Complete.")
