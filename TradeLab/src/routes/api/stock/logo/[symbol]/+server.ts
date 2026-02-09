import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

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

export const GET: RequestHandler = async ({ params, request }) => {
	const symbol = (params.symbol ?? '').toUpperCase();

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
