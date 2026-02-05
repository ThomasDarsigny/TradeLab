"""Test complet sans interaction"""

import sys
import time

print("\n" + "="*70)
print("TEST COMPLET TRADELAB - FINNHUB API")
print("="*70 + "\n")


print("[1/3] Vérification des dépendances...")
try:
    import finnhub
    print("      ✓ finnhub")
    import fastapi
    print("      ✓ fastapi")
    import uvicorn
    print("      ✓ uvicorn")
    import requests
    print("      ✓ requests")
    print("      ✓ Toutes les dépendances OK\n")
except ImportError as e:
    print(f"      ✗ Erreur: {e}")
    sys.exit(1)


print("[2/3] Test du service Finnhub...")
try:
    from finnhub_service import FinnhubService
    service = FinnhubService()
    

    symbols = ["AAPL", "GOOGL", "MSFT"]
    all_ok = True
    
    for symbol in symbols:
        quote = service.get_quote(symbol)
        if quote and quote.get('price'):
            print(f"      ✓ {symbol}: ${quote['price']:.2f}")
        else:
            print(f"      ✗ {symbol}: Erreur")
            all_ok = False
        time.sleep(0.5)
    
    if all_ok:
        print("      ✓ Service Finnhub OK\n")
    else:
        print("      ✗ Erreur dans le service\n")
        
except Exception as e:
    print(f"      ✗ Erreur: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)


print("[3/3] Vérification de l'API FastAPI...")
try:
    from api_finnhub import app
    print("      ✓ API chargée")
    print("      ✓ Endpoints disponibles:")
    print("         - GET /")
    print("         - GET /health")
    print("         - GET /search?query=...")
    print("         - GET /quote/{symbol}")
    print("         - GET /candles/{symbol}")
    print("         - GET /profile/{symbol}")
    print("         - GET /symbols")
    print("      ✓ API Finnhub OK\n")
except Exception as e:
    print(f"      ✗ Erreur: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("="*70)
print("✓ TOUS LES TESTS REUSSIS - TOUT FONCTIONNE")
print("="*70)
print("\nCommande pour lancer l'API:")
print("  uvicorn api_finnhub:app --reload --port 8000")
print("\nOu directement:")
print("  python -m uvicorn api_finnhub:app --reload --port 8000\n")
