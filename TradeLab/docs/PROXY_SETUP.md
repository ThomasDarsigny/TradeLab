# Configuration des Proxies

## Configuration actuelle

Le système utilise **uniquement des proxies privés** configurés manuellement.

## Fichier de configuration

`backend/config/proxy_config.py`

```python
# Activer/désactiver les proxies
USE_PROXIES = True

# Liste de proxies privés (format: http://user:pass@ip:port)
PROXY_LIST = [
    "http://username:password@ip1:port1",
    "http://username:password@ip2:port2",
    # ... ajoutez les proxies ici
]

# Délai entre les requêtes (secondes)
REQUEST_DELAY = 5.0

# Timeout pour les requêtes (secondes)
REQUEST_TIMEOUT = 10
```

## Rotation automatique

Le système inclut :
- Rotation circulaire des proxies
- Suivi des échecs (retire après 3 échecs)
- Tests en arrière-plan au démarrage
- Rafraîchissement automatique toutes les 5 minutes
- Statistiques disponibles via `/proxy/stats`

## Monitoring

Consultez les statistiques en temps réel :

```bash
curl http://127.0.0.1:8001/proxy/stats
```

Réponse :
```json
{
  "enabled": true,
  "active_proxies": 9,
  "total_successes": 15,
  "total_failures": 2,
  "proxies": [...]
}
```
