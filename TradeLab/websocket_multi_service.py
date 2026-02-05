"""Service WebSocket optimisé pour PLUSIEURS symboles"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Set, Dict, Optional
from fastapi import WebSocket, WebSocketDisconnect

from finnhub_service import FinnhubService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("websocket_multi_service")

service = FinnhubService(request_delay=0.3)


class QuoteCache:
    """Cache pour les prix - évite les appels API inutiles"""
    
    def __init__(self, ttl_seconds: int = 5):
        self.ttl = ttl_seconds
        self.cache: Dict[str, dict] = {}
        self.timestamps: Dict[str, datetime] = {}
    
    def get(self, symbol: str) -> Optional[dict]:
        """Récupère le prix du cache s'il est encore valide"""
        if symbol not in self.cache:
            return None
        
        if datetime.now() - self.timestamps[symbol] > timedelta(seconds=self.ttl):
            del self.cache[symbol]
            del self.timestamps[symbol]
            return None
        
        return self.cache[symbol]
    
    def set(self, symbol: str, data: dict):
        """Stocke le prix dans le cache"""
        self.cache[symbol] = data
        self.timestamps[symbol] = datetime.now()
    
    def is_stale(self, symbol: str) -> bool:
        """Vérifie si le cache est expiré"""
        return self.get(symbol) is None


class MultiSymbolConnectionManager:
    """Gère les WebSockets multi-symboles avec optimisations"""
    
    def __init__(self, update_interval: int = 5, max_batch_size: int = 5):
        self.connections: Dict[str, Set[WebSocket]] = {}
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
        self.update_tasks: Dict[str, asyncio.Task] = {}
        self.cache = QuoteCache(ttl_seconds=update_interval)
        self.update_interval = update_interval
        self.max_batch_size = max_batch_size
        self.api_call_count = 0
        self.last_reset = datetime.now()
    
    async def connect(self, websocket: WebSocket, symbols: list[str]):
        """Accepte une connexion pour plusieurs symboles"""
        await websocket.accept()
        
        self.subscriptions[websocket] = set(symbols)
        
        for symbol in symbols:
            if symbol not in self.connections:
                self.connections[symbol] = set()
                self.update_tasks[symbol] = asyncio.create_task(
                    self._broadcast_updates(symbol)
                )
            
            self.connections[symbol].add(websocket)
        
        logger.info(f"Client connecté: {symbols} (total: {len(self.connections)} symboles)")
        
        for symbol in symbols:
            quote = await self._get_quote_cached(symbol)
            if quote:
                message = {
                    "type": "quote_update",
                    "symbol": symbol,
                    "price": quote['price'],
                    "change": quote['change'],
                    "changePercent": quote['changePercent'],
                    "timestamp": datetime.now().isoformat()
                }
                try:
                    await websocket.send_json(message)
                except:
                    pass
    
    async def disconnect(self, websocket: WebSocket):
        """Déconnecte un client"""
        if websocket not in self.subscriptions:
            return
        
        symbols = self.subscriptions[websocket]
        
        for symbol in symbols:
            if symbol in self.connections:
                self.connections[symbol].discard(websocket)
                
                if not self.connections[symbol]:
                    if symbol in self.update_tasks:
                        self.update_tasks[symbol].cancel()
                        del self.update_tasks[symbol]
                    del self.connections[symbol]
        
        del self.subscriptions[websocket]
        logger.info(f"Client déconnecté: {symbols}")
    
    async def _get_quote_cached(self, symbol: str) -> Optional[dict]:
        """Récupère le quote, en cache si possible"""
        cached = self.cache.get(symbol)
        if cached:
            return cached
        
        try:
            loop = asyncio.get_event_loop()
            quote = await loop.run_in_executor(None, service.get_quote, symbol)
            if quote:
                self.cache.set(symbol, quote)
                self.api_call_count += 1
                self._log_api_usage()
            return quote
        except Exception as e:
            logger.error(f"Erreur quote {symbol}: {e}")
            return None
    
    def _log_api_usage(self):
        """Log l'utilisation de l'API"""
        now = datetime.now()
        if now - self.last_reset >= timedelta(minutes=1):
            logger.info(f"API calls/min: {self.api_call_count} (limit: 60)")
            self.api_call_count = 0
            self.last_reset = now
    
    async def _broadcast_updates(self, symbol: str):
        """Diffuse les mises à jour pour un symbole"""
        try:
            while symbol in self.connections and self.connections[symbol]:
                quote = await self._get_quote_cached(symbol)
                
                if quote:
                    message = {
                        "type": "quote_update",
                        "symbol": symbol,
                        "price": quote['price'],
                        "change": quote['change'],
                        "changePercent": quote['changePercent'],
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    dead_connections = []
                    for websocket in self.connections[symbol]:
                        try:
                            await websocket.send_json(message)
                        except Exception as e:
                            logger.warning(f"Erreur envoi {symbol}: {e}")
                            dead_connections.append(websocket)
                    
                    for websocket in dead_connections:
                        await self.disconnect(websocket)
                
                await asyncio.sleep(self.update_interval)
        
        except asyncio.CancelledError:
            logger.info(f"Update task annulée pour {symbol}")
        except Exception as e:
            logger.error(f"Erreur broadcast {symbol}: {e}")
    
    async def send_stats(self, websocket: WebSocket):
        """Envoie les stats d'utilisation"""
        stats = {
            "type": "stats",
            "total_symbols": len(self.connections),
            "total_connections": sum(len(conns) for conns in self.connections.values()),
            "api_calls_per_minute": self.api_call_count,
            "update_interval": self.update_interval,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await websocket.send_json(stats)
        except:
            pass
    
    def get_info(self) -> dict:
        """Retourne les infos sur les connexions"""
        return {
            "active_symbols": list(self.connections.keys()),
            "active_connections": sum(len(conns) for conns in self.connections.values()),
            "symbols_count": len(self.connections),
            "update_interval": self.update_interval,
            "api_call_count": self.api_call_count,
            "max_possible_symbols": min(60 // max(1, (12 // self.update_interval * 5)), 20)
        }


manager = MultiSymbolConnectionManager(update_interval=5)
