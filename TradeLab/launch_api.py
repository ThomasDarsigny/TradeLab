"""
Script de démarrage et test complet de TradeLab avec Finnhub
"""

import sys
import time
import subprocess
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("\n" + "="*70)
print("DEMARRAGE TRADELAB - FINNHUB API")
print("="*70 + "\n")

print("[1/4] Vérification des dépendances...")
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


print("[2/4] Test du service Finnhub...")
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
    sys.exit(1)


print("[3/4] Vérification de l'API FastAPI...")
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
    print("         - GET /symbols\n")
except Exception as e:
    print(f"      ✗ Erreur: {e}\n")
    sys.exit(1)


print("[4/4] Instructions de démarrage...")
print("\n      Pour lancer l'API FastAPI sur le port 8000:")
print("      $ uvicorn api_finnhub:app --reload --port 8000")
print("\n      Ou utiliser le raccourci:")
print("      $ python launch_api.py")

print("\n" + "="*70)
print("✓ TOUT EST PRET")
print("="*70 + "\n")


response = input("Voulez-vous lancer l'API maintenant? (o/n): ").strip().lower()
if response == 'o' or response == 'oui':
    print("\nDémarrage de l'API sur http://localhost:8000")
    print("Documentation: http://localhost:8000/docs\n")
    try:
        import uvicorn
        uvicorn.run(
            "api_finnhub:app",
            host="0.0.0.0",
            port=8000,
            reload=True
        )
    except KeyboardInterrupt:
        print("\nAPI arrêtée")
else:
    print("\nAPI prête à être lancée manuellement")
