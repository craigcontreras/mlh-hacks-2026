import type { ClinicalState } from './server/clinical-store';

export interface PatientEvent {
	id: string;
	at: string;
	visitId: string;
	title: string;
	text: string;
	source: string;
	documentId: string | null;
	line: number | null;
}

export function clinicalActivity(record: ClinicalState, currentVisit: string): PatientEvent[] {
	const events: PatientEvent[] = [];
	function add(id: string, at: string, title: string, source: string, text: string, visitId = currentVisit) {
		events.push({ id, at, title, source, text, visitId, documentId: null, line: null });
	}
	for (const item of record.history) {
		const automatic = item.assignmentOrigin === 'automatic';
		add(item.id, item.sentAt, automatic ? 'Image check assigned automatically' : 'Assignment routed', item.signedBy,
			automatic ? 'Intake Desk assigned the pending X-ray check to ' + item.recipientName : item.signedBy + ' routed to ' + (item.recipientName ?? item.recipient));
		if (item.acknowledgedAt) {
			const name = item.acknowledgedBy ?? item.recipient;
			add(item.id + '-receipt', item.acknowledgedAt, 'Receipt acknowledged', name, name + ' acknowledged receipt');
		}
		if (item.returned) {
			const { returnedBy, returnedAt, reason } = item.returned;
			add(item.id + '-return', returnedAt, 'Assignment returned', returnedBy, returnedBy + ' returned the handoff to the triage agent · ' + reason);
		}
		if (item.reviewed) {
			const { reviewedBy, reviewedAt } = item.reviewed;
			add(item.id + '-review', reviewedAt, 'Report review signed', reviewedBy, reviewedBy + ' signed report review');
		}
	}
	for (const note of record.operationalNotes ?? []) {
		add(note.id, note.savedAt, 'Coordination note', note.savedBy, note.savedBy + ' saved a coordination note for ' + note.visitId + ' · ' + note.text, note.visitId);
	}
	for (const plan of record.carePlans ?? []) {
		const destination = [plan.receivingFacility || 'Facility unassigned', plan.doctorName || 'Doctor unassigned', plan.receivingDepartment, plan.priority && plan.priority !== 'unspecified' ? plan.priority + ' priority' : '', plan.impact].filter(Boolean).join(' · ');
		add(plan.id, plan.savedAt, 'Routing plan updated', plan.savedBy, plan.savedBy + ' updated the plan for ' + plan.visitId + ' · ' + destination, plan.visitId);
	}
	if (record.priorStudyRequest) {
		const { requestedBy, requestedAt, accession } = record.priorStudyRequest;
		add('request', requestedAt, 'Prior study requested', requestedBy, requestedBy + ' queued study ' + accession + ' for Imaging Records');
	}
	const initialImages = record.imageFollowup?.initial ?? record.imageStatus;
	if (initialImages) {
		const { recordedAt, recordedBy, status } = initialImages;
		add('images', recordedAt, 'Image status recorded', recordedBy, recordedBy + ' recorded image status · ' + status.replaceAll('-', ' '));
	}
	if (record.imageFollowup) {
		const followup = record.imageFollowup;
		add('image-followup', followup.openedAt, 'Image follow-up assigned', followup.openedBy, 'Check outstanding comparison images · ' + followup.recipientName);
		for (const item of followup.observations) {
			add(item.id, item.at, item.status === 'arrived' ? 'Image follow-up completed' : 'Image follow-up checked',
				item.by, item.by + ' recorded comparison images as ' + item.status.replaceAll('-', ' '));
		}
	}
	return events.sort((a, b) => b.at.localeCompare(a.at));
}
