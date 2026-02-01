<script lang="ts">
	import './+page.css';
	let { data } = $props<{ data: any }>();
	let activeTab = $state('gnews');
</script>

<svelte:head>
	<title>Actualités financières - TradeLab</title>
	<meta name="description" content="Dernières nouvelles des marchés financiers" />
</svelte:head>

<div class="news-container">
	<div class="header">
		<h1>Actualités Financières</h1>
		<p>Choisissez une catégorie pour voir les nouvelles pertinentes</p>
	</div>

	<div class="category-switch">
		<span class="category-label">Catégorie</span>
		<div class="tabs" role="tablist" aria-label="Catégories d'actualités">
			<button
				class="tab-btn {activeTab === 'gnews' ? 'active' : ''}"
				onclick={() => (activeTab = 'gnews')}
				role="tab"
				aria-selected={activeTab === 'gnews'}
			>
				Bourse
				{#if data.gnews.success}
					<span class="badge">{data.gnews.articles.length}</span>
				{/if}
			</button>
			<button
				class="tab-btn {activeTab === 'finnhub' ? 'active' : ''}"
				onclick={() => (activeTab = 'finnhub')}
				role="tab"
				aria-selected={activeTab === 'finnhub'}
			>
				Crypto
				{#if data.finnhub.success}
					<span class="badge">{data.finnhub.articles.length}</span>
				{/if}
			</button>
		</div>
	</div>

	{#if data.success}
		<div class="news-grid">
			{#if activeTab === 'gnews' && data.gnews.success}
				{#each data.gnews.articles as article}
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
			{:else if activeTab === 'finnhub' && data.finnhub.success}
				{#each data.finnhub.articles as article}
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
			{:else}
				<div class="error-message">
					<p>Source non disponible</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="error-container">
			<h2>Impossible de charger les actualités</h2>
			{#if data.errors?.length}
				<ul>
					{#each data.errors as err}
						<li>{err}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>