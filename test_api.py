import urllib.request, json

BASE = "http://127.0.0.1:8000"

def test(label, url):
    try:
        res = urllib.request.urlopen(url, timeout=5)
        data = json.loads(res.read())
        if isinstance(data, list):
            print(f"[OK]  {label}: {len(data)} records")
            if data and isinstance(data[0], dict):
                for item in data[:2]:
                    name = item.get("Scheme_Name", item.get("title",""))
                    print(f"      -> {name[:60]}")
        else:
            print(f"[OK]  {label}")
            for k,v in list(data.items())[:4]:
                print(f"      {k}: {str(v)[:60]}")
    except Exception as e:
        print(f"[ERR] {label}: {e}")
    print()

print("=" * 60)
print("  KisanSetu API — Endpoint Tests")
print("=" * 60)
print()

test("GET /",                        f"{BASE}/")
test("GET /schemes/",                f"{BASE}/schemes/")
test("GET /schemes/1",               f"{BASE}/schemes/1")
test("GET /schemes/search?q=kisan",  f"{BASE}/schemes/search?q=kisan")
test("GET /applications/",           f"{BASE}/applications/")
test("GET /grievances/",             f"{BASE}/grievances/")

print("=" * 60)
print("  All endpoints tested.")
print(f"  Swagger UI -> {BASE}/docs")
print("=" * 60)
