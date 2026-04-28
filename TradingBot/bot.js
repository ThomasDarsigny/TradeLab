import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { analyzeTradingBotSignal, makeDecision } from '../shared/tradingBotEngine.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TRADELAB_API_BASE_URL = process.env.TRADELAB_API_BASE_URL || 'http://127.0.0.1:5173';
const TRADELAB_BACKEND_BASE_URL = process.env.TRADELAB_BACKEND_BASE_URL || 'http://127.0.0.1:8001';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const BOT_DRIVER_INTERVAL_MS = Number(process.env.BOT_DRIVER_INTERVAL_MS || 1000);
const BOT_RISK_PERCENT = Number(process.env.BOT_RISK_PERCENT || 0.01);
const BOT_SYMBOLS = (process.env.BOT_SYMBOLS || 'BTC-USD')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

const toEnvNumber = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) ? value : fallback;
};

const BOT_STRATEGY_CONFIG = {
    scanIntervalSeconds: toEnvNumber('BOT_SCAN_INTERVAL_SECONDS', 5),
    enableTrend: String(process.env.BOT_ENABLE_TREND ?? 'true').toLowerCase() !== 'false',
    enableRange: String(process.env.BOT_ENABLE_RANGE ?? 'true').toLowerCase() !== 'false',
    enableBreakout: String(process.env.BOT_ENABLE_BREAKOUT ?? 'true').toLowerCase() !== 'false',
    trendAdxMin: toEnvNumber('BOT_TREND_ADX_MIN', 25),
    rangeAdxMax: toEnvNumber('BOT_RANGE_ADX_MAX', 20),
    breakoutVolumeMultiplier: toEnvNumber('BOT_BREAKOUT_VOLUME_MULTIPLIER', 1.5),
    breakoutDonchianFactor: toEnvNumber('BOT_BREAKOUT_DONCHIAN_FACTOR', 0.99),
    breakoutStcMin: toEnvNumber('BOT_BREAKOUT_STC_MIN', 60),
    hardStopLossPercent: toEnvNumber('BOT_HARD_STOP_LOSS_PERCENT', 5),
    takeProfitPercent: toEnvNumber('BOT_TAKE_PROFIT_PERCENT', 10),
    profitZonePercent: toEnvNumber('BOT_PROFIT_ZONE_PERCENT', 0.8),
    stcReversalPrevMin: toEnvNumber('BOT_STC_REVERSAL_PREV_MIN', 85),
    stcReversalCurrentMax: toEnvNumber('BOT_STC_REVERSAL_CURRENT_MAX', 82),
    smaBreakFactor: toEnvNumber('BOT_SMA_BREAK_FACTOR', 0.9),
    rsiRangeBuyMax: toEnvNumber('BOT_RSI_RANGE_BUY_MAX', 40),
    atrMultiplierStock: toEnvNumber('BOT_ATR_MULTIPLIER_STOCK', 2.5),
    atrMultiplierCrypto: toEnvNumber('BOT_ATR_MULTIPLIER_CRYPTO', 3.5)
};

const normalizeStrategyConfig = (rawConfig) => {
    const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    return {
        scanIntervalSeconds: Number.isFinite(Number(source.scanIntervalSeconds)) ? Number(source.scanIntervalSeconds) : BOT_STRATEGY_CONFIG.scanIntervalSeconds,
        enableTrend: typeof source.enableTrend === 'boolean' ? source.enableTrend : BOT_STRATEGY_CONFIG.enableTrend,
        enableRange: typeof source.enableRange === 'boolean' ? source.enableRange : BOT_STRATEGY_CONFIG.enableRange,
        enableBreakout: typeof source.enableBreakout === 'boolean' ? source.enableBreakout : BOT_STRATEGY_CONFIG.enableBreakout,
        trendAdxMin: Number.isFinite(Number(source.trendAdxMin)) ? Number(source.trendAdxMin) : BOT_STRATEGY_CONFIG.trendAdxMin,
        rangeAdxMax: Number.isFinite(Number(source.rangeAdxMax)) ? Number(source.rangeAdxMax) : BOT_STRATEGY_CONFIG.rangeAdxMax,
        breakoutVolumeMultiplier: Number.isFinite(Number(source.breakoutVolumeMultiplier)) ? Number(source.breakoutVolumeMultiplier) : BOT_STRATEGY_CONFIG.breakoutVolumeMultiplier,
        breakoutDonchianFactor: Number.isFinite(Number(source.breakoutDonchianFactor)) ? Number(source.breakoutDonchianFactor) : BOT_STRATEGY_CONFIG.breakoutDonchianFactor,
        breakoutStcMin: Number.isFinite(Number(source.breakoutStcMin)) ? Number(source.breakoutStcMin) : BOT_STRATEGY_CONFIG.breakoutStcMin,
        hardStopLossPercent: Number.isFinite(Number(source.hardStopLossPercent)) ? Number(source.hardStopLossPercent) : BOT_STRATEGY_CONFIG.hardStopLossPercent,
        takeProfitPercent: Number.isFinite(Number(source.takeProfitPercent)) ? Number(source.takeProfitPercent) : BOT_STRATEGY_CONFIG.takeProfitPercent,
        profitZonePercent: Number.isFinite(Number(source.profitZonePercent)) ? Number(source.profitZonePercent) : BOT_STRATEGY_CONFIG.profitZonePercent,
        stcReversalPrevMin: Number.isFinite(Number(source.stcReversalPrevMin)) ? Number(source.stcReversalPrevMin) : BOT_STRATEGY_CONFIG.stcReversalPrevMin,
        stcReversalCurrentMax: Number.isFinite(Number(source.stcReversalCurrentMax)) ? Number(source.stcReversalCurrentMax) : BOT_STRATEGY_CONFIG.stcReversalCurrentMax,
        smaBreakFactor: Number.isFinite(Number(source.smaBreakFactor)) ? Number(source.smaBreakFactor) : BOT_STRATEGY_CONFIG.smaBreakFactor,
        rsiRangeBuyMax: Number.isFinite(Number(source.rsiRangeBuyMax)) ? Number(source.rsiRangeBuyMax) : BOT_STRATEGY_CONFIG.rsiRangeBuyMax,
        atrMultiplierStock: Number.isFinite(Number(source.atrMultiplierStock)) ? Number(source.atrMultiplierStock) : BOT_STRATEGY_CONFIG.atrMultiplierStock,
        atrMultiplierCrypto: Number.isFinite(Number(source.atrMultiplierCrypto)) ? Number(source.atrMultiplierCrypto) : BOT_STRATEGY_CONFIG.atrMultiplierCrypto
    };
};

// Risk Management Constants
const HARD_STOP_LOSS_PERCENT = -0.05; // 5% hard stop-loss
const TRAILING_STOP_PERCENT = -0.03; // 3% trailing stop-loss
const TRADE_FEES_PERCENT = 0.002; // 0.2% per transaction
const MAX_POSITION_SIZE_PERCENT = 0.15; // Max 15% per position
const MAX_OPEN_POSITIONS = 3; // Max 3 open positions per user

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});


const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') {
        const asNumber = Number(value);
        return Number.isFinite(asNumber) ? asNumber : 0;
    }

    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DISCORD_NOTIFICATION_DELAY_MS = Number(process.env.DISCORD_NOTIFICATION_DELAY_MS || 500);
let discordNotificationQueue = Promise.resolve();

const enqueueDiscordTradeNotification = (payload) => {
    discordNotificationQueue = discordNotificationQueue
        .then(() => sendDiscordTradeNotification(payload))
        .then(() => sleep(Math.max(0, DISCORD_NOTIFICATION_DELAY_MS)))
        .catch((error) => {
            console.error('[DISCORD] Erreur queue notification', error);
        });

    return discordNotificationQueue;
};

const sendDiscordTradeNotification = async ({
    action,
    symbol,
    quantity,
    price,
    strategy,
    reason,
    fees,
    pnlValue,
    pnlPercent
}) => {
    if (!DISCORD_WEBHOOK_URL) return;

    const actionLabel = action === 'BUY' ? 'ACHAT' : 'VENTE';
    const actionIcon = action === 'BUY' ? '🟢' : '🔴';
    const embedColor = action === 'BUY' ? 5763719 : 15548997;
    const formatUsd = (value) => `$${toNumber(value).toFixed(2)}`;
    const fields = [
        { name: 'Action', value: actionLabel, inline: true },
        { name: 'Symbole', value: String(symbol || 'N/A'), inline: true },
        { name: 'Quantite', value: toNumber(quantity).toFixed(4), inline: true },
        { name: 'Prix', value: formatUsd(price), inline: true }
    ];

    if (strategy) fields.push({ name: 'Strategie', value: String(strategy), inline: true });
    if (reason) fields.push({ name: 'Raison', value: String(reason), inline: false });
    if (Number.isFinite(toNumber(fees)) && toNumber(fees) > 0) {
        fields.push({ name: 'Frais', value: formatUsd(fees), inline: true });
    }
    if (Number.isFinite(toNumber(pnlValue))) {
        fields.push({ name: 'PnL', value: formatUsd(pnlValue), inline: true });
    }
    if (pnlPercent !== undefined && pnlPercent !== null) {
        fields.push({ name: 'PnL %', value: String(pnlPercent), inline: true });
    }

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'TradeLab Bot',
                embeds: [
                    {
                        title: `${actionIcon} ${actionLabel} EXECUTE`,
                        color: embedColor,
                        fields,
                        timestamp: new Date().toISOString()
                    }
                ]
            })
        });

        if (!response.ok) {
            console.error(`[DISCORD] Echec webhook (${response.status} ${response.statusText})`);
        }
    } catch (error) {
        console.error('[DISCORD] Erreur envoi notification', error);
    }
};

const CRYPTO_QUOTE_SUFFIXES = ['-USD', '-USDT', '-USDC', '-EUR', '-BTC', '-ETH'];

const isCryptoSymbol = (symbol) => {
    const normalized = String(symbol || '').toUpperCase();
    return CRYPTO_QUOTE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

const pad2 = (value) => String(value).padStart(2, '0');
const dateKey = (year, month, day) => `${year}-${pad2(month)}-${pad2(day)}`;

const getMarketDatePartsNY = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        year: Number(map.year || 0),
        month: Number(map.month || 1),
        day: Number(map.day || 1),
        weekday: map.weekday || 'Mon',
        hour: Number(map.hour || 0),
        minute: Number(map.minute || 0)
    };
};

const getMarketClockNY = (date = new Date()) => {
    const map = getMarketDatePartsNY(date);
    return {
        weekday: map.weekday,
        hour: map.hour,
        minute: map.minute
    };
};

const nthWeekdayOfMonth = (year, month, weekday, nth) => {
    const firstDayDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const delta = (weekday - firstDayDow + 7) % 7;
    return 1 + delta + (nth - 1) * 7;
};

const lastWeekdayOfMonth = (year, month, weekday) => {
    const lastDate = new Date(Date.UTC(year, month, 0));
    const lastDay = lastDate.getUTCDate();
    const lastDow = lastDate.getUTCDay();
    const delta = (lastDow - weekday + 7) % 7;
    return lastDay - delta;
};

const observedFixedHoliday = (year, month, day) => {
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (dow === 6) {
        return { month, day: day - 1 };
    }
    if (dow === 0) {
        return { month, day: day + 1 };
    }
    return { month, day };
};

const calculateEasterSunday = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
};

const getNyseHolidayKeys = (year) => {
    const holidays = [];

    const newYear = observedFixedHoliday(year, 1, 1);
    holidays.push(dateKey(year, newYear.month, newYear.day));

    holidays.push(dateKey(year, 1, nthWeekdayOfMonth(year, 1, 1, 3)));
    holidays.push(dateKey(year, 2, nthWeekdayOfMonth(year, 2, 1, 3)));

    const easter = calculateEasterSunday(year);
    const easterSunday = new Date(Date.UTC(year, easter.month - 1, easter.day));
    const goodFriday = new Date(easterSunday);
    goodFriday.setUTCDate(easterSunday.getUTCDate() - 2);
    holidays.push(dateKey(year, goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate()));

    holidays.push(dateKey(year, 5, lastWeekdayOfMonth(year, 5, 1)));

    const juneteenth = observedFixedHoliday(year, 6, 19);
    holidays.push(dateKey(year, juneteenth.month, juneteenth.day));

    const independenceDay = observedFixedHoliday(year, 7, 4);
    holidays.push(dateKey(year, independenceDay.month, independenceDay.day));

    holidays.push(dateKey(year, 9, nthWeekdayOfMonth(year, 9, 1, 1)));
    holidays.push(dateKey(year, 11, nthWeekdayOfMonth(year, 11, 4, 4)));

    const christmas = observedFixedHoliday(year, 12, 25);
    holidays.push(dateKey(year, christmas.month, christmas.day));

    return new Set(holidays);
};

const isNyseHoliday = (date = new Date()) => {
    const { year, month, day } = getMarketDatePartsNY(date);
    const key = dateKey(year, month, day);
    return getNyseHolidayKeys(year).has(key);
};

const isUsStockMarketOpenNow = (date = new Date()) => {
    const { weekday, hour, minute } = getMarketClockNY(date);
    const isBusinessDay = !['Sat', 'Sun'].includes(weekday);
    if (!isBusinessDay) return false;
    if (isNyseHoliday(date)) return false;

    const currentMinutes = hour * 60 + minute;
    const openMinutes = 9 * 60 + 30;
    const closeMinutes = 16 * 60;
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
};

const isBuyAllowedForSymbolNow = (symbol, date = new Date()) => {
    if (isCryptoSymbol(symbol)) return true;
    return isUsStockMarketOpenNow(date);
};

const isSellAllowedForSymbolNow = (symbol, date = new Date()) => {
    if (isCryptoSymbol(symbol)) return true;
    return isUsStockMarketOpenNow(date);
};

const resolveScanIntervalMs = (strategyConfig) => {
    const rawSeconds = Number(strategyConfig?.scanIntervalSeconds);
    const safeSeconds = Number.isFinite(rawSeconds) ? rawSeconds : BOT_STRATEGY_CONFIG.scanIntervalSeconds;
    const boundedSeconds = Math.max(1, safeSeconds);
    return Math.round(boundedSeconds * 1000);
};

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
                console.log(`[BOT] Candles from API: ${data.close.length} points`);
                return {
                    high: data.high.map(Number),
                    low: data.low.map(Number),
                    close: data.close.map(Number),
                    volume: (data.volume || []).map(Number)
                };
            }
        }
    } catch (error) {
        console.log(`[BOT] API fetch error for ${symbol}: ${error.message}`);
    }

    console.log(`[BOT] Falling back to backend for ${symbol}`);
    return fetchCandlesFromBackend(symbol, period);
};

const calculateOpenPositionsMarketValue = async (accountId) => {
    const { data, error } = await supabase
        .from('positions')
        .select('quantity, current_price')
        .eq('account_id', accountId)
        .eq('status', 'open')
        .gt('quantity', 0);

    if (error) return 0;

    return (data || []).reduce(
        (total, pos) => total + toNumber(pos.quantity) * toNumber(pos.current_price),
        0
    );
};

const syncAccountCurrentBalance = async (accountId, availableBalance) => {
    const normalizedAvailableBalance = Math.max(0, toNumber(availableBalance));
    const openPositionsValue = await calculateOpenPositionsMarketValue(accountId);
    const currentBalance = normalizedAvailableBalance + openPositionsValue;

    await supabase
        .from('accounts')
        .update({
            available_balance: normalizedAvailableBalance,
            current_balance: currentBalance,
            updated_at: new Date().toISOString()
        })
        .eq('id', accountId);

    return currentBalance;
};

const getAccount = async (userId) => {
    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) return null;

    const currentBalance = await syncAccountCurrentBalance(
        data.id,
        data.available_balance,
    );

    return {
        ...data,
        current_balance: currentBalance
    };
};

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

const countOpenPositions = async (accountId) => {
    const { data, error } = await supabase
        .from('positions')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('status', 'open');
    
    if (error) return 0;
    return data?.length || 0;
};

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

const addTransaction = async (accountId, type, amount, description, metadata) => {
    await supabase.from('transactions').insert({
        account_id: accountId,
        type,
        amount,
        description,
        metadata: metadata || {}
    });
};

const openPosition = async (account, symbol, entryPrice, quantity, signal, strategy) => {
    if (!isBuyAllowedForSymbolNow(symbol)) {
        const nyClock = getMarketClockNY();
        console.log(`[BOT] Achat refusé (openPosition) hors séance US pour ${symbol} (${nyClock.weekday} ${String(nyClock.hour).padStart(2, '0')}:${String(nyClock.minute).padStart(2, '0')} ET).`);
        await logBotAction(
            account.user_id,
            'info',
            `Achat bloqué hors séance pour ${symbol}`,
            symbol,
            {
                reason: 'outside_market_hours',
                timezone: 'America/New_York',
                weekday: nyClock.weekday,
                hour: nyClock.hour,
                minute: nyClock.minute,
                strategy
            }
        );
        return false;
    }

    const totalCost = entryPrice * quantity;
    const fees = totalCost * TRADE_FEES_PERCENT;

    const { data, error } = await supabase.rpc('open_position_atomic', {
        p_account_id: account.id,
        p_symbol: symbol,
        p_quantity: quantity,
        p_price: entryPrice,
        p_fees: fees,
        p_strategy: strategy,
        p_signal: signal
    });

    if (error || (data && data.success === false)) {
        console.error(`[ERREUR ACHAT] ${symbol}: ${error?.message || data?.reason || 'unknown error'}`);
        return false;
    }

    await supabase.from('transactions').insert({
        account_id: account.id,
        type: 'buy',
        amount: totalCost + fees,
        description: `Achat de ${quantity.toFixed(4)} ${symbol} via ${strategy} @ ${entryPrice.toFixed(2)}`,
        metadata: {
            symbol,
            quantity,
            price: entryPrice,
            strategy,
            fees
        }
    });

    await logBotAction(
        account.user_id,
        'buy',
        `🅰️Achat de ${quantity.toFixed(4)} ${symbol} via ${strategy} @ ${entryPrice.toFixed(2)} (Fees: ${fees.toFixed(2)})`,
        symbol,
        { quantity, entryPrice, signal, strategy, fees }
    );

    await enqueueDiscordTradeNotification({
        action: 'BUY',
        symbol,
        quantity,
        price: entryPrice,
        strategy,
        fees
    });

    return true;
};

const closePosition = async (account, position, exitPrice, signal, reason) => {
    if (!isSellAllowedForSymbolNow(position.symbol)) {
        const nyClock = getMarketClockNY();
        console.log(`[BOT] Vente refusée hors séance US pour ${position.symbol} (${nyClock.weekday} ${String(nyClock.hour).padStart(2, '0')}:${String(nyClock.minute).padStart(2, '0')} ET).`);
        await logBotAction(
            account.user_id,
            'info',
            `Vente bloquée hors séance pour ${position.symbol}`,
            position.symbol,
            {
                reason: 'outside_market_hours_sell',
                timezone: 'America/New_York',
                weekday: nyClock.weekday,
                hour: nyClock.hour,
                minute: nyClock.minute
            }
        );
        return false;
    }

    const exitFees = toNumber(position.quantity) * exitPrice * TRADE_FEES_PERCENT;

    const { data, error } = await supabase.rpc('close_position_atomic', {
        p_position_id: position.id,
        p_account_id: account.id,
        p_exit_price: exitPrice,
        p_fees: exitFees,
        p_reason: reason,
        p_signal: JSON.stringify(signal)
    });

    if (error || (data && data.success === false)) {
        console.error(`[ERREUR VENTE] ${position.symbol}: ${error?.message || data?.reason || 'unknown error'}`);
        return false;
    }

    const pnlValue = toNumber(data?.pnl ?? 0);
    const pnlPercent = ((pnlValue / (toNumber(position.quantity) * toNumber(position.entry_price))) * 100).toFixed(2);
    const totalRevenue = toNumber(position.quantity) * exitPrice;
    
    console.log(`[VENTE REUSSIE] ${position.symbol} @ ${exitPrice.toFixed(2)} | PnL: ${pnlValue.toFixed(2)}$ (${pnlPercent}%) | Raison: ${reason}`);

    await supabase.from('transactions').insert({
        account_id: account.id,
        type: 'sell',
        amount: totalRevenue - exitFees,
        description: `Vente de ${toNumber(position.quantity).toFixed(4)} ${position.symbol} @ ${exitPrice.toFixed(2)} | Raison: ${reason}`,
        metadata: {
            symbol: position.symbol,
            quantity: position.quantity,
            price: exitPrice,
            profitLoss: pnlValue,
            reason
        }
    });

    await logBotAction(
        account.user_id,
        'sell',
        `Vente ${position.symbol}: ${pnlPercent}% (${reason})`,
        position.symbol,
        { profitLoss: pnlValue, exitPrice, reason }
    );

    await enqueueDiscordTradeNotification({
        action: 'SELL',
        symbol: position.symbol,
        quantity: position.quantity,
        price: exitPrice,
        reason,
        fees: exitFees,
        pnlValue,
        pnlPercent: `${pnlPercent}%`
    });

    return true;
};

const updatePositionPrice = async (positionId, price) => {
    const { data } = await supabase
        .from('positions')
        .update({
            current_price: price,
            updated_at: new Date().toISOString()
        })
        .eq('id', positionId)
        .select('account_id, current_price')
        .single();

    if (data?.account_id) {
        const { data: account } = await supabase
            .from('accounts')
            .select('available_balance')
            .eq('id', data.account_id)
            .single();

        if (account) {
            await syncAccountCurrentBalance(data.account_id, account.available_balance);
        }
    }
};

const runCycleForUser = async (userId, userSymbols, userStrategyConfig) => {
    let account = await getAccount(userId);
    if (!account) return;

    const effectiveStrategyConfig = normalizeStrategyConfig(userStrategyConfig);

    const symbols = userSymbols && userSymbols.trim() 
        ? userSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : BOT_SYMBOLS;

    console.log(`[BOT] Scan user ${userId} (${symbols.length} symbols): ${symbols.join(', ')}`);

    for (const symbol of symbols) {
        const candles = await fetchCandles(symbol);
        if (!candles) {
            console.log(`[BOT] Donnees indisponibles pour ${symbol}`);
            continue;
        }

        console.log(`[BOT] ${symbol}: ${candles.close.length} candlesticks reçus`);

        const signal = analyzeTradingBotSignal(
            symbol,
            candles,
            toNumber(account.current_balance),
            BOT_RISK_PERCENT,
            effectiveStrategyConfig
        );
        const indicators = signal.indicators || {};
        
        const price = signal.risk?.entryPrice ?? 0;
        const bilLower = indicators.bollingerLower?.toFixed(2) ?? 'n/a';
        const dchUpper = indicators.donchianUpper?.toFixed(2) ?? 'n/a';
        console.log(`[BOT] ${symbol} Indicators: RSI=${indicators.rsi?.toFixed(2)} | SMA20=${indicators.sma20?.toFixed(2)} | STC=${indicators.stc?.toFixed(2)} | EMA50=${indicators.ema50?.toFixed(2)} | EMA200=${indicators.ema200?.toFixed(2)} | ADX=${indicators.adx?.toFixed(2)} | BOLLINGER_LOW=${bilLower} | DONCHIAN_HIGH=${dchUpper} | REGIME=${signal.regime}`);
        
        if (!signal.risk?.entryPrice) {
            console.log(`[BOT] Prix manquant pour ${symbol}`);
            continue;
        }

        const position = await getOpenPosition(account.id, symbol);
        
        const decision = makeDecision(signal, position, effectiveStrategyConfig);

        if (decision.action === 'BUY' && !position) {
            if (!isBuyAllowedForSymbolNow(symbol)) {
                const nyClock = getMarketClockNY();
                console.log(`[BOT] Achat bloqué hors séance US pour ${symbol} (${nyClock.weekday} ${String(nyClock.hour).padStart(2, '0')}:${String(nyClock.minute).padStart(2, '0')} ET).`);
                continue;
            }

            const openCount = await countOpenPositions(account.id);
            if (openCount >= MAX_OPEN_POSITIONS) {
                console.log(`[BOT] Max positions (${openCount}/${MAX_OPEN_POSITIONS}), pas de nouvelles entrees`);
                continue;
            }

            const entryPrice = decision.price;
            const stopLoss = decision.stopLoss;
            if (!entryPrice || !stopLoss || entryPrice <= stopLoss) {
                console.log(`[BOT] StopLoss invalide pour ${symbol}. Achat ignore.`);
                continue;
            }

            const availableBalance = Math.max(0, toNumber(account.available_balance));
            const riskAmount = Math.max(0, toNumber(account.current_balance) * BOT_RISK_PERCENT);
            const riskPerUnit = entryPrice - stopLoss;
            let qty = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;

            const maxQtyByPortfolio = (toNumber(account.current_balance) * MAX_POSITION_SIZE_PERCENT) / entryPrice;
            const maxQtyByCash = availableBalance / (entryPrice * (1 + TRADE_FEES_PERCENT));
            const maxQty = Math.max(0, Math.min(maxQtyByPortfolio, maxQtyByCash));
            qty = Math.max(0, Math.min(qty, maxQty));

            const estimatedTotalCost = qty * entryPrice * (1 + TRADE_FEES_PERCENT);
            if (estimatedTotalCost > availableBalance) {
                console.log(`[BOT] Fonds insuffisants pour ${symbol}. Cout estimé ${estimatedTotalCost.toFixed(2)} > dispo ${availableBalance.toFixed(2)}`);
                continue;
            }

            if (qty > 0) {
                console.log(`[${decision.strategy}] Achat ${symbol} - ${qty.toFixed(4)} unites @ ${entryPrice.toFixed(2)} (Position ${openCount + 1}/${MAX_OPEN_POSITIONS}) | Raison: ${decision.reason}`);
                const opened = await openPosition(account, symbol, entryPrice, qty, signal, decision.strategy);
                if (opened) {
                    const refreshedAccount = await getAccount(userId);
                    if (refreshedAccount) {
                        account = refreshedAccount;
                    }
                }
            } else {
                console.log(`[BOT] Taille invalide pour ${symbol}`);
            }
        } 
        
        else if (decision.action === 'SELL' && position) {
            if (!isSellAllowedForSymbolNow(symbol)) {
                const nyClock = getMarketClockNY();
                console.log(`[BOT] Vente bloquée hors séance US pour ${symbol} (${nyClock.weekday} ${String(nyClock.hour).padStart(2, '0')}:${String(nyClock.minute).padStart(2, '0')} ET).`);
                continue;
            }

            console.log(`[VENTE] ${symbol} @ ${decision.price.toFixed(2)} | Raison: ${decision.reason}`);
            await closePosition(account, position, decision.price, signal, decision.reason);
        } 
        
        else if (position) {
            await updatePositionPrice(position.id, signal.risk.entryPrice);
        }
    }
};

let running = false;
const lastRunAtByUser = new Map();
const lastLoggedIntervalByUser = new Map();
const runCycle = async () => {
    if (running) return;
    running = true;
    try {
        console.log('[BOT] ➡️Demarrage du cycle');
        
        let { data, error } = await supabase
            .from('user_settings')
            .select('user_id, bot_symbols, strategy_config')
            .eq('trading_bot_enabled', true);

        if (error && error.code === '42703') {
            console.log('[BOT] Colonne bot_symbols/strategy_config manquante, utilisation des valeurs par défaut');
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('user_settings')
                .select('user_id')
                .eq('trading_bot_enabled', true);
            
            if (fallbackError || !fallbackData) {
                if (fallbackError) {
                    console.error('[BOT] Erreur lecture user_settings', fallbackError);
                }
                running = false;
                return;
            }
            
            data = fallbackData.map(row => ({
                user_id: row.user_id,
                bot_symbols: 'BTC-USD',
                strategy_config: BOT_STRATEGY_CONFIG
            }));
        } else if (error || !data) {
            if (error) {
                console.error('[BOT] Erreur lecture user_settings', error);
            }
            running = false;
            return;
        } else {
            data = data.map(row => ({
                ...row,
                bot_symbols: row.bot_symbols || 'BTC-USD',
                strategy_config: normalizeStrategyConfig(row.strategy_config)
            }));
        }

        if (data.length === 0) {
            console.log('[BOT] Aucun utilisateur actif');
        }

        for (const row of data) {
            const userIntervalMs = resolveScanIntervalMs(row.strategy_config);
            const userIntervalSeconds = Math.round(userIntervalMs / 1000);
            const now = Date.now();
            const lastRunAt = Number(lastRunAtByUser.get(row.user_id) || 0);

            if (lastLoggedIntervalByUser.get(row.user_id) !== userIntervalSeconds) {
                const hasCustomInterval = Number.isFinite(Number(row?.strategy_config?.scanIntervalSeconds));
                if (hasCustomInterval) {
                    console.log(`[BOT] User ${row.user_id}: intervalle de scan = ${userIntervalSeconds}s`);
                } else {
                    console.log(`[BOT] User ${row.user_id}: scanIntervalSeconds absent, fallback = ${userIntervalSeconds}s`);
                }
                lastLoggedIntervalByUser.set(row.user_id, userIntervalSeconds);
            }

            if (now - lastRunAt < userIntervalMs) {
                continue;
            }

            lastRunAtByUser.set(row.user_id, now);
            await runCycleForUser(row.user_id, row.bot_symbols, row.strategy_config);
            await sleep(200);
        }
    } catch (error) {
        console.error('[BOT] Erreur cycle', error);
    } finally {
        console.log('[BOT] ⏹️ Fin du cycle');
        running = false;
    }
};

console.log(`[BOT] TradingBot actif. Scheduler ${BOT_DRIVER_INTERVAL_MS} ms (intervalle utilisateur configurable)`);

await runCycle();
setInterval(runCycle, BOT_DRIVER_INTERVAL_MS);
