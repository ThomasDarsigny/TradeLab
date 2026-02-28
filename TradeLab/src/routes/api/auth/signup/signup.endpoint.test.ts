import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/accountService', () => ({
	getAccount: vi.fn(),
	createAccount: vi.fn()
}));

vi.mock('$lib/utils/normalize', () => ({
	normalizeAccount: vi.fn((value: any) => value)
}));

import * as accountService from '$lib/services/accountService';
import { POST } from './+server';

const mockedService = vi.mocked(accountService);

const authedLocals = {
	safeGetSession: vi.fn(async () => ({ session: { user: { id: 'user-1' } } })),
	supabase: {}
};

const unauthLocals = {
	safeGetSession: vi.fn(async () => ({ session: null })),
	supabase: {}
};

describe('API auth signup endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('retourne 401 sans session', async () => {
		const response = await POST({ locals: unauthLocals } as any);
		expect(response.status).toBe(401);
	});

	it('retourne compte existant si déjà créé', async () => {
		mockedService.getAccount.mockResolvedValue({ id: 'acc-1' } as any);

		const response = await POST({ locals: authedLocals } as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.message).toContain('Compte existant');
	});

	it('crée un compte si absent', async () => {
		mockedService.getAccount.mockResolvedValue(null as any);
		mockedService.createAccount.mockResolvedValue({ id: 'acc-new' } as any);

		const response = await POST({ locals: authedLocals } as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.account.id).toBe('acc-new');
		expect(mockedService.createAccount).toHaveBeenCalledWith('user-1', 100000, authedLocals.supabase);
	});
});
