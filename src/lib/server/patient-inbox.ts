import type { DemoAccount } from './accounts';
import { chartPatient, clinicalDocument } from './chart';
import { isAssignedTo } from './clinical-store';
import { packetStore } from './store';

export function inboxFor(account: DemoAccount, store = packetStore()) {
	const { record: state, imagingNotice } = store.clinical.snapshot();
	const last = state?.history.at(-1);
	const deliveries = state?.history.filter(item => isAssignedTo(item, account)) ?? [];
	const imageTask = state?.imageFollowup;
	const followup = !!imageTask && !imageTask.resolvedAt && imageTask.recipientAccountId === account.id;
	const closedFollowup = imageTask?.resolvedAt && imageTask.recipientAccountId === account.id
		? { at: imageTask.resolvedAt, by: imageTask.observations.findLast(item => item.status === 'arrived' && item.at === imageTask.resolvedAt)?.by ?? imageTask.recipientName } : null;
	const record = (isAssignedTo(last, account) && !last?.returned) || followup ? state : null;
	const completed = store.patients.completedAssignments(account);
	const rows: { patientId: string; name: string; visitId: string; active: boolean; text: string }[] = [];
	if (deliveries.length || followup) {
		const task = record?.summary.tasks.find(task => task.id === last?.taskId);
		const active = !!record && (followup || record.status !== 'reviewed');
		const text = followup ? 'Check outstanding comparison images' :
			active && last?.assignmentOrigin === 'automatic' && imagingNotice.status === 'requested' ? 'Earlier X-ray pending · Nursing check' :
			active && task?.id === 'check-images' && imagingNotice.status !== 'needs-review' ? 'Send the report for doctor review' :
			active ? task?.text ?? 'Review handoff' : closedFollowup ? 'Comparison images arrived' : record?.status === 'reviewed' ? 'Report review signed' : 'View your handoff history';
		rows.unshift({ patientId: chartPatient.id, name: chartPatient.name, visitId: clinicalDocument.visitId, active, text });
	}
	for (const {patientId,name,visitId,active,text} of completed) {
		if (!rows.some(row => row.patientId === patientId)) rows.push({patientId,name,visitId,active,text});
	}
	return { rows, completed, record, deliveries, followup, closedFollowup, imagingNotice };
}
