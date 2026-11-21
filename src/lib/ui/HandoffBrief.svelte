<script lang="ts">
	import type { PageData } from '../../routes/handoffs/$types';
	let { record }: { record: NonNullable<PageData['record']> } = $props();
</script>

<section class="brief" id="verified-brief" tabindex="-1" aria-label="Document summary">
	<div class="brief-head"><h2>Document summary</h2><span class="method-chip">{record.summary.method === 'codex' ? 'Codex' : 'Local parser'} · {record.elapsedMs < 1000 ? record.elapsedMs + ' ms' : (record.elapsedMs / 1000).toFixed(1) + ' s'}</span></div>
	{#if record.summary.issues.length}
		<div class="notice issues" role="alert"><strong>Source verification needs review</strong><ul>{#each record.summary.issues as issue (issue)}<li>{issue}</li>{/each}</ul></div>
	{/if}
	<dl class="brief-facts">
		{#each record.summary.facts as fact (fact.kind)}
			<div><dt>{fact.label}</dt><dd>{fact.text} <a class="line-ref" href={'#line-' + fact.line} aria-label={'View source line ' + fact.line + ' for ' + fact.label}>Line {fact.line}</a></dd></div>
		{/each}
	</dl>
</section>
