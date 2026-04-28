from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import requests
from typing import Optional, List
import uvicorn
import asyncio
import json

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

def _to_list(series_like):
    if series_like is None:
        return []
    if hasattr(series_like, "columns"):
        return series_like.values.flatten().tolist()
    if hasattr(series_like, "tolist"):
        return series_like.tolist()
    if hasattr(series_like, "values"):
        return series_like.values.flatten().tolist()
    return list(series_like)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.subscriptions: dict = {}
        self.candlestick_connections: List[WebSocket] = []
        self.candlestick_subscriptions: dict = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = set()

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]

    def subscribe(self, websocket: WebSocket, symbol: str):
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(symbol.upper())

    def unsubscribe(self, websocket: WebSocket, symbol: str):
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(symbol.upper())

    async def connect_candlestick(self, websocket: WebSocket):
        await websocket.accept()
        self.candlestick_connections.append(websocket)
        self.candlestick_subscriptions[websocket] = set()

    def disconnect_candlestick(self, websocket: WebSocket):
        if websocket in self.candlestick_connections:
            self.candlestick_connections.remove(websocket)
        if websocket in self.candlestick_subscriptions:
            del self.candlestick_subscriptions[websocket]

    def subscribe_candlestick(self, websocket: WebSocket, symbol: str):
        if websocket in self.candlestick_subscriptions:
            self.candlestick_subscriptions[websocket].add(symbol.upper())

    def unsubscribe_candlestick(self, websocket: WebSocket, symbol: str):
        if websocket in self.candlestick_subscriptions:
            self.candlestick_subscriptions[websocket].discard(symbol.upper())

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
    """Récupère le quote d'un symbole"""
    try:
        ticker = yf.Ticker(symbol)
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
    hist = None
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
    except Exception as e:
        print(f"[history] primary error symbol={symbol} period={period} interval={interval}: {e}")

    if hist is None or getattr(hist, "empty", True):
        try:
            hist = yf.download(
                symbol,
                period=period,
                interval=interval,
                progress=False,
                threads=False,
                group_by="column"
            )
        except Exception as e:
            print(f"[history] fallback error symbol={symbol} period={period} interval={interval}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    if hist.empty:
        raise HTTPException(status_code=404, detail="No data available")

    timestamps = []
    for ts in hist.index:
        if ts.tzinfo is None:
            timestamps.append(int(ts.replace(tzinfo=None).timestamp()))
        else:
            timestamps.append(int(ts.tz_convert('UTC').timestamp()))

    return {
        'timestamps': timestamps,
        'open': _to_list(hist['Open']),
        'high': _to_list(hist['High']),
        'low': _to_list(hist['Low']),
        'close': _to_list(hist['Close']),
        'volume': _to_list(hist['Volume'])
    }

@app.websocket("/ws/quotes")
async def websocket_quotes(websocket: WebSocket):
    """WebSocket pour streaming de quotes en temps réel"""
    await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            action = message.get('action')
            symbol = message.get('symbol', '').upper()
            
            if action == 'subscribe' and symbol:
                manager.subscribe(websocket, symbol)
                await websocket.send_json({
                    'type': 'subscribed',
                    'symbol': symbol,
                    'message': f'Subscribed to {symbol}'
                })
            elif action == 'unsubscribe' and symbol:
                manager.unsubscribe(websocket, symbol)
                await websocket.send_json({
                    'type': 'unsubscribed',
                    'symbol': symbol,
                    'message': f'Unsubscribed from {symbol}'
                })
            
            for sub_symbol in manager.subscriptions.get(websocket, set()):
                try:
                    ticker = yf.Ticker(sub_symbol)
                    info = ticker.fast_info
                    
                    quote_data = {
                        'type': 'quote',
                        'symbol': sub_symbol,
                        'price': info.get('lastPrice', 0),
                        'change': info.get('regularMarketChange', 0),
                        'changePercent': info.get('regularMarketChangePercent', 0),
                        'timestamp': asyncio.get_event_loop().time()
                    }
                    
                    await websocket.send_json(quote_data)
                except Exception as e:
                    print(f"Error fetching {sub_symbol}: {e}")
            
            await asyncio.sleep(5)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.websocket("/ws/candlesticks")
async def websocket_candlesticks(websocket: WebSocket):
    """WebSocket pour streaming de candlesticks en temps réel"""
    # HandShake: Accepte la connexion WebSocket pour les candlesticks
    await manager.connect_candlestick(websocket)
    
    try:
        # Tant que cette boucle tourne, le serveur continue d'écouter les messages 
        # du client et d'envoyer des mises à jour de candlesticks
        while True:                 
            try:
                # Attend un message du client demande d'abonnement/désabonnement                                                                                # Demande d'abonnement/désabonnement
                data = await asyncio.wait_for(websocket.receive_text(), timeout=2)
                                                                                   
                message = json.loads(data)

                action = message.get('action')
                symbols = message.get('symbols', [])

                if action == 'subscribe':
                    for symbol in symbols:
                        manager.subscribe_candlestick(websocket, symbol)
                elif action == 'unsubscribe':
                    for symbol in symbols:
                        manager.unsubscribe_candlestick(websocket, symbol)
            except asyncio.TimeoutError:
                pass
            
            # Pour chaque symbole auquel le client est abonné, 
            # récupère le dernier chandelier et envoie une mise à jour
            for sub_symbol in manager.candlestick_subscriptions.get(websocket, set()): 
                try:
                    ticker = yf.Ticker(sub_symbol)
                    hist = ticker.history(period="1d", interval="1m")
                    
                    if not hist.empty:
                        last_row = hist.iloc[-1]
                        last_index = hist.index[-1]
                        if last_index.tzinfo is None:
                            last_timestamp = int(last_index.replace(tzinfo=None).timestamp())
                        else:
                            last_timestamp = int(last_index.tz_convert('UTC').timestamp())
                        
                        candlestick_data = {
                            'type': 'candlestick_update',
                            'symbol': sub_symbol,
                            'time': last_timestamp,
                            'open': float(last_row['Open']),
                            'high': float(last_row['High']),
                            'low': float(last_row['Low']),
                            'close': float(last_row['Close']),
                            'volume': int(last_row.get('Volume', 0)),
                            'timestamp': asyncio.get_event_loop().time()
                        }
                        
                        # Envoie la mise à jour du candlestick au client
                        await websocket.send_json(candlestick_data)
                except Exception as e:
                    print(f"Error fetching candlestick for {sub_symbol}: {e}")
    
    #Le WS peut se fermer de manière normale (client qui se déconnecte) 
    except WebSocketDisconnect:
        manager.disconnect_candlestick(websocket)
    #Ou il peut y avoir une erreur inattendue (ex: problème de réseau, bug dans le code, etc.)
    except Exception as e:
        print(f"WebSocket candlestick error: {e}")
        manager.disconnect_candlestick(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
