<script lang="ts">
	import TradeForm from './TradeForm.svelte';
	import { onMount, onDestroy } from 'svelte';
	import {
		createChart,
		CandlestickSeries,
		LineSeries,
		type IChartApi,
		type ISeriesApi,
		type UTCTimestamp,
		type LineData,
		type CandlestickData
	} from 'lightweight-charts';
	import { watchlist, addToWatchlist, removeFromWatchlist } from '$lib/stores/market';
	import { getCandlestickWebSocket, type CandlestickUpdate } from '$lib/services/candlestickWebSocket';
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
	let chartType = $state<'candles' | 'line'>('candles');
	let chartLoading = $state(false);
	let chartError = $state('');
	let chartContainer = $state<HTMLDivElement | undefined>(undefined);
	let chart: IChartApi | null = null;
	let candleSeries: ISeriesApi<'Candlestick'> | null = null;
	let smaSeries: ISeriesApi<'Line'> | null = null;
	let emaSeries: ISeriesApi<'Line'> | null = null;
	let lineSeries: ISeriesApi<'Line'> | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	let refreshActive = false;
	let refreshInFlight = false;
	let isInWatchlist = $derived($watchlist.includes(symbol.toUpperCase()));
	let candlestickWs: any = null;
	let subscribedSymbol: string | null = null;
	let lastCandleTime: number = 0;
	let lastLiveCandle: CandlestickData | null = null;
	
	let showSMA = $state(true);
	let showEMA = $state(false);
	let smaPeriod = $state(20);
	let emaPeriod = $state(50);

	const periodOptions = [
		{ value: '1m', label: '1 min' },
		{ value: '5m', label: '5 min' },
		{ value: '1D', label: '1 j' },
		{ value: '1W', label: '1 sem' },
		{ value: '1M', label: '1 mois' },
		{ value: '3M', label: '3 mois' },
		{ value: '1Y', label: '1 an' },
		{ value: '5Y', label: '5 ans' }
	] as const;

	function isMarketOpen(): { stock: boolean; crypto: boolean; isCrypto: boolean } {
		const isCrypto = symbol.toUpperCase().includes('-USD') || 
		                symbol.toUpperCase().includes('-BTC') || 
		                symbol.toUpperCase().includes('-USDT') ||
		                symbol.toUpperCase().includes('ETH') ||
		                symbol.toUpperCase().includes('BTC');
		
		if (isCrypto) {
			return { stock: true, crypto: true, isCrypto: true };
		}

		const now = new Date();
		const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
		const day = etTime.getDay();
		const hours = etTime.getHours();
		const minutes = etTime.getMinutes();
		const currentMinutes = hours * 60 + minutes;
		
		const stockOpen = day >= 1 && day <= 5 &&
			currentMinutes >= 9 * 60 + 30 &&
			currentMinutes < 16 * 60;
		
		return { stock: stockOpen, crypto: true, isCrypto: false };
	}

	let marketStatus = $state(isMarketOpen());


	onMount(() => {
		marketStatus = isMarketOpen();
	});

	$effect(() => {
		const currentSymbol = symbol?.toUpperCase();
		if (!currentSymbol) {
			return;
		}

		let disposed = false;

		const subscribe = async () => {
			candlestickWs = candlestickWs ?? getCandlestickWebSocket();

			if (!candlestickWs.isConnected()) {
				try {
					await candlestickWs.connect();
				} catch (err) {
					console.error('Failed to connect candlestick websocket:', err);
					return;
				}
			}

			if (disposed) {
				return;
			}

			if (subscribedSymbol && subscribedSymbol !== currentSymbol) {
				candlestickWs.unsubscribe(subscribedSymbol, handleCandleUpdate);
			}

			candlestickWs.subscribe(currentSymbol, handleCandleUpdate);
			subscribedSymbol = currentSymbol;
			console.log(`WebSocket candlesticks connected for ${currentSymbol}`);
		};

		void subscribe();

		return () => {
			disposed = true;
			if (candlestickWs && subscribedSymbol === currentSymbol) {
				try {
					candlestickWs.unsubscribe(currentSymbol, handleCandleUpdate);
					console.log(`WebSocket unsubscribed from ${currentSymbol}`);
				} catch (err) {
					console.error('Failed to unsubscribe from candlestick WebSocket:', err);
				}
				subscribedSymbol = null;
			}
		};
	});

	onDestroy(() => {
		   if (candlestickWs && subscribedSymbol) {
			   try {
				   candlestickWs.unsubscribe(subscribedSymbol, handleCandleUpdate);
				   console.log(` WebSocket unsubscribed from ${subscribedSymbol}`);
			   } catch (err) {
				   console.error(' Failed to unsubscribe from candlestick WebSocket:', err);
			   }
		   }
		   stopAutoRefresh();
		   resizeObserver?.disconnect();
		   resizeObserver = null;
		   chart?.remove();
		   chart = null;
		   candleSeries = null;
		   smaSeries = null;
		   emaSeries = null;
	});

	$effect(() => {
		if (symbol) {
			loadStockData();
			startAutoRefresh();
		}
	});

	$effect(() => {
		if (!symbol || !selectedPeriod || !chartContainer) {
			return;
		}

		void loadChartData(selectedPeriod);
	});


	$effect(() => {
		if (chartType === 'candles') {
			candleSeries?.applyOptions({ visible: true });
			smaSeries?.applyOptions({ visible: showSMA });
			emaSeries?.applyOptions({ visible: showEMA });
			lineSeries?.applyOptions({ visible: false });
		} else {
			candleSeries?.applyOptions({ visible: false });
			smaSeries?.applyOptions({ visible: false });
			emaSeries?.applyOptions({ visible: false });
			lineSeries?.applyOptions({ visible: true });
		}
	});

	function applyIndicatorVisibility() {
		if (chartType === 'candles') {
			candleSeries?.applyOptions({ visible: true });
			smaSeries?.applyOptions({ visible: showSMA });
			emaSeries?.applyOptions({ visible: showEMA });
			lineSeries?.applyOptions({ visible: false });
			return;
		}

		candleSeries?.applyOptions({ visible: false });
		smaSeries?.applyOptions({ visible: false });
		emaSeries?.applyOptions({ visible: false });
		lineSeries?.applyOptions({ visible: true });
	}

	function toggleSMA() {
		if (chartType === 'line') {
			chartType = 'candles';
		}

		showSMA = !showSMA;
		applyIndicatorVisibility();
	}

	function toggleEMA() {
		if (chartType === 'line') {
			chartType = 'candles';
		}

		showEMA = !showEMA;
		applyIndicatorVisibility();
	}

	function startAutoRefresh() {
		stopAutoRefresh();
		refreshActive = true;
		const run = async () => {
			if (!refreshActive || !symbol || refreshInFlight) {
				return;
			}
			refreshInFlight = true;
			await loadStockData(true);
			refreshInFlight = false;
			if (refreshActive) {
				refreshTimer = setTimeout(run, 5000);
			}
		};
		refreshTimer = setTimeout(run, 0);
	}

	function stopAutoRefresh() {
		refreshActive = false;
		if (refreshTimer) {
			clearTimeout(refreshTimer);
			refreshTimer = null;
		}
	}

	async function loadStockData(silent = false) {
		if (!silent) {
			loading = true;
		}
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
			error = err instanceof Error ? err.message : 'Erreur inconnue';
		} finally {
			if (!silent) {
				loading = false;
			}
		}
	}

	function buildSMA(closes: number[], timestamps: Array<string | number>, period: number = 20): LineData[] {
		const sma: LineData[] = [];
		for (let i = period - 1; i < closes.length; i++) {
			const slice = closes.slice(i - period + 1, i + 1);
			const sum = slice.reduce((acc, val) => acc + val, 0);
			sma.push({ time: normalizeTimestamp(timestamps[i]), value: sum / period });
		}
		return sma;
	}

	function buildEMA(closes: number[], timestamps: Array<string | number>, period: number = 50): LineData[] {
		const ema: LineData[] = [];
		if (closes.length < period) return ema;
		
		let sum = 0;
		for (let i = 0; i < period; i++) {
			sum += closes[i];
		}
		let prevEMA = sum / period;
		ema.push({ time: normalizeTimestamp(timestamps[period - 1]), value: prevEMA });
		
		const k = 2 / (period + 1);
		for (let i = period; i < closes.length; i++) {
			prevEMA = closes[i] * k + prevEMA * (1 - k);
			ema.push({ time: normalizeTimestamp(timestamps[i]), value: prevEMA });
		}
		return ema;
	}

	function normalizeTimestamp(value: string | number): UTCTimestamp {
		const raw = Number(value);
		if (!Number.isFinite(raw)) {
			return 0 as UTCTimestamp;
		}
		const seconds = raw > 1e11 ? Math.floor(raw / 1000) : Math.floor(raw);
		return seconds as UTCTimestamp;
	}

	function getIntervalSeconds(period: string): number {
		switch (period) {
			case '1m':
				return 60;
			case '5m':
				return 300;
			case '1D':
				return 1800;
			case '1W':
			case '1M':
			case '3M':
				return 86400;
			case '1Y':
				return 604800;
			case '5Y':
				return 2592000;
			default:
				return 60;
		}
	}

	function isIntradayPeriod(period: string): boolean {
		return period === '1m' || period === '5m';
	}

	function formatTickByPeriod(time: UTCTimestamp, period: string): string {
		const date = new Date(Number(time) * 1000);
		if (isIntradayPeriod(period)) {
			return date.toLocaleTimeString('fr-CA', {
				hour: '2-digit',
				minute: '2-digit'
			});
		}

		if (period === '1D') {
			return date.toLocaleDateString('fr-CA', {
				day: '2-digit',
				month: 'short'
			});
		}

		if (period === '1Y' || period === '5Y') {
			return date.toLocaleDateString('fr-CA', {
				month: 'short',
				year: '2-digit'
			});
		}

		return date.toLocaleDateString('fr-CA', {
			day: '2-digit',
			month: 'short'
		});
	}

	let pendingCandleUpdates: CandlestickUpdate[] = [];

	function handleCandleUpdate(data: CandlestickUpdate) {
		if (!data?.symbol || data.symbol.toUpperCase() !== symbol.toUpperCase()) {
			return;
		}

		console.log('📡 WebSocket recoit :', data);
		console.log('📊 Etat de candleSeries :', candleSeries);

		if (!candleSeries) {
			pendingCandleUpdates.push(data);
			console.warn('⚠️ candleSeries est null, update bufferisée');
			return;
		}

		if (pendingCandleUpdates.length > 0) {
			for (const update of pendingCandleUpdates) {
				applyCandleUpdate(update);
			}
			pendingCandleUpdates = [];
		}
		applyCandleUpdate(data);
	}

	function applyCandleUpdate(data: CandlestickUpdate) {
		const timestamp = normalizeTimestamp(data.time);
		const intervalSeconds = getIntervalSeconds(selectedPeriod);
		const bucketTime = Math.floor(Number(timestamp) / intervalSeconds) * intervalSeconds;
		const bucketTimestamp = bucketTime as UTCTimestamp;

		const candleData: CandlestickData = {
			time: bucketTimestamp,
			open: Number(data.open),
			high: Number(data.high),
			low: Number(data.low),
			close: Number(data.close)
		};

		if (!candleSeries) {
			return;
		}

		if (bucketTime < lastCandleTime) {
			return;
		}

		if (bucketTime === lastCandleTime && lastLiveCandle) {
			const mergedCandle: CandlestickData = {
				time: bucketTimestamp,
				open: Number(lastLiveCandle.open),
				high: Math.max(Number(lastLiveCandle.high), candleData.high),
				low: Math.min(Number(lastLiveCandle.low), candleData.low),
				close: candleData.close
			};

			candleSeries.update(mergedCandle);
			lineSeries?.update({ time: bucketTimestamp, value: mergedCandle.close });
			stockData.price = mergedCandle.close;
			lastLiveCandle = mergedCandle;
			chart?.timeScale().scrollToRealTime();
			return;
		}

		console.log('🔥 Envoi live au graphique ->', data.close);
		candleSeries.update(candleData);
		lineSeries?.update({ time: bucketTimestamp, value: candleData.close });
		stockData.price = candleData.close;
		if (bucketTime > lastCandleTime) {
			lastCandleTime = bucketTime;
			lastLiveCandle = candleData;
		}
		chart?.timeScale().scrollToRealTime();
	}

	function initChart() {
		if (!chartContainer || chart) return;

		const width = Math.floor(chartContainer.clientWidth);
		const height = Math.floor(chartContainer.clientHeight);

		const formatLocalTime = (time: UTCTimestamp) => formatTickByPeriod(time, selectedPeriod);

		chart = createChart(chartContainer, {
			width: width > 0 ? width : undefined,
			height: height > 0 ? height : undefined,
			layout: {
				background: { color: 'transparent' },
				textColor: '#9ca3af'
			},
			grid: {
				vertLines: { color: '#2d3748' },
				horzLines: { color: '#2d3748' }
			},
			rightPriceScale: { borderColor: '#2d3748' },
			timeScale: {
				borderColor: '#2d3748',
				timeVisible: isIntradayPeriod(selectedPeriod),
				tickMarkFormatter: formatLocalTime
			},
			localization: {
				timeFormatter: formatLocalTime
			}
		});

		const _candles = chart.addSeries(CandlestickSeries, {
			upColor: '#10b981',
			downColor: '#ef4444',
			borderUpColor: '#10b981',
			borderDownColor: '#ef4444',
			wickUpColor: '#10b981',
			wickDownColor: '#ef4444'
		});
		candleSeries = _candles;

		const _sma = chart.addSeries(LineSeries, {
			color: '#3b82f6',
			lineWidth: 2
		});
		smaSeries = _sma;

		const _ema = chart.addSeries(LineSeries, {
			color: '#f59e0b',
			lineWidth: 2
		});
		emaSeries = _ema;

		const _line = chart.addSeries(LineSeries, {
			color: '#10b981',
			lineWidth: 2
		});
		lineSeries = _line;
		console.log('✅ Series init:', { candleSeries, smaSeries, emaSeries, lineSeries });

		if (chartType === 'line') {
			candleSeries.applyOptions({ visible: false });
			smaSeries.applyOptions({ visible: false });
			emaSeries.applyOptions({ visible: false });
		} else {
			lineSeries.applyOptions({ visible: false });
			smaSeries.applyOptions({ visible: showSMA });
			emaSeries.applyOptions({ visible: showEMA });
		}

		applyIndicatorVisibility();

		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const width = Math.floor(entry.contentRect.width);
				const height = Math.floor(entry.contentRect.height);
				if (width > 0 && height > 0) {
					chart?.resize(width, height);
				}
			}
		});
		resizeObserver.observe(chartContainer);
	}

	async function loadChartData(period: string) {
		   if (!chartContainer) return;
		   initChart();

		   chart?.applyOptions({
			   timeScale: {
				   timeVisible: isIntradayPeriod(period),
				   tickMarkFormatter: (time: UTCTimestamp) => formatTickByPeriod(time, period)
			   },
			   localization: {
				   timeFormatter: (time: UTCTimestamp) => formatTickByPeriod(time, period)
			   }
		   });

		   chartLoading = true;
		   chartError = '';
		   try {
			   const response = await fetch(`/api/stock/${symbol}/candles?period=${period}`); //Autosubscribe via un store, 
			   											// pas besoin de recharger les données à chaque changement de période
			   if (!response.ok) {
				   chartError = 'Données du graphique indisponibles';
				   return;
			   }

			   const data = await response.json();
			   if (data.error || !data.timestamps || data.timestamps.length === 0) {
				   chartError = data.error || 'Aucune donnée disponible pour le graphique';
				   return;
			   }

			   const length = Math.min(
				   data.timestamps.length,
				   data.open.length,
				   data.high.length,
				   data.low.length,
				   data.close.length
			   );

			   if (length === 0) {
				   chartError = 'Aucune donnee disponible pour le graphique';
				   candleSeries?.setData([]);
				   smaSeries?.setData([]);
				   return;
			   }

			   const candles: CandlestickData[] = [];
			   const lineData: LineData[] = [];
			   for (let i = 0; i < length; i++) {
				   const time = normalizeTimestamp(data.timestamps[i]);
				   const close = Number(data.close[i]);
				   candles.push({
					   time,
					   open: Number(data.open[i]),
					   high: Number(data.high[i]),
					   low: Number(data.low[i]),
					   close
				   });
				   lineData.push({ time, value: close });
			   }

			   candleSeries?.setData(candles);
			   lastCandleTime = candles.length > 0 ? (candles[candles.length - 1].time as any) : 0;
			   lastLiveCandle = candles.length > 0 ? candles[candles.length - 1] : null;
			   console.log(`📊 lastCandleTime défini à ${lastCandleTime}`);
           
			   smaSeries?.setData(buildSMA(data.close.slice(0, length), data.timestamps.slice(0, length), smaPeriod));
			   emaSeries?.setData(buildEMA(data.close.slice(0, length), data.timestamps.slice(0, length), emaPeriod));
			   lineSeries?.setData(lineData);
			   chart?.timeScale().fitContent();
           
			   if (pendingCandleUpdates.length > 0) {
				   console.log(`✅ Application de ${pendingCandleUpdates.length} updates bufferisées après loadChartData`);
				   for (const update of pendingCandleUpdates) {
					   applyCandleUpdate(update);
				   }
				   pendingCandleUpdates = [];
			   }
		   } catch (err) {
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
						<div class="control-group">
							<span class="control-label">Periode</span>
							<div class="period-selector">
								{#each periodOptions as option (option.value)}
									<button
										class="period-btn {selectedPeriod === option.value ? 'active' : ''}"
										onclick={() => selectedPeriod = option.value}
										disabled={chartLoading}
									>
										{option.label}
									</button>
								{/each}
							</div>
						</div>
						<div class="control-group">
							<span class="control-label">Type de graphe</span>
							<div class="period-selector">
								{#each ['candles', 'line'] as mode}
									<button
										class="period-btn {chartType === mode ? 'active' : ''}"
										onclick={() => chartType = mode as 'candles' | 'line'}
										disabled={chartLoading}
									>
										{mode === 'candles' ? 'Candlesticks' : 'Lineaire'}
									</button>
								{/each}
							</div>
						</div>
						<div class="control-group">
							<span class="control-label">Indicateurs</span>
							<div class="indicators-selector">
								<div class="indicator-item">
									<button
										class="period-btn {showSMA ? 'active' : ''}"
										onclick={toggleSMA}
										aria-label="Activer ou desactiver SMA 20"
										disabled={chartLoading}
									>
										SMA {smaPeriod}
									</button>
									<button type="button" class="indicator-help" aria-label="Information SMA20">
										i
										<span class="indicator-tooltip">SMA20 = moyenne mobile simple sur 20 periodes. Elle lisse la tendance court terme.</span>
									</button>
								</div>
								<div class="indicator-item">
									<button
										class="ema-btn {showEMA ? 'active' : ''}"
										onclick={toggleEMA}
										aria-label="Activer ou desactiver EMA 50"
										disabled={chartLoading}
									>
										EMA {emaPeriod}
									</button>
									<button type="button" class="indicator-help" aria-label="Information EMA50">
										i
										<span class="indicator-tooltip">EMA50 = moyenne mobile exponentielle sur 50 periodes. Elle reagit plus vite aux changements recents.</span>
									</button>
								</div>
							</div>
						</div>
					</div>

					<div class="chart-container" style="position: relative; height: 300px;">
						<div
							class="chart-canvas"
							bind:this={chartContainer}
							style="opacity: {chartLoading ? '0.5' : '1'}; width: 100%; height: 100%;"
						></div>
						{#if chartLoading}
							<div class="chart-loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; z-index: 10;">
								<div class="spinner"></div>
							</div>
						{/if}
						{#if chartError && !chartLoading}
							<div class="chart-error" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; z-index: 10;">
								<p>{chartError}</p>
							</div>
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
						{#if marketStatus.isCrypto}
							<div class="status-badge open">
								<span class="status-dot"></span>
								Marché ouvert 24h/24
							</div>
						{:else if marketStatus.stock}
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
