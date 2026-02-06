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
                    password,
                });

                if (signupError) throw signupError;

                if (data.user) {
                    const response = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                    });

                    if (!response.ok) {
                        console.error('Erreur création compte trading');
                    }
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
                    Suivi des positions
                </li>
            </ul>
        </section>

        <section class="auth-card stagger-2" aria-label="Connexion">
            <div class="card-header">
                <img src="/logo.png" alt="TradeLab" class="auth-logo" />
                <div>
                    <h2>{mode === 'login' ? 'Bienvenue' : 'Nouvel espace'}</h2>
                    <p>{mode === 'login' ? 'Connectez-vous pour reprendre votre session.' : 'Inscrivez-vous pour demarrer.'}</p>
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

    @keyframes rise {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .stagger-1 {
        animation: rise 0.8s ease forwards;
        animation-delay: 0.1s;
        opacity: 0;
    }

    .stagger-2 {
        animation: rise 0.8s ease forwards;
        animation-delay: 0.2s;
        opacity: 0;
    }

    .stagger-3 {
        animation: rise 0.8s ease forwards;
        animation-delay: 0.35s;
        opacity: 0;
    }

    .stagger-4 {
        animation: rise 0.8s ease forwards;
        animation-delay: 0.5s;
        opacity: 0;
    }

    .auth-shell {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(320px, 1.2fr) minmax(340px, 1fr);
        gap: 3rem;
        max-width: 1150px;
        width: 100%;
        color: #e2e8f0;
    }

    .auth-hero {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .hero-kicker {
        text-transform: uppercase;
        letter-spacing: 0.35em;
        font-size: 0.7rem;
        color: rgba(148, 163, 184, 0.7);
        font-weight: 600;
    }

    .auth-hero h1 {
        font-family: 'Fraunces', serif;
        font-size: clamp(2.6rem, 4vw, 3.6rem);
        margin: 0;
        line-height: 1.1;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .hero-emphasis {
        background: linear-gradient(120deg, #60a5fa, #22d3ee);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .hero-subtitle {
        font-size: 1.1rem;
        color: rgba(226, 232, 240, 0.7);
        margin: 0;
        max-width: 30rem;
    }

    .hero-points {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.75rem;
        font-size: 0.95rem;
    }

    .hero-points li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: rgba(226, 232, 240, 0.85);
    }

    .point-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: linear-gradient(135deg, #60a5fa, #22d3ee);
        box-shadow: 0 0 12px rgba(96, 165, 250, 0.6);
    }

    .auth-card {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 20px;
        padding: 2.5rem;
        box-shadow: 0 40px 120px rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(18px);
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .card-header {
        display: flex;
        align-items: center;
        gap: 1.25rem;
    }

    .auth-logo {
        width: 64px;
        height: 64px;
    }

    .card-header h2 {
        margin: 0 0 0.35rem;
        font-size: 1.8rem;
        color: #f8fafc;
    }

    .card-header p {
        margin: 0;
        color: rgba(148, 163, 184, 0.8);
    }

    .mode-tabs {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 14px;
        padding: 0.35rem;
        gap: 0.35rem;
    }

    .mode-tab {
        background: transparent;
        border: none;
        color: rgba(226, 232, 240, 0.7);
        padding: 0.6rem 0.8rem;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .mode-tab.active {
        background: rgba(59, 130, 246, 0.2);
        color: #e2e8f0;
        box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.35);
    }

    .auth-form {
        display: grid;
        gap: 1.25rem;
    }

    .field {
        display: grid;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: rgba(148, 163, 184, 0.9);
        font-weight: 600;
    }

    .field input {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        padding: 0.85rem 1rem;
        color: #e2e8f0;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .field input:focus {
        border-color: rgba(59, 130, 246, 0.8);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }

    .form-alert {
        padding: 0.75rem 1rem;
        border-radius: 12px;
        font-size: 0.9rem;
    }

    .form-alert.error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fecaca;
    }

    .form-alert.success {
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.25);
        color: #6ee7b7;
    }

    .submit-btn {
        background: linear-gradient(120deg, #3b82f6, #22d3ee);
        border: none;
        color: white;
        padding: 0.9rem 1rem;
        border-radius: 14px;
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        box-shadow: 0 12px 30px rgba(34, 211, 238, 0.35);
    }

    .submit-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 16px 36px rgba(34, 211, 238, 0.45);
    }

    .submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }

    .card-footer {
        margin: 0;
        color: rgba(148, 163, 184, 0.7);
        font-size: 0.85rem;
    }
</style>
