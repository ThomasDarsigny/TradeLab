<script lang="ts">
	import { page } from '$app/stores';
	import StockDetail from '$lib/components/StockDetail.svelte';
	import { goto } from '$app/navigation';

	let symbol = $derived($page.params.symbol?.toUpperCase() || '');

	function handleClose() {
		goto('/');
	}
</script>

<svelte:head>
	<title>{symbol} - TradeLab</title>
	<meta name="description" content="Détails et graphique en temps réel pour {symbol}" />
</svelte:head>

<div class="stock-detail-page">
	<StockDetail {symbol} onClose={handleClose} />
</div>

<style>
	.stock-detail-page {
		width: 100%;
		height: 100%;
		min-height: 100vh;
		background: var(--bg-primary);
		padding: 2rem;
		overflow-y: auto;
	}

	@media (max-width: 768px) {
		.stock-detail-page {
			padding: 1rem;
		}
	}
</style>
