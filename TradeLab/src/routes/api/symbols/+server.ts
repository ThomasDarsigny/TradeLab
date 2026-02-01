import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

export const GET: RequestHandler = async ({ url }) => {
	if (!PUBLIC_FINNHUB_API_KEY) {
		return json(
			{ error: 'Configuration API manquante' },
			{ status: 500 }
		);
	}

	const limitParam = Number(url.searchParams.get('limit') ?? 2000);
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 200), 5000)
		: 2000;

	try {
		const response = await fetch(
			`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${PUBLIC_FINNHUB_API_KEY}`
		);

		if (!response.ok) {
			throw new Error(`Erreur Finnhub: ${response.status}`);
		}

		const data = await response.json();
		
		const symbols = (data || [])
			.filter((stock: any) => stock.symbol && stock.description)
			.filter((stock: any) =>
				['Common Stock', 'ADR', 'ETP'].includes(stock.type)
			)
			.map((stock: any) => ({
				symbol: stock.displaySymbol ?? stock.symbol,
				name: stock.description,
				country: '🇺🇸'
			}))
			.slice(0, limit);

		return json({ symbols });
	} catch (error) {
		console.error('Erreur lors de la récupération des symboles:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Erreur lors de la récupération des symboles' },
			{ status: 500 }
		);
	}
};
