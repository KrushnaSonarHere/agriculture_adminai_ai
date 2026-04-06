import traceback
from routers.farmer_registration import register_farmer, FarmerRegisterPayload
from database import FarmerSessionLocal
import random

print("--- Comprehensive Debugging register_farmer() ---")
suffix = str(random.randint(1000, 9999))

# Exact payload from verify_system_end_to_end.py
payload_dict = {
    "full_name": "Rajesh Debug Full " + suffix,
    "father_name": "Kumar Patil",
    "dob": "15-05-1980",
    "gender": "male",
    "mobile_number": "9000" + suffix,
    "aadhaar_number": "1111 2222 " + suffix,
    "category": "General",
    "annual_income": 120000.00,
    "bpl_status": False,
    "agristack_id": "DEB-" + suffix,
    "address": {
        "state": "Maharashtra",
        "district": "Pune",
        "taluka": "Haveli",
        "village": "Wagholi",
        "pincode": "412207",
        "full_address": "Debug Address"
    },
    "land": [
        {
            "survey_number": "100",
            "land_area": 1.0,
            "land_ownership_type": "owned",
            "seven_twelve_number": "712-A",
            "eight_a_number": "8A-A"
        }
    ],
    "bank": {
        "account_number": "123456",
        "ifsc_code": "IFSC01",
        "bank_name": "Debug Bank",
        "branch_name": "Debug Branch",
        "account_type": "savings",
        "aadhaar_linked": True
    },
    "farming": {
        "primary_crop": "Wheat",
        "irrigation_type": "drip",
        "farming_type": "traditional",
        "electricity_connection": True
    }
}

payload = FarmerRegisterPayload(**payload_dict)

db = FarmerSessionLocal()
try:
    result = register_farmer(payload, db)
    print("SUCCESS:", result)
except Exception as e:
    print("\nERROR DETECTED:\n")
    traceback.print_exc()
finally:
    db.close()
