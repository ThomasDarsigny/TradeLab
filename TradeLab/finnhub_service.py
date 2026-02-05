
"""
Service Finnhub pour les données boursières US
Utilise l'API Finnhub pour les actions américaines uniquement
"""

import finnhub
import time
import logging
from typing import Optional, Dict, List


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("finnhub_service")

FINNHUB_API_KEY = "d5tncahr01qtjet0haggd5tncahr01qtjet0hah0"


class FinnhubService:
    """Service pour accéder aux données boursières via Finnhub"""
    
    def __init__(self, api_key: str = FINNHUB_API_KEY, request_delay: float = 1.0):
        """Initialise le service Finnhub"""
        self.client = finnhub.Client(api_key=api_key)
        self.request_delay = request_delay
        self.api_key = api_key
        logger.info(f"Service Finnhub initialisé avec délai: {request_delay}s")
    
    def get_quote(self, symbol: str) -> Optional[Dict]:
        """Récupère le prix actuel d'une action américaine"""
        try:
            logger.info(f"Récupération du quote pour {symbol}")
            time.sleep(self.request_delay)
            
            data = self.client.quote(symbol)
            if not data or data.get('c') is None:
                logger.error(f"Pas de données pour {symbol}")
                return None
            
            result = {
                'symbol': symbol.upper(),
                'price': data.get('c', 0),
                'previousClose': data.get('pc', 0),
                'open': data.get('o', 0),
                'high': data.get('h', 0),
                'low': data.get('l', 0),
                'timestamp': data.get('t', 0),
                'change': data.get('d', 0),
                'changePercent': data.get('dp', 0),
                'currency': 'USD'
            }
            
            logger.info(f"✓ Quote {symbol}: ${result['price']:.2f} ({result['changePercent']:+.2f}%)")
            return result
            
        except Exception as e:
            logger.error(f"Erreur quote {symbol}: {str(e)}")
            return None
    
    def get_candles(self, symbol: str, resolution: str = 'D', count: int = 60) -> Optional[Dict]:
        """Récupère les chandeliers (candlesticks) historiques"""
        try:
            logger.info(f"Récupération des chandeliers pour {symbol} ({count} périodes, résolution: {resolution})")
            time.sleep(self.request_delay)
            
            to_timestamp = int(time.time())
            
            if resolution == 'D':
                seconds_per_bar = 86400
                margin = 1.5
            elif resolution == 'W':
                seconds_per_bar = 604800
                margin = 1.2
            elif resolution == 'M':
                seconds_per_bar = 2592000  # 30 jours
                margin = 1.1
            else:
                seconds_per_bar = int(resolution) * 60  # Minutes
                margin = 1.2
            
            from_timestamp = to_timestamp - int(count * seconds_per_bar * margin)
            
            # Appeler l'API Finnhub pour les candles historiques
            data = self.client.stock_candles(symbol, resolution, from_timestamp, to_timestamp)
            
            if not data or data.get('s') != 'ok':
                logger.warning(f"Pas de données candles pour {symbol}: {data.get('s', 'unknown')}")
                return None
            
            return {
                'timestamps': [str(t) for t in data.get('t', [])],
                'open': data.get('o', []),
                'high': data.get('h', []),
                'low': data.get('l', []),
                'close': data.get('c', []),
                'volume': data.get('v', [])
            }
            
        except Exception as e:
            logger.error(f"Erreur chandeliers {symbol}: {str(e)}")
            return None
    
    def search_symbols(self, query: str) -> List[Dict]:
        """Recherche des symboles américains"""
        try:
            logger.info(f"Recherche de symboles: {query}")
            time.sleep(self.request_delay)
            
            data = self.client.symbol_lookup(query)
            
            if not data or 'result' not in data or not data['result']:
                logger.info(f"Aucun symbole trouvé pour: {query}")
                return []
            
            results = []
            for item in data['result'][:15]:
                results.append({
                    'symbol': item.get('symbol', ''),
                    'description': item.get('description', ''),
                    'type': item.get('type', '')
                })
            
            logger.info(f"✓ Trouvé {len(results)} symboles")
            return results
            
        except Exception as e:
            logger.error(f"Erreur recherche: {str(e)}")
            return []
    
    def get_company_profile(self, symbol: str) -> Optional[Dict]:
        """Récupère le profil de la compagnie"""
        try:
            logger.info(f"Récupération du profil pour {symbol}")
            time.sleep(self.request_delay)
            
            data = self.client.company_profile2(symbol=symbol)
            
            if not data:
                logger.error(f"Pas de profil pour {symbol}")
                return None
            
            return {
                'symbol': data.get('ticker', ''),
                'name': data.get('name', ''),
                'industry': data.get('finnhubIndustry', ''),
                'exchange': data.get('exchange', ''),
                'marketCap': data.get('marketCap', 0),
                'website': data.get('weburl', '')
            }
            
        except Exception as e:
            logger.error(f"Erreur profil {symbol}: {str(e)}")
            return None


_service = FinnhubService()


def get_quote(symbol: str) -> Optional[Dict]:
    """Récupère le quote d'un symbole"""
    return _service.get_quote(symbol)


def get_candles(symbol: str, resolution: str = 'D', count: int = 60) -> Optional[Dict]:
    """Récupère les chandeliers"""
    return _service.get_candles(symbol, resolution, count)


def search_symbols(query: str) -> List[Dict]:
    """Recherche des symboles"""
    return _service.search_symbols(query)


def get_company_profile(symbol: str) -> Optional[Dict]:
    """Récupère le profil de la compagnie"""
    return _service.get_company_profile(symbol)


if __name__ == "__main__":
    service = FinnhubService()
    
    print("\n=== TEST FINNHUB SERVICE ===\n")
    

    print("1. Quote AAPL:")
    quote = service.get_quote("AAPL")
    if quote:
        print(f"   Prix: ${quote['price']:.2f}")
        print(f"   Change: {quote['changePercent']:+.2f}%")
    

    print("\n2. Quote GOOGL:")
    quote = service.get_quote("GOOGL")
    if quote:
        print(f"   Prix: ${quote['price']:.2f}")
        print(f"   Change: {quote['changePercent']:+.2f}%")
    

    print("\n3. Recherche 'Apple':")
    results = service.search_symbols("Apple")
    for r in results[:3]:
        print(f"   {r['symbol']}: {r['description']}")
    

    print("\n4. Profil MSFT:")
    profile = service.get_company_profile("MSFT")
    if profile:
        print(f"   Nom: {profile['name']}")
        print(f"   Industrie: {profile['industry']}")
        print(f"   Capitalisation: ${profile['marketCap']:,.0f}")
