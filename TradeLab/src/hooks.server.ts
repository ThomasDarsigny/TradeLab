import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

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
        const { data: { session } } = await event.locals.supabase.auth.getSession();
        if (!session) return { session: null, user: null };
        return { session, user: session.user };
    };

    const publicRoutes = ['/auth', '/login', '/signup'];
    const isPublicRoute = publicRoutes.some(route => event.url.pathname.startsWith(route));
    const isApiRoute = event.url.pathname.startsWith('/api/');

    if (isPublicRoute || isApiRoute) {
        return resolve(event);
    }

    const { session } = await event.locals.safeGetSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    return resolve(event);
};