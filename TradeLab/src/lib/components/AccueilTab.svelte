<script lang="ts">
	import { onMount } from 'svelte';
	import type { Account } from '$lib/types/account';
	import './AccueilTab.css';

	let account: Account | null = null;
	let stats: any = null;
	let loading = true;

	onMount(async () => {
		try {
			const response = await fetch('/api/account', { credentials: 'include' });
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
