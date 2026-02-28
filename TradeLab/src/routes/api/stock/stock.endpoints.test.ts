import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_FINNHUB_API_KEY: 'test-key'
}));

import { GET as stockGet } from './[symbol]/+server';
import { GET as candlesGet } from './[symbol]/candles/+server';
import { GET as logoGet } from './logo/[symbol]/+server';

describe('API stock endpoints', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET /api/stock/[symbol] retourne les données de quote', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ c: 100, d: 2, dp: 2, o: 98, h: 101, l: 97, pc: 98 }), {
					status: 200
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ name: 'Apple', marketCapitalization: 1000, weburl: 'https://apple.com' }), {
					status: 200
				})
			);
		vi.stubGlobal('fetch', fetchMock);

		const response = await stockGet({ params: { symbol: 'AAPL' } } as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.symbol).toBe('AAPL');
		expect(data.price).toBe(100);
	});

	it('GET /api/stock/[symbol]/candles fallback vers yfinance si finnhub échoue', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response('fail', { status: 500 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						timestamps: [1, 2],
						open: [1, 2],
						high: [2, 3],
						low: [0.5, 1.5],
						close: [1.5, 2.5],
						volume: [10, 20]
					}),
					{ status: 200 }
				)
			);
		vi.stubGlobal('fetch', fetchMock);

		const response = await candlesGet({
			params: { symbol: 'AAPL' },
			url: new URL('http://localhost/api/stock/AAPL/candles?period=1M')
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.timestamps).toHaveLength(2);
	});

	it('GET /api/stock/logo/[symbol] redirige crypto vers logo map', async () => {
		const response = await logoGet({
			params: { symbol: 'BTC-USD' },
			request: new Request('http://localhost/api/stock/logo/BTC-USD')
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toContain('coingecko.com');
	});
});
