import { json, type RequestHandler } from '@sveltejs/kit';
import { createAccount, getAccount } from '$lib/services/accountService';
import { normalizeAccount } from '$lib/utils/normalize';

export const POST: RequestHandler = async ({ locals }) => {
    try {
        const { session } = await locals.safeGetSession();

        if (!session) {
            return json({ error: 'Non authentifié' }, { status: 401 });
        }

        const existingAccount = await getAccount(session.user.id, locals.supabase);
        if (existingAccount) {
            return json({ 
                success: true,
                account: normalizeAccount(existingAccount),
                message: 'Compte existant'
            });
        }

        const account = await createAccount(session.user.id, 100000, locals.supabase);

        return json({ 
            success: true, 
            account: normalizeAccount(account),
        });
    } catch (error) {
        console.error('Erreur création compte:', error);
        return json({ 
            error: error instanceof Error ? error.message : 'Erreur serveur' 
        }, { status: 500 });
    }
};
