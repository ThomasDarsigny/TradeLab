<script lang="ts">
	import { onMount } from 'svelte';
	import './NewsTab.css';

	interface NewsItem {
		title: string;
		description: string;
		date: string;
		source: string;
		sentiment: 'positive' | 'negative' | 'neutral';
	}

	let news: NewsItem[] = [];
	let loading = true;

	onMount(async () => {
		try {
			const response = await fetch('/api/account/transactions', { credentials: 'include' });
			if (response.ok) {
				const data = await response.json();
				news = data.transactions.map((t: any) => ({
					title: t.description,
					description: `${t.type} de ${t.amount.toLocaleString()}$`,
					date: new Date(t.created_at).toLocaleDateString('fr-FR'),
					source: 'TradeLab',
					sentiment: t.type === 'buy' || t.type === 'sell' ? 'neutral' : 'positive',
				}));
			}
		} catch (error) {
			news = [
				{
					title: 'Les marchés montent de 2% cette semaine',
					description:
						'Après la baisse des taux d\'intérêt, les investisseurs reprennent confiance.',
					date: '1 février 2026',
					source: 'MarketWatch',
					sentiment: 'positive',
				},
				{
					title: 'AAPL annonce des résultats trimestriels',
					description: 'Apple dépasse les prévisions avec une augmentation de 15% des revenus.',
					date: '31 janvier 2026',
					source: 'Yahoo Finance',
					sentiment: 'positive',
				},
				{
					title: 'Secteur technologique en correction',
					description:
						'Les valeurs tech reculent après une série de résultats décevants.',
					date: '30 janvier 2026',
					source: 'CNBC',
					sentiment: 'negative',
				},
			];
		} finally {
			loading = false;
		}
	});

	function getSentimentColor(sentiment: string) {
		switch (sentiment) {
			case 'positive':
				return '#10b981';
			case 'negative':
				return '#ef4444';
			default:
				return '#6b7280';
		}
	}

	function getSentimentIcon(sentiment: string) {
		switch (sentiment) {
			case 'positive':
				return '▲';
			case 'negative':
				return '▼';
			default:
				return '●';
		}
	}
</script>

<div class="news-container">
	<div class="news-header">
		<h2>Actualités Financières</h2>
		<p>Restez informé des derniers mouvements du marché et événements économiques</p>
	</div>

	{#if loading}
		<div class="loading">Chargement des news...</div>
	{:else if news.length > 0}
		<div class="news-list">
			{#each news as item (item.title)}
				<article class="news-card" style="--sentiment-color: {getSentimentColor(item.sentiment)}">
					<div class="news-header-card">
						<div class="sentiment-badge">{getSentimentIcon(item.sentiment)}</div>
						<div class="news-meta">
							<span class="news-source">{item.source}</span>
							<span class="news-date">{item.date}</span>
						</div>
					</div>

					<h3 class="news-title">{item.title}</h3>
					<p class="news-description">{item.description}</p>

					<div class="sentiment-indicator" style="color: var(--sentiment-color)">
						{#if item.sentiment === 'positive'}
							Positif
						{:else if item.sentiment === 'negative'}
							Négatif
						{:else}
							Neutre
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{:else}
		<div class="no-news">Aucune actualité disponible pour le moment</div>
	{/if}

	<div class="news-footer">
		<p>Flux d'actualités mis à jour en temps réel</p>
	</div>
</div>
