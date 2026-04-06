import traceback
from fastapi.testclient import TestClient
from main import app
import random

client = TestClient(app)

print("--- Testing /v2/farmers/register via TestClient ---")
suffix = str(random.randint(10000, 99999))

payload = {
    "full_name": "TestClient Farmer " + suffix,
    "mobile_number": "8" + suffix,
    "aadhaar_number": "4444 5555 " + suffix,
    "gender": "male",
    "category": "General",
    "address": {"state": "Maharashtra", "district": "Pune"},
    "bank": {"account_number": "999888777", "ifsc_code": "BANK001"}
}

try:
    response = client.post("/v2/farmers/register", json=payload)
    print("STATUS CODE:", response.status_code)
    if response.status_code != 201:
        print("RESPONSE:", response.text)
    else:
        print("SUCCESS:", response.json())
except Exception as e:
    print("\n--- TESTCLIENT ERROR ---")
    traceback.print_exc()
