<script lang="ts">
	import TradeForm from './TradeForm.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import { watchlist, addToWatchlist, removeFromWatchlist } from '$lib/stores/market';
	import './StockDetail.css';

	Chart.register(...registerables);

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
	let chartError = $state('');
	let chartContainer: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = $state(null);
	let isInWatchlist = $derived($watchlist.includes(symbol.toUpperCase()));

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

	onMount(() => {
		if (symbol) {
			loadChartData(selectedPeriod);
		}
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});

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
			const response = await fetch(`/api/stock/${symbol}`, {
				credentials: 'include'
			});
			
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

	function calculateSMA(closes: number[], period: number = 20) {
		const sma = [];
		for (let i = period - 1; i < closes.length; i++) {
			const slice = closes.slice(i - period + 1, i + 1);
			const sum = slice.reduce((acc, val) => acc + val, 0);
			sma.push(sum / period);
		}
		return sma;
	}

	async function loadChartData(period: string) {
		if (!chartContainer) return;

		chartLoading = true;
		chartError = '';
		try {
			const response = await fetch(`/api/stock/${symbol}/candles?period=${period}`);
			
			if (!response.ok) {
				chartError = 'Données du graphique indisponibles';
				return;
			}

			const data = await response.json();
			
			if (data.error || !data.timestamps || data.timestamps.length === 0) {
				chartError = data.error || 'Aucune donnée disponible pour le graphique';
				return;
			}

			const labels = data.timestamps.map((ts: string) => 
				new Date(parseInt(ts) * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
			);

			const sma20 = calculateSMA(data.close, 20);
			const sma20Data = Array(data.close.length - sma20.length).fill(null).concat(sma20);

			if (chart) {
				chart.destroy();
			}

			chart = new Chart(chartContainer, {
				type: 'line',
				data: {
					labels: labels,
					datasets: [
						{
							label: 'Prix de clôture',
							data: data.close,
							borderColor: '#10b981',
							backgroundColor: 'rgba(16, 185, 129, 0.1)',
							borderWidth: 2,
							pointRadius: 0,
							fill: true,
							tension: 0.1
						},
						{
							label: 'SMA 20',
							data: sma20Data,
							borderColor: '#3b82f6',
							backgroundColor: 'transparent',
							borderWidth: 2,
							pointRadius: 0,
							borderDash: [5, 5],
							tension: 0.1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: true,
							position: 'top',
							labels: { color: '#9ca3af' }
						},
						tooltip: {
							mode: 'index',
							intersect: false,
							callbacks: {
								label: (context) => {
									const label = context.dataset.label || '';
									const value = context.parsed.y;
									return `${label}: $${value!.toFixed(2)}`;
								}
							}
						}
					},
					scales: {
						x: {
							grid: { color: '#2d3748' },
							ticks: { color: '#9ca3af' }
						},
						y: {
							grid: { color: '#2d3748' },
							ticks: { color: '#9ca3af' },
							position: 'right'
						}
					}
				}
			});
		} catch (err) {
			console.error('Erreur lors du chargement du graphique:', err);
			chartError = 'Erreur lors du chargement du graphique';
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

	function toggleWatchlist() {
		if (!symbol) return;
		if (isInWatchlist) {
			removeFromWatchlist(symbol);
			return;
		}
		addToWatchlist(symbol);
	}
</script>

<div 
	class="stock-detail-overlay" 
	onclick={() => onClose()}
	role="dialog"
	aria-modal="true"
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	tabindex="0"
>
	<div 
		class="stock-detail-container" 
		role="dialog"
		tabindex="0"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => {
			e.stopPropagation();
		}}
	>
		<div class="header">
			<div class="header-title">
				{#if stockData.logo && !loading}
					<img
						src={stockData.logo}
						alt="{stockData.symbol} logo"
						class="company-logo"
					/>
				{/if}
				<div>
					<h2>{loading ? 'Chargement...' : stockData.symbol}</h2>
					<p class="company-name">{loading ? '' : stockData.name}</p>
				</div>
			</div>
			<div class="header-actions">
				<button
					class="btn-watchlist-detail {isInWatchlist ? 'active' : ''}"
					onclick={toggleWatchlist}
					aria-label="Gerer la watchlist"
					title={isInWatchlist ? 'Retirer de ma watchlist' : 'Ajouter a ma watchlist'}
				>
					{isInWatchlist ? '★' : '☆'}
				</button>
				<button class="btn-close-detail" onclick={() => onClose()} aria-label="Fermer">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
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
			</div>
		{:else}
			<div class="detail-content">
				<div class="chart-section">
					<div class="price-header">
						<div>
							<div class="current-price-large">${stockData.price.toFixed(2)}</div>
							<div class="price-change-large {stockData.change > 0 ? 'positive' : 'negative'}">
								{stockData.change > 0 ? '▲' : '▼'} ${Math.abs(stockData.change).toFixed(2)} ({Math.abs(stockData.changePercent).toFixed(2)}%)
							</div>
						</div>
					</div>

					<div class="chart-controls">
						<div class="period-selector">
							{#each ['1D', '1W', '1M', '3M', '1Y', '5Y'] as period}
								<button
									class="period-btn {selectedPeriod === period ? 'active' : ''}"
									onclick={() => selectedPeriod = period}
									disabled={chartLoading}
								>
									{period}
								</button>
							{/each}
						</div>
					</div>

					<div class="chart-wrapper" style="position: relative; height: 300px;">
						{#if chartLoading}
							<div class="chart-loading">
								<div class="spinner"></div>
							</div>
						{/if}
						{#if chartError && !chartLoading}
							<div class="chart-error">
								<p>{chartError}</p>
							</div>
						{:else}
							<canvas bind:this={chartContainer}></canvas>
						{/if}
					</div>

					<div class="stats-grid">
						<div class="stat-item">
							<div class="stat-label">Ouverture</div>
							<div class="stat-value">${stockData.open.toFixed(2)}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Plus haut</div>
							<div class="stat-value">${stockData.high.toFixed(2)}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Plus bas</div>
							<div class="stat-value">${stockData.low.toFixed(2)}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Clôture précédente</div>
							<div class="stat-value">${stockData.previousClose.toFixed(2)}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Capitalisation</div>
							<div class="stat-value">${formatNumber(stockData.marketCap)}</div>
						</div>
					</div>
				</div>

				<div class="trade-section">
					<div class="trade-card">
						<div class="trade-header">
							<div class="trade-title-section">
								<h3>Trader {stockData.symbol}</h3>
								<div class="current-price-badge">
									<span class="price-label">Prix actuel</span>
									<span class="price-value">${stockData.price.toFixed(2)}</span>
									<span class="price-change {stockData.change > 0 ? 'positive' : 'negative'}">
										{stockData.change > 0 ? '▲' : '▼'} {Math.abs(stockData.changePercent).toFixed(2)}%
									</span>
								</div>
							</div>
						</div>
						
						<div class="trade-mode-selector">
							<button
								class="mode-btn {tradeMode === 'buy' ? 'active buy-mode' : ''}"
								onclick={() => tradeMode = 'buy'}
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 5v14M5 12h14"></path>
								</svg>
								Acheter
							</button>
							<button
								class="mode-btn {tradeMode === 'sell' ? 'active sell-mode' : ''}"
								onclick={() => tradeMode = 'sell'}
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M5 12h14"></path>
								</svg>
								Vendre
							</button>
						</div>

						<div class="market-status-indicator">
							{#if marketStatus.stock}
								<div class="status-badge open">
									<span class="status-dot"></span>
									Marché ouvert
								</div>
							{:else}
								<div class="status-badge closed">
									<span class="status-dot"></span>
									Marché fermé
								</div>
							{/if}
						</div>

						<TradeForm
							mode={tradeMode}
							prefilledSymbol={symbol}
							lockedPrice={stockData.price}
							showSymbolField={false}
						/>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
