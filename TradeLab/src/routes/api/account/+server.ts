import { json, type RequestHandler } from '@sveltejs/kit';
import { getAccount, calculateAccountStats } from '$lib/services/accountService';

// GET /api/account - Récupérer les infos du compte
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

        const stats = await calculateAccountStats(account.id);

        return json({
            account,
            stats,
        });
    } catch (error) {
        console.error('Erreur API account:', error);
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
