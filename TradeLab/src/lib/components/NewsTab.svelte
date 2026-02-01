<script lang="ts">
	import { onMount } from 'svelte';

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
			const response = await fetch('/api/account/transactions');
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
			console.error('Erreur:', error);
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

<style>
	.news-container {
		max-width: 900px;
		margin: 0 auto;
	}

	.news-header {
		margin-bottom: 2.5rem;
	}

	.news-header h2 {
		font-size: 2rem;
		color: var(--text-primary);
		margin-bottom: 0.75rem;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.news-header p {
		color: var(--text-secondary);
		font-size: 1.0625rem;
	}

	.news-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.news-card {
		background: var(--bg-secondary);
		border-left: 3px solid var(--sentiment-color);
		border: 1px solid var(--border-primary);
		border-left: 3px solid var(--sentiment-color);
		border-radius: 12px;
		padding: 1.75rem;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.news-card::before {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 4px;
		background: var(--sentiment-color);
		opacity: 0.2;
	}

	.news-card:hover {
		box-shadow: var(--shadow-lg);
		transform: translateX(4px);
		border-color: var(--border-secondary);
	}

	.news-header-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.sentiment-badge {
		font-size: 1.25rem;
		min-width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border-radius: 10px;
		border: 1px solid var(--border-primary);
		font-weight: 700;
		color: var(--sentiment-color);
	}

	.news-meta {
		display: flex;
		gap: 1.25rem;
		font-size: 0.875rem;
		flex-wrap: wrap;
	}

	.news-source {
		font-weight: 600;
		color: var(--text-primary);
		padding: 0.25rem 0.75rem;
		background: var(--bg-tertiary);
		border-radius: 6px;
	}

	.news-date {
		color: var(--text-muted);
		display: flex;
		align-items: center;
	}

	.news-title {
		font-size: 1.25rem;
		color: var(--text-primary);
		margin-bottom: 0.75rem;
		margin-top: 0;
		font-weight: 600;
		line-height: 1.4;
	}

	.news-description {
		color: var(--text-secondary);
		line-height: 1.7;
		margin-bottom: 1rem;
		font-size: 0.9375rem;
	}

	.sentiment-indicator {
		font-size: 0.875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		display: inline-block;
		padding: 0.375rem 0.875rem;
		border-radius: 6px;
		background: rgba(var(--sentiment-color-rgb), 0.1);
	}

	.loading,
	.no-news {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-secondary);
		font-size: 1.125rem;
	}

	.news-footer {
		margin-top: 3rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.875rem;
		padding: 1.5rem;
		border-top: 1px solid var(--border-primary);
	}

	@media (max-width: 768px) {
		.news-card {
			padding: 1.25rem;
		}

		.news-header-card {
			flex-wrap: wrap;
		}

		.news-title {
			font-size: 1.125rem;
		}
	}
</style>
