<script lang="ts">
	import { portfolio } from '$lib/stores/portfolio.svelte';
	import './TradeForm.css';

	let {
		mode = $bindable('buy') as 'buy' | 'sell',
		prefilledSymbol = ''
	} = $props();

	let symbol = $state('');
	let quantity = $state(1);
	let price = $state(0);

	$effect(() => {
		symbol = prefilledSymbol;
	});
	let stockName = $state('');
	let error = $state('');
	let success = $state('');
	let isSubmitting = $state(false);

	// Calcul du montant total
	let totalAmount = $derived(quantity * price);

	// Vérifier si on a suffisamment de fonds pour un achat
	let canAfford = $derived(mode === 'buy' ? totalAmount <= portfolio.cash : true);

	// Obtenir la position existante pour une vente
	let existingPosition = $derived(
		mode === 'sell' ? portfolio.getPosition(symbol.toUpperCase()) : undefined
	);

	// Vérifier si on a suffisamment d'actions pour une vente
	let hasEnoughShares = $derived(
		mode === 'sell' ? existingPosition && quantity <= existingPosition.quantity : true
	);

	// Message d'erreur de validation
	let validationError = $derived.by(() => {
		if (!symbol.trim()) return 'Symbole requis';
		if (quantity <= 0) return 'La quantité doit être positive';
		if (price <= 0) return 'Le prix doit être positif';
		if (mode === 'buy' && !canAfford) {
			return `Fonds insuffisants (disponible: ${portfolio.cash.toFixed(2)}$)`;
		}
		if (mode === 'sell' && !existingPosition) {
			return `Aucune position pour ${symbol.toUpperCase()}`;
		}
		if (mode === 'sell' && !hasEnoughShares && existingPosition) {
			return `Quantité insuffisante (vous avez ${existingPosition.quantity} actions)`;
		}
		return '';
	});

	// Peut soumettre le formulaire
	let canSubmit = $derived(!validationError && !isSubmitting && symbol.trim() !== '');

	function handleSubmit() {
		if (!canSubmit) return;

		error = '';
		success = '';
		isSubmitting = true;

		try {
			const upperSymbol = symbol.toUpperCase();

			if (mode === 'buy') {
				portfolio.buyStock(upperSymbol, stockName || upperSymbol, quantity, price);
				success = `Achat réussi : ${quantity} ${upperSymbol} à ${price.toFixed(2)}$`;
			} else {
				portfolio.sellStock(upperSymbol, quantity, price);
				success = `Vente réussie : ${quantity} ${upperSymbol} à ${price.toFixed(2)}$`;
			}

			// Réinitialiser le formulaire
			setTimeout(() => {
				symbol = '';
				quantity = 1;
				price = 0;
				stockName = '';
				success = '';
			}, 2000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Une erreur est survenue';
		} finally {
			isSubmitting = false;
		}
	}

	function switchMode() {
		mode = mode === 'buy' ? 'sell' : 'buy';
		error = '';
		success = '';
	}
</script>

<div class="trade-form">
	<div class="trade-header">
		<div class="mode-toggle">
			<button
				class="mode-btn"
				class:active={mode === 'buy'}
				onclick={() => (mode = 'buy')}
			>
				Acheter
			</button>
			<button
				class="mode-btn"
				class:active={mode === 'sell'}
				onclick={() => (mode = 'sell')}
			>
				Vendre
			</button>
		</div>
	</div>

	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		<div class="form-group">
			<label for="symbol">Symbole</label>
			<input
				id="symbol"
				type="text"
				bind:value={symbol}
				placeholder="Ex: AAPL, TSLA..."
				class="input"
				disabled={isSubmitting}
				oninput={(e) => (symbol = e.currentTarget.value.toUpperCase())}
			/>
		</div>

		{#if mode === 'buy'}
			<div class="form-group">
				<label for="name">Nom (optionnel)</label>
				<input
					id="name"
					type="text"
					bind:value={stockName}
					placeholder="Ex: Apple Inc."
					class="input"
					disabled={isSubmitting}
				/>
			</div>
		{/if}

		<div class="form-row">
			<div class="form-group">
				<label for="quantity">Quantité</label>
				<input
					id="quantity"
					type="number"
					bind:value={quantity}
					min="1"
					step="1"
					class="input"
					disabled={isSubmitting}
				/>
			</div>

			<div class="form-group">
				<label for="price">Prix unitaire</label>
				<input
					id="price"
					type="number"
					bind:value={price}
					min="0.01"
					step="0.01"
					class="input"
					disabled={isSubmitting}
				/>
			</div>
		</div>

		{#if existingPosition && mode === 'sell'}
			<div class="position-info">
				<span>Position actuelle : {existingPosition.quantity} actions</span>
				<span>Prix moyen : {existingPosition.averagePrice.toFixed(2)}$</span>
			</div>
		{/if}

		<div class="calculation">
			<div class="calc-row">
				<span>Montant total</span>
				<span class="amount" class:buy={mode === 'buy'} class:sell={mode === 'sell'}>
					{mode === 'buy' ? '-' : '+'}{totalAmount.toFixed(2)}$
				</span>
			</div>
			<div class="calc-row">
				<span>Cash disponible</span>
				<span class="cash">{portfolio.cash.toFixed(2)}$</span>
			</div>
			{#if mode === 'buy'}
				<div class="calc-row final">
					<span>Après transaction</span>
					<span class="result" class:negative={!canAfford}>
						{(portfolio.cash - totalAmount).toFixed(2)}$
					</span>
				</div>
			{/if}
		</div>

		{#if validationError}
			<div class="alert alert-error">
				{validationError}
			</div>
		{/if}

		{#if error}
			<div class="alert alert-error">
				{error}
			</div>
		{/if}

		{#if success}
			<div class="alert alert-success">
				{success}
			</div>
		{/if}

		<button
			type="submit"
			class="submit-btn"
			class:buy={mode === 'buy'}
			class:sell={mode === 'sell'}
			disabled={!canSubmit}
		>
			{isSubmitting ? 'Traitement...' : mode === 'buy' ? 'Acheter' : 'Vendre'}
		</button>
	</form>
</div>
