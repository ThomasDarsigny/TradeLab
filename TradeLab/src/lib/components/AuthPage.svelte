<script lang="ts">
    import { supabase } from '$lib/supabaseClient';

    const { initialMode = 'login' } = $props<{ initialMode?: 'login' | 'signup' }>();

    let mode: 'login' | 'signup' = $state('login');

    $effect(() => {
        mode = initialMode;
    });
    let email = $state('');
    let password = $state('');
    let loading = $state(false);
    let error = $state('');
    let message = $state('');

    function getFriendlyAuthError(err: unknown): string {
        const fallback = 'Une erreur est survenue';
        const rawMessage = err instanceof Error ? err.message : fallback;

        if (rawMessage.includes('Password should contain at least one character of each')) {
            return 'Le mot de passe est trop faible. Utilisez au moins une majuscule, une minuscule, un chiffre et un symbole.';
        }

        return rawMessage;
    }

    async function handleAuth() {
        loading = true;
        error = '';
        message = '';

        try {
            if (mode === 'signup') {
                const { data, error: signupError } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (signupError) throw signupError;

                if (data.user) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const response = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Erreur lors de la création du compte');
                    }
                } else {
                    throw new Error('Impossible de créer le compte utilisateur');
                }

                message = 'Inscription réussie. Vous pouvez maintenant vous connecter.';
                setTimeout(() => {
                    mode = 'login';
                    message = '';
                }, 2000);
            } else {
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (loginError) throw loginError;

                const {
                    data: { session }
                } = await supabase.auth.getSession();

                if (!session) {
                    throw new Error('Session non disponible après connexion. Veuillez réessayer.');
                }

                window.location.replace('/');
                return;
            }
        } catch (err) {
            error = getFriendlyAuthError(err);
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
    <title>{`TradeLab - ${mode === 'login' ? 'Connexion' : 'Inscription'}`}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,800&display=swap"
    />
</svelte:head>

<div class="auth-page">
    <div class="ambient-glow"></div>
    <div class="mesh-grid"></div>
    <div class="orb orb-a"></div>
    <div class="orb orb-b"></div>

    <div class="auth-shell">
        <section class="auth-hero stagger-1">
            <p class="hero-kicker">TradeLab</p>
            <h1>
                <span class="hero-emphasis">Simulateur boursier</span>
                <span>Zéro risque</span>
            </h1>
            <p class="hero-subtitle">
                Perfectionnez vos stratégies d'investissement sans aucun risque financier avec TradeLab.
            </p>
            <ul class="hero-points">
                <li class="stagger-2">
                    <span class="point-dot"></span>
                    Données en temps réel et actualitées financières
                </li>
                <li class="stagger-3">
                    <span class="point-dot"></span>
                    Tableaux de bord et graphiques immersifs
                </li>
                <li class="stagger-4">
                    <span class="point-dot"></span>
                    Suivi des titres
                </li>
            </ul>
        </section>

        <section class="auth-card stagger-2" aria-label="Connexion">
            <div class="card-header">
                <img src="/logo.png" alt="TradeLab" class="auth-logo" />
                <div>
                    <h2>{mode === 'login' ? 'Bienvenue' : 'Nouvel espace'}</h2>
                    <p>{mode === 'login' ? 'Connectez-vous pour reprendre votre session.' : 'Inscrivez-vous pour démarrer.'}</p>
                </div>
            </div>

            <div class="mode-tabs" role="tablist" aria-label="Mode de connexion">
                <button
                    class="mode-tab"
                    class:active={mode === 'login'}
                    onclick={() => mode !== 'login' && toggleMode()}
                    type="button"
                    role="tab"
                    aria-selected={mode === 'login'}
                >
                    Connexion
                </button>
                <button
                    class="mode-tab"
                    class:active={mode === 'signup'}
                    onclick={() => mode !== 'signup' && toggleMode()}
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signup'}
                >
                    Inscription
                </button>
            </div>

            <form class="auth-form" onsubmit={(event) => { event.preventDefault(); handleAuth(); }}>
                <label class="field">
                    <span>Adresse courriel</span>
                    <input
                        type="email"
                        autocomplete="email"
                        placeholder="exemple@tradelab.com"
                        bind:value={email}
                        required
                        disabled={loading}
                    />
                </label>

                <label class="field">
                    <span>Mot de passe</span>
                    <input
                        type="password"
                        autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
                        placeholder="Votre mot de passe"
                        bind:value={password}
                        required
                        disabled={loading}
                        minlength="6"
                    />
                </label>

                {#if error}
                    <div class="form-alert error" role="status">{error}</div>
                {/if}

                {#if message}
                    <div class="form-alert success" role="status">{message}</div>
                {/if}

                <button class="submit-btn" type="submit" disabled={loading}>
                    {loading
                        ? 'Chargement...'
                        : mode === 'login'
                            ? 'Se connecter'
                            : 'Créer mon compte'}
                </button>
            </form>

            <p style="text-align: center" class="card-footer">
                {mode === 'login'
                    ? 'Pas de compte?  Inscrivez-vous.'
                        : 'Déjà un compte? Connectez-vous.'}
            </p>
        </section>
    </div>
</div>

<style>
    :global(body) {
        font-family: 'Space Grotesk', 'Fraunces', sans-serif;
        background: #05060b;
    }

    .auth-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4rem 6vw;
        background: radial-gradient(circle at top, rgba(59, 130, 246, 0.2), transparent 55%),
            radial-gradient(circle at 15% 20%, rgba(16, 185, 129, 0.18), transparent 45%),
            #05060b;
        position: relative;
        overflow: hidden;
    }

    .ambient-glow {
        position: absolute;
        inset: -40% -20% auto;
        height: 60vh;
        background: linear-gradient(120deg, rgba(59, 130, 246, 0.35), rgba(14, 116, 144, 0.2));
        filter: blur(90px);
        opacity: 0.8;
    }

    .mesh-grid {
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
        background-size: 80px 80px;
        mask-image: radial-gradient(circle at top, rgba(0, 0, 0, 0.85), transparent 65%);
    }

    .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(10px);
        opacity: 0.7;
        animation: float 8s ease-in-out infinite;
    }

    .orb-a {
        width: 240px;
        height: 240px;
        background: rgba(59, 130, 246, 0.3);
        top: 15%;
        right: 10%;
    }

    .orb-b {
        width: 180px;
        height: 180px;
        background: rgba(16, 185, 129, 0.25);
        bottom: 10%;
        left: 8%;
        animation-delay: -3s;
    }

    @keyframes float {
        0%, 100% {
            transform: translateY(0px);
        }
        50% {
            transform: translateY(-20px);
        }
    }

    .auth-shell {
        position: relative;
        display: grid;
        grid-template-columns: minmax(260px, 420px) minmax(320px, 440px);
        gap: 4vw;
        align-items: center;
        width: min(1100px, 100%);
        z-index: 1;
    }

    .auth-hero {
        color: #e2e8f0;
    }

    .hero-kicker {
        text-transform: uppercase;
        letter-spacing: 0.3em;
        font-size: 0.75rem;
        color: rgba(148, 163, 184, 0.8);
        margin-bottom: 1rem;
    }

    .auth-hero h1 {
        font-size: clamp(2rem, 4vw, 3.2rem);
        margin: 0 0 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        line-height: 1.1;
    }

    .hero-emphasis {
        font-family: 'Fraunces', serif;
        font-weight: 800;
        color: #f8fafc;
    }

    .hero-subtitle {
        font-size: 1.05rem;
        color: rgba(226, 232, 240, 0.82);
        margin-bottom: 2rem;
    }

    .hero-points {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 1rem;
    }

    .hero-points li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.98rem;
        color: rgba(226, 232, 240, 0.75);
    }

    .point-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: linear-gradient(140deg, #38bdf8, #22c55e);
        box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.12);
    }

    .auth-card {
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 24px;
        padding: 2.5rem;
        box-shadow: 0 30px 60px rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(14px);
        color: #f8fafc;
    }

    .card-header {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1.75rem;
    }

    .auth-logo {
        width: 56px;
        height: 56px;
    }

    .card-header h2 {
        margin: 0;
        font-size: 1.5rem;
    }

    .card-header p {
        margin: 0.35rem 0 0;
        color: rgba(226, 232, 240, 0.7);
        font-size: 0.95rem;
    }

    .mode-tabs {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        background: rgba(15, 23, 42, 0.6);
        border-radius: 16px;
        padding: 0.4rem;
        gap: 0.35rem;
        margin-bottom: 1.5rem;
        border: 1px solid rgba(148, 163, 184, 0.2);
    }

    .mode-tab {
        border: none;
        background: transparent;
        color: rgba(226, 232, 240, 0.7);
        padding: 0.7rem 1rem;
        font-weight: 600;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .mode-tab.active {
        background: linear-gradient(120deg, rgba(56, 189, 248, 0.2), rgba(34, 197, 94, 0.2));
        color: #f8fafc;
    }

    .auth-form {
        display: grid;
        gap: 1rem;
    }

    .field {
        display: grid;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: rgba(226, 232, 240, 0.72);
    }

    .field input {
        padding: 0.85rem 1rem;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.5);
        color: #f8fafc;
    }

    .field input:focus {
        outline: none;
        border-color: rgba(56, 189, 248, 0.6);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
    }

    .form-alert {
        padding: 0.75rem 1rem;
        border-radius: 12px;
        font-size: 0.9rem;
    }

    .form-alert.error {
        background: rgba(248, 113, 113, 0.12);
        color: #fecaca;
        border: 1px solid rgba(248, 113, 113, 0.3);
    }

    .form-alert.success {
        background: rgba(34, 197, 94, 0.12);
        color: #bbf7d0;
        border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .submit-btn {
        padding: 0.9rem 1.2rem;
        border-radius: 12px;
        border: none;
        background: linear-gradient(120deg, #38bdf8, #22c55e);
        color: #031b2a;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .submit-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.4);
    }

    .card-footer {
        margin-top: 1.25rem;
        color: rgba(226, 232, 240, 0.7);
    }

    .stagger-1 {
        animation: fadeInUp 0.6s ease forwards;
    }

    .stagger-2 {
        animation: fadeInUp 0.6s ease forwards;
        animation-delay: 0.1s;
    }

    .stagger-3 {
        animation: fadeInUp 0.6s ease forwards;
        animation-delay: 0.2s;
    }

    .stagger-4 {
        animation: fadeInUp 0.6s ease forwards;
        animation-delay: 0.3s;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @media (max-width: 960px) {
        .auth-shell {
            grid-template-columns: 1fr;
            gap: 2.5rem;
        }

        .auth-hero {
            text-align: center;
        }

        .hero-points {
            justify-items: center;
        }
    }

    @media (max-width: 600px) {
        .auth-page {
            padding: 3rem 1.5rem;
        }

        .auth-card {
            padding: 2rem;
        }
    }
</style>
