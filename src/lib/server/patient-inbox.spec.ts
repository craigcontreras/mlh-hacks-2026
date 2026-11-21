import { expect, test } from 'vitest';
import { demoAccounts } from './accounts';
import { chartDocuments, clinicalDocument } from './chart';
import { verifyChartSummary } from './clinical-summary';
import { inboxFor } from './patient-inbox';
import { PacketStore } from './store';

test('the nurse sees two separate patient rows, and retains access to the signed Casey receipt', () => {
	const store = new PacketStore(':memory:');
	const [admin, avery, nurse] = demoAccounts;
	try {
		const flow = store.clinical;
		const prepared = flow.saveSummary(flow.version(), verifyChartSummary(chartDocuments, 'local'), 0, clinicalDocument.text, chartDocuments);
		const sent = flow.approve(prepared.version, admin, 'check-images');
		const inbox = inboxFor(nurse, store);
		expect(inbox.rows.map(row => [row.patientId,row.active])).toEqual([['J-104',true],['C-116',false]]);
		const receipt = inbox.completed[0];
		expect(receipt.document.text.split('\n')[receipt.completion.line! - 1]).toBe(receipt.completion.text);
		expect(receipt.completion.text).toContain('Riley Ortiz verified');
		expect(inboxFor(avery, store).rows).toEqual([]);
		const checked = flow.recordImageStatus(sent.version, nurse, 'still-pending');
		const doctor = flow.forward(checked.version, nurse, 'review-report');
		const signed = flow.signReview(doctor.version, avery);
		expect(inboxFor(nurse, store).rows[0].text).toBe('Check outstanding comparison images');
		expect(inboxFor(avery, store).rows[0].active).toBe(false);
		flow.updateImageFollowup(signed.version, nurse, 'arrived');
		expect(inboxFor(nurse, store).rows.every(row => !row.active)).toBe(true);
		expect(inboxFor(avery, store).rows.map(row => row.patientId)).toEqual(['J-104']);
	} finally { store.close(); }
});
