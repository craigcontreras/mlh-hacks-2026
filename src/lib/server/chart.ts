import transfer from '../../../samples/records/ED-104-transfer-note.txt?raw';
import registration from '../../../samples/records/ED-104-registration.txt?raw';
import report from '../../../samples/records/ED-104-radiology.txt?raw';
import intake from '../../../samples/records/ED-082-intake.txt?raw';
import study from '../../../samples/records/ED-082-study.txt?raw';

export const chartPatient = { id: 'J-104', name: 'Jordan Vale', hospital: 'Mossbridge Community Hospital' };
export interface ChartDocument {
	id: string;
	title: string;
	patientId: string;
	visitId: string;
	date: string;
	text: string;
	sourceUrl: string;
}

function document(id: string, title: string, text: string, visitId: string, date: string, file = id): ChartDocument {
	return { id, title, patientId: chartPatient.id, visitId, date, text, sourceUrl: `/samples/${file}.txt` };
}

export const chartDocuments: ChartDocument[] = [
	document('ED-104', 'ED transfer note', transfer, 'ED-104', '2026-11-21', 'ED-104-transfer-note'),
	document('ED-104-registration', 'Registration and transfer checklist', registration, 'ED-104', '2026-11-21'),
	document('ED-104-radiology', 'Final radiology report', report, 'ED-104', '2026-11-21'),
	document('ED-082-intake', 'Prior visit intake', intake, 'ED-082', '2026-09-04'),
	document('ED-082-study', 'Prior imaging archive entry', study, 'ED-082', '2026-09-04')
];
export const clinicalDocument = { ...chartDocuments[0], patient: chartPatient.name };
export const chartImage = { sourceUrl: '/samples/ED-104-ankle.png', visit: 'ED-104', side: 'L', marker: 'SYNTHETIC DEMO' };

export type ImageStatus = 'arrived' | 'still-pending' | 'unable-to-confirm';
export interface PracticeRound { accession: string; status: ImageStatus }
const replyPrefix = '13:42 · Imaging Records reply: ';
const replies: Record<ImageStatus, string> = {
	arrived: 'The receiving viewer now shows the comparison images for study',
	'still-pending': 'The comparison images are still pending for study',
	'unable-to-confirm': 'Imaging Records could not confirm delivery of the comparison images for study'
};

export function practiceDocuments(practice: PracticeRound | null): ChartDocument[] {
	if (!practice) return chartDocuments;
	return chartDocuments.map(doc => {
		if (doc.id !== 'ED-104-registration' && doc.id !== 'ED-082-study') return doc;
		let text = doc.text.replaceAll('MB-082-LA', practice.accession);
		if (doc.id === 'ED-104-registration') {
			text = text.trimEnd() + '\n\n' + replyPrefix + replies[practice.status] + ' ' + practice.accession + '.\n';
		}
		return { ...doc, text };
	});
}

export function practiceReplyEvidence(documents: ChartDocument[]): ChartEvidence | undefined {
	const checklist = documents.find(doc => doc.id === 'ED-104-registration');
	const lines = checklist?.text.split(/\r?\n/);
	if (!checklist || !lines) return;
	const index = lines.findIndex(line => line.startsWith(replyPrefix));
	if (index >= 0) return { documentId: checklist.id, line: index + 1, quote: lines[index] };
}

export interface ChartEvidence { documentId: string; line: number; quote: string }
export interface ChartFindings {
	crossChecks?: { label: string; result: string; evidence: ChartEvidence[] }[];
	adminAction?: { text: string; accession: string; evidence: ChartEvidence[] };
	imageReview?: { method: 'codex' | 'manifest'; text: string; sourceUrl: string; labels: string[] };
}

// Each slot belongs to one document; a verbatim quote from another visit cannot fill it.
const slots = {
	'transfer-impression': ['ED-104', /^Study: .+ Impression: (.+)$/],
	'final-impression': ['ED-104-radiology', /^Impression: (.+)$/],
	'prior-intake': ['ED-082-intake', /^Visit services: (.+) recorded for this encounter\.$/],
	'prior-archive': ['ED-082-study', /^Archive entry: (.+) \| accession ([\w-]+) \| images on file at (.+)\.$/],
	'pending-handoff': ['ED-104', /\b(?:comparison|outside) images\b.*\brequested\b.*\b(?:not (?:yet )?(?:arrived|received)|(?:still|remain(?:ed)?) pending)\b/i],
	'attachment-status': ['ED-104-registration', /^Prior study link: ([\w-]+) \| Current transfer: comparison images not attached\.$/],
	'clerk-instruction': ['ED-104-registration', /^Clerk instruction: (Send Imaging Records a request to link prior (.+) study ([\w-]+) to transfer ([\w-]+)\.)$/]
} as const;

export const referenceKinds = Object.keys(slots);
export const referenceHints = 'transfer-impression: complete transfer-note study/impression line; final-impression: independent final report Impression line; prior-intake: prior intake Visit services line; prior-archive: historical Archive entry line; pending-handoff: transfer note line stating earlier images were requested and had not arrived; attachment-status: registration Prior study link line; clerk-instruction: registration Clerk instruction line.';

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function matchesChartIdentity(docs: ChartDocument[]): boolean {
	const byId = new Map(docs.map((doc) => [doc.id, doc]));
	return docs.length === chartDocuments.length && byId.size === docs.length && !chartDocuments.some((expected) => {
		const doc = byId.get(expected.id);
		if (!doc || doc.patientId !== chartPatient.id || doc.visitId !== expected.visitId || doc.date !== expected.date) return true;
		const lines = doc.text.split(/\r?\n/);
		const names = lines.filter((line) => line.startsWith('Patient: '));
		if (names.length !== 1 || names[0].split(' | ')[0] !== `Patient: ${chartPatient.name}`) return true;
		if (doc.id === 'ED-104') return !lines.includes('ED transfer note · ED-104 · 21 November 2026') || !lines[0].startsWith(chartPatient.hospital.toUpperCase() + ' | ');
		const identities = lines.filter((line) => line.startsWith('Chart identity: '));
		return identities.length !== 1 || identities[0] !== `Chart identity: ${chartPatient.id} | visit ${doc.visitId} | ${chartPatient.hospital}` || !lines.includes(`Date: ${doc.date}`);
	});
}

export function reconcileChart(docs: ChartDocument[], mode: 'codex' | 'local', references?: unknown, imageLabels?: unknown): ChartFindings & { issues: string[] } {
	const result: ChartFindings & { issues: string[] } = { crossChecks: [], issues: [] };
	const appendIssue = (message: string) => result.issues.push(message);
	const byId = new Map(docs.map((doc) => [doc.id, doc]));
	const modelRefs: unknown[] = Array.isArray(references) ? references : [];
	if (mode === 'codex' && (modelRefs.length !== referenceKinds.length || modelRefs.some((ref) => !isRecord(ref) || !referenceKinds.includes(String(ref.kind))))) {
		appendIssue('Codex did not return the complete set of document references.');
	}
	function read(kind: keyof typeof slots) {
		const [documentId, selector] = slots[kind];
		const doc = byId.get(documentId)!;
		const matches = doc.text.split(/\r?\n/).map((quote, i) => ({ quote, documentId, line: i + 1, match: selector.exec(quote) })).filter((entry) => entry.match !== null);
		if (matches.length !== 1) { appendIssue(`Missing or ambiguous ${kind} evidence in ${doc.title}.`); return; }
		const { match, quote, line } = matches[0];
		if (mode === 'codex') {
			const selected = modelRefs.filter((ref) => isRecord(ref) && ref.kind === kind);
			const ref = selected[0];
			if (selected.length !== 1 || !isRecord(ref) || Object.keys(ref).length !== 4 || ref.documentId !== documentId || ref.line !== line || ref.quote !== quote) {
				appendIssue(`Codex returned an unverified ${kind} source.`);
				return;
			}
		}
		return { evidence: { documentId, line, quote }, capture: match! };
	}
	const transfer = read('transfer-impression'), independent = read('final-impression');
	const intake = read('prior-intake'), archive = read('prior-archive');
	const pending = read('pending-handoff'), status = read('attachment-status'), action = read('clerk-instruction');
	const checks = result.crossChecks!;
	const reply = practiceReplyEvidence(docs);
	let imagesArrived = false;
	if (reply && archive) {
		const delivery = (Object.entries(replies) as [ImageStatus, string][]).find(([, message]) =>
			reply.quote === replyPrefix + message + ' ' + archive.capture[2] + '.');
		if (!delivery) appendIssue('The later imaging reply does not confirm a status for the prior accession.');
		else {
			imagesArrived = delivery[0] === 'arrived';
			checks.push({ label: 'Imaging Records reply at 13:42', result: reply.quote.slice(replyPrefix.length), evidence: [reply] });
		}
	}
	if (transfer && independent) {
		const reportLines = byId.get('ED-104-radiology')!.text.split(/\r?\n/);
		const studies = reportLines.filter((line) => line.startsWith('Study: '));
		const sameStudy = studies.length === 1 && studies[0] === transfer.evidence.quote.split(' Impression: ')[0];
		const finalStatuses = reportLines.filter((line) => line.startsWith('Accession: '));
		if (finalStatuses.length !== 1 || !/ \| Status: FINAL \| Report signed: \d{2}:\d{2}$/.test(finalStatuses[0]) || !reportLines.some((line) => /^Signed by .+\.$/.test(line))) {
			appendIssue('The independent report needs a final status and a recorded signatory.');
		} else if (!sameStudy || transfer.capture[1] !== independent.capture[1]) appendIssue('The transfer note and radiology report disagree on the study or impression. Request clinical review.');
		else checks.push({ label: 'Current report corroborated', result: 'The transfer note and the independently signed report contain the same impression.', evidence: [transfer.evidence, independent.evidence] });
	}
	if (intake && archive) {
		if (intake.capture[1] !== archive.capture[1] || archive.capture[3] !== chartPatient.hospital) appendIssue('The prior intake and imaging archive do not identify the same study and hospital.');
		else checks.push({ label: 'Prior study on file', result: `${archive.capture[1]} is on file under ${archive.capture[2]} from the earlier visit.`, evidence: [intake.evidence, archive.evidence] });
	}
	if (pending && status && archive) {
		if (status.capture[1] !== archive.capture[2]) appendIssue('The current transfer references a different prior accession than the archive.');
		else checks.push({ label: 'Comparison images at transfer', result: `Study ${archive.capture[2]} was on file. At departure, the transfer packet did not include its images.`, evidence: [pending.evidence, status.evidence, archive.evidence] });
	}
	const { visit, side, marker, sourceUrl } = chartImage;
	if (mode === 'local') result.imageReview = { method: 'manifest', sourceUrl, labels: [visit, side, marker], text: 'Local file manifest lists the visit, side and synthetic marker. The local parser does not read image pixels.' };
	else if (isRecord(imageLabels) && Object.keys(imageLabels).length === 3 && imageLabels.visit === visit && imageLabels.side === side && imageLabels.marker === marker) {
		result.imageReview = { method: 'codex', sourceUrl, labels: [visit, side, marker], text: 'Codex read the printed visit, side marker and synthetic label from the image. All three matched the file manifest.' };
	} else appendIssue('The printed image labels were missing or disagreed with the file manifest.');
	if (!result.issues.length && action && archive && status) {
		if (action.capture[3] !== archive.capture[2] || action.capture[4] !== byId.get('ED-104')!.visitId || !archive.capture[1].toLowerCase().startsWith(action.capture[2].toLowerCase() + ' ')) appendIssue('The clerk instruction does not match the documented prior study and destination visit.');
		else if (!imagesArrived) result.adminAction = { text: action.capture[1], accession: archive.capture[2], evidence: [action.evidence, archive.evidence, status.evidence] };
	}
	return result;
}
