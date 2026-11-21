import type { ChartDocument } from './server/chart';
import type { ChartPoint } from './server/chart-brief';
import type { ClinicalState } from './server/clinical-store';
import type { ImagingNotice } from './server/imaging-notice';
import type { PatientRegistry } from './server/patient-registry';

type View = ReturnType<PatientRegistry['view']>;
type Patient = NonNullable<View['patient']>;
type Action = {
	title: string;
	status: string;
	person: string;
	detail?: string;
	history?: string[];
	citation: { documentId: string; line: number };
	workspace?: Patient['workspace'];
	requestDetails?: boolean;
};
export type EvidenceMapRow = ChartPoint & { actions: Action[] };

function passage(documents: ChartDocument[], documentId: string, prefix: string) {
	const doc = documents.find(document => document.id === documentId);
	const index = doc?.text.split(/\r?\n/).findIndex(line => line.startsWith(prefix)) ?? -1;
	return index < 0 ? null : { documentId, line: index + 1 };
}

const imageLabels = {
	arrived: 'Images arrived',
	'still-pending': 'Still pending',
	'unable-to-confirm': 'Unable to confirm'
};

function handoffActions(id: string, documents: ChartDocument[], patient: Patient, record: ClinicalState | null): Action[] {
	const doctor = id === 'radiology';
	if (!doctor && id !== 'comparison-images') return [];
	const citation = passage(documents, 'ED-104', doctor ? 'Receiving doctor: Review' : 'Receiving nurse: Check');
	if (!citation) return [];

	const task = doctor ? 'review-report' : 'check-images';
	const assignments = record?.history.filter(item => item.taskId === task) ?? [];
	const event = assignments.at(-1);
	if (!doctor && !event) return [];
	const active = event && record?.history.at(-1)?.id === event.id;
	const workspace = patient.assignedToMe ? patient.workspace : null;
	const action: Action = {
		title: doctor ? 'Review the final X-ray report' : 'Check and record image receipt',
		status: 'Awaiting assignment',
		person: doctor ? 'Receiving doctor' : 'Receiving nurse',
		citation
	};

	if (assignments.length > 1 || event?.returned || event?.reviewed) {
		action.history = assignments.flatMap(item => {
			const entries = [item.signedBy + ' sent the assignment to ' + (item.recipientName ?? item.recipient) + '.'];
			if (item.returned) entries.push(item.returned.returnedBy + ' returned it. ' + item.returned.reason);
			if (item.reviewed) entries.push(item.reviewed.reviewedBy + ' signed the report review.');
			return entries;
		});
	}

	if (doctor && event?.reviewed) {
		return [{ ...action, status: 'Signed', person: event.reviewed.reviewedBy }];
	}
	if (event?.returned) {
		return [{
			...action, status: 'Awaiting reassignment', person: 'Administrative staff',
			detail: event.returned.returnedBy + ' returned the assignment. ' + event.returned.reason,
			workspace: active && record?.status === 'returned' ? workspace : null
		}];
	}
	if (!doctor && record?.imageFollowup) {
		const followup = record.imageFollowup;
		return [{
			...action, title: 'Follow up on image receipt',
			status: followup.resolvedAt ? 'Closed' : 'Follow-up open', person: followup.recipientName,
			detail: 'Opened by ' + followup.openedBy + ' after report sign-off.' +
				(record.imageStatus ? ' Latest observation: ' + imageLabels[record.imageStatus.status] + '.' : ''),
			workspace: followup.resolvedAt ? null : workspace
		}];
	}
	if (!doctor && record?.imageStatus) {
		return [{ ...action, status: 'Recorded', person: record.imageStatus.recordedBy,
			detail: imageLabels[record.imageStatus.status] + '.', workspace: active ? workspace : null }];
	}
	if (!event) return [action];
	return [{
		...action, status: active ? 'Assigned' : 'Previously assigned',
		person: event.recipientName ?? event.recipient,
		detail: event.reassignedFrom
			? event.signedBy + ' reassigned this review from ' + event.reassignedFrom.name + '.'
			: 'Sent by ' + event.signedBy + '.',
		workspace: active ? workspace : null
	}];
}

function priorStudyAction(documents: ChartDocument[], notice?: ImagingNotice | null): Action[] {
	if (!notice || !notice.evidence.length || !notice.evidence.every(ref => documents.some(doc =>
		doc.id === ref.documentId && doc.text.split(/\r?\n/)[ref.line - 1] === ref.quote))) return [];
	const reference = notice.evidence.find(ref => ref.quote.startsWith('Clerk instruction:')) ?? notice.evidence[0];
	const citation = { documentId: reference.documentId, line: reference.line };
	if (notice.status === 'needs-review') return [{
		title: 'Check the earlier study match', status: 'Needs review', person: notice.recipient,
		detail: notice.message, citation, requestDetails: true
	}];
	const requested = Boolean(notice.requestedAt && notice.requestedBy);
	return [{
		title: requested ? 'Request the earlier X-ray' : 'Link the earlier X-ray',
		status: notice.status === 'received' ? 'Image available' : 'Queued for Imaging Records',
		person: requested ? 'Requested by ' + notice.requestedBy : notice.recipient,
		detail: notice.message,
		citation, requestDetails: true
	}];
}

const recordedSteps: Record<string, { doc: string; prefix: string; title: string; status: string }> = {
	symptoms: { doc: 'ED-116-nursing', prefix: "Casey's question was passed", title: 'Pass the question to the doctor', status: 'Documented' },
	'physician-review': { doc: 'ED-116-physician', prefix: 'Casey and the attending physician reviewed', title: 'Discuss symptoms and going home', status: 'Signed' },
	'print-preference': { doc: 'ED-116-visit-receipt', prefix: 'A large-type printed copy', title: 'Provide large-type instructions', status: 'Delivered' },
	'paperwork-receipt': { doc: 'ED-116-receipt-check', prefix: 'Riley Ortiz verified', title: 'Verify delivery of the instructions', status: 'Closed' }
};

function recordedActions(id: string, documents: ChartDocument[]): Action[] {
	const step = recordedSteps[id];
	if (!step) return [];
	const citation = passage(documents, step.doc, step.prefix);
	const note = documents.find(document => document.id === step.doc);
	const signer = note?.text.match(/^(?:Signed|Recorded) by (.+?) \(fictional\)\./m)?.[1];
	if (!citation || !signer) return [];
	return [{ title: step.title, status: step.status, person: 'Recorded by ' + signer, citation }];
}

export function buildEvidenceMap(items: ChartPoint[], view: View, record: ClinicalState | null, notice?: ImagingNotice | null): EvidenceMapRow[] {
	const patient = view.patient;
	if (!patient) return [];
	const documents = view.documents.filter(document => document.patientId === patient.id);
	return items.flatMap(point => {
		if (!point.sources.length || !point.sources.every(source => documents.some(document =>
			document.id === source.documentId && document.visitId === source.visitId &&
			document.text.split(/\r?\n/)[source.line - 1] === source.quote))) return [];
		const actions = view.hasTransfer ? handoffActions(point.id, documents, patient, record)
			: recordedActions(point.id, documents);
		if (view.hasTransfer && point.id === 'comparison-images') actions.push(...priorStudyAction(documents, notice));
		return [{ ...point, actions }];
	});
}
