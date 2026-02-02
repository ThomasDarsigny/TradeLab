<script lang="ts">
	import './StockSearch.css';
	import { onMount } from 'svelte';

	let {
		onSelect = (symbol: string) => {}
	} = $props();

	interface Stock {
		symbol: string;
		name: string;
		country: string;
	}

	let searchQuery = $state('');
	let showResults = $state(false);
	let stocks = $state<Stock[]>([]);
	let allStocks = $state<Stock[]>([]);
	let loading = $state(true);
	const defaultLimit = 100;
	const searchLimit = 200;
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	
	onMount(async () => {
		try {
			const response = await fetch('/api/symbols?limit=5000');
			if (response.ok) {
				const data = await response.json();
				allStocks = data.symbols || [];
				stocks = allStocks;
			}
		} catch (error) {
			console.error('Erreur lors du chargement des symboles:', error);
		} finally {
			loading = false;
		}
	});

	$effect(() => {
		const query = searchQuery.trim();
		if (searchTimeout) clearTimeout(searchTimeout);

		if (!query) {
			stocks = allStocks;
			return;
		}

		searchTimeout = setTimeout(async () => {
			try {
				const response = await fetch(`/api/symbols?q=${encodeURIComponent(query)}&limit=200`);
				if (response.ok) {
					const data = await response.json();
					stocks = data.symbols || [];
				}
			} catch (error) {
				console.error('Erreur lors de la recherche de symboles:', error);
			}
		}, 250);
	});

	let filteredResults = $derived.by(() => {
		if (!searchQuery.trim()) return stocks.slice(0, defaultLimit);
		
		const query = searchQuery.toLowerCase();
		return stocks.filter(stock => 
			stock.symbol.toLowerCase().includes(query) || 
			stock.name.toLowerCase().includes(query)
		).slice(0, searchLimit);
	});

	function handleSelect(symbol: string) {
		onSelect(symbol);
		searchQuery = '';
		showResults = false;
	}

	function handleInputFocus() {
		showResults = true;
	}

	function handleInputBlur() {
		setTimeout(() => {
			showResults = false;
		}, 200);
	}

	let logoErrorSymbols = $state<Set<string>>(new Set());

	function markLogoError(symbol: string) {
		if (logoErrorSymbols.has(symbol)) return;
		const updated = new Set(logoErrorSymbols);
		updated.add(symbol);
		logoErrorSymbols = updated;
	}

	function getStockLogo(symbol: string): string {
		const cleanSymbol = symbol.split('.')[0];
		return `/api/stock/logo/${encodeURIComponent(cleanSymbol)}`;
	}
</script>

<div class="search-container">
	<div class="search-input-wrapper">
		<svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="11" cy="11" r="8"></circle>
			<path d="m21 21-4.35-4.35"></path>
		</svg>
		<input
			type="text"
			bind:value={searchQuery}
			onfocus={handleInputFocus}
			onblur={handleInputBlur}
			placeholder="Rechercher une action (ex: AAPL, TSLA...)"
			class="search-input"
		/>
	</div>

	{#if showResults && filteredResults.length > 0}
		<div class="search-results">
			{#each filteredResults as stock}
				{@const logoUrl = getStockLogo(stock.symbol)}
				<button 
					class="result-item"
					onclick={() => handleSelect(stock.symbol)}
				>
					<div class="result-content">
						{#if logoUrl && !logoErrorSymbols.has(stock.symbol)}
							<img 
								src={logoUrl} 
								alt="{stock.symbol} logo" 
								class="stock-logo"
								onerror={() => markLogoError(stock.symbol)}
							/>
						{:else}
							<div class="stock-logo-placeholder">
								{stock.symbol.slice(0, 2)}
							</div>
						{/if}
						<div class="result-details">
							<div class="result-header">
								<span class="result-symbol">{stock.symbol}</span>
								<span class="result-country">{stock.country}</span>
							</div>
							<div class="result-name">{stock.name}</div>
						</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
