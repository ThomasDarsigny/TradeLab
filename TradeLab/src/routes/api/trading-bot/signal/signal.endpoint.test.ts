import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$shared/tradingBotEngine.js', () => ({
	analyzeTradingBotSignal: vi.fn(() => ({ action: 'BUY', confidence: 0.9 }))
}));

import { POST } from './+server';

const makeRequest = (body: unknown) =>
	new Request('http://localhost/mock', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

describe('API trading-bot signal endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('retourne 400 si symbole manquant', async () => {
		const response = await POST({
			request: makeRequest({ period: '1M' }),
			fetch: vi.fn()
		} as any);

		expect(response.status).toBe(400);
	});

	it('retourne 502 si endpoint candles échoue', async () => {
		const response = await POST({
			request: makeRequest({ symbol: 'AAPL' }),
			fetch: vi.fn(async () => new Response('bad', { status: 500 }))
		} as any);

		expect(response.status).toBe(502);
	});

	it('retourne un signal quand les données sont valides', async () => {
		const response = await POST({
			request: makeRequest({ symbol: 'AAPL', riskPercent: 1 }),
			fetch: vi.fn(async () =>
				new Response(
					JSON.stringify({ high: [10, 11], low: [9, 10], close: [9.5, 10.5], volume: [1000, 1200] }),
					{ status: 200 }
				)
			)
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.signal.action).toBe('BUY');
	});
});
