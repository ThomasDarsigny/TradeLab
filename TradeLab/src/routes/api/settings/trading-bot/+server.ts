import { json, type RequestHandler } from '@sveltejs/kit';
import { getUserSettings, upsertUserSettings } from '$lib/services/userSettingsService';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

const FINNHUB_API_URL = 'https://finnhub.io/api/v1';
const YFINANCE_API_URL = 'http://127.0.0.1:8001';

const DEFAULT_STRATEGY_CONFIG = {
    scanIntervalSeconds: 5,
    enableTrend: true,
    enableRange: true,
    enableBreakout: true,
    trendAdxMin: 25,
    rangeAdxMax: 20,
    breakoutVolumeMultiplier: 1.5,
    breakoutDonchianFactor: 0.99,
    breakoutStcMin: 60,
    hardStopLossPercent: 5,
    takeProfitPercent: 10,
    profitZonePercent: 0.8,
    stcReversalPrevMin: 85,
    stcReversalCurrentMax: 82,
    smaBreakFactor: 0.9,
    rsiRangeBuyMax: 40,
    atrMultiplierStock: 2.5,
    atrMultiplierCrypto: 3.5
};

const toNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStrategyConfig = (input: unknown) => {
    const raw = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
    return {
        scanIntervalSeconds: toNumber(raw.scanIntervalSeconds, DEFAULT_STRATEGY_CONFIG.scanIntervalSeconds),
        enableTrend: typeof raw.enableTrend === 'boolean' ? raw.enableTrend : DEFAULT_STRATEGY_CONFIG.enableTrend,
        enableRange: typeof raw.enableRange === 'boolean' ? raw.enableRange : DEFAULT_STRATEGY_CONFIG.enableRange,
        enableBreakout: typeof raw.enableBreakout === 'boolean' ? raw.enableBreakout : DEFAULT_STRATEGY_CONFIG.enableBreakout,
        trendAdxMin: toNumber(raw.trendAdxMin, DEFAULT_STRATEGY_CONFIG.trendAdxMin),
        rangeAdxMax: toNumber(raw.rangeAdxMax, DEFAULT_STRATEGY_CONFIG.rangeAdxMax),
        breakoutVolumeMultiplier: toNumber(raw.breakoutVolumeMultiplier, DEFAULT_STRATEGY_CONFIG.breakoutVolumeMultiplier),
        breakoutDonchianFactor: toNumber(raw.breakoutDonchianFactor, DEFAULT_STRATEGY_CONFIG.breakoutDonchianFactor),
        breakoutStcMin: toNumber(raw.breakoutStcMin, DEFAULT_STRATEGY_CONFIG.breakoutStcMin),
        hardStopLossPercent: toNumber(raw.hardStopLossPercent, DEFAULT_STRATEGY_CONFIG.hardStopLossPercent),
        takeProfitPercent: toNumber(raw.takeProfitPercent, DEFAULT_STRATEGY_CONFIG.takeProfitPercent),
        profitZonePercent: toNumber(raw.profitZonePercent, DEFAULT_STRATEGY_CONFIG.profitZonePercent),
        stcReversalPrevMin: toNumber(raw.stcReversalPrevMin, DEFAULT_STRATEGY_CONFIG.stcReversalPrevMin),
        stcReversalCurrentMax: toNumber(raw.stcReversalCurrentMax, DEFAULT_STRATEGY_CONFIG.stcReversalCurrentMax),
        smaBreakFactor: toNumber(raw.smaBreakFactor, DEFAULT_STRATEGY_CONFIG.smaBreakFactor),
        rsiRangeBuyMax: toNumber(raw.rsiRangeBuyMax, DEFAULT_STRATEGY_CONFIG.rsiRangeBuyMax),
        atrMultiplierStock: toNumber(raw.atrMultiplierStock, DEFAULT_STRATEGY_CONFIG.atrMultiplierStock),
        atrMultiplierCrypto: toNumber(raw.atrMultiplierCrypto, DEFAULT_STRATEGY_CONFIG.atrMultiplierCrypto)
    };
};

const isMissingStrategyColumnError = (error: unknown) => {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return message.includes('strategy_config') && (message.includes('column') || message.includes('schema cache'));
};

const normalizeSymbols = (input: unknown) => {
    const raw = String(input ?? 'BTC-USD');
    const unique = Array.from(
        new Set(
            raw
                .split(',')
                .map((symbol) => symbol.trim().toUpperCase())
                .filter(Boolean)
        )
    );

    if (unique.length === 0) {
        return 'BTC-USD';
    }

    return unique.join(', ');
};

const splitSymbols = (symbols: string) =>
    symbols
        .split(',')
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);

const hasValidPrice = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
};

const validateSymbolWithFinnhub = async (symbol: string) => {
    if (!PUBLIC_FINNHUB_API_KEY) return false;

    try {
        const quoteResponse = await fetch(
            `${FINNHUB_API_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${PUBLIC_FINNHUB_API_KEY}`
        );

        if (quoteResponse.ok) {
            const quoteData = await quoteResponse.json();
            if (hasValidPrice(quoteData?.c)) {
                return true;
            }
        }

        const searchResponse = await fetch(
            `${FINNHUB_API_URL}/search?q=${encodeURIComponent(symbol)}&token=${PUBLIC_FINNHUB_API_KEY}`
        );

        if (!searchResponse.ok) {
            return false;
        }

        const searchData = await searchResponse.json();
        if (!Array.isArray(searchData?.result)) {
            return false;
        }

        return searchData.result.some((item: { symbol?: string; displaySymbol?: string }) => {
            const candidateSymbol = String(item?.symbol ?? '').toUpperCase();
            const candidateDisplay = String(item?.displaySymbol ?? '').toUpperCase();
            return candidateSymbol === symbol || candidateDisplay === symbol;
        });
    } catch {
        return false;
    }
};

const validateSymbolWithYfinance = async (symbol: string) => {
    try {
        const response = await fetch(`${YFINANCE_API_URL}/quote/${encodeURIComponent(symbol)}`);
        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return hasValidPrice(data?.price);
    } catch {
        return false;
    }
};

const validateSymbolExists = async (symbol: string) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) return false;

    const [finnhubOk, yfinanceOk] = await Promise.all([
        validateSymbolWithFinnhub(normalizedSymbol),
        validateSymbolWithYfinance(normalizedSymbol)
    ]);

    return finnhubOk || yfinanceOk;
};

export const GET: RequestHandler = async ({ locals }) => {
    try {
        const { session } = await locals.safeGetSession();
        if (!session) {
            return json({ error: 'Non authentifie' }, { status: 401 });
        }

        const settings = await getUserSettings(session.user.id, locals.supabase);
        return json({
            enabled: settings?.trading_bot_enabled ?? false,
            symbols: normalizeSymbols(settings?.bot_symbols),
            strategyConfig: normalizeStrategyConfig(settings?.strategy_config)
        });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ locals, request }) => {
    try {
        const { session } = await locals.safeGetSession();
        if (!session) {
            return json({ error: 'Non authentifie' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const enabled = Boolean(body?.enabled);
        const symbols = normalizeSymbols(body?.symbols);
        const symbolList = splitSymbols(symbols);
        const strategyConfig = normalizeStrategyConfig(body?.strategyConfig);

        const validationResults = await Promise.all(
            symbolList.map(async (symbol) => ({
                symbol,
                isValid: await validateSymbolExists(symbol)
            }))
        );

        const invalidSymbols = validationResults
            .filter((entry) => !entry.isValid)
            .map((entry) => entry.symbol);

        if (invalidSymbols.length > 0) {
            return json(
                {
                    error: `Symbole(s) invalide(s): ${invalidSymbols.join(', ')}. Vérifiez le ticker et réessayez.`
                },
                { status: 400 }
            );
        }

        let updated;
        try {
            updated = await upsertUserSettings(session.user.id, {
                trading_bot_enabled: enabled,
                bot_symbols: symbols,
                strategy_config: strategyConfig
            }, locals.supabase);
        } catch (error) {
            if (!isMissingStrategyColumnError(error)) {
                throw error;
            }

            updated = await upsertUserSettings(session.user.id, {
                trading_bot_enabled: enabled,
                bot_symbols: symbols
            }, locals.supabase);
        }

        return json({
            enabled: updated.trading_bot_enabled,
            symbols: updated.bot_symbols,
            strategyConfig: normalizeStrategyConfig(updated.strategy_config ?? strategyConfig)
        });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
