<script lang="ts">
	import type { ChartDocument } from '../server/chart';

	let { doc, activeLine }: { doc: ChartDocument; activeLine?: number } = $props();
	const lines = $derived(doc.text.split(/\r?\n/));

	function lineStyle(text: string, index: number) {
		if (!text) return 'blank';
		if (index === 0) return 'institution';
		if (index === 1) return 'training';
		if (/^(?:Document: |ED transfer note · )/.test(text)) return 'title';
		if (/^(?:Chart identity:|Patient:|Date:|Prepared by:)/.test(text)) return 'identity';
		if (/^(?:\d{2}:\d{2} ·|Attachment \d+ of \d+ ·)/.test(text)) return 'section';
		if (/^(?:Receiving (?:doctor|nurse):|Clerk instruction:)/.test(text)) return 'assignment';
		if (/^(?:Report signed by|Signed by|Recorded by)/.test(text)) return 'signature';
		if (/^(?:Impression:|Archive entry:|Accession:|Prior study link:|Visit services:)/.test(text)) return 'entry';
		return 'body';
	}
</script>

<article class="record" class:radiology={doc.id.endsWith('-radiology')} class:archive={doc.id.endsWith('-study')} aria-label={doc.title + ', ' + doc.visitId}>
	<ol class="record-lines" aria-label="Original document lines">
		{#each lines as text, index (index)}
			{@const style = lineStyle(text, index)}
			{@const nameEnd = text.indexOf(': ')}
			<li id={'chart-' + doc.id + '-L' + (index + 1)} data-line={index + 1} class={style} class:highlight={activeLine === index + 1} tabindex="-1">
				<div class="source-text" role={style === 'title' || style === 'section' ? 'heading' : undefined} aria-level={style === 'title' ? 4 : style === 'section' ? 5 : undefined}>{#if style === 'institution' && text.includes(' | ')}<span class="hospital">{text.slice(0, text.indexOf(' | '))}</span><span class="service">{text.slice(text.indexOf(' | '))}</span>{:else if nameEnd >= 0 && ['title', 'identity', 'assignment', 'entry'].includes(style)}<span class="field">{text.slice(0, nameEnd + 2)}</span>{text.slice(nameEnd + 2)}{:else}{text}{/if}</div>
			</li>
		{/each}
	</ol>
</article>

<style>
	.record {
		--record-ink: #283738;
		--record-accent: #24574e;
		--record-rule: #d1d9d6;
		--record-tint: #eaf1ee;
		box-sizing: border-box;
		width: 100%;
		max-width: 56rem;
		margin-inline: auto;
		padding: clamp(13px, 3%, 34px) clamp(11px, 3%, 34px) clamp(17px, 4%, 40px);
		background: #fff;
		color: var(--record-ink);
		border: 1px solid #cbd2cf;
		border-top: 4px solid var(--record-accent);
		box-shadow: 0 2px 6px #1c302b0e;
		font: 400 15px/1.53 'Source Sans 3', 'Helvetica Neue', Arial, sans-serif;
		text-align: left;
	}
	.radiology { --record-accent: #334d6a; --record-tint: #eef2f6; }
	.archive { --record-accent: #5c5440; --record-tint: #f3f1eb; }
	.record-lines { padding: 0; margin: 0; list-style: none; }
	.record-lines li {
		display: grid;
		grid-template-columns: 2ch minmax(0, 1fr);
		column-gap: .82em;
		min-width: 0;
		padding: .24em .28em;
		scroll-margin-block: 4rem 1rem;
	}
	.record-lines li::before {
		content: attr(data-line);
		color: #63706b;
		text-align: right;
		font: 400 10px/1.5 'IBM Plex Mono', ui-monospace, monospace;
		padding-top: .42em;
	}
	.source-text { white-space: pre-wrap; overflow-wrap: anywhere; min-width: 0; }
	.institution .source-text { color: var(--record-accent); line-height: 1.2; }
	.hospital { font-size: 1.05em; letter-spacing: .08em; font-weight: 750; }
	.service { font-size: .75em; font-weight: 650; letter-spacing: .045em; }
	.training .source-text { color: #56635e; font-size: .78em; }
	.record-lines .title { margin: .66em 0 .15em; }
	.title .source-text { color: var(--record-accent); font: 600 clamp(20px, 2.1vw, 28px)/1.17 'Source Sans 3','Helvetica Neue',Arial,sans-serif; letter-spacing: -.025em; }
	.title .field { font-size: .54em; letter-spacing: 0; }
	.record-lines .identity { background: #f6f8f7; font-size: .88em; }
	.field { font-weight: 700; }
	.record-lines .section { padding-block: .38em; border-bottom: 1px solid var(--record-rule); margin-bottom: .35em; }
	.section .source-text { color: var(--record-accent); font: 650 .89em/1.45 'Source Sans 3','Helvetica Neue',Arial,sans-serif; }
	.record-lines .entry, .record-lines .assignment { background: var(--record-tint); margin-block: .23em; }
	.record-lines .assignment { border-inline-start: 2px solid var(--record-accent); }
	.record-lines .signature { margin-top: .35em; color: #4f5a56; font: italic .9em/1.5 'Spectral',Georgia,serif; }
	.record-lines .blank { min-height: .65em; padding-block: 0; }
	.blank::before { visibility: hidden; }
	.record-lines li:target, .record-lines li.highlight, .record-lines li:focus-visible {
		background: #fff4c8; outline: 2px solid #926e20; outline-offset: -1px; color: #302a19;
	}
	@media (max-width: 450px) {
		.record { font-size: 14px; padding: 12px 8px 18px; }
		.record-lines li { column-gap: .55em; }
	}
	@media print {
		.record { box-shadow: none; border: 0; border-top: 2pt solid #344940; padding: 6mm 0; max-width: none; color: #000; font-size: 10pt; }
		.record-lines li { break-inside: avoid; padding-block: .15em; }
		.record-lines .section, .record-lines .title, .record-lines .institution { break-after: avoid; }
		.record-lines li:target, .record-lines li.highlight, .record-lines li:focus-visible { background: transparent; outline: 0; }
		.record-lines .assignment { border-inline-start-color: #555; }
	}
</style>
