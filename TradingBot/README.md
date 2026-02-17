# TradingBot

Bot de trading en tâche de fond (processus indépendant du navigateur).

## But

Le worker scanne régulièrement les utilisateurs ayant activé le bot
(`user_settings.trading_bot_enabled`) et effectue des analyses techniques via
`shared/tradingBotEngine.js`. Il ne passe pas d'ordres externes — il écrit dans
la base (positions/transactions) et journalise ses actions dans `bot_actions`.

## Architecture

- `shared/tradingBotEngine.js` : moteur d'analyse (indicateurs + signal).
- `TradingBot/bot.js` : worker Node.js qui orchestre les scans et les écritures.
- Base de données Supabase : tables `accounts`, `positions`, `transactions`,
  `user_settings`, `bot_actions`.

## Sécurité

Le worker nécessite la clé `SUPABASE_SERVICE_ROLE_KEY` (clé serveur). Cette clé
donne accès en écriture à la base et doit rester hors du dépôt (ne jamais la
committer). Limitez l'accès et utilisez un secret manager en production.

## Démarrage local

1. Copier `.env.example` → `.env` et remplir :

```env
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
TRADELAB_API_BASE_URL=http://127.0.0.1:5173
BOT_SYMBOLS=AAPL,MSFT,GOOGL
BOT_INTERVAL_MS=5000
BOT_RISK_PERCENT=0.01
```

2. Installer les dépendances et démarrer :

```bash
npm install
npm run start
```

## Vérification

- Surveillez les logs console pour suivre l'exécution.
- Vérifiez les entrées dans `bot_actions` (UI affiche le journal en realtime).
- Vérifiez `positions` et `transactions` pour les effets des trades simulés.

## Migration / SQL

Avant d'exécuter le worker, appliquer les migrations SQL (ex. `src/lib/sql/schema.sql`)
dans votre projet Supabase pour créer les tables et politiques RLS.