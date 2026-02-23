
<script lang="ts">
import './layout.css';
import { supabase } from '$lib/supabaseClient';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { setAccount, clearAccount } from '$lib/stores/account';
import { goto, invalidateAll } from '$app/navigation';
import { onMount } from 'svelte';
import { page } from '$app/stores';

	let { children } = $props();
	let userEmail = $state<string | null>(null);
	let showHeader = $derived(
		!$page.url.pathname.startsWith('/auth') && $page.url.pathname !== '/login'
	);
	let showProfileMenu = $state(false);
	let currentTheme = $state<'default' | 'light' | 'black'>('default');
	let showAddFundsModal = $state(false);
	let addFundsAmount = $state('');
	let addFundsDescription = $state('');
	let addFundsError = $state<string | null>(null);
	let addFundsLoading = $state(false);
	let addFundsSuccess = $state<string | null>(null);
	let tradingBotEnabled = $state(false);
	let tradingBotLoading = $state(false);
	let tradingBotError = $state<string | null>(null);
	let botSymbols = $state('BTC-USD');
	let botSymbolsLoading = $state(false);
	let currentUserId = $state<string | null>(null);
	let botActions = $state<BotAction[]>([]);
	let botPanelOpen = $state(true);
	let botSubscription = $state<any>(null);
	let botActionsInterval: ReturnType<typeof setInterval> | null = null;
	let botSubscriptionRetryTimer: ReturnType<typeof setTimeout> | null = null;

	type BotAction = {
		id: string;
		action_type: string;
		symbol?: string | null;
		message: string;
		details?: Record<string, any> | null;
		created_at: string;
	};

	const formatBotTimestamp = (value: string) => {
		try {
			return new Intl.DateTimeFormat('fr-CA', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			}).format(new Date(value));
		} catch (error) {
			return '';
		}
	};

	const loadTradingBotSetting = async () => {
		tradingBotError = null;
		tradingBotLoading = true;
		try {
			const response = await fetch('/api/settings/trading-bot', { credentials: 'include' });
			if (!response.ok) {
				return;
			}
			const data = await response.json();
			tradingBotEnabled = Boolean(data?.enabled);
			botSymbols = data?.symbols || 'BTC-USD';
		} catch (error) {
			tradingBotError = 'Impossible de charger le statut du bot.';
		} finally {
			tradingBotLoading = false;
		}
	};

	const loadBotActions = async (userId: string) => {
		try {
			const { data, error } = await supabase
				.from('bot_actions')
				.select('*')
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
				.limit(30);

			if (!error) {
				botActions = (data ?? []) as BotAction[];
			}
		} catch (error) {
		}
	};

	const subscribeBotActions = (userId: string) => {
		if (botSubscriptionRetryTimer) {
			clearTimeout(botSubscriptionRetryTimer);
			botSubscriptionRetryTimer = null;
		}

		if (botSubscription) {
			supabase.removeChannel(botSubscription);
			botSubscription = null;
		}

		botSubscription = supabase
			.channel(`bot-actions-${userId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'bot_actions',
					filter: `user_id=eq.${userId}`
				},
				(payload: RealtimePostgresInsertPayload<BotAction>) => {
					const action = payload.new as BotAction;
					botActions = [action, ...botActions.filter((entry) => entry.id !== action.id)].slice(0, 50);
					void loadBotActions(userId);
				}
			)
			.subscribe((status: string) => {
				console.log(`[Bot Actions] Subscription status: ${status}`);
				if (status === 'SUBSCRIBED') {
					void loadBotActions(userId);
					return;
				}

				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
					if (botSubscriptionRetryTimer || currentUserId !== userId) {
						return;
					}

					botSubscriptionRetryTimer = setTimeout(() => {
						botSubscriptionRetryTimer = null;
						if (currentUserId === userId) {
							subscribeBotActions(userId);
						}
					}, 1000);
				}
			});
	};

	const startBotActionsPolling = (userId: string) => {
		if (botActionsInterval) return;
		botActionsInterval = setInterval(() => {
			loadBotActions(userId);
		}, 3000);
	};

	const stopBotActionsPolling = () => {
		if (botActionsInterval) {
			clearInterval(botActionsInterval);
			botActionsInterval = null;
		}
		if (botSubscriptionRetryTimer) {
			clearTimeout(botSubscriptionRetryTimer);
			botSubscriptionRetryTimer = null;
		}
	};

	onMount(() => {
		const refreshUser = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			userEmail = user?.email || null;
			currentUserId = user?.id ?? null;
			if (user) {
				await loadTradingBotSetting();
				await loadBotActions(user.id);
				subscribeBotActions(user.id);
				startBotActionsPolling(user.id);
			} else if (botSubscription) {
				supabase.removeChannel(botSubscription);
				botSubscription = null;
				botActions = [];
				stopBotActionsPolling();
			}
			if (!user && !$page.url.pathname.startsWith('/auth') && $page.url.pathname !== '/login') {
				goto('/login');
			}
		};

		const refreshAccount = async () => {
			try {
				const response = await fetch('/api/account', { credentials: 'include' });
				if (!response.ok) return;
				const data = await response.json();
				if (data?.account) {
					setAccount(data.account);
				}
			} catch (error) {
			}
		};

		refreshUser();
		refreshAccount();

		const {
			data: { subscription: authSubscription }
		} = supabase.auth.onAuthStateChange((event: string) => {
			void refreshUser();
			void refreshAccount();
			if (event === 'SIGNED_OUT') {
				void invalidateAll();
				void goto('/login', { replaceState: true });
			}
		});

		const handleFocus = () => {
			refreshUser();
			refreshAccount();
		};

		window.addEventListener('focus', handleFocus);
		document.addEventListener('visibilitychange', handleFocus);

		const savedTheme = localStorage.getItem('theme') as 'default' | 'light' | 'black' || 'default';
		currentTheme = savedTheme;
		if (savedTheme !== 'default') {
			document.documentElement.setAttribute('data-theme', savedTheme);
		}

		return () => {
			authSubscription.unsubscribe();
			window.removeEventListener('focus', handleFocus);
			document.removeEventListener('visibilitychange', handleFocus);
			if (botSubscription) {
				supabase.removeChannel(botSubscription);
				botSubscription = null;
			}
			stopBotActionsPolling();
		};
	});

	async function handleLogout() {
		showProfileMenu = false;
		showAddFundsModal = false;
		addFundsError = null;
		addFundsSuccess = null;
		addFundsAmount = '';
		addFundsDescription = '';
		tradingBotEnabled = false;
		tradingBotLoading = false;
		tradingBotError = null;
		botActions = [];
		if (botSubscription) {
			supabase.removeChannel(botSubscription);
			botSubscription = null;
		}
		stopBotActionsPolling();
		try {
			await fetch('/api/settings/trading-bot', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ enabled: false, symbols: botSymbols || 'BTC-USD' })
			});
		} catch (error) {
			console.error('Impossible de désactiver le bot à la déconnexion:', error);
		}
		userEmail = null;
		currentUserId = null;
		clearAccount();
		localStorage.clear();
		sessionStorage.clear();
		await supabase.auth.signOut();
		window.location.replace('/login');
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
			if (data?.account) {
				setAccount(data.account);
				window.dispatchEvent(new CustomEvent('account-updated'));
			}
		} catch (error) {
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

	async function updateTradingBotSetting(enabled: boolean, symbols?: string) {
		tradingBotError = null;
		const previous = tradingBotEnabled;
		const previousSymbols = botSymbols;
		tradingBotEnabled = enabled;
		if (symbols !== undefined) botSymbols = symbols;
		tradingBotLoading = true;
		
		try {
			const response = await fetch('/api/settings/trading-bot', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ 
					enabled,
					symbols: symbols !== undefined ? symbols : botSymbols
				})
			});

			if (!response.ok) {
				let errorMessage = 'Erreur lors de la mise a jour.';
				try {
					const data = await response.json();
					errorMessage = data?.error || errorMessage;
				} catch {
				}
				throw new Error(errorMessage);
			}

			tradingBotError = null;
			
			if (enabled && currentUserId) {
				await loadBotActions(currentUserId);
			}
		} catch (error) {
			tradingBotEnabled = previous;
			botSymbols = previousSymbols;
			tradingBotError = error instanceof Error ? error.message : 'Erreur lors de la mise a jour.';
			console.error('[Bot Settings Error]', error);
		} finally {
			tradingBotLoading = false;
		}
	}

	function handleTradingBotToggle(event: Event) {
		const target = event.target as HTMLInputElement | null;
		if (!target) return;
		updateTradingBotSetting(target.checked);
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
								<div class="theme-section-title" style="display: flex; align-items: center; gap: 0.5rem;">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="12" cy="12" r="1"></circle>
										<path d="M12 7v10M5 12h14"></path>
									</svg>
									Trading bot
								</div>
								<div class="profile-menu-item bot-settings">
									<div class="bot-settings-info">
										<span>Activer le bot de trading</span>
									</div>
									<label class="switch">
										<input
											type="checkbox"
											checked={tradingBotEnabled}
											onchange={handleTradingBotToggle}
											disabled={tradingBotLoading}
										/>
										<span class="switch-slider"></span>
									</label>
								</div>
								
								{#if tradingBotEnabled}
									<div class="bot-symbols-config">
										<label for="bot-symbols">Symboles à trader</label>
										<textarea
											id="bot-symbols"
											bind:value={botSymbols}
											disabled={tradingBotLoading}
											placeholder="BTC-USD"
											rows="3"
										></textarea>
										<button 
											class="bot-symbols-save"
											onclick={() => updateTradingBotSetting(true, botSymbols)}
											disabled={tradingBotLoading}
										>
											{tradingBotLoading ? '⏳ Mise à jour...' : '✓ Sauvegarder les symboles'}
										</button>
										<small class="bot-symbols-hint">Séparez les symboles par des virgules</small>
									</div>
								{/if}
								
								{#if tradingBotError}
									<div class="bot-settings-error">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<circle cx="12" cy="12" r="10"></circle>
											<line x1="12" y1="8" x2="12" y2="12"></line>
											<line x1="12" y1="16" x2="12.01" y2="16"></line>
										</svg>
										{tradingBotError}
									</div>
								{/if}
								
								<div class="profile-menu-divider"></div>
								<div class="theme-section-title">Thèmes</div>
								<button class="profile-menu-item" class:active={currentTheme === 'default'} onclick={() => setTheme('default')}>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>
										<path d="M6.5 6.5l.6 1.2 1.4.2-1 .9.2 1.4-1.2-.6-1.2.6.2-1.4-1-.9 1.4-.2.6-1.2z"></path>
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
										<rect x="4" y="4" width="16" height="16" rx="3" ry="3" fill="currentColor" stroke="none"></rect>
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
			</nav>
		</header>
	{/if}

	<main class:full-page={!showHeader}>
		{@render children()}
	</main>

	{#if tradingBotEnabled}
		<aside class="bot-panel" aria-live="polite">
			<div class="bot-panel-header">
				<div>
					<strong>Journal du bot</strong>
					<span>Suivi en temps reel</span>
				</div>
				<button
					class="bot-panel-toggle"
					type="button"
					onclick={() => (botPanelOpen = !botPanelOpen)}
					aria-expanded={botPanelOpen}
				>
					{botPanelOpen ? 'Replier' : 'Ouvrir'}
				</button>
			</div>
			{#if botPanelOpen}
				<div class="bot-panel-body">
					{#if botActions.length === 0}
						<div class="bot-panel-empty">Aucune action pour le moment.</div>
					{:else}
						<ul class="bot-panel-list">
							{#each botActions as action (action.id)}
								<li class="bot-panel-item">
									<div class="bot-panel-line">
										<span class="bot-panel-time">{formatBotTimestamp(action.created_at)}</span>
										<span class="bot-panel-message">{action.message}</span>
									</div>
									{#if action.symbol}
										<div class="bot-panel-symbol">{action.symbol}</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</aside>
	{/if}

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
		min-width: 310px;
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

	.bot-settings {
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.bot-settings-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.bot-settings-error {
		padding: 0.75rem 1.5rem;
		color: var(--accent-red);
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(239, 68, 68, 0.1);
		border-left: 3px solid var(--accent-red);
	}

	.bot-symbols-config {
		padding: 0 1.5rem 1rem;
		border-top: 1px solid var(--border-primary);
		margin-top: 0.5rem;
	}

	.bot-symbols-config label {
		display: block;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.bot-symbols-config textarea {
		width: 100%;
		padding: 0.6rem 0.8rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		color: var(--text-primary);
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.85rem;
		resize: vertical;
		outline: none;
		transition: all 0.2s;
	}

	.bot-symbols-config textarea:focus {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.bot-symbols-config textarea:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.bot-symbols-save {
		margin-top: 0.75rem;
		width: 100%;
		padding: 0.75rem;
		background: linear-gradient(135deg, var(--accent-primary), #0652dd);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.bot-symbols-save:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
	}

	.bot-symbols-save:disabled {
		opacity: 0.7;
		cursor: not-allowed;
		box-shadow: none;
	}

	.bot-symbols-hint {
		display: block;
		margin-top: 0.5rem;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.switch {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
		flex-shrink: 0;
	}

	.switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.switch-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--border-secondary);
		transition: 0.2s;
		border-radius: 999px;
	}

	.switch-slider:before {
		position: absolute;
		content: '';
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background: var(--bg-secondary);
		transition: 0.2s;
		border-radius: 999px;
		box-shadow: var(--shadow-sm);
	}

	.switch input:checked + .switch-slider {
		background: var(--accent-green);
	}

	.switch input:checked + .switch-slider:before {
		transform: translateX(20px);
	}

	.switch input:disabled + .switch-slider {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.bot-panel {
		position: fixed;
		left: 1.5rem;
		bottom: 1.5rem;
		width: 310px;
		max-width: calc(100% - 3rem);
		background: linear-gradient(135deg, var(--bg-secondary), rgba(var(--bg-secondary-rgb), 0.95));
		border: 1px solid rgba(59, 130, 246, 0.15);
		border-radius: 16px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
					inset 0 0 1px rgba(59, 130, 246, 0.1);
		z-index: 900;
		overflow: hidden;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.bot-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid rgba(59, 130, 246, 0.1);
		background: linear-gradient(90deg, rgba(59, 130, 246, 0.1), transparent);
	}

	.bot-panel-header strong {
		display: block;
		font-size: 0.95rem;
		color: var(--text-primary);
		font-weight: 600;
	}

	.bot-panel-header span {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.bot-panel-toggle {
		background: rgba(59, 130, 246, 0.15);
		border: 1px solid rgba(59, 130, 246, 0.3);
		color: var(--text-primary);
		border-radius: 6px;
		padding: 0.4rem 0.8rem;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.bot-panel-toggle:hover {
		background: rgba(59, 130, 246, 0.25);
		border-color: rgba(59, 130, 246, 0.5);
	}

	.bot-panel-body {
		max-height: 350px;
		overflow-y: auto;
		padding: 0.75rem 1.25rem 1rem;
	}

	.bot-panel-empty {
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.bot-panel-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bot-panel-item {
		padding: 0.75rem;
		border-left: 3px solid rgba(59, 130, 246, 0.4);
		border-radius: 6px;
		background: rgba(59, 130, 246, 0.05);
		border-bottom: none;
		padding-bottom: 0.75rem;
		animation: slideIn 0.3s ease;
	}

	.bot-panel-item:last-child {
		border-bottom: none;
		padding-bottom: 0.75rem;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateX(-10px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.bot-panel-line {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		flex-wrap: wrap;
	}

	.bot-panel-time {
		font-size: 0.7rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.bot-panel-message {
		font-size: 0.85rem;
		color: var(--text-primary);
		flex: 1;
	}

	.bot-panel-symbol {
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--accent-primary);
		font-weight: 700;
		text-transform: uppercase;
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
