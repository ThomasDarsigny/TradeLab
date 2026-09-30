import type { PageServerLoad } from './$types';
import { GNEWS_API_KEY } from '$env/static/private';
import { PUBLIC_FINNHUB_API_KEY } from '$env/static/public';

type NewsArticle = {
	title: string;
	url: string;
	source?: string;
	image?: string;
	publishedAt?: string;
	description?: string;
};

type NewsSource = {
	success: boolean;
	articles: NewsArticle[];
	error?: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 30 * 1000;
const FETCH_TIMEOUT_MS = 8000;

const mapGnewsArticles = (data: any): NewsArticle[] =>
	(data?.articles ?? []).slice(0, 50).map((article: any) => ({
		title: article.title,
		url: article.url,
		source: article.source?.name,
		image: article.image,
		publishedAt: article.publishedAt,
		description: article.description
	}));

const mapFinnhubArticles = (data: any): NewsArticle[] =>
	(data ?? []).slice(0, 50).map((article: any) => ({
		title: article.headline,
		url: article.url,
		source: article.source,
		image: article.image,
		publishedAt: article.datetime ? new Date(article.datetime * 1000).toISOString() : undefined,
		description: article.summary
	}));

async function fetchSource(
	label: string,
	url: string,
	mapArticles: (data: any) => NewsArticle[]
): Promise<NewsSource> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
		if (response.status === 429) {
			throw new Error(`Limite de requêtes ${label} atteinte. Réessayez dans quelques minutes.`);
		}
		if (!response.ok) {
			throw new Error(`${label} HTTP ${response.status}`);
		}
		return { success: true, articles: mapArticles(await response.json()) };
	} catch (error) {
		const message =
			error instanceof Error && error.name === 'TimeoutError'
				? `${label} ne répond pas (délai de ${FETCH_TIMEOUT_MS / 1000} s dépassé).`
				: error instanceof Error
					? error.message
					: `Erreur ${label} inconnue`;
		return { success: false, articles: [], error: message };
	}
}

// Cache mémoire partagé entre les requêtes : une recherche GNews prend souvent 3 à 9 s,
// et le préchargement au survol + les clics répétés épuisaient le quota de l'API.
// On garde la promesse elle-même pour que les requêtes simultanées partagent le même appel.
const cache = new Map<string, { expiresAt: number; promise: Promise<NewsSource> }>();

function cached(key: string, loader: () => Promise<NewsSource>): Promise<NewsSource> {
	const hit = cache.get(key);
	if (hit && hit.expiresAt > Date.now()) return hit.promise;

	const entry = { expiresAt: Date.now() + CACHE_TTL_MS, promise: loader() };
	cache.set(key, entry);
	entry.promise.then((result) => {
		// Un échec n'est gardé que brièvement, pour réessayer sans marteler l'API
		if (!result.success) entry.expiresAt = Date.now() + ERROR_CACHE_TTL_MS;
	});
	return entry.promise;
}

const loadGnews = () =>
	GNEWS_API_KEY
		? fetchSource(
				'GNews',
				`https://gnews.io/api/v4/top-headlines?token=${GNEWS_API_KEY}&lang=fr&topic=business&q=bourse OR marché OR action OR finance&max=20`,
				mapGnewsArticles
			)
		: Promise.resolve({ success: false, articles: [], error: 'Clé GNews manquante (GNEWS_API_KEY)' });

const loadFinnhub = () =>
	PUBLIC_FINNHUB_API_KEY
		? fetchSource(
				'Finnhub',
				`https://finnhub.io/api/v1/news?category=crypto&token=${PUBLIC_FINNHUB_API_KEY}`,
				mapFinnhubArticles
			)
		: Promise.resolve({ success: false, articles: [], error: 'Clé Finnhub manquante (PUBLIC_FINNHUB_API_KEY)' });

// Les promesses ne sont pas attendues : SvelteKit affiche la page tout de suite
// et diffuse (streaming) les articles dès qu'ils arrivent.
export const load: PageServerLoad = () => ({
	gnews: cached('gnews', loadGnews),
	finnhub: cached('finnhub', loadFinnhub)
});
