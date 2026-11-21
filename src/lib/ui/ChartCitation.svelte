<script lang="ts">
	let { line, doc = 'ED-104', label }: { line: number; doc?: string; label?: string } = $props();
	const id = $derived('chart-' + doc + '-L' + line);
	function reveal() {
		const source = document.getElementById(id)?.closest('details');
		if (source) source.open = true;
	}
</script>
<a class="line-ref" href={'#' + id} onclick={reveal} aria-label={'View ' + (label ?? doc) + ', line ' + line}>{label ? label + ' · ' : ''}L{line}</a>
