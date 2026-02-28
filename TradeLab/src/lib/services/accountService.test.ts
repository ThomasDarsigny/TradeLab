import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/supabaseClient', () => ({
	supabase: {},
}));

import { sellStock, updateAvailableBalance } from '$lib/services/accountService';

describe('accountService mock tests', () => {
	beforeEach(() => {
		vi.useRealTimers();
	});

	it('refuse un solde disponible négatif', async () => {
		await expect(updateAvailableBalance('acc-1', -1, {} as any)).rejects.toThrow(
			'Le solde disponible ne peut pas être inférieur à 0$.'
		);
	});

	it('bloque la vente d’actions hors horaires de marché US', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-27T22:10:00.000Z'));

		await expect(
			sellStock('acc-1', 'AAPL', 1, 200, {} as any)
		).rejects.toThrow('Vente refusée hors heures de marché pour AAPL.');
	});

	it('autorise le flux crypto 24/7 (passe le garde-fou horaire)', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-28T03:00:00.000Z'));

		const dbError = new Error('DB call reached');
		const fakeClient = {
			from: vi.fn(() => {
				throw dbError;
			}),
		};

		await expect(sellStock('acc-1', 'BTC-USD', 1, 80000, fakeClient as any)).rejects.toThrow(
			'DB call reached'
		);
	});
});
