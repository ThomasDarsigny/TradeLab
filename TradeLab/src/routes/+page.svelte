<script lang="ts">
	import { onMount } from 'svelte';
	import type { Account, Position, Transaction } from '$lib/types/account';
	import PortfolioCharts from '$lib/components/PortfolioCharts.svelte';
	import TransactionsHistory from '$lib/components/TransactionsHistory.svelte';

	let account = $state<Account | null>(null);
	let positions = $state<Position[]>([]);
	let transactions = $state<Transaction[]>([]);
	let loading = $state(true);
	let error = $state('');

	const handleLogoError = (event: Event) => {
		const target = event.currentTarget as HTMLImageElement | null;
		if (target) {
			const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="rgba(59, 130, 246, 0.1)" width="40" height="40" rx="10"/><circle cx="20" cy="20" r="6" fill="rgba(59, 130, 246, 0.8)"/></svg>`;
			target.src = 'data:image/svg+xml;base64,' + btoa(svg);
		}
	};

	const currency = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

	const totalInvested = $derived(
		positions.reduce((sum, pos) => sum + pos.quantity * pos.entry_price, 0)
	);

	const totalCurrent = $derived(
		positions.reduce((sum, pos) => sum + pos.quantity * pos.current_price, 0)
	);

	const totalGain = $derived(totalCurrent - totalInvested);

	const gainForLifetime = $derived.by(() => {
		if (!transactions) return 0;

		return transactions.reduce((total, tx) => {
			if (tx.type === 'sell') {
				const profitLoss = Number(tx.metadata?.profit_loss);
				return Number.isFinite(profitLoss) ? total + profitLoss : total;
			}
			if (tx.type === 'dividend') return total + tx.amount;
			return total;
		}, 0);
	});

	async function loadPortfolio() {
		loading = true;
		error = '';
		try {
			const [accountRes, positionsRes, transactionsRes] = await Promise.all([
				fetch('/api/account', { credentials: 'include' }),
				fetch('/api/account/positions', { credentials: 'include' }),
				fetch('/api/account/transactions?limit=100', { credentials: 'include' }),
			]);

			if (!accountRes.ok) {
				const data = await accountRes.json().catch(() => null);
				throw new Error(data?.error || 'Compte introuvable');
			}

			const accountData = await accountRes.json();
			account = accountData.account;

			if (positionsRes.ok) {
				const data = await positionsRes.json();
				positions = data.positions || [];
			}

			if (transactionsRes.ok) {
				const data = await transactionsRes.json();
				transactions = data.transactions || [];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur lors du chargement';
		} finally {
			loading = false;
		}
	}

	async function updateAccountData() {
		try {
			const accountRes = await fetch('/api/account', { credentials: 'include' });

			if (accountRes.ok) {
				const accountData = await accountRes.json();
				if (accountData.account) {
					account = accountData.account;
				}
			}
		} catch (err) {
		}
	}

	function positionsHaveChanged(oldPositions: Position[], newPositions: Position[]): boolean {
		if (oldPositions.length !== newPositions.length) return true;
		
		for (let i = 0; i < oldPositions.length; i++) {
			const old = oldPositions[i];
			const newPos = newPositions[i];
			
			if (old.symbol !== newPos.symbol || 
				old.quantity !== newPos.quantity || 
				old.entry_price !== newPos.entry_price) {
				return true;
			}
		}
		return false;
	}

	async function updatePositionsData() {
		try {
			const positionsRes = await fetch('/api/account/positions', { credentials: 'include' });

			if (positionsRes.ok) {
				const positionsData = await positionsRes.json();
				if (positionsData.positions) {
					const newPositions = positionsData.positions || [];
					
					if (positionsHaveChanged(positions, newPositions)) {
						positions = newPositions;
					}
				}
			}
		} catch (err) {
		}
	}

	async function updateTransactionsData() {
		try {
			const transactionsRes = await fetch('/api/account/transactions?limit=100', {
				credentials: 'include'
			});

			if (transactionsRes.ok) {
				const data = await transactionsRes.json();
				if (data.transactions) {
					transactions = data.transactions || [];
				}
			}
		} catch (err) {
		}
	}

	onMount(() => {
		loadPortfolio();
		
		const accountInterval = setInterval(() => {
			updateAccountData();
		}, 5000);
		
		const positionsInterval = setInterval(() => {
			updatePositionsData();
		}, 15000);

		const transactionsInterval = setInterval(() => {
			updateTransactionsData();
		}, 10000);
		
		return () => {
			clearInterval(accountInterval);
			clearInterval(positionsInterval);
			clearInterval(transactionsInterval);
		};
	});
</script>

<svelte:head>
	<title>TradeLab - Portefeuille</title>
	<meta name="description" content="Plateforme bourse et actualites financieres" />
</svelte:head>

<div class="portfolio-page">
	<div class="page-header">
		<div>
			<h1>Portefeuille</h1>
			<p>Vue d'ensemble de votre compte, positions et performances.</p>
		</div>
		<button class="refresh" type="button" onclick={loadPortfolio} disabled={loading}>
			{loading ? 'Chargement...' : 'Rafraichir'}
		</button>
	</div>

	{#if error}
		<div class="error-banner">{error}</div>
	{:else if loading}
		<div class="loading">Chargement du portefeuille...</div>
	{:else}
		<section class="summary-grid">
			<div class="summary-card">
				<span>Solde courant</span>
				<strong>${currency.format(account?.current_balance ?? 0)}</strong>
			</div>
			<div class="summary-card">
				<span>Solde disponible</span>
				<strong>${currency.format(account?.available_balance ?? 0)}</strong>
			</div>
			<div class="summary-card">
				<span>Valeur des positions</span>
				<strong>${currency.format(totalCurrent)}</strong>
			</div>
			<div class="summary-card gain-loss-card" class:positive={gainForLifetime >= 0} class:negative={gainForLifetime < 0}>
				<span>Gain / Perte</span>
				<strong>{gainForLifetime >= 0 ? '+' : ''}${currency.format(gainForLifetime)}</strong>
			</div>
		</section>

		<section class="charts-section">
			{#if positions.length > 0}
				<PortfolioCharts positions={positions} accountBalance={account?.current_balance ?? 0} />
			{:else}
				<div class="empty-card">Aucune position ouverte pour le moment.</div>
			{/if}
		</section>

		<section class="positions-section">
			<div class="section-header">
				<h3>Titres possedés</h3>
				<p>Cliquez sur un titre pour voir les détails.</p>
			</div>
			{#if positions.length > 0}
				<div class="positions-grid">
					{#each positions as pos (pos.symbol)}
						<a class="position-card" href={`/stock/${pos.symbol}`}>
							<div class="position-main">
								<img
									class="position-logo"
									src={`/api/stock/logo/${pos.symbol}`}
									alt={`Logo ${pos.symbol}`}
									loading="lazy"
									decoding="async"
									onerror={handleLogoError}
								/>
								<div>
									<strong>{pos.symbol}</strong>
								</div>
							</div>
							<div class="position-meta">
								<span>Quantité: {pos.quantity}</span>
								<span>Prix: ${currency.format(pos.current_price)}</span>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="empty-card">Aucun titre détenu.</div>
			{/if}
		</section>

		<section class="history-section">
			<TransactionsHistory transactions={transactions} />
		</section>
	{/if}
</div>

<style>
	.portfolio-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2.5rem 2rem 4rem;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.35rem 0;
		color: var(--text-primary);
	}

	.page-header p {
		margin: 0;
		color: var(--text-secondary);
	}

	.refresh {
		padding: 0.6rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--border-primary);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		cursor: pointer;
	}

	.refresh:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.summary-card {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05));
		border: 1px solid rgba(59, 130, 246, 0.2);
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 4px 6px -2px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.05), inset 0 0 1px rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.3s ease;
	}

	.summary-card:hover {
		border-color: rgba(59, 130, 246, 0.3);
		box-shadow: 0 12px 24px -8px rgba(59, 130, 246, 0.1), 0 0 0 1px rgba(59, 130, 246, 0.1);
	}

	.summary-card span {
		color: var(--text-secondary);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.summary-card strong {
		color: var(--text-primary);
		font-size: 1.4rem;
	}

	.gain-loss-card.positive strong {
		color: var(--accent-green);
	}

	.gain-loss-card.negative strong {
		color: var(--accent-red);
	}

	.charts-section {
		margin-top: 2rem;
	}

	.positions-section {
		margin-top: 2rem;
	}

	.section-header h3 {
		margin: 0 0 0.35rem 0;
		color: var(--text-primary);
		font-size: 1.2rem;
	}

	.section-header p {
		margin: 0 0 1.25rem 0;
		color: var(--text-secondary);
		font-size: 0.95rem;
	}

	.positions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.25rem;
	}

	.position-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1.25rem;
		border-radius: 12px;
		border: 1px solid rgba(59, 130, 246, 0.1);
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.02));
		color: inherit;
		text-decoration: none;
		box-shadow: 0 4px 6px -2px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.05);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.position-card:hover {
		transform: translateY(-4px);
		border-color: rgba(59, 130, 246, 0.2);
		box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1);
	}

	.position-main {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.position-logo {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-primary);
		object-fit: contain;
	}

	.position-card strong {
		display: block;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.position-card span {
		display: block;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.position-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.history-section {
		margin-top: 2rem;
	}

	.loading,
	.error-banner,
	.empty-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 1.5rem;
		color: var(--text-secondary);
	}

	.error-banner {
		border-color: rgba(239, 68, 68, 0.5);
		color: var(--accent-red);
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
