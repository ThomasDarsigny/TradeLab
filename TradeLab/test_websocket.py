"""Test WebSocket pour les mises à jour temps réel"""

import asyncio
import websockets
import json
from datetime import datetime

async def test_websocket_quote():
    """Test la connexion WebSocket et reçoit les updates"""
    
    symbol = "AAPL"
    uri = f"ws://localhost:8000/ws/quote/{symbol}"
    
    print("="*70)
    print("TEST WEBSOCKET - MISES A JOUR TEMPS REEL")
    print("="*70)
    print(f"\nConnexion: {uri}")
    print(f"Affichage des 10 premieres updates...\n")
    
    try:
        async with websockets.connect(uri) as websocket:
            count = 0
            start_time = datetime.now()
            
            while count < 10:
                try:
                    message = await asyncio.wait_for(
                        websocket.recv(),
                        timeout=10.0
                    )
                    data = json.loads(message)
                    
                    count += 1
                    timestamp = datetime.fromisoformat(data['timestamp'])
                    
                    print(f"[{count}] {data['symbol']}: ${data['price']:.2f} " +
                          f"({data['changePercent']:+.2f}%) - {timestamp.strftime('%H:%M:%S')}")
                    
                except asyncio.TimeoutError:
                    print("Timeout - pas de data reçue")
                    break
            
            elapsed = (datetime.now() - start_time).total_seconds()
            print(f"\n✓ {count} updates reçues en {elapsed:.1f}s")
            print(f"✓ Réduit drastiquement les requêtes HTTP!")
            print(f"✓ 10 updates = 1 connexion WebSocket permanente")
            print(f"✓ vs 10 appels HTTP REST\n")
            
    except Exception as e:
        print(f"✗ Erreur: {e}")
        print(f"\nAssurez-vous que l'API est lancée sur http://localhost:8000")
        print(f"Commande: python -m uvicorn api_finnhub:app --reload --port 8000\n")


async def test_websocket_multi():
    """Test plusieurs symboles simultanément"""
    
    symbols = ["AAPL", "MSFT", "GOOGL"]
    
    print("="*70)
    print("TEST WEBSOCKET - PLUSIEURS SYMBOLES")
    print("="*70)
    
    async def subscribe_symbol(symbol):
        uri = f"ws://localhost:8000/ws/quote/{symbol}"
        try:
            async with websockets.connect(uri) as websocket:
                print(f"[{symbol}] Connecté")
                for i in range(5):
                    message = await asyncio.wait_for(
                        websocket.recv(),
                        timeout=10.0
                    )
                    data = json.loads(message)
                    print(f"[{symbol}] {data['price']:.2f} ({data['changePercent']:+.2f}%)")
        except Exception as e:
            print(f"[{symbol}] Erreur: {e}")
    
    try:
        print(f"\nConnexion simultanée pour: {', '.join(symbols)}\n")
        await asyncio.gather(*[subscribe_symbol(s) for s in symbols])
    except Exception as e:
        print(f"Erreur: {e}")


if __name__ == "__main__":
    print("\nVérification: L'API doit être lancée sur http://localhost:8000\n")
    
    try:
        asyncio.run(test_websocket_quote())
    except KeyboardInterrupt:
        print("\nArrêté par l'utilisateur")
    except Exception as e:
        print(f"Erreur: {e}")
