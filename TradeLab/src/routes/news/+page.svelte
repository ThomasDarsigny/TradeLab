<script lang="ts">
	import './+page.css';
	import type { PageData } from './$types';
	let { data } = $props<{ data: PageData }>();
	let activeTab = $state<'gnews' | 'finnhub'>('gnews');

	function getRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return 'il y a quelques secondes';
		if (diffInSeconds < 3600) return `il y a ${Math.floor(diffInSeconds / 60)} min`;
		if (diffInSeconds < 86400) return `il y a ${Math.floor(diffInSeconds / 3600)}h`;
		if (diffInSeconds < 604800) return `il y a ${Math.floor(diffInSeconds / 86400)}j`;
		if (diffInSeconds < 2592000) return `il y a ${Math.floor(diffInSeconds / 604800)} semaine${Math.floor(diffInSeconds / 604800) > 1 ? 's' : ''}`;
		return `il y a ${Math.floor(diffInSeconds / 2592000)} mois`;
	}
</script>

<svelte:head>
	<title>TradeLab - Actualités</title>
	<meta name="description" content="Dernières nouvelles des marchés financiers" />
</svelte:head>

<div class="news-container">
	<div class="header">
		<h1>Actualités Financières</h1>
	</div>

	<div class="category-switch">
		<span class="category-label">Catégories</span>
		<div class="tabs" role="tablist" aria-label="Catégories d'actualités">
			<button
				class="tab-btn {activeTab === 'gnews' ? 'active' : ''}"
				onclick={() => (activeTab = 'gnews')}
				role="tab"
				aria-selected={activeTab === 'gnews'}
			>
				Bourse
				{#await data.gnews then gnews}
					{#if gnews.success}
						<span class="badge">{gnews.articles.length}</span>
					{/if}
				{/await}
			</button>
			<button
				class="tab-btn {activeTab === 'finnhub' ? 'active' : ''}"
				onclick={() => (activeTab = 'finnhub')}
				role="tab"
				aria-selected={activeTab === 'finnhub'}
			>
				Crypto
				{#await data.finnhub then finnhub}
					{#if finnhub.success}
						<span class="badge">{finnhub.articles.length}</span>
					{/if}
				{/await}
			</button>
		</div>
	</div>

	{#await activeTab === 'gnews' ? data.gnews : data.finnhub}
		<div class="news-grid" aria-busy="true" aria-label="Chargement des actualités">
			{#each { length: 6 }}
				<div class="news-card skeleton" aria-hidden="true">
					<div class="card-image skeleton-block"></div>
					<div class="card-content">
						<span class="skeleton-line"></span>
						<span class="skeleton-line medium"></span>
						<span class="skeleton-line short"></span>
						<div class="card-meta">
							<span class="skeleton-line tiny"></span>
							<span class="skeleton-line tiny"></span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:then source}
		{#if !source.success}
			<div class="error-container">
				<h2>Impossible de charger les actualités</h2>
				<ul>
					<li>{source.error}</li>
				</ul>
			</div>
		{:else if source.articles.length === 0}
			<div class="error-message">
				<p>Aucune actualité pour le moment.</p>
			</div>
		{:else}
			<div class="news-grid">
				{#each source.articles as article}
					<article class="news-card">
						{#if article.image}
							<div class="card-image">
								<img src={article.image} alt={article.title} loading="lazy" />
							</div>
						{/if}
						<div class="card-content">
							<h3>
								<a href={article.url} target="_blank" rel="noreferrer">
									{article.title}
								</a>
							</h3>
							{#if article.description}
								<p class="description">{article.description}</p>
							{/if}
							<div class="card-meta">
								<span class="source">{article.source ?? 'Source inconnue'}</span>
								{#if article.publishedAt}
									<span class="date">
										{new Date(article.publishedAt).toLocaleString('fr-CA')}
									</span>
								{/if}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{/await}
</div>