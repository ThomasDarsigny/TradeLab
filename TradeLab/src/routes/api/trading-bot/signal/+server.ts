import { json, type RequestHandler } from '@sveltejs/kit';
import { analyzeTradingBotSignal } from '$shared/tradingBotEngine.js';

const toNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStrategyConfig = (value: unknown) => {
    const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    return {
        trendAdxMin: toNumber(raw.trendAdxMin, 25),
        rangeAdxMax: toNumber(raw.rangeAdxMax, 20),
        breakoutVolumeMultiplier: toNumber(raw.breakoutVolumeMultiplier, 1.5),
        breakoutDonchianFactor: toNumber(raw.breakoutDonchianFactor, 0.99),
        breakoutStcMin: toNumber(raw.breakoutStcMin, 60),
        hardStopLossPercent: toNumber(raw.hardStopLossPercent, 5),
        takeProfitPercent: toNumber(raw.takeProfitPercent, 10),
        profitZonePercent: toNumber(raw.profitZonePercent, 0.8),
        stcReversalPrevMin: toNumber(raw.stcReversalPrevMin, 85),
        stcReversalCurrentMax: toNumber(raw.stcReversalCurrentMax, 82),
        smaBreakFactor: toNumber(raw.smaBreakFactor, 0.9),
        rsiRangeBuyMax: toNumber(raw.rsiRangeBuyMax, 40),
        atrMultiplierStock: toNumber(raw.atrMultiplierStock, 2.5),
        atrMultiplierCrypto: toNumber(raw.atrMultiplierCrypto, 3.5)
    };
};

export const POST: RequestHandler = async ({ request, fetch }) => {
    try {
        const body = await request.json().catch(() => null);
        const symbol = String(body?.symbol || '').trim();
        if (!symbol) {
            return json({ error: 'Symbole manquant' }, { status: 400 });
        }

        const period = String(body?.period || '1M');
        const capitalInput = Number(body?.capital ?? 0);
        const riskInput = Number(body?.riskPercent ?? 0.01);
        const strategyConfig = parseStrategyConfig(body?.strategyConfig);

        let riskPercent = Number.isFinite(riskInput) ? riskInput : 0.01;
        if (riskPercent > 1) {
            riskPercent = riskPercent / 100;
        }
        if (riskPercent <= 0) {
            riskPercent = 0.01;
        }

        const candlesRes = await fetch(
            `/api/stock/${encodeURIComponent(symbol)}/candles?period=${encodeURIComponent(period)}`
        );

        if (!candlesRes.ok) {
            return json({ error: 'Impossible de charger les donnees' }, { status: 502 });
        }

        const candles = await candlesRes.json();
        const high = (candles.high || []).map(Number);
        const low = (candles.low || []).map(Number);
        const close = (candles.close || []).map(Number);
        const volume = (candles.volume || []).map(Number);

        if (!high.length || high.length !== low.length || low.length !== close.length) {
            return json({ error: 'Serie de donnees invalide' }, { status: 400 });
        }

        const signal = analyzeTradingBotSignal(
            symbol.toUpperCase(),
            { high, low, close, volume },
            Number.isFinite(capitalInput) ? capitalInput : 0,
            riskPercent,
            strategyConfig
        );

        return json({ signal });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
