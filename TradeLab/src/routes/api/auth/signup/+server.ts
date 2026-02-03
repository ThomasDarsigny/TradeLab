import { json, type RequestHandler } from '@sveltejs/kit';
import { createAccount, getAccount } from '$lib/services/accountService';

export const POST: RequestHandler = async ({ locals }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const existingAccount = await getAccount(session.user.id);
        if (existingAccount) {
            return json({ 
                success: true,
                account: existingAccount,
                message: 'Compte existant'
            });
        }

        const account = await createAccount(session.user.id, 100000);

        return json({ 
            success: true, 
            account 
        });
    } catch (error) {
        console.error('Erreur création compte:', error);
        return json({ 
            error: error instanceof Error ? error.message : 'Erreur serveur' 
        }, { status: 500 });
    }
};
