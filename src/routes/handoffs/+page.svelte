<script lang="ts">
	import type { PageProps } from './$types';
	import HandoffPanel from '#lib/ui/HandoffPanel.svelte';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Handoff review · Intake Desk</title></svelte:head>
<header class="pagehead"><div><p class="kicker">Emergency department</p><h1>Handoff review</h1><p class="lead">Review the transfer note and sign a documented task for the next worker.</p></div></header>
<div class="handoff-grid">
	{#key data.record?.version ?? 'new'}<HandoffPanel {data} message={form?.message} />{/key}
	<HandoffDocument note={data.document} hasBrief={Boolean(data.record)} />
</div>
