import { fail, type Action } from '@sveltejs/kit';
import { requireAccount } from '../../lib/server/accounts';
import { MAX_UPLOAD_BYTES } from '../../lib/server/chart-attachments';
import { packetStore, ReviewError } from '../../lib/server/store';

export const fileAttachments = (async ({ locals, request, url }) => {
	const author = requireAccount(locals);
	const patientId = url.searchParams.get('patient') ?? '';
	if (!request.body || !request.headers.get('content-type')?.startsWith('multipart/form-data')) {
		return fail(400, { patientId, fileError: 'Choose the files to add to this visit.' });
	}
	try {
		let size = 0;
		const boundedBody = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				size += chunk.byteLength;
				if (size > MAX_UPLOAD_BYTES + 65536) throw new ReviewError('Choose files up to 10 MB in total.', 400);
				controller.enqueue(chunk);
			}
		}));
		const fields = await new Response(boundedBody, { headers: request.headers }).formData();
		const visitId = fields.get('visitId');
		const files = fields.getAll('files');
		if (typeof visitId !== 'string' || !files.every((file): file is File => file instanceof File)) {
			throw new ReviewError('Choose a visit and its files.', 400);
		}
		const filed = await packetStore().patients.fileAttachments(patientId, visitId, files, author);
		return { patientId, filed, uploadVisit: visitId };
	} catch (err) {
		if (err instanceof ReviewError) return fail(err.status, { patientId, fileError: err.message });
		if (err instanceof TypeError) return fail(400, { patientId, fileError: 'Could not read those files. Select them again and retry.' });
		return fail(503, { patientId, fileError: 'Could not save the files. Please try again.' });
	}
}) satisfies Action;
