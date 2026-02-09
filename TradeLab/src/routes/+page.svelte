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
			target.style.display = 'none';
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

	onMount(() => {
		loadPortfolio();
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
			<div class="summary-card" class:positive={totalGain >= 0} class:negative={totalGain < 0}>
				<span>Gain / Perte</span>
				<strong>{totalGain >= 0 ? '+' : ''}${currency.format(totalGain)}</strong>
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
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 1.25rem;
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.summary-card span {
		color: var(--text-secondary);
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.summary-card strong {
		color: var(--text-primary);
		font-size: 1.4rem;
	}

	.summary-card.positive strong {
		color: var(--accent-green);
	}

	.summary-card.negative strong {
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
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}

	.position-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1.2rem;
		border-radius: 16px;
		border: 1px solid var(--border-primary);
		background: var(--bg-secondary);
		color: inherit;
		text-decoration: none;
		box-shadow: var(--shadow-lg);
		transition: transform 0.2s ease, border-color 0.2s ease;
	}

	.position-card:hover {
		transform: translateY(-2px);
		border-color: rgba(59, 130, 246, 0.5);
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
