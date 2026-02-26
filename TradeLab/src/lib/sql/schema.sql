-- Table des comptes
CREATE TABLE accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    initial_balance DECIMAL(12, 2) NOT NULL,
    current_balance DECIMAL(12, 2) NOT NULL,
    available_balance DECIMAL(12, 2) NOT NULL,
    total_trades INTEGER DEFAULT 0,
    total_gains DECIMAL(12, 2) DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table des preferences utilisateur
CREATE TABLE user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trading_bot_enabled BOOLEAN DEFAULT FALSE,
    bot_symbols TEXT DEFAULT 'BTC-USD,',
    strategy_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table journal du bot
CREATE TABLE bot_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type VARCHAR(30) NOT NULL,
    symbol VARCHAR(20),
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des transactions
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'buy', 'sell', 'dividend')),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des positions
CREATE TABLE positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    quantity DECIMAL(10, 4) NOT NULL,
    entry_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('open', 'closed')),
    strategy TEXT,
    close_reason TEXT,
    signal_data JSONB,
    exit_signal_data JSONB,
    profit_loss DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Créer des index pour les requêtes fréquentes
CREATE INDEX accounts_user_id_idx ON accounts(user_id);
CREATE INDEX user_settings_user_id_idx ON user_settings(user_id);
CREATE INDEX bot_actions_user_id_idx ON bot_actions(user_id);
CREATE INDEX bot_actions_created_at_idx ON bot_actions(created_at);
CREATE INDEX transactions_account_id_idx ON transactions(account_id);
CREATE INDEX transactions_created_at_idx ON transactions(created_at);
CREATE INDEX positions_account_id_idx ON positions(account_id);
CREATE INDEX positions_symbol_idx ON positions(symbol);
CREATE INDEX positions_status_idx ON positions(status);

-- RLS (Row Level Security)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Politique pour accounts
CREATE POLICY "Les utilisateurs voient uniquement leur compte"
    ON accounts
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs créent uniquement leur propre compte"
    ON accounts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs mettent à jour uniquement leur compte"
    ON accounts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Politique pour transactions
CREATE POLICY "Les utilisateurs voient les transactions de leur compte"
    ON transactions
    FOR SELECT
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

CREATE POLICY "Les utilisateurs créent les transactions de leur compte"
    ON transactions
    FOR INSERT
    WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- Politique pour positions
CREATE POLICY "Les utilisateurs voient les positions de leur compte"
    ON positions
    FOR SELECT
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

CREATE POLICY "Les utilisateurs créent les positions de leur compte"
    ON positions
    FOR INSERT
    WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

CREATE POLICY "Les utilisateurs mettent à jour les positions de leur compte"
    ON positions
    FOR UPDATE
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()))
    WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
