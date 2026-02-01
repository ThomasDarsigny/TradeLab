export interface Account {
    id: string;
    user_id: string;
    initial_balance: number;
    current_balance: number;
    available_balance: number;
    total_trades: number;
    total_gains: number;
    win_rate: number;
    created_at: string;
    updated_at: string;
}

export interface Transaction {
    id: string;
    account_id: string;
    type: 'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend';
    amount: number;
    description: string;
    created_at: string;
    metadata?: Record<string, any>;
}

export interface Position {
    id: string;
    account_id: string;
    symbol: string;
    quantity: number;
    entry_price: number;
    current_price: number;
    status: 'open' | 'closed';
    created_at: string;
    closed_at?: string;
    profit_loss?: number;
}

export interface Trade {
    id: string;
    account_id: string;
    symbol: string;
    quantity: number;
    entry_price: number;
    exit_price?: number;
    entry_date: string;
    exit_date?: string;
    profit_loss: number;
    profit_loss_percent: number;
    status: 'open' | 'closed';
}
