<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import tutorialUrl from '../../../docs/Intake-Desk-walkthrough.mp4?url';
	import captionsUrl from '../../../docs/Intake-Desk-walkthrough.vtt?url&no-inline';
	import dictionaryUrl from '../../../docs/Intake-Desk-visual-dictionary.pdf?url';
	import presenterCardUrl from '../../../docs/Jordan-presenter-card.pdf?url';

	const terms = [
		{ title: 'Reading a chart', entries: [
			['Chart', 'One patient’s records across visits. A visit is a single encounter.'],
			['Radiology impression', 'The report author’s conclusion about what the images show.'],
			['Comparison images', 'Pictures from an earlier study that a clinician can compare with newer ones.'],
			['Study ID (accession)', 'The lookup number the imaging office uses for a particular exam.'],
			['Medical history', 'Past conditions or health events recorded for the patient.'],
			['Family history', 'Health conditions reported in relatives. A family history entry alone cannot establish an inherited condition.'],
			['Genetic test', 'A test that examines genetic material. A result in the chart comes from a documented test.']
		] },
		{ title: 'Reading the map', entries: [
			['Ontology', 'A map of relationships. Here it links a chart document to a finding and any associated staff action.'],
			['Parsing', 'Reading a document and extracting individual pieces of information.'],
			['Summary', 'A short account of the important findings across the chart.'],
			['Citation', 'A link to the passage that supports a finding. “Line 16” (L16) locates the text in the source document.'],
			['Owner', 'The person or team responsible for the named action.'],
			['Triage agent', 'In this demo, Maya is the staff member who coordinates returned handoffs and assigns a covering doctor. The treating team assesses clinical urgency.'],
			['Handoff', 'Passing a task and its supporting information to the next person.'],
			['Sign-off', 'A person records that they completed a specific review or approved a handoff.']
		] }
	];
</script>

<svelte:head><title>Glossary and visual dictionary · Intake Desk</title></svelte:head>

<article class="dictionary">
	<header class="pagehead">
		<div><p class="kicker">Intake Desk</p><h1>Glossary</h1></div>
		<a class="button secondary download" href={dictionaryUrl} rel="external" download="Intake-Desk-visual-dictionary.pdf">Download visual dictionary (PDF)</a>
	</header>

	<details class="tutorial" id="walkthrough" open={page.url.searchParams.get('watch') === '1'}>
		<summary>Watch the walkthrough</summary>
		<video controls preload="none" playsinline aria-label="Jordan’s chart and handoff walkthrough" src={tutorialUrl}>
			<track kind="captions" srclang="en" label="English" src={captionsUrl} />
		</video>
		<a class="open-map" href={presenterCardUrl} rel="external" download="Jordan-presenter-card.pdf">Download the numbered presenter card and demo results (PDF)</a>
	</details>

	<section class="example" aria-labelledby="visual-title">
		<h2 id="visual-title">How to read the map</h2>
		<p class="intro">Follow one detail from Jordan’s transfer note to the person responsible for checking it.</p>
		<ol class="chain">
			<li>
				<div class="node-label"><span class="mark paper" aria-hidden="true"></span>Source</div>
				<strong>Transfer note, line 16</strong>
				<p>“The earlier comparison images were requested and had not arrived by departure.”</p>
			</li>
			<li>
				<div class="node-label"><span class="mark dot" aria-hidden="true"></span>Finding</div>
				<strong>Older X-rays were missing at departure.</strong>
				<p>The summary preserves when that was true.</p>
			</li>
			<li>
				<div class="node-label"><span class="mark task" aria-hidden="true">→</span>Action</div>
				<strong>Check whether the images arrived.</strong>
				<p>Line 17 assigns the check to the receiving nurse. Intake Desk matches the study and puts the pending check in Riley Ortiz’s inbox.</p>
			</li>
		</ol>
		<p class="context"><strong>Chart context</strong> means the chart records a detail, such as a relative’s medical history, without assigning a task for it.</p>
		<a class="open-map" href={resolve('/patients?patient=J-104&tab=ontology&finding=comparison-images')}>Open Jordan’s map <span aria-hidden="true">→</span></a>
	</section>

	<div class="terms">
		{#each terms as section (section.title)}
			<section>
				<h2>{section.title}</h2>
				<dl>{#each section.entries as [term, definition] (term)}
					<div><dt>{term}</dt><dd>{definition}</dd></div>
				{/each}</dl>
			</section>
		{/each}
	</div>
</article>

<style>
	.tutorial {margin:0 0 18px}
	.tutorial summary {cursor:pointer;display:list-item;width:fit-content;font-weight:600}
	.tutorial video {display:block;width:100%;max-width:1080px;aspect-ratio:16/9;margin-top:12px;background:#151515;border-radius:6px}

	.dictionary { max-width: 1040px; margin-inline: auto; }
	.dictionary .pagehead { align-items: center; }
	.dictionary h2 { font-size: clamp(20px, 2vw, 26px); }
	.example { padding: clamp(16px, 3vw, 28px); border: 1px solid #b8b8b8; background: var(--paper); }
	.intro, .context { color: var(--muted); font-size: 15px; margin-top: 6px; }
	.chain { --gap: 30px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gap); list-style: none; margin: 20px 0 16px; }
	.chain li { position: relative; background: var(--ground); border: 1px solid #999; padding: 13px 15px; }
	.chain li:not(:last-child)::after { content: '→'; position: absolute; left: 100%; top: 50%; transform: translateY(-50%); width: var(--gap); text-align: center; color: #565656; font-size: 19px; }
	.node-label { display: flex; gap: 8px; align-items: center; font-size: 12px; font-weight: 650; color: var(--muted); margin-bottom: 9px; }
	.mark { width: 15px; height: 15px; flex: none; display: inline-block; color: #222; }
	.paper { border: 1.5px solid currentColor; width: 12px; height: 15px; margin-inline: 1.5px; position: relative; background: white; }
	.paper::after { content: ''; position: absolute; left: 2px; right: 2px; top: 4px; height: 3px; border-block: 1px solid currentColor; }
	.dot { width: 10px; height: 10px; margin-inline: 2.5px; border-radius: 50%; background: currentColor; }
	.task { border: 1px solid; line-height: 12px; text-align: center; font-size: 13px; }
	.chain strong { display: block; line-height: 1.25; font-size: 17px; }
	.chain li p { margin-top: 5px; color: var(--muted); font-size: 14px; }
	.open-map { display: inline-block; margin-top: 12px; font-size: 14px; }
	.terms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(25px, 5vw, 60px); margin-block: 28px 15px; }
	.terms h2 { padding-bottom: 10px; border-bottom: 1px solid #777; }
	.terms dl > div { padding: 10px 0; border-bottom: 1px solid var(--line); }
	.terms dt { font-weight: 650; }
	.terms dd { margin-top: 2px; color: var(--muted); font-size: 14px; }
	@media screen and (max-width: 660px) {
		.chain { grid-template-columns: 1fr; --gap: 22px; }
		.chain li:not(:last-child)::after { content: '↓'; left: 16px; top: 100%; transform: none; width: auto; line-height: var(--gap); }
		.terms { grid-template-columns: 1fr; }
	}
	@media print {
		@page { size: letter portrait; margin: 0.55in; }
		:global(html), :global(body) { background: white; }
		:global(.mast), :global(.app-footer), :global(.skip-link), :global(.demo-guide), :global(.guide-entry), .download, .open-map, .tutorial { display: none !important; }
		:global(main.shell) { width: auto; max-width: none; margin: 0; padding: 0; }
		.dictionary { font-size: 11pt; }
		.dictionary .pagehead { margin: 0 0 14pt; }
		.dictionary h1 { font-size: 31pt; }
		.dictionary h2 { font-size: 16pt; }
		.example { padding: 13pt; }
		.intro, .context { font-size: 9pt; }
		.chain { --gap: 16pt; margin: 12pt 0 10pt; }
		.chain li { padding: 8pt; }
		.node-label { font-size: 8pt; margin-bottom: 6pt; }
		.chain strong { font-size: 11pt; }
		.chain li p, .terms dd { font-size: 9.5pt; }
		.terms { gap: 25pt; margin: 15pt 0 0; }
		.terms h2 { padding-bottom: 6pt; }
		.terms dl > div { padding: 4pt 0; break-inside: avoid; }
	}
</style>
