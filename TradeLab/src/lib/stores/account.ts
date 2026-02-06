import { writable } from 'svelte/store';
import type { Account } from '$lib/types/account';

type AccountInput = Account | Record<string, unknown> | null | undefined;

const toNumber = (value: unknown) => {
    if (typeof value === 'number') return value;
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeAccount = (raw: AccountInput): Account | null => {
    if (!raw) return null;
    const account = raw as Account;
    return {
        ...account,
        initial_balance: toNumber(account.initial_balance),
        current_balance: toNumber(account.current_balance),
        available_balance: toNumber(account.available_balance),
        total_trades: toNumber(account.total_trades),
        total_gains: toNumber(account.total_gains),
        win_rate: toNumber(account.win_rate),
    };
};

export const accountStore = writable<Account | null>(null);

export const setAccount = (raw: AccountInput) => {
    accountStore.set(normalizeAccount(raw));
};

export const clearAccount = () => {
    accountStore.set(null);
};
