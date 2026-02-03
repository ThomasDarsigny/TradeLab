<script lang="ts">
	import './layout.css';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { children } = $props();
	let userEmail = $state<string | null>(null);
	let showHeader = $derived(!$page.url.pathname.startsWith('/auth'));

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		userEmail = session?.user?.email || null;

		supabase.auth.onAuthStateChange((_event: string, session: any) => {
			userEmail = session?.user?.email || null;
		});
	});

	async function handleLogout() {
		await supabase.auth.signOut();
		await goto('/auth');
	}
</script>

<div class="app">
	{#if showHeader}
		<header class="app-header">
			<div class="brand">
				<img src="/logo.png" alt="TradeLab Logo" class="logo" style="width: 60px; height: 60px;" />
				<span>TradeLab</span>
			</div>
			<nav class="nav">
				<a class="nav-item" href="/" data-sveltekit-preload-data="hover">Tableau de bord</a>
				<a class="nav-item" href="/markets" data-sveltekit-preload-data="hover">Marchés</a>
				<a class="nav-item" href="/news" data-sveltekit-preload-data="hover">Actualités</a>
				{#if userEmail}
					<div class="user-menu">
						<span class="user-email">{userEmail}</span>
						<button class="btn-logout" onclick={handleLogout}>
							Déconnexion
						</button>
					</div>
				{/if}
			</nav>
		</header>
	{/if}

	<main class:full-page={!showHeader}>
		{@render children()}
	</main>
</div>

<style>
	.user-menu {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-left: 1rem;
		padding-left: 1rem;
		border-left: 1px solid rgba(255, 255, 255, 0.1);
	}

	.user-email {
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.875rem;
	}

	.btn-logout {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #fca5a5;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.btn-logout:hover {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.5);
	}

	main.full-page {
		padding: 0;
	}
</style>
