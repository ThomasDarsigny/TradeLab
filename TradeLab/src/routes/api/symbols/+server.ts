import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

const EXCHANGES = [
	{ code: 'US', flag: '🇺🇸', name: 'États-Unis' },
	{ code: 'TO', flag: '🇨🇦', name: 'Canada' },
	{ code: 'L', flag: '🇬🇧', name: 'Londres' },
	{ code: 'PA', flag: '🇫🇷', name: 'Paris' },
	{ code: 'T', flag: '🇯🇵', name: 'Tokyo' },
	{ code: 'F', flag: '🇩🇪', name: 'Francfort' },
	{ code: 'HK', flag: '🇭🇰', name: 'Hong Kong' },
	{ code: 'SW', flag: '🇨🇭', name: 'Suisse' }
];

export const GET: RequestHandler = async ({ url }) => {
	if (!PUBLIC_FINNHUB_API_KEY) {
		return json({ error: 'Configuration API manquante' }, { status: 500 });
	}

	const query = (url.searchParams.get('q') ?? '').trim();
	const limitParam = Number(url.searchParams.get('limit') ?? 2000);
	const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 200), 5000) : 2000;

	try {
		if (query) {
			let symbols: any[] = [];

			try {
				const response = await fetch(
					`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${PUBLIC_FINNHUB_API_KEY}`
				);

				if (response.ok) {
					const data = await response.json();
					symbols = (data?.result || [])
						.filter((stock: any) => stock.symbol && stock.description)
						.filter((stock: any) => ['Common Stock', 'ADR', 'ETP'].includes(stock.type))
						.map((stock: any) => ({
							symbol: stock.displaySymbol ?? stock.symbol,
							name: stock.description,
							country: stock.country,
							exchange: stock.exchange ?? 'Global'
						}))
						.slice(0, Math.min(limit, 200));
				}
			} catch (finnhubError) {
			}

			if (symbols.length < 5) {
				try {
					const yahooResponse = await fetch(
						`http://127.0.0.1:8001/search?q=${encodeURIComponent(query)}&limit=100`,
						{ signal: AbortSignal.timeout(5000) }
					);

					if (yahooResponse.ok) {
						const yahooData = await yahooResponse.json();
						const yahooSymbols = (yahooData?.symbols || [])
							.filter((stock: any) => stock.type === 'EQUITY' || stock.type === 'ETF')
							.map((stock: any) => ({
								symbol: stock.symbol,
								name: stock.name,
								country: stock.country,
								exchange: stock.exchange || 'Yahoo'
							}));

						const seen = new Set(symbols.map((s) => s.symbol));
						yahooSymbols.forEach((s: any) => {
							if (!seen.has(s.symbol)) {
								symbols.push(s);
								seen.add(s.symbol);
							}
						});
					}
				} catch (yahooError) {
				}
			}

			return json({ symbols });
		}

		const allSymbols: any[] = [];

		const promises = EXCHANGES.map(async (exchange) => {
			try {
				const response = await fetch(
					`https://finnhub.io/api/v1/stock/symbol?exchange=${exchange.code}&token=${PUBLIC_FINNHUB_API_KEY}`
				);

				if (!response.ok) return [];

				const data = await response.json();
				return (data || [])
					.filter((stock: any) => stock.symbol && stock.description)
					.filter((stock: any) => ['Common Stock', 'ADR', 'ETP'].includes(stock.type))
					.slice(0, 300)
					.map((stock: any) => ({
						symbol: stock.displaySymbol ?? stock.symbol,
						name: stock.description,
						country: exchange.flag,
						exchange: exchange.name
					}));
			} catch (error) {
				return [];
			}
		});

		const results = await Promise.all(promises);
		results.forEach((stocks) => allSymbols.push(...stocks));

		const symbols = allSymbols.slice(0, limit);

		return json({ symbols });
	} catch (error) {
		return json(
			{
				error:
					error instanceof Error ? error.message : 'Erreur lors de la récupération des symboles'
			},
			{ status: 500 }
		);
	}
};
