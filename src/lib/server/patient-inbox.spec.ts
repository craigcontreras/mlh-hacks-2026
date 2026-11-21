import { expect, test } from 'vitest';
import { demoAccounts } from './accounts';
import { inboxFor } from './patient-inbox';
import { PacketStore } from './store';

test('the nurse sees two separate patient rows, and retains access to the signed Casey receipt', () => {
	const store = new PacketStore(':memory:');
	const [, avery, nurse] = demoAccounts;
	try {
		const flow = store.clinical;
		const sent = flow.get()!;
		const inbox = inboxFor(nurse, store);
		expect(inbox.rows.map(row => [row.patientId,row.active])).toEqual([['J-104',true],['C-116',false]]);
		expect(inbox.rows[0].text).toBe('Earlier X-ray pending · Nursing check');
		expect(sent.history[0]).toMatchObject({recipientAccountId: nurse.id, signedBy: 'Intake Desk', assignmentOrigin: 'automatic'});
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
