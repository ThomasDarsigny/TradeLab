# 📈 TradeLab

Plateforme de trading en ligne avec données de marché en temps réel.

## 🏗️ Architecture

```
TradeLab/
├── backend/              # Services Python
│   ├── config/          # Configuration (proxies, settings)
│   ├── services/        # Services API (Yahoo Finance, Finnhub, WebSocket)
├── src/                 # Frontend SvelteKit
│   ├── lib/
│   │   ├── components/  # Composants UI
│   │   ├── services/    # Services frontend
│   │   ├── stores/      # State management
│   │   └── types/       # Types TypeScript
│   └── routes/          # Routes et API endpoints
├── docs/                # Documentation
├── scripts/             # Scripts utilitaires
└── static/              # Fichiers statiques
```

## 🚀 Démarrage rapide

### Backend (API Yahoo Finance)

```bash
# Activer l'environnement virtuel
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Installer les dépendances
pip install -r requirements.txt

# Démarrer le service
python start_api.py
```

Le service sera disponible sur `http://127.0.0.1:8001/`

### Frontend (SvelteKit)

```bash
# Installer les dépendances
npm install

# Mode développement
npm run dev

# Build production
npm run build
```

## 📡 API Endpoints

### Yahoo Finance Service

- `GET /` - Statut du service
- `GET /search?q={symbol}&limit={n}` - Recherche de symboles
- `GET /quote/{symbol}` - Citation en temps réel
- `GET /history/{symbol}?period={period}` - Données historiques
- `GET /proxy/stats` - Statistiques des proxies
- `POST /proxy/refresh` - Rafraîchir les proxies

## ⚙️ Configuration

### Proxies privés

Éditer `backend/config/proxy_config.py` :

```python
USE_PROXIES = True
PROXY_LIST = [
    "http://user:pass@ip:port",
    # ... autres proxies
]
```

## 🔧 Technologies

**Backend:**
- FastAPI - Framework API moderne
- yfinance - Données Yahoo Finance
- Cloudscraper - Anti-bot protection
- Proxies rotatifs - Éviter les rate limits

**Frontend:**
- SvelteKit - Framework fullstack
- TypeScript - Type safety
- Supabase - Base de données et auth
- Vite - Build tool

## 📊 Fonctionnalités

- ✅ Recherche de symboles boursiers
- ✅ Citations en temps réel
- ✅ Données historiques
- ✅ Gestion de portfolio
- ✅ Trading (achat/vente)
- ✅ Authentification utilisateur
- ✅ Graphiques interactifs
- ✅ Actualités financières

## 🛡️ Sécurité

- Rotation automatique de proxies
- Rate limiting
- Headers de navigateur réalistes
- Protection anti-bot (Cloudscraper)

## 📝 Licence

Projet académique - CEGEP Session 8
