import { json, type RequestHandler } from '@sveltejs/kit';
import {
    deposit,
    withdraw,
    getTransactionHistory,
} from '$lib/services/accountService';
import { getAccount } from '$lib/services/accountService';

// POST /api/account/transactions/deposit
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { amount, description } = await request.json();

        if (!amount || amount <= 0) {
            return json({ error: 'Montant invalide' }, { status: 400 });
        }

        const account = await getAccount(session.user.id);

        if (!account) {
            return json({ error: 'Compte non trouvé' }, { status: 404 });
        }

        const updatedAccount = await deposit(account.id, amount, description || 'Dépôt');

        return json({
            message: 'Dépôt effectué avec succès',
            account: updatedAccount,
        });
    } catch (error) {
        console.error('Erreur dépôt:', error);
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
