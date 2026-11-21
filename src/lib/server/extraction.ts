import { fixtures, isFixtureId, type FixtureId, type Packet } from './fixtures';

export const fields = ['patient', 'facility', 'callback'] as const;
export type Field = (typeof fields)[number];
export const fieldLabels: Record<Field, string> = {
	patient: 'Patient display name', facility: 'Sending facility', callback: 'Facility callback extension'
};

export interface Evidence {
	ref: string;
	field: Field;
	value: string;
	documentId: string;
	line: number;
	quote: string;
}

export interface Draft {
	packetId: string;
	method: 'local' | 'codex';
	model: string | null;
	candidates: Record<Field, Evidence[]>;
	correctionRef: string | null;
	issues: string[];
}

const correction = /^Replace the facility callback extension on the transfer form with (\d+)\.$/;
const signature = 'Signed by M. Ellis, transfer coordinator';
const missing = /^(?:unknown|unspecified|not provided|unavailable|n\/a|none|-+)$/i;

export function parsePacket(packet: Packet): Draft {
	const draft: Draft = {
		packetId: packet.id, method: 'local', model: null,
		candidates: { patient: [], facility: [], callback: [] }, correctionRef: null, issues: []
	};
	if (packet.documents.length !== 2 || !['transfer', 'followup'].every((id) => packet.documents.some((doc) => doc.id === id))) {
		draft.issues.push('Expected one transfer form and one accompanying document.');
	}
	for (const doc of packet.documents) {
		const lines = doc.text.split(/\r?\n/);
		const packetIds: string[] = [];
		const seen = new Set<Field>();
		let correctionRef: string | null = null;
		let signatures = 0;
		for (const [index, quote] of lines.entries()) {
			const text = quote.trim();
			if (!text) continue;
			if (text.startsWith('Packet ID:')) {
				packetIds.push(text.slice('Packet ID:'.length).trim());
				continue;
			}
			if (text === signature) { signatures++; continue; }
			const replacement = correction.exec(text);
			const field = replacement ? 'callback' : fields.find((field) => text.startsWith(`${fieldLabels[field]}:`));
			if (!field) {
				draft.issues.push(`${doc.title}, line ${index + 1} has unsupported wording. Check the source.`);
				continue;
			}
			const value = replacement ? replacement[1] : text.slice(fieldLabels[field].length + 1).trim();
			if (seen.has(field)) draft.issues.push(`${doc.title} lists ${fieldLabels[field].toLowerCase()} more than once.`);
			seen.add(field);
			if (!value || missing.test(value) || (field === 'callback' && !/^\d+$/.test(value))) {
				draft.issues.push(`${doc.title}, line ${index + 1} has no usable ${fieldLabels[field].toLowerCase()}.`);
				continue;
			}
			const ref = `${doc.id}:${index + 1}`;
			draft.candidates[field].push({ ref, field, value, documentId: doc.id, line: index + 1, quote });
			if (replacement) {
				if (doc.id === 'followup') correctionRef = ref;
				else draft.issues.push('The correction must appear in the accompanying document.');
			}
		}
		if (packetIds.length !== 1 || !packetIds[0] || packetIds[0] !== packet.id) {
			draft.issues.push(`${doc.title} must contain one matching packet ID (${packet.id}).`);
		}
		if (seen.size === 0) draft.issues.push(`${doc.title} contains no supported administrative fields.`);
		if (correctionRef && signatures === 1) draft.correctionRef = correctionRef;
		if (correctionRef && signatures !== 1) draft.issues.push(`${doc.title} needs the demo signatory for its correction.`);
	}
	for (const field of fields) {
		const values = new Set(draft.candidates[field].map((item) => item.value));
		if (!values.size) draft.issues.push(`${fieldLabels[field]} is missing from the packet.`);
		if (values.size > 1 && !(field === 'callback' && draft.correctionRef)) {
			draft.issues.push(`${fieldLabels[field]} differs between sources without a signed, explicit correction. Hold for clarification.`);
		}
	}
	// A correction can require a clerk decision only if its original value is present and differs.
	if (new Set(draft.candidates.callback.map((item) => item.value)).size < 2) draft.correctionRef = null;
	return draft;
}

export function resolveDraft(draft: Draft, selectedRef: string | null): Record<Field, Evidence> {
	if (draft.issues.length) throw new Error(draft.issues[0]);
	if (selectedRef !== draft.correctionRef) throw new Error('Select the documented correction before approving.');
	const { patient, facility, callback } = draft.candidates;
	const accepted = selectedRef ? callback.find((entry) => entry.ref === selectedRef) : callback[0];
	if (!patient[0] || !facility[0] || !accepted) throw new Error('The source evidence is incomplete.');
	return { patient: patient[0], facility: facility[0], callback: accepted };
}

export const candidateSchema = {
	type: 'object', additionalProperties: false, required: ['candidates'], properties: {
		candidates: { type: 'array', items: {
			type: 'object', additionalProperties: false, required: ['field', 'value', 'documentId', 'line'], properties: {
				field: { type: 'string', enum: fields }, value: { type: 'string' },
				documentId: { type: 'string', enum: ['transfer', 'followup'] }, line: { type: 'integer' }
			}
		} }
	}
};

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateModelOutput(fixtureId: FixtureId, output: unknown, model?: string): Draft {
	if (!isFixtureId(fixtureId)) throw new Error('Choose a bundled synthetic sample.');
	const draft = parsePacket(fixtures[fixtureId]);
	draft.method = 'codex';
	draft.model = model ?? null;
	const expected = Object.values(draft.candidates).flat();
	const signedCorrection = draft.correctionRef;
	draft.candidates = { patient: [], facility: [], callback: [] };
	draft.correctionRef = null;
	const seen = new Set<string>();
	if (!record(output) || Object.keys(output).length !== 1 || !Array.isArray(output.candidates)) {
		draft.issues.push('Codex returned an unreadable draft. Run the local parser to retry.');
		return draft;
	}
	let invalidCandidate = false;
	for (const item of output.candidates) {
		const entry = record(item) && Object.keys(item).length === 4 && expected.find((candidate) =>
			item.field === candidate.field && item.value === candidate.value &&
			item.documentId === candidate.documentId && item.line === candidate.line);
		if (!entry || seen.has(entry.ref)) {
			invalidCandidate = true;
			continue;
		}
		seen.add(entry.ref);
	}
	for (const entry of expected) {
		if (seen.has(entry.ref)) draft.candidates[entry.field].push(entry);
	}
	if (signedCorrection && seen.has(signedCorrection)) draft.correctionRef = signedCorrection;
	if (invalidCandidate) draft.issues.push('Codex returned an unsupported or repeated value or source reference. Run the local parser to retry.');
	if (seen.size !== expected.length) draft.issues.push('Codex omitted source evidence. Run the local parser to retry.');
	return draft;
}
