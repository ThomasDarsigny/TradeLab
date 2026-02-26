import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTradingBotSignal, makeDecision } from './tradingBotEngine.js';

const createCandles = ({
	length = 260,
	start = 100,
	step = 0,
	range = 2,
	baseVolume = 100,
	lastVolume
} = {}) => {
	const close = [];
	const high = [];
	const low = [];
	const volume = [];

	for (let index = 0; index < length; index += 1) {
		const price = start + index * step;
		close.push(price);
		high.push(price + range);
		low.push(price - range);
		volume.push(baseVolume);
	}

	if (lastVolume !== undefined) {
		volume[volume.length - 1] = lastVolume;
	}

	return { high, low, close, volume };
};

test('makeDecision ignore le signal STC si le profit est inférieur au buffer (0.8%)', () => {
    const signal = {
        risk: { entryPrice: 100.5 },
        indicators: { stc: 80, stcPrev: 90 },
        exitPlan: { mode: 'none' }
    };
    const position = { entry_price: 100 };

    const decision = makeDecision(signal, position);

    assert.equal(decision.action, 'HOLD');
});

// Test Profit Buffer : le bot ne vend pas si le profit n'atteint pas le seuil
// (par exemple, buffer de 0.8%)
test('Profit Buffer : le bot ne vend pas si le profit < buffer', () => {
    const signal = {
        risk: { entryPrice: 100.8 },
        indicators: { stc: 80, stcPrev: 90 },
        exitPlan: { mode: 'none' }
    };
    const position = { entry_price: 100 };
    // simulate config with profitBuffer = 0.008 (0.8%)
    const config = { profitBuffer: 0.008 };
    const decision = makeDecision(signal, position, config);
    assert.equal(decision.action, 'HOLD');
});

test('makeDecision vend quand le STC amorce un retournement (Hook) et que le profit est suffisant', () => {
    const signal = {
        risk: { entryPrice: 102 },
        indicators: { stc: 84, stcPrev: 92 },
        exitPlan: { mode: 'none' }
    };
    const position = { entry_price: 100 };
    // simulate config with profitBuffer = 0.008 (0.8%)
    const config = { profitBuffer: 0.008 };
    const decision = makeDecision(signal, position, config);
    assert.equal(decision.action, 'SELL');
    assert.equal(decision.reason, 'STC_REVERSAL_TOP');
});

// Test STC Hook : le bot vend sur retournement STC si le profit est suffisant
// (STC hook = stc < stcPrev, stc > 80, profit > buffer)
test('STC Hook : le bot vend sur retournement STC si profit > buffer', () => {
    const signal = {
        risk: { entryPrice: 102 },
        indicators: { stc: 85, stcPrev: 95 },
        exitPlan: { mode: 'none' }
    };
    const position = { entry_price: 100 };
    const config = { profitBuffer: 0.008 };
    const decision = makeDecision(signal, position, config);
    assert.equal(decision.action, 'SELL');
    assert.equal(decision.reason, 'STC_REVERSAL_TOP');
});

// Test de la Sécurité des 15% (Money Management)
import { calculatePositionSize } from './tradingBotEngine.js';

test('calculatePositionSize plafonne la taille de position à 15% du capital', () => {
    const capital = 10000;
    const risk = 0.05; // 5%
    const price = 100;
    const qty = calculatePositionSize(capital, risk, price);

    assert.ok(qty <= 15);
});

// Test Money Management : la taille de position ne dépasse jamais 15% du capital
// (simulate capital, risk, price)
test('Money Management : positionSize ne dépasse pas 15% du capital', () => {
    const capital = 20000;
    const risk = 0.10; // 10%
    const price = 100;
    const qty = calculatePositionSize(capital, risk, price);
    // 15% de 20000 = 3000, donc max qty = 30
    assert.ok(qty <= 30);
});

test('analyzeTradingBotSignal retourne un signal neutre avec donnees insuffisantes', () => {
	const candles = createCandles({ length: 20, step: 0.2 });
	const signal = analyzeTradingBotSignal('AAPL', candles, 10_000, 0.01);

	assert.equal(signal.regime, 'neutral');
	assert.equal(signal.breakoutVigilance, false);
	assert.equal(signal.exitPlan.mode, 'none');
	assert.equal(signal.risk.positionSize, undefined);
});

test('analyzeTradingBotSignal detecte une vigilance breakout sur pic de volume', () => {
	const candles = createCandles({ length: 260, step: 0.01, baseVolume: 100, lastVolume: 200 });
	const signal = analyzeTradingBotSignal('AAPL', candles, 10_000, 0.01);

	assert.equal(signal.breakoutVigilance, true);
	assert.equal(typeof signal.indicators.lastVolume, 'number');
	assert.equal(typeof signal.indicators.volumeAvg, 'number');
});

test('analyzeTradingBotSignal classe une tendance forte en regime trend avec sortie EMA', () => {
	const candles = createCandles({ length: 320, step: 1, range: 1.5, baseVolume: 120 });
	const signal = analyzeTradingBotSignal('AAPL', candles, 25_000, 0.02);

	assert.equal(signal.regime, 'trend');
	assert.equal(signal.exitPlan.mode, 'ema');
	assert.ok((signal.risk.entryPrice ?? 0) > 0);
	assert.ok((signal.risk.stopLoss ?? 0) < (signal.risk.entryPrice ?? 0));
	assert.ok((signal.risk.positionSize ?? 0) > 0);
});

test('makeDecision retourne SELL sur hard stop loss d une position ouverte', () => {
	const signal = {
		risk: { entryPrice: 90 },
		indicators: {},
		exitPlan: { mode: 'none' }
	};
	const position = { entry_price: 100 };

	const decision = makeDecision(signal, position);
	assert.equal(decision.action, 'SELL');
	assert.equal(decision.reason, 'STOP_LOSS_HARD');
});

test('makeDecision retourne BUY en mode trend lorsque les indicateurs sont alignes', () => {
	const signal = {
		breakoutVigilance: false,
		risk: { entryPrice: 120 },
		indicators: {
			adx: 30,
			ema50: 118,
			ema200: 110,
			sma20: 115,
			atr: 2,
			rsi: 55
		},
		exitPlan: { mode: 'ema', emaExitBelow: 118 }
	};

	const decision = makeDecision(signal, null);
	assert.equal(decision.action, 'BUY');
	assert.equal(decision.strategy, 'TREND');
	assert.equal(decision.reason, 'ADX_TREND_EMA_ALIGNED');
});

test('makeDecision retourne BUY breakout quand donchian et STC sont valides', () => {
	const signal = {
		breakoutVigilance: true,
		risk: { entryPrice: 100 },
		indicators: {
			adx: 22,
			donchianUpper: 100,
			stc: 70,
			atr: 1.8,
			ema50: 99,
			ema200: 98,
			sma20: 97,
			rsi: 50
		},
		exitPlan: { mode: 'atr', trailingStop: 95 }
	};

	const decision = makeDecision(signal, null);
	assert.equal(decision.action, 'BUY');
	assert.equal(decision.strategy, 'BREAKOUT');
	assert.equal(decision.reason, 'DONCHIAN_BREAKOUT_HIGH_VOLUME');
});

test('analyzeTradingBotSignal respecte breakoutVolumeMultiplier override', () => {
	const candles = createCandles({ length: 260, step: 0.01, baseVolume: 100, lastVolume: 200 });

	const defaultSignal = analyzeTradingBotSignal('AAPL', candles, 10_000, 0.01);
	const strictSignal = analyzeTradingBotSignal('AAPL', candles, 10_000, 0.01, {
		breakoutVolumeMultiplier: 2.5
	});

	assert.equal(defaultSignal.breakoutVigilance, true);
	assert.equal(strictSignal.breakoutVigilance, false);
});

test('makeDecision respecte trendAdxMin override', () => {
	const signal = {
		breakoutVigilance: false,
		risk: { entryPrice: 120 },
		indicators: {
			adx: 30,
			ema50: 118,
			ema200: 110,
			sma20: 115,
			atr: 2,
			rsi: 55
		},
		exitPlan: { mode: 'ema', emaExitBelow: 118 }
	};

	const defaultDecision = makeDecision(signal, null);
	const strictDecision = makeDecision(signal, null, { trendAdxMin: 35 });

	assert.equal(defaultDecision.action, 'BUY');
	assert.equal(strictDecision.action, 'HOLD');
});
