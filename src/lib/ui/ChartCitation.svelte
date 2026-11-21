<script lang="ts">
	let { line, doc = 'ED-104', label }: { line: number; doc?: string; label?: string } = $props();
	function reveal(event: MouseEvent) {
		window.dispatchEvent(new CustomEvent('intake-view-source', {
			detail: { doc, line, trigger: event.currentTarget }
		}));
	}
</script>
<button type="button" class="source-link" onclick={reveal}>{label ?? 'View transfer note'}</button>

<style>
	.source-link {
		background: none;
		border: 0;
		padding: 2px 0;
		color: #4f4f4f;
		font: 600 13px/1.45 Inter, Arial, sans-serif;
		text-decoration: underline;
		text-underline-offset: 3px;
		text-align: left;
	}
	.source-link:hover { color: var(--ink); }
</style>
