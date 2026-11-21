import { chartPatient, imagingReplyStatus, matchesChartIdentity, practiceReplyEvidence, reconcileChart, type ChartDocument, type ChartEvidence } from './chart';
import type { ClinicalState } from './clinical-store';
import { priorComparisonImage } from './file-inventory';

export interface ImagingNotice {
	status: 'requested' | 'received' | 'needs-review';
	recipient: 'Imaging Records';
	accession: string | null;
	message: string;
	evidence: ChartEvidence[];
	requestBody: string | null;
	requestedAt: string | null;
	requestedBy: string | null;
	receivedAt: string | null;
	receivedVia: 'matched-delivery' | 'source-reply' | 'staff-observation' | null;
	deliveryVersion?: string;
}

export function reconcileImagingNotice(documents: ChartDocument[], record: ClinicalState | null,
	previous: ImagingNotice | null, now: string): ImagingNotice {
	const notice: ImagingNotice = {
		status: 'needs-review', recipient: 'Imaging Records', accession: null,
		message: 'Check the patient, study ID and source documents before requesting the earlier images.',
		evidence: [], requestBody: null, requestedAt: null, requestedBy: null, receivedAt: null, receivedVia: null
	};
	if (!matchesChartIdentity(documents)) return notice;
	const prior = priorComparisonImage(documents, record);
	const accession = prior.accession;
	if (!accession) return notice;
	notice.accession = accession;
	const parsed = reconcileChart(documents, 'local');
	const reply = practiceReplyEvidence(documents);
	const replies = documents.find(doc => doc.id === 'ED-104-registration')!.text.split(/\r?\n/).filter(line => line.includes('Imaging Records reply:'));
	const action = parsed.adminAction;
	const comparison = parsed.crossChecks?.find(check => check.label === 'Comparison images at transfer');
	notice.evidence = [...(action?.evidence ?? comparison?.evidence ?? []), ...(reply ? [reply] : [])];
	const saved = previous?.accession === accession ? previous : null;
	const legacy = record?.priorStudyRequest?.accession === accession ? record.priorStudyRequest : null;
	notice.requestedAt = saved?.requestedAt ?? legacy?.requestedAt ?? null;
	notice.requestedBy = saved?.requestedBy ?? legacy?.requestedBy ?? null;
	const body = 'Please send the earlier left ankle X-ray for study ' + accession + ' to visit ED-104 for ' + chartPatient.name + '.';
	notice.requestBody = saved?.requestBody ?? legacy?.text ?? (notice.requestedAt ? body : null);
	if (saved?.requestedAt) notice.evidence = saved.evidence;
	if (saved?.receivedVia !== 'matched-delivery' && (parsed.issues.length || replies.length > 1 ||
		(replies.length && (!reply || !imagingReplyStatus(reply.quote, accession))))) return notice;
	if (saved?.receivedVia === 'matched-delivery' || prior.status === 'available') {
		notice.status = 'received';
		notice.receivedVia = saved?.receivedVia === 'matched-delivery' ? 'matched-delivery'
			: record?.imageStatus?.status === 'arrived' ? 'staff-observation' : 'source-reply';
		notice.receivedAt = (saved?.receivedVia === notice.receivedVia && saved.receivedAt) ||
			(notice.receivedVia === 'staff-observation' && record?.imageStatus?.recordedAt) || now;
		if (saved?.deliveryVersion !== undefined) notice.deliveryVersion = saved.deliveryVersion;
		notice.message = 'The earlier images for study ' + accession + ' are available in Jordan’s chart.';
		return notice;
	}
	if (prior.status !== 'pending' || !action || action.accession !== accession) {
		notice.message = 'Receipt of study ' + accession + ' is unclear. Check the source before sending a request.';
		return notice;
	}
	notice.status = 'requested';
	notice.requestedAt ??= now;
	notice.requestedBy ??= 'Intake Desk';
	notice.requestBody ??= body;
	notice.message = notice.requestBody;
	return notice;
}
