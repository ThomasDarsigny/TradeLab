# Structure du Projet TradeLab

```
TradeLab/
│
├── backend/                    # Services Backend Python
│   ├── config/                    # Configuration
│   │   ├── __init__.py
│   │   ├── proxy_config.py       # Config proxies privés
│   │   └── proxy_manager.py      # Gestionnaire de rotation
│   │
│   ├── services/                  # Services API
│   │   ├── __init__.py
│   │   ├── yfinance_service.py   # Service principal (Yahoo Finance)
│   │   ├── finnhub_service.py    # Service alternatif
│   │   ├── websocket_*.py        # WebSocket temps réel
│   │   └── yahoo*.py             # Services Yahoo alternatifs
│   │
├── src/                        # Frontend SvelteKit
│   ├── lib/
│   │   ├── components/           # Composants UI Svelte
│   │   │   ├── AccueilTab.svelte
│   │   │   ├── PlacementsTab.svelte
│   │   │   ├── NewsTab.svelte
│   │   │   ├── StockSearch.svelte
│   │   │   ├── TradeForm.svelte
│   │   │   └── ...
│   │   │
│   │   ├── services/             # Services frontend
│   │   │   ├── accountService.ts
│   │   │   └── quotesWebSocket.ts
│   │   │
│   │   ├── stores/               # State management
│   │   │   ├── portfolio.svelte.ts
│   │   │   └── market.ts
│   │   │
│   │   ├── types/                # Types TypeScript
│   │   │   └── account.ts
│   │   │
│   │   └── sql/
│   │       └── schema.sql        # Schéma DB
│   │
│   └── routes/                    # Routes et API
│       ├── +page.svelte          # Page principale
│       ├── +layout.svelte        # Layout global
│       └── api/                  # API endpoints
│
├── docs/                       # Documentation
│   ├── README.md                 # Doc originale
│   ├── API.md                    # Documentation API
│   ├── DEVELOPMENT.md            # Guide développeur
│   └── PROXY_SETUP.md            # Configuration proxies
│
├── scripts/                   # Scripts utilitaires
│   └── launch_api.py             # Script de lancement original
│
├── static/                     # Fichiers statiques
│   └── robots.txt
│
├── Fichiers racine             # Configuration projet
│   ├── start_api.py             # Script de démarrage principal
│   ├── README.md                # Documentation principale
│   ├── requirements.txt         # Dépendances Python
│   ├── package.json             # Dépendances Node.js
│   ├── .gitignore               # Fichiers ignorés
│   ├── .env                     # Variables d'environnement
│   ├── svelte.config.js         # Config SvelteKit
│   ├── vite.config.ts           # Config Vite
│   └── tsconfig.json            # Config TypeScript
│
└── Autres
    ├── venv/                     # Environnement virtuel Python
    └── node_modules/             # Dépendances Node.js
```

## Points d'entrée

| Fichier | Description | Commande |
|---------|-------------|----------|
| `start_api.py` | Service API Backend | `python start_api.py` |
| `src/routes/+page.svelte` | Page d'accueil Frontend | `npm run dev` |

## Modules principaux

### Backend
- **`backend/services/yfinance_service.py`** - Service principal Yahoo Finance
- **`backend/config/proxy_manager.py`** - Gestion des proxies rotatifs
- **`backend/config/proxy_config.py`** - Configuration des proxies privés

### Frontend
- **`src/lib/components/`** - Composants UI réutilisables
- **`src/lib/stores/`** - État global de l'application

## Documentation

| Fichier | Contenu |
|---------|---------|
| `README.md` | Vue d'ensemble, démarrage rapide |
| `docs/API.md` | Documentation complète de l'API |
| `docs/DEVELOPMENT.md` | Guide de développement |
| `docs/PROXY_SETUP.md` | Configuration des proxies |

## Commandes rapides

```bash
# Backend
python start_api.py                    # Démarrer l'API

# Frontend
npm run dev                            # Mode développement
npm run build                          # Build production
npm run preview                        # Preview du build
```
## Structure organisée pour

- Séparation claire Backend/Frontend
- Configuration centralisée
- Documentation complète
- Scripts utilitaires séparés
- Packages Python propres avec `__init__.py`