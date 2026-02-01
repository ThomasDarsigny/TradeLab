<script lang="ts">
	import { onMount } from 'svelte';
	import type { Account } from '$lib/types/account';

	let account: Account | null = null;
	let stats: any = null;
	let loading = true;

	onMount(async () => {
		try {
			const response = await fetch('/api/account');
			if (response.ok) {
				const data = await response.json();
				account = data.account;
				stats = data.stats;
			}
		} catch (error) {
			console.error('Erreur:', error);
		} finally {
			loading = false;
		}
	});
</script>

<div class="accueil-container">
	<div class="welcome-section">
		<h2>Bienvenue sur TradeLab</h2>
		<p>Plateforme professionnelle de trading papier pour apprendre sans risque</p>
	</div>

	{#if loading}
		<div class="loading">Chargement de vos données...</div>
	{:else if account}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-label">Solde Disponible</div>
				<div class="stat-value">${account.available_balance.toLocaleString()}</div>
				<div class="stat-percent">Liquidités</div>
			</div>

			<div class="stat-card">
				<div class="stat-label">Solde Total</div>
				<div class="stat-value">${account.current_balance.toLocaleString()}</div>
				<div class="stat-percent">Total</div>
			</div>

			<div class="stat-card">
				<div class="stat-label">Gains Totaux</div>
				<div class="stat-value">{stats.gainPercent.toFixed(2)}%</div>
				<div class="stat-percent">{stats.totalGains > 0 ? '+' : ''}{stats.totalGains.toLocaleString()}$</div>
			</div>

			<div class="stat-card">
				<div class="stat-label">Rendement</div>
				<div class="stat-value">{stats.roi.toFixed(2)}%</div>
				<div class="stat-percent">ROI</div>
			</div>
		</div>

		<div class="info-section">
			<h3>Fonctionnalités de la plateforme</h3>
			<ul>
				<li><strong>Trading Papier :</strong> Pratiquez avec du capital virtuel, zéro risque financier</li>
				<li><strong>Prix en Temps Réel :</strong> Données de marché et flux de prix en direct</li>
				<li><strong>Actualités Financières :</strong> Restez informé des derniers événements du marché</li>
				<li><strong>Gestion de Portefeuille :</strong> Suivez vos positions et analysez vos performances</li>
			</ul>
		</div>

		<div class="action-buttons">
			<a href="#placements" class="btn-primary">Commencer à Trader</a>
			<a href="#news" class="btn-secondary">Voir les Actualités</a>
		</div>
	{:else}
		<div class="no-account">
			<p>Aucun compte trouvé. Veuillez vous connecter ou créer un compte.</p>
		</div>
	{/if}
</div>

<style>
	.accueil-container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.welcome-section {
		text-align: center;
		margin-bottom: 3rem;
		padding: 2rem 0;
	}

	.welcome-section h2 {
		font-size: 2.5rem;
		background: linear-gradient(135deg, var(--accent-primary) 0%, #60a5fa 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin-bottom: 1rem;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.welcome-section p {
		font-size: 1.125rem;
		color: var(--text-secondary);
		max-width: 600px;
		margin: 0 auto;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.5rem;
		margin-bottom: 3rem;
	}

	.stat-card {
		background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 2rem;
		position: relative;
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.stat-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--accent-primary), #60a5fa);
	}

	.stat-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-xl);
		border-color: var(--border-secondary);
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		letter-spacing: -0.025em;
	}

	.stat-percent {
		font-size: 0.875rem;
		color: var(--accent-green);
		font-weight: 600;
	}

	.info-section {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 2.5rem;
		margin-bottom: 2.5rem;
	}

	.info-section h3 {
		color: var(--text-primary);
		margin-bottom: 1.5rem;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.info-section ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.info-section li {
		padding: 1rem 0;
		color: var(--text-secondary);
		border-bottom: 1px solid var(--border-primary);
		line-height: 1.6;
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.info-section li::before {
		content: '✓';
		color: var(--accent-green);
		font-weight: bold;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.info-section li:last-child {
		border-bottom: none;
	}

	.info-section strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.btn-primary,
	.btn-secondary {
		padding: 1rem 2rem;
		border-radius: 12px;
		text-decoration: none;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		border: none;
		display: inline-block;
		font-size: 1rem;
		position: relative;
		overflow: hidden;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--accent-primary) 0%, #2563eb 100%);
		color: white;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
	}

	.btn-secondary {
		background: var(--bg-secondary);
		color: var(--accent-primary);
		border: 2px solid var(--accent-primary);
	}

	.btn-secondary:hover {
		background: rgba(59, 130, 246, 0.1);
		transform: translateY(-2px);
	}

	.loading,
	.no-account {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-secondary);
		font-size: 1.125rem;
	}

	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 1rem;
		}

		.welcome-section h2 {
			font-size: 1.875rem;
		}

		.stat-card {
			padding: 1.5rem;
		}

		.info-section {
			padding: 1.5rem;
		}
	}
</style>
