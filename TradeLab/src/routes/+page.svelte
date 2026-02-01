<script lang="ts">
	import TabNavigation from '$lib/components/TabNavigation.svelte';
	import AccueilTab from '$lib/components/AccueilTab.svelte';
	import NewsTab from '$lib/components/NewsTab.svelte';
	import PlacementsTab from '$lib/components/PlacementsTab.svelte';

	let activeTab = 'accueil';
</script>

<svelte:head>
	<title>TradeLab - Plateforme de Trading</title>
	<meta name="description" content="Plateforme bourse et actualités financières" />
</svelte:head>

<TabNavigation bind:activeTab let:activeTab>
	{#if activeTab === 'accueil'}
		<AccueilTab />
	{:else if activeTab === 'news'}
		<NewsTab />
	{:else if activeTab === 'placements'}
		<PlacementsTab />
	{/if}
</TabNavigation>
