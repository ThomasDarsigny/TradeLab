<script lang="ts">
    import { slide } from 'svelte/transition';
    import { supabase } from '$lib/supabaseClient';
    import { checkPassword, getFriendlyAuthError, isValidEmail } from '$lib/utils/authValidation';

    type Mode = 'login' | 'signup';

    const { initialMode = 'login' } = $props<{ initialMode?: Mode }>();

    let mode = $state<Mode>('login');

    $effect(() => {
        mode = initialMode;
    });
    let email = $state('');
    let password = $state('');
    let confirmPassword = $state('');
    let showPassword = $state(false);
    let loading = $state(false);
    let error = $state('');
    let message = $state('');
    let touched = $state({ email: false, password: false, confirm: false });
    let shaking = $state(false);

    let emailInput = $state<HTMLInputElement>();
    let passwordInput = $state<HTMLInputElement>();
    let confirmInput = $state<HTMLInputElement>();

    const isSignup = $derived(mode === 'signup');
    const emailValid = $derived(isValidEmail(email));
    const passwordCheck = $derived(checkPassword(password));
    const passwordsMatch = $derived(confirmPassword.length > 0 && confirmPassword === password);

    // Les erreurs n'apparaissent qu'une fois le champ quitté (ou au submit), puis se mettent à jour en direct
    const emailError = $derived(
        !touched.email || emailValid
            ? ''
            : email.trim()
                ? 'Adresse courriel invalide.'
                : 'Entrez votre adresse courriel.'
    );
    const passwordError = $derived(touched.password && !password ? 'Entrez votre mot de passe.' : '');
    const passwordInvalid = $derived(touched.password && (!password || (isSignup && !passwordCheck.isValid)));
    const confirmError = $derived(
        !isSignup || !touched.confirm || passwordsMatch
            ? ''
            : confirmPassword
                ? 'Les mots de passe ne correspondent pas.'
                : 'Confirmez votre mot de passe.'
    );
    const formValid = $derived(
        emailValid && (isSignup ? passwordCheck.isValid && passwordsMatch : password.length > 0)
    );

    function focusFirstInvalid() {
        if (!emailValid) emailInput?.focus();
        else if (isSignup ? !passwordCheck.isValid : !password) passwordInput?.focus();
        else confirmInput?.focus();
    }

    async function handleAuth() {
        error = '';
        message = '';
        touched = { email: true, password: true, confirm: true };

        if (!formValid) {
            shaking = true;
            focusFirstInvalid();
            return;
        }

        loading = true;
        try {
            const redirecting = isSignup ? await signUp() : await signIn();
            // On garde l'état de chargement jusqu'au rechargement de la page
            if (redirecting) return;
        } catch (err) {
            error = getFriendlyAuthError(err);
            shaking = true;
        }
        loading = false;
    }

    async function signUp(): Promise<boolean> {
        const { data, error: signupError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
        });

        if (signupError) throw signupError;
        if (!data.user) throw new Error('Impossible de créer le compte utilisateur');

        // Supabase renvoie un utilisateur sans identité quand le courriel est déjà inscrit
        if (data.user.identities?.length === 0) {
            throw new Error('Un compte existe déjà avec cette adresse courriel.');
        }

        // Confirmation par courriel requise : le compte TradeLab sera créé à la première connexion (GET /api/account)
        if (!data.session) {
            switchMode('login');
            message = `Un lien de confirmation a été envoyé à ${email.trim()}. Validez-le, puis connectez-vous.`;
            return false;
        }

        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Erreur lors de la création du compte');
        }

        window.location.replace('/');
        return true;
    }

    async function signIn(): Promise<boolean> {
        const { error: loginError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
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
        return true;
    }

    function switchMode(next: Mode) {
        if (mode === next) return;
        mode = next;
        error = '';
        message = '';
        confirmPassword = '';
        touched = { email: false, password: false, confirm: false };
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
                    onclick={() => switchMode('login')}
                    type="button"
                    role="tab"
                    aria-selected={mode === 'login'}
                >
                    Connexion
                </button>
                <button
                    class="mode-tab"
                    class:active={mode === 'signup'}
                    onclick={() => switchMode('signup')}
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signup'}
                >
                    Inscription
                </button>
            </div>

            <form
                class="auth-form"
                class:shake={shaking}
                novalidate
                onsubmit={(event) => { event.preventDefault(); handleAuth(); }}
                onanimationend={(event) => { if (event.target === event.currentTarget) shaking = false; }}
            >
                <div class="field" class:invalid={!!emailError}>
                    <label for="auth-email">Adresse courriel</label>
                    <div class="input-wrap">
                        <input
                            id="auth-email"
                            bind:this={emailInput}
                            type="email"
                            autocomplete="email"
                            placeholder="exemple@tradelab.com"
                            bind:value={email}
                            onblur={() => { if (email) touched.email = true; }}
                            disabled={loading}
                            aria-invalid={!!emailError}
                            aria-describedby={emailError ? 'auth-email-error' : undefined}
                        />
                        {#if emailValid}
                            <span class="input-icon valid" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                            </span>
                        {/if}
                    </div>
                    {#if emailError}
                        <p id="auth-email-error" class="field-error" transition:slide={{ duration: 180 }}>{emailError}</p>
                    {/if}
                </div>

                <div class="field" class:invalid={passwordInvalid}>
                    <label for="auth-password">Mot de passe</label>
                    <div class="input-wrap">
                        <input
                            id="auth-password"
                            bind:this={passwordInput}
                            type={showPassword ? 'text' : 'password'}
                            autocomplete={isSignup ? 'new-password' : 'current-password'}
                            placeholder={isSignup ? 'Créez un mot de passe' : 'Votre mot de passe'}
                            bind:value={password}
                            onblur={() => { if (password) touched.password = true; }}
                            disabled={loading}
                            aria-invalid={passwordInvalid}
                            aria-describedby={isSignup ? 'auth-password-rules' : passwordError ? 'auth-password-error' : undefined}
                        />
                        <button
                            type="button"
                            class="toggle-visibility"
                            onclick={() => (showPassword = !showPassword)}
                            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            aria-pressed={showPassword}
                            disabled={loading}
                        >
                            {#if showPassword}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18" /><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" /><path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
                            {:else}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                            {/if}
                        </button>
                    </div>
                    {#if passwordError}
                        <p id="auth-password-error" class="field-error" transition:slide={{ duration: 180 }}>{passwordError}</p>
                    {/if}

                    {#if isSignup}
                        <div class="password-meter" transition:slide={{ duration: 220 }}>
                            <div class="strength" data-score={passwordCheck.strength.score}>
                                <div class="strength-bars" aria-hidden="true">
                                    {#each [1, 2, 3, 4] as level (level)}
                                        <span class="strength-bar" class:filled={passwordCheck.strength.score >= level}></span>
                                    {/each}
                                </div>
                                <span class="strength-label" aria-live="polite">
                                    {passwordCheck.strength.label || 'Sécurité'}
                                </span>
                            </div>
                            <ul id="auth-password-rules" class="password-rules">
                                {#each passwordCheck.rules as rule (rule.id)}
                                    <li class:passed={rule.passed} class:missed={touched.password && !rule.passed}>
                                        <span class="rule-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                        </span>
                                        {rule.label}
                                        <span class="sr-only">{rule.passed ? '(respecté)' : '(manquant)'}</span>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                </div>

                {#if isSignup}
                    <div class="field" class:invalid={!!confirmError} transition:slide={{ duration: 220 }}>
                        <label for="auth-confirm">Confirmer le mot de passe</label>
                        <div class="input-wrap">
                            <input
                                id="auth-confirm"
                                bind:this={confirmInput}
                                type={showPassword ? 'text' : 'password'}
                                autocomplete="new-password"
                                placeholder="Retapez votre mot de passe"
                                bind:value={confirmPassword}
                                onblur={() => { if (confirmPassword) touched.confirm = true; }}
                                disabled={loading}
                                aria-invalid={!!confirmError}
                                aria-describedby={confirmError ? 'auth-confirm-error' : undefined}
                            />
                            {#if passwordsMatch}
                                <span class="input-icon valid" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                </span>
                            {/if}
                        </div>
                        {#if confirmError}
                            <p id="auth-confirm-error" class="field-error" transition:slide={{ duration: 180 }}>{confirmError}</p>
                        {/if}
                    </div>
                {/if}

                {#if error}
                    <div class="form-alert error" role="alert">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></svg>
                        <span>{error}</span>
                    </div>
                {/if}

                {#if message}
                    <div class="form-alert success" role="status">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></svg>
                        <span>{message}</span>
                    </div>
                {/if}

                <button class="submit-btn" type="submit" disabled={loading} aria-busy={loading}>
                    {#if loading}
                        <span class="spinner" aria-hidden="true"></span>
                        {isSignup ? 'Création du compte…' : 'Connexion…'}
                    {:else}
                        {isSignup ? 'Créer mon compte' : 'Se connecter'}
                    {/if}
                </button>
            </form>

            <p class="card-footer">
                {isSignup ? 'Déjà un compte?' : 'Pas de compte?'}
                <button type="button" class="link-btn" onclick={() => switchMode(isSignup ? 'login' : 'signup')}>
                    {isSignup ? 'Connectez-vous.' : 'Inscrivez-vous.'}
                </button>
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

    .input-wrap {
        position: relative;
    }

    .field input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.85rem 2.9rem 0.85rem 1rem;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.5);
        color: #f8fafc;
        font: inherit;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .field input:focus {
        outline: none;
        border-color: rgba(56, 189, 248, 0.6);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
    }

    .field.invalid input {
        border-color: rgba(248, 113, 113, 0.65);
        box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.1);
    }

    .field.invalid input:focus {
        border-color: rgba(248, 113, 113, 0.85);
        box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.18);
    }

    .field-error {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: #fca5a5;
        font-size: 0.82rem;
    }

    .field-error::before {
        content: '';
        flex: none;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #f87171;
        box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.18);
    }

    .input-icon,
    .toggle-visibility {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: grid;
        place-items: center;
    }

    .input-icon {
        right: 0.85rem;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: linear-gradient(140deg, #38bdf8, #22c55e);
        color: #031b2a;
        pointer-events: none;
        animation: pop 0.25s ease;
    }

    .input-icon svg {
        width: 12px;
        height: 12px;
    }

    .toggle-visibility {
        right: 0.4rem;
        width: 2.2rem;
        height: 2.2rem;
        border: none;
        border-radius: 10px;
        background: transparent;
        color: rgba(226, 232, 240, 0.55);
        cursor: pointer;
        transition: color 0.2s ease, background 0.2s ease;
    }

    .toggle-visibility:hover:not(:disabled) {
        color: #f8fafc;
        background: rgba(148, 163, 184, 0.12);
    }

    .toggle-visibility:focus-visible {
        outline: 2px solid rgba(56, 189, 248, 0.6);
        outline-offset: 1px;
    }

    .toggle-visibility svg {
        width: 18px;
        height: 18px;
    }

    .password-meter {
        display: grid;
        gap: 0.8rem;
        margin-top: 0.15rem;
        padding: 0.9rem 1rem;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.45);
        border: 1px solid rgba(148, 163, 184, 0.14);
    }

    .strength {
        --strength-color: rgba(148, 163, 184, 0.4);
        --strength-text: rgba(226, 232, 240, 0.5);
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .strength[data-score='1'] {
        --strength-color: #f87171;
        --strength-text: #fca5a5;
    }

    .strength[data-score='2'] {
        --strength-color: #fbbf24;
        --strength-text: #fde68a;
    }

    .strength[data-score='3'] {
        --strength-color: #4ade80;
        --strength-text: #86efac;
    }

    .strength[data-score='4'] {
        --strength-color: linear-gradient(90deg, #38bdf8, #22c55e);
        --strength-text: #7dd3fc;
    }

    .strength-bars {
        flex: 1;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.35rem;
    }

    .strength-bar {
        position: relative;
        height: 6px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.16);
        overflow: hidden;
    }

    .strength-bar::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: var(--strength-color);
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .strength-bar.filled::after {
        transform: scaleX(1);
    }

    .strength-label {
        min-width: 4.8rem;
        text-align: right;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--strength-text);
        transition: color 0.25s ease;
    }

    .password-rules {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem 0.75rem;
    }

    .password-rules li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.82rem;
        color: rgba(226, 232, 240, 0.6);
        transition: color 0.2s ease;
    }

    .password-rules li.passed {
        color: #bbf7d0;
    }

    .password-rules li.missed {
        color: #fca5a5;
    }

    .rule-icon {
        flex: none;
        width: 18px;
        height: 18px;
        box-sizing: border-box;
        border-radius: 50%;
        display: grid;
        place-items: center;
        border: 1.5px solid rgba(148, 163, 184, 0.35);
        color: #031b2a;
        transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
    }

    .rule-icon svg {
        width: 11px;
        height: 11px;
        stroke-dasharray: 24;
        stroke-dashoffset: 24;
        transition: stroke-dashoffset 0.3s ease 0.05s;
    }

    .password-rules li.passed .rule-icon {
        background: linear-gradient(140deg, #38bdf8, #22c55e);
        border-color: transparent;
        transform: scale(1.06);
    }

    .password-rules li.passed .rule-icon svg {
        stroke-dashoffset: 0;
    }

    .password-rules li.missed .rule-icon {
        border-color: rgba(248, 113, 113, 0.7);
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .form-alert {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.75rem 1rem;
        border-radius: 12px;
        font-size: 0.9rem;
        animation: fadeInUp 0.3s ease;
    }

    .form-alert svg {
        flex: none;
        width: 18px;
        height: 18px;
        margin-top: 1px;
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
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

    .spinner {
        width: 16px;
        height: 16px;
        box-sizing: border-box;
        border-radius: 50%;
        border: 2px solid rgba(3, 27, 42, 0.25);
        border-top-color: #031b2a;
        animation: spin 0.7s linear infinite;
    }

    .card-footer {
        margin-top: 1.25rem;
        text-align: center;
        color: rgba(226, 232, 240, 0.7);
    }

    .link-btn {
        border: none;
        background: none;
        padding: 0;
        font: inherit;
        font-weight: 600;
        color: #7dd3fc;
        cursor: pointer;
    }

    .link-btn:hover {
        text-decoration: underline;
    }

    .auth-form.shake {
        animation: shake 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97);
    }

    @keyframes shake {
        10%, 90% {
            transform: translateX(-1px);
        }
        20%, 80% {
            transform: translateX(2px);
        }
        30%, 50%, 70% {
            transform: translateX(-5px);
        }
        40%, 60% {
            transform: translateX(5px);
        }
    }

    @keyframes pop {
        from {
            transform: translateY(-50%) scale(0.4);
            opacity: 0;
        }
        to {
            transform: translateY(-50%) scale(1);
            opacity: 1;
        }
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .auth-form.shake,
        .input-icon,
        .form-alert {
            animation: none;
        }
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

    @media (max-width: 420px) {
        .password-rules {
            grid-template-columns: 1fr;
        }
    }
</style>
