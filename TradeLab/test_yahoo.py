from yahooquery_service import service
import time

print("=" * 60)
print("TEST YAHOOQUERY SERVICE")
print("=" * 60)

# Test avec les symboles problématiques
symbols = ['DOL.TO', 'AAPL']

for symbol in symbols:
    print(f"\n📊 Test pour {symbol}...")
    
    # Test 1: get_quote
    print(f"  1️⃣  Récupération du quote...")
    quote = service.get_quote(symbol)
    if quote:
        print(f"     ✓ Prix: ${quote['price']:.2f}")
        print(f"     ✓ Change: {quote['change']:+.2f} ({quote['changePercent']:+.2f}%)")
    else:
        print(f"     ✗ Erreur: Pas de quote")
    
    time.sleep(1)
    
    # Test 2: get_market_data (historique)
    print(f"  2️⃣  Récupération de l'historique (1 mois)...")
    data = service.get_market_data(symbol, period='1mo', interval='1d')
    if data is not None and not data.empty:
        last_close = data['close'].iloc[-1]
        first_close = data['close'].iloc[0]
        print(f"     ✓ {len(data)} jours de données")
        print(f"     ✓ Premier cours: ${first_close:.2f}")
        print(f"     ✓ Dernier cours: ${last_close:.2f}")
    else:
        print(f"     ✗ Pas de données")
    
    time.sleep(1)
    
    # Test 3: get_candles
    print(f"  3️⃣  Récupération des chandeliers...")
    candles = service.get_candles(symbol, period='1mo', interval='1d')
    if candles and candles['close']:
        print(f"     ✓ {len(candles['close'])} chandeliers")
        print(f"     ✓ Dernier close: ${candles['close'][-1]:.2f}")
    else:
        print(f"     ✗ Pas de chandeliers")
    
    time.sleep(1)

# Test 4: Recherche de symboles
print(f"\n🔍 Test recherche de symboles...")
results = service.search_symbols('Apple', limit=5)
if results:
    print(f"   ✓ Trouvé {len(results)} résultats")
    for r in results[:3]:
        print(f"      - {r['symbol']}: {r['name']}")
else:
    print(f"   ✗ Pas de résultats")

print("\n" + "=" * 60)
print("TESTS TERMINÉS")
print("=" * 60)
