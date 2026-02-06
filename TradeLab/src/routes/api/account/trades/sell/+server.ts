import { json, type RequestHandler } from '@sveltejs/kit';
import {
    sellStock,
    getAccount,
} from '$lib/services/accountService';
import { normalizePosition } from '$lib/utils/normalize';

// POST /api/account/trades/sell
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { symbol, quantity, exitPrice } = await request.json();

        if (!symbol || !quantity || !exitPrice) {
            return json({ error: 'Paramètres invalides' }, { status: 400 });
        }

        if (quantity <= 0 || exitPrice <= 0) {
            return json({ error: 'Quantité et prix doivent être positifs' }, { status: 400 });
        }

        const account = await getAccount(session.user.id, locals.supabase);

        if (!account) {
            return json({ error: 'Compte non trouvé' }, { status: 404 });
        }

        const result = await sellStock(account.id, symbol.toUpperCase(), quantity, exitPrice, locals.supabase);

        return json({
            message: 'Vente effectuée avec succès',
            ...result,
            position: normalizePosition(result.position),
        });
    } catch (error) {
        console.error('Erreur vente:', error);
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
