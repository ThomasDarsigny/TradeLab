<script lang="ts">
	import { onMount } from "svelte";
	import "./+page.css";

	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	let enabled = $state(false);
	let symbolsInput = $state("BTC-USD");
	let strategySuccess = $state<string | null>(null);
	let strategyError = $state<string | null>(null);

	type StrategyConfig = {
		scanIntervalSeconds: number;
		enableTrend: boolean;
		enableRange: boolean;
		enableBreakout: boolean;
		trendAdxMin: number;
		rangeAdxMax: number;
		breakoutVolumeMultiplier: number;
		breakoutDonchianFactor: number;
		breakoutStcMin: number;
		hardStopLossPercent: number;
		takeProfitPercent: number;
		profitZonePercent: number;
		stcReversalPrevMin: number;
		stcReversalCurrentMax: number;
		smaBreakFactor: number;
		rsiRangeBuyMax: number;
		atrMultiplierStock: number;
		atrMultiplierCrypto: number;
	};

	const defaultStrategyConfig: StrategyConfig = {
		scanIntervalSeconds: 5,
		enableTrend: true,
		enableRange: true,
		enableBreakout: true,
		trendAdxMin: 25,
		rangeAdxMax: 20,
		breakoutVolumeMultiplier: 1.5,
		breakoutDonchianFactor: 0.99,
		breakoutStcMin: 60,
		hardStopLossPercent: 5,
		takeProfitPercent: 10,
		profitZonePercent: 0.8,
		stcReversalPrevMin: 85,
		stcReversalCurrentMax: 82,
		smaBreakFactor: 0.9,
		rsiRangeBuyMax: 40,
		atrMultiplierStock: 2.5,
		atrMultiplierCrypto: 3.5,
	};

	const strategyTooltips: Record<keyof StrategyConfig, string> = {
		scanIntervalSeconds:
			"Fréquence d’exécution du bot en secondes. Plus bas = réactions plus rapides, mais plus d’appels API.",
		enableTrend:
			"Active ou désactive la stratégie d’entrée en tendance (ADX + EMA alignées).",
		enableRange:
			"Active ou désactive la stratégie d’entrée en range/reversal (RSI bas + contexte range).",
		enableBreakout:
			"Active ou désactive la stratégie d’entrée breakout (volume + Donchian + STC).",
		trendAdxMin:
			"Seuil ADX minimum pour considérer un marché en tendance forte. Plus haut = entrées trend plus sélectives.",
		rangeAdxMax:
			"Seuil ADX maximum pour considérer un marché en range. Plus bas = moins de signaux range.",
		breakoutVolumeMultiplier:
			"Le volume actuel doit dépasser la moyenne × ce multiplicateur pour valider un breakout.",
		breakoutDonchianFactor:
			"Facteur appliqué au haut du canal Donchian pour déclencher l’entrée breakout (ex: 0.99 = légèrement avant le break exact).",
		breakoutStcMin:
			"Valeur STC minimale exigée pour confirmer la force d’un breakout.",
		hardStopLossPercent:
			"Perte maximale tolérée (%) avant sortie forcée immédiate de la position.",
		takeProfitPercent:
			"Objectif de gain (%) où le bot prend automatiquement ses profits.",
		profitZonePercent:
			"Zone de profit minimale (%) avant d’autoriser certaines règles de sortie intelligentes (STC/EMA/ATR).",
		stcReversalPrevMin:
			"Valeur STC précédente minimale pour détecter un sommet potentiel avant retournement.",
		stcReversalCurrentMax:
			"Valeur STC actuelle maximale pour confirmer le retournement baissier après un sommet.",
		smaBreakFactor:
			"Facteur de rupture SMA20 pour sortie défensive. Ex: 0.9 = sortie si prix < SMA20 × 0.9.",
		rsiRangeBuyMax:
			"RSI maximal autorisé pour les entrées en mode range (plus bas = entrées plus conservatrices).",
		atrMultiplierStock:
			"Multiplicateur ATR utilisé pour calculer stop/trailing sur actions.",
		atrMultiplierCrypto:
			"Multiplicateur ATR utilisé pour calculer stop/trailing sur crypto (souvent plus élevé à cause de la volatilité).",
	};

	let strategyConfig = $state<StrategyConfig>({ ...defaultStrategyConfig });

	const activeStrategiesCount = $derived.by(
		() =>
			[
				strategyConfig.enableTrend,
				strategyConfig.enableRange,
				strategyConfig.enableBreakout,
			].filter(Boolean).length,
	);

	const normalizedSymbols = $derived.by(() => {
		return symbolsInput
			.split(",")
			.map((symbol) => symbol.trim().toUpperCase())
			.filter(Boolean);
	});

	const parseNumber = (value: unknown, fallback: number) => {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	};

	const parseBoolean = (value: unknown, fallback: boolean) => {
		if (typeof value === "boolean") return value;
		if (typeof value === "string") {
			const normalized = value.trim().toLowerCase();
			if (normalized === "true") return true;
			if (normalized === "false") return false;
		}
		return fallback;
	};

	const normalizeStrategyConfig = (raw: unknown): StrategyConfig => {
		const parsed =
			typeof raw === "object" && raw !== null
				? (raw as Partial<StrategyConfig>)
				: {};
		return {
			scanIntervalSeconds: parseNumber(
				parsed.scanIntervalSeconds,
				defaultStrategyConfig.scanIntervalSeconds,
			),
			enableTrend: parseBoolean(
				parsed.enableTrend,
				defaultStrategyConfig.enableTrend,
			),
			enableRange: parseBoolean(
				parsed.enableRange,
				defaultStrategyConfig.enableRange,
			),
			enableBreakout: parseBoolean(
				parsed.enableBreakout,
				defaultStrategyConfig.enableBreakout,
			),
			trendAdxMin: parseNumber(
				parsed.trendAdxMin,
				defaultStrategyConfig.trendAdxMin,
			),
			rangeAdxMax: parseNumber(
				parsed.rangeAdxMax,
				defaultStrategyConfig.rangeAdxMax,
			),
			breakoutVolumeMultiplier: parseNumber(
				parsed.breakoutVolumeMultiplier,
				defaultStrategyConfig.breakoutVolumeMultiplier,
			),
			breakoutDonchianFactor: parseNumber(
				parsed.breakoutDonchianFactor,
				defaultStrategyConfig.breakoutDonchianFactor,
			),
			breakoutStcMin: parseNumber(
				parsed.breakoutStcMin,
				defaultStrategyConfig.breakoutStcMin,
			),
			hardStopLossPercent: parseNumber(
				parsed.hardStopLossPercent,
				defaultStrategyConfig.hardStopLossPercent,
			),
			takeProfitPercent: parseNumber(
				parsed.takeProfitPercent,
				defaultStrategyConfig.takeProfitPercent,
			),
			profitZonePercent: parseNumber(
				parsed.profitZonePercent,
				defaultStrategyConfig.profitZonePercent,
			),
			stcReversalPrevMin: parseNumber(
				parsed.stcReversalPrevMin,
				defaultStrategyConfig.stcReversalPrevMin,
			),
			stcReversalCurrentMax: parseNumber(
				parsed.stcReversalCurrentMax,
				defaultStrategyConfig.stcReversalCurrentMax,
			),
			smaBreakFactor: parseNumber(
				parsed.smaBreakFactor,
				defaultStrategyConfig.smaBreakFactor,
			),
			rsiRangeBuyMax: parseNumber(
				parsed.rsiRangeBuyMax,
				defaultStrategyConfig.rsiRangeBuyMax,
			),
			atrMultiplierStock: parseNumber(
				parsed.atrMultiplierStock,
				defaultStrategyConfig.atrMultiplierStock,
			),
			atrMultiplierCrypto: parseNumber(
				parsed.atrMultiplierCrypto,
				defaultStrategyConfig.atrMultiplierCrypto,
			),
		};
	};

	const validateStrategyConfig = (config: StrategyConfig) => {
		if (config.scanIntervalSeconds < 1) {
			return "L’intervalle d’analyse doit être supérieur ou égal à 1 seconde.";
		}
		if (config.trendAdxMin <= config.rangeAdxMax) {
			return "Trend ADX min doit être supérieur à Range ADX max.";
		}
		if (config.breakoutVolumeMultiplier <= 1) {
			return "Le multiplicateur de volume breakout doit être > 1.";
		}
		if (config.hardStopLossPercent <= 0 || config.takeProfitPercent <= 0) {
			return "Les pourcentages de stop-loss et take-profit doivent être > 0.";
		}
		if (config.smaBreakFactor <= 0 || config.smaBreakFactor > 1) {
			return "SMA break factor doit être entre 0 et 1.";
		}
		return null;
	};

	const notifyTradingBotSettingsUpdated = (
		nextEnabled: boolean,
		nextSymbols: string,
	) => {
		if (typeof window === "undefined") return;
		window.dispatchEvent(
			new CustomEvent("trading-bot-settings-updated", {
				detail: {
					enabled: nextEnabled,
					symbols: nextSymbols,
				},
			}),
		);
	};

	const persistStrategyConfig = async () => {
		strategyError = null;
		strategySuccess = null;
		const validationError = validateStrategyConfig(strategyConfig);
		if (validationError) {
			strategyError = validationError;
			return;
		}

		saving = true;
		try {
			const response = await fetch("/api/settings/trading-bot", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					enabled,
					symbols:
						normalizedSymbols.length > 0
							? normalizedSymbols.join(", ")
							: "BTC-USD",
					strategyConfig,
				}),
			});

			const data = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(
					data?.error ||
						"Erreur lors de la sauvegarde de la stratégie.",
				);
			}

			strategyConfig = normalizeStrategyConfig(
				data?.strategyConfig ?? strategyConfig,
			);
			strategySuccess = "Paramètres de stratégie sauvegardés.";
			notifyTradingBotSettingsUpdated(
				enabled,
				normalizedSymbols.length > 0
					? normalizedSymbols.join(", ")
					: "BTC-USD",
			);
		} catch (err) {
			strategyError =
				err instanceof Error
					? err.message
					: "Erreur lors de la sauvegarde de la stratégie.";
		} finally {
			saving = false;
		}
	};

	const resetStrategyConfig = () => {
		strategyConfig = { ...defaultStrategyConfig };
		strategyError = null;
		strategySuccess =
			"Valeurs par défaut chargées. Cliquez sur sauvegarder stratégie.";
	};

	const loadSettings = async () => {
		loading = true;
		error = null;
		success = null;
		strategyError = null;
		strategySuccess = null;
		try {
			const response = await fetch("/api/settings/trading-bot", {
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error("Impossible de charger les paramètres du bot.");
			}

			const data = await response.json();
			enabled = Boolean(data?.enabled);
			symbolsInput = String(data?.symbols ?? "BTC-USD");
			strategyConfig = normalizeStrategyConfig(data?.strategyConfig);
		} catch (err) {
			error = err instanceof Error ? err.message : "Erreur réseau.";
		} finally {
			loading = false;
		}
	};

	const saveSettings = async () => {
		error = null;
		success = null;

		if (normalizedSymbols.length === 0) {
			error = "Ajoutez au moins un symbole (ex: BTC-USD, AAPL).";
			return;
		}

		saving = true;
		try {
			const response = await fetch("/api/settings/trading-bot", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					enabled,
					symbols: normalizedSymbols.join(", "),
					strategyConfig,
				}),
			});

			const data = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(data?.error || "Erreur lors de la sauvegarde.");
			}

			enabled = Boolean(data?.enabled);
			symbolsInput = String(
				data?.symbols ?? normalizedSymbols.join(", "),
			);
			strategyConfig = normalizeStrategyConfig(
				data?.strategyConfig ?? strategyConfig,
			);
			success = "Paramètres sauvegardés avec succès.";
			notifyTradingBotSettingsUpdated(enabled, symbolsInput);
		} catch (err) {
			error =
				err instanceof Error
					? err.message
					: "Erreur lors de la sauvegarde.";
		} finally {
			saving = false;
		}
	};

	const toggleEnabled = async (event: Event) => {
		const target = event.currentTarget as HTMLInputElement | null;
		if (!target) return;

		error = null;
		success = null;

		const nextEnabled = target.checked;
		const previousEnabled = enabled;
		enabled = nextEnabled;

		saving = true;
		try {
			const response = await fetch("/api/settings/trading-bot", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					enabled: nextEnabled,
					symbols:
						normalizedSymbols.length > 0
							? normalizedSymbols.join(", ")
							: "BTC-USD",
					strategyConfig,
				}),
			});

			const data = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(
					data?.error ||
						"Erreur lors de la mise à jour du statut du bot.",
				);
			}

			enabled = Boolean(data?.enabled);
			symbolsInput = String(
				data?.symbols ??
					(normalizedSymbols.length > 0
						? normalizedSymbols.join(", ")
						: "BTC-USD"),
			);
			strategyConfig = normalizeStrategyConfig(
				data?.strategyConfig ?? strategyConfig,
			);
			success = enabled ? "Bot activé." : "Bot désactivé.";
			notifyTradingBotSettingsUpdated(enabled, symbolsInput);
		} catch (err) {
			enabled = previousEnabled;
			error =
				err instanceof Error
					? err.message
					: "Erreur lors de la mise à jour du statut du bot.";
		} finally {
			saving = false;
		}
	};

	onMount(() => {
		void loadSettings();
	});
</script>

<svelte:head>
	<title>TradeLab - Trading Bot</title>
	<meta
		name="description"
		content="Configurer facilement les paramètres du Trading Bot"
	/>
</svelte:head>

<div class="bot-settings-page">
	<header class="page-header">
		<h1>Trading Bot</h1>
		<p>Configurez rapidement votre bot.</p>
	</header>

	{#if loading}
		<div class="status-card">Chargement des paramètres...</div>
	{:else}
		<section
			class="hero-summary"
			aria-label="Résumé de la configuration du bot"
		>
			<div class="hero-item">
				<span class="hero-label">Statut</span>
				<strong class:enabled class="hero-value"
					>{enabled ? "Actif" : "Inactif"}</strong
				>
			</div>
			<div class="hero-item">
				<span class="hero-label">Symboles suivis</span>
				<strong class="hero-value">{normalizedSymbols.length}</strong>
			</div>
			<div class="hero-item">
				<span class="hero-label">Intervalle</span>
				<strong class="hero-value"
					>{strategyConfig.scanIntervalSeconds}s</strong
				>
			</div>
			<div class="hero-item">
				<span class="hero-label">Stratégies actives</span>
				<strong class="hero-value">{activeStrategiesCount}/3</strong>
			</div>
		</section>

		<section class="card card-emphasis">
			<div class="card-header">
				<h2>Paramètres du bot</h2>
				<small>Exécution générale</small>
			</div>

			<div class="field-row toggle-row">
				<div>
					<label for="bot-enabled">Activer le Trading Bot</label>
					<small>Active ou désactive l’exécution automatique.</small>
				</div>
				<label class="switch" aria-label="Activer le Trading Bot">
					<input
						id="bot-enabled"
						type="checkbox"
						checked={enabled}
						onchange={toggleEnabled}
						disabled={saving}
					/>
					<span class="slider"></span>
				</label>
			</div>

			<div class="field-row">
				<label for="bot-symbols">Symboles</label>
				<textarea
					id="bot-symbols"
					rows="3"
					placeholder="BTC-USD, ETH-USD, AAPL"
					bind:value={symbolsInput}
					disabled={saving}
				></textarea>
				{#if normalizedSymbols.length > 0}
					<div class="symbol-chips">
						{#each normalizedSymbols as symbol (symbol)}
							<span>{symbol}</span>
						{/each}
					</div>
				{/if}
				<small
					>Séparez par des virgules. Ex: BTC-USD, ETH-USD, AAPL</small
				>
			</div>

			<div class="field-row">
				<label
					for="scan-interval"
					title={strategyTooltips.scanIntervalSeconds}
					>Intervalle d'analyse (secondes)</label
				>
				<input
					id="scan-interval"
					type="number"
					min="1"
					step="1"
					bind:value={strategyConfig.scanIntervalSeconds}
					title={strategyTooltips.scanIntervalSeconds}
					aria-label={strategyTooltips.scanIntervalSeconds}
					disabled={saving}
				/>
				<small>Fréquence de scan du bot (minimum 1 seconde).</small>
			</div>

			<div class="actions">
				<button
					class="btn-primary"
					type="button"
					onclick={saveSettings}
					disabled={saving}
				>
					{saving ? "Sauvegarde..." : "Sauvegarder"}
				</button>
			</div>

			{#if error}
				<div class="message error">{error}</div>
			{/if}
			{#if success}
				<div class="message success">{success}</div>
			{/if}
		</section>

		<section class="card">
			<div class="card-header">
				<h2>Paramètres de stratégie</h2>
				<small>Breakout, trend/range, risk management</small>
			</div>

			<div class="strategy-grid">
				<div class="field-row strategy-toggle-row">
					<label
						for="enable-trend"
						title={strategyTooltips.enableTrend}
						>Stratégie Trend</label
					>
					<button
						id="enable-trend"
						type="button"
						class="strategy-toggle-btn"
						class:is-active={strategyConfig.enableTrend}
						title={strategyTooltips.enableTrend}
						aria-label={strategyTooltips.enableTrend}
						aria-pressed={strategyConfig.enableTrend}
						onclick={() =>
							(strategyConfig.enableTrend =
								!strategyConfig.enableTrend)}
					>
						{strategyConfig.enableTrend ? "Activée" : "Désactivée"}
					</button>
				</div>
				<div class="field-row strategy-toggle-row">
					<label
						for="enable-range"
						title={strategyTooltips.enableRange}
						>Stratégie Range</label
					>
					<button
						id="enable-range"
						type="button"
						class="strategy-toggle-btn"
						class:is-active={strategyConfig.enableRange}
						title={strategyTooltips.enableRange}
						aria-label={strategyTooltips.enableRange}
						aria-pressed={strategyConfig.enableRange}
						onclick={() =>
							(strategyConfig.enableRange =
								!strategyConfig.enableRange)}
					>
						{strategyConfig.enableRange ? "Activée" : "Désactivée"}
					</button>
				</div>
				<div class="field-row strategy-toggle-row">
					<label
						for="enable-breakout"
						title={strategyTooltips.enableBreakout}
						>Stratégie Breakout</label
					>
					<button
						id="enable-breakout"
						type="button"
						class="strategy-toggle-btn"
						class:is-active={strategyConfig.enableBreakout}
						title={strategyTooltips.enableBreakout}
						aria-label={strategyTooltips.enableBreakout}
						aria-pressed={strategyConfig.enableBreakout}
						onclick={() =>
							(strategyConfig.enableBreakout =
								!strategyConfig.enableBreakout)}
					>
						{strategyConfig.enableBreakout
							? "Activée"
							: "Désactivée"}
					</button>
				</div>
			</div>

			<div class="strategy-grid">
				<div
					class="field-row"
					class:is-disabled={!strategyConfig.enableTrend}
				>
					<label
						for="trend-adx-min"
						title={strategyTooltips.trendAdxMin}
						>Trend ADX min</label
					>
					<input
						id="trend-adx-min"
						type="number"
						step="0.1"
						bind:value={strategyConfig.trendAdxMin}
						title={strategyTooltips.trendAdxMin}
						aria-label={strategyTooltips.trendAdxMin}
						disabled={!strategyConfig.enableTrend}
					/>
				</div>
				<div
					class="field-row"
					class:is-disabled={!strategyConfig.enableRange}
				>
					<label
						for="range-adx-max"
						title={strategyTooltips.rangeAdxMax}
						>Range ADX max</label
					>
					<input
						id="range-adx-max"
						type="number"
						step="0.1"
						bind:value={strategyConfig.rangeAdxMax}
						title={strategyTooltips.rangeAdxMax}
						aria-label={strategyTooltips.rangeAdxMax}
						disabled={!strategyConfig.enableRange}
					/>
				</div>
				<div
					class="field-row"
					class:is-disabled={!strategyConfig.enableBreakout}
				>
					<label
						for="breakout-vol-mult"
						title={strategyTooltips.breakoutVolumeMultiplier}
						>Breakout volume x</label
					>
					<input
						id="breakout-vol-mult"
						type="number"
						step="0.01"
						bind:value={strategyConfig.breakoutVolumeMultiplier}
						title={strategyTooltips.breakoutVolumeMultiplier}
						aria-label={strategyTooltips.breakoutVolumeMultiplier}
						disabled={!strategyConfig.enableBreakout}
					/>
				</div>

				<div
					class="field-row"
					class:is-disabled={!strategyConfig.enableBreakout}
				>
					<label
						for="breakout-donchian"
						title={strategyTooltips.breakoutDonchianFactor}
						>Breakout Donchian factor</label
					>
					<input
						id="breakout-donchian"
						type="number"
						step="0.001"
						bind:value={strategyConfig.breakoutDonchianFactor}
						title={strategyTooltips.breakoutDonchianFactor}
						aria-label={strategyTooltips.breakoutDonchianFactor}
						disabled={!strategyConfig.enableBreakout}
					/>
				</div>
				<div
					class="field-row"
					class:is-disabled={!strategyConfig.enableBreakout}
				>
					<label
						for="breakout-stc"
						title={strategyTooltips.breakoutStcMin}
						>Breakout STC min</label
					>
					<input
						id="breakout-stc"
						type="number"
						step="0.1"
						bind:value={strategyConfig.breakoutStcMin}
						title={strategyTooltips.breakoutStcMin}
						aria-label={strategyTooltips.breakoutStcMin}
						disabled={!strategyConfig.enableBreakout}
					/>
				</div>
				<div
					class="field-row"
					class:is-disabled={!strategyConfig.enableRange}
				>
					<label
						for="rsi-range"
						title={strategyTooltips.rsiRangeBuyMax}
						>Range RSI max</label
					>
					<input
						id="rsi-range"
						type="number"
						step="0.1"
						bind:value={strategyConfig.rsiRangeBuyMax}
						title={strategyTooltips.rsiRangeBuyMax}
						aria-label={strategyTooltips.rsiRangeBuyMax}
						disabled={!strategyConfig.enableRange}
					/>
				</div>

				<div class="field-row">
					<label
						for="hard-stop"
						title={strategyTooltips.hardStopLossPercent}
						>Hard stop-loss (%)</label
					>
					<input
						id="hard-stop"
						type="number"
						step="0.01"
						bind:value={strategyConfig.hardStopLossPercent}
						title={strategyTooltips.hardStopLossPercent}
						aria-label={strategyTooltips.hardStopLossPercent}
					/>
				</div>
				<div class="field-row">
					<label
						for="take-profit"
						title={strategyTooltips.takeProfitPercent}
						>Take-profit (%)</label
					>
					<input
						id="take-profit"
						type="number"
						step="0.01"
						bind:value={strategyConfig.takeProfitPercent}
						title={strategyTooltips.takeProfitPercent}
						aria-label={strategyTooltips.takeProfitPercent}
					/>
				</div>
				<div class="field-row">
					<label
						for="profit-zone"
						title={strategyTooltips.profitZonePercent}
						>Profit zone (%)</label
					>
					<input
						id="profit-zone"
						type="number"
						step="0.01"
						bind:value={strategyConfig.profitZonePercent}
						title={strategyTooltips.profitZonePercent}
						aria-label={strategyTooltips.profitZonePercent}
					/>
				</div>

				<div class="field-row">
					<label
						for="stc-prev"
						title={strategyTooltips.stcReversalPrevMin}
						>STC reversal prev min</label
					>
					<input
						id="stc-prev"
						type="number"
						step="0.1"
						bind:value={strategyConfig.stcReversalPrevMin}
						title={strategyTooltips.stcReversalPrevMin}
						aria-label={strategyTooltips.stcReversalPrevMin}
					/>
				</div>
				<div class="field-row">
					<label
						for="stc-current"
						title={strategyTooltips.stcReversalCurrentMax}
						>STC reversal current max</label
					>
					<input
						id="stc-current"
						type="number"
						step="0.1"
						bind:value={strategyConfig.stcReversalCurrentMax}
						title={strategyTooltips.stcReversalCurrentMax}
						aria-label={strategyTooltips.stcReversalCurrentMax}
					/>
				</div>
				<div class="field-row">
					<label
						for="sma-break"
						title={strategyTooltips.smaBreakFactor}
						>SMA break factor</label
					>
					<input
						id="sma-break"
						type="number"
						step="0.001"
						bind:value={strategyConfig.smaBreakFactor}
						title={strategyTooltips.smaBreakFactor}
						aria-label={strategyTooltips.smaBreakFactor}
					/>
				</div>

				<div class="field-row">
					<label
						for="atr-stock"
						title={strategyTooltips.atrMultiplierStock}
						>ATR multiplier stock</label
					>
					<input
						id="atr-stock"
						type="number"
						step="0.01"
						bind:value={strategyConfig.atrMultiplierStock}
						title={strategyTooltips.atrMultiplierStock}
						aria-label={strategyTooltips.atrMultiplierStock}
					/>
				</div>
				<div class="field-row">
					<label
						for="atr-crypto"
						title={strategyTooltips.atrMultiplierCrypto}
						>ATR multiplier crypto</label
					>
					<input
						id="atr-crypto"
						type="number"
						step="0.01"
						bind:value={strategyConfig.atrMultiplierCrypto}
						title={strategyTooltips.atrMultiplierCrypto}
						aria-label={strategyTooltips.atrMultiplierCrypto}
					/>
				</div>
			</div>

			<div class="actions strategy-actions">
				<button
					class="btn-secondary"
					type="button"
					onclick={resetStrategyConfig}>Réinitialiser</button
				>
				<button
					class="btn-primary"
					type="button"
					onclick={persistStrategyConfig}
					disabled={saving}>Sauvegarder stratégie</button
				>
			</div>

			{#if strategyError}
				<div class="message error">{strategyError}</div>
			{/if}
			{#if strategySuccess}
				<div class="message success">{strategySuccess}</div>
			{/if}
		</section>
	{/if}
</div>
