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
			<a class="nav-item" href="/" data-sveltekit-preload-data="hover">Tableau de bord</a>
			<a class="nav-item" href="/markets" data-sveltekit-preload-data="hover">Marchés</a>
			<a class="nav-item" href="/news" data-sveltekit-preload-data="hover">Actualités</a>
		</nav>
	</header>

	<main>
		{@render children()}
	</main>
</div>
