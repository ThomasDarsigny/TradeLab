import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const watchlist = writable<string[]>([]);
export const recentSymbols = writable<string[]>([]);

const WATCHLIST_KEY = 'tradelab_watchlist';
const RECENT_KEY = 'tradelab_recent_symbols';

export function initializeMarketStores() {
    if (!browser) return;

    const savedWatchlist = localStorage.getItem(WATCHLIST_KEY);
    const savedRecent = localStorage.getItem(RECENT_KEY);

    if (savedWatchlist) {
        watchlist.set(JSON.parse(savedWatchlist));
    }
    if (savedRecent) {
        recentSymbols.set(JSON.parse(savedRecent));
    }
}

export function addToWatchlist(symbol: string) {
    watchlist.update(items => {
        const updated = [...new Set([...items, symbol.toUpperCase()])];
        if (browser) {
            localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
        }
        return updated;
    });
}

export function removeFromWatchlist(symbol: string) {
    watchlist.update(items => {
        const updated = items.filter(s => s !== symbol.toUpperCase());
        if (browser) {
            localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
        }
        return updated;
    });
}

export function isInWatchlist(symbol: string): Promise<boolean> {
    return new Promise(resolve => {
        watchlist.subscribe(items => {
            resolve(items.includes(symbol.toUpperCase()));
        });
    });
}

export function addToRecent(symbol: string) {
    recentSymbols.update(items => {
        const updated = [symbol.toUpperCase(), ...items.filter(s => s !== symbol.toUpperCase())];
        const limited = updated.slice(0, 20);
        if (browser) {
            localStorage.setItem(RECENT_KEY, JSON.stringify(limited));
        }
        return limited;
    });
}

export function clearRecent() {
    recentSymbols.set([]);
    if (browser) {
        localStorage.removeItem(RECENT_KEY);
    }
}
