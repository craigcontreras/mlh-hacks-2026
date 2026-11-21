import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SourceRecord from './SourceRecord.svelte';

it('preserves each source line and citation anchor when formatting the record', async () => {
	const doc = {
		id: 'EX-001', visitId: 'EX-001', patientId: 'demo', date: '2026-11-21',
		title: 'Test transfer note', sourceUrl: '/samples/test.txt',
		text: 'DEMO HOSPITAL | REGISTRATION\nSynthetic record\n\nDocument: Transfer note\nPatient: Sample\n'
	};
	await render(SourceRecord, { doc, activeLine: 4 });
	const paragraphs = [...document.querySelectorAll<HTMLElement>('article[aria-label="Test transfer note, EX-001"] li')];
	expect(paragraphs.map((element) => element.textContent).join('\n')).toBe(doc.text);
	expect(paragraphs.map((element) => element.id)).toEqual(doc.text.split('\n').map((_, i) => `chart-EX-001-L${i + 1}`));
	expect(paragraphs.filter((element) => element.classList.contains('highlight')).map((element) => element.id)).toEqual(['chart-EX-001-L4']);
});
