"""
Yahoo Finance API Service avec protection anti-blocage avancée

Fonctionnalités:
- Cloudscraper pour contourner les protections anti-bot
- Rotation des User-Agents (Chrome 142+, Firefox 123+)
- Rate limiting automatique entre les requêtes
- Rotation et suivi d'état des proxies privés

Configuration des proxies:
Utilise proxy_config.py pour fournir une liste de proxies privés.
La rotation et le suivi d'état sont automatiques.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import cloudscraper
from typing import Optional
import uvicorn
import random
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from config.proxy_manager import ProxyManager

try:
    from config.proxy_config import (
        USE_PROXIES, 
        PROXY_LIST, 
        REQUEST_DELAY, 
        REQUEST_TIMEOUT,
        USER_AGENTS
    )
except ImportError:
    USE_PROXIES = True
    PROXY_LIST = []
    REQUEST_DELAY = 1.5
    REQUEST_TIMEOUT = 10
    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    ]

proxy_manager = ProxyManager(
    min_proxies=5, 
    max_failed_attempts=3,
    test_timeout=5, 
    refresh_interval=300, 
    candidate_proxies=PROXY_LIST
)

app = FastAPI(title="Yahoo Finance API Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

last_request_time = 0
current_proxy_url = None

#Initialise le pool de proxies au démarrage du service
@app.on_event("startup")
async def startup_event():
    """Initialise le gestionnaire de proxies au démarrage"""
    if USE_PROXIES:
        proxy_manager.set_candidate_proxies(PROXY_LIST)
        proxy_manager.initialize()
    else:
        print("\n  Mode sans proxy activé")
        print(" Active USE_PROXIES dans proxy_config.py pour utiliser les proxies\n")

@app.on_event("shutdown")
async def shutdown_event():
    """Arrête le gestionnaire de proxies"""
    if USE_PROXIES:
        proxy_manager.stop_auto_refresh()
        print("\n Gestionnaire de proxies arrêté")

def get_session(use_proxy=True):
    """Crée une session cloudscraper avec User-Agent aléatoire et proxy rotatif"""
    global current_proxy_url
    
    scraper = cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'mobile': False
        }
    )
    
    scraper.headers.update({
        'User-Agent': random.choice(USER_AGENTS)
    })
    
    if USE_PROXIES and use_proxy:
        proxy = proxy_manager.get_next_proxy()
        if proxy:
            current_proxy_url = proxy.get('_url')
            scraper.proxies.update(proxy)
            print(f" Utilisation du proxy: {proxy.get('http', 'N/A')}")
    
    return scraper

def rate_limit():
    """Applique un délai entre les requêtes pour éviter le rate limiting"""
    global last_request_time
    current_time = time.time()
    time_since_last = current_time - last_request_time
    if time_since_last < REQUEST_DELAY:
        time.sleep(REQUEST_DELAY - time_since_last)
    last_request_time = time.time()

session = get_session()

@app.get("/")
def root():
    return {"status": "ok", "service": "Yahoo Finance API"}

@app.get("/search")
def search_symbols(q: str, limit: int = 100):
    """Recherche de symboles via Yahoo Finance"""
    global current_proxy_url
    try:
        rate_limit()
        
        global session
        session = get_session()
        
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}&quotesCount={limit}&newsCount=0"
        response = session.get(url, timeout=REQUEST_TIMEOUT)
        
        if not response.ok:
            if USE_PROXIES and current_proxy_url:
                proxy_manager.mark_proxy_failed(current_proxy_url)
            raise HTTPException(status_code=response.status_code, detail=f"Yahoo error: {response.status_code}")
        
        if USE_PROXIES and current_proxy_url:
            proxy_manager.mark_proxy_success(current_proxy_url)
        
        data = response.json()
        quotes = data.get('quotes', [])
        
        symbols = []
        for quote in quotes:
            if quote.get('symbol') and quote.get('shortname'):
                symbols.append({
                    'symbol': quote['symbol'],
                    'name': quote.get('longname') or quote.get('shortname'),
                    'exchange': quote.get('exchange', ''),
                    'type': quote.get('quoteType', '')
                })
        
        return {'symbols': symbols}
    except HTTPException:
        raise
    except Exception as e:
        if USE_PROXIES and current_proxy_url:
            proxy_manager.mark_proxy_failed(current_proxy_url)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/quote/{symbol}")
def get_quote(symbol: str):
    """Récupère le quote d'un symbole"""
    try:
        rate_limit()
        
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        logo_url = None
        try:
            logo_url = ticker.info.get('logo_url')
        except Exception:
            logo_url = None
        
        return {
            'symbol': symbol.upper(),
            'price': info.get('lastPrice', 0),
            'change': info.get('regularMarketChange', 0),
            'changePercent': info.get('regularMarketChangePercent', 0),
            'open': info.get('open', 0),
            'high': info.get('dayHigh', 0),
            'low': info.get('dayLow', 0),
            'previousClose': info.get('previousClose', 0),
            'marketCap': info.get('marketCap', 0),
            'logoUrl': logo_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{symbol}")
def get_history(symbol: str, period: str = "1mo", interval: str = "1d"):
    """Récupère l'historique des prix (chandeliers)"""
    try:
        rate_limit()
        
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data available")
        
        timestamps = [int(ts.timestamp()) for ts in hist.index]
        
        return {
            'timestamps': timestamps,
            'open': hist['Open'].tolist(),
            'high': hist['High'].tolist(),
            'low': hist['Low'].tolist(),
            'close': hist['Close'].tolist(),
            'volume': hist['Volume'].tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/proxy/stats")
def get_proxy_stats():
    """Récupère les statistiques du pool de proxies"""
    if not USE_PROXIES:
        return {
            "enabled": False,
            "message": "Les proxies ne sont pas activés"
        }
    
    stats = proxy_manager.get_stats()
    return {
        "enabled": True,
        "active_proxies": stats['active_proxies'],
        "total_successes": stats['total_successes'],
        "total_failures": stats['total_failures'],
        "proxies": [
            {
                "url": p['url'],
                "successes": p['successes'],
                "failures": p['failures'],
                "last_used": p['last_used'].isoformat() if p['last_used'] else None,
                "added_at": p['added_at'].isoformat()
            }
            for p in stats['proxies']
        ]
    }

@app.post("/proxy/refresh")
def refresh_proxies():
    """Force le rafraîchissement du pool de proxies"""
    if not USE_PROXIES:
        return {
            "success": False,
            "message": "Les proxies ne sont pas activés"
        }
    
    import threading
    threading.Thread(target=proxy_manager.refresh_proxies, args=(True,), daemon=True).start()
    
    return {
        "success": True,
        "message": "Rafraîchissement du pool lancé en arrière-plan"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
