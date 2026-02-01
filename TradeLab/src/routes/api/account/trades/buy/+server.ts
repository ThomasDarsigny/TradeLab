import { json, type RequestHandler } from '@sveltejs/kit';
import {
    buyStock,
    getAccount,
} from '$lib/services/accountService';

// POST /api/account/trades/buy
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { symbol, quantity, entryPrice } = await request.json();

        if (!symbol || !quantity || !entryPrice) {
            return json({ error: 'Paramètres invalides' }, { status: 400 });
        }

        if (quantity <= 0 || entryPrice <= 0) {
            return json({ error: 'Quantité et prix doivent être positifs' }, { status: 400 });
        }

        const account = await getAccount(session.user.id);

        if (!account) {
            return json({ error: 'Compte non trouvé' }, { status: 404 });
        }

        const position = await buyStock(account.id, symbol.toUpperCase(), quantity, entryPrice);

        return json({
            message: 'Achat effectué avec succès',
            position,
        });
    } catch (error) {
        console.error('Erreur achat:', error);
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
