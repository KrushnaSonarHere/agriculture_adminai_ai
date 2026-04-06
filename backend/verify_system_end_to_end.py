import requests
import json
import os
import time
import random

BASE_URL = "http://127.0.0.1:8000"

print("--- Step 1: Register Farmer (v2) ---")
suffix = str(random.randint(100, 999))
farmer_payload = {
    "full_name": "Rajesh Kumar Patil " + suffix,
    "father_name": "Kumar Patil",
    "dob": "15-05-1980",
    "gender": "male",
    "mobile_number": "9" + "876543" + suffix,
    "aadhaar_number": "1234 5678 " + "9" + suffix,
    "category": "General",
    "annual_income": 120000.00,
    "bpl_status": False,
    "agristack_id": "KA-12345-678",
    "address": {
        "state": "Maharashtra",
        "district": "Pune",
        "taluka": "Haveli",
        "village": "Wagholi",
        "pincode": "412207",
        "full_address": "Near Gram Panchayat, Main Road"
    },
    "land": [
        {
            "survey_number": "102/1A",
            "land_area": 2.5,
            "land_ownership_type": "owned",
            "seven_twelve_number": "712-9876",
            "eight_a_number": "8A-5432"
        }
    ],
    "bank": {
        "account_number": "50100123456789",
        "ifsc_code": "HDFC0001234",
        "bank_name": "HDFC Bank Ltd",
        "branch_name": "Wagholi Branch",
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

resp = requests.post(f"{BASE_URL}/v2/farmers/register", json=farmer_payload)
if resp.status_code != 201:
    print(f"FAILED Registration: {resp.text}")
    exit(1)

reg_data = resp.json()
farmer_id = reg_data["farmer_id"]
print(f"SUCCESS: Registered farmer ID {farmer_id}")

print("\n--- Step 2: Apply for Scheme ---")
apply_payload = {
    "scheme_id": 1,
    "scheme_name": "PM-KISAN Samman Nidhi"
}
resp = requests.post(f"{BASE_URL}/v2/farmers/{farmer_id}/apply", json=apply_payload)
app_data = resp.json()
app_id = app_data["id"]
print(f"SUCCESS: Created application ID {app_id}")

print("\n--- Step 3: Upload Document (Aadhaar) ---")
# Create a dummy file if not exists
dummy_path = "dummy_aadhaar.png"
with open(dummy_path, "wb") as f:
    f.write(b"fake image data")

with open(dummy_path, 'rb') as f:
    files = {'file': (dummy_path, f, 'image/png')}
    data = {'document_type': 'aadhaar'}
    resp = requests.post(f"{BASE_URL}/v2/applications/{app_id}/documents", data=data, files=files)
print(f"SUCCESS: Uploaded document {resp.json().get('document_id')}")

print("\n--- Step 4: Trigger AI Verification ---")
resp = requests.post(f"{BASE_URL}/verify/{app_id}")
print(f"SUCCESS: Triggered pipeline for application {app_id}")
print(f"Response: {resp.json()}")

print("\n--- Step 5: Check Verification Stats ---")
time.sleep(2) # Give background tasks a moment
resp = requests.get(f"{BASE_URL}/verify/stats")
print(f"Verification Stats: {json.dumps(resp.json(), indent=2)}")

os.remove(dummy_path)
print("\n--- Verification Complete ---")
