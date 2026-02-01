import { supabase } from '$lib/supabaseClient';
import type { Account, Transaction, Position } from '$lib/types/account';

//  GESTION DES COMPTES ------------------------------------------------

/**
 * Crée un nouveau compte de trading pour un utilisateur
 * @param userId
 * @param initialBalance
 */
export async function createAccount(userId: string, initialBalance: number = 100000) {
    const { data, error } = await supabase
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
export async function getAccount(userId: string) {
    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Account | null;
}

/**
 * MAJ le solde d'un compte
 */
export async function updateBalance(accountId: string, newBalance: number) {
    const { data, error } = await supabase
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
export async function updateAvailableBalance(accountId: string, amount: number) {
    const { data, error } = await supabase
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
export async function deposit(accountId: string, amount: number, description = 'Dépôt') {
    const { data: account, error: fetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (fetchError) throw fetchError;

    await addTransaction(accountId, 'deposit', amount, description);

    const newBalance = account.current_balance + amount;
    return updateBalance(accountId, newBalance);
}

/**
 * Effectuer un retrait d'argent
 */
export async function withdraw(accountId: string, amount: number, description = 'Retrait') {
    const { data: account, error: fetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (fetchError) throw fetchError;

    if (account.available_balance < amount) {
        throw new Error(`Solde insuffisant. Disponible: ${account.available_balance}, Demandé: ${amount}`);
    }

    await addTransaction(accountId, 'withdrawal', amount, description);

    const newBalance = account.current_balance - amount;
    const newAvailable = account.available_balance - amount;
    
    await updateBalance(accountId, newBalance);
    return updateAvailableBalance(accountId, newAvailable);
}

/**
 * Enregistrer une transaction
 */
export async function addTransaction(
    accountId: string,
    type: 'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend',
    amount: number,
    description: string,
    metadata?: Record<string, any>
) {
    const { data, error } = await supabase
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
export async function getTransactionHistory(accountId: string, limit = 50) {
    const { data, error } = await supabase
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
    entryPrice: number
) {
    const totalCost = quantity * entryPrice;

    const { data: account, error: fetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (fetchError) throw fetchError;

    if (account.available_balance < totalCost) {
        throw new Error(`Solde insuffisant. Nécessaire: ${totalCost}, Disponible: ${account.available_balance}`);
    }

    const { data: existingPosition } = await supabase
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

        const { data: updated, error } = await supabase
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
        const { data: created, error } = await supabase
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
    });

    const newBalance = account.current_balance - totalCost;
    const newAvailable = account.available_balance - totalCost;
    
    await updateBalance(accountId, newBalance);
    await updateAvailableBalance(accountId, newAvailable);

    return position;
}

/**
 * Vendre une action
 */
export async function sellStock(
    accountId: string,
    symbol: string,
    quantity: number,
    exitPrice: number
) {
    const { data: position, error: posError } = await supabase
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

    const { data: account, error: fetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (fetchError) throw fetchError;

    if (position.quantity === quantity) {
        await supabase
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
        await supabase
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
    });

    const newBalance = account.current_balance + totalRevenue;
    const newAvailable = account.available_balance + totalRevenue;
    
    await updateBalance(accountId, newBalance);
    await updateAvailableBalance(accountId, newAvailable);

    return {
        position,
        profitLoss,
        totalRevenue,
    };
}

/**
 * Récupèrer les positions ouvertes
 */
export async function getOpenPositions(accountId: string) {
    const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'open');

    if (error) throw error;
    return data as Position[];
}

/**
 * Calculer la valeur totale des positions ouvertes
 */
export async function calculatePositionValue(accountId: string) {
    const positions = await getOpenPositions(accountId);
    return positions.reduce((total, pos) => total + pos.quantity * pos.current_price, 0);
}

/**
 * MAJ le prix actuel des positions
 */
export async function updatePositionPrice(positionId: string, currentPrice: number) {
    const { data, error } = await supabase
        .from('positions')
        .update({ current_price: currentPrice })
        .eq('id', positionId)
        .select()
        .single();

    if (error) throw error;
    return data as Position;
}

//  STATISTIQUES ------------------------------------------------

/**
 * Calculer les stats du compte
 */
export async function calculateAccountStats(accountId: string) {
    const { data: account } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId);

    const buyTransactions = (transactions as Transaction[])?.filter((t) => t.type === 'buy') || [];
    const sellTransactions = (transactions as Transaction[])?.filter((t) => t.type === 'sell') || [];

    const totalInvested = buyTransactions.reduce((sum: number, t) => sum + t.amount, 0);
    const totalReturned = sellTransactions.reduce((sum: number, t) => sum + t.amount, 0);
    const totalGains = totalReturned - totalInvested;

    const gainPercent = totalInvested > 0 ? (totalGains / totalInvested) * 100 : 0;

    const { data: closedTrades } = await supabase
        .from('positions')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'closed');

    const profitableTrades = (closedTrades as Position[])?.filter((t) => t.profit_loss && t.profit_loss > 0) || [];
    const winRate = closedTrades && closedTrades.length > 0 
        ? (profitableTrades.length / closedTrades.length) * 100 
        : 0;

    return {
        initialBalance: account.initial_balance,
        currentBalance: account.current_balance,
        availableBalance: account.available_balance,
        positionValue: await calculatePositionValue(accountId),
        totalValue: account.current_balance + (await calculatePositionValue(accountId)),
        totalGains,
        gainPercent,
        totalTrades: closedTrades?.length || 0,
        winRate,
        roi: ((account.current_balance - account.initial_balance) / account.initial_balance) * 100,
    };
}