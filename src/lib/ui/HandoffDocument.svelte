<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import type { PageData } from '../../routes/handoffs/$types';
	let { note, hasBrief = true }: { note: PageData['document']; hasBrief?: boolean } = $props();
</script>

<aside class="note-sheet" aria-label="Original source document">
	<div class="note-mast"><p class="kicker">Source document</p><div class="source-downloads"><a href={asset('samples/ED-104-transfer-note.pdf')} target="_blank" rel="noopener">Sample PDF</a><a download href={resolve('/handoffs/source')}>Download text</a></div></div>
	<h2>{note.title}</h2>
	<p class="note-id">{note.id} · Synthetic patient record</p>
	<ol class="numbered-note">
		{#each note.text.split('\n') as text, i (i)}
			<li id={'line-' + (i + 1)} tabindex="-1"><span aria-hidden="true">{i + 1}</span><span>{text || ' '}{#if hasBrief}<a class="back-to-brief" href="#verified-brief">Back to summary</a>{/if}</span></li>
		{/each}
	</ol>
</aside>
