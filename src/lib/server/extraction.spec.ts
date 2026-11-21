import { describe, expect, it } from 'vitest';
import { fixtures, isFixtureId, type Packet } from './fixtures';
import { parsePacket, resolveDraft, validateModelOutput } from './extraction';

function change(packet: Packet, before: string, after: string): Packet {
	return { ...packet, documents: packet.documents.map((doc) => ({ ...doc, text: doc.text.replace(before, after) })) };
}

function correctedOutput() {
	return { candidates: Object.values(parsePacket(fixtures.corrected).candidates).flat()
		.map(({ field, value, documentId, line }) => ({ field, value, documentId, line })) };
}

describe('transfer packet extraction', () => {
	it('requires the source reference for a signed correction and preserves the two source lines', () => {
		const draft = parsePacket(fixtures.corrected);
		expect(draft.issues).toEqual([]);
		expect(draft.candidates.callback.map(({ value, line }) => [value, line])).toEqual([['214', 4], ['241', 4]]);
		expect(() => resolveDraft(draft, null)).toThrow('Select');
		expect(() => resolveDraft(draft, 'transfer:4')).toThrow('Select');
		const final = resolveDraft(draft, 'followup:4');
		expect(final.callback.quote).toBe(fixtures.corrected.documents[1].text.split('\n')[3]);
		expect(final.callback.value).toBe('241');
	});

	it('parses edited source lines with leading zeroes and tracks moved line numbers', () => {
		const source = change(change(fixtures.corrected, '214', '007'), 'with 241.', 'with 009.');
		const draft = parsePacket(change(source, 'Replace the facility', '\nReplace the facility'));
		expect(draft.candidates.callback[0].value).toBe('007');
		expect(resolveDraft(draft, 'followup:5').callback.value).toBe('009');
	});

	it('permits a consistent case without a selection and rejects unrelated selections', () => {
		const draft = parsePacket(fixtures.consistent);
		expect(draft.correctionRef).toBeNull();
		expect(resolveDraft(draft, null).callback.value).toBe('052');
		expect(draft.candidates.callback).toHaveLength(2);
		expect(() => resolveDraft(draft, 'transfer:4')).toThrow();
	});

	it.each([
		['unsigned amendment', 'Signed by M. Ellis, transfer coordinator', ''],
		['wrong signer', 'M. Ellis', 'Unknown signer'],
		['no explicit correction', 'Replace the facility callback extension on the transfer form with 241.', 'Facility callback extension: 241'],
		['missing patient', 'Patient display name: Avery Example', ''],
		['unusable patient value', 'Patient display name: Avery Example', 'Patient display name: Unknown'],
		['missing packet identifier', 'Packet ID: ER-018', ''],
		['blank packet identifier', 'Packet ID: ER-018', 'Packet ID: '],
		['wrong packet identifier', 'Packet ID: ER-018', 'Packet ID: ER-099'],
		['duplicate packet identifier', 'Packet ID: ER-018', 'Packet ID: ER-018\nPacket ID: ER-018'],
		['unsupported line', 'Sending facility: Cedar House', 'Unsupported label: Cedar House']
	])('blocks a draft with %s', (_name, before, after) => {
		const draft = parsePacket(change(fixtures.corrected, before, after));
		expect(draft.issues.length).toBeGreaterThan(0);
		expect(() => resolveDraft(draft, draft.correctionRef)).toThrow();
	});

	it('holds a conflicting addendum even if a clerk selects its later source', () => {
		const draft = parsePacket(fixtures.ambiguous);
		expect(draft.issues.join(' ')).toContain('without a signed, explicit correction');
		expect(() => resolveDraft(draft, 'followup:4')).toThrow();
	});

	it('checks that both documents belong to this packet', () => {
		const source = structuredClone(fixtures.corrected);
		source.documents[1].text = source.documents[1].text.replace('ER-018', 'ER-019');
		expect(parsePacket(source).issues).toContain('Signed amendment must contain one matching packet ID (ER-018).');
	});
});

describe('Codex source verification', () => {
	it('requires only bundled fixture identifiers and preserves verified provenance', () => {
		expect(isFixtureId('constructor')).toBe(false);
		expect(isFixtureId('corrected')).toBe(true);
		const draft = validateModelOutput('corrected', correctedOutput(), 'demo-model');
		expect(draft).toMatchObject({ method: 'codex', model: 'demo-model', issues: [] });
		expect(resolveDraft(draft, 'followup:4').callback.value).toBe('241');
	});

	it('displays only supported model occurrences in source order, even when the draft is blocked', () => {
		const { candidates } = correctedOutput();
		const supplied = candidates.filter((item) => !(item.field === 'callback' && item.documentId === 'followup')).reverse();
		const invented = { field: 'callback', value: '997', documentId: 'followup', line: 4 };
		const draft = validateModelOutput('corrected', { candidates: [invented, ...supplied] });
		expect(draft.candidates.callback.map((entry) => entry.value)).toEqual(['214']);
		expect(draft.candidates.patient.map((entry) => entry.documentId)).toEqual(['transfer', 'followup']);
		expect(draft.candidates.callback[0].quote).toBe('Facility callback extension: 214');
		expect(draft.correctionRef).toBeNull();
		expect(() => resolveDraft(draft, null)).toThrow();
	});

	it('shows no Codex values when the response is unreadable', () => {
		const draft = validateModelOutput('corrected', 'incomplete');
		expect(draft.candidates).toEqual({ patient: [], facility: [], callback: [] });
		expect(draft.correctionRef).toBeNull();
		expect(() => resolveDraft(draft, null)).toThrow();
	});

	it('rejects errors, malformed types, omissions, duplicates, incorrect citations and invented values', () => {
		const { candidates } = correctedOutput();
		const original = candidates[0];
		for (const raw of [undefined, [], { candidates: 'wrong' }, { candidates, status: 'approved' },
			{ candidates: candidates.slice(0, -1) }, { candidates: [...candidates, original] },
			...[{ value: 'Unknown' }, { line: 4 }, { documentId: 'other' }, { field: 'other' }, { extra: 'unsupported' }]
				.map((override) => ({ candidates: [{ ...original, ...override }, ...candidates.slice(1)] }))]) {
			const draft = validateModelOutput('corrected', raw);
			expect(draft.issues.length).toBeGreaterThan(0);
			expect(() => resolveDraft(draft, 'followup:4')).toThrow();
		}
		expect(parsePacket(fixtures.corrected)).toMatchObject({ method: 'local', issues: [] });
	});
});
