<script lang="ts">
	import { onMount } from 'svelte';
	import type { Position } from '$lib/types/account';

	let positions: Position[] = [];
	let loading = true;
	let totalValue = 0;

	onMount(async () => {
		try {
			const response = await fetch('/api/account/positions');
			if (response.ok) {
				const data = await response.json();
				positions = data.positions;
				totalValue = positions.reduce((sum, pos) => sum + pos.quantity * pos.current_price, 0);
			}
		} catch (error) {
			console.error('Erreur:', error);
		} finally {
			loading = false;
		}
	});

	function calculateProfitLoss(position: Position) {
		const invested = position.quantity * position.entry_price;
		const current = position.quantity * position.current_price;
		return current - invested;
	}

	function calculateProfitLossPercent(position: Position) {
		const invested = position.quantity * position.entry_price;
		if (invested === 0) return 0;
		return ((position.current_price - position.entry_price) / position.entry_price) * 100;
	}
</script>

<div class="placements-container">
	<div class="placements-header">
		<h2>Gestion de Portefeuille</h2>
		<p>Surveillez vos positions et suivez vos performances d'investissement</p>
	</div>

	{#if loading}
		<div class="loading">Chargement de vos positions...</div>
	{:else if positions.length > 0}
		<div class="portfolio-summary">
			<div class="summary-card">
				<div class="summary-label">Valeur du Portefeuille</div>
				<div class="summary-value">${totalValue.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
			</div>
			<div class="summary-card">
				<div class="summary-label">Positions Ouvertes</div>
				<div class="summary-value">{positions.length}</div>
			</div>
		</div>

		<div class="positions-list">
			{#each positions as position (position.id)}
				{@const profitLoss = calculateProfitLoss(position)}
				{@const profitLossPercent = calculateProfitLossPercent(position)}
				<div class="position-card">
					<div class="position-header">
						<div class="symbol-section">
							<h3 class="symbol">{position.symbol}</h3>
							<span class="status-badge">{position.quantity} shares</span>
						</div>
						<div class="price-section">
							<div class="current-price">${position.current_price.toFixed(2)}</div>
							<div
								class="price-change"
								class:positive={profitLossPercent > 0}
								class:negative={profitLossPercent < 0}
							>
								{profitLossPercent > 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%
							</div>
						</div>
					</div>

					<div class="position-details">
						<div class="detail-row">
							<span class="detail-label">Prix d'Entrée</span>
							<span class="detail-value">${position.entry_price.toFixed(2)}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Montant Investi</span>
							<span class="detail-value">${(position.quantity * position.entry_price).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Valeur Actuelle</span>
							<span class="detail-value">${(position.quantity * position.current_price).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</span>
						</div>
						<div class="detail-row profit-loss">
							<span class="detail-label">Gain/Perte</span>
							<span
								class="detail-value"
								class:positive={profitLoss > 0}
								class:negative={profitLoss < 0}
							>
								{profitLoss > 0 ? '+' : ''}{profitLoss.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}$
							</span>
						</div>
					</div>

					<div class="position-actions">
						<button class="btn-sell">Vendre</button>
						<button class="btn-more">Détails</button>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="no-positions">
			<div class="empty-state">
				<div class="empty-icon">
					<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 3v18h18"/>
						<path d="M7 16l4-8 4 4 4-12"/>
					</svg>
				</div>
				<h3>Aucune Position Ouverte</h3>
				<p>Commencez à trader en achetant vos premières actions pour construire votre portefeuille.</p>
				<button class="btn-buy">Acheter des Actions</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.placements-container {
		max-width: 1100px;
		margin: 0 auto;
	}

	.placements-header {
		margin-bottom: 2.5rem;
	}

	.placements-header h2 {
		font-size: 2rem;
		color: var(--text-primary);
		margin-bottom: 0.75rem;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.placements-header p {
		color: var(--text-secondary);
		font-size: 1.0625rem;
	}

	.portfolio-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2.5rem;
	}

	.summary-card {
		background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 2rem;
		text-align: center;
		position: relative;
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.summary-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--accent-primary), #60a5fa);
	}

	.summary-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-xl);
		border-color: var(--border-secondary);
	}

	.summary-label {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	.summary-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.025em;
	}

	.positions-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.position-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 1.75rem;
		transition: all 0.3s ease;
		position: relative;
	}

	.position-card:hover {
		box-shadow: var(--shadow-lg);
		border-color: var(--border-secondary);
		transform: translateY(-2px);
	}

	.position-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--border-primary);
		padding-bottom: 1.25rem;
	}

	.symbol-section h3 {
		font-size: 1.5rem;
		color: var(--text-primary);
		margin: 0 0 0.75rem 0;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.status-badge {
		display: inline-block;
		background: var(--bg-tertiary);
		color: var(--accent-primary);
		padding: 0.375rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		border: 1px solid var(--border-primary);
	}

	.price-section {
		text-align: right;
	}

	.current-price {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		letter-spacing: -0.025em;
	}

	.price-change {
		font-size: 0.9375rem;
		font-weight: 700;
		margin-top: 0.25rem;
		padding: 0.25rem 0.75rem;
		border-radius: 6px;
		display: inline-block;
	}

	.price-change.positive {
		color: var(--accent-green);
		background: rgba(16, 185, 129, 0.1);
	}

	.price-change.negative {
		color: var(--accent-red);
		background: rgba(239, 68, 68, 0.1);
	}

	.position-details {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-primary);
		border-radius: 12px;
		padding: 1.25rem;
		margin-bottom: 1.25rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border-primary);
	}

	.detail-row:last-child {
		border-bottom: none;
	}

	.detail-label {
		color: var(--text-secondary);
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.detail-value {
		color: var(--text-primary);
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.detail-value.positive {
		color: var(--accent-green);
	}

	.detail-value.negative {
		color: var(--accent-red);
	}

	.position-actions {
		display: flex;
		gap: 0.75rem;
	}

	button {
		flex: 1;
		padding: 0.875rem 1.25rem;
		border: none;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		font-size: 0.9375rem;
	}

	.btn-sell {
		background: linear-gradient(135deg, var(--accent-red) 0%, #dc2626 100%);
		color: white;
		box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
	}

	.btn-sell:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
	}

	.btn-more {
		background: var(--bg-tertiary);
		color: var(--accent-primary);
		border: 1px solid var(--border-primary);
	}

	.btn-more:hover {
		background: rgba(59, 130, 246, 0.1);
		border-color: var(--accent-primary);
		transform: translateY(-2px);
	}

	.btn-buy {
		background: linear-gradient(135deg, var(--accent-green) 0%, #059669 100%);
		color: white;
		padding: 1rem 2rem;
		margin-top: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
	}

	.btn-buy:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
	}

	.no-positions {
		text-align: center;
		padding: 4rem 2rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 20px;
		padding: 4rem 2rem;
	}

	.empty-icon {
		width: 80px;
		height: 80px;
		color: var(--text-muted);
		opacity: 0.5;
	}

	.empty-state h3 {
		color: var(--text-primary);
		font-size: 1.5rem;
		margin: 0;
		font-weight: 700;
	}

	.empty-state p {
		color: var(--text-secondary);
		max-width: 400px;
		line-height: 1.6;
	}

	.loading {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-secondary);
		font-size: 1.125rem;
	}

	@media (max-width: 768px) {
		.position-header {
			flex-direction: column;
			gap: 1.25rem;
		}

		.price-section {
			text-align: left;
		}

		.position-actions {
			flex-direction: column;
		}

		.summary-card {
			padding: 1.5rem;
		}

		.position-card {
			padding: 1.25rem;
		}
	}
</style>

