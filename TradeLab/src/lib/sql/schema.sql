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
    bot_symbols TEXT DEFAULT 'BTC-USD,ETH-USD',
    strategy_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id),
    CONSTRAINT user_settings_strategy_config_is_object CHECK (jsonb_typeof(strategy_config) = 'object')
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
    exit_price DECIMAL(10, 2),
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

-- Politique pour user_settings
CREATE POLICY "Les utilisateurs voient leurs preferences"
    ON user_settings
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs creent leurs preferences"
    ON user_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs mettent a jour leurs preferences"
    ON user_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Politique pour bot_actions
CREATE POLICY "Les utilisateurs voient le journal du bot"
    ON bot_actions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs creent des actions du bot"
    ON bot_actions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Fonctions atomiques du bot de trading
-- Le FOR UPDATE verrouille la ligne pour éviter les doubles achats/ventes
-- quand plusieurs cycles du bot se chevauchent.
CREATE OR REPLACE FUNCTION public.open_position_atomic(
    p_account_id UUID,
    p_symbol TEXT,
    p_quantity NUMERIC,
    p_price NUMERIC,
    p_fees NUMERIC,
    p_strategy TEXT,
    p_signal JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_total_cost NUMERIC := (p_quantity * p_price) + p_fees;
    v_current_bal NUMERIC;
BEGIN
    SELECT current_balance INTO v_current_bal
    FROM accounts
    WHERE id = p_account_id
    FOR UPDATE;

    IF v_current_bal < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Solde insuffisant (SQL Check)');
    END IF;

    UPDATE accounts
    SET current_balance = current_balance - v_total_cost,
        available_balance = available_balance - v_total_cost,
        updated_at = NOW()
    WHERE id = p_account_id;

    INSERT INTO positions (account_id, symbol, quantity, entry_price, current_price, status, strategy, signal_data)
    VALUES (p_account_id, p_symbol, p_quantity, p_price, p_price, 'open', p_strategy, p_signal);

    RETURN jsonb_build_object('success', true, 'new_balance', v_current_bal - v_total_cost);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_position_atomic(
    p_position_id UUID,
    p_account_id UUID,
    p_exit_price NUMERIC,
    p_fees NUMERIC,
    p_reason TEXT,
    p_signal JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_pos RECORD;
    v_net_proceeds NUMERIC;
    v_pnl NUMERIC;
BEGIN
    SELECT * INTO v_pos
    FROM positions
    WHERE id = p_position_id AND status = 'open'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Position déjà fermée ou introuvable');
    END IF;

    v_net_proceeds := (v_pos.quantity * p_exit_price) - p_fees;
    v_pnl := v_net_proceeds - (v_pos.quantity * v_pos.entry_price);

    UPDATE accounts
    SET current_balance = current_balance + v_net_proceeds,
        available_balance = available_balance + v_net_proceeds,
        updated_at = NOW()
    WHERE id = p_account_id;

    UPDATE positions
    SET status = 'closed',
        exit_price = p_exit_price,
        profit_loss = v_pnl,
        closed_at = NOW(),
        close_reason = p_reason,
        exit_signal_data = p_signal
    WHERE id = p_position_id;

    RETURN jsonb_build_object('success', true, 'pnl', v_pnl);
END;
$$;

-- Seul le bot (clé service_role) appelle ces fonctions : on empêche les
-- utilisateurs de les appeler depuis le navigateur avec un prix arbitraire.
REVOKE EXECUTE ON FUNCTION public.open_position_atomic(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_position_atomic(UUID, UUID, NUMERIC, NUMERIC, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_position_atomic(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_position_atomic(UUID, UUID, NUMERIC, NUMERIC, TEXT, JSONB) TO service_role;
