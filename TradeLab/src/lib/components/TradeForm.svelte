<script lang="ts">
	import { accountStore, setAccount } from '$lib/stores/account';
	import './TradeForm.css';

	let {
		mode = $bindable('buy') as 'buy' | 'sell',
		prefilledSymbol = '',
		lockedPrice = 0,
		showSymbolField = true,
	} = $props<{
		mode?: 'buy' | 'sell';
		prefilledSymbol?: string;
		lockedPrice?: number;
		showSymbolField?: boolean;
	}>();
	let symbol = $state('');
	let quantity = $state(1);
	let price = $state(0);

	$effect(() => {
		symbol = prefilledSymbol;
	});

	$effect(() => {
		if (lockedPrice > 0) {
			price = lockedPrice;
		}
	});
	let stockName = $state('');
	let error = $state('');
	let success = $state('');
	let isSubmitting = $state(false);

	let effectivePrice = $derived(lockedPrice > 0 ? lockedPrice : price);
	let totalAmount = $derived(quantity * effectivePrice);

	let availableCash = $derived($accountStore?.available_balance ?? 0);
	let canAfford = $derived(mode === 'buy' ? totalAmount <= availableCash : true);
	const quantityStep = 0.000001;
	const clampQuantity = (value: number) => {
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.floor(value / quantityStep) * quantityStep);
	};
	let maxQuantity = $derived(effectivePrice > 0 ? clampQuantity(availableCash / effectivePrice) : 0);
	let sellLimit = $state(0);
	let sellLoading = $state(false);
	let maxSellQuantity = $derived(clampQuantity(sellLimit));

	let validationError = $derived.by(() => {
		if (!symbol.trim()) return 'Symbole requis';
		if (quantity <= 0) return 'La quantité doit être positive';
		if (effectivePrice <= 0) return 'Le prix doit être positif';
		if (mode === 'buy' && !canAfford) {
			return `Fonds insuffisants (disponible: ${availableCash.toFixed(2)}$)`;
		}
		if (mode === 'sell' && !sellLoading && maxSellQuantity === 0) {
			return `Aucune position pour ${symbol.toUpperCase()}`;
		}
		if (mode === 'sell' && maxSellQuantity > 0 && quantity > maxSellQuantity) {
			return `Quantité insuffisante (vous avez ${maxSellQuantity} actions)`;
		}
		return '';
	});

	let canSubmit = $derived(!validationError && !isSubmitting && symbol.trim() !== '');

	function applyMaxQuantity() {
		if (mode === 'buy') {
			quantity = maxQuantity > 0 ? maxQuantity : quantityStep;
			return;
		}
		if (mode === 'sell') {
			quantity = maxSellQuantity > 0 ? maxSellQuantity : quantityStep;
		}
	}

	async function refreshSellLimit() {
		sellLoading = true;
		try {
			const response = await fetch('/api/account/positions', { credentials: 'include' });
			if (!response.ok) {
				sellLimit = 0;
				return;
			}
			const data = await response.json();
			const match = (data.positions || []).find((pos: any) =>
				String(pos.symbol).toUpperCase() === symbol.toUpperCase()
			);
			sellLimit = match ? Number(match.quantity) : 0;
		} catch (err) {
			sellLimit = 0;
		} finally {
			sellLoading = false;
		}
	}

	$effect(() => {
		if (mode !== 'sell' || !symbol.trim()) {
			sellLimit = 0;
			return;
		}
		refreshSellLimit();
	});

	async function handleSubmit() {
		if (!canSubmit) return;

		error = '';
		success = '';
		isSubmitting = true;

		try {
			const upperSymbol = symbol.toUpperCase();

			if (mode === 'buy') {
				const response = await fetch('/api/account/trades/buy', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({
						symbol: upperSymbol,
						quantity,
						entryPrice: effectivePrice,
					}),
				});

				const data = await response.json();
				if (!response.ok) {
					throw new Error(data?.error || 'Erreur lors de l\'achat');
				}

				success = `Achat réussi : ${quantity} ${upperSymbol} à ${effectivePrice.toFixed(2)}$`;
			} else {
				const response = await fetch('/api/account/trades/sell', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({
						symbol: upperSymbol,
						quantity,
						exitPrice: effectivePrice,
					}),
				});

				const data = await response.json();
				if (!response.ok) {
					throw new Error(data?.error || 'Erreur lors de la vente');
				}

				success = `Vente réussie : ${quantity} ${upperSymbol} à ${effectivePrice.toFixed(2)}$`;
			}

			const accountResponse = await fetch('/api/account', { credentials: 'include' });
			if (accountResponse.ok) {
				const accountData = await accountResponse.json();
				setAccount(accountData.account);
				window.dispatchEvent(new CustomEvent('account-updated'));
			}

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
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		{#if showSymbolField}
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
		{/if}

		<div class="form-row">
			<div class="form-group">
				<div class="label-row">
					<label for="quantity">Quantité</label>
					{#if mode === 'buy' || mode === 'sell'}
						<button type="button" class="max-btn" onclick={applyMaxQuantity}>
							Max
						</button>
					{/if}
				</div>
				<input
					id="quantity"
					type="number"
					bind:value={quantity}
					min={quantityStep}
					step={quantityStep}
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
					disabled={isSubmitting || lockedPrice > 0}
				/>
			</div>
		</div>



		<div class="calculation">
			<div class="calc-row">
				<span>Montant total</span>
				<span class="amount" class:buy={mode === 'buy'} class:sell={mode === 'sell'}>
					{mode === 'buy' ? '-' : '+'}{totalAmount.toFixed(2)}$
				</span>
			</div>
			{#if mode === 'buy'}
				<div class="calc-row final">
					<span>Après transaction</span>
					<span class="result" class:negative={!canAfford}>
						{(availableCash - totalAmount).toFixed(2)}$
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
