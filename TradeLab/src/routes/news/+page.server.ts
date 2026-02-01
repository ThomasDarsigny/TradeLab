import type { PageServerLoad } from './$types';
import { GNEWS_API_KEY } from '$env/static/private';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

const mapGnewsArticles = (data: any) =>
	(data?.articles ?? []).slice(0, 10).map((article: any) => ({
		title: article.title,
		url: article.url,
		source: article.source?.name,
		image: article.image,
		publishedAt: article.publishedAt,
		description: article.description
	}));

const mapFinnhubArticles = (data: any) =>
	(data ?? []).slice(0, 10).map((article: any) => ({
		title: article.headline,
		url: article.url,
		source: article.source,
		image: article.image,
		publishedAt: article.datetime ? new Date(article.datetime * 1000).toISOString() : undefined,
		description: article.summary
	}));

const fetchCryptoPrice = async () => {
	try {
		const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true');
		if (!response.ok) throw new Error('Erreur CoinGecko');
		const data = await response.json();
		return {
			success: true,
			name: 'Bitcoin',
			symbol: 'BTC',
			price: data.bitcoin?.usd ?? 0,
			change24h: data.bitcoin?.usd_24h_change ?? 0,
			marketCap: data.bitcoin?.usd_market_cap ?? 0
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Erreur crypto' };
	}
};

const fetchStockPrice = async () => {
	try {
	const response = await fetch('https://finnhub.io/api/v1/quote?symbol=AAPL&token=' + PUBLIC_FINNHUB_API_KEY);
		if (!response.ok) throw new Error('Erreur Finnhub');
		const data = await response.json();
		return {
			success: true,
			name: 'Apple Inc.',
			symbol: 'AAPL',
			price: data.c ?? 0,
			change24h: data.dp ?? 0,
			previousClose: data.pc ?? 0
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Erreur action' };
	}
};

export const load: PageServerLoad = async () => {
	const errors: string[] = [];

	let gnews: { success: boolean; articles: any[] } = { success: false, articles: [] };
	let finnhub: { success: boolean; articles: any[] } = { success: false, articles: [] };
	let crypto: any = { success: false };
	let stock: any = { success: false };

	try {
		if (!GNEWS_API_KEY) {
			throw new Error('Clé GNews manquante (GNEWS_API_KEY)');
		}

		const gnewsUrl = `https://gnews.io/api/v4/top-headlines?token=${GNEWS_API_KEY}&lang=fr&topic=business&max=10`;
		const response = await fetch(gnewsUrl);
		if (!response.ok) {
			throw new Error(`GNews HTTP ${response.status}`);
		}
		const data = await response.json();
		gnews = { success: true, articles: mapGnewsArticles(data) };
	} catch (error) {
		errors.push(error instanceof Error ? error.message : 'Erreur GNews inconnue');
	}

	try {
		if (!PUBLIC_FINNHUB_API_KEY) {
			throw new Error('Clé Finnhub manquante (PUBLIC_FINNHUB_API_KEY)');
		}

		const finnhubUrl = `https://finnhub.io/api/v1/news?category=general&token=${PUBLIC_FINNHUB_API_KEY}`;
		const response = await fetch(finnhubUrl);
		if (!response.ok) {
			throw new Error(`Finnhub HTTP ${response.status}`);
		}
		const data = await response.json();
		finnhub = { success: true, articles: mapFinnhubArticles(data) };
	} catch (error) {
		errors.push(error instanceof Error ? error.message : 'Erreur Finnhub inconnue');
	}

	// Récupérer les prix de crypto et d'action
	crypto = await fetchCryptoPrice();
	stock = await fetchStockPrice();

	return {
		success: gnews.success || finnhub.success,
		gnews,
		finnhub,
		crypto,
		stock,
		errors
	};
};
