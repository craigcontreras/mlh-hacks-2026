<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from '../../routes/handoffs/$types';
	let { documents, hasBrief = true }: { documents: PageData['chart']['documents']; hasBrief?: boolean } = $props();
	const visits = $derived([...new Map(documents.map(doc => [doc.visitId, doc.date])).entries()].sort((a,b) => b[1].localeCompare(a[1])));
	const date = (value: string) => new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}).format(new Date(value + 'T12:00:00Z'));
</script>
<aside class="chart-files paper-card" aria-label="Visit history and documents">
	<div class="workhead"><div><p class="kicker">Patient record</p><h2>Visits &amp; documents</h2></div><span class="source-count">{visits.length} visits</span></div>
	{#each visits as [visitId, day], visitIndex (visitId)}
		<section class="visit-group">
			<div class="visit-head"><div><p class="kicker">{visitIndex === 0 ? (visitId === 'ED-104' ? 'Current visit' : 'Latest visit') : 'Prior visit'} · {visitId}</p><h3>{date(day)}</h3></div></div>
			{#each documents.filter(doc => doc.visitId === visitId) as doc (doc.id)}
				<details class="chart-file" name="chart-source">
					<summary><span class="case-icon" aria-hidden="true"></span><strong>{doc.title}</strong><span class="caret" aria-hidden="true">›</span></summary>
					<div class="chart-docbody">
						{#if doc.id === 'ED-104'}<div class="source-downloads"><a href={resolve('/handoffs/source?format=pdf')} target="_blank" rel="noopener">Sample PDF</a><a download href={resolve('/handoffs/source')}>Download transfer text</a></div>{/if}
						<ol class="numbered-note">
							{#each doc.text.split(/\r?\n/) as text, i (i)}
								<li id={'chart-' + doc.id + '-L' + (i + 1)} tabindex="-1"><span aria-hidden="true">{i + 1}</span><span>{text || ' '}{#if hasBrief}<a class="back-to-brief" href="#verified-brief">Back to summary</a>{/if}</span></li>
							{/each}
						</ol>
					</div>
				</details>
			{/each}
			{#if visitId === 'ED-104'}
				<details class="chart-file" name="chart-source" id="chart-image">
					<summary><span class="image-icon" aria-hidden="true">▧</span><strong>Left ankle X-ray</strong><span class="caret" aria-hidden="true">›</span></summary>
					<figure class="chart-image"><img src={resolve('/handoffs/source?format=image')} alt="Two synthetic illustrations of the current left ankle, AP and lateral views" loading="lazy" /><figcaption>Current visit {visitId} · Synthetic AP and lateral illustrations</figcaption></figure>
				</details>
			{/if}
		</section>
	{/each}
</aside>
