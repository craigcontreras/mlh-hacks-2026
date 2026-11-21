import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PacketWorkspace from './PacketWorkspace.svelte';

it('offers one local Parse action for the selected packet', async () => {
	const model = await render(PacketWorkspace, { data: {
		account: { id: 'admin', name: 'Maya Chen', label: 'Triage agent', role: 'Administrative staff' },
		sampleId: 'consistent', samples: [], record: null, guide: null,
		packet: { id: 'ER-020', title: 'Consistent transfer', documents: [] }
	} });
	const parse = model.getByRole('button', { name: 'Parse', exact: true });
	await expect.element(parse).toHaveAttribute('formaction', '?/extract&sample=consistent');
	await expect.element(parse).toHaveAttribute('value', 'local');
	expect(model.getByRole('button').all()).toHaveLength(1);
});
