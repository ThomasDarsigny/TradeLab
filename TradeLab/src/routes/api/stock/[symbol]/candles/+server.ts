import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

const FINNHUB_API_URL = 'http://127.0.0.1:8000';
const YFINANCE_API_URL = 'http://127.0.0.1:8001';

export const GET: RequestHandler = async ({ params, url }) => {
	const { symbol } = params as unknown as { symbol: string };
	const period = url.searchParams.get('period') || '1M';

	const periodMap: Record<string, { resolution: string; count: number }> = {
		'1m': { resolution: '1', count: 60 },
		'5m': { resolution: '5', count: 60 },
		'1D': { resolution: 'D', count: 30 },
		'1W': { resolution: 'D', count: 60 },
		'1M': { resolution: 'D', count: 30 },
		'3M': { resolution: 'D', count: 90 },
		'1Y': { resolution: 'W', count: 52 },
		'5Y': { resolution: 'M', count: 60 }
	};

	const yfinancePeriodMap: Record<string, { period: string; interval: string }> = {
		'1m': { period: '1d', interval: '1m' },
		'5m': { period: '5d', interval: '5m' },
		'1D': { period: '5d', interval: '30m' },
		'1W': { period: '1mo', interval: '1d' },
		'1M': { period: '1mo', interval: '1d' },
		'3M': { period: '3mo', interval: '1d' },
		'1Y': { period: '1y', interval: '1wk' },
		'5Y': { period: '5y', interval: '1mo' }
	};

	const { resolution, count } = periodMap[period] || { resolution: 'D', count: 20 };

	const yfinanceFallback = async () => {
		const primaryParams = yfinancePeriodMap[period] || { period: '1mo', interval: '1d' };
		const fallbackParams = { period: '1mo', interval: '1d' };

		const fetchHistory = async (params: { period: string; interval: string }) => {
			const response = await globalThis.fetch(
				`${YFINANCE_API_URL}/history/${encodeURIComponent(symbol)}?period=${params.period}&interval=${params.interval}`
			);


			if (!response.ok) {
				const body = await response.text();
				return null;
			}

			const data = await response.json();
			if (!data.timestamps || data.timestamps.length === 0) {
				return null;
			}

			return {
				timestamps: data.timestamps || [],
				open: data.open || [],
				high: data.high || [],
				low: data.low || [],
				close: data.close || [],
				volume: data.volume || []
			};
		};

		try {
			const primary = await fetchHistory(primaryParams);
			if (primary) {
				return primary;
			}

			if (primaryParams.period !== fallbackParams.period || primaryParams.interval !== fallbackParams.interval) {
				return await fetchHistory(fallbackParams);
			}

			return null;
		} catch (error) {
			return null;
		}
	};

	try {
		const response = await globalThis.fetch(
			`${FINNHUB_API_URL}/candles/${encodeURIComponent(symbol)}?resolution=${resolution}&count=${count}`
		);


		if (!response.ok) {
			const body = await response.text();
			const fallback = await yfinanceFallback();
			if (fallback) {
				return json(fallback);
			}
			return json({
				timestamps: [],
				open: [],
				high: [],
				low: [],
				close: [],
				volume: [],
				error: `Donnees indisponibles (Finnhub ${response.status})`
			});
		}

		const data = await response.json();

		if (!data.timestamps || data.timestamps.length === 0) {
			const fallback = await yfinanceFallback();
			if (fallback) {
				return json(fallback);
			}
			return json({
				timestamps: [],
				open: [],
				high: [],
				low: [],
				close: [],
				volume: [],
				error: 'Aucune donnée disponible pour ce symbole'
			});
		}

		return json({
			timestamps: data.timestamps || [],
			open: data.open || [],
			high: data.high || [],
			low: data.low || [],
			close: data.close || [],
			volume: data.volume || []
		});
	} catch (error) {
		const fallback = await yfinanceFallback();
		if (fallback) {
			return json(fallback);
		}
		return json(
			{
				timestamps: [],
				open: [],
				high: [],
				low: [],
				close: [],
				volume: [],
				error: 'Impossible de récupérer les données du graphique (Finnhub)'
			},
			{ status: 200 }
		);
	}
};
