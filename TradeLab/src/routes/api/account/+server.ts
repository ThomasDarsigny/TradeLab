import { json, type RequestHandler } from '@sveltejs/kit';
import { getAccount, calculateAccountStats, createAccount } from '$lib/services/accountService';
import { normalizeAccount } from '$lib/utils/normalize';

// GET /api/account - Récupérer les infos du compte
export const GET: RequestHandler = async ({ locals }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const account = await getAccount(session.user.id, locals.supabase);

        if (!account) {
            return json({ error: 'Compte non trouvé' }, { status: 404 });
        }

        const stats = await calculateAccountStats(account.id, locals.supabase);

        return json({
            account: normalizeAccount(account),
            stats,
        });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};

// POST /api/account - Créer un nouveau compte
export const POST: RequestHandler = async ({ locals, request }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const existingAccount = await getAccount(session.user.id, locals.supabase);
        if (existingAccount) {
            return json({ error: 'Compte déjà existant' }, { status: 400 });
        }

        const body = await request.json();
        const initialBalance = body.initial_balance || 100000;

        const account = await createAccount(session.user.id, initialBalance, locals.supabase);

        return json({ 
            success: true,
            account: normalizeAccount(account),
        });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
