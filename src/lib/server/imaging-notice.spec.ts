import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { demoAccounts } from './accounts';
import { chartDocuments, clinicalDocument, practiceDocuments } from './chart';
import { ClinicalStore } from './clinical-store';
import { verifyChartSummary } from './clinical-summary';
import { reconcileImagingNotice } from './imaging-notice';

test('ingest queues exactly once, matched delivery closes without a signed handoff and old rounds cannot receive it', () => {
	const db = new DatabaseSync(':memory:');
	try {
		const flow = new ClinicalStore(db);
		const initial = flow.snapshot();
		const receipt = { patientId: 'J-104', visitId: 'ED-104', accession: 'MB-082-LA' };
		expect(initial.record).toBeNull();
		expect(initial.imagingNotice).toMatchObject({ status: 'requested', recipient: 'Imaging Records', requestedBy: 'Intake Desk', accession: receipt.accession });
		expect(initial.imagingNotice.requestBody).toContain(receipt.accession);
		expect(initial.imagingNotice.evidence.every(ref => chartDocuments.find(doc => doc.id === ref.documentId)?.text.split('\n')[ref.line - 1] === ref.quote)).toBe(true);
		expect(new ClinicalStore(db).snapshot()).toEqual(initial);
		expect(() => flow.receiveImagingDelivery(initial.version, { ...receipt, accession: 'OTHER-STUDY' })).toThrow(/does not match/);
		expect(() => flow.receiveImagingDelivery(initial.version, { ...receipt, patientId: 'C-116' })).toThrow(/does not match/);
		const arrived = flow.receiveImagingDelivery(initial.version, receipt);
		expect(arrived).toMatchObject({ status: 'received', receivedVia: 'matched-delivery', requestedAt: initial.imagingNotice.requestedAt, requestBody: initial.imagingNotice.requestBody });
		expect(flow.receiveImagingDelivery(initial.version, receipt)).toEqual(arrived);
		expect(new ClinicalStore(db).snapshot()).toMatchObject({ record: null, imagingNotice: arrived });
		const draft = flow.saveSummary(flow.version(), verifyChartSummary(chartDocuments, 'local'), 1, clinicalDocument.text, chartDocuments);
		expect(flow.snapshot().imagingNotice).toEqual(arrived);
		expect(flow.receiveImagingDelivery(initial.version, receipt)).toEqual(arrived);
		flow.reset(draft.version);
		expect(flow.snapshot().imagingNotice).toMatchObject({ status: 'requested', receivedAt: null });
		expect(() => flow.receiveImagingDelivery(initial.version, receipt)).toThrow(/changed/);
	} finally { db.close(); }
});

test('an automatically requested file can stay open across nurse and doctor sign-off without a duplicate nurse chase', () => {
	const db = new DatabaseSync(':memory:');
	try {
		const [admin, doctor, nurse] = demoAccounts;
		const flow = new ClinicalStore(db);
		const draft = flow.saveSummary(flow.version(), verifyChartSummary(chartDocuments, 'local'), 1, clinicalDocument.text, chartDocuments);
		const assigned = flow.approve(draft.version, admin, 'check-images');
		const sent = flow.forward(assigned.version, nurse, 'review-report');
		const reviewed = flow.signReview(sent.version, doctor);
		expect(reviewed.imageStatus).toBeUndefined();
		expect(reviewed.imageFollowup).toBeUndefined();
		expect(flow.snapshot().imagingNotice.status).toBe('requested');
		const unresolved = practiceDocuments({accession: 'MB-082-147', status: 'unable-to-confirm'});
		flow.reset(reviewed.version);
		const unclear = flow.saveSummary(flow.version(), verifyChartSummary(unresolved, 'local'), 1, clinicalDocument.text, unresolved);
		const assignedUnclear = flow.approve(unclear.version, admin, 'check-images');
		expect(() => flow.forward(assignedUnclear.version, nurse, 'review-report')).toThrow(/unclear receipt/);
	} finally { db.close(); }
});

test.each(['before', 'after'])('receiving the requested asset %s sign-off keeps the nurse’s signed observation and resolves the record chase', timing => {
	const db = new DatabaseSync(':memory:');
	try {
		const [admin, doctor, nurse] = demoAccounts;
		const flow = new ClinicalStore(db);
		const receipt = {patientId: 'J-104', visitId: 'ED-104', accession: 'MB-082-LA'};
		const draft = flow.saveSummary(flow.version(), verifyChartSummary(chartDocuments, 'local'), 1, clinicalDocument.text, chartDocuments);
		const assigned = flow.approve(draft.version, admin, 'check-images');
		const observed = flow.recordImageStatus(assigned.version, nurse, 'still-pending');
		const sent = flow.forward(observed.version, nurse, 'review-report');
		if (timing === 'before') flow.receiveImagingDelivery(sent.version, receipt);
		const signed = flow.signReview(flow.version(), doctor);
		if (timing === 'after') {
			expect(signed.imageFollowup?.resolvedAt).toBeUndefined();
			const arrived = flow.receiveImagingDelivery(signed.version, receipt);
			const closed = flow.get()!.imageFollowup;
			expect(closed?.resolvedAt).toBe(arrived.receivedAt);
			expect(closed?.observations).toMatchObject([{status: 'arrived', by: 'Imaging Records', at: arrived.receivedAt}]);
		} else expect(signed.imageFollowup).toBeUndefined();
		expect(new ClinicalStore(db).get()).toMatchObject({status: 'reviewed', history: signed.history, imageStatus: observed.imageStatus});
		expect(() => flow.updateImageFollowup(flow.version(), nurse, 'arrived')).toThrow(/no open/);
	} finally { db.close(); }
});

test('confirmed receipt suppresses a fresh request, and ambiguous sources are held for review', () => {
	const now = new Date().toISOString();
	for (const status of ['arrived', 'unable-to-confirm', 'still-pending'] as const) {
		const docs = practiceDocuments({ accession: 'MB-082-147', status });
		const notice = reconcileImagingNotice(docs, null, null, now);
		expect(notice.status).toBe({ arrived: 'received', 'unable-to-confirm': 'needs-review', 'still-pending': 'requested' }[status]);
		expect(Boolean(notice.requestedAt)).toBe(status === 'still-pending');
		const mismatched = docs.map(doc => doc.id === 'ED-104-registration' ? { ...doc, text: doc.text.replace('link prior left ankle study MB-082-147', 'link prior left ankle study MB-082-XYZ') } : doc);
		expect(reconcileImagingNotice(mismatched, null, null, now)).toMatchObject({ status: 'needs-review', requestedAt: null });
		const duplicate = docs.map(doc => doc.id === 'ED-104-registration' ? { ...doc, text: doc.text + doc.text.split('\n').find(line => line.includes('Imaging Records reply:')) + '\n' } : doc);
		expect(reconcileImagingNotice(duplicate, null, null, now)).toMatchObject({ status: 'needs-review', requestedAt: null });
	}
});

test('upgrading an active signed packet preserves the original manual request, author and timestamp', () => {
	const db = new DatabaseSync(':memory:');
	try {
		const flow = new ClinicalStore(db);
		const draft = flow.saveSummary(flow.version(), verifyChartSummary(chartDocuments, 'local'), 2, clinicalDocument.text, chartDocuments);
		const queued = flow.requestPriorStudy(draft.version, demoAccounts[0]);
		const signed = flow.approve(queued.version, demoAccounts[0], 'check-images');
		db.exec('ALTER TABLE clinical_handoff DROP COLUMN imaging_notice');
		const migrated = new ClinicalStore(db).snapshot();
		expect(migrated.record).toEqual(signed);
		expect(migrated.imagingNotice).toMatchObject({ status: 'requested', requestedBy: demoAccounts[0].name,
			requestedAt: queued.priorStudyRequest!.requestedAt, requestBody: queued.priorStudyRequest!.text });
	} finally { db.close(); }
});
