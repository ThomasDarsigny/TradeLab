import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

export const GET: RequestHandler = async ({ params, url }) => {
	const { symbol } = params as unknown as { symbol: string };
	const apiKey = PUBLIC_FINNHUB_API_KEY;
	const period = url.searchParams.get('period') || '1M';
	
	console.log('API Key disponible:', !!apiKey, 'Symbol:', symbol, 'Period:', period);

	if (!apiKey) {
		console.error('Clé API Finnhub non disponible');
		return json(
			{ error: 'Configuration API manquante' },
			{ status: 500 }
		);
	}
	
	let resolution = 'D';
	let from: number;
	let to = Math.floor(Date.now() / 1000);

	// Calculer les dates en fonction de la période
	switch (period) {
		case '1D':
			resolution = '60';
			from = to - (1 * 24 * 60 * 60);
			break;
		case '1W':
			resolution = 'D';
			from = to - (7 * 24 * 60 * 60);
			break;
		case '1M':
			resolution = 'D';
			from = to - (30 * 24 * 60 * 60);
			break;
		case '3M':
			resolution = 'W';
			from = to - (90 * 24 * 60 * 60);
			break;
		case '1Y':
			resolution = 'W';
			from = to - (365 * 24 * 60 * 60);
			break;
		case '5Y':
			resolution = 'M';
			from = to - (5 * 365 * 24 * 60 * 60);
			break;
		case 'ALL':
			resolution = 'M';
			from = to - (10 * 365 * 24 * 60 * 60);
			break;
		default:
			resolution = 'D';
			from = to - (30 * 24 * 60 * 60);
	}

	try {
		const response = await globalThis.fetch(
			`https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`
		);

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Erreur Finnhub (${response.status}): ${body || 'Réponse vide'}`);
		}

		const data = await response.json();

		if (data.s === 'no_data') {
			return json({ error: 'Aucune donnée disponible pour ce symbole' }, { status: 404 });
		}

		return json({
			timestamps: data.t || [],
			open: data.o || [],
			high: data.h || [],
			low: data.l || [],
			close: data.c || [],
			volume: data.v || []
		});
	} catch (error) {
		console.error('Erreur API Candles:', error);
		return json(
			{ error: 'Impossible de récupérer les données du graphique' },
			{ status: 500 }
		);
	}
};
