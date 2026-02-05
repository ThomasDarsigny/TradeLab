"""
Script de démarrage du service Yahoo Finance API
"""
import sys
from pathlib import Path

backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from services.yfinance_service import app
import uvicorn

if __name__ == "__main__":
    print("\n" + "="*60)
    print(" TradeLab - Yahoo Finance API Service")
    print("="*60 + "\n")
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8001,
        log_level="info"
    )
