import { expect, test } from 'vitest';
import { chartDocuments } from './chart';
import { sampleResponse } from './sample-assets';
import { PacketStore } from './store';

test('saved source text controls whether the current PDF can be presented as the original', async () => {
	const store = new PacketStore(':memory:');
	try {
		const filename = 'ED-104-transfer-note.pdf';
		const saved = store.clinical.get()!;
		expect((await sampleResponse(filename, true, saved)).headers.get('Content-Type')).toBe('application/pdf');
		const previous = { ...saved, sourceText: 'Earlier version of the transfer note.' };
		await expect(sampleResponse(filename, true, previous)).rejects.toMatchObject({status:409});
		await expect(sampleResponse(filename, false, {...previous, sources:chartDocuments})).rejects.toMatchObject({status:409});
		const sources = chartDocuments.map(doc => doc.id === 'ED-104-radiology' ? {...doc,text: 'Unsigned preliminary report.'} : doc);
		await expect(sampleResponse('ED-104-radiology.pdf', false, {...saved,sources})).rejects.toMatchObject({status:409});
	} finally { store.close(); }
});
