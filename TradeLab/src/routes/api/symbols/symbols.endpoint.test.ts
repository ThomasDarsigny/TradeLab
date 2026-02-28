import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_FINNHUB_API_KEY: 'test-key'
}));

import { GET } from './+server';

describe('API symbols endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('retourne les symboles de recherche finnhub filtrés', async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					result: [
						{ symbol: 'AAPL', displaySymbol: 'AAPL', description: 'Apple', type: 'Common Stock', country: 'US', exchange: 'NASDAQ' },
						{ symbol: 'XXX', description: 'Ignored', type: 'Mutual Fund' }
					]
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		const response = await GET({
			url: new URL('http://localhost/api/symbols?q=aapl&limit=200')
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.symbols.length).toBeGreaterThan(0);
		expect(data.symbols[0].symbol).toBe('AAPL');
	});
});
