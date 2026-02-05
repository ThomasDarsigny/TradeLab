"""Service WebSocket pour les mises à jour de prix en temps réel"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect

from finnhub_service import FinnhubService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("websocket_service")

service = FinnhubService(request_delay=0.5)


class ConnectionManager:
    """Gère les connexions WebSocket et les souscriptions"""
    
    def __init__(self):
        self.active_connections: dict[str, Set[WebSocket]] = {}
        self.update_tasks: dict[str, asyncio.Task] = {}
    
    async def connect(self, websocket: WebSocket, symbol: str):
        """Accepte une nouvelle connexion WebSocket"""
        await websocket.accept()
        
        if symbol not in self.active_connections:
            self.active_connections[symbol] = set()
            self.update_tasks[symbol] = asyncio.create_task(
                self._broadcast_updates(symbol)
            )
        
        self.active_connections[symbol].add(websocket)
        logger.info(f"Client connecté: {symbol} ({len(self.active_connections[symbol])} clients)")
    
    async def disconnect(self, websocket: WebSocket, symbol: str):
        """Déconnecte un client WebSocket"""
        if symbol in self.active_connections:
            self.active_connections[symbol].discard(websocket)
            logger.info(f"Client déconnecté: {symbol} ({len(self.active_connections[symbol])} clients)")
            
            if not self.active_connections[symbol]:
                if symbol in self.update_tasks:
                    self.update_tasks[symbol].cancel()
                    del self.update_tasks[symbol]
                del self.active_connections[symbol]
    
    async def _broadcast_updates(self, symbol: str):
        """Diffuse les mises à jour de prix toutes les 5 secondes"""
        try:
            while symbol in self.active_connections:
                quote = service.get_quote(symbol)
                
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
                    for websocket in self.active_connections[symbol]:
                        try:
                            await websocket.send_json(message)
                        except Exception as e:
                            logger.warning(f"Erreur envoi {symbol}: {e}")
                            dead_connections.append(websocket)
                    
                    for websocket in dead_connections:
                        await self.disconnect(websocket, symbol)
                
                await asyncio.sleep(5)
        
        except asyncio.CancelledError:
            logger.info(f"Tâche update annulée pour {symbol}")
        except Exception as e:
            logger.error(f"Erreur broadcast {symbol}: {e}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Envoie un message à un client spécifique"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Erreur envoi personnel: {e}")
    
    async def broadcast(self, message: dict, symbol: str):
        """Diffuse un message à tous les clients d'un symbole"""
        if symbol in self.active_connections:
            for websocket in self.active_connections[symbol]:
                try:
                    await websocket.send_json(message)
                except:
                    pass


manager = ConnectionManager()
