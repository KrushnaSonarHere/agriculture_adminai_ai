import traceback
from routers.verification import _run_pipeline
from database import FarmerSessionLocal, AdminSessionLocal
import admin_models as AM

app_id = 1 # The ID from our previous run

print(f"--- Debugging _run_pipeline for App {app_id} ---")

fdb = FarmerSessionLocal()
adb = AdminSessionLocal()

try:
    # Clear old results for a clean run
    adb.query(AM.VerificationSummary).filter(AM.VerificationSummary.application_id == app_id).delete()
    adb.commit()

    print("Running pipeline synchronously...")
    _run_pipeline(app_id, fdb, adb)
    print("SUCCESS: Pipeline function finished without crashing.")
    
    # Check results
    summary = adb.query(AM.VerificationSummary).filter(AM.VerificationSummary.application_id == app_id).first()
    if summary:
        print(f"RESULT: Score={summary.overall_score}, Decision={summary.final_decision}")
    else:
        print("RESULT: No VerificationSummary record found after run!")

except Exception as e:
    print("\nVERIFICATION ENGINE ERROR:\n")
    traceback.print_exc()
finally:
    fdb.close()
    adb.close()
