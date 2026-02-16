import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

export const GET: RequestHandler = async ({ params }) => {
	const { symbol } = params as unknown as { symbol: string };
	const apiKey = PUBLIC_FINNHUB_API_KEY;

	if (!apiKey) {
		return json(
			{ error: 'Configuration API manquante' },
			{ status: 500 }
		);
	}

	try {
		const quoteResponse = await globalThis.fetch(
			`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
		);
		
		let quoteData = { c: 0, d: 0, dp: 0, o: 0, h: 0, l: 0, pc: 0 };
		let profileData = { 
			name: `${symbol} Inc.`, 
			marketCapitalization: 0,
			logo: '',
			weburl: ''
		};
		
		if (quoteResponse.ok) {
			quoteData = await quoteResponse.json();
			
			if (!quoteData.c || quoteData.c === 0) {
				try {
					const yahooResponse = await globalThis.fetch(
						`http://127.0.0.1:8001/quote/${symbol}`
					);
					
					if (yahooResponse.ok) {
						const yahooData = await yahooResponse.json();
						let change = yahooData.change;
						let changePercent = yahooData.changePercent;

						if (
							(change === undefined || change === null || (change === 0 && yahooData.price !== yahooData.previousClose)) &&
							yahooData.price &&
							yahooData.previousClose
						) {
							change = yahooData.price - yahooData.previousClose;
						}

						if (
							(changePercent === undefined || changePercent === null || (changePercent === 0 && yahooData.price !== yahooData.previousClose)) &&
							yahooData.price &&
							yahooData.previousClose > 0
						) {
							changePercent = (change / yahooData.previousClose) * 100;
						}

						quoteData = {
							c: yahooData.price,
							d: change || 0,
							dp: changePercent || 0,
							o: yahooData.open,
							h: yahooData.high,
							l: yahooData.low,
							pc: yahooData.previousClose
						};
						profileData.marketCapitalization = yahooData.marketCap / 1000000;
						if (yahooData.logoUrl) {
							profileData.logo = yahooData.logoUrl;
						}
					}
				} catch (e) {
				}
			} else {
				try {
					const profileResponse = await globalThis.fetch(
						`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`
					);
					if (profileResponse.ok) {
						profileData = await profileResponse.json();
					}
				} catch (e) {
				}
			}
		} else {
			try {
				const yahooResponse = await globalThis.fetch(
					`http://127.0.0.1:8001/quote/${symbol}`
				);
				
				if (yahooResponse.ok) {
					const yahooData = await yahooResponse.json();
					let change = yahooData.change;
					let changePercent = yahooData.changePercent;

					if (
						(change === undefined || change === null || (change === 0 && yahooData.price !== yahooData.previousClose)) &&
						yahooData.price &&
						yahooData.previousClose
					) {
						change = yahooData.price - yahooData.previousClose;
					}

					if (
						(changePercent === undefined || changePercent === null || (changePercent === 0 && yahooData.price !== yahooData.previousClose)) &&
						yahooData.price &&
						yahooData.previousClose > 0
					) {
						changePercent = (change / yahooData.previousClose) * 100;
					}

					quoteData = {
						c: yahooData.price,
						d: change || 0,
						dp: changePercent || 0,
						o: yahooData.open,
						h: yahooData.high,
						l: yahooData.low,
						pc: yahooData.previousClose
					};
					profileData.marketCapitalization = yahooData.marketCap / 1000000;
					if (yahooData.logoUrl) {
						profileData.logo = yahooData.logoUrl;
					}
				}
			} catch (e) {
			}
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
		return json(
			{ error: 'Impossible de récupérer les données de cette action' },
			{ status: 500 }
		);
	}
};
