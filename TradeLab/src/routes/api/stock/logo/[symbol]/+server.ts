import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

// Mapping pour les tests de crypto
//À RETIRER SI POSSIBLE
const CRYPTO_LOGO_MAP: Record<string, string> = {
	BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
	ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
	SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
	BNB: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
	XRP: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
	ADA: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
	DOGE: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
	AVAX: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
	DOT: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
	LINK: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
	LTC: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png',
	BCH: 'https://assets.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png',
	MATIC: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png'
};

const CRYPTO_QUOTES = new Set(['USD', 'USDT', 'USDC', 'BTC', 'ETH', 'EUR', 'CAD']);

const withCacheHeaders = (location: URL | string) => {
	return new Response(null, {
		status: 302,
		headers: {
			Location: location.toString(),
			'Cache-Control': 'public, max-age=86400'
		}
	});
};

const getDomainFromUrl = (url: string | undefined) => {
	if (!url) return '';
	return url.replace('https://', '').replace('http://', '').split('/')[0];
};

const getCryptoBaseSymbol = (symbol: string) => {
	const parts = symbol.split('-').map((part) => part.trim()).filter(Boolean);
	if (parts.length !== 2) return null;
	const [base, quote] = parts;
	if (!CRYPTO_QUOTES.has(quote)) return null;
	return base;
};

export const GET: RequestHandler = async ({ params, request }) => {
	const symbol = (params.symbol ?? '').toUpperCase();
	const cryptoBaseSymbol = getCryptoBaseSymbol(symbol);
	if (cryptoBaseSymbol) {
		const cryptoLogo = CRYPTO_LOGO_MAP[cryptoBaseSymbol];
		if (cryptoLogo) {
			return withCacheHeaders(cryptoLogo);
		}
	}

	if (PUBLIC_FINNHUB_API_KEY) {
		try {
			const profileResponse = await fetch(
				`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${PUBLIC_FINNHUB_API_KEY}`
			);
			if (profileResponse.ok) {
				const profile = await profileResponse.json();
				if (profile?.logo) {
					return withCacheHeaders(profile.logo as string);
				}
				const domain = getDomainFromUrl(profile?.weburl);
				if (domain) {
					return withCacheHeaders(`https://logo.clearbit.com/${domain}`);
				}
			}
		} catch {
	    }
	}

	try {
		const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=assetProfile`;
		const yahooResponse = await fetch(yahooUrl, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'application/json, text/plain, */*',
				'Referer': 'https://finance.yahoo.com/',
				'Origin': 'https://finance.yahoo.com'
			}
		});
		if (yahooResponse.ok) {
			const yahooData = await yahooResponse.json();
			const website = yahooData?.quoteSummary?.result?.[0]?.assetProfile?.website as
				| string
				| undefined;
			const domain = getDomainFromUrl(website);
			if (domain) {
				return withCacheHeaders(`https://logo.clearbit.com/${domain}`);
			}
		}
	} catch {
	}

	const fallbackUrl = new URL('/logo.png', request.url);
	return withCacheHeaders(fallbackUrl);
};
