import { json, type RequestHandler } from '@sveltejs/kit';
import {
    deposit,
    withdraw,
    getTransactionHistory,
    getAccount,
    createAccount,
} from '$lib/services/accountService';
import { normalizeAccount } from '$lib/utils/normalize';

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

        const account = await getAccount(session.user.id, locals.supabase);
        const ensuredAccount = account ?? await createAccount(session.user.id, 100000, locals.supabase);

        const updatedAccount = await deposit(ensuredAccount.id, amount, description || 'Dépôt', locals.supabase);

        return json({
            message: 'Dépôt effectué avec succès',
            account: normalizeAccount(updatedAccount),
        });
    } catch (error) {
        console.error('Erreur dépôt:', error);
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
