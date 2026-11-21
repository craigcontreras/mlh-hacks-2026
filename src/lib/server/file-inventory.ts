import { chartPatient, imagingReplyStatus, type ChartDocument } from './chart';
import { sameChart } from './chart-brief';
import type { ClinicalState } from './clinical-store';
import type { ImagingNotice } from './imaging-notice';
import { expectedChartDocuments } from './patient-registry';

export const priorImageFilename = 'ED-082-ankle.png';
type Patient = typeof chartPatient;
type FileStatus = 'available' | 'pending' | 'unconfirmed';
type PriorImage = {
	status: FileStatus; accession: string | null; visitId: string; date: string;
	owner: string; detail: string; url: string | null
};

export interface FileInventory {
	date: string; available: number; expected: number;
	missingDocuments: {id: string; title: string; visitId: string}[];
	priorImage: PriorImage | null;
}

export function priorComparisonImage(documents: ChartDocument[], record: ClinicalState | null, notice?: ImagingNotice | null): PriorImage {
	const archive = documents.find(doc => doc.id === 'ED-082-study' && doc.visitId === 'ED-082' && sameChart(doc, chartPatient));
	const checklist = documents.find(doc => doc.id === 'ED-104-registration' && doc.visitId === 'ED-104' && sameChart(doc, chartPatient));
	const archiveLines = archive?.text.split(/\r?\n/).filter(line => line.startsWith('Archive entry:')) ?? [];
	const checklistLines = checklist?.text.split(/\r?\n/) ?? [];
	const links = checklistLines.filter(line => line.startsWith('Prior study link:'));
	const study = archiveLines.length === 1 && /^Archive entry: Left ankle X-ray \| accession ([\w-]+) \| images on file at Mossbridge Community Hospital\.$/.exec(archiveLines[0])?.[1];
	const accession = study && links.length === 1 && links[0] === 'Prior study link: ' + study + ' | Current transfer: comparison images not attached.' ? study : null;
	const nursing = record?.history.findLast(event => event.taskId === 'check-images');
	const matchingNotice = accession && notice?.accession === accession ? notice : null;
	const owner = matchingNotice?.status === 'requested' ? matchingNotice.recipient
		: record?.imageFollowup?.recipientName ?? nursing?.recipientName ?? 'Receiving nurse';
	const replyLines = checklistLines.filter(line => line.includes('Imaging Records reply:'));
	const reply = accession && replyLines.length === 1 ? imagingReplyStatus(replyLines[0], accession) : undefined;
	const observation = record?.imageStatus;
	const received = matchingNotice?.status === 'received' && matchingNotice.receivedAt && matchingNotice.receivedVia === 'matched-delivery';
	const status = received ? 'arrived' : accession ? observation?.status ?? reply ?? (replyLines.length ? 'unable-to-confirm' : 'still-pending') : 'unable-to-confirm';
	const availability = status === 'arrived' ? 'available' : status === 'still-pending' ? 'pending' : 'unconfirmed';
	let detail = 'The transfer checklist lists the earlier images as outstanding.';
	if (!accession) detail = 'The archive and transfer checklist do not establish a matching study ID.';
	else if (received) detail = 'Imaging Records matched the earlier X-ray to this chart.';
	else if (observation) detail = observation.recordedBy + ' recorded the latest receipt status.';
	else if (reply) detail = 'Imaging Records reported the receipt status in the transfer checklist.';
	else if (replyLines.length) detail = 'The imaging reply does not establish receipt of this study.';
	return { status: availability, accession, visitId: 'ED-082', date: '2026-09-04', owner, detail,
		url: availability === 'available' && accession ? '/samples/' + priorImageFilename + '?study=' + encodeURIComponent(accession) : null };
}

export function patientFileInventory(patient: Patient, documents: ChartDocument[], record: ClinicalState | null, uploadCount = 0, notice?: ImagingNotice | null): FileInventory {
	const expected = expectedChartDocuments.filter(doc => doc.patientId === patient.id);
	const available = documents.filter(doc => sameChart(doc, patient));
	const missingDocuments = expected.filter(expectedDoc => !available.some(doc => doc.id === expectedDoc.id &&
		doc.visitId === expectedDoc.visitId && doc.date === expectedDoc.date)).map(({id, title, visitId}) => ({id, title, visitId}));
	const additional = available.filter(doc => !expected.some(source => source.id === doc.id)).length;
	const hasImages = patient.id === chartPatient.id;
	const priorImage = hasImages ? priorComparisonImage(available, record, notice) : null;
	const total = expected.length + additional + uploadCount + (hasImages ? 2 : 0);
	return {
		date: new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()),
		expected: total, available: total - missingDocuments.length - (priorImage && !priorImage.url ? 1 : 0),
		missingDocuments, priorImage
	};
}
