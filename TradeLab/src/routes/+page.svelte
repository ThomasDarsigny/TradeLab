<script lang="ts">
	import { onMount } from "svelte";
	import type { Account, Position, Transaction } from "$lib/types/account";
	import PortfolioCharts from "$lib/components/PortfolioCharts.svelte";
	import TransactionsHistory from "$lib/components/TransactionsHistory.svelte";
	import { supabase } from "$lib/supabaseClient";

	let account = $state<Account | null>(null);
	let positions = $state<Position[]>([]);
	let transactions = $state<Transaction[]>([]);
	let loading = $state(true);
	let error = $state("");
	let showBalanceChart = $state(false);
	let portfolioRealtimeChannel: any = null;
	let realtimeRetryTimer: ReturnType<typeof setTimeout> | null = null;
	let balanceChartInterval: ReturnType<typeof setInterval> | null = null;
	let balanceChartFrame: number | null = null;
	let lastBalanceChartSignature = "";
	let balanceChartRefreshCount = $state(0);
	let balanceChartLastRefresh = $state<string | null>(null);
	let balanceZoomLevel = $state(1);
	let isBalanceChartPanning = $state(false);
	let balancePanStartX: number | null = null;
	const POSITIONS_REFRESH_MS = 5000;
	const TRANSACTIONS_LIMIT_LIST = 100;
	const TRANSACTIONS_LIMIT_CHART = 1000;

	const handleLogoError = (event: Event) => {
		const target = event.currentTarget as HTMLImageElement | null;
		if (target) {
			const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="rgba(59, 130, 246, 0.1)" width="40" height="40" rx="10"/><circle cx="20" cy="20" r="6" fill="rgba(59, 130, 246, 0.8)"/></svg>`;
			target.src = "data:image/svg+xml;base64," + btoa(svg);
		}
	};

	const currency = new Intl.NumberFormat("fr-FR", {
		maximumFractionDigits: 2,
	});

	const currencyCompact = new Intl.NumberFormat("fr-FR", {
		notation: "compact",
		maximumFractionDigits: 1,
	});

	const totalInvested = $derived(
		positions.reduce((sum, pos) => sum + pos.quantity * pos.entry_price, 0),
	);

	const totalCurrent = $derived(
		positions.reduce(
			(sum, pos) => sum + pos.quantity * pos.current_price,
			0,
		),
	);

	const positionsValueFromBalances = $derived.by(() => {
		if (!account) return 0;
		const currentBalance = Math.max(0, Number(account.current_balance));
		const availableBalance = Number(account.available_balance);
		const rawPositionsValue = currentBalance - availableBalance;
		return Math.max(0, Math.min(currentBalance, rawPositionsValue));
	});

	const totalGain = $derived(totalCurrent - totalInvested);

	const getPositionReturnPercent = (pos: Position) => {
		const entry = Number(pos.entry_price);
		const current = Number(pos.current_price);
		if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(current)) {
			return 0;
		}
		return ((current - entry) / entry) * 100;
	};

	const getPositionPnLAmount = (pos: Position) => {
		const qty = Number(pos.quantity);
		const entry = Number(pos.entry_price);
		const current = Number(pos.current_price);
		if (
			!Number.isFinite(qty) ||
			!Number.isFinite(entry) ||
			!Number.isFinite(current)
		) {
			return 0;
		}
		return qty * (current - entry);
	};

	const formatSignedCompactMoney = (amount: number) => {
		const sign = amount >= 0 ? "+" : "-";
		return `${sign}$${currencyCompact.format(Math.abs(amount))}`;
	};

	$effect(() => {
		if (!showBalanceChart || !account) {
			if (balanceChartInterval) {
				clearInterval(balanceChartInterval);
				balanceChartInterval = null;
			}
			return;
		}

		const refreshModalChart = async () => {
			await Promise.all([
				updateAccountData(),
				updateTransactionsData(TRANSACTIONS_LIMIT_CHART),
			]);
			if (account) {
				drawBalanceChart(account, transactions);
			}
		};

		if (balanceChartInterval) {
			clearInterval(balanceChartInterval);
		}

		void refreshModalChart();

		balanceChartInterval = setInterval(() => {
			void refreshModalChart();
		}, 30000);

		return () => {
			if (balanceChartInterval) {
				clearInterval(balanceChartInterval);
				balanceChartInterval = null;
			}
		};
	});


	$effect(() => {
		if (!showBalanceChart || !account) {
			if (balanceChartFrame !== null) {
				cancelAnimationFrame(balanceChartFrame);
				balanceChartFrame = null;
			}
			lastBalanceChartSignature = "";
			return;
		}

		const lastTx = transactions.at(-1);
		const signature = [
			account.current_balance,
			account.initial_balance,
			transactions.length,
			lastTx?.id ?? "",
			lastTx?.created_at ?? "",
		].join("|");

		if (signature === lastBalanceChartSignature) {
			return;
		}

		lastBalanceChartSignature = signature;

		if (balanceChartFrame !== null) {
			cancelAnimationFrame(balanceChartFrame);
		}

		const currentAccount = account;

		balanceChartFrame = requestAnimationFrame(() => {
			drawBalanceChart(currentAccount, transactions);
			balanceChartFrame = null;
		});
	});

	const gainForLifetime = $derived.by(() => {
		return transactions.reduce((total, tx) => {
			let amount = 0;
			if (tx.type === 'sell') {
				amount = Number(tx.metadata?.profit_loss) || 0;
			} else if (tx.type === 'dividend') {
				amount = Number(tx.amount) || 0;
			}
			return total + amount;
		}, 0);
	});

	const totalPerformance = $derived(gainForLifetime + totalGain);

	async function loadPortfolio() {
		loading = true;
		error = "";
		try {
			const [accountRes, positionsRes, transactionsRes] =
				await Promise.all([
					fetch("/api/account", { credentials: "include" }),
					fetch("/api/account/positions", { credentials: "include" }),
					fetch(`/api/account/transactions?limit=${TRANSACTIONS_LIMIT_LIST}`, {
						credentials: "include",
					}),
				]);

			if (!accountRes.ok) {
				const data = await accountRes.json().catch(() => null);
				throw new Error(data?.error || "Compte introuvable");
			}

			const accountData = await accountRes.json();
			account = accountData.account;
			if (account?.id) {
				subscribePortfolioRealtime(account.id);
			}

			if (positionsRes.ok) {
				const data = await positionsRes.json();
				positions = data.positions || [];
			}

			if (transactionsRes.ok) {
				const data = await transactionsRes.json();
				transactions = data.transactions || [];
			}
		} catch (err) {
			error =
				err instanceof Error
					? err.message
					: "Erreur lors du chargement";
		} finally {
			loading = false;
		}
	}

	function stopPortfolioRealtime() {
		if (realtimeRetryTimer) {
			clearTimeout(realtimeRetryTimer);
			realtimeRetryTimer = null;
		}

		if (portfolioRealtimeChannel) {
			supabase.removeChannel(portfolioRealtimeChannel);
			portfolioRealtimeChannel = null;
		}
	}

	function subscribePortfolioRealtime(accountId: string) {
		if (!accountId) return;

		if (realtimeRetryTimer) {
			clearTimeout(realtimeRetryTimer);
			realtimeRetryTimer = null;
		}

		if (portfolioRealtimeChannel) {
			supabase.removeChannel(portfolioRealtimeChannel);
			portfolioRealtimeChannel = null;
		}

		portfolioRealtimeChannel = supabase
			.channel(`portfolio-live-${accountId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "accounts",
					filter: `id=eq.${accountId}`,
				},
				() => {
					void updateAccountData();
				},
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "positions",
					filter: `account_id=eq.${accountId}`,
				},
				() => {
					void updatePositionsData();
					void updateAccountData();
				},
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "transactions",
					filter: `account_id=eq.${accountId}`,
				},
				() => {
					void updateTransactionsData();
					void updateAccountData();
				},
			)
			.subscribe((status: string) => {
				if (status === "SUBSCRIBED") {
					void updateAccountData();
					void updatePositionsData();
					void updateTransactionsData();
					return;
				}

				if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
					if (realtimeRetryTimer || account?.id !== accountId) return;

					realtimeRetryTimer = setTimeout(() => {
						realtimeRetryTimer = null;
						if (account?.id === accountId) {
							subscribePortfolioRealtime(accountId);
						}
					}, 1000);
				}
			});
	}

	async function updateAccountData() {
		try {
			const accountRes = await fetch("/api/account", {
				credentials: "include",
			});

			if (accountRes.ok) {
				const accountData = await accountRes.json();
				if (accountData.account) {
					account = accountData.account;
				}
			}
		} catch (err) {}
	}

	function positionsHaveChanged(
		oldPositions: Position[],
		newPositions: Position[],
	): boolean {
		if (oldPositions.length !== newPositions.length) return true;

		for (let i = 0; i < oldPositions.length; i++) {
			const old = oldPositions[i];
			const newPos = newPositions[i];

			if (
				old.symbol !== newPos.symbol ||
				old.quantity !== newPos.quantity ||
				old.entry_price !== newPos.entry_price ||
				old.current_price !== newPos.current_price
			) {
				return true;
			}
		}
		return false;
	}

	async function updatePositionsData() {
		try {
			const positionsRes = await fetch("/api/account/positions", {
				credentials: "include",
			});

			if (positionsRes.ok) {
				const positionsData = await positionsRes.json();
				if (positionsData.positions) {
					const newPositions = positionsData.positions || [];

					if (positionsHaveChanged(positions, newPositions)) {
						positions = newPositions;
					}
				}
			}
		} catch (err) {}
	}

	async function updateTransactionsData(limit = TRANSACTIONS_LIMIT_LIST) {
		try {
			const transactionsRes = await fetch(
				`/api/account/transactions?limit=${limit}`,
				{
					credentials: "include",
				},
			);

			if (transactionsRes.ok) {
				const data = await transactionsRes.json();
				if (data.transactions) {
					transactions = data.transactions || [];
				}
			}
		} catch (err) {}
	}

	onMount(() => {
		loadPortfolio();

		const handleAccountUpdated = () => {
			void updateAccountData();
			void updatePositionsData();
			void updateTransactionsData();
		};

		window.addEventListener("account-updated", handleAccountUpdated);

		const accountInterval = setInterval(() => {
			updateAccountData();
		}, 30000);

		const positionsInterval = setInterval(() => {
			updatePositionsData();
		}, POSITIONS_REFRESH_MS);

		const transactionsInterval = setInterval(() => {
			updateTransactionsData();
		}, 30000);

		return () => {
			stopPortfolioRealtime();
			window.removeEventListener("account-updated", handleAccountUpdated);
			clearInterval(accountInterval);
			clearInterval(positionsInterval);
			clearInterval(transactionsInterval);
			if (balanceChartInterval) {
				clearInterval(balanceChartInterval);
				balanceChartInterval = null;
			}
			if (balanceChartFrame !== null) {
				cancelAnimationFrame(balanceChartFrame);
				balanceChartFrame = null;
			}
			if ((window as any).balanceChartInstance) {
				(window as any).balanceChartInstance.destroy();
				(window as any).balanceChartInstance = null;
			}
		};
	});

	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Title,
		Tooltip,
		Legend,
	} from "chart.js";
	ChartJS.register(
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Title,
		Tooltip,
		Legend,
	);

	function formatRefreshTime(date: Date): string {
		return date.toLocaleTimeString("fr-CA", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	function updateChartRefreshStatus() {
		balanceChartRefreshCount += 1;
		balanceChartLastRefresh = formatRefreshTime(new Date());
	}

	function setChartZoom(min: number | undefined, max: number | undefined) {
		if (typeof window === "undefined") return;
		const instance = (window as any).balanceChartInstance;
		if (!instance) return;

		instance.options.scales.x.min = min;
		instance.options.scales.x.max = max;
		instance.update("none");
	}

	function zoomBalanceChartIn() {
		if (typeof window === "undefined") return;
		const instance = (window as any).balanceChartInstance;
		if (!instance) return;

		const labelsLength = instance.data?.labels?.length ?? 0;
		if (labelsLength < 4) return;

		const currentMin = Number.isFinite(instance.options.scales.x.min)
			? Number(instance.options.scales.x.min)
			: 0;
		const currentMax = Number.isFinite(instance.options.scales.x.max)
			? Number(instance.options.scales.x.max)
			: labelsLength - 1;

		const visible = currentMax - currentMin + 1;
		if (visible <= 4) return;

		const reduceBy = Math.max(1, Math.floor(visible * 0.2));
		const nextMin = currentMin + Math.floor(reduceBy / 2);
		const nextMax = currentMax - Math.ceil(reduceBy / 2);

		setChartZoom(nextMin, nextMax);
		balanceZoomLevel = Math.min(8, Number((balanceZoomLevel * 1.25).toFixed(2)));
	}

	function zoomBalanceChartOut() {
		if (typeof window === "undefined") return;
		const instance = (window as any).balanceChartInstance;
		if (!instance) return;

		const labelsLength = instance.data?.labels?.length ?? 0;
		if (labelsLength < 2) return;

		const currentMin = Number.isFinite(instance.options.scales.x.min)
			? Number(instance.options.scales.x.min)
			: 0;
		const currentMax = Number.isFinite(instance.options.scales.x.max)
			? Number(instance.options.scales.x.max)
			: labelsLength - 1;

		const visible = currentMax - currentMin + 1;
		if (visible >= labelsLength) {
			setChartZoom(undefined, undefined);
			balanceZoomLevel = 1;
			return;
		}

		const growBy = Math.max(1, Math.floor(visible * 0.25));
		const nextMin = Math.max(0, currentMin - Math.floor(growBy / 2));
		const nextMax = Math.min(labelsLength - 1, currentMax + Math.ceil(growBy / 2));

		setChartZoom(nextMin, nextMax);
		balanceZoomLevel = Math.max(1, Number((balanceZoomLevel / 1.25).toFixed(2)));
	}

	function handleBalanceChartWheel(event: WheelEvent) {
		event.preventDefault();
		if (event.deltaY < 0) {
			zoomBalanceChartIn();
			return;
		}
		zoomBalanceChartOut();
	}

	function startBalanceChartPan(event: MouseEvent) {
		if (event.button !== 0) return;
		isBalanceChartPanning = true;
		balancePanStartX = event.clientX;
	}

	function stopBalanceChartPan() {
		isBalanceChartPanning = false;
		balancePanStartX = null;
	}

	function moveBalanceChartPan(event: MouseEvent) {
		if (!isBalanceChartPanning || balancePanStartX === null) return;

		const instance = (window as any).balanceChartInstance;
		const canvas = event.currentTarget as HTMLCanvasElement | null;
		if (!instance || !canvas) return;

		const labelsLength = instance.data?.labels?.length ?? 0;
		if (labelsLength < 2) return;

		const currentMin = Number.isFinite(instance.options.scales.x.min)
			? Number(instance.options.scales.x.min)
			: 0;
		const currentMax = Number.isFinite(instance.options.scales.x.max)
			? Number(instance.options.scales.x.max)
			: labelsLength - 1;

		const visible = currentMax - currentMin + 1;
		if (visible >= labelsLength) return;

		const deltaX = event.clientX - balancePanStartX;
		const width = Math.max(1, canvas.clientWidth);
		const shift = Math.round((deltaX / width) * visible);
		if (shift === 0) return;

		let nextMin = currentMin - shift;
		let nextMax = currentMax - shift;

		if (nextMin < 0) {
			nextMax -= nextMin;
			nextMin = 0;
		}

		if (nextMax > labelsLength - 1) {
			const overflow = nextMax - (labelsLength - 1);
			nextMin -= overflow;
			nextMax = labelsLength - 1;
		}

		nextMin = Math.max(0, Math.round(nextMin));
		nextMax = Math.min(labelsLength - 1, Math.round(nextMax));

		setChartZoom(nextMin, nextMax);
		balancePanStartX = event.clientX;
	}

	function drawBalanceChart(account: Account, transactions: Transaction[]) {
		const canvas = document.getElementById(
			"balance-chart",
		) as HTMLCanvasElement;
		if (!canvas) return;

		const asAmount = (value: unknown) => Math.abs(Number(value) || 0);
		const getTransactionDelta = (tx: Transaction) => {
			const amount = asAmount(tx.amount);
			switch (tx.type) {
				case "deposit":
					return amount;
				case "withdrawal":
					return -amount;
				case "buy":
					return -amount;
				case "sell":
					return amount;
				case "dividend":
					return amount;
				default:
					return 0;
			}
		};

		const balanceHistory: { date: string; balance: number }[] = [];
		const transactionsSorted = [...transactions].sort(
			(a, b) =>
				new Date(a.created_at).getTime() -
				new Date(b.created_at).getTime(),
		);

		const totalDelta = transactionsSorted.reduce(
			(total, tx) => total + getTransactionDelta(tx),
			0,
		);

		let runningBalance = Number(account.current_balance) - totalDelta;

		balanceHistory.push({
			date: new Date(account.created_at).toLocaleDateString("fr-FR"),
			balance: runningBalance,
		});

		for (const tx of transactionsSorted) {
			runningBalance += getTransactionDelta(tx);
			balanceHistory.push({
				date: new Date(tx.created_at).toLocaleDateString("fr-FR"),
				balance: runningBalance,
			});
		}

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		if (typeof window !== "undefined") {
			const previousChart = (window as any).balanceChartInstance;
			const previousMin = Number.isFinite(previousChart?.options?.scales?.x?.min)
				? Number(previousChart.options.scales.x.min)
				: undefined;
			const previousMax = Number.isFinite(previousChart?.options?.scales?.x?.max)
				? Number(previousChart.options.scales.x.max)
				: undefined;

			if ((window as any).balanceChartInstance) {
				(window as any).balanceChartInstance.destroy();
			}
			const colors = getComputedStyle(document.documentElement);
			const textPrimary =
				colors.getPropertyValue("--text-primary").trim() || "#111827";
			const accentPrimary =
				colors.getPropertyValue("--accent-primary").trim() || "#3b82f6";
			const borderPrimary =
				colors.getPropertyValue("--border-primary").trim() ||
				"rgba(0, 0, 0, 0.1)";
			const bgCard =
				colors.getPropertyValue("--bg-secondary").trim() || "#0f172a";
			(window as any).balanceChartInstance = new ChartJS(ctx, {
				type: "line",
				data: {
					labels: balanceHistory.map((h) => h.date),
					datasets: [
						{
							label: "Solde total",
							data: balanceHistory.map((h) => h.balance),
							borderColor: accentPrimary,
							backgroundColor: "rgba(59, 130, 246, 0.14)",
							borderWidth: 3,
							fill: true,
							tension: 0.25,
							pointRadius: 2,
							pointHoverRadius: 5,
							pointBackgroundColor: accentPrimary,
							pointBorderColor: "#fff",
							pointBorderWidth: 1,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: {
						intersect: false,
						mode: "index",
					},
					plugins: {
						legend: {
							display: true,
							labels: {
								color: textPrimary,
								usePointStyle: true,
								padding: 12,
								boxWidth: 10,
							},
						},
						tooltip: {
							backgroundColor: bgCard,
							borderColor: borderPrimary,
							borderWidth: 1,
							titleColor: textPrimary,
							bodyColor: textPrimary,
							callbacks: {
								label: (context) => {
									return `$${Number(context.raw).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`;
								},
							},
						},
					},
					scales: {
						y: {
							ticks: {
								color: textPrimary,
								callback: (value) =>
									`$${currencyCompact.format(Number(value))}`,
								maxTicksLimit: 6,
							},
							grid: {
								color: borderPrimary,
							},
						},
						x: {
							min: previousMin,
							max: previousMax,
							ticks: {
								color: textPrimary,
								autoSkip: true,
								maxTicksLimit: 8,
							},
							grid: {
								color: borderPrimary,
								display: false,
							},
						},
					},
				},
			});
			updateChartRefreshStatus();
		}
	}

	if (typeof window !== "undefined") {
		(window as any).drawBalanceChart = drawBalanceChart;
	}
</script>

<svelte:head>
	<title>TradeLab - Portefeuille</title>
	<meta
		name="description"
		content="Plateforme bourse et actualites financieres"
	/>
</svelte:head>

<div class="portfolio-page">
	<div class="page-header">
		<div>
			<h1>Portefeuille</h1>
			<p>Vue d'ensemble de votre compte, positions et performances.</p>
		</div>
		<button
			class="refresh"
			type="button"
			onclick={loadPortfolio}
			disabled={loading}
		>
			{loading ? "Chargement..." : "Rafraichir"}
		</button>
	</div>

	{#if error}
		<div class="error-banner">{error}</div>
	{:else if loading}
		<div class="loading">Chargement du portefeuille...</div>
	{:else}
		<section class="summary-grid">
			<div
				class="summary-card"
				title="Solde courant = Argent disponible + Valeur actuelle de vos positions"
			>
				<span>Solde courant</span>
				<strong
					>${currency.format(account?.current_balance ?? 0)}</strong
				>
				<small>Valeur totale du portefeuille</small>
			</div>
			<div
				class="summary-card"
				title="Solde disponible = Argent liquide disponible pour trader (sans positions)"
			>
				<span>Solde disponible</span>
				<strong
					>${currency.format(account?.available_balance ?? 0)}</strong
				>
				<small>Capital liquide</small>
			</div>
			<div class="summary-card">
				<span>Valeur des positions</span>
				<strong>${currency.format(positionsValueFromBalances)}</strong>
			</div>
			<button
				type="button"
				class="summary-card gain-loss-card"
				class:positive={totalPerformance >= 0}
				class:negative={totalPerformance < 0}
				onclick={() => (showBalanceChart = true)}
			>
				<span>Performance Totale</span>
				<strong
					>{totalPerformance >= 0 ? "+" : ""}${currency.format(
						totalPerformance,
					)}</strong
				>
				<small class="balance-chart-hint">Afficher l'évolution du solde</small>
			</button>
		</section>

		<section class="charts-section">
			{#if positions.length > 0}
				<PortfolioCharts
					{positions}
					accountBalance={account?.current_balance ?? 0}
				/>
			{:else}
				<div class="empty-card">
					Aucune position ouverte pour le moment.
				</div>
			{/if}
		</section>

		<section class="positions-section">
			<div class="section-header">
				<h3>Titres possedés</h3>
				<p>Cliquez sur un titre pour voir les détails.</p>
			</div>
			{#if positions.length > 0}
				<div class="positions-grid">
					{#each positions as pos (pos.symbol)}
						<a class="position-card" href={`/stock/${pos.symbol}`}>
							<div class="position-main">
								<img
									class="position-logo"
									src={`/api/stock/logo/${pos.symbol}`}
									alt={`Logo ${pos.symbol}`}
									loading="lazy"
									decoding="async"
									onerror={handleLogoError}
								/>
								<div>
									<strong>{pos.symbol}</strong>
								</div>
							</div>
							<div class="position-meta">
								<span>Quantité: {pos.quantity}</span>
								<span
									>Prix: ${currency.format(
										pos.current_price,
									)}</span
								>
								<span
									class:positive={getPositionReturnPercent(pos) >= 0}
									class:negative={getPositionReturnPercent(pos) < 0}
								>
									Rendement: {getPositionReturnPercent(pos) >= 0 ? '+' : ''}{getPositionReturnPercent(pos).toFixed(2)}% ({formatSignedCompactMoney(getPositionPnLAmount(pos))})
								</span>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="empty-card">Aucun titre détenu.</div>
			{/if}
		</section>

		<section class="history-section">
			<TransactionsHistory {transactions} />
		</section>
	{/if}
</div>

{#if showBalanceChart && account && transactions}
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => e.key === "Escape" && (showBalanceChart = false)}
	>
		<div class="modal-card" role="document">
			<div class="modal-header">
				<h3>Évolution du solde</h3>
				<button
					class="modal-close"
					type="button"
					aria-label="Fermer"
					onclick={() => (showBalanceChart = false)}
					onkeydown={(e) =>
						(e.key === "Enter" || e.key === " ") &&
						(showBalanceChart = false)}>✕</button
				>
			</div>
			<div class="balance-chart-container">
				<div class="chart-toolbar">
					<p class="chart-info">
						Évolution du solde total de votre compte au fil du temps
					</p>
				</div>
				<canvas
					id="balance-chart"
					class="balance-chart-canvas"
					class:panning={isBalanceChartPanning}
					onwheel={handleBalanceChartWheel}
					onmousedown={startBalanceChartPan}
					onmousemove={moveBalanceChartPan}
					onmouseup={stopBalanceChartPan}
					onmouseleave={stopBalanceChartPan}
					style="height: 380px; max-height: 400px;"
				></canvas>
			</div>
		</div>
	</div>
{/if}

<style>
	.portfolio-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2.5rem 2rem 4rem;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.35rem 0;
		color: var(--text-primary);
	}

	.page-header p {
		margin: 0;
		color: var(--text-secondary);
	}

	.refresh {
		padding: 0.6rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--border-primary);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		cursor: pointer;
	}

	.refresh:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.summary-card {
		background: linear-gradient(
			135deg,
			rgba(59, 130, 246, 0.1),
			rgba(37, 99, 235, 0.05)
		);
		border: 1px solid rgba(59, 130, 246, 0.2);
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow:
			0 4px 6px -2px rgba(0, 0, 0, 0.15),
			0 0 0 1px rgba(59, 130, 246, 0.05),
			inset 0 0 1px rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.3s ease;
	}

	.summary-card:hover {
		border-color: rgba(59, 130, 246, 0.3);
		box-shadow:
			0 12px 24px -8px rgba(59, 130, 246, 0.1),
			0 0 0 1px rgba(59, 130, 246, 0.1);
	}

	.summary-card span {
		color: var(--text-secondary);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		text-align: left;
	}

	.summary-card strong {
		color: var(--text-primary);
		font-size: 1.4rem;
		text-align: left;
	}

	.summary-card small {
		color: var(--text-secondary);
		font-size: 0.74rem;
		line-height: 1.05;
		text-align: left;
		margin-top: 5px;
	}

	.gain-loss-card .balance-chart-hint {
		margin-top: 10px;
	}

	.gain-loss-card.positive strong {
		color: var(--accent-green);
	}

	.gain-loss-card.negative strong {
		color: var(--accent-red);
	}

	.charts-section {
		margin-top: 2rem;
	}

	.positions-section {
		margin-top: 2rem;
	}

	.section-header h3 {
		margin: 0 0 0.35rem 0;
		color: var(--text-primary);
		font-size: 1.2rem;
	}

	.section-header p {
		margin: 0 0 1.25rem 0;
		color: var(--text-secondary);
		font-size: 0.95rem;
	}

	.positions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.25rem;
	}

	.position-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1.25rem;
		border-radius: 12px;
		border: 1px solid rgba(59, 130, 246, 0.1);
		background: linear-gradient(
			135deg,
			rgba(59, 130, 246, 0.05),
			rgba(37, 99, 235, 0.02)
		);
		color: inherit;
		text-decoration: none;
		box-shadow:
			0 4px 6px -2px rgba(0, 0, 0, 0.15),
			0 0 0 1px rgba(59, 130, 246, 0.05);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.position-card:hover {
		transform: translateY(-4px);
		border-color: rgba(59, 130, 246, 0.2);
		box-shadow:
			0 20px 25px -5px rgba(59, 130, 246, 0.15),
			0 0 0 1px rgba(59, 130, 246, 0.1);
	}

	.position-main {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.position-logo {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-primary);
		object-fit: contain;
	}

	.position-card strong {
		display: block;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.position-card span {
		display: block;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.position-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.position-meta .positive {
		color: var(--accent-green);
		font-weight: 600;
	}

	.position-meta .negative {
		color: var(--accent-red);
		font-weight: 600;
	}

	.history-section {
		margin-top: 2rem;
	}

	.loading,
	.error-banner,
	.empty-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 1.5rem;
		color: var(--text-secondary);
	}

	.error-banner {
		border-color: rgba(239, 68, 68, 0.5);
		color: var(--accent-red);
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(10, 14, 26, 0.7);
		backdrop-filter: blur(8px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.modal-card {
		background: linear-gradient(
			135deg,
			var(--bg-secondary) 0%,
			var(--bg-tertiary) 100%
		);
		border: 1px solid var(--border-primary);
		border-radius: 20px;
		max-width: 900px;
		width: 100%;
		max-height: 80vh;
		padding: 2rem;
		box-shadow: 0 20px 60px rgba(59, 130, 246, 0.15);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--border-primary);
		padding-bottom: 1rem;
	}

	.modal-header h3 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.5rem;
	}

	.modal-close {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.modal-close:hover {
		background: var(--bg-tertiary);
		color: var(--accent-primary);
	}

	.balance-chart-container {
		flex: 1;
		overflow: auto;
		padding: 1rem 0;
	}

	.chart-info {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin: 0 0 1rem 0;
	}

	.balance-chart-canvas {
		cursor: grab;
		user-select: none;
	}

	.balance-chart-canvas.panning {
		cursor: grabbing;
	}

	.chart-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	@keyframes pulseLive {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.modal-card {
			max-height: 90vh;
			padding: 1.5rem;
		}

		.modal-header h3 {
			font-size: 1.2rem;
		}

		.chart-toolbar {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
