<script lang="ts">
    import { supabase } from '$lib/supabaseClient';
    import { goto } from '$app/navigation';
    
    let mode: 'login' | 'signup' = $state('login');
    let email = $state('');
    let password = $state('');
    let loading = $state(false);
    let error = $state('');
    let message = $state('');

    async function handleAuth() {
        loading = true;
        error = '';
        message = '';

        try {
            if (mode === 'signup') {
                const { data, error: signupError } = await supabase.auth.signUp({ 
                    email, 
                    password 
                });
                
                if (signupError) throw signupError;
                
                if (data.user) {
                    const response = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });
                    
                    if (!response.ok) {
                        console.error('Erreur création compte trading');
                    }
                }
                
                message = 'Inscription réussie ! Vous pouvez maintenant vous connecter.';
                setTimeout(() => {
                    mode = 'login';
                    message = '';
                }, 2000);
            } else {
                const { error: loginError } = await supabase.auth.signInWithPassword({ 
                    email, 
                    password 
                });
                
                if (loginError) throw loginError;
                await goto('/');
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Une erreur est survenue';
        } finally {
            loading = false;
        }
    }

    function toggleMode() {
        mode = mode === 'login' ? 'signup' : 'login';
        error = '';
        message = '';
    }
</script>

<svelte:head>
    <title>{mode === 'login' ? 'Connexion' : 'Inscription'} - TradeLab</title>
</svelte:head>

<div class="auth-container">
    <div class="auth-card">
        <div class="auth-header">
            <div class="logo-container">
                <img src="/logo.png" alt="TradeLab" class="auth-logo" />
            </div>
            <h1>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h1>
            <p>
                {mode === 'login' 
                    ? 'Connectez-vous pour accéder à votre portefeuille' 
                    : 'Commencez votre aventure de trading papier'}
            </p>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); handleAuth(); }}>
            <div class="form-group">
                <label for="email">Email</label>
                <input
                    id="email"
                    type="email"
                    bind:value={email}
                    placeholder="votre@email.com"
                    required
                    disabled={loading}
                />
            </div>

            <div class="form-group">
                <label for="password">Mot de passe</label>
                <input
                    id="password"
                    type="password"
                    bind:value={password}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    minlength="6"
                />
            </div>

            {#if error}
                <div class="alert alert-error">
                    {error}
                </div>
            {/if}

            {#if message}
                <div class="alert alert-success">
                    {message}
                </div>
            {/if}

            <button type="submit" class="btn-primary" disabled={loading}>
                {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'S\'inscrire'}
            </button>
        </form>

        <div class="auth-footer">
            <button class="btn-link" onclick={toggleMode} disabled={loading}>
                {mode === 'login' 
                    ? 'Pas encore de compte ? S\'inscrire' 
                    : 'Déjà un compte ? Se connecter'}
            </button>
        </div>
    </div>
</div>

<style>
    .auth-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        background: linear-gradient(135deg, #0f1419 0%, #1a1f2e 100%);
    }

    .auth-card {
        background: #1a1f2e;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 24px;
        padding: 3rem;
        width: 100%;
        max-width: 480px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .auth-header {
        text-align: center;
        margin-bottom: 2rem;
    }

    .logo-container {
        display: flex;
        justify-content: center;
        margin-bottom: 1.5rem;
    }

    .auth-logo {
        width: 80px;
        height: 80px;
    }

    .auth-header h1 {
        font-size: 2rem;
        margin: 0 0 0.5rem;
        color: white;
    }

    .auth-header p {
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        color: white;
        font-weight: 600;
    }

    .form-group input {
        width: 100%;
        padding: 0.875rem 1rem;
        background: #0f1419;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: white;
        font-size: 1rem;
        transition: all 0.2s;
        box-sizing: border-box;
    }

    .form-group input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-group input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .alert {
        padding: 1rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        font-size: 0.875rem;
    }

    .alert-error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
    }

    .alert-success {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #6ee7b7;
    }

    .btn-primary {
        width: 100%;
        padding: 1rem;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
    }

    .btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
    }

    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .auth-footer {
        margin-top: 2rem;
        text-align: center;
    }

    .btn-link {
        background: none;
        border: none;
        color: #3b82f6;
        font-size: 0.875rem;
        cursor: pointer;
        transition: color 0.2s;
    }

    .btn-link:hover:not(:disabled) {
        color: #60a5fa;
        text-decoration: underline;
    }

    .btn-link:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
