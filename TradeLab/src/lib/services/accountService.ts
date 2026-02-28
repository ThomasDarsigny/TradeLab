import { supabase } from '$lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Transaction, Position } from '$lib/types/account';

const getClient = (client?: SupabaseClient) => client ?? supabase;

const CRYPTO_QUOTE_SUFFIXES = ['-USD', '-USDT', '-USDC', '-EUR', '-BTC', '-ETH'];

const isCryptoSymbol = (symbol: string) => {
    const normalized = String(symbol || '').toUpperCase();
    return CRYPTO_QUOTE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

const pad2 = (value: number | string) => String(value).padStart(2, '0');
const dateKey = (year: number, month: number, day: number) => `${year}-${pad2(month)}-${pad2(day)}`;

const getMarketDatePartsNY = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        year: Number(map.year || 0),
        month: Number(map.month || 1),
        day: Number(map.day || 1),
        weekday: map.weekday || 'Mon',
        hour: Number(map.hour || 0),
        minute: Number(map.minute || 0),
    };
};

const getMarketClockNY = (date = new Date()) => {
    const map = getMarketDatePartsNY(date);
    return {
        weekday: map.weekday,
        hour: map.hour,
        minute: map.minute,
    };
};

const nthWeekdayOfMonth = (year: number, month: number, weekday: number, nth: number) => {
    const firstDayDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const delta = (weekday - firstDayDow + 7) % 7;
    return 1 + delta + (nth - 1) * 7;
};

const lastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
    const lastDate = new Date(Date.UTC(year, month, 0));
    const lastDay = lastDate.getUTCDate();
    const lastDow = lastDate.getUTCDay();
    const delta = (lastDow - weekday + 7) % 7;
    return lastDay - delta;
};

const observedFixedHoliday = (year: number, month: number, day: number) => {
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (dow === 6) return { month, day: day - 1 };
    if (dow === 0) return { month, day: day + 1 };
    return { month, day };
};

const calculateEasterSunday = (year: number) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
};

const getNyseHolidayKeys = (year: number) => {
    const holidays: string[] = [];

    const newYear = observedFixedHoliday(year, 1, 1);
    holidays.push(dateKey(year, newYear.month, newYear.day));

    holidays.push(dateKey(year, 1, nthWeekdayOfMonth(year, 1, 1, 3)));
    holidays.push(dateKey(year, 2, nthWeekdayOfMonth(year, 2, 1, 3)));

    const easter = calculateEasterSunday(year);
    const easterSunday = new Date(Date.UTC(year, easter.month - 1, easter.day));
    const goodFriday = new Date(easterSunday);
    goodFriday.setUTCDate(easterSunday.getUTCDate() - 2);
    holidays.push(dateKey(year, goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate()));

    holidays.push(dateKey(year, 5, lastWeekdayOfMonth(year, 5, 1)));

    const juneteenth = observedFixedHoliday(year, 6, 19);
    holidays.push(dateKey(year, juneteenth.month, juneteenth.day));

    const independenceDay = observedFixedHoliday(year, 7, 4);
    holidays.push(dateKey(year, independenceDay.month, independenceDay.day));

    holidays.push(dateKey(year, 9, nthWeekdayOfMonth(year, 9, 1, 1)));
    holidays.push(dateKey(year, 11, nthWeekdayOfMonth(year, 11, 4, 4)));

    const christmas = observedFixedHoliday(year, 12, 25);
    holidays.push(dateKey(year, christmas.month, christmas.day));

    return new Set(holidays);
};

const isNyseHoliday = (date = new Date()) => {
    const { year, month, day } = getMarketDatePartsNY(date);
    return getNyseHolidayKeys(year).has(dateKey(year, month, day));
};

const isUsStockMarketOpenNow = (date = new Date()) => {
    const { weekday, hour, minute } = getMarketClockNY(date);
    const isBusinessDay = !['Sat', 'Sun'].includes(weekday);
    if (!isBusinessDay) return false;
    if (isNyseHoliday(date)) return false;

    const currentMinutes = hour * 60 + minute;
    const openMinutes = 9 * 60 + 30;
    const closeMinutes = 16 * 60;
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
};

const isSellAllowedForSymbolNow = (symbol: string, date = new Date()) => {
    if (isCryptoSymbol(symbol)) return true;
    return isUsStockMarketOpenNow(date);
};

async function calculateOpenPositionsMarketValue(accountId: string, client?: SupabaseClient) {
    const db = getClient(client);
    const { data, error } = await db
        .from('positions')
        .select('quantity, current_price')
        .eq('account_id', accountId)
        .eq('status', 'open')
        .gt('quantity', 0);

    if (error) {
        throw new Error(`Erreur lors du calcul de la valeur des positions: ${error.message}`);
    }

    return (data ?? []).reduce(
        (total: number, pos: any) => total + Number(pos.quantity) * Number(pos.current_price),
        0,
    );
}

export async function syncCurrentBalanceFromAvailableAndPositions(accountId: string, client?: SupabaseClient) {
    const db = getClient(client);
    const { data: account, error: accountError } = await db
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (accountError) {
        throw new Error(`Erreur lors de la lecture du compte: ${accountError.message}`);
    }

    const positionsValue = await calculateOpenPositionsMarketValue(accountId, client);
    const normalizedAvailableBalance = Math.max(0, Number(account.available_balance));
    const nextCurrentBalance = normalizedAvailableBalance + positionsValue;

    const { data: updated, error: updateError } = await db
        .from('accounts')
        .update({
            available_balance: normalizedAvailableBalance,
            current_balance: nextCurrentBalance,
            updated_at: new Date().toISOString(),
        })
        .eq('id', accountId)
        .select()
        .single();

    if (updateError) {
        throw new Error(`Erreur lors de la synchronisation du solde courant: ${updateError.message}`);
    }

    return updated as Account;
}

//  GESTION DES COMPTES ------------------------------------------------

/**
 * Crée un nouveau compte de trading pour un utilisateur
 */
export async function createAccount(userId: string, initialBalance: number = 100000, client?: SupabaseClient) {
    const db = getClient(client);
    const { data, error } = await db
        .from('accounts')
        .insert({
            user_id: userId,
            initial_balance: initialBalance,
            current_balance: initialBalance,
            available_balance: initialBalance,
            total_trades: 0,
            total_gains: 0,
            win_rate: 0,
        })
        .select()
        .single();

    if (error) throw new Error(`Erreur lors de la création du compte: ${error.message}`);
    return data as Account;
}

/**
 * Récupère le compte d'un utilisateur
 */
export async function getAccount(userId: string, client?: SupabaseClient) {
    const db = getClient(client);
    const { data, error } = await db
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return syncCurrentBalanceFromAvailableAndPositions(data.id, client);
}

/**
 * MAJ le solde d'un compte
 */
export async function updateBalance(accountId: string, newBalance: number, client?: SupabaseClient) {
    const db = getClient(client);
    const { data, error } = await db
        .from('accounts')
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', accountId)
        .select()
        .single();

    if (error) throw new Error(`Erreur lors de la mise à jour du solde: ${error.message}`);
    return data as Account;
}

/**
 * MAJ le solde disponible
 */
export async function updateAvailableBalance(accountId: string, amount: number, client?: SupabaseClient) {
    if (!Number.isFinite(Number(amount))) {
        throw new Error('Montant du solde disponible invalide.');
    }

    if (Number(amount) < 0) {
        throw new Error('Le solde disponible ne peut pas être inférieur à 0$.');
    }

    const db = getClient(client);
    const { data, error } = await db
        .from('accounts')
        .update({ available_balance: amount, updated_at: new Date().toISOString() })
        .eq('id', accountId)
        .select()
        .single();

    if (error) throw new Error(`Erreur lors de la mise à jour du solde disponible: ${error.message}`);
    return data as Account;
}

//  GESTION DES TRANSACTIONS ------------------------------------------------

/**
 * Effectue un dépôt d'argent
 */
export async function deposit(accountId: string, amount: number, description = 'Dépôt', client?: SupabaseClient) {
    const db = getClient(client);
    const { data: account, error: fetchError } = await db
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (fetchError) throw fetchError;

    await addTransaction(accountId, 'deposit', amount, description, undefined, client);

    const newBalance = Number(account.current_balance) + amount;
    const newAvailable = Number(account.available_balance) + amount;

    await updateBalance(accountId, newBalance, client);
    await updateAvailableBalance(accountId, newAvailable, client);
    return syncCurrentBalanceFromAvailableAndPositions(accountId, client);
}

/**
 * Effectuer un retrait d'argent
 */
export async function withdraw(accountId: string, amount: number, description = 'Retrait', client?: SupabaseClient) {
    const db = getClient(client);
    const { data: account, error: fetchError } = await db
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (fetchError) throw fetchError;

    if (Number(account.available_balance) < amount) {
        throw new Error(`Solde insuffisant. Disponible: ${account.available_balance}, Demandé: ${amount}`);
    }

    await addTransaction(accountId, 'withdrawal', amount, description, undefined, client);

    const newBalance = Number(account.current_balance) - amount;
    const newAvailable = Number(account.available_balance) - amount;
    
    await updateBalance(accountId, newBalance, client);
    await updateAvailableBalance(accountId, newAvailable, client);
    return syncCurrentBalanceFromAvailableAndPositions(accountId, client);
}

/**
 * Enregistrer une transaction
 */
export async function addTransaction(
    accountId: string,
    type: 'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend',
    amount: number,
    description: string,
    metadata?: Record<string, any>,
    client?: SupabaseClient
) {
    const db = getClient(client);
    const { data, error } = await db
        .from('transactions')
        .insert({
            account_id: accountId,
            type,
            amount,
            description,
            metadata: metadata || {},
        })
        .select()
        .single();

    if (error) throw new Error(`Erreur lors de l'enregistrement de la transaction: ${error.message}`);
    return data as Transaction;
}

/**
 * Récupèrer l'historique des transactions
 */
export async function getTransactionHistory(accountId: string, limit = 50, client?: SupabaseClient) {
    const db = getClient(client);
    const { data, error } = await db
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data as Transaction[];
}

//  GESTION DES POSITIONS ------------------------------------------------

/**
 * Achèter une action
 */
export async function buyStock(
    accountId: string,
    symbol: string,
    quantity: number,
    entryPrice: number,
    client?: SupabaseClient
) {
    const totalCost = quantity * entryPrice;

    const db = getClient(client);
    const { data: account, error: fetchError } = await db
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (fetchError) throw fetchError;

    if (Number(account.available_balance) < totalCost) {
        throw new Error(`Solde insuffisant. Nécessaire: ${totalCost}, Disponible: ${account.available_balance}`);
    }

    const { data: existingPosition } = await db
        .from('positions')
        .select('*')
        .eq('account_id', accountId)
        .eq('symbol', symbol)
        .eq('status', 'open')
        .single();

    let position;

    if (existingPosition) {
        const newQuantity = existingPosition.quantity + quantity;
        const newEntryPrice =
            (existingPosition.quantity * existingPosition.entry_price + totalCost) / newQuantity;

        const { data: updated, error } = await db
            .from('positions')
            .update({
                quantity: newQuantity,
                entry_price: newEntryPrice,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existingPosition.id)
            .select()
            .single();

        if (error) throw error;
        position = updated;
    } else {
        const { data: created, error } = await db
            .from('positions')
            .insert({
                account_id: accountId,
                symbol,
                quantity,
                entry_price: entryPrice,
                current_price: entryPrice,
                status: 'open',
            })
            .select()
            .single();

        if (error) throw error;
        position = created;
    }

    await addTransaction(accountId, 'buy', totalCost, `Achat de ${quantity} ${symbol}`, {
        symbol,
        quantity,
        price: entryPrice,
    }, client);

    const newAvailable = Number(account.available_balance) - totalCost;
    
    await updateAvailableBalance(accountId, newAvailable, client);
    await syncCurrentBalanceFromAvailableAndPositions(accountId, client);

    return position;
}

/**
 * Vendre une action
 */
export async function sellStock(
    accountId: string,
    symbol: string,
    quantity: number,
    exitPrice: number,
    client?: SupabaseClient
) {
    if (!isSellAllowedForSymbolNow(symbol)) {
        throw new Error(`Vente refusée hors heures de marché pour ${symbol}.`);
    }

    const db = getClient(client);
    const { data: position, error: posError } = await db
        .from('positions')
        .select('*')
        .eq('account_id', accountId)
        .eq('symbol', symbol)
        .eq('status', 'open')
        .single();

    if (posError) throw new Error(`Position non trouvée pour ${symbol}`);

    if (position.quantity < quantity) {
        throw new Error(`Quantité insuffisante. Possédé: ${position.quantity}, À vendre: ${quantity}`);
    }

    const totalRevenue = quantity * exitPrice;
    const costBasis = quantity * position.entry_price;
    const profitLoss = totalRevenue - costBasis;

    const { data: account, error: fetchError } = await db
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (fetchError) throw fetchError;

    if (position.quantity === quantity) {
        await db
            .from('positions')
            .update({
                quantity: 0,
                status: 'closed',
                closed_at: new Date().toISOString(),
                profit_loss: profitLoss,
            })
            .eq('id', position.id);
    } else {
        const newQuantity = position.quantity - quantity;
        await db
            .from('positions')
            .update({
                quantity: newQuantity,
                updated_at: new Date().toISOString(),
            })
            .eq('id', position.id);
    }

    await addTransaction(accountId, 'sell', totalRevenue, `Vente de ${quantity} ${symbol}`, {
        symbol,
        quantity,
        price: exitPrice,
        profit_loss: profitLoss,
    }, client);

    const newAvailable = Number(account.available_balance) + totalRevenue;
    
    await updateAvailableBalance(accountId, newAvailable, client);
    await syncCurrentBalanceFromAvailableAndPositions(accountId, client);

    return {
        position,
        profitLoss,
        totalRevenue,
    };
}

/**
 * Récupèrer les positions ouvertes
 */
export async function getOpenPositions(accountId: string, client?: SupabaseClient) {
    const db = getClient(client);
    const { data, error } = await db
        .from('positions')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'open')
        .gt('quantity', 0);

    if (error) throw error;
    return data as Position[];
}

/**
 * Calculer la valeur totale des positions ouvertes
 */
export async function calculatePositionValue(accountId: string, client?: SupabaseClient) {
    const positions = await getOpenPositions(accountId, client);
    return positions.reduce((total, pos) => total + pos.quantity * pos.current_price, 0);
}

/**
 * MAJ le prix actuel des positions
 */
export async function updatePositionPrice(positionId: string, currentPrice: number, client?: SupabaseClient) {
    const db = getClient(client);
    const { data, error } = await db
        .from('positions')
        .update({ current_price: currentPrice })
        .eq('id', positionId)
        .select()
        .single();

    if (error) throw error;
    await syncCurrentBalanceFromAvailableAndPositions(data.account_id, client);
    return data as Position;
}

//  STATISTIQUES ------------------------------------------------

/**
 * Calculer les stats du compte
 */
export async function calculateAccountStats(accountId: string, client?: SupabaseClient) {
    const db = getClient(client);
    const { data: account } = await db
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    const { data: transactions } = await db
        .from('transactions')
        .select('*')
        .eq('account_id', accountId);

    const buyTransactions = (transactions as Transaction[])?.filter((t) => t.type === 'buy') || [];
    const sellTransactions = (transactions as Transaction[])?.filter((t) => t.type === 'sell') || [];

    const totalBought = buyTransactions.reduce((sum: number, t) => sum + Number(t.amount), 0);
    const totalSold = sellTransactions.reduce((sum: number, t) => sum + Number(t.amount), 0);
    
    const realizedGains = totalSold - totalBought;

    const openPositions = await getOpenPositions(accountId, client);
    const unrealizedGains = openPositions.reduce((total: number, pos) => {
        const invested = Number(pos.quantity) * Number(pos.entry_price);
        const current = Number(pos.quantity) * Number(pos.current_price);
        return total + (current - invested);
    }, 0);

    const totalGains = realizedGains + unrealizedGains;

    const gainPercent = totalBought > 0 ? (totalGains / totalBought) * 100 : 0;

    const { data: closedTrades } = await db
        .from('positions')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'closed');

    const profitableTrades = (closedTrades as Position[])?.filter((t) => t.profit_loss && t.profit_loss > 0) || [];
    const winRate = closedTrades && closedTrades.length > 0 
        ? (profitableTrades.length / closedTrades.length) * 100 
        : 0;

    return {
        initialBalance: Number(account.initial_balance),
        currentBalance: Number(account.current_balance),
        availableBalance: Number(account.available_balance),
        positionValue: await calculatePositionValue(accountId, client),
        totalValue: Number(account.current_balance) + (await calculatePositionValue(accountId, client)),
        totalGains,
        gainPercent,
        totalTrades: closedTrades?.length || 0,
        winRate,
        roi: ((Number(account.current_balance) - Number(account.initial_balance)) / Number(account.initial_balance)) * 100,
    };
}