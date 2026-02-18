import type { PageServerLoad } from './$types';
import { GNEWS_API_KEY } from '$env/static/private';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';
import { error } from '@sveltejs/kit';

const mapGnewsArticles = (data: any) =>
	(data?.articles ?? []).slice(0, 50).map((article: any) => ({
		title: article.title,
		url: article.url,
		source: article.source?.name,
		image: article.image,
		publishedAt: article.publishedAt,
		description: article.description
	}));

const mapFinnhubArticles = (data: any) =>
	(data ?? []).slice(0, 50).map((article: any) => ({
		title: article.headline,
		url: article.url,
		source: article.source,
		image: article.image,
		publishedAt: article.datetime ? new Date(article.datetime * 1000).toISOString() : undefined,
		description: article.summary
	}));


export const load: PageServerLoad = async ({ locals }) => {
	const errors: string[] = [];

	let gnews: { success: boolean; articles: any[] } = { success: false, articles: [] };
	let finnhub: { success: boolean; articles: any[] } = { success: false, articles: [] };
	let crypto: any = { success: false };
	let stock: any = { success: false };

	try {
		if (!GNEWS_API_KEY) {
			throw new Error('Clé GNews manquante (GNEWS_API_KEY)');
		}

		const gnewsUrl = `https://gnews.io/api/v4/top-headlines?token=${GNEWS_API_KEY}&lang=fr&topic=business&q=bourse OR marché OR action OR finance&max=20`;
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

		const finnhubUrl = `https://finnhub.io/api/v1/news?category=crypto&token=${PUBLIC_FINNHUB_API_KEY}`;
		const response = await fetch(finnhubUrl);
		if (!response.ok) {
			throw new Error(`Finnhub HTTP ${response.status}`);
		}
		const data = await response.json();
		finnhub = { success: true, articles: mapFinnhubArticles(data) };
	} catch (error) {
		errors.push(error instanceof Error ? error.message : 'Erreur Finnhub inconnue');
	}

	return {
		success: gnews.success || finnhub.success,
		gnews,
		finnhub,
		crypto,
		stock,
		errors
	};
};
