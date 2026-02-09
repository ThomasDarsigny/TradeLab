<script lang="ts">
	import type { Transaction } from '$lib/types/account';

	let { transactions = [] } = $props<{
		transactions?: Transaction[];
	}>();


	const sortedTransactions = $derived.by(() =>
		[...transactions].sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		)
	);

	const formatDate = (value: string) =>
		new Date(value).toLocaleString('fr-FR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});

	const typeLabel = (type: Transaction['type']) => {
		switch (type) {
			case 'buy':
				return 'Achat';
			case 'sell':
				return 'Vente';
			case 'deposit':
				return 'Depot';
			case 'withdrawal':
				return 'Retrait';
			case 'dividend':
				return 'Dividende';
			default:
				return type;
		}
	};

	const isNegative = (tx: Transaction) => tx.type === 'buy' || tx.type === 'withdrawal';
</script>

<div class="history-card">
	<div class="history-header">
		<h3>Historique des transactions</h3>
		<p>Dernieres operations enregistrees sur le compte</p>
	</div>

	{#if sortedTransactions.length === 0}
		<div class="history-empty">Aucune transaction pour le moment.</div>
	{:else}
		<div class="history-table">
			<div class="history-row history-head">
				<span>Date</span>
				<span>Type</span>
				<span>Symbole</span>
				<span>Quantite</span>
				<span class="amount">Montant</span>
			</div>
			{#each sortedTransactions as tx (tx.id)}
				<div class="history-row">
					<span>{formatDate(tx.created_at)}</span>
					<span class="pill">{typeLabel(tx.type)}</span>
					<span>{tx.metadata?.symbol || '-'}</span>
					<span>{tx.metadata?.quantity ?? '-'}</span>
					<span class="amount" class:negative={isNegative(tx)} class:positive={!isNegative(tx)}>
						{isNegative(tx) ? '-' : '+'}${Number(tx.amount).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.history-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 16px;
		padding: 1.5rem;
		margin: 2rem 0;
		box-shadow: var(--shadow-lg);
	}

	.history-header h3 {
		margin: 0 0 0.35rem 0;
		color: var(--text-primary);
		font-size: 1.2rem;
	}

	.history-header p {
		margin: 0 0 1.5rem 0;
		color: var(--text-secondary);
		font-size: 0.95rem;
	}

	.history-table {
		display: grid;
		gap: 0.75rem;
	}

	.history-row {
		display: grid;
		grid-template-columns: 1.5fr 0.8fr 0.8fr 0.8fr 1fr;
		gap: 1rem;
		align-items: center;
		padding: 0.85rem 1rem;
		border-radius: 12px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-primary);
		font-size: 0.95rem;
		color: var(--text-secondary);
	}

	.history-row span {
		text-align: center;
	}


	.history-head {
		background: transparent;
		border: none;
		padding: 0 0.5rem;
		font-weight: 700;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 0.8rem;
	}

	.history-head span {
		text-align: center;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		background: rgba(59, 130, 246, 0.12);
		color: var(--text-primary);
		font-weight: 600;
		font-size: 0.85rem;
	}

	.amount {
		text-align: center;
		font-weight: 700;
		color: var(--text-primary);
	}

	.amount.positive {
		color: var(--accent-green);
	}

	.amount.negative {
		color: var(--accent-red);
	}

	.history-empty {
		text-align: center;
		padding: 2.5rem 1rem;
		color: var(--text-muted);
	}

	@media (max-width: 1024px) {
		.history-row {
			grid-template-columns: 1.5fr 0.9fr 0.9fr 0.9fr 1fr;
		}
	}

	@media (max-width: 768px) {
		.history-row {
			grid-template-columns: 1fr 1fr;
			row-gap: 0.5rem;
		}

		.history-head {
			display: none;
		}

		.history-row span:nth-child(1)::before {
			content: 'Date: ';
			color: var(--text-muted);
			margin-right: 0.35rem;
		}

		.history-row span:nth-child(2)::before {
			content: 'Type: ';
			color: var(--text-muted);
			margin-right: 0.35rem;
		}

		.history-row span:nth-child(3)::before {
			content: 'Symbole: ';
			color: var(--text-muted);
			margin-right: 0.35rem;
		}

		.history-row span:nth-child(4)::before {
			content: 'Quantite: ';
			color: var(--text-muted);
			margin-right: 0.35rem;
		}

		.history-row span:nth-child(5)::before {
			content: 'Montant: ';
			color: var(--text-muted);
			margin-right: 0.35rem;
		}

		.amount {
			text-align: center;
		}
	}
</style>
