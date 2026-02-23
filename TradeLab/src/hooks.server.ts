import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => event.cookies.getAll(),
            setAll: (cookiesToSet) => {
                cookiesToSet.forEach(({ name, value, options }) => {
                    event.cookies.set(name, value, { ...options, path: options.path || '/' });
                });
            },
        },
    });

    event.locals.safeGetSession = async () => {
        const {
            data: { session }
        } = await event.locals.supabase.auth.getSession();

        if (!session) return { session: null, user: null };

        const {
            data: { user },
            error
        } = await event.locals.supabase.auth.getUser();

        if (error || !user) {
            return { session: null, user: null };
        }

        return { session, user };
    };

    const publicRoutes = ['/auth', '/login', '/signup'];
    const isPublicRoute = publicRoutes.some(route => event.url.pathname.startsWith(route));
    const isApiRoute = event.url.pathname.startsWith('/api/');
    const isAuthApiRoute = event.url.pathname.startsWith('/api/auth/');

    if (isPublicRoute || isAuthApiRoute) {
        return resolve(event);
    }

    const { session } = await event.locals.safeGetSession();
    if (!session) {
        if (isApiRoute) {
            return json({ error: 'Non authentifie' }, { status: 401 });
        }
        throw redirect(303, '/login');
    }

    return resolve(event);
};