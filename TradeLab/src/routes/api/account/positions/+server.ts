import { json, type RequestHandler } from '@sveltejs/kit';
import {
    getOpenPositions,
    getTransactionHistory,
    getAccount,
} from '$lib/services/accountService';

// GET /api/account/positions
export const GET: RequestHandler = async ({ locals }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const account = await getAccount(session.user.id);

        if (!account) {
            return json({ error: 'Compte non trouvé' }, { status: 404 });
        }

        const positions = await getOpenPositions(account.id);

        return json({
            positions,
        });
    } catch (error) {
        console.error('Erreur récupération positions:', error);
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
