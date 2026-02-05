"""Test des endpoints FastAPI avec Finnhub"""

import sys
sys.path.insert(0, '.')

import requests
import json

BASE_URL = "http://localhost:8000"

print("="*70)
print("TEST API FINNHUB (via HTTP)")
print("="*70)
print("Note: L'API doit etre en cours d'execution sur le port 8000")
print()

def test_endpoint(method, path, params=None):
    """Fonction helper pour tester les endpoints"""
    url = f"{BASE_URL}{path}"
    try:
        if method == "GET":
            response = requests.get(url, params=params, timeout=5)
        return response
    except requests.exceptions.ConnectionError:
        return None

print("="*70)
print("TEST DU SERVICE FINNHUB DIRECTEMENT")
print("="*70)

from finnhub_service import FinnhubService

service = FinnhubService()


print("\n[1] Quote AAPL")
quote = service.get_quote("AAPL")
if quote:
    print(f"    Prix: ${quote['price']:.2f}")
    print(f"    Change: {quote['changePercent']:+.2f}%")
    print(f"    Open: ${quote['open']:.2f}")
    print(f"    High: ${quote['high']:.2f}")
    print(f"    Low: ${quote['low']:.2f}")
else:
    print(f"    ERREUR")


print("\n[2] Quote GOOGL")
quote = service.get_quote("GOOGL")
if quote:
    print(f"    Prix: ${quote['price']:.2f}")
    print(f"    Change: {quote['changePercent']:+.2f}%")
else:
    print(f"    ERREUR")


print("\n[3] Quote MSFT")
quote = service.get_quote("MSFT")
if quote:
    print(f"    Prix: ${quote['price']:.2f}")
    print(f"    Change: {quote['changePercent']:+.2f}%")
else:
    print(f"    ERREUR")


print("\n[4] Recherche 'Apple'")
results = service.search_symbols("Apple")
print(f"    Trouve: {len(results)} resultats")
for r in results[:3]:
    print(f"      - {r['symbol']}: {r['description']}")


print("\n[5] Recherche 'Microsoft'")
results = service.search_symbols("Microsoft")
print(f"    Trouve: {len(results)} resultats")
for r in results[:3]:
    print(f"      - {r['symbol']}: {r['description']}")


print("\n[6] Candles AAPL")
candles = service.get_candles("AAPL")
if candles:
    print(f"    Timestamps: {len(candles['timestamps'])}")
    if candles['timestamps']:
        print(f"      Dernier: {candles['timestamps'][-1]}")
        print(f"      Close: ${candles['close'][-1]:.2f}")
else:
    print(f"    ERREUR")


print("\n[7] Profil MSFT")
profile = service.get_company_profile("MSFT")
if profile:
    print(f"    Nom: {profile['name']}")
    print(f"    Industrie: {profile['industry']}")
    print(f"    Exchange: {profile['exchange']}")
else:
    print(f"    ERREUR")

print("\n" + "="*70)
print("TESTS SERVICE TERMINES")
print("="*70)
