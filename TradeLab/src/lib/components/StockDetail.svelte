<script lang="ts">
	import TradeForm from './TradeForm.svelte';
	import { onMount } from 'svelte';
	import { createChart, ColorType } from 'lightweight-charts';
	import './StockDetail.css';

	let {
		symbol = '',
		onClose = () => {}
	} = $props();

	let stockData = $state({
		symbol: '',
		name: '',
		logo: '',
		price: 0,
		change: 0,
		changePercent: 0,
		open: 0,
		high: 0,
		low: 0,
		previousClose: 0,
		marketCap: 0
	});

	let loading = $state(true);
	let error = $state('');
	let tradeMode = $state<'buy' | 'sell'>('buy');
	let selectedPeriod = $state('1D');
	let chartLoading = $state(false);
	let chartContainer: HTMLDivElement | undefined = $state();
	let chart: any = null;

	$effect(() => {
		if (symbol) {
			loadStockData();
		}
	});

	$effect(() => {
		if (selectedPeriod && !loading) {
			loadChartData(selectedPeriod);
		}
	});

	async function loadStockData() {
		loading = true;
		error = '';
		try {
			const response = await fetch(`/api/stock/${symbol}`);
			
			if (!response.ok) {
				throw new Error('Impossible de charger les données de l\'action');
			}

			const data = await response.json();
			
			if (data.error) {
				throw new Error(data.error);
			}

			stockData = {
				symbol: data.symbol,
				logo: data.logo,
				name: data.name,
				price: data.price,
				change: data.change,
				changePercent: data.changePercent,
				open: data.open,
				high: data.high,
				low: data.low,
				previousClose: data.previousClose,
				marketCap: data.marketCap
			};
		} catch (err) {
			console.error('Erreur lors du chargement des données:', err);
			error = err instanceof Error ? err.message : 'Erreur inconnue';
		} finally {
			loading = false;
		}
	}

	async function loadChartData(period: string) {
		if (!chartContainer) return;

		chartLoading = true;
		try {
			const response = await fetch(`/api/stock/${symbol}/candles?period=${period}`);
			
			if (!response.ok) {
				console.warn('Impossible de charger les données du graphique');
				return;
			}

			const data = await response.json();
			
			if (data.error) {
				console.warn(data.error);
				return;
			}

			// Nettoyer le graphique précédent
			if (chart) {
				chart.remove();
				chart = null;
			}

			// Nettoyer le conteneur
			chartContainer.innerHTML = '';

			chart = createChart(chartContainer, {
				layout: {
					background: { type: ColorType.Solid, color: '#1a1f35' },
					textColor: '#9ca3af',
				},
				grid: {
					vertLines: { color: '#2d3748' },
					horzLines: { color: '#2d3748' },
				},
				width: chartContainer.clientWidth,
				height: 300,
			});

			const candlestickSeries = (chart as any).addCandlestickSeries({
				upColor: '#10b981',
				downColor: '#ef4444',
				borderVisible: false,
				wickUpColor: '#10b981',
				wickDownColor: '#ef4444',
			});

			const chartData = data.timestamps.map((timestamp: number, index: number) => ({
				time: timestamp,
				open: data.open[index],
				high: data.high[index],
				low: data.low[index],
				close: data.close[index],
			}));

			candlestickSeries.setData(chartData);
			chart.timeScale().fitContent();
		} catch (err) {
			console.error('Erreur lors du chargement du graphique:', err);
		} finally {
			chartLoading = false;
		}
	}

	function formatNumber(num: number): string {
		if (num >= 1000000000000) {
			return `${(num / 1000000000000).toFixed(2)}T`;
		} else if (num >= 1000000000) {
			return `${(num / 1000000000).toFixed(2)}B`;
		} else if (num >= 1000000) {
			return `${(num / 1000000).toFixed(2)}M`;
		}
		return num.toLocaleString('fr-FR');
	}
</script>

<div class="stock-detail-overlay">
	<div class="stock-detail-container">
		<div class="header">
			<div class="header-title">
				{#if stockData.logo}
					<img src={stockData.logo} alt="{stockData.symbol} logo" class="company-logo" />
				{/if}
				<div>
					<h2>{loading ? 'Chargement...' : stockData.symbol}</h2>
					<p class="company-name">{loading ? '' : stockData.name}</p>
				</div>
			</div>
			<button class="btn-close-detail" onclick={() => onClose()} aria-label="Fermer">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Chargement des données...</p>
			</div>
		{:else if error}
			<div class="error-state">
				<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
				<h3>Erreur</h3>
				<p>{error}</p>
				<button class="btn-retry" onclick={loadStockData}>Réessayer</button>
			</div>
		{:else}
			<div class="detail-content">
				<div class="chart-section">
					<div class="price-display">
						<div class="current-price-large">
							${stockData.price.toFixed(2)}
						</div>
						<div class="price-change-large" class:positive={stockData.change > 0} class:negative={stockData.change < 0}>
							{stockData.change > 0 ? '+' : ''}{stockData.change.toFixed(2)} 
							({stockData.changePercent > 0 ? '+' : ''}{stockData.changePercent.toFixed(2)}%)
						</div>
					</div>

					<!-- Sélecteur de période -->
					<div class="period-selector">
						<button 
							class="period-btn" 
							class:active={selectedPeriod === '1D'}
							onclick={() => selectedPeriod = '1D'}
							disabled={chartLoading}
						>
							1J
						</button>
						<button 
							class="period-btn" 
							class:active={selectedPeriod === '1W'}
							onclick={() => selectedPeriod = '1W'}
							disabled={chartLoading}
						>
							1S
						</button>
						<button 
							class="period-btn" 
							class:active={selectedPeriod === '1M'}
							onclick={() => selectedPeriod = '1M'}
							disabled={chartLoading}
						>
							1M
						</button>
						<button 
							class="period-btn" 
							class:active={selectedPeriod === '3M'}
							onclick={() => selectedPeriod = '3M'}
							disabled={chartLoading}
						>
							3M
						</button>
						<button 
							class="period-btn" 
							class:active={selectedPeriod === '1Y'}
							onclick={() => selectedPeriod = '1Y'}
							disabled={chartLoading}
						>
							1A
						</button>
						<button 
							class="period-btn" 
							class:active={selectedPeriod === '5Y'}
							onclick={() => selectedPeriod = '5Y'}
							disabled={chartLoading}
						>
							5A
						</button>
						<button 
							class="period-btn" 
							class:active={selectedPeriod === 'ALL'}
							onclick={() => selectedPeriod = 'ALL'}
							disabled={chartLoading}
						>
							Tout
						</button>
					</div>

					<div class="chart-container" bind:this={chartContainer}>
						{#if chartLoading}
							<div class="chart-loading">
								<div class="spinner"></div>
							</div>
						{/if}
					</div>

					<div class="stats-grid">
						<div class="stat-item">
							<span class="stat-label">Ouverture</span>
							<span class="stat-value">${stockData.open.toFixed(2)}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Plus Haut</span>
							<span class="stat-value">${stockData.high.toFixed(2)}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Plus Bas</span>
							<span class="stat-value">${stockData.low.toFixed(2)}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Clôture Précédente</span>
							<span class="stat-value">${stockData.previousClose.toFixed(2)}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Cap. Boursière</span>
							<span class="stat-value">${formatNumber(stockData.marketCap)}</span>
						</div>
					</div>
				</div>

				<div class="trade-section">
					<div class="trade-mode-selector">
						<button 
							class="mode-btn" 
							class:active={tradeMode === 'buy'}
							onclick={() => tradeMode = 'buy'}
						>
							Acheter
						</button>
						<button 
							class="mode-btn" 
							class:active={tradeMode === 'sell'}
							onclick={() => tradeMode = 'sell'}
						>
							Vendre
						</button>
					</div>

					<TradeForm 
						bind:mode={tradeMode} 
						prefilledSymbol={stockData.symbol}
					/>
				</div>
			</div>
		{/if}
	</div>
</div>
