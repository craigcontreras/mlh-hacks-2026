import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PacketWorkspace from './PacketWorkspace.svelte';

it('keeps the selected packet in both extraction form targets when a server action fails', async () => {
	const model = await render(PacketWorkspace, { data: {
		sampleId: 'consistent', samples: [], record: null,
		packet: { id: 'ER-020', title: 'Consistent transfer', documents: [] }
	} });
	for (const name of ['Parse with Codex', 'Use local parser']) {
		await expect.element(model.getByRole('button', { name })).toHaveAttribute('formaction', '?/extract&sample=consistent');
	}
});
