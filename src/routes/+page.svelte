<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import PacketWorkspace from '#lib/ui/PacketWorkspace.svelte';
	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Transfer packet review · Intake Desk</title></svelte:head>
<div class="pagehead">
	<div><p class="kicker">ER registration</p><h1>Transfer packet review</h1><p class="lead">Prepare a source-backed handoff for the registration desk.</p></div>
</div>
<nav class="case-nav" aria-label="Synthetic packets">
	{#each data.samples as sample (sample.id)}
		<a href={resolve(`/?sample=${sample.id}`)} aria-current={data.sampleId === sample.id ? 'page' : undefined}>
			<span class="case-icon" aria-hidden="true"></span><span><small>{sample.packetId}</small><strong>{sample.title}</strong></span>
		</a>
	{/each}
</nav>
{#key data.sampleId + ':' + (data.record?.version ?? '')}
	<PacketWorkspace {data} message={form?.message} />
{/key}
