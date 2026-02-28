import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_FINNHUB_API_KEY: undefined
}));

vi.mock('$lib/services/userSettingsService', () => ({
	getUserSettings: vi.fn(),
	upsertUserSettings: vi.fn()
}));

import * as settingsService from '$lib/services/userSettingsService';
import { GET, PUT } from './+server';

const mockedService = vi.mocked(settingsService);

const authedLocals = {
	safeGetSession: vi.fn(async () => ({ session: { user: { id: 'user-1' } } })),
	supabase: {}
};

const unauthLocals = {
	safeGetSession: vi.fn(async () => ({ session: null })),
	supabase: {}
};

const makeRequest = (body: unknown) =>
	new Request('http://localhost/mock', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

describe('API settings trading-bot endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ price: 120 }), { status: 200 })));
	});

	it('GET retourne 401 sans session', async () => {
		const response = await GET({ locals: unauthLocals } as any);
		expect(response.status).toBe(401);
	});

	it('GET retourne les paramètres normalisés', async () => {
		mockedService.getUserSettings.mockResolvedValue({
			trading_bot_enabled: true,
			bot_symbols: 'AAPL',
			strategy_config: { trendAdxMin: 30 }
		} as any);

		const response = await GET({ locals: authedLocals } as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.enabled).toBe(true);
		expect(data.symbols).toBe('AAPL');
		expect(data.strategyConfig.trendAdxMin).toBe(30);
	});

	it('PUT retourne 400 si symbole invalide', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ price: 0 }), { status: 200 })));

		const response = await PUT({
			locals: authedLocals,
			request: makeRequest({ enabled: true, symbols: 'BADSYM' })
		} as any);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain('Symbole(s) invalide(s)');
	});

	it('PUT sauvegarde les paramètres si symboles valides', async () => {
		mockedService.upsertUserSettings.mockResolvedValue({
			trading_bot_enabled: true,
			bot_symbols: 'AAPL',
			strategy_config: { trendAdxMin: 25 }
		} as any);

		const response = await PUT({
			locals: authedLocals,
			request: makeRequest({ enabled: true, symbols: 'aapl', strategyConfig: { trendAdxMin: 25 } })
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.enabled).toBe(true);
		expect(data.symbols).toBe('AAPL');
		expect(mockedService.upsertUserSettings).toHaveBeenCalled();
	});
});
