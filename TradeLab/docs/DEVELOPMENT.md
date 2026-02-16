# Guide de Développement

## Structure du projet

### Backend (`backend/`)

#### `config/`
- `proxy_config.py` - Configuration des proxies privés
- `proxy_manager.py` - Gestionnaire de rotation des proxies

#### `services/`
- `yfinance_service.py` - Service principal Yahoo Finance API
- `finnhub_service.py` - Service Finnhub (alternative)
- `websocket_*.py` - Services WebSocket temps réel
- `yahoo*.py` - Services Yahoo alternatifs


### Frontend (`src/`)

#### `lib/components/`
Composants Svelte réutilisables :
- `AccueilTab.svelte` - Page d'accueil
- `PlacementsTab.svelte` - Gestion du portfolio
- `NewsTab.svelte` - Actualités financières
- `StockSearch.svelte` - Recherche de symboles
- `TradeForm.svelte` - Formulaires de trading

#### `lib/services/`
- `accountService.ts` - Gestion des comptes
- `quotesWebSocket.ts` - WebSocket pour prix temps réel

#### `lib/stores/`
- `portfolio.svelte.ts` - État du portfolio
- `market.ts` - État du marché

#### `routes/`
Routes SvelteKit et API endpoints

## Commandes utiles

### Backend

```bash
# Démarrer le service principal
python start_api.py

# Verifier un proxy
python -c "from backend.config.proxy_manager import ProxyManager; pm = ProxyManager(); print(pm.test_proxy('http://user:pass@ip:port'))"
```

### Frontend

```bash
# Dev mode avec hot-reload
npm run dev

# Build pour production
npm run build


## Workflow de développement
1. **Nouvelle fonctionnalité**
   - Créer une branche : `git checkout -b feature/nom`
   - Développer et tester
   - Commit : `git commit -m "feat: description"`
   - Merge dans main

2. **Correction de bug**
   - Branche : `git checkout -b fix/nom`
   - Fix et test
   - Commit : `git commit -m "fix: description"`

3. **Tests**
   - Les tests automatiques ne sont pas inclus dans ce dépot.

## API Testing

```bash
# Health check
curl http://127.0.0.1:8001/

# Recherche
curl "http://127.0.0.1:8001/search?q=AAPL&limit=5"

# Quote
curl http://127.0.0.1:8001/quote/AAPL

# Historique
curl "http://127.0.0.1:8001/history/AAPL?period=1mo"

# Stats proxies
curl http://127.0.0.1:8001/proxy/stats
```

## Debugging

### Backend
- Utiliser les outils FastAPI et les réponses HTTP pour diagnostiquer
- FastAPI docs : `http://127.0.0.1:8001/docs`

### Frontend
- DevTools du navigateur
- Svelte DevTools (extension Chrome/Firefox)

## Best Practices

1. **Security**
   - Ne jamais commiter `proxy_config.py`
   - Variables d'environnement pour secrets
   - Validation des inputs

2. **Performance**
   - Utiliser les proxies pour éviter rate limits
   - Cache des résultats quand possible
   - Lazy loading des composants

## Déploiement

### Backend
```bash
# Production avec Gunicorn
gunicorn backend.services.yfinance_service:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend
```bash
# Build
npm run build
```
