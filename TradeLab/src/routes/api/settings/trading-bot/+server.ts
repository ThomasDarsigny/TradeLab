import { json, type RequestHandler } from '@sveltejs/kit';
import { getUserSettings, upsertUserSettings } from '$lib/services/userSettingsService';

export const GET: RequestHandler = async ({ locals }) => {
    try {
        const { session } = await locals.safeGetSession();
        if (!session) {
            return json({ error: 'Non authentifie' }, { status: 401 });
        }

        const settings = await getUserSettings(session.user.id, locals.supabase);
        return json({
            enabled: settings?.trading_bot_enabled ?? false
        });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ locals, request }) => {
    try {
        const { session } = await locals.safeGetSession();
        if (!session) {
            return json({ error: 'Non authentifie' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const enabled = Boolean(body?.enabled);

        const updated = await upsertUserSettings(session.user.id, {
            trading_bot_enabled: enabled
        }, locals.supabase);

        return json({
            enabled: updated.trading_bot_enabled
        });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
    }
};
