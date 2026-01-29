<svelte:head>
	<title>TradeLab</title>
	<meta name="description" content="Plateforme bourse et actualités financières" />
</svelte:head>

<section class="hero">
	<div>
		<h1>TradeLab</h1>
		<p class="subtitle">
			Votre laboratoire de bourse : cours en temps réel, news financières et analyses.
		</p>
		<div class="actions">
			<button class="primary">Voir le marché</button>
			<button class="ghost">Ajouter un ticker</button>
		</div>
	</div>
	<div class="card">
		<h2>État du système</h2>
		<ul>
			<li>API marchés : en cours d’intégration</li>
			<li>News financières : en cours d’intégration</li>
			<li>Portefeuille : prochain module</li>
		</ul>
	</div>
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		align-items: center;
	}

	.subtitle {
		font-size: 1.1rem;
		color: #475569;
	}

	.actions {
		margin-top: 1rem;
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	button {
		border: 0;
		border-radius: 8px;
		padding: 0.6rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.primary {
		background: #0f172a;
		color: #f8fafc;
	}

	.ghost {
		background: transparent;
		color: #0f172a;
		border: 1px solid #cbd5f5;
	}

	.card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem;
		box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
	}

	.card ul {
		margin: 0.5rem 0 0;
		padding-left: 1.2rem;
	}
</style>
