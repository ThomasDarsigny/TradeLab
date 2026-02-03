<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getQuotesWebSocket } from '$lib/services/quotesWebSocket';
	import type { Position } from '$lib/types/account';

	let positions: Position[] = $state([]);
	let loading = $state(true);
	let wsConnected = $state(false);

	const quotesWs = getQuotesWebSocket();

	onMount(async () => {
		await loadPositions();

		try {
			await quotesWs.connect();
			wsConnected = true;

			positions.forEach((position) => {
				quotesWs.subscribe(position.symbol, (data) => {
					updatePositionPrice(position.symbol, data.price);
				});
			});
		} catch (error) {
			console.error('Erreur WebSocket:', error);
		}
	});

	onDestroy(() => {
		positions.forEach((position) => {
			quotesWs.unsubscribe(position.symbol);
		});
	});

	async function loadPositions() {
		loading = true;
		try {
			const response = await fetch('/api/account/positions', { credentials: 'include' });
			if (response.ok) {
				const data = await response.json();
				positions = data.positions;
			}
		} catch (error) {
			console.error('Erreur:', error);
		} finally {
			loading = false;
		}
	}

	function updatePositionPrice(symbol: string, newPrice: number) {
		const position = positions.find((p) => p.symbol === symbol);
		if (position) {
			position.current_price = newPrice;
			positions = [...positions];
		}
	}
</script>

<div class="live-indicator" class:connected={wsConnected}>
	{#if wsConnected}
		<span class="pulse"></span>
		<span>Live</span>
	{:else}
		<span>Offline</span>
	{/if}
</div>

{#if loading}
	<div class="loading">Chargement...</div>
{:else}
	<div class="positions">
		{#each positions as position}
			<div class="position-card">
				<h3>{position.symbol}</h3>
				<p class="price">${position.current_price.toFixed(2)}</p>
			</div>
		{/each}
	</div>
{/if}

<style>
	.live-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 999px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-primary);
	}

	.live-indicator.connected {
		border-color: var(--accent-green);
		color: var(--accent-green);
	}

	.pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-green);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.positions {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1rem;
		margin-top: 2rem;
	}

	.position-card {
		padding: 1.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 12px;
	}

	.price {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--accent-primary);
	}
</style>
