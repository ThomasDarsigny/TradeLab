import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

export const GET: RequestHandler = async ({ params }) => {
	const { symbol } = params as unknown as { symbol: string };
	const apiKey = PUBLIC_FINNHUB_API_KEY;
	console.log('API Key disponible:', !!apiKey, 'Symbol:', symbol);

	if (!apiKey) {
		console.error('Clé API Finnhub non disponible');
		return json(
			{ error: 'Configuration API manquante' },
			{ status: 500 }
		);
	}

	try {
		const quoteResponse = await globalThis.fetch(
			`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
		);
		
		if (!quoteResponse.ok) {
			throw new Error('Erreur lors de la récupération des données');
		}

		const quoteData = await quoteResponse.json();

		const profileResponse = await globalThis.fetch(
			`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`
		);

		let profileData = { 
			name: `${symbol} Inc.`, 
			marketCapitalization: 0,
			logo: '',
			weburl: ''
		};
		if (profileResponse.ok) {
			profileData = await profileResponse.json();
		}

		const cleanSymbol = symbol.toUpperCase().split('.')[0];
		const webDomain = profileData.weburl
			? profileData.weburl.replace('https://', '').replace('http://', '')
			: '';
		const fallbackLogo = webDomain
			? `https://logo.clearbit.com/${webDomain}`
			: `https://storage.googleapis.com/iexcloud-hl37opg/api/logos/${cleanSymbol}.png`;

		const stockData = {
			symbol: symbol.toUpperCase(),
			name: profileData.name || `${symbol.toUpperCase()} Inc.`,
			logo: profileData.logo || fallbackLogo,
			price: quoteData.c || 0,
			change: quoteData.d || 0,
			changePercent: quoteData.dp || 0,
			open: quoteData.o || 0,
			high: quoteData.h || 0,
			low: quoteData.l || 0,
			previousClose: quoteData.pc || 0,
			marketCap: profileData.marketCapitalization || 0
		};

		return json(stockData);
	} catch (error) {
		console.error('Erreur API Stock:', error);
		return json(
			{ error: 'Impossible de récupérer les données de cette action' },
			{ status: 500 }
		);
	}
};
