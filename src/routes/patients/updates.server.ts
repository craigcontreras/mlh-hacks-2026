import { fail } from '@sveltejs/kit';
import { requireAccountRole } from '../../lib/server/accounts';
import { packetStore, ReviewError } from '../../lib/server/store';
import type { Actions } from './$types';
import { prepareBrief } from './chart-brief.server';
import { fileAttachments } from './file-attachments.server';

export const actions: Actions = {
	prepareBrief, fileAttachments,
	receiveImagingDelivery: async ({ locals, request, url }) => {
		requireAccountRole(locals, 'Administrative staff');
		const patientId = url.searchParams.get('patient') ?? '';
		const form = await request.formData();
		const version = form.get('version');
		const accession = form.get('accession');
		const visitId = form.get('visitId');
		if (typeof version !== 'string' || typeof accession !== 'string' || typeof visitId !== 'string') {
			return fail(400, { patientId, deliveryError: 'Reload the chart and check the open study request.' });
		}
		try {
			packetStore().clinical.receiveImagingDelivery(version, { patientId, accession, visitId });
			return { patientId, deliveryRecorded: true };
		} catch (error) {
			return fail(error instanceof ReviewError ? error.status : 503, {
				patientId, deliveryError: error instanceof ReviewError ? error.message : 'Could not file the incoming study. Try again.'
			});
		}
	},
	addUpdate: async ({ locals, request, url }) => {
		const author = requireAccountRole(locals, 'Administrative staff');
		const fields = await request.formData();
		const patientId = url.searchParams.get('patient') ?? '';
		const visitId = fields.get('visitId');
		const updateText = fields.get('updateText');
		const requestId = fields.get('requestId');
		if (!patientId || typeof visitId !== 'string' || typeof updateText !== 'string' || typeof requestId !== 'string') {
			return fail(400, { patientId, updateError: 'Select a patient and visit, then enter an update.' });
		}
		try {
			packetStore().patients.addCoordinationUpdate(patientId, visitId, updateText, author, requestId);
		} catch (error) {
			const message = error instanceof ReviewError ? error.message : 'Could not save the update. Please try again.';
			return fail(error instanceof ReviewError ? error.status : 503, {
				patientId, visitId, updateText: updateText.slice(0, 1000), requestId, updateError: message
			});
		}
		return { patientId, saved: true };
	}
};
