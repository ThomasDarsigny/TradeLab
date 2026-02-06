<script lang="ts">
	import './layout.css';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { children } = $props();
	let userEmail = $state<string | null>(null);
	let showHeader = $derived(!$page.url.pathname.startsWith('/auth'));
	let showProfileMenu = $state(false);
	let currentTheme = $state<'default' | 'light' | 'black'>('default');
	let showAddFundsModal = $state(false);
	let addFundsAmount = $state('');
	let addFundsDescription = $state('');
	let addFundsError = $state<string | null>(null);
	let addFundsLoading = $state(false);
	let addFundsSuccess = $state<string | null>(null);

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		userEmail = session?.user?.email || null;

		supabase.auth.onAuthStateChange((_event: string, session: any) => {
			userEmail = session?.user?.email || null;
		});

		const savedTheme = localStorage.getItem('theme') as 'default' | 'light' | 'black' || 'default';
		currentTheme = savedTheme;
		if (savedTheme !== 'default') {
			document.documentElement.setAttribute('data-theme', savedTheme);
		}
	});

	async function handleLogout() {
		showProfileMenu = false;
		showAddFundsModal = false;
		addFundsError = null;
		addFundsSuccess = null;
		addFundsAmount = '';
		addFundsDescription = '';
		userEmail = null;
		await supabase.auth.signOut();
		await goto('/login');
	}

	function toggleProfileMenu() {
		showProfileMenu = !showProfileMenu;
	}

	function setTheme(theme: 'default' | 'light' | 'black') {
		currentTheme = theme;
		showProfileMenu = false;
		if (theme === 'default') {
			document.documentElement.removeAttribute('data-theme');
			localStorage.setItem('theme', 'default');
		} else {
			document.documentElement.setAttribute('data-theme', theme);
			localStorage.setItem('theme', theme);
		}
	}

	function handleAddFunds() {
		showProfileMenu = false;
		addFundsAmount = '';
		addFundsDescription = '';
		addFundsError = null;
		addFundsSuccess = null;
		showAddFundsModal = true;
	}

	function closeAddFundsModal() {
		showAddFundsModal = false;
		addFundsError = null;
		addFundsSuccess = null;
	}

	async function submitAddFunds() {
		addFundsError = null;
		addFundsSuccess = null;

		const parsedAmount = Number.parseFloat(addFundsAmount);
		if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
			addFundsError = 'Veuillez entrer un montant valide.';
			return;
		}

		addFundsLoading = true;
		try {
			const response = await fetch('/api/account/deposit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					amount: parsedAmount,
					description: addFundsDescription || 'Depot',
				}),
			});

			const data = await response.json();
			if (!response.ok) {
				addFundsError = data?.error || 'Erreur lors du depot.';
				return;
			}

			addFundsSuccess = 'Fonds ajoutes avec succes.';
			addFundsAmount = '';
			addFundsDescription = '';
		} catch (error) {
			console.error('Erreur depot:', error);
			addFundsError = 'Erreur reseau. Veuillez reessayer.';
		} finally {
			addFundsLoading = false;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.profile-dropdown')) {
			showProfileMenu = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="app">
	{#if showHeader}
		<header class="app-header">
			<a href="/" class="brand">
				<img src="/logo.png" alt="TradeLab Logo" class="logo" style="width: 60px; height: 60px;" />
				<span>TradeLab</span>
			</a>
			<nav class="nav" aria-label="Navigation principale">
				<a 
					class="nav-item" 
					class:active={$page.url.pathname === '/'} 
					href="/" 
					data-sveltekit-preload-data="hover"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
						<polyline points="9 22 9 12 15 12 15 22"></polyline>
					</svg>
					Portefeuille
				</a>
				<a 
					class="nav-item" 
					class:active={$page.url.pathname === '/markets'} 
					href="/markets" 
					data-sveltekit-preload-data="hover"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
					</svg>
					Marchés
				</a>
				<a 
					class="nav-item" 
					class:active={$page.url.pathname === '/news'} 
					href="/news" 
					data-sveltekit-preload-data="hover"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
					</svg>
					Actualités
				</a>
				{#if userEmail}
					<div class="profile-dropdown">
						<button class="profile-icon-btn" onclick={toggleProfileMenu} aria-label="Menu profil">
							<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="8" r="4"></circle>
								<path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
							</svg>
						</button>
						
						{#if showProfileMenu}
							<div class="profile-menu">
								<div class="profile-menu-header">
									<div class="profile-avatar">
										<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<circle cx="12" cy="8" r="4"></circle>
											<path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
										</svg>
									</div>
									<div class="profile-email">{userEmail}</div>
								</div>
								
								<div class="profile-menu-divider"></div>
								
								<button class="profile-menu-item" onclick={handleAddFunds}>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="12" cy="12" r="10"></circle>
										<line x1="12" y1="8" x2="12" y2="16"></line>
										<line x1="8" y1="12" x2="16" y2="12"></line>
									</svg>
									<span>Ajouter des fonds</span>
								</button>
								
					<div class="profile-menu-divider"></div>
					<div class="theme-section-title">Thèmes</div>
					
					<button class="profile-menu-item" class:active={currentTheme === 'default'} onclick={() => setTheme('default')}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
						</svg>
						<span>Défaut (Bleu foncé)</span>
						{#if currentTheme === 'default'}
							<svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
						{/if}
					</button>
					
					<button class="profile-menu-item" class:active={currentTheme === 'light'} onclick={() => setTheme('light')}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="5"></circle>
							<line x1="12" y1="1" x2="12" y2="3"></line>
							<line x1="12" y1="21" x2="12" y2="23"></line>
							<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
							<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
							<line x1="1" y1="12" x2="3" y2="12"></line>
							<line x1="21" y1="12" x2="23" y2="12"></line>
							<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
							<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
						</svg>
						<span>Mode clair</span>
						{#if currentTheme === 'light'}
							<svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
						{/if}
					</button>
					
					<button class="profile-menu-item" class:active={currentTheme === 'black'} onclick={() => setTheme('black')}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
						</svg>
						<span>Mode noir</span>
						{#if currentTheme === 'black'}
							<svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
						{/if}
					</button>
					
					<div class="profile-menu-divider"></div>
					
					<button class="profile-menu-item danger" onclick={handleLogout}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
							<polyline points="16 17 21 12 16 7"></polyline>
							<line x1="21" y1="12" x2="9" y2="12"></line>
						</svg>
						<span>Déconnexion</span>
					</button>
							</div>
						{/if}
					</div>
				{/if}
			</nav>
		</header>
	{/if}

	<main class:full-page={!showHeader}>
		{@render children()}
	</main>

	{#if showAddFundsModal}
		<div class="modal-backdrop" role="presentation" onclick={closeAddFundsModal}>
			<div
				class="modal-card"
				role="dialog"
				aria-modal="true"
				aria-label="Ajouter des fonds"
				tabindex="0"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
			>
				<div class="modal-header">
					<h3>Ajouter des fonds</h3>
					<button class="modal-close" onclick={closeAddFundsModal} aria-label="Fermer">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>

				<form
					class="modal-form"
					onsubmit={(event) => {
						event.preventDefault();
						submitAddFunds();
					}}
				>
					<label class="modal-label" for="deposit-amount">Montant</label>
					<input
						id="deposit-amount"
						class="modal-input"
						type="number"
						min="1"
						step="0.01"
						placeholder="0.00"
						bind:value={addFundsAmount}
						required
					/>

					{#if addFundsError}
						<div class="modal-message error">{addFundsError}</div>
					{/if}
					{#if addFundsSuccess}
						<div class="modal-message success">{addFundsSuccess}</div>
					{/if}

					<div class="modal-actions">
						<button class="btn-secondary" type="button" onclick={closeAddFundsModal}>Annuler</button>
						<button class="btn-primary" type="submit" disabled={addFundsLoading}>
							{addFundsLoading ? 'Ajout en cours...' : 'Ajouter'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	.profile-dropdown {
		position: relative;
		margin-left: 1rem;
		padding-left: 1rem;
		border-left: 1px solid var(--border-primary);
	}

	.profile-icon-btn {
		background: transparent;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.profile-icon-btn:hover {
		background: var(--bg-hover);
	}

	.profile-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 12px;
		min-width: 280px;
		box-shadow: var(--shadow-xl);
		z-index: 1000;
		animation: slideDown 0.2s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.profile-menu-header {
		padding: 1.5rem;
		text-align: center;
	}

	.profile-avatar {
		width: 60px;
		height: 60px;
		margin: 0 auto 0.75rem;
		background: linear-gradient(135deg, #3b82f6, #2563eb);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
	}

	.profile-email {
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		word-break: break-all;
	}

	.profile-menu-divider {
		height: 1px;
		background: var(--border-primary);
		margin: 0.5rem 0;
	}

	.theme-section-title {
		padding: 0.75rem 1.5rem 0.5rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.profile-menu-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1.5rem;
		background: transparent;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.9375rem;
		transition: all 0.2s;
		text-align: left;
		position: relative;
	}

	.profile-menu-item:hover {
		background: var(--bg-hover);
	}

	.profile-menu-item.active {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}

	.check-icon {
		margin-left: auto;
		color: #60a5fa;
	}

	.profile-menu-item.danger {
		color: #fca5a5;
	}

	.profile-menu-item.danger:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1100;
		backdrop-filter: blur(6px);
	}

	.modal-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		box-shadow: var(--shadow-xl);
		width: 420px;
		max-width: calc(100% - 2rem);
		padding: 1.5rem;
		animation: slideDown 0.2s ease-out;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.modal-header h3 {
		margin: 0;
		color: var(--text-primary);
	}

	.modal-close {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.modal-label {
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.modal-input {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-primary);
		border-radius: 10px;
		color: var(--text-primary);
		padding: 0.75rem 0.875rem;
		font-size: 0.95rem;
		outline: none;
	}

	.modal-input:focus {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
	}

	.modal-message {
		padding: 0.75rem;
		border-radius: 10px;
		font-size: 0.875rem;
	}

	.modal-message.error {
		background: rgba(239, 68, 68, 0.1);
		color: var(--accent-red);
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.modal-message.success {
		background: rgba(16, 185, 129, 0.12);
		color: var(--accent-green);
		border: 1px solid rgba(16, 185, 129, 0.2);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.btn-secondary {
		background: transparent;
		border: 1px solid var(--border-secondary);
		color: var(--text-primary);
		padding: 0.6rem 1rem;
		border-radius: 10px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.btn-primary {
		background: var(--accent-primary);
		border: none;
		color: white;
		padding: 0.6rem 1.2rem;
		border-radius: 10px;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.btn-primary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	main.full-page {
		padding: 0;
	}
</style>
