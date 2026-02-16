# API Documentation

## Base URL
```
http://127.0.0.1:8001
```

## Endpoints

### Health Check

#### `GET /`
Vérifie si le service est opérationnel.

**Réponse :**
```json
{
  "status": "ok",
  "service": "Yahoo Finance API"
}
```

---

### Recherche de Symboles

#### `GET /search`
Recherche des symboles boursiers.

**Paramètres :**
- `q` (string, requis) - Terme de recherche
- `limit` (int, optionnel) - Nombre max de résultats (défaut: 10)

**Exemple :**
```bash
curl "http://127.0.0.1:8001/search?q=AAPL&limit=3"
```

**Réponse :**
```json
{
  "symbols": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NMS",
      "type": "EQUITY"
    },
    {
      "symbol": "AAPU",
      "name": "Direxion Daily AAPL Bull 2X Shares",
      "exchange": "NGM",
      "type": "ETF"
    }
  ]
}
```

---

### Citation en Temps Réel

#### `GET /quote/{symbol}`
Obtient le prix actuel et les détails d'un symbole.

**Paramètres :**
- `symbol` (string, path) - Symbole boursier (ex: AAPL, MSFT, TSLA)

**Exemple :**
```bash
curl "http://127.0.0.1:8001/quote/AAPL"
```

**Réponse :**
```json
{
  "symbol": "AAPL",
  "price": 276.49,
  "change": 6.49,
  "changePercent": 2.40,
  "open": 272.29,
  "high": 278.95,
  "low": 272.29,
  "previousClose": 270.00,
  "marketCap": 4063829416205
}
```

---

### Données Historiques

#### `GET /history/{symbol}`
Récupère l'historique des prix d'un symbole.

**Paramètres :**
- `symbol` (string, path) - Symbole boursier
- `period` (string, query) - Période : `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `10y`, `ytd`, `max`
- `interval` (string, query) - Intervalle : `1m`, `2m`, `5m`, `15m`, `30m`, `60m`, `90m`, `1h`, `1d`, `5d`, `1wk`, `1mo`, `3mo`

**Exemple :**
```bash
curl "http://127.0.0.1:8001/history/AAPL?period=1mo&interval=1d"
```

**Réponse :**
```json
{
  "timestamps": [1769662800, 1769749200, ...],
  "open": [258.0, 255.17, ...],
  "high": [259.65, 261.90, ...],
  "low": [254.41, 252.18, ...],
  "close": [258.28, 259.48, ...],
  "volume": [67253000, 92443400, ...]
}
```

---

### Gestion des Proxies

#### `GET /proxy/stats`
Obtient les statistiques des proxies.

**Exemple :**
```bash
curl "http://127.0.0.1:8001/proxy/stats"
```

**Réponse :**
```json
{
  "enabled": true,
  "active_proxies": 9,
  "total_successes": 15,
  "total_failures": 2,
  "proxies": [
    {
      "url": "http://user:pass@ip:port",
      "successes": 5,
      "failures": 0,
      "last_used": "2026-02-04T20:44:20.125336",
      "added_at": "2026-02-04T20:44:02.686326"
    }
  ]
}
```

#### `POST /proxy/refresh`
Force le rafraîchissement du pool de proxies.

**Exemple :**
```bash
curl -X POST "http://127.0.0.1:8001/proxy/refresh"
```

**Réponse :**
```json
{
  "message": "Rafraîchissement des proxies déclenché",
  "current_active": 9
}
```

---

## Codes d'Erreur

| Code | Description |
|------|-------------|
| 200  | Succès |
| 400  | Requête invalide |
| 404  | Symbole non trouvé |
| 429  | Too Many Requests (rate limit) |
| 500  | Erreur serveur |

## Rate Limiting

- Délai automatique de 5 secondes entre les requêtes
- Rotation des proxies pour éviter les blocages
- Headers de navigateur réalistes

## Documentation Interactive

FastAPI fournit une documentation Swagger interactive :
```
http://127.0.0.1:8001/docs
```

Alternative ReDoc :
```
http://127.0.0.1:8001/redoc
```
