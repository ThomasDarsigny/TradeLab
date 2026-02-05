"""API FastAPI pour TradeLab - Données boursières via Finnhub"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import logging
import json
import uvicorn

from finnhub_service import FinnhubService
from websocket_service import manager as single_manager
from websocket_multi_service import manager as multi_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tradelab_api")

app = FastAPI(
    title="TradeLab API",
    description="Données boursières US via Finnhub",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = FinnhubService()



class Quote(BaseModel):
    symbol: str
    price: float
    change: float
    changePercent: float
    open: float
    high: float
    low: float
    previousClose: float
    currency: str


class SearchResult(BaseModel):
    symbol: str
    description: str
    type: Optional[str] = None


class Candle(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class CompanyProfile(BaseModel):
    symbol: str
    name: str
    industry: str
    exchange: str
    marketCap: int
    website: str



@app.get("/", tags=["Root"])
async def root():
    """Info API"""
    return {
        "name": "TradeLab API",
        "version": "1.0.0",
        "description": "Données boursières US",
        "status": "ok"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Vérification santé"""
    return {"status": "ok"}


@app.get("/search", tags=["Search"], response_model=List[SearchResult])
async def search(query: str):
    """Recherche de symboles US"""
    if not query or len(query) < 1:
        raise HTTPException(status_code=400, detail="Query vide")
    
    try:
        results = service.search_symbols(query)
        return results if results else []
    except Exception as e:
        logger.error(f"Erreur recherche: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/quote/{symbol}", tags=["Quotes"], response_model=Quote)
async def get_quote(symbol: str):
    """Récupère le prix actuel"""
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbole vide")
    
    try:
        quote = service.get_quote(symbol)
        if not quote:
            raise HTTPException(status_code=404, detail=f"Quote non trouvé pour {symbol}")
        return quote
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur quote {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/candles/{symbol}", tags=["Candles"], response_model=Dict)
async def get_candles(symbol: str, resolution: str = "D", count: int = 60):
    """Récupère les chandeliers (OHLCV)"""
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbole vide")
    
    try:
        candles = service.get_candles(symbol, resolution, count)
        if not candles:
            raise HTTPException(status_code=404, detail=f"Chandeliers non trouvés pour {symbol}")
        return candles
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur candles {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/profile/{symbol}", tags=["Company"], response_model=CompanyProfile)
async def get_profile(symbol: str):
    """Récupère le profil de la compagnie"""
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbole vide")
    
    try:
        profile = service.get_company_profile(symbol)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Profil non trouvé pour {symbol}")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur profil {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/symbols", tags=["Symbols"])
async def popular_symbols():
    """Liste de symboles populaires"""
    return [
        {"symbol": "AAPL", "name": "Apple Inc"},
        {"symbol": "MSFT", "name": "Microsoft Corp"},
        {"symbol": "GOOGL", "name": "Alphabet Inc"},
        {"symbol": "AMZN", "name": "Amazon Inc"},
        {"symbol": "TSLA", "name": "Tesla Inc"},
        {"symbol": "META", "name": "Meta Platforms"},
        {"symbol": "NVDA", "name": "NVIDIA Corp"},
        {"symbol": "JPM", "name": "JPMorgan Chase"},
    ]


@app.get("/ws/info", tags=["WebSocket"])
async def websocket_info():
    """Infos sur les connexions WebSocket"""
    return multi_manager.get_info()


@app.websocket("/ws/quote/{symbol}")
async def websocket_single(websocket: WebSocket, symbol: str):
    """WebSocket simple: 1 symbole"""
    await single_manager.connect(websocket, symbol)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await single_manager.disconnect(websocket, symbol)


@app.websocket("/ws/quotes")
async def websocket_multi(websocket: WebSocket):
    """WebSocket multi-symboles OPTIMISE
    
    Usage:
    ws.send(JSON.stringify({symbols: ['AAPL', 'MSFT', 'GOOGL']}))
    
    Avantages:
    - 1 connexion pour N symboles
    - Cache local
    - Jusqu'à 15 symboles par connexion
    """
    try:        await websocket.accept()
        
        data = await websocket.receive_text()
        message = json.loads(data)
        symbols = message.get('symbols', [])[:15]
        
        if not symbols:
            await websocket.send_json({
                "type": "error",
                "detail": "Envoyez {'symbols': ['AAPL', 'MSFT']}"
            })
            return
        
        await multi_manager.connect(websocket, symbols)
        
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg.get('type') == 'subscribe':
                new_symbols = msg.get('symbols', [])
                current = multi_manager.subscriptions.get(websocket, set())
                all_symbols = list(set(current) | set(new_symbols))[:15]
                await multi_manager.disconnect(websocket)
                await multi_manager.connect(websocket, all_symbols)
            elif msg.get('type') == 'stats':
                await multi_manager.send_stats(websocket)
            elif data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await multi_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Erreur WS: {e}")



@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "detail": exc.detail,
        "status_code": exc.status_code
    }


if __name__ == "__main__":
    logger.info("Démarrage du serveur TradeLab API")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
