<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<div class="app">
	<header class="app-header">
		<div class="brand">
			<span>TradeLab</span>
		</div>
		<nav class="nav">
			<span class="nav-item">Tableau de bord</span>
			<span class="nav-item">Marchés</span>
			<span class="nav-item">Actualités</span>
		</nav>
	</header>

	<main>
		{@render children()}
	</main>
</div>
