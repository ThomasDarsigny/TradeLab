from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
import requests
from typing import Optional, List, Dict
from datetime import datetime, time
import pytz
import uvicorn
import asyncio
import json
import websockets

app = FastAPI(title="Yahoo Finance API Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com'
})

FINNHUB_WS_URL = "wss://ws.finnhub.io"
FINNHUB_API_KEY = "d5tncahr01qtjet0haggd5tncahr01qtjet0hah0"

class NormalizedQuote(BaseModel):
    symbol: str
    price: float
    volume: float = 0
    timestamp: int = 0
    change: Optional[float] = None
    change_percent: Optional[float] = None

MARKET_HOURS = {
    'TO': {'timezone': 'America/Toronto', 'open': time(9, 30), 'close': time(16, 0)},
    'PA': {'timezone': 'Europe/Paris', 'open': time(9, 0), 'close': time(17, 30)},
    'L': {'timezone': 'Europe/London', 'open': time(8, 0), 'close': time(16, 30)},
    'T': {'timezone': 'Asia/Tokyo', 'open': time(9, 0), 'close': time(15, 0)},
    'F': {'timezone': 'Europe/Berlin', 'open': time(9, 0), 'close': time(17, 30)},
    'HK': {'timezone': 'Asia/Hong_Kong', 'open': time(9, 30), 'close': time(16, 0)},
    'SW': {'timezone': 'Europe/Zurich', 'open': time(9, 0), 'close': time(17, 30)},
    'AX': {'timezone': 'Australia/Sydney', 'open': time(10, 0), 'close': time(16, 0)},
    'NZ': {'timezone': 'Pacific/Auckland', 'open': time(10, 0), 'close': time(16, 45)},
}

def is_market_open(symbol: str) -> bool:
    """Vérifie si le marché est ouvert pour un symbole donné"""
    if '.' not in symbol:
        tz = pytz.timezone('America/New_York')
        now = datetime.now(tz)
        market_open = time(9, 30)
        market_close = time(16, 0)
        if now.weekday() >= 5:
            return False
        return market_open <= now.time() <= market_close
    
    suffix = symbol.split('.')[-1].upper()
    if suffix not in MARKET_HOURS:
        return True
    
    market_info = MARKET_HOURS[suffix]
    tz = pytz.timezone(market_info['timezone'])
    now = datetime.now(tz)
    
    if now.weekday() >= 5:
        return False
    
    return market_info['open'] <= now.time() <= market_info['close']

GLOBAL_PRICE_CACHE: Dict[str, float] = {}

class PriceCache:
    """Cache intelligent qui détecte les changements de prix avec mémoire globale"""
    
    def has_changed(self, symbol: str, new_price: float, threshold: float = 0.01) -> bool:
        """Vérifie si le prix a changé de manière significative"""
        global GLOBAL_PRICE_CACHE
        
        if symbol not in GLOBAL_PRICE_CACHE:
            GLOBAL_PRICE_CACHE[symbol] = new_price
            return True
        
        old_price = GLOBAL_PRICE_CACHE[symbol]
        if old_price == 0:
            GLOBAL_PRICE_CACHE[symbol] = new_price
            return True
            
        change_percent = abs((new_price - old_price) / old_price * 100)
        
        if change_percent >= threshold:
            GLOBAL_PRICE_CACHE[symbol] = new_price
            return True
        return False
    
    def get_price(self, symbol: str) -> Optional[float]:
        """Récupère le dernier prix en cache"""
        return GLOBAL_PRICE_CACHE.get(symbol)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.subscriptions: Dict[WebSocket, set] = {}
        self.finnhub_ws = None
        self.finnhub_subscriptions: set = set()
        self.yahoo_subscriptions: set = set()
        self.price_cache = PriceCache()
        self.lock = asyncio.Lock()
        self.yahoo_task = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = set()
        
        if not self.finnhub_ws:
            asyncio.create_task(self.maintain_finnhub_connection())
        
        if not self.yahoo_task:
            self.yahoo_task = asyncio.create_task(self.yahoo_polling_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if websocket in self.subscriptions:
            for symbol in self.subscriptions[websocket]:
                asyncio.create_task(self.unsubscribe_symbol(symbol, websocket))
            del self.subscriptions[websocket]

    async def subscribe(self, websocket: WebSocket, symbol: str):
        symbol = symbol.upper()
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(symbol)
            
            if await self.is_finnhub_supported(symbol):
                await self.subscribe_finnhub(symbol)
            else:
                await self.subscribe_yahoo(symbol)

    async def unsubscribe(self, websocket: WebSocket, symbol: str):
        symbol = symbol.upper()
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(symbol)
            await self.unsubscribe_symbol(symbol, websocket)
    
    async def is_finnhub_supported(self, symbol: str) -> bool:
        """Vérifie si Finnhub supporte ce symbole"""
        if '.' in symbol:
            suffix = symbol.split('.')[-1]
            if suffix in ['TO', 'PA', 'L', 'T', 'F', 'HK', 'SW', 'AX', 'NZ']:
                return False
        
        return True
    
    async def subscribe_yahoo(self, symbol: str):
        """S'abonner à un symbole via Yahoo Finance (polling intelligent)"""
        async with self.lock:
            if symbol not in self.yahoo_subscriptions:
                self.yahoo_subscriptions.add(symbol)
                print(f" Subscribed to {symbol} via Yahoo Finance polling")
    
    async def unsubscribe_symbol(self, symbol: str, websocket: WebSocket):
        """Désabonner d'un symbole (Finnhub ou Yahoo)"""
        still_subscribed = any(
            symbol in subs for ws, subs in self.subscriptions.items() if ws != websocket
        )
        
        if not still_subscribed:
            async with self.lock:
                if symbol in self.finnhub_subscriptions:
                    await self.unsubscribe_finnhub(symbol)
                if symbol in self.yahoo_subscriptions:
                    self.yahoo_subscriptions.discard(symbol)
                    print(f" Unsubscribed from {symbol} (Yahoo Finance)")

    async def subscribe_finnhub(self, symbol: str):
        """S'abonner à un symbole sur Finnhub WebSocket"""
        async with self.lock:
            if symbol not in self.finnhub_subscriptions:
                self.finnhub_subscriptions.add(symbol)
                if self.finnhub_ws:
                    try:
                        await self.finnhub_ws.send(json.dumps({
                            'type': 'subscribe',
                            'symbol': symbol
                        }))
                    except Exception as e:
                        print(f"Error subscribing to {symbol}: {e}")

    async def unsubscribe_finnhub(self, symbol: str):
        """Se désabonner d'un symbole sur Finnhub WebSocket"""
        async with self.lock:
            if symbol in self.finnhub_subscriptions:
                self.finnhub_subscriptions.discard(symbol)
                if self.finnhub_ws:
                    try:
                        await self.finnhub_ws.send(json.dumps({
                            'type': 'unsubscribe',
                            'symbol': symbol
                        }))
                    except Exception as e:
                        print(f"Error unsubscribing from {symbol}: {e}")

    async def maintain_finnhub_connection(self):
        """Maintenir la connexion WebSocket à Finnhub avec reconnexion automatique"""
        while True:
            try:
                async with websockets.connect(f"{FINNHUB_WS_URL}?token={FINNHUB_API_KEY}") as ws:
                    self.finnhub_ws = ws
                    print(" Connected to Finnhub WebSocket")
                    
                    async with self.lock:
                        for symbol in self.finnhub_subscriptions:
                            await ws.send(json.dumps({
                                'type': 'subscribe',
                                'symbol': symbol
                            }))
                    
                    async for message in ws:
                        data = json.loads(message)
                        await self.handle_finnhub_message(data)
                        
            except Exception as e:
                print(f" Finnhub connection error: {e}")
                self.finnhub_ws = None
                await asyncio.sleep(5)

    async def handle_finnhub_message(self, data: dict):
        """Traiter les messages de Finnhub et les distribuer aux clients"""
        if data.get('type') == 'trade':
            for trade in data.get('data', []):
                symbol = trade.get('s')
                price = trade.get('p')
                
                if symbol and price:
                    normalized = NormalizedQuote(
                        symbol=symbol,
                        price=price,
                        volume=trade.get('v', 0),
                        timestamp=trade.get('t', 0)
                    )
                    
                    if self.price_cache.has_changed(normalized.symbol, normalized.price):
                        await self.broadcast_quote(normalized)
    
    async def broadcast_quote(self, quote: NormalizedQuote):
        """Diffuser une mise à jour de prix à tous les clients abonnés"""
        for connection in self.active_connections:
            if quote.symbol in self.subscriptions.get(connection, set()):
                try:
                    await connection.send_json({
                        'type': 'quote',
                        'symbol': quote.symbol,
                        'price': quote.price,
                        'volume': quote.volume,
                        'timestamp': quote.timestamp
                    })
                except:
                    pass
    
    async def yahoo_polling_loop(self):
        """Boucle de polling pour Yahoo Finance (symboles non supportés par Finnhub)"""
        print(" Yahoo Finance polling loop started")
        
        while True:
            try:
                if self.yahoo_subscriptions:
                    symbols_to_check = list(self.yahoo_subscriptions)
                    
                    active_symbols = [s for s in symbols_to_check if is_market_open(s)]
                    
                    if not active_symbols:
                        print(f"💤 All markets closed, skipping polling ({len(symbols_to_check)} symbols)")
                        await asyncio.sleep(60)
                        continue
                    
                    print(f"Polling {len(active_symbols)}/{len(symbols_to_check)} symbols (markets open)")
                    
                    for symbol in active_symbols:
                        try:
                            ticker = yf.Ticker(symbol, session=session)
                            info = ticker.fast_info
                            
                            price = info.get('lastPrice', 0) or info.get('regularMarketPrice', 0)
                            
                            if price and price > 0:
                                normalized = NormalizedQuote(
                                    symbol=symbol,
                                    price=price,
                                    volume=0,
                                    timestamp=int(datetime.now().timestamp()),
                                    change=info.get('regularMarketChange'),
                                    change_percent=info.get('regularMarketChangePercent')
                                )
                                
                                if self.price_cache.has_changed(normalized.symbol, normalized.price):
                                    print(f" {normalized.symbol}: ${normalized.price:.2f} (changed)")
                                    await self.broadcast_quote(normalized)
                            
                        except Exception as e:
                            print(f" Error fetching {symbol} from Yahoo: {e}")
                        
                        await asyncio.sleep(0.5)
                
                await asyncio.sleep(10)
                
            except Exception as e:
                print(f" Yahoo polling error: {e}")
                await asyncio.sleep(5)

manager = ConnectionManager()

@app.get("/")
def root():
    return {"status": "ok", "service": "Yahoo Finance API"}

@app.get("/search")
def search_symbols(q: str, limit: int = 100):
    """Recherche de symboles via Yahoo Finance"""
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}&quotesCount={limit}&newsCount=0"
        response = session.get(url, timeout=10)
        
        if not response.ok:
            raise HTTPException(status_code=response.status_code, detail=f"Yahoo error: {response.status_code}")
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/quote/{symbol}")
def get_quote(symbol: str):
    """Récupère le quote d'un symbole (fallback yfinance)"""
    try:
        ticker = yf.Ticker(symbol, session=session)
        info = ticker.fast_info
        
        return {
            'symbol': symbol.upper(),
            'price': info.get('lastPrice', 0),
            'change': info.get('regularMarketChange', 0),
            'changePercent': info.get('regularMarketChangePercent', 0),
            'open': info.get('open', 0),
            'high': info.get('dayHigh', 0),
            'low': info.get('dayLow', 0),
            'previousClose': info.get('previousClose', 0),
            'marketCap': info.get('marketCap', 0)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{symbol}")
def get_history(symbol: str, period: str = "1mo", interval: str = "1d"):
    """Récupère l'historique des prix (chandeliers)"""
    try:
        ticker = yf.Ticker(symbol, session=session)
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

@app.websocket("/ws/quotes")
async def websocket_quotes(websocket: WebSocket):
    """WebSocket pour streaming PUSH de quotes en temps réel via Finnhub + Yahoo"""
    await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            action = message.get('action')
            symbol = message.get('symbol', '').upper()
            
            if action == 'subscribe' and symbol:
                await manager.subscribe(websocket, symbol)
                await websocket.send_json({
                    'type': 'subscribed',
                    'symbol': symbol,
                    'message': f'Subscribed to {symbol} - real-time updates'
                })
            elif action == 'unsubscribe' and symbol:
                await manager.unsubscribe(websocket, symbol)
                await websocket.send_json({
                    'type': 'unsubscribed',
                    'symbol': symbol,
                    'message': f'Unsubscribed from {symbol}'
                })
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
