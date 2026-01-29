<script lang="ts">
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
		<p>Dernières nouvelles des marchés en temps réel</p>
	</div>

	<!-- Affichage des prix -->
	{#if data.crypto?.success}
		<p><strong>Bitcoin:</strong> ${data.crypto.price.toLocaleString('en-US', { maximumFractionDigits: 2 })} ({data.crypto.change24h.toFixed(2)}%)</p>
	{/if}
	{#if data.stock?.success}
		<p><strong>{data.stock.symbol}:</strong> ${data.stock.price.toFixed(2)} ({data.stock.change24h.toFixed(2)}%)</p>
	{/if}

	{#if data.success}
		<div class="tabs">
			<button
				class="tab-btn {activeTab === 'gnews' ? 'active' : ''}"
				onclick={() => (activeTab = 'gnews')}
			>
				GNews
				{#if data.gnews.success}
					<span class="badge">{data.gnews.articles.length}</span>
				{/if}
			</button>
			<button
				class="tab-btn {activeTab === 'finnhub' ? 'active' : ''}"
				onclick={() => (activeTab = 'finnhub')}
			>
				Finnhub
				{#if data.finnhub.success}
					<span class="badge">{data.finnhub.articles.length}</span>
				{/if}
			</button>
		</div>

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

<!-- TODO: Pas oublier de mettre ca dnas un fichier de style un moment donné -->
<style>
	.news-container {
		min-height: 100vh;
	}

	.header {
		margin-bottom: 2rem;
	}

	.header h1 {
		margin: 0 0 0.5rem;
		font-size: 2rem;
	}

	.header p {
		color: #475569;
		margin: 0;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid #e2e8f0;
	}

	.tab-btn {
		background: none;
		border: none;
		padding: 1rem;
		cursor: pointer;
		border-bottom: 3px solid transparent;
		color: #475569;
		font-weight: 500;
		transition: all 0.3s;
	}

	.tab-btn:hover {
		color: #0f172a;
	}

	.tab-btn.active {
		border-bottom-color: #0f172a;
		color: #0f172a;
	}

	.badge {
		display: inline-block;
		background: #e0e7ff;
		color: #0f172a;
		border-radius: 9999px;
		padding: 0.2rem 0.6rem;
		font-size: 0.85rem;
		margin-left: 0.5rem;
	}

	.news-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	.news-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		overflow: hidden;
		transition: all 0.3s;
		display: flex;
		flex-direction: column;
	}

	.news-card:hover {
		box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
		transform: translateY(-2px);
	}

	.card-image {
		width: 100%;
		height: 180px;
		overflow: hidden;
		background: #f1f5f9;
	}

	.card-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-content {
		padding: 1rem;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.news-card h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		line-height: 1.5;
	}

	.news-card a {
		color: #0f172a;
		text-decoration: none;
		transition: color 0.2s;
	}

	.news-card a:hover {
		color: #4f46e5;
		text-decoration: underline;
	}

	.description {
		color: #475569;
		font-size: 0.9rem;
		margin: 0.5rem 0 1rem;
		flex: 1;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: #94a3b8;
		padding-top: 0.75rem;
		border-top: 1px solid #f1f5f9;
	}

	.source {
		font-weight: 600;
		color: #475569;
	}

	.error-container {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
	}

	.error-container h2 {
		margin: 0 0 1rem;
		color: #dc2626;
	}

	.error-container ul {
		background: white;
		border-radius: 8px;
		padding: 1rem;
		margin: 1rem 0;
		text-align: left;
	}

	.error-container li {
		color: #7f1d1d;
	}

	.error-message {
		text-align: center;
		padding: 2rem;
		color: #94a3b8;
	}
</style>
