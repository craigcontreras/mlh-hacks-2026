export interface SourceDocument {
	id: string;
	title: string;
	time: string;
	text: string;
}

export interface Packet {
	id: string;
	title: string;
	documents: SourceDocument[];
}

function sample(id: string, title: string, name: string, facility: string, original: string, followupTitle: string, followup: string): Packet {
	const header = `Packet ID: ${id}\nPatient display name: ${name}\nSending facility: ${facility}`;
	return {
		id,
		title,
		documents: [
			{ id: 'transfer', title: 'Transfer form', time: '09:10', text: `${header}\nFacility callback extension: ${original}` },
			{ id: 'followup', title: followupTitle, time: '09:24', text: `${header}\n${followup}` }
		]
	};
}

export const fixtures = {
	corrected: sample('ER-018', 'Corrected transfer', 'Avery Example', 'Cedar House', '214', 'Signed amendment',
		'Replace the facility callback extension on the transfer form with 241.\nSigned by M. Ellis, transfer coordinator'),
	ambiguous: sample('ER-019', 'Ambiguous transfer', 'Rowan Example', 'Birch House', '307', 'Transfer addendum',
		'Facility callback extension: 370'),
	consistent: sample('ER-020', 'Consistent transfer', 'Morgan Example', 'Elm House', '052', 'Transfer confirmation',
		'Facility callback extension: 052')
} satisfies Record<string, Packet>;

export type FixtureId = keyof typeof fixtures;

export function isFixtureId(value: unknown): value is FixtureId {
	return typeof value === 'string' && Object.hasOwn(fixtures, value);
}
