import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/accountService', () => ({
	getAccount: vi.fn(),
	createAccount: vi.fn(),
	calculateAccountStats: vi.fn(),
	getOpenPositions: vi.fn(),
	getTransactionHistory: vi.fn(),
	buyStock: vi.fn(),
	sellStock: vi.fn(),
	deposit: vi.fn(),
	withdraw: vi.fn(),
}));

vi.mock('$lib/utils/normalize', () => ({
	normalizeAccount: vi.fn((value: any) => value),
	normalizePosition: vi.fn((value: any) => value),
	normalizePositions: vi.fn((value: any) => value),
	normalizeTransactions: vi.fn((value: any) => value),
}));

import * as accountService from '$lib/services/accountService';
import { GET as accountGet, POST as accountPost } from './+server';
import { GET as positionsGet } from './positions/+server';
import { GET as transactionsGet } from './transactions/+server';
import { POST as buyPost } from './trades/buy/+server';
import { POST as sellPost } from './trades/sell/+server';
import { POST as depositPost } from './deposit/+server';
import { POST as withdrawPost } from './withdraw/+server';

const mockedService = vi.mocked(accountService);

const authedLocals = {
	safeGetSession: vi.fn(async () => ({ session: { user: { id: 'user-1' } } })),
	supabase: {},
};

const unauthLocals = {
	safeGetSession: vi.fn(async () => ({ session: null })),
	supabase: {},
};

const makeRequest = (body: unknown) =>
	new Request('http://localhost/mock', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});

describe('API account endpoints mock tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET /api/account retourne 401 sans session', async () => {
		const response = await accountGet({ locals: unauthLocals } as any);
		expect(response.status).toBe(401);
	});

	it('GET /api/account retourne compte + stats', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);
		mockedService.calculateAccountStats.mockResolvedValue({ total: 1 } as any);

		const response = await accountGet({ locals: authedLocals } as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.account.id).toBe('acc-1');
		expect(data.stats.total).toBe(1);
	});

	it('POST /api/account crée un compte', async () => {
		mockedService.getAccount.mockResolvedValue(null as any);
		mockedService.createAccount.mockResolvedValue({ id: 'acc-new' } as any);

		const response = await accountPost({
			locals: authedLocals,
			request: makeRequest({ initial_balance: 5000 }),
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.account.id).toBe('acc-new');
	});

	it('POST /api/account retourne 400 si compte déjà existant', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);

		const response = await accountPost({
			locals: authedLocals,
			request: makeRequest({ initial_balance: 5000 }),
		} as any);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain('Compte déjà existant');
	});

	it('GET /api/account/positions retourne 404 si compte absent', async () => {
		mockedService.getAccount.mockResolvedValue(null as any);

		const response = await positionsGet({ locals: authedLocals } as any);
		expect(response.status).toBe(404);
	});

	it('GET /api/account/positions retourne la liste', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);
		mockedService.getOpenPositions.mockResolvedValue([{ id: 'pos-1' }] as any);

		const response = await positionsGet({ locals: authedLocals } as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.positions).toHaveLength(1);
		expect(mockedService.getOpenPositions).toHaveBeenCalledWith('acc-1', authedLocals.supabase);
	});

	it('GET /api/account/transactions applique limit query param', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);
		mockedService.getTransactionHistory.mockResolvedValue([{ id: 'tx-1' }] as any);

		const response = await transactionsGet({
			locals: authedLocals,
			url: new URL('http://localhost/api/account/transactions?limit=10'),
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.transactions).toHaveLength(1);
		expect(mockedService.getTransactionHistory).toHaveBeenCalledWith('acc-1', 10, authedLocals.supabase);
	});

	it('POST /api/account/trades/buy valide un achat', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);
		mockedService.buyStock.mockResolvedValue({ id: 'pos-1' } as any);

		const response = await buyPost({
			locals: authedLocals,
			request: makeRequest({ symbol: 'aapl', quantity: 2, entryPrice: 190 }),
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.message).toContain('Achat effectué');
		expect(mockedService.buyStock).toHaveBeenCalledWith('acc-1', 'AAPL', 2, 190, authedLocals.supabase);
	});

	it('POST /api/account/trades/buy retourne 400 si payload invalide', async () => {
		const response = await buyPost({
			locals: authedLocals,
			request: makeRequest({ symbol: 'AAPL', quantity: 0, entryPrice: 190 }),
		} as any);

		expect(response.status).toBe(400);
	});

	it('POST /api/account/trades/sell valide une vente', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);
		mockedService.sellStock.mockResolvedValue({ position: { id: 'pos-1' }, totalRevenue: 1000 } as any);

		const response = await sellPost({
			locals: authedLocals,
			request: makeRequest({ symbol: 'aapl', quantity: 1, exitPrice: 200 }),
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.message).toContain('Vente effectuée');
		expect(mockedService.sellStock).toHaveBeenCalledWith('acc-1', 'AAPL', 1, 200, authedLocals.supabase);
	});

	it('POST /api/account/trades/sell retourne 400 si payload invalide', async () => {
		const response = await sellPost({
			locals: authedLocals,
			request: makeRequest({ symbol: '', quantity: 1, exitPrice: 200 }),
		} as any);

		expect(response.status).toBe(400);
	});

	it('POST /api/account/deposit fait un dépôt', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);
		mockedService.deposit.mockResolvedValue({ id: 'acc-1', available_balance: 1200 } as any);

		const response = await depositPost({
			locals: authedLocals,
			request: makeRequest({ amount: 200, description: 'Test deposit' }),
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.message).toContain('Dépôt effectué');
		expect(mockedService.deposit).toHaveBeenCalled();
	});

	it('POST /api/account/deposit retourne 400 si montant invalide', async () => {
		const response = await depositPost({
			locals: authedLocals,
			request: makeRequest({ amount: 0 }),
		} as any);

		expect(response.status).toBe(400);
	});

	it('POST /api/account/withdraw fait un retrait', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);
		mockedService.withdraw.mockResolvedValue({ id: 'acc-1', available_balance: 800 } as any);

		const response = await withdrawPost({
			locals: authedLocals,
			request: makeRequest({ amount: 100, description: 'Test withdraw' }),
		} as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.message).toContain('Retrait effectué');
		expect(mockedService.withdraw).toHaveBeenCalled();
	});

	it('POST /api/account/withdraw retourne 404 sans compte', async () => {
		mockedService.getAccount.mockResolvedValue(null as any);

		const response = await withdrawPost({
			locals: authedLocals,
			request: makeRequest({ amount: 100 }),
		} as any);

		expect(response.status).toBe(404);
	});
});
