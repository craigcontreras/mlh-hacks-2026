import { documentOverviews, summarizeChartDocuments } from '../../../lib/server/chart-brief';
import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requireAccountRole } from '../../../lib/server/accounts';
import { chartPatient, clinicalDocument, practiceReplyEvidence } from '../../../lib/server/chart';
import { chartSnapshot, clinicalStore, plannedReportDoctor } from '../../../lib/server/clinical-store';
import { inboxFor } from '../../../lib/server/patient-inbox';
import { ReviewError } from '../../../lib/server/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const account = requireAccountRole(locals, 'Doctor', 'Nurse');
	const inbox = inboxFor(account);
	const patient = inbox.rows.find(item => item.patientId === params.patientId);
	if (!patient) error(404, 'This patient has no assignment in your inbox.');
	const archived = inbox.completed.filter(item => item.patientId === patient.patientId);
	const livePatient = patient.patientId === chartPatient.id;
	const record = livePatient ? inbox.record : null;
	const documents = record ? chartSnapshot(record).documents : archived.map(item => item.document);
	return {
		role: account.role, patient, record, deliveries: livePatient ? inbox.deliveries : [],
		nextDoctor: record && account.role === 'Nurse' && !inbox.followup ? plannedReportDoctor(record).name : null,
		followup: livePatient && inbox.followup, closedFollowup: livePatient ? inbox.closedFollowup : null,
		completions: archived.map(item => item.completion),
		overviews: documentOverviews({ id: patient.patientId, name: patient.name }, documents),
		packetPoints: record ? summarizeChartDocuments(chartPatient, documents).items : [],
		documents, practiceReply: practiceReplyEvidence(documents)
	};
};

type Command = 'acknowledge' | 'forward' | 'recordImageStatus' | 'signReview' | 'returnToAdmin' | 'followup';

function action(command: Command) {
	return async ({ locals, request, url, params }: RequestEvent) => {
		const account = command === 'recordImageStatus' || command === 'followup' ? requireAccountRole(locals, 'Nurse')
			: command === 'signReview' || command === 'returnToAdmin' ? requireAccountRole(locals, 'Doctor')
				: requireAccountRole(locals, 'Doctor', 'Nurse');
		const form = await request.formData();
		const legacyCase = url.searchParams.get('case') ?? form.get('caseId');
		if ((params.patientId && params.patientId !== chartPatient.id) || (legacyCase !== null && legacyCase !== clinicalDocument.id)) {
			error(404, 'This patient has no editable inbox assignment here.');
		}
		const version = form.get('version');
		if (typeof version !== 'string') return fail(400, { message: 'Open your inbox and try again.' });
		try {
			const store = clinicalStore();
			if (command === 'acknowledge') {
				store.acknowledge(version, account);
			} else if (command === 'forward') {
				const task = form.get('taskId');
				if (typeof task !== 'string') throw new ReviewError('Choose a documented action to forward.', 400);
				store.forward(version, account, task);
			} else if (command === 'recordImageStatus' || command === 'followup') {
				const imageStatus = form.get('imageStatus');
				if (typeof imageStatus !== 'string') throw new ReviewError('Choose a comparison image status.', 400);
				if (command === 'followup') store.updateImageFollowup(version, account, imageStatus);
				else store.recordImageStatus(version, account, imageStatus);
			} else if (command === 'signReview') {
				store.signReview(version, account);
			} else {
				const reason = form.get('reason');
				if (typeof reason !== 'string') throw new ReviewError('Explain why you are returning the assignment.', 400);
				store.returnToAdmin(version, account, reason);
			}
		} catch (error) {
			if (error instanceof ReviewError) return fail(error.status, { message: error.message });
			return fail(503, { message: 'Could not record this action. Reload the handoff and retry.' });
		}
		redirect(303, '/inbox/' + chartPatient.id);
	};
}

export const actions: Actions = {
	acknowledge: action('acknowledge'), forward: action('forward'), recordImageStatus: action('recordImageStatus'),
	signReview: action('signReview'), returnToAdmin: action('returnToAdmin'), followup: action('followup')
};
