<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import StockSearch from '$lib/components/StockSearch.svelte';
	import StockDetail from '$lib/components/StockDetail.svelte';
	import { QuotesWebSocket } from '$lib/services/quotesWebSocket';
	import { watchlist, recentSymbols, initializeMarketStores, addToRecent } from '$lib/stores/market';

	let showStockDetail = $state(false);
	let detailSymbol = $state('');
	let popularSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD'];
	let symbolPrices: Record<string, { price: number; change: number; openPrice?: number; logo?: string }> = $state({});
	let ws: QuotesWebSocket | null = null;
	let activeTab: 'popular' | 'watchlist' | 'recent' = $state('popular');
	let watchlistData: Record<string, { price: number; change: number; openPrice?: number; logo?: string }> = $state({});
	
	const fallbackLogo = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Crect fill=%22%23ddd%22 width=%2240%22 height=%2240%22/%3E%3C/svg%3E';

	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		img.src = fallbackLogo;
	}

	function isMarketOpen(): { stock: boolean; crypto: boolean } {
		const now = new Date();
		const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
		const day = etTime.getDay();
		const hours = etTime.getHours();
		const minutes = etTime.getMinutes();
		const currentMinutes = hours * 60 + minutes;
		
		const cryptoOpen = true;
		
		const stockOpen = day >= 1 && day <= 5 &&
			currentMinutes >= 9 * 60 + 30 &&
			currentMinutes < 16 * 60;
		
		return { stock: stockOpen, crypto: cryptoOpen };
	}
	
	let marketStatus = $state(isMarketOpen());
	
	let statusInterval: any;

	async function loadSymbolData(symbol: string, isWatchlist = false) {
		try {
			const response = await fetch(`/api/stock/${symbol}`);
			if (response.ok) {
				const data = await response.json();
				const openPrice = data.open || 0;
				const currentPrice = data.price || 0;
				const change = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
				const logo = data.logo || '';
				
				if (isWatchlist) {
					watchlistData = { 
						...watchlistData, 
						[symbol]: { price: currentPrice, change, openPrice, logo } 
					};
				} else {
					symbolPrices = { 
						...symbolPrices, 
						[symbol]: { price: currentPrice, change, openPrice, logo } 
					};
				}
			}
		} catch (error) {
		}
	}

	onMount(async () => {
		initializeMarketStores();
		
		await Promise.all(popularSymbols.map(symbol => loadSymbolData(symbol, false)));
		
		await Promise.all($watchlist.map(symbol => loadSymbolData(symbol, true)));
		
		statusInterval = setInterval(() => {
			marketStatus = isMarketOpen();
		}, 60000);
		
		ws = QuotesWebSocket.getInstance();
		
		try {
			await ws.connect();
			popularSymbols.forEach(symbol => {
				ws?.subscribe(symbol, (data) => {
					updateSymbolPrice(symbol, data.price);
				});
			});
			$watchlist.forEach(symbol => {
				ws?.subscribe(symbol, (data) => {
					updateWatchlistPrice(symbol, data.price);
				});
			});
		} catch (error) {
		}
	});
	
	onDestroy(() => {
		if (statusInterval) {
			clearInterval(statusInterval);
		}
		if (ws) {
			popularSymbols.forEach(symbol => ws?.unsubscribe(symbol));
			$watchlist.forEach(symbol => ws?.unsubscribe(symbol));
		}
	});

	function updateSymbolPrice(symbol: string, price: number) {
		const openPrice = symbolPrices[symbol]?.openPrice || price;
		const change = openPrice > 0 ? ((price - openPrice) / openPrice) * 100 : 0;
		const logo = symbolPrices[symbol]?.logo;
		symbolPrices = { 
			...symbolPrices, 
			[symbol]: { price, change, openPrice, logo } 
		};
	}

	function updateWatchlistPrice(symbol: string, price: number) {
		const openPrice = watchlistData[symbol]?.openPrice || price;
		const change = openPrice > 0 ? ((price - openPrice) / openPrice) * 100 : 0;
		const logo = watchlistData[symbol]?.logo;
		watchlistData = { 
			...watchlistData, 
			[symbol]: { price, change, openPrice, logo } 
		};
	}

	function handleStockSearch(symbol: string) {
		detailSymbol = symbol;
		showStockDetail = true;
		addToRecent(symbol);
	}

	function closeStockDetail() {
		showStockDetail = false;
		detailSymbol = '';
	}



</script>

<svelte:head>
	<title>TradeLab - Marchés</title>
	<meta name="description" content="Explorez les marchés et tradez vos actions préférées" />
</svelte:head>

{#if showStockDetail}
	<StockDetail symbol={detailSymbol} onClose={closeStockDetail} />
{/if}

<div class="markets-page">
	<div class="markets-header">
		<div class="header-content">
			<h1>Marchés Financiers</h1>
		</div>
	</div>

	<div class="search-section">
		<div class="search-wrapper">
			<h2> Rechercher une Action</h2>
			<StockSearch onSelect={handleStockSearch} />
		</div>
	</div>

	<div class="tabs-container">
		<div class="tabs">
			<button 
				class="tab-btn {activeTab === 'popular' ? 'active' : ''}"
				onclick={() => activeTab = 'popular'}
			>
				<span class="tab-icon"></span>
				Actions Populaires <span class="tab-count">({popularSymbols.length})</span>
			</button>
			<button 
				class="tab-btn {activeTab === 'watchlist' ? 'active' : ''}"
				onclick={() => activeTab = 'watchlist'}
			>
				<span class="tab-icon"></span>
				Watchlist <span class="tab-count">({$watchlist.length})</span>
			</button>
			<button 
				class="tab-btn {activeTab === 'recent' ? 'active' : ''}"
				onclick={() => activeTab = 'recent'}
			>
				<span class="tab-icon"></span>
				Consulté Récemment <span class="tab-count">({$recentSymbols.length})</span>
			</button>
		</div>
	</div>



	{#if activeTab === 'popular'}
		<div class="symbols-section">
			<div class="symbols-grid">
				{#each popularSymbols as symbol}
					{@const priceInfo = symbolPrices[symbol]}
					<button class="symbol-card" type="button" onclick={() => handleStockSearch(symbol)}>
						<div class="card-header">
							{#if priceInfo?.logo}
								<div class="card-logo-small">
									<img src={priceInfo.logo} alt={symbol} onerror={(e) => handleImageError(e)} />
								</div>
							{:else}
								<div class="card-logo-small"></div>
							{/if}
							<div class="symbol-info">
								<h3 class="symbol-name">{symbol}</h3>
								{#if priceInfo}
									<div class="price-display">
										<span class="price">${priceInfo.price.toFixed(2)}</span>
										<span class="change-badge {priceInfo.change > 0 ? 'positive' : 'negative'}">
											{priceInfo.change > 0 ? '▲' : '▼'} {Math.abs(priceInfo.change).toFixed(2)}%
										</span>
									</div>
								{:else}
									<div class="loading-text">Chargement...</div>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if activeTab === 'watchlist'}
		<div class="symbols-section">
			{#if $watchlist.length === 0}
				<div class="empty-state">
					<div class="empty-icon">📌</div>
					<h3>Watchlist vide</h3>
					<p>Ouvrez les détails d'une action pour l'ajouter à votre watchlist</p>
				</div>
			{:else}
				<div class="symbols-grid">
					{#each $watchlist as symbol}
						{@const priceInfo = watchlistData[symbol]}
						<button class="symbol-card" type="button" onclick={() => handleStockSearch(symbol)}>
							<div class="card-header">
								{#if priceInfo?.logo}
									<div class="card-logo-small">
										<img src={priceInfo.logo} alt={symbol} onerror={(e) => handleImageError(e)} />
									</div>
								{:else}
									<div class="card-logo-small"></div>
								{/if}
								<div class="symbol-info">
									<h3 class="symbol-name">{symbol}</h3>
									{#if priceInfo}
										<div class="price-display">
											<span class="price">${priceInfo.price.toFixed(2)}</span>
											<span class="change-badge {priceInfo.change > 0 ? 'positive' : 'negative'}">
												{priceInfo.change > 0 ? '▲' : '▼'} {Math.abs(priceInfo.change).toFixed(2)}%
											</span>
										</div>
									{:else}
										<div class="loading-text">Chargement...</div>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if activeTab === 'recent'}
		<div class="symbols-section">
			{#if $recentSymbols.length === 0}
				<div class="empty-state">
					<div class="empty-icon"></div>
					<h3>Aucun historique</h3>
					<p>Vos actions consultées s'afficheront ici</p>
				</div>
			{:else}
				<div class="symbols-grid">
					{#each $recentSymbols as symbol}
						{@const priceInfo = symbolPrices[symbol] || watchlistData[symbol]}
						<button class="symbol-card" type="button" onclick={() => handleStockSearch(symbol)}>
							<div class="card-header">
								{#if priceInfo?.logo}
									<div class="card-logo-small">
										<img src={priceInfo.logo} alt={symbol} onerror={(e) => handleImageError(e)} />
									</div>
								{:else}
									<div class="card-logo-small"></div>
								{/if}
								<div class="symbol-info">
									<h3 class="symbol-name">{symbol}</h3>
									{#if priceInfo}
										<div class="price-display">
											<span class="price">${priceInfo.price.toFixed(2)}</span>
											<span class="change-badge {priceInfo.change > 0 ? 'positive' : 'negative'}">
												{priceInfo.change > 0 ? '▲' : '▼'} {Math.abs(priceInfo.change).toFixed(2)}%
											</span>
										</div>
									{:else}
										<div class="loading-text">Chargement...</div>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.markets-page {
		padding: 2rem;
		max-width: 1600px;
		margin: 0 auto;
		width: 100%;
	}

	.markets-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 3rem;
		gap: 2rem;
	}

	.header-content h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2.5rem;
		background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 800;
	}


	.search-section {
		position: relative;
		background: linear-gradient(
			135deg,
			rgba(59, 130, 246, 0.15) 0%,
			rgba(147, 51, 234, 0.1) 50%,
			rgba(236, 72, 153, 0.15) 100%
		);
		border: 1px solid rgba(147, 51, 234, 0.3);
		border-radius: 24px;
		padding: 2.5rem;
		margin-bottom: 3rem;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 
			0 4px 24px rgba(147, 51, 234, 0.2),
			0 0 80px rgba(59, 130, 246, 0.15),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		overflow: visible;
		transition: all 0.3s ease;
		z-index: 20;
	}

	.search-section::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 100%;
		background: linear-gradient(
			135deg,
			rgba(59, 130, 246, 0.08) 0%,
			rgba(147, 51, 234, 0.05) 50%,
			rgba(236, 72, 153, 0.08) 100%
		);
		opacity: 0.6;
		pointer-events: none;
		z-index: 0;
	}

	.search-section::after {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(
			circle,
			rgba(147, 51, 234, 0.15) 0%,
			transparent 70%
		);
		animation: rotate-gradient 20s linear infinite;
		pointer-events: none;
		z-index: 0;
	}

	@keyframes rotate-gradient {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.search-section:hover {
		border-color: rgba(147, 51, 234, 0.5);
		box-shadow: 
			0 8px 32px rgba(147, 51, 234, 0.3),
			0 0 120px rgba(59, 130, 246, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.15);
		transform: translateY(-2px);
	}

	.search-wrapper {
		position: relative;
		z-index: 100;
	}

	.search-wrapper h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		color: var(--text-primary);
		font-weight: 700;
		background: linear-gradient(135deg, #3b82f6, #9333ea, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.tabs-container {
		margin-bottom: 2.5rem;
		border-bottom: 2px solid var(--border-primary);
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0;
		scroll-behavior: smooth;
	}

	.tab-btn {
		padding: 1.25rem 1.75rem;
		background: none;
		border: none;
		color: var(--text-secondary);
		font-weight: 700;
		cursor: pointer;
		font-size: 1rem;
		border-bottom: 3px solid transparent;
		transition: all 0.3s ease;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tab-icon {
		font-size: 1.2rem;
	}

	.tab-count {
		font-size: 0.85rem;
		opacity: 0.7;
	}

	.tab-btn:hover {
		color: var(--text-primary);
		background: rgba(59, 130, 246, 0.1);
	}

	.tab-btn.active {
		color: var(--accent-primary);
		border-bottom-color: var(--accent-primary);
		background: rgba(59, 130, 246, 0.1);
	}

	.symbols-section {
		margin-bottom: 2rem;
	}

	.symbols-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 2rem;
		animation: fadeIn 0.5s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.symbol-card {
		background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 1.75rem;
		transition: all 0.3s ease;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		cursor: pointer;
		position: relative;
		overflow: hidden;
		width: 100%;
		text-align: left;
		font: inherit;
		color: inherit;
		appearance: none;
		background-clip: padding-box;
	}

	.symbol-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--accent-primary), var(--accent-green));
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 0.3s ease;
	}

	.symbol-card:hover {
		transform: translateY(-8px);
		box-shadow: var(--shadow-xl);
		border-color: var(--accent-primary);
	}

	.symbol-card:hover::before {
		transform: scaleX(1);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		justify-content: space-between;
	}

	.card-logo-small {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		background: var(--bg-tertiary);
		padding: 0.4rem;
		border: 1px solid var(--border-secondary);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.card-logo-small img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.symbol-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.price-display {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.symbol-name {
		margin: 0;
		font-size: 1.75rem;
		color: var(--text-primary);
		font-weight: 800;
		letter-spacing: -0.025em;
	}

	.loading-text {
		color: var(--text-secondary);
		font-size: 0.95rem;
	}

	.price {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--text-primary);
	}

	.change-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.95rem;
		font-weight: 700;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		min-width: fit-content;
	}

	.change-badge.positive {
		background: rgba(16, 185, 129, 0.2);
		color: #6ee7b7;
	}

	.change-badge.negative {
		background: rgba(239, 68, 68, 0.2);
		color: #fca5a5;
	}

	.empty-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
		animation: float 3s ease-in-out infinite;
	}

	@keyframes float {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10px); }
	}

	.empty-state h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: var(--text-primary);
		font-weight: 700;
	}

	.empty-state p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 1rem;
	}



	@media (max-width: 1200px) {
		.symbols-grid {
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		}
	}

	@media (max-width: 768px) {
		.markets-page {
			padding: 1rem;
		}

		.markets-header {
			flex-direction: column;
			margin-bottom: 2rem;
		}

		.header-content h1 {
			font-size: 2rem;
		}

		.symbols-grid {
			grid-template-columns: 1fr;
		}

		.search-section {
			padding: 1.5rem;
		}

		.tabs {
			gap: 0.25rem;
		}

		.tab-btn {
			padding: 1rem 1rem;
			font-size: 0.9rem;
		}

		.symbol-card {
			padding: 1.25rem;
		}
	}
</style>
