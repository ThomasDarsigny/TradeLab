import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/private', () => ({
	GNEWS_API_KEY: 'gnews-key'
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_FINNHUB_API_KEY: 'finnhub-key'
}));

const gnewsBody = {
	articles: [
		{
			title: 'Titre bourse',
			url: 'https://exemple.com/bourse',
			source: { name: 'Le Devoir' },
			image: null,
			publishedAt: '2026-09-28T10:00:00Z',
			description: 'Résumé'
		}
	]
};

const finnhubBody = [
	{ headline: 'Titre crypto', url: 'https://exemple.com/crypto', source: 'CoinDesk', datetime: 1790000000, summary: 'Résumé crypto' }
];

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

// Le cache est au niveau du module : on réimporte le module à chaque test pour repartir à zéro
async function importLoad() {
	vi.resetModules();
	const { load } = await import('./+page.server');
	return () => load({} as any) as any;
}

describe('Chargement de la page /news', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('renvoie les promesses sans attendre les API (streaming)', async () => {
		const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
		vi.stubGlobal('fetch', fetchMock);
		const load = await importLoad();

		const data = load();

		expect(data.gnews).toBeInstanceOf(Promise);
		expect(data.finnhub).toBeInstanceOf(Promise);
		// Les deux appels partent en parallèle
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('normalise les articles des deux sources', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url: string) => jsonResponse(url.includes('gnews') ? gnewsBody : finnhubBody)));
		const load = await importLoad();

		const data = load();

		expect(await data.gnews).toEqual({
			success: true,
			articles: [
				{
					title: 'Titre bourse',
					url: 'https://exemple.com/bourse',
					source: 'Le Devoir',
					image: null,
					publishedAt: '2026-09-28T10:00:00Z',
					description: 'Résumé'
				}
			]
		});
		const finnhub = await data.finnhub;
		expect(finnhub.success).toBe(true);
		expect(finnhub.articles[0]).toMatchObject({ title: 'Titre crypto', source: 'CoinDesk', description: 'Résumé crypto' });
	});

	it('partage le cache entre les requêtes, même simultanées', async () => {
		const fetchMock = vi.fn(async (url: string) => jsonResponse(url.includes('gnews') ? gnewsBody : finnhubBody));
		vi.stubGlobal('fetch', fetchMock);
		const load = await importLoad();

		const first = load();
		const second = load();
		await Promise.all([first.gnews, first.finnhub, second.gnews, second.finnhub]);
		await load().gnews;

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("rafraîchit le cache après 10 minutes", async () => {
		const fetchMock = vi.fn(async (url: string) => jsonResponse(url.includes('gnews') ? gnewsBody : finnhubBody));
		vi.stubGlobal('fetch', fetchMock);
		const load = await importLoad();

		await load().gnews;
		vi.advanceTimersByTime(10 * 60 * 1000 + 1);
		await load().gnews;

		expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('gnews'))).toHaveLength(2);
	});

	it("renvoie une erreur lisible sur un 429 sans bloquer l'autre source", async () => {
		vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('gnews') ? jsonResponse({}, 429) : jsonResponse(finnhubBody))));
		const load = await importLoad();

		const data = load();
		const gnews = await data.gnews;

		expect(gnews.success).toBe(false);
		expect(gnews.error).toContain('Limite de requêtes GNews');
		expect((await data.finnhub).success).toBe(true);
	});

	it("signale un délai dépassé", async () => {
		const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			if (url.includes('gnews')) throw timeout;
			return jsonResponse(finnhubBody);
		}));
		const load = await importLoad();

		const gnews = await load().gnews;

		expect(gnews).toEqual({ success: false, articles: [], error: 'GNews ne répond pas (délai de 8 s dépassé).' });
	});

	it("ne garde un échec en cache que 30 secondes", async () => {
		const fetchMock = vi.fn(async (url: string) => (url.includes('gnews') ? jsonResponse({}, 500) : jsonResponse(finnhubBody)));
		vi.stubGlobal('fetch', fetchMock);
		const load = await importLoad();
		const gnewsCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('gnews')).length;

		expect((await load().gnews).error).toBe('GNews HTTP 500');
		await load().gnews;
		expect(gnewsCalls()).toBe(1);

		vi.advanceTimersByTime(30 * 1000 + 1);
		await load().gnews;
		expect(gnewsCalls()).toBe(2);
	});
});
