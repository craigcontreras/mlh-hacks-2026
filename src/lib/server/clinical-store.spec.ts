import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { demoAccounts } from './accounts';
import { chartDocuments, clinicalDocument } from './chart';
import { verifyChartSummary } from './clinical-summary';
import { documentedEncounters, isAssignedTo } from './clinical-store';
import { parsePacket } from './extraction';
import { fixtures } from './fixtures';
import { PacketStore } from './store';

const sourceText = clinicalDocument.text;
const summary = verifyChartSummary(chartDocuments, 'local');
const [admin, doctor, nurse, morgan] = demoAccounts;

describe('SQLite clinical handoffs', () => {
	let directory: string;
	let path: string;
	let store: PacketStore;

	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), 'intake-clinical-test-'));
		path = join(directory, 'demo.sqlite');
		store = new PacketStore(path);
	});

	afterEach(() => {
		store.close();
		rmSync(directory, { recursive: true, force: true });
	});

	it('records one named admin-to-nurse sign-off across duplicate requests and reopening', () => {
		const clinical = store.clinical;
		const initial = clinical.version();
		const draft = clinical.saveSummary(initial, summary, 4, sourceText);
		expect(clinical.saveSummary(initial, summary, 4, sourceText)).toEqual(draft);
		expect(() => clinical.saveSummary(initial, summary, 5, sourceText)).toThrow(/changed/);
		const sent = clinical.approve(draft.version, admin, 'check-images');
		expect(sent).toMatchObject({
			status: 'sent', flow: 'admin-nurse-doctor', elapsedMs: 4, sourceText,
			history: [{ recipient: 'Nurse', recipientAccountId: nurse.id, signedBy: admin.name, signedByAccountId: admin.id, taskId: 'check-images', acknowledgedAt: null }]
		});
		store.close();
		store = new PacketStore(path);
		expect(store.clinical.approve(draft.version, admin, 'check-images')).toEqual(sent);
		expect(() => store.clinical.approve(draft.version, admin, 'review-report')).toThrow(/changed/);
		expect(() => store.clinical.saveSummary(sent.version, summary, 4, sourceText + '\n')).toThrow(/read-only/);
		expect(store.clinical.get()).toEqual(sent);
	});

	it('validates reviewing roles and documented tasks, and blocks a draft with extraction issues', () => {
		const clinical = store.clinical;
		const draft = clinical.saveSummary(clinical.version(), summary, 8, sourceText);
		expect(() => clinical.approve(draft.version, nurse, 'review-report')).toThrow(/administrator/);
		expect(() => clinical.approve(draft.version, admin, 'invented-task')).toThrow(/documented image-status task/);
		expect(() => clinical.approve(draft.version, admin, 'review-report')).toThrow(/Nurse first/);
		expect(() => clinical.acknowledge(draft.version, doctor)).toThrow(/active handoff/);
		expect(clinical.get()).toEqual(draft);
		const blocked = clinical.saveSummary(draft.version, { ...summary, issues: ['Unverified source.'] }, 9, sourceText);
		expect(() => clinical.approve(blocked.version, admin, 'check-images')).toThrow(/extraction issues/);
		expect(clinical.get()).toEqual(blocked);
	});

	it('requires the assigned nurse to record image status before routing to the doctor', () => {
		const clinical = store.clinical;
		const draft = clinical.saveSummary(clinical.version(), summary, 4, sourceText);
		const sent = clinical.approve(draft.version, admin, 'check-images');
		expect(() => clinical.acknowledge(sent.version, admin)).toThrow(/receiving role/);
		expect(() => clinical.acknowledge(sent.version, doctor)).toThrow(/active handoff/);
		expect(() => clinical.forward(sent.version, nurse, 'review-report')).toThrow(/image status/);
		expect(() => clinical.recordImageStatus(sent.version, doctor, 'arrived')).toThrow(/assigned nurse/);
		expect(() => clinical.recordImageStatus(sent.version, nurse, 'received')).toThrow(/valid comparison image status/);
		const acknowledged = clinical.acknowledge(sent.version, nurse);
		expect(acknowledged.status).toBe('acknowledged');
		expect(acknowledged.history[0].acknowledgedAt).toBeTypeOf('string');
		expect(acknowledged.history[0]).toMatchObject({ acknowledgedBy: nurse.name, acknowledgedByAccountId: nurse.id });
		expect(clinical.acknowledge(sent.version, nurse)).toEqual(acknowledged);
		const checked = clinical.recordImageStatus(acknowledged.version, nurse, 'still-pending');
		expect(checked.imageStatus).toMatchObject({ status: 'still-pending', recordedBy: nurse.name });
		const forwarded = clinical.forward(checked.version, nurse, 'review-report');
		expect(clinical.forward(checked.version, nurse, 'review-report')).toEqual(forwarded);
		expect(forwarded.status).toBe('sent');
		expect(forwarded.sourceText).toBe(sourceText);
		expect(forwarded.history[0]).toEqual(acknowledged.history[0]);
		expect(forwarded.history[1]).toMatchObject({
			taskId: 'review-report', recipient: 'Doctor', recipientAccountId: doctor.id,
			signedBy: nurse.name, signedByAccountId: nurse.id, acknowledgedAt: null
		});
		expect(() => clinical.acknowledge(forwarded.version, nurse)).toThrow(/active handoff/);
		expect(() => clinical.signReview(forwarded.version, morgan)).toThrow(/active handoff/);
		const signed = clinical.signReview(forwarded.version, doctor);
		expect(signed.status).toBe('reviewed');
		expect(signed.history[1]).toMatchObject({ acknowledgedAt: null, reviewed: { reviewedBy: doctor.name } });
		expect(clinical.signReview(forwarded.version, doctor)).toEqual(signed);
		expect(() => clinical.returnToAdmin(signed.version, doctor, 'No longer assigned')).toThrow(/active handoff/);
		expect(clinical.get()).toEqual(signed);
	});

	it('preserves audited plans, notes and chart evidence while returning and reassigning a doctor', () => {
		const clinical = store.clinical;
		const draft = clinical.saveSummary(clinical.version(), summary, 4, sourceText, chartDocuments);
		expect(() => clinical.saveNote(draft.version, doctor, 'ED-104', 'Coordination note')).toThrow(/administrator/);
		expect(() => clinical.saveCarePlan(draft.version, admin, 'ED-999', 'doctor', 'External facility')).toThrow(/documented visit/);
		expect(() => clinical.saveCarePlan(draft.version, admin, 'ED-104', 'nurse', 'External facility')).toThrow(/doctor account/);
		const noted = clinical.saveNote(draft.version, admin, 'ED-104', 'Verify the contact channel.');
		const prior = clinical.saveCarePlan(noted.version, admin, 'ED-082', 'doctor', 'Mossbridge Community Hospital');
		const planned = clinical.saveCarePlan(prior.version, admin, 'ED-104', 'doctor-morgan', 'Alder Crossing',
			'urgent', 'Arrange callback', 'Emergency Department');
		expect(() => clinical.saveNote(prior.version, admin, 'ED-104', 'Stale note')).toThrow(/changed/);
		expect(planned.operationalNotes).toMatchObject([{ text: 'Verify the contact channel.', savedBy: admin.name }]);
		expect(planned.carePlans).toMatchObject([
			{ visitId: 'ED-082', doctorId: doctor.id },
			{ visitId: 'ED-104', doctorId: morgan.id, receivingFacility: 'Alder Crossing', priority: 'urgent',
				impact: 'Arrange callback', receivingDepartment: 'Emergency Department', savedBy: admin.name }
		]);
		const sent = clinical.approve(planned.version, admin, 'check-images');
		const checked = clinical.recordImageStatus(sent.version, nurse, 'unable-to-confirm');
		const forwarded = clinical.forward(checked.version, nurse, 'review-report');
		expect(isAssignedTo(forwarded.history.at(-1), morgan)).toBe(true);
		expect(isAssignedTo(forwarded.history.at(-1), doctor)).toBe(false);
		expect(() => clinical.returnToAdmin(forwarded.version, doctor, 'Please reroute')).toThrow(/active handoff/);
		const returned = clinical.returnToAdmin(forwarded.version, morgan, 'Please reroute');
		expect(returned.history[1]).toMatchObject({ acknowledgedAt: null, returned: { reason: 'Please reroute', returnedBy: morgan.name } });
		expect(returned.history[1].reviewed).toBeUndefined();
		expect(() => clinical.reassign(returned.version, admin, morgan.id)).toThrow(/different doctor/);
		const reassigned = clinical.reassign(returned.version, admin, doctor.id);
		expect(reassigned.history[2]).toMatchObject({
			recipientAccountId: doctor.id, recipientName: doctor.name,
			reassignedFrom: { accountId: morgan.id, name: morgan.name, assignmentId: returned.history[1].id }
		});
		expect(reassigned.carePlans?.slice(0, -1)).toEqual(planned.carePlans);
		expect(reassigned.carePlans?.at(-1)).toMatchObject({
			doctorId: doctor.id, priority: 'urgent', impact: 'Arrange callback', receivingDepartment: 'Emergency Department'
		});
		expect(reassigned.sources).toEqual(chartDocuments);
		expect(reassigned.summary).toEqual(summary);
		expect(clinical.get()).toEqual(reassigned);
	});

	it.each([
		['review-report', 'Doctor', doctor, 'check-images', nurse],
		['check-images', 'Nurse', nurse, 'review-report', doctor]
	] as const)('preserves old %s assignments and resolves a single legacy account', (taskId, recipient, owner, nextTask, receiver) => {
		const clinical = store.clinical;
		const { version, ...draft } = clinical.saveSummary(clinical.version(), summary, 3, sourceText);
		const old = { ...draft, status: 'sent', history: [{
			id: 'legacy-event', taskId, recipient, signedBy: admin.name,
			sentAt: '2026-11-21T12:00:00Z', acknowledgedAt: null
		}] };
		const fixtureDb = new DatabaseSync(path);
		try { fixtureDb.prepare('UPDATE clinical_handoff SET data=? WHERE singleton=1').run(JSON.stringify(old)); }
		finally { fixtureDb.close(); }
		expect(() => clinical.forward(version, morgan, nextTask)).toThrow(/active handoff/);
		const legacyForward = clinical.forward(version, owner, nextTask);
		expect(legacyForward.history[0]).toEqual(old.history[0]);
		expect(legacyForward.history[1]).toMatchObject({ recipientAccountId: receiver.id, signedByAccountId: owner.id });
	});

	it('shows only exact documented activities with source lines in the recorded care path', () => {
		const recorded = documentedEncounters(chartDocuments);
		expect(recorded).toHaveLength(3);
		expect(recorded[0]).toMatchObject({ visitId: 'ED-082', clinician: null });
		expect(recorded[2]).toMatchObject({ visitId: 'ED-104', clinician: 'Quinn Moss, MD', description: 'Signed the final radiology report' });
		for (const { evidence } of recorded) {
			expect(chartDocuments.find((doc) => doc.id === evidence.documentId)?.text.split('\n')[evidence.line - 1]).toBe(evidence.quote);
		}
	});

	it('queues the validated study independently from a handoff and preserves its evidence on approval', () => {
		const clinical = store.clinical;
		const draft = clinical.saveSummary(clinical.version(), summary, 4, sourceText, chartDocuments);
		expect(() => clinical.requestPriorStudy(draft.version, doctor)).toThrow(/administrator/);
		const queued = clinical.requestPriorStudy(draft.version, admin);
		expect(queued.status).toBe('draft');
		expect(queued.history).toEqual([]);
		expect(queued.priorStudyRequest).toMatchObject({
			...summary.adminAction, requestedBy: admin.name, requestedByAccountId: admin.id, status: 'Queued for imaging records'
		});
		expect(queued.priorStudyRequest?.requestedAt).toBeTypeOf('string');
		expect(clinical.requestPriorStudy(draft.version, admin)).toEqual(queued);
		expect(clinical.requestPriorStudy(queued.version, admin)).toEqual(queued);
		expect(() => clinical.saveSummary(queued.version, summary, 5, sourceText + '\n', chartDocuments)).toThrow(/already cites/);
		const sent = clinical.approve(queued.version, admin, 'check-images');
		expect(sent.priorStudyRequest).toEqual(queued.priorStudyRequest);
		expect(sent.sources).toEqual(chartDocuments);
	});

	it('preserves the draft after a failed write and allows one successful sign-off retry', () => {
		const clinical = store.clinical;
		const draft = clinical.saveSummary(clinical.version(), summary, 12, sourceText);
		const faultDb = new DatabaseSync(path);
		try {
			faultDb.exec("CREATE TRIGGER fail_handoff BEFORE UPDATE ON clinical_handoff BEGIN SELECT RAISE(ABORT, 'test write failure'); END;");
			expect(() => clinical.approve(draft.version, admin, 'check-images')).toThrow(/test write failure/);
			expect(clinical.get()).toEqual(draft);
			faultDb.exec('DROP TRIGGER fail_handoff');
		} finally {
			faultDb.close();
		}
		const sent = clinical.approve(draft.version, admin, 'check-images');
		expect(clinical.approve(draft.version, admin, 'check-images')).toEqual(sent);
		expect(sent.history).toHaveLength(1);
	});

	it('resets only the clinical chain and invalidates extraction started before reset', () => {
		store.saveDraft('corrected', '', parsePacket(fixtures.corrected));
		const clinical = store.clinical;
		const initial = clinical.version();
		const draft = clinical.saveSummary(initial, summary, 4, sourceText);
		const sent = clinical.approve(draft.version, admin, 'check-images');
		clinical.reset(sent.version);
		const resetVersion = clinical.version();
		clinical.reset(sent.version);
		expect(clinical.version()).toBe(resetVersion);
		expect(clinical.get()).toBeNull();
		expect(store.get('corrected')).toBeTruthy();
		expect(() => clinical.saveSummary(initial, summary, 4, sourceText)).toThrow(/changed/);
		expect(() => clinical.acknowledge(sent.version, doctor)).toThrow(/changed/);
		expect(clinical.saveSummary(resetVersion, summary, 4, sourceText).history).toEqual([]);
	});
});
