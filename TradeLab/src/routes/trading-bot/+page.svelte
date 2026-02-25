<script lang="ts">
	import { onMount } from 'svelte';
	import './+page.css';

	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	let enabled = $state(false);
	let symbolsInput = $state('BTC-USD');

	const normalizedSymbols = $derived.by(() => {
		return symbolsInput
			.split(',')
			.map((symbol) => symbol.trim().toUpperCase())
			.filter(Boolean);
	});

	const firstSymbol = $derived(normalizedSymbols[0] ?? 'BTC-USD');

	const loadSettings = async () => {
		loading = true;
		error = null;
		success = null;
		try {
			const response = await fetch('/api/settings/trading-bot', { credentials: 'include' });
			if (!response.ok) {
				throw new Error('Impossible de charger les paramètres du bot.');
			}

			const data = await response.json();
			enabled = Boolean(data?.enabled);
			symbolsInput = String(data?.symbols ?? 'BTC-USD');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur réseau.';
		} finally {
			loading = false;
		}
	};

	const saveSettings = async () => {
		error = null;
		success = null;

		if (normalizedSymbols.length === 0) {
			error = 'Ajoutez au moins un symbole (ex: BTC-USD, AAPL).';
			return;
		}

		saving = true;
		try {
			const response = await fetch('/api/settings/trading-bot', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					enabled,
					symbols: normalizedSymbols.join(', ')
				})
			});

			const data = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(data?.error || 'Erreur lors de la sauvegarde.');
			}

			enabled = Boolean(data?.enabled);
			symbolsInput = String(data?.symbols ?? normalizedSymbols.join(', '));
			success = 'Paramètres sauvegardés avec succès.';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.';
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
			const response = await fetch('/api/settings/trading-bot', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					enabled: nextEnabled,
					symbols: normalizedSymbols.length > 0 ? normalizedSymbols.join(', ') : 'BTC-USD'
				})
			});

			const data = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(data?.error || 'Erreur lors de la mise à jour du statut du bot.');
			}

			enabled = Boolean(data?.enabled);
			symbolsInput = String(data?.symbols ?? (normalizedSymbols.length > 0 ? normalizedSymbols.join(', ') : 'BTC-USD'));
			success = enabled ? 'Bot activé.' : 'Bot désactivé.';
		} catch (err) {
			enabled = previousEnabled;
			error = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du statut du bot.';
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
	<meta name="description" content="Configurer facilement les paramètres du Trading Bot" />
</svelte:head>

<div class="bot-settings-page">
	<header class="page-header">
		<h1>Trading Bot</h1>
		<p>Configurez rapidement votre bot.</p>
	</header>

	{#if loading}
		<div class="status-card">Chargement des paramètres...</div>
	{:else}
		<section class="card">
			<div class="card-header">
				<h2>Paramètres du bot</h2>
			</div>

			<div class="field-row toggle-row">
				<div>
					<label for="bot-enabled">Activer le Trading Bot</label>
					<small>Active ou désactive l’exécution automatique.</small>
				</div>
				<label class="switch" aria-label="Activer le Trading Bot">
					<input id="bot-enabled" type="checkbox" checked={enabled} onchange={toggleEnabled} disabled={saving} />
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
				<small>Séparez par des virgules. Ex: BTC-USD, ETH-USD, AAPL</small>
			</div>

			{#if normalizedSymbols.length > 0}
				<div class="symbol-chips">
					{#each normalizedSymbols as symbol (symbol)}
						<span>{symbol}</span>
					{/each}
				</div>
			{/if}

			<div class="actions">
				<button class="btn-primary" type="button" onclick={saveSettings} disabled={saving}>
					{saving ? 'Sauvegarde...' : 'Sauvegarder'}
				</button>
			</div>

			{#if error}
				<div class="message error">{error}</div>
			{/if}
			{#if success}
				<div class="message success">{success}</div>
			{/if}
		</section>

	{/if}
</div>