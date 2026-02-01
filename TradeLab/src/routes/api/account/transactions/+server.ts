import { json, type RequestHandler } from '@sveltejs/kit';
import {
    getTransactionHistory,
    getAccount,
} from '$lib/services/accountService';

// GET /api/account/transactions
export const GET: RequestHandler = async ({ locals, url }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const account = await getAccount(session.user.id);

        if (!account) {
            return json({ error: 'Compte non trouvé' }, { status: 404 });
        }

        const limit = parseInt(url.searchParams.get('limit') || '50');
        const transactions = await getTransactionHistory(account.id, limit);

        return json({
            transactions,
        });
    } catch (error) {
        console.error('Erreur récupération transactions:', error);
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
