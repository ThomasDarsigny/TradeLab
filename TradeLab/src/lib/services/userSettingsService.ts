import { supabase } from '$lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserSettings {
    id: string;
    user_id: string;
    trading_bot_enabled: boolean;
    bot_symbols?: string;
    created_at: string;
    updated_at: string;
}

export type UserSettingsUpdate = Partial<Pick<UserSettings, 'trading_bot_enabled' | 'bot_symbols'>>;

const getClient = (client?: SupabaseClient) => client ?? supabase;

export async function getUserSettings(userId: string, client?: SupabaseClient) {
    const db = getClient(client);
    const { data, error } = await db
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data as UserSettings | null;
}

export async function upsertUserSettings(
    userId: string,
    updates: UserSettingsUpdate,
    client?: SupabaseClient
) {
    const db = getClient(client);
    const payload = {
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await db
        .from('user_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data as UserSettings;
}
