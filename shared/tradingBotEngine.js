/**
 * Moyenne mobile exponentielle (EMA)
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|undefined)[]}
 */
const ema = (values, period) => {
    const result = Array(values.length).fill(undefined);
    if (values.length < period) return result;
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += values[i];
    }
    let prevEma = sum / period;
    result[period - 1] = prevEma;
    const k = 2 / (period + 1);
    for (let i = period; i < values.length; i++) {
        prevEma = values[i] * k + prevEma * (1 - k);
        result[i] = prevEma;
    }
    return result;
};

/**
 * Moyenne mobile simple (SMA)
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|undefined)[]}
 */
const sma = (values, period) => {
    const result = Array(values.length).fill(undefined);
    if (values.length < period) return result;
    for (let i = period - 1; i < values.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sum += values[j];
        }
        result[i] = sum / period;
    }
    return result;
};
/**
 * @typedef {{ high: number[], low: number[], close: number[], volume: number[] }} CandleSeries
 */

/**
 * @typedef {Object} TradingBotSignal
 * @property {string} symbol
 * @property {'trend' | 'range' | 'neutral'} regime
 * @property {boolean} breakoutVigilance
 * @property {{
 *  adx?: number,
 *  atr?: number,
 *  ema50?: number,
 *  ema200?: number,
 *  rsi?: number,
 *  sma20?: number,
 *  stc?: number,
 *  bollingerUpper?: number,
 *  bollingerLower?: number,
 *  donchianUpper?: number,
 *  donchianLower?: number,
 *  volumeAvg?: number,
 *  lastVolume?: number
 * }} indicators
 * @property {{
 *  entryPrice?: number,
 *  stopLoss?: number,
 *  riskPercent?: number,
 *  positionSize?: number
 * }} risk
 * @property {{
 *  mode: 'ema' | 'atr' | 'none',
 *  trailingStop?: number,
 *  emaExitBelow?: number,
 *  highestHigh?: number
 * }} exitPlan
 */

/**
 * @typedef {Object} TradingBotStrategyConfig
 * @property {boolean} [enableTrend]
 * @property {boolean} [enableRange]
 * @property {boolean} [enableBreakout]
 * @property {number} [trendAdxMin]
 * @property {number} [rangeAdxMax]
 * @property {number} [breakoutVolumeMultiplier]
 * @property {number} [breakoutDonchianFactor]
 * @property {number} [breakoutStcMin]
 * @property {number} [hardStopLossPercent]
 * @property {number} [takeProfitPercent]
 * @property {number} [profitZonePercent]
 * @property {number} [profitBuffer]
 * @property {number} [stcReversalPrevMin]
 * @property {number} [stcReversalCurrentMax]
 * @property {number} [smaBreakFactor]
 * @property {number} [rsiRangeBuyMax]
 * @property {number} [atrMultiplierStock]
 * @property {number} [atrMultiplierCrypto]
 */

const DEFAULT_STRATEGY_CONFIG = {
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

/**
 * @param {TradingBotStrategyConfig | undefined} config
 */
const normalizeStrategyConfig = (config) => {
    const raw = config || {};
    return {
        enableTrend: typeof raw.enableTrend === 'boolean' ? raw.enableTrend : DEFAULT_STRATEGY_CONFIG.enableTrend,
        enableRange: typeof raw.enableRange === 'boolean' ? raw.enableRange : DEFAULT_STRATEGY_CONFIG.enableRange,
        enableBreakout: typeof raw.enableBreakout === 'boolean' ? raw.enableBreakout : DEFAULT_STRATEGY_CONFIG.enableBreakout,
        trendAdxMin: Number.isFinite(Number(raw.trendAdxMin)) ? Number(raw.trendAdxMin) : DEFAULT_STRATEGY_CONFIG.trendAdxMin,
        rangeAdxMax: Number.isFinite(Number(raw.rangeAdxMax)) ? Number(raw.rangeAdxMax) : DEFAULT_STRATEGY_CONFIG.rangeAdxMax,
        breakoutVolumeMultiplier: Number.isFinite(Number(raw.breakoutVolumeMultiplier))
            ? Number(raw.breakoutVolumeMultiplier)
            : DEFAULT_STRATEGY_CONFIG.breakoutVolumeMultiplier,
        breakoutDonchianFactor: Number.isFinite(Number(raw.breakoutDonchianFactor))
            ? Number(raw.breakoutDonchianFactor)
            : DEFAULT_STRATEGY_CONFIG.breakoutDonchianFactor,
        breakoutStcMin: Number.isFinite(Number(raw.breakoutStcMin)) ? Number(raw.breakoutStcMin) : DEFAULT_STRATEGY_CONFIG.breakoutStcMin,
        hardStopLossPercent: Number.isFinite(Number(raw.hardStopLossPercent))
            ? Number(raw.hardStopLossPercent)
            : DEFAULT_STRATEGY_CONFIG.hardStopLossPercent,
        takeProfitPercent: Number.isFinite(Number(raw.takeProfitPercent))
            ? Number(raw.takeProfitPercent)
            : DEFAULT_STRATEGY_CONFIG.takeProfitPercent,
        profitZonePercent: Number.isFinite(Number(raw.profitZonePercent))
            ? Number(raw.profitZonePercent)
            : DEFAULT_STRATEGY_CONFIG.profitZonePercent,
        stcReversalPrevMin: Number.isFinite(Number(raw.stcReversalPrevMin))
            ? Number(raw.stcReversalPrevMin)
            : DEFAULT_STRATEGY_CONFIG.stcReversalPrevMin,
        stcReversalCurrentMax: Number.isFinite(Number(raw.stcReversalCurrentMax))
            ? Number(raw.stcReversalCurrentMax)
            : DEFAULT_STRATEGY_CONFIG.stcReversalCurrentMax,
        smaBreakFactor: Number.isFinite(Number(raw.smaBreakFactor)) ? Number(raw.smaBreakFactor) : DEFAULT_STRATEGY_CONFIG.smaBreakFactor,
        rsiRangeBuyMax: Number.isFinite(Number(raw.rsiRangeBuyMax)) ? Number(raw.rsiRangeBuyMax) : DEFAULT_STRATEGY_CONFIG.rsiRangeBuyMax,
        atrMultiplierStock: Number.isFinite(Number(raw.atrMultiplierStock))
            ? Number(raw.atrMultiplierStock)
            : DEFAULT_STRATEGY_CONFIG.atrMultiplierStock,
        atrMultiplierCrypto: Number.isFinite(Number(raw.atrMultiplierCrypto))
            ? Number(raw.atrMultiplierCrypto)
            : DEFAULT_STRATEGY_CONFIG.atrMultiplierCrypto
    };
};

/**
 * @param {unknown} value
 * @returns {number|undefined}
 */
const safeNumber = (value) => (Number.isFinite(value) ? Number(value) : undefined);

/**
 * @param {(number|undefined)[]} values
 * @returns {number|undefined}
 */
const lastValue = (values) => {
    for (let i = values.length - 1; i >= 0; i -= 1) {
        const value = values[i];
        if (Number.isFinite(value)) {
            return /** @type {number} */ (value);
        }
    }
    return undefined;
};

// (supprimé : doublon de stc)
/**
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|undefined)[]}
 */
const rsi = (values, period) => {
    const result = Array(values.length).fill(undefined);
    if (values.length <= period) return result;

    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i += 1) {
        const change = values[i] - values[i - 1];
        if (change >= 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < values.length; i += 1) {
        const change = values[i] - values[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    return result;
};

/**
 * @param {number[]} high
 * @param {number[]} low
 * @param {number[]} close
 * @param {number} period
 * @returns {(number|undefined)[]}
 */
const atr = (high, low, close, period) => {
    const trValues = [];
    for (let i = 0; i < high.length; i += 1) {
        if (i === 0) {
            trValues.push(high[i] - low[i]);
            continue;
        }
        const range1 = high[i] - low[i];
        const range2 = Math.abs(high[i] - close[i - 1]);
        const range3 = Math.abs(low[i] - close[i - 1]);
        trValues.push(Math.max(range1, range2, range3));
    }

    const result = Array(high.length).fill(undefined);
    if (trValues.length < period) return result;

    let prevAtr = trValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    result[period - 1] = prevAtr;

    for (let i = period; i < trValues.length; i += 1) {
        prevAtr = (prevAtr * (period - 1) + trValues[i]) / period;
        result[i] = prevAtr;
    }

    return result;
};

/**
 * @param {number[]} high
 * @param {number[]} low
 * @param {number[]} close
 * @param {number} period
 * @returns {(number|undefined)[]}
 */
const adx = (high, low, close, period) => {
    const plusDm = [];
    const minusDm = [];
    const trValues = [];

    for (let i = 0; i < high.length; i += 1) {
        if (i === 0) {
            plusDm.push(0);
            minusDm.push(0);
            trValues.push(high[i] - low[i]);
            continue;
        }
        const upMove = high[i] - high[i - 1];
        const downMove = low[i - 1] - low[i];
        plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);

        const range1 = high[i] - low[i];
        const range2 = Math.abs(high[i] - close[i - 1]);
        const range3 = Math.abs(low[i] - close[i - 1]);
        trValues.push(Math.max(range1, range2, range3));
    }

    const smoothedTr = Array(high.length).fill(undefined);
    const smoothedPlus = Array(high.length).fill(undefined);
    const smoothedMinus = Array(high.length).fill(undefined);

    if (trValues.length < period) return Array(high.length).fill(undefined);

    const initTr = trValues.slice(0, period).reduce((sum, value) => sum + value, 0);
    const initPlus = plusDm.slice(0, period).reduce((sum, value) => sum + value, 0);
    const initMinus = minusDm.slice(0, period).reduce((sum, value) => sum + value, 0);

    smoothedTr[period - 1] = initTr;
    smoothedPlus[period - 1] = initPlus;
    smoothedMinus[period - 1] = initMinus;

    for (let i = period; i < trValues.length; i += 1) {
        smoothedTr[i] = (smoothedTr[i - 1] ?? 0) - (smoothedTr[i - 1] ?? 0) / period + trValues[i];
        smoothedPlus[i] = (smoothedPlus[i - 1] ?? 0) - (smoothedPlus[i - 1] ?? 0) / period + plusDm[i];
        smoothedMinus[i] = (smoothedMinus[i - 1] ?? 0) - (smoothedMinus[i - 1] ?? 0) / period + minusDm[i];
    }

    const dxValues = Array(high.length).fill(undefined);
    for (let i = period - 1; i < high.length; i += 1) {
        const tr = smoothedTr[i];
        const p = smoothedPlus[i];
        const m = smoothedMinus[i];
        if (!tr || tr === 0 || p === undefined || m === undefined) continue;
        const plusDi = 100 * (p / tr);
        const minusDi = 100 * (m / tr);
        const sum = plusDi + minusDi;
        dxValues[i] = sum === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / sum;
    }

    const adxValues = Array(high.length).fill(undefined);
    const dxSlice = dxValues.slice(period - 1, period * 2 - 1).filter((value) => value !== undefined);
    if (dxSlice.length < period) return adxValues;

    let prevAdx = dxSlice.reduce((sum, value) => sum + value, 0) / period;
    const startIndex = period * 2 - 2;
    adxValues[startIndex] = prevAdx;

    for (let i = startIndex + 1; i < dxValues.length; i += 1) {
        const dx = dxValues[i];
        if (dx === undefined) continue;
        prevAdx = (prevAdx * (period - 1) + dx) / period;
        adxValues[i] = prevAdx;
    }

    return adxValues;
};

/**
 * @param {number[]} values
 * @param {number} period
 * @param {number} multiplier
 * @returns {{upper:(number|undefined)[], lower:(number|undefined)[], mid:(number|undefined)[]}}
 */
const bollinger = (values, period, multiplier) => {
    const mid = sma(values, period);
    const upper = Array(values.length).fill(undefined);
    const lower = Array(values.length).fill(undefined);

    for (let i = period - 1; i < values.length; i += 1) {
        const slice = values.slice(i - period + 1, i + 1);
        const mean = mid[i];
        if (mean === undefined) continue;
        const variance = slice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        upper[i] = mean + multiplier * stdDev;
        lower[i] = mean - multiplier * stdDev;
    }

    return { upper, lower, mid };
};

/**
 * @param {number[]} high
 * @param {number[]} low
 * @param {number} period
 * @returns {{upper:(number|undefined)[], lower:(number|undefined)[]}}
 */
const donchian = (high, low, period) => {
    const upper = Array(high.length).fill(undefined);
    const lower = Array(high.length).fill(undefined);

    for (let i = period - 1; i < high.length; i += 1) {
        const highSlice = high.slice(i - period + 1, i + 1);
        const lowSlice = low.slice(i - period + 1, i + 1);
        upper[i] = Math.max(...highSlice);
        lower[i] = Math.min(...lowSlice);
    }

    return { upper, lower };
};

/**
 * @param {number[]} close
 * @returns {(number|undefined)[]}
 */
const stc = (close) => {
    const result = Array(close.length).fill(undefined);
    
    const rsiResult = rsi(close, 14);
    if (rsiResult.every(v => v === undefined)) return result;
    
    const rsiEmaFast = ema(rsiResult.map(v => v ?? 0), 5);
    const rsiEmaSlow = ema(rsiResult.map(v => v ?? 0), 34);
    
    const stochRsi = Array(close.length).fill(undefined);
    for (let i = 0; i < close.length; i += 1) {
        const rsiVal = rsiResult[i];
        const fastVal = rsiEmaFast[i];
        const slowVal = rsiEmaSlow[i];
        
        if (rsiVal === undefined || fastVal === undefined || slowVal === undefined) continue;
        
        const denominator = fastVal - slowVal;
        if (Math.abs(denominator) < 0.001) {
            stochRsi[i] = 50; 
        } else {
            stochRsi[i] = ((rsiVal - slowVal) / denominator) * 100;
            stochRsi[i] = Math.max(0, Math.min(100, stochRsi[i]));
        }
    }
    
    const stcFinal = rsi(stochRsi.map(v => v ?? 0), 3);
    
    for (let i = 0; i < stcFinal.length; i += 1) {
        if (stcFinal[i] !== undefined) {
            result[i] = stcFinal[i];
        }
    }
    
    return result;
};


/**
 * Calcule le multiplicateur ATR dynamique selon le type d'actif
 * @param {string} symbol
 * @param {{ atrMultiplierCrypto: number, atrMultiplierStock: number }} strategyConfig
 * @returns {number}
 */
function getAtrMultiplier(symbol, strategyConfig) {
    const isCrypto = symbol.toUpperCase().includes('-USD') || 
                     symbol.toUpperCase().includes('-BTC') || 
                     symbol.toUpperCase().includes('-USDT') ||
                     symbol.toUpperCase().includes('ETH') ||
                     symbol.toUpperCase().includes('BTC');
    
    return isCrypto ? strategyConfig.atrMultiplierCrypto : strategyConfig.atrMultiplierStock;
}

/**
 * Calcule une taille de position avec plafonnement strict à 15% du capital
 * @param {number} capital
 * @param {number} riskPercent
 * @param {number} price
 * @param {number} [stopDistance]
 * @returns {number}
 */
export function calculatePositionSize(capital, riskPercent, price, stopDistance) {
    const safeCapital = Number(capital);
    const safeRiskPercent = Number(riskPercent);
    const safePrice = Number(price);
    const safeStopDistance = Number(stopDistance);

    if (!Number.isFinite(safeCapital) || safeCapital <= 0) return 0;
    if (!Number.isFinite(safeRiskPercent) || safeRiskPercent <= 0) return 0;
    if (!Number.isFinite(safePrice) || safePrice <= 0) return 0;

    const riskAmount = safeCapital * safeRiskPercent;
    const rawSize = Number.isFinite(safeStopDistance) && safeStopDistance > 0
        ? riskAmount / safeStopDistance
        : riskAmount / safePrice;

    if (!Number.isFinite(rawSize) || rawSize <= 0) return 0;

    const maxAllocationAmount = safeCapital * 0.15;
    const maxQty = maxAllocationAmount / safePrice;
    return Math.min(rawSize, maxQty);
}

/**
 * @param {string} symbol
 * @param {CandleSeries} candles
 * @param {number} capital
 * @param {number} riskPercent
 * @param {TradingBotStrategyConfig} [config]
 * @returns {TradingBotSignal}
 */
export function analyzeTradingBotSignal(symbol, candles, capital, riskPercent, config) {
    const strategyConfig = normalizeStrategyConfig(config);
    const periodAdx = 14;
    const periodAtr = 14;
    const periodRsi = 14;
    const periodBollinger = 20;
    const periodDonchian = 20;
    const periodVolume = 20;
    const periodSma = 20;

    const minDataPoints = 50; 
    if (!candles.close || candles.close.length < minDataPoints) {
        return {
            symbol,
            regime: 'neutral',
            breakoutVigilance: false,
            indicators: {
                adx: undefined,
                atr: undefined,
                ema50: undefined,
                ema200: undefined,
                rsi: undefined,
                sma20: undefined,
                stc: undefined,
                bollingerUpper: undefined,
                bollingerLower: undefined,
                donchianUpper: undefined,
                donchianLower: undefined,
                volumeAvg: undefined,
                lastVolume: undefined,
            },
            risk: {
                entryPrice: undefined,
                stopLoss: undefined,
                riskPercent: 0,
                positionSize: undefined
            },
            exitPlan: {
                mode: 'none'
            }
        };
    }

    const ema50Series = ema(candles.close, 50);
    const ema200Series = ema(candles.close, 200);
    const rsiSeries = rsi(candles.close, periodRsi);
    const atrSeries = atr(candles.high, candles.low, candles.close, periodAtr);
    const adxSeries = adx(candles.high, candles.low, candles.close, periodAdx);
    const bollingerSeries = bollinger(candles.close, periodBollinger, 2);
    const donchianSeries = donchian(candles.high, candles.low, periodDonchian);
    const sma20Series = sma(candles.close, periodSma);
    const stcSeries = stc(candles.close);

    const lastClose = candles.close[candles.close.length - 1];
    const lastVolume = candles.volume ? candles.volume[candles.volume.length - 1] : 0;

    const avgVolumeSlice = candles.volume.slice(Math.max(0, candles.volume.length - periodVolume));
    const volumeAvg = avgVolumeSlice.length
        ? avgVolumeSlice.reduce((sum, value) => sum + value, 0) / avgVolumeSlice.length
        : undefined;

    const adxValue = lastValue(adxSeries);
    const atrValue = lastValue(atrSeries);
    const ema50Value = lastValue(ema50Series);
    const ema200Value = lastValue(ema200Series);
    const rsiValue = lastValue(rsiSeries);
    const sma20Value = lastValue(sma20Series);
    let stcValue = lastValue(stcSeries);
    
    if (stcValue === undefined) {
        stcValue = rsiValue;
    }
    
    const bollingerUpper = lastValue(bollingerSeries.upper);
    const bollingerLower = lastValue(bollingerSeries.lower);
    const donchianUpper = lastValue(donchianSeries.upper);
    const donchianLower = lastValue(donchianSeries.lower);

    /** @type {'neutral'|'trend'|'range'} */
    let regime = 'neutral';
    if (adxValue !== undefined) {
        if (adxValue > strategyConfig.trendAdxMin) regime = 'trend';
        else if (adxValue < strategyConfig.rangeAdxMax) regime = 'range';
    }

    const breakoutVigilance =
        volumeAvg !== undefined && lastVolume !== undefined
            ? lastVolume > volumeAvg * strategyConfig.breakoutVolumeMultiplier
            : false;

    const entryPrice = safeNumber(lastClose);
    const atrMultiplier = getAtrMultiplier(symbol, strategyConfig);
    const stopLoss = entryPrice !== undefined && atrValue !== undefined
        ? entryPrice - atrMultiplier * atrValue
        : undefined;

    const safeRiskPercent = Number.isFinite(riskPercent) ? riskPercent : 0.01;
    const positionSize =
        entryPrice !== undefined && stopLoss !== undefined && entryPrice > stopLoss
            ? calculatePositionSize(capital, safeRiskPercent, entryPrice, entryPrice - stopLoss)
            : undefined;

    /** @type {'none'|'ema'|'atr'} */
    let exitMode = 'none';
    let trailingStop;
    let emaExitBelow;
    let highestHigh;

    if (regime === 'trend' && ema50Value !== undefined) {
        exitMode = 'ema';
        emaExitBelow = ema50Value;
    } else if (breakoutVigilance && atrValue !== undefined) {
        exitMode = 'atr';
        const highSlice = candles.high.slice(Math.max(0, candles.high.length - periodDonchian));
        highestHigh = highSlice.length ? Math.max(...highSlice) : undefined;
        if (highestHigh !== undefined) {
            trailingStop = highestHigh - atrMultiplier * atrValue;
        }
    }

    return {
        symbol,
        regime,
        breakoutVigilance,
        indicators: {
            adx: adxValue,
            atr: atrValue,
            ema50: ema50Value,
            ema200: ema200Value,
            rsi: rsiValue,
            sma20: sma20Value,
            stc: stcValue,
            bollingerUpper,
            bollingerLower,
            donchianUpper,
            donchianLower,
            volumeAvg,
            lastVolume
        },
        risk: {
            entryPrice,
            stopLoss,
            riskPercent: safeRiskPercent,
            positionSize
        },
        exitPlan: {
            mode: exitMode,
            trailingStop,
            emaExitBelow,
            highestHigh
        }
    };
}

/**
 * Prend une décision ferme d'achat/vente basée sur les signaux et une position ouverte
 * @param {any} signal 
 * @param {any|null} position
 * @param {TradingBotStrategyConfig} [config]
 * @returns {{action: 'BUY'|'SELL'|'HOLD', reason?: string, strategy?: string, price?: number, stopLoss?: number}}
 */
export function makeDecision(signal, position, config) {
    const strategyConfig = normalizeStrategyConfig(config);
    if (!signal || typeof signal !== 'object') return { action: 'HOLD', reason: 'No signal' };
    const lastClose = signal.risk && typeof signal.risk === 'object' ? signal.risk.entryPrice : undefined;
    const indicators = signal.indicators && typeof signal.indicators === 'object' ? signal.indicators : {};
    const exitPlan = signal.exitPlan && typeof signal.exitPlan === 'object' ? signal.exitPlan : {};
    // Ajout du STC hook (besoin de la valeur précédente)
    const stcCurrent = indicators.stc;
    const stcPrev = indicators.stcPrev;

    if (!lastClose) {
        return { action: 'HOLD', reason: 'No price data' };
    }

    // ===== LOGIQUE DE SORTIE (Si position ouverte) =====
    if (position && typeof position === 'object') {
        const entryPrice = Number(position.entry_price);
        const rawPnlPercent = (lastClose - entryPrice) / entryPrice;
        const hardStopLossPercent = strategyConfig.hardStopLossPercent / 100;
        const takeProfitPercent = strategyConfig.takeProfitPercent / 100;
        const rawProfitBuffer = config && Number.isFinite(Number(config.profitBuffer))
            ? Number(config.profitBuffer)
            : undefined;
        const profitZonePercent = rawProfitBuffer !== undefined
            ? (rawProfitBuffer > 1 ? rawProfitBuffer / 100 : rawProfitBuffer)
            : strategyConfig.profitZonePercent / 100;

        // 1. HARD STOP-LOSS (-5%) : Priorité absolue
        if (rawPnlPercent < -hardStopLossPercent) {
            return { action: 'SELL', reason: 'STOP_LOSS_HARD', price: lastClose };
        }

        if (rawPnlPercent > takeProfitPercent) {
            return { action: 'SELL', reason: 'TAKE_PROFIT', price: lastClose };
        }

        const isInProfitZone = rawPnlPercent > profitZonePercent;

        if (
            isInProfitZone &&
            stcPrev !== undefined &&
            stcCurrent !== undefined &&
            (
                (stcPrev > strategyConfig.stcReversalPrevMin && stcCurrent < strategyConfig.stcReversalCurrentMax) ||
                (stcCurrent < stcPrev && stcCurrent >= 80)
            )
        ) {
            return { action: 'SELL', reason: 'STC_REVERSAL_TOP', price: lastClose };
        }

        if (isInProfitZone && exitPlan.mode === 'ema' && exitPlan.emaExitBelow !== undefined) {
            if (lastClose < exitPlan.emaExitBelow) {
                return { action: 'SELL', reason: 'EMA50_BREACH', price: lastClose };
            }
        }

        if (isInProfitZone && exitPlan.mode === 'atr' && exitPlan.trailingStop !== undefined) {
            if (lastClose < exitPlan.trailingStop) {
                return { action: 'SELL', reason: 'ATR_TRAILING_STOP', price: lastClose };
            }
        }

        if (isInProfitZone && indicators.sma20 !== undefined && lastClose < indicators.sma20 * strategyConfig.smaBreakFactor) {
            return { action: 'SELL', reason: 'SMA20_BREAK', price: lastClose };
        }

        return { action: 'HOLD' };
    }

    // ===== LOGIQUE D'ENTRÉE (Pas de position ouverte) =====
    const adx = indicators.adx;
    const ema50 = indicators.ema50;
    const ema200 = indicators.ema200;
    const sma20 = indicators.sma20;
    const rsi = indicators.rsi;
    const atr = indicators.atr;

    if (strategyConfig.enableTrend &&
        adx !== undefined && adx > strategyConfig.trendAdxMin &&
        ema50 !== undefined && ema200 !== undefined && ema50 > ema200 &&
        sma20 !== undefined && lastClose > sma20) {
        const stopLoss = atr !== undefined ? lastClose - (atr * 3) : lastClose * 0.95;
        return {
            action: 'BUY',
            strategy: 'TREND',
            price: lastClose,
            stopLoss,
            reason: 'ADX_TREND_EMA_ALIGNED'
        };
    }

    if (strategyConfig.enableRange &&
        adx !== undefined && adx < strategyConfig.rangeAdxMax &&
        rsi !== undefined && rsi < strategyConfig.rsiRangeBuyMax &&
        ema50 !== undefined && lastClose > ema50) {
        const stopLoss = atr !== undefined ? lastClose - (atr * 2.5) : lastClose * 0.93;
        return {
            action: 'BUY',
            strategy: 'RANGE_REVERSAL',
            price: lastClose,
            stopLoss,
            reason: 'RSI_OVERSOLD_RANGE'
        };
    }

    if (strategyConfig.enableBreakout &&
        signal && signal.breakoutVigilance &&
        indicators.donchianUpper !== undefined &&
        lastClose >= indicators.donchianUpper * strategyConfig.breakoutDonchianFactor &&
        indicators.stc !== undefined &&
        indicators.stc > strategyConfig.breakoutStcMin) {
        const stopLoss = atr !== undefined ? lastClose - (atr * 2) : lastClose * 0.94;
        return {
            action: 'BUY',
            strategy: 'BREAKOUT',
            price: lastClose,
            stopLoss,
            reason: 'DONCHIAN_BREAKOUT_HIGH_VOLUME'
        };
    }

    return { action: 'HOLD' };
}
