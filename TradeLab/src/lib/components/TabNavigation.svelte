<script lang="ts">
	import './TabNavigation.css';
	export let activeTab: string = 'accueil';

	const tabs = [
		{ id: 'accueil', label: 'Accueil' },
		{ id: 'news', label: 'Actualités' },
		{ id: 'placements', label: 'Portefeuille' },
	];

	function selectTab(tabId: string) {
		activeTab = tabId;
	}
</script>

<div class="tabs-container">
	<div class="tabs-header">
		{#each tabs as tab (tab.id)}
			<button
				class="tab-button"
				class:active={activeTab === tab.id}
				onclick={() => selectTab(tab.id)}
			>
				<span class="tab-label">{tab.label}</span>
			</button>
		{/each}
	</div>

	<div class="tabs-content">
		<slot {activeTab} />
	</div>
</div>
