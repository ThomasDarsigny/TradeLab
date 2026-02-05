"""Test des endpoints FastAPI avec Finnhub"""

from fastapi.testclient import TestClient
from api_finnhub import app

client = TestClient(app)

print("="*70)
print("TEST API FINNHUB")
print("="*70)


print("\n[1] GET /")
response = client.get("/")
print(f"    Status: {response.status_code}")
print(f"    Response: {response.json()}")

print("\n[2] GET /health")
response = client.get("/health")
print(f"    Status: {response.status_code}")
print(f"    Status: {response.json()['status']}")

print("\n[3] GET /search?query=Apple")
response = client.get("/search?query=Apple")
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    results = response.json()
    print(f"    Trouve: {len(results)} symboles")
    for r in results[:3]:
        print(f"      - {r['symbol']}: {r['description']}")


print("\n[4] GET /quote/AAPL")
response = client.get("/quote/AAPL")
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"    Prix: ${data['price']:.2f}")
    print(f"    Change: {data['changePercent']:+.2f}%")


print("\n[5] GET /quote/GOOGL")
response = client.get("/quote/GOOGL")
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"    Prix: ${data['price']:.2f}")
    print(f"    Change: {data['changePercent']:+.2f}%")


print("\n[6] GET /quote/MSFT")
response = client.get("/quote/MSFT")
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"    Prix: ${data['price']:.2f}")
    print(f"    Change: {data['changePercent']:+.2f}%")


print("\n[7] GET /candles/AAPL")
response = client.get("/candles/AAPL")
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"    Timestamps: {len(data['timestamps'])}")
    print(f"    Derniere cloture: ${data['close'][-1]:.2f}")


print("\n[8] GET /profile/MSFT")
response = client.get("/profile/MSFT")
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"    Nom: {data['name']}")
    print(f"    Industrie: {data['industry']}")


print("\n[9] GET /symbols")
response = client.get("/symbols")
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    symbols = response.json()
    print(f"    {len(symbols)} symboles populaires")
    for s in symbols[:5]:
        print(f"      - {s['symbol']}: {s['name']}")


print("\n[10] GET /quote/INVALID123")
response = client.get("/quote/INVALID123")
print(f"    Status: {response.status_code}")
if response.status_code != 200:
    print(f"    Detail: {response.json()['detail']}")

print("\n" + "="*70)
print("TESTS TERMINES")
print("="*70)
