/**
 * tradingBotEngine.js
 * -------------------
 * Moteur partagé d'analyse technique utilisé par :
 * - l'API serveur (`/api/trading-bot/signal`) pour des analyses à la demande
 * - le worker `TradingBot/bot.js` qui exécute des scans en tâche de fond
 *
 * Objectif : fournir un ensemble d'indicateurs et une fonction `analyzeTradingBotSignal`
 * qui synthétise l'état du marché et propose un plan d'entrée/sortie (risk/exit).
 *
 * Conventions :
 * - Les séries de chandelles sont fournies via l'objet `CandleSeries` (high, low, close, volume).
 * - La fonction exportée retourne un objet `TradingBotSignal` décrivant :
 *   regime, indicateurs calculés, paramètres de risque (positionSize, stopLoss) et exitPlan.
 *
 * Sécurité et usage : ce moteur produit des signaux d'analyse technique seulement.
 * Il ne passe pas d'ordres. La logique d'exécution (gestion de compte, insertion en DB)
 * doit être gérée par le worker qui utilise ce module.
 *
 * Exemple d'utilisation :
 * import { analyzeTradingBotSignal } from '$shared/tradingBotEngine.js';
 * const signal = analyzeTradingBotSignal('AAPL', candles, 10000, 0.01);
 */

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

/**
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|undefined)[]}
 */
const sma = (values, period) => {
    const result = Array(values.length).fill(undefined);
    let sum = 0;
    for (let i = 0; i < values.length; i += 1) {
        sum += values[i];
        if (i >= period) {
            sum -= values[i - period];
        }
        if (i >= period - 1) {
            result[i] = sum / period;
        }
    }
    return result;
};

/**
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|undefined)[]}
 */
const ema = (values, period) => {
    const result = Array(values.length).fill(undefined);
    if (values.length < period) return result;

    const multiplier = 2 / (period + 1);
    let prevEma = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    result[period - 1] = prevEma;

    for (let i = period; i < values.length; i += 1) {
        prevEma = (values[i] - prevEma) * multiplier + prevEma;
        result[i] = prevEma;
    }

    return result;
};

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
 * Calcule le Schaff Trend Cycle (STC)
 * Indicateur qui combine MACD et Stochastique pour identifier les tendances
 * @param {number[]} close
 * @param {number} fastPeriod - Généralement 5
 * @param {number} slowPeriod - Généralement 23
 * @returns {(number|undefined)[]}
 */
const stc = (close, fastPeriod = 5, slowPeriod = 23) => {
    const result = Array(close.length).fill(undefined);

    // Calcul du MACD
    const ema12 = ema(close, 12);
    const ema26 = ema(close, 26);
    const macdLine = [];
    for (let i = 0; i < close.length; i += 1) {
        if (ema12[i] !== undefined && ema26[i] !== undefined) {
            macdLine.push(ema12[i] - ema26[i]);
        } else {
            macdLine.push(undefined);
        }
    }

    // Calcul du MACD Signal (EMA du MACD)
    const macdSignal = ema(macdLine.map((v) => v ?? 0), 9);

    // Histogram = MACD - Signal
    const histogram = [];
    for (let i = 0; i < macdLine.length; i += 1) {
        if (macdLine[i] !== undefined && macdSignal[i] !== undefined) {
            histogram.push(macdLine[i] - macdSignal[i]);
        } else {
            histogram.push(undefined);
        }
    }

    // Calcul du Stochastique du Histogram
    const fastKValues = [];
    const fastDValues = [];

    for (let i = fastPeriod - 1; i < histogram.length; i += 1) {
        const slice = histogram.slice(i - fastPeriod + 1, i + 1).filter((v) => v !== undefined);
        if (slice.length === 0) {
            fastKValues.push(undefined);
            continue;
        }
        const high = Math.max(...slice);
        const low = Math.min(...slice);
        const current = histogram[i] ?? 0;
        const fastK = high === low ? 50 : 100 * ((current - low) / (high - low));
        fastKValues.push(fastK);
    }

    // Lissage avec SMA pour obtenir Stochastique K lissé
    const smoothedK = sma(fastKValues, 3);

    // STC = normalisation finale avec une autre SMA
    const stcRaw = sma(smoothedK, 3);

    // Remplir le résultat
    const offset = fastPeriod - 1;
    for (let i = 0; i < stcRaw.length; i += 1) {
        if (stcRaw[i] !== undefined) {
            result[i + offset] = Math.max(0, Math.min(100, stcRaw[i]));
        }
    }

    return result;
};

/**
 * @param {string} symbol
 * @param {CandleSeries} candles
 * @param {number} capital
 * @param {number} riskPercent
 * @returns {TradingBotSignal}
 */
export function analyzeTradingBotSignal(symbol, candles, capital, riskPercent) {
    const periodAdx = 14;
    const periodAtr = 14;
    const periodRsi = 14;
    const periodBollinger = 20;
    const periodDonchian = 20;
    const periodVolume = 20;

    const ema50Series = ema(candles.close, 50);
    const ema200Series = ema(candles.close, 200);
    const rsiSeries = rsi(candles.close, periodRsi);
    const atrSeries = atr(candles.high, candles.low, candles.close, periodAtr);
    const adxSeries = adx(candles.high, candles.low, candles.close, periodAdx);
    const bollingerSeries = bollinger(candles.close, periodBollinger, 2);
    const donchianSeries = donchian(candles.high, candles.low, periodDonchian);

    const lastClose = candles.close[candles.close.length - 1];
    const lastVolume = candles.volume[candles.volume.length - 1];

    const avgVolumeSlice = candles.volume.slice(Math.max(0, candles.volume.length - periodVolume));
    const volumeAvg = avgVolumeSlice.length
        ? avgVolumeSlice.reduce((sum, value) => sum + value, 0) / avgVolumeSlice.length
        : undefined;

    const adxValue = lastValue(adxSeries);
    const atrValue = lastValue(atrSeries);
    const ema50Value = lastValue(ema50Series);
    const ema200Value = lastValue(ema200Series);
    const rsiValue = lastValue(rsiSeries);
    const bollingerUpper = lastValue(bollingerSeries.upper);
    const bollingerLower = lastValue(bollingerSeries.lower);
    const donchianUpper = lastValue(donchianSeries.upper);
    const donchianLower = lastValue(donchianSeries.lower);

    /** @type {'neutral'|'trend'|'range'} */
    let regime = 'neutral';
    if (adxValue !== undefined) {
        if (adxValue > 25) regime = 'trend';
        else if (adxValue < 20) regime = 'range';
    }

    const breakoutVigilance =
        volumeAvg !== undefined && lastVolume !== undefined
            ? lastVolume > volumeAvg * 1.5
            : false;

    const entryPrice = safeNumber(lastClose);
    const stopLoss = entryPrice !== undefined && atrValue !== undefined
        ? entryPrice - 2 * atrValue
        : undefined;

    const safeRiskPercent = Number.isFinite(riskPercent) ? riskPercent : 0.01;
    const riskAmount = entryPrice !== undefined ? capital * safeRiskPercent : undefined;
    const positionSize =
        entryPrice !== undefined && stopLoss !== undefined && riskAmount !== undefined && entryPrice > stopLoss
            ? riskAmount / (entryPrice - stopLoss)
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
            trailingStop = highestHigh - 2 * atrValue;
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
