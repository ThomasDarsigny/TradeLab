import { json, type RequestHandler } from '@sveltejs/kit';
import {
    withdraw,
    getAccount,
} from '$lib/services/accountService';
import { normalizeAccount } from '$lib/utils/normalize';

// POST /api/account/transactions/withdraw
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

        if (!account) {
            return json({ error: 'Compte non trouvé' }, { status: 404 });
        }

        const updatedAccount = await withdraw(account.id, amount, description || 'Retrait', locals.supabase);

        return json({
            message: 'Retrait effectué avec succès',
            account: normalizeAccount(updatedAccount),
        });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
