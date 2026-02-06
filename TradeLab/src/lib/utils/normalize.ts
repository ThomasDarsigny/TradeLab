import type { Account, Position, Transaction } from '$lib/types/account';

type Nullable<T> = T | null | undefined;

const toNumber = (value: unknown) => {
    if (typeof value === 'number') return value;
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeAccount = (account: Nullable<Account>): Account | null => {
    if (!account) return null;
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

export const normalizePosition = (position: Nullable<Position>): Position | null => {
    if (!position) return null;
    return {
        ...position,
        quantity: toNumber(position.quantity),
        entry_price: toNumber(position.entry_price),
        current_price: toNumber(position.current_price),
        profit_loss: position.profit_loss === undefined ? undefined : toNumber(position.profit_loss),
    };
};

export const normalizePositions = (positions: Position[] = []) => {
    return positions.map((position) => normalizePosition(position) as Position);
};

export const normalizeTransaction = (transaction: Nullable<Transaction>): Transaction | null => {
    if (!transaction) return null;
    return {
        ...transaction,
        amount: toNumber(transaction.amount),
    };
};

export const normalizeTransactions = (transactions: Transaction[] = []) => {
    return transactions.map((transaction) => normalizeTransaction(transaction) as Transaction);
};
