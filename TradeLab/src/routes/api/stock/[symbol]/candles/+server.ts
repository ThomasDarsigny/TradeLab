import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
const FINNHUB_API_URL = 'http://127.0.0.1:8000';

export const GET: RequestHandler = async ({ params, url }) => {
	const { symbol } = params as unknown as { symbol: string };
	const period = url.searchParams.get('period') || '1M';

	const periodMap: Record<string, { resolution: string; count: number }> = {
		'1D': { resolution: 'D', count: 30 },     // 30 jours (limité par API gratuite)
		'1W': { resolution: 'D', count: 60 },
		'1M': { resolution: 'D', count: 30 },
		'3M': { resolution: 'D', count: 90 },     // 90 jours (max API gratuite)
		'1Y': { resolution: 'W', count: 52 },     // 52 semaines (max API gratuite)
		'5Y': { resolution: 'M', count: 60 }      // 60 mois (max API gratuite)
	};

	const { resolution, count } = periodMap[period] || { resolution: 'D', count: 20 };

	try {
		const response = await globalThis.fetch(
			`${FINNHUB_API_URL}/candles/${encodeURIComponent(symbol)}?resolution=${resolution}&count=${count}`
		);

		console.log(`Finnhub candles response status: ${response.status} for ${symbol}`);

		if (!response.ok) {
			const body = await response.text();
			console.error(`Finnhub candles error (${response.status}): ${body || 'Réponse vide'}`);
			return json({
				timestamps: [],
				open: [],
				high: [],
				low: [],
				close: [],
				volume: [],
				error: `Données indisponibles (Finnhub ${response.status})`
			});
		}

		const data = await response.json();

		if (!data.timestamps || data.timestamps.length === 0) {
			console.log(`No Finnhub candle data for ${symbol}`);
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
		console.error('Erreur API Finnhub Candles:', error);
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
