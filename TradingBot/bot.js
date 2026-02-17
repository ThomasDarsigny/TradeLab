/**
 * TradingBot worker
 * -----------------
 * Processus Node indépendant qui scanne les utilisateurs ayant activé le bot
 * (champ `user_settings.trading_bot_enabled = true`) et analyse les symboles
 * configurés via `BOT_SYMBOLS`.
 *
 * Responsabilités :
 * - Lire les comptes utilisateur et vérifier le solde disponible
 * - Récupérer les séries de chandelles depuis l'API TradeLab
 * - Calculer un signal via `analyzeTradingBotSignal`
 * - Ouvrir/fermer des positions en écrivant dans les tables `positions` et `transactions`
 * - Journaliser chaque action dans `bot_actions` pour la traçabilité et l'UI
 *
 * IMPORTANT : ce worker utilise la clé `SUPABASE_SERVICE_ROLE_KEY`. Cette clé
 * donne des droits élevés et doit rester confidentielle (ne pas la committer).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { analyzeTradingBotSignal } from '../shared/tradingBotEngine.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TRADELAB_API_BASE_URL = process.env.TRADELAB_API_BASE_URL || 'http://127.0.0.1:5173';
const TRADELAB_BACKEND_BASE_URL = process.env.TRADELAB_BACKEND_BASE_URL || 'http://127.0.0.1:8001';
const BOT_INTERVAL_MS = Number(process.env.BOT_INTERVAL_MS || 5000);
const BOT_RISK_PERCENT = Number(process.env.BOT_RISK_PERCENT || 0.01);
const BOT_SYMBOLS = (process.env.BOT_SYMBOLS || 'BTC-USD,ETH-USD,SOL-USD')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

// Helpers
// Convertit en nombre sûr (0 si invalide)
const toNumber = (value) => {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

// Petite pause entre traitements pour éviter les bursts
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Journalise une action du bot dans `bot_actions` et écrit sur la console.
 * - `actionType` : 'buy' | 'sell' | 'info' | 'error' etc.
 * - `details` : JSON libre pour inclure le signal, quantité, prix, raison, etc.
 */
const logBotAction = async (userId, actionType, message, symbol, details) => {
    await supabase.from('bot_actions').insert({
        user_id: userId,
        action_type: actionType,
        symbol: symbol || null,
        message,
        details: details || null
    });
    console.log(`[BOT] ${actionType.toUpperCase()} ${symbol || ''} - ${message}`);
};

/**
 * Récupère les chandelles depuis l'API TradeLab (proxy interne) — format attendu :
 * { high: number[], low: number[], close: number[], volume: number[] }
 */
const fetchCandlesFromBackend = async (symbol, period = '1M') => {
    // On force un historique large pour les indicateurs (ex: 5d en 5m)
    const yfPeriod = '5d';
    const interval = '5m';
    const response = await fetch(
        `${TRADELAB_BACKEND_BASE_URL}/history/${encodeURIComponent(symbol)}?period=${encodeURIComponent(yfPeriod)}&interval=${encodeURIComponent(interval)}`
    );

    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    if (!data?.high || !data?.low || !data?.close) return null;

    return {
        high: data.high.map(Number),
        low: data.low.map(Number),
        close: data.close.map(Number),
        volume: (data.volume || []).map(Number)
    };
};

const fetchCandles = async (symbol, period = '1M') => {
    try {
        const response = await fetch(
            `${TRADELAB_API_BASE_URL}/api/stock/${encodeURIComponent(symbol)}/candles?period=${encodeURIComponent(period)}`
        );
        if (response.ok) {
            const data = await response.json();
            if (data?.high && data?.low && data?.close) {
                return {
                    high: data.high.map(Number),
                    low: data.low.map(Number),
                    close: data.close.map(Number),
                    volume: (data.volume || []).map(Number)
                };
            }
        }
    } catch (error) {
    }

    return fetchCandlesFromBackend(symbol, period);
};

// Lecture du compte Supabase lié à l'utilisateur (table `accounts`)
const getAccount = async (userId) => {
    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) return null;
    return data;
};

// Recherche d'une position ouverte pour un compte/symbole donné
const getOpenPosition = async (accountId, symbol) => {
    const { data } = await supabase
        .from('positions')
        .select('*')
        .eq('account_id', accountId)
        .eq('symbol', symbol)
        .eq('status', 'open')
        .maybeSingle();

    return data || null;
};

// Met à jour les soldes du compte après exécution d'un trade
const updateBalances = async (accountId, currentBalance, availableBalance) => {
    await supabase
        .from('accounts')
        .update({
            current_balance: currentBalance,
            available_balance: availableBalance,
            updated_at: new Date().toISOString()
        })
        .eq('id', accountId);
};

// Enregistre une transaction (buy/sell/deposit/withdrawal)
const addTransaction = async (accountId, type, amount, description, metadata) => {
    await supabase.from('transactions').insert({
        account_id: accountId,
        type,
        amount,
        description,
        metadata: metadata || {}
    });
};

// Ouvre une position (insère dans `positions`, débite le compte, ajoute une transaction)
const openPosition = async (account, symbol, entryPrice, quantity, signal) => {
    const totalCost = entryPrice * quantity;
    const newCurrent = toNumber(account.current_balance) - totalCost;
    const newAvailable = toNumber(account.available_balance) - totalCost;

    await supabase.from('positions').insert({
        account_id: account.id,
        symbol,
        quantity,
        entry_price: entryPrice,
        current_price: entryPrice,
        status: 'open',
        profit_loss: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    await updateBalances(account.id, newCurrent, newAvailable);


    await addTransaction(
        account.id,
        'buy',
        totalCost,
        `Achat bot ${symbol} (${quantity} unités)`,
        { signal, symbol, quantity }
    );

    await logBotAction(
        account.user_id,
        'buy',
        `Achat de ${quantity.toFixed(4)} ${symbol} (regime ${signal.regime})`,
        symbol,
        { quantity, entryPrice, signal }
    );
};

// Ferme une position : met à jour `positions`, crédite le compte, journalise
const closePosition = async (account, position, exitPrice, signal, reason) => {
    const totalValue = exitPrice * toNumber(position.quantity);
    const newCurrent = toNumber(account.current_balance) + totalValue;
    const newAvailable = toNumber(account.available_balance) + totalValue;
    const profitLoss = totalValue - toNumber(position.entry_price) * toNumber(position.quantity);

    await supabase
        .from('positions')
        .update({
            status: 'closed',
            current_price: exitPrice,
            profit_loss: profitLoss,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', position.id);

    await updateBalances(account.id, newCurrent, newAvailable);

    await addTransaction(
        account.id,
        'sell',
        totalValue,
        `Vente bot ${position.symbol}`,
        { signal, reason }
    );

    await logBotAction(
        account.user_id,
        'sell',
        `Vente de ${position.quantity} ${position.symbol} (${reason})`,
        position.symbol,
        { exitPrice, profitLoss, signal, reason }
    );
};

// Met à jour le prix courant d'une position sans la fermer
const updatePositionPrice = async (positionId, price) => {
    await supabase
        .from('positions')
        .update({
            current_price: price,
            updated_at: new Date().toISOString()
        })
        .eq('id', positionId);
};

// Règles simples d'entrée (exemples) basées sur le signal calculé
const shouldOpenTrend = (signal) => {
    const ema50 = signal.indicators?.ema50;
    const ema200 = signal.indicators?.ema200;
    return signal.regime === 'trend' && ema50 !== undefined && ema200 !== undefined && ema50 > ema200;
};

const shouldOpenRange = (signal) => {
    const rsi = signal.indicators?.rsi;
    const lower = signal.indicators?.bollingerLower;
    const price = signal.risk?.entryPrice;
    return signal.regime === 'range' && rsi !== undefined && lower !== undefined && price !== undefined && rsi <= 35 && price <= lower;
};

const shouldOpenBreakout = (signal) => {
    const price = signal.risk?.entryPrice;
    const upper = signal.indicators?.donchianUpper;
    return signal.breakoutVigilance && price !== undefined && upper !== undefined && price >= upper;
};

const shouldExitPosition = (signal, position) => {
    const price = signal.risk?.entryPrice;
    if (!price) return null;
    if (signal.exitPlan?.mode === 'ema' && signal.exitPlan?.emaExitBelow !== undefined) {
        if (price < signal.exitPlan.emaExitBelow) return 'EMA 50';
    }
    if (signal.exitPlan?.mode === 'atr' && signal.exitPlan?.trailingStop !== undefined) {
        if (price < signal.exitPlan.trailingStop) return 'Trailing ATR';
    }
    return null;
};

// Exécute un cycle de scan pour un utilisateur : récupère compte, parcourt les symboles
const runCycleForUser = async (userId) => {
    const account = await getAccount(userId);
    if (!account) return;

    console.log(`[BOT] Scan user ${userId} (${BOT_SYMBOLS.length} symbols)`);

    for (const symbol of BOT_SYMBOLS) {
        const candles = await fetchCandles(symbol);
        if (!candles) {
            console.log(`[BOT] Donnees indisponibles pour ${symbol}`);
            continue;
        }

        const signal = analyzeTradingBotSignal(symbol, candles, toNumber(account.current_balance), BOT_RISK_PERCENT);
        const indicators = signal.indicators || {};
        const rsi = indicators.rsi ?? 'n/a';
        const sma = indicators.sma20 ?? indicators.sma ?? 'n/a';
        const stc = indicators.stc ?? 'n/a';
        console.log(`[BOT] Indicateurs ${symbol} - RSI: ${rsi} | SMA: ${sma} | STC: ${stc}`);
        if (!signal.risk?.entryPrice) {
            console.log(`[BOT] Prix manquant pour ${symbol}`);
            continue;
        }

        // Sécurité n°2 : Vérification de position déjà ouverte (anti-doublon)
        const position = await getOpenPosition(account.id, symbol);
        if (position) {
            console.log(`🚫 [SKIP] Position déjà ouverte pour ${symbol}. Pas de rachat.`);
            // Optionnel : on peut mettre à jour le prix courant ou gérer la sortie
            await updatePositionPrice(position.id, signal.risk.entryPrice);
            const exitReason = shouldExitPosition(signal, position);
            if (exitReason) {
                await closePosition(account, position, signal.risk.entryPrice, signal, exitReason);
            }
            continue; // On arrête tout ici pour ce symbole
        }

        const openTrend = shouldOpenTrend(signal);
        const openRange = shouldOpenRange(signal);
        const openBreakout = shouldOpenBreakout(signal);

        if (!(openTrend || openRange || openBreakout)) {
            console.log(`[BOT] Aucun signal d'entree pour ${symbol}`);
            continue;
        }

        let positionSize = signal.risk?.positionSize || 0;
        const entryPrice = signal.risk.entryPrice;
        // Sécurité : cap à 25% du portefeuille
        const maxInvest = toNumber(account.current_balance) * 0.25;
        if ((positionSize * entryPrice) > maxInvest) {
            positionSize = maxInvest / entryPrice;
            console.log("⚠️ [LIMIT] Taille réduite pour ne pas dépasser 25% du capital");
        }

        const maxAffordable = toNumber(account.available_balance) / entryPrice;
        const quantity = Math.max(0, Math.min(positionSize, maxAffordable));

        if (quantity <= 0) {
            console.log(`[BOT] Taille invalide pour ${symbol}`);
            continue;
        }

        await openPosition(account, symbol, entryPrice, quantity, signal);
    }
};

// Boucle principale : lit la table `user_settings` pour trouver les utilisateurs
// ayant activé le bot, puis exécute `runCycleForUser` pour chacun.
let running = false;
const runCycle = async () => {
    if (running) return;
    running = true;
    try {
        console.log('[BOT] Demarrage du cycle');
        const { data, error } = await supabase
            .from('user_settings')
            .select('user_id')
            .eq('trading_bot_enabled', true);

        if (error || !data) {
            if (error) {
                console.error('[BOT] Erreur lecture user_settings', error);
            }
            running = false;
            return;
        }

        if (data.length === 0) {
            console.log('[BOT] Aucun utilisateur actif');
        }

        for (const row of data) {
            await runCycleForUser(row.user_id);
            await sleep(200);
        }
    } catch (error) {
        console.error('[BOT] Erreur cycle', error);
    } finally {
        console.log('[BOT] Fin du cycle');
        running = false;
    }
};

// Démarrage
console.log(`[BOT] TradingBot actif. Intervalle ${BOT_INTERVAL_MS} ms`);

// Lancer un cycle immédiatement puis planifier
await runCycle();
setInterval(runCycle, BOT_INTERVAL_MS);
