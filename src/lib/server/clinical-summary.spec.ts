import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { clinicalDocument, summarizeDocument, verifyClinicalSummary } from './clinical-summary';
import { runStructuredCodex } from './codex';

vi.mock('./codex', () => ({ runStructuredCodex: vi.fn() }));

function modelReply(text = clinicalDocument.text) {
	const { facts, tasks } = verifyClinicalSummary(text, 'local');
	return { items: [...facts.map(({ kind, line, text }) => ({ kind, line, text })),
		...tasks.map(({ id: kind, line, text }) => ({ kind, line, text }))] };
}

describe('ED transfer note', () => {
	it('reads the downloadable note verbatim and extracts source-documented facts and assignments', async () => {
		expect(clinicalDocument.text).toBe(readFileSync(`static${clinicalDocument.sourceUrl}`, 'utf8'));
		const summary = await summarizeDocument('local');
		expect(summary.issues).toEqual([]);
		expect(summary.facts.map((fact) => fact.kind)).toEqual(['reason', 'report', 'impression', 'pending']);
		expect(summary.facts[1].text).toContain('report is attached and documents lateral soft tissue swelling');
		expect(summary.facts[2].text).toBe('Lateral soft tissue swelling. No acute fracture identified on these views.');
		expect(summary.facts[3].text).toContain('requested and had not arrived');
		expect(summary.tasks.map((item) => [item.id, item.role])).toEqual([['review-report', 'Doctor'], ['check-images', 'Nurse']]);
		for (const item of [...summary.facts, ...summary.tasks]) {
			expect(clinicalDocument.text.split('\n')[item.line - 1]).toBe(item.quote);
			expect(item.quote).toContain(item.text);
		}
	});

	it('uses the Codex-selected evidence and excludes claims without exact supporting spans', async () => {
		vi.mocked(runStructuredCodex).mockResolvedValueOnce(modelReply());
		const verified = await summarizeDocument('codex');
		expect(verified.method).toBe('codex');
		expect(verified.issues).toEqual([]);
		expect(verified.facts).toHaveLength(4);
		const raw = modelReply();
		const index = raw.items.findIndex((item) => item.kind === 'pending');
		raw.items[index].text = raw.items[index].text.replace('had not arrived', 'had arrived');
		const blocked = verifyClinicalSummary(clinicalDocument.text, 'codex', raw);
		expect(blocked.issues).toHaveLength(1);
		expect(blocked.facts.map((item) => item.kind)).not.toContain('pending');
	});

	it('blocks a final report cited as pending, swapped roles, omitted evidence, duplicates and a new recommendation', () => {
		const raw = modelReply();
		const [reason, report, impression, , doctor, nurse] = raw.items;
		for (const items of [raw.items.map((item) => item.kind === 'pending' ? { ...report, kind: 'pending' } : item),
			raw.items.map((item) => item.kind === 'review-report' ? { ...nurse, kind: 'review-report' } : item),
			raw.items.filter((item) => item !== reason), [...raw.items, doctor],
			raw.items.map((item) => item === impression ? { ...item, text: item.text.split('. ')[0] + '.' } : item),
			[...raw.items, { kind: 'new-order', line: 5, text: 'Run another test.' }]]) {
			expect(verifyClinicalSummary(clinicalDocument.text, 'codex', { items }).issues.length).toBeGreaterThan(0);
		}
		expect(verifyClinicalSummary(clinicalDocument.text, 'codex', {}).tasks).toEqual([]);
	});

	it('derives a new finding, pending wording and line citations from edited source', () => {
		const text = '\n\n' + clinicalDocument.text.replace('documents lateral soft tissue swelling', 'describes swelling near the ankle')
			.replace('No acute fracture identified on these views.', 'No displaced fracture identified on the submitted views.')
			.replace('were requested and had not arrived by departure', 'were requested and remained pending at departure');
		const original = modelReply();
		const updated = verifyClinicalSummary(text, 'local');
		expect(updated.issues).toEqual([]);
		expect(updated.facts[1].text).toContain('describes swelling near the ankle');
		expect(updated.facts[2].text).toContain('No displaced fracture identified on the submitted views.');
		expect(updated.facts[3].text).toContain('remained pending at departure');
		expect(updated.facts[1].line).toBe(original.items[1].line + 2);
		expect(verifyClinicalSummary(text, 'codex', original).issues.length).toBeGreaterThan(0);
		expect(verifyClinicalSummary(text, 'codex', modelReply(text)).facts).toEqual(updated.facts);
	});

	it('withholds the pending fact if request status changes to received', () => {
		const text = clinicalDocument.text.replace('had not arrived', 'had arrived');
		const blocked = verifyClinicalSummary(text, 'local');
		expect(blocked.issues).toHaveLength(1);
		expect(blocked.facts.map((fact) => fact.kind)).not.toContain('pending');
	});
});
