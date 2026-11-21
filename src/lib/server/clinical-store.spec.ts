import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { demoAccounts } from './accounts';
import { chartDocuments, clinicalDocument, practiceDocuments, practiceReplyEvidence } from './chart';
import { prepareClinicalChart, verifyChartSummary } from './clinical-summary';
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

	// Reopen the same SQLite file with a known practice outcome instead of relying on random selection.
	function openPractice(status: 'arrived' | 'unable-to-confirm' | 'still-pending') {
		store.close();
		const db = new DatabaseSync(path);
		try {
			db.prepare('UPDATE clinical_handoff SET data=NULL, imaging_notice=NULL, practice=?, last_request=NULL WHERE singleton=1')
				.run(JSON.stringify({ accession: 'MB-082-508', status }));
		} finally { db.close(); }
		store = new PacketStore(path);
		return store.clinical;
	}

	it('assigns verified pending images to the nurse exactly once without a staff signature or observation', () => {
		const initial = store.clinical.snapshot();
		expect(initial.record).toMatchObject({
			status: 'sent', flow: 'admin-nurse-doctor', sourceText,
			history: [{ recipient: 'Nurse', recipientAccountId: nurse.id, assignmentOrigin: 'automatic',
				signedBy: 'Intake Desk', taskId: 'check-images', acknowledgedAt: null }]
		});
		expect(initial.record!.history).toHaveLength(1);
		expect(initial.record!.history[0].signedByAccountId).toBeUndefined();
		expect(initial.record!.imageStatus).toBeUndefined();
		store.close();
		store = new PacketStore(path);
		expect(store.clinical.snapshot()).toEqual(initial);
		expect(() => store.clinical.approve(initial.version, admin, 'check-images')).toThrow(/draft/);
		expect(() => store.clinical.saveSummary(initial.version, summary, 4, sourceText)).toThrow(/read-only/);
		expect(store.clinical.get()).toEqual(initial.record);
	});

	it('migrates an unsigned verified draft once and keeps its notes and verified summary', () => {
		const draft = { status: 'draft', sourceText, summary, history: [], elapsedMs: 17,
			operationalNotes: [{ id: 'existing-note', visitId: 'ED-104', text: 'Call via the intake office.',
				savedBy: admin.name, savedByAccountId: admin.id, savedAt: '2026-11-21T13:00:00Z' }]
		};
		store.close();
		const legacy = new DatabaseSync(path);
		try { legacy.prepare('UPDATE clinical_handoff SET version=?, data=?').run('old-version', JSON.stringify(draft)); }
		finally { legacy.close(); }
		store = new PacketStore(path);
		const assigned = store.clinical.get()!;
		expect(assigned).toMatchObject({ status:'sent', operationalNotes:draft.operationalNotes, elapsedMs:17, summary });
		expect(assigned.history[0]).toMatchObject({ assignmentOrigin:'automatic', recipientAccountId:nurse.id });
		expect(() => store.clinical.approve('old-version', admin, 'check-images')).toThrow(/changed/);
	});

	it('holds the nursing handoff when a saved transcript differs from its matching PDF', () => {
		const sources = chartDocuments.map(doc => doc.id === 'ED-104-radiology' ? { ...doc, text: doc.text + '\n' } : doc);
		const draft = { status: 'draft', sourceText, sources, summary: verifyChartSummary(sources, 'local'),
			history: [], elapsedMs: 4 };
		expect(draft.summary.issues).toEqual([]);
		store.close();
		const existing = new DatabaseSync(path);
		try { existing.prepare('UPDATE clinical_handoff SET data=?').run(JSON.stringify(draft)); }
		finally { existing.close(); }
		store = new PacketStore(path);
		expect(store.clinical.get()).toMatchObject({ status: 'draft', history: [] });
	});

	it('validates reviewing roles and documented tasks, and blocks a draft with extraction issues', () => {
		const clinical = openPractice('unable-to-confirm');
		const docs = clinical.snapshot().chart.documents;
		const unclear = verifyChartSummary(docs, 'local');
		const draft = clinical.saveSummary(clinical.version(), unclear, 8, sourceText, docs);
		expect(() => clinical.approve(draft.version, nurse, 'review-report')).toThrow(/triage agent/);
		expect(() => clinical.approve(draft.version, admin, 'invented-task')).toThrow(/documented image-status task/);
		expect(() => clinical.approve(draft.version, admin, 'review-report')).toThrow(/Nurse first/);
		expect(() => clinical.acknowledge(draft.version, doctor)).toThrow(/active handoff/);
		expect(clinical.get()).toEqual(draft);
		const blocked = clinical.saveSummary(draft.version, { ...unclear, issues: ['Unverified source.'] }, 9, sourceText, docs);
		expect(() => clinical.approve(blocked.version, admin, 'check-images')).toThrow(/extraction issues/);
		expect(clinical.get()).toEqual(blocked);
	});

	it('preserves the assigned nurse’s image observation when routing to the doctor', () => {
		const clinical = store.clinical;
		const sent = clinical.get()!;
		expect(() => clinical.acknowledge(sent.version, admin)).toThrow(/receiving role/);
		expect(() => clinical.acknowledge(sent.version, doctor)).toThrow(/active handoff/);
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
		const draft = clinical.get()!;
		expect(() => clinical.saveNote(draft.version, doctor, 'ED-104', 'Coordination note')).toThrow(/triage agent/);
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
		const checked = clinical.recordImageStatus(planned.version, nurse, 'unable-to-confirm');
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
		expect(reassigned.summary).toEqual({ ...summary, pdfInput: 'verified-transcripts' });
		expect(clinical.get()).toEqual(reassigned);
	});

	it.each(['still-pending', 'unable-to-confirm', 'arrived'] as const)('opens and closes the remaining image check when the signed review starts with %s', initial => {
		const workflow = store.clinical;
		const assigned = workflow.get()!;
		const noted = workflow.recordImageStatus(assigned.version, nurse, initial);
		const forwarded = workflow.forward(noted.version, nurse, 'review-report');
		const signed = workflow.signReview(forwarded.version, doctor);
		if (initial === 'arrived') {
			expect(signed.imageFollowup).toBeUndefined();
			expect(() => workflow.updateImageFollowup(signed.version, nurse, 'arrived')).toThrow(/no open/);
			return;
		}
		expect(signed.imageFollowup).toMatchObject({ openedBy: doctor.name, recipientAccountId: nurse.id, initial: noted.imageStatus });
		expect(() => workflow.updateImageFollowup(signed.version, doctor, 'arrived')).toThrow(/requires the assigned nurse/);
		const pending = workflow.updateImageFollowup(signed.version, nurse, 'still-pending');
		expect(pending.imageFollowup?.resolvedAt).toBeUndefined();
		expect(workflow.updateImageFollowup(signed.version, nurse, 'still-pending')).toEqual(pending);
		const closed = workflow.updateImageFollowup(pending.version, nurse, 'arrived');
		expect(closed.history).toEqual(signed.history);
		expect(closed.imageStatus?.status).toBe('arrived');
		expect(closed.imageFollowup?.initial).toEqual(noted.imageStatus);
		expect(closed.imageFollowup?.observations.map(event => event.status)).toEqual(['still-pending', 'arrived']);
		expect(closed.imageFollowup?.resolvedAt).toEqual(expect.any(String));
		expect(() => workflow.updateImageFollowup(closed.version, nurse, 'still-pending')).toThrow(/no open/);
	});

	it.each([
		['review-report', 'Doctor', doctor, 'check-images', nurse],
		['check-images', 'Nurse', nurse, 'review-report', doctor]
	] as const)('preserves old %s assignments and resolves a single legacy account', (taskId, recipient, owner, nextTask, receiver) => {
		const clinical = store.clinical;
		const { version } = clinical.snapshot();
		const old = { sourceText, summary, elapsedMs: 3, status: 'sent', history: [{
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

	it('preserves the stored manual request and its evidence on a legacy draft', () => {
		const clinical = openPractice('unable-to-confirm');
		const docs = clinical.snapshot().chart.documents;
		const extracted = verifyChartSummary(docs, 'local');
		const draft = clinical.saveSummary(clinical.version(), extracted, 4, sourceText, docs);
		expect(() => clinical.requestPriorStudy(draft.version, doctor)).toThrow(/triage agent/);
		const queued = clinical.requestPriorStudy(draft.version, admin);
		expect(queued.status).toBe('draft');
		expect(queued.history).toEqual([]);
		expect(queued.priorStudyRequest).toMatchObject({
			...extracted.adminAction, requestedBy: admin.name, requestedByAccountId: admin.id, status: 'Queued for imaging records'
		});
		expect(queued.priorStudyRequest?.requestedAt).toBeTypeOf('string');
		expect(clinical.requestPriorStudy(draft.version, admin)).toEqual(queued);
		expect(clinical.requestPriorStudy(queued.version, admin)).toEqual(queued);
		expect(() => clinical.saveSummary(queued.version, extracted, 5, sourceText + '\n', docs)).toThrow(/already cites/);
		const sent = clinical.approve(queued.version, admin, 'check-images');
		expect(sent.priorStudyRequest).toEqual(queued.priorStudyRequest);
		expect(sent.sources).toEqual(docs);
	});

	it('preserves the draft after a failed write and allows one successful sign-off retry', () => {
		const clinical = openPractice('unable-to-confirm');
		const docs = clinical.snapshot().chart.documents;
		const draft = clinical.saveSummary(clinical.version(), verifyChartSummary(docs, 'local'), 12, sourceText, docs);
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
		const sent = clinical.get()!;
		clinical.reset(sent.version);
		const resetVersion = clinical.version();
		clinical.reset(sent.version);
		expect(clinical.version()).toBe(resetVersion);
		expect(clinical.get()?.history).toHaveLength(1);
		expect(clinical.get()?.history[0].id).not.toBe(sent.history[0].id);
		expect(store.get('corrected')).toBeTruthy();
		expect(() => clinical.saveSummary(initial, summary, 4, sourceText)).toThrow(/changed/);
		expect(() => clinical.acknowledge(sent.version, doctor)).toThrow(/changed/);
		expect(clinical.get()?.history[0].assignmentOrigin).toBe('automatic');
	});

	it('persists each new practice outcome, rejects stale writes and cites the same study throughout the workflow', async () => {
		const initial = store.clinical.version();
		expect(() => store.clinical.randomize(initial, nurse)).toThrow(/triage agent/);
		store.clinical.randomize(initial, admin);
		const first = store.clinical.snapshot();
		expect(Boolean(first.record)).toBe(first.practice!.status === 'still-pending');
		expect(first.practice).toBeTruthy();
		store.close();
		store = new PacketStore(path);
		const workflow = store.clinical;
		workflow.randomize(initial, admin);
		expect(workflow.snapshot()).toEqual(first);
		expect(() => workflow.reset(initial)).toThrow(/changed/);

		const reply = practiceReplyEvidence(first.chart.documents)!;
		const jordan = store.patients.view(nurse, null, '', false, 'J-104', first.practice);
		expect(jordan.timeline).toContainEqual(expect.objectContaining({
			title: 'Imaging Records reply', documentId: reply.documentId, line: reply.line, text: reply.quote, at: '2026-11-21T18:42:00.000Z'
		}));
		const casey = store.patients.view(nurse, null, '', false, 'C-116', first.practice);
		expect(casey.timeline.some(event => event.title === 'Imaging Records reply')).toBe(false);
		expect(casey.documents.every(doc => doc.patientId === 'C-116')).toBe(true);
		const { documents, summary: extracted } = await prepareClinicalChart('local', first.chart.documents);
		expect(extracted.issues).toEqual([]);
		expect(reply.quote).toContain(first.practice!.accession);
		expect(documents.find(doc => doc.id === 'ED-082-study')?.text).toContain(first.practice!.accession);
		expect(() => workflow.saveSummary(first.version, summary, 5, sourceText, chartDocuments)).toThrow(/current practice packet|read-only/);
		const assigned = first.record ?? workflow.approve(workflow.saveSummary(first.version, extracted, 5, sourceText, documents).version, admin, 'check-images');
		const observed = workflow.recordImageStatus(assigned.version, nurse, first.practice!.status);
		const sent = workflow.forward(observed.version, nurse, 'review-report');
		const signed = workflow.signReview(sent.version, doctor);
		expect(!!signed.imageFollowup).toBe(first.practice!.status !== 'arrived');
		workflow.randomize(signed.version, admin);
		const next = workflow.snapshot();
		expect(Boolean(next.record)).toBe(next.practice!.status === 'still-pending');
		expect(next.practice!.accession).not.toBe(first.practice!.accession);
		expect(next.practice!.status).not.toBe(first.practice!.status);
		expect(() => workflow.saveSummary(first.version, extracted, 5, sourceText, documents)).toThrow(/changed/);
		workflow.reset(next.version);
		expect(workflow.snapshot()).toMatchObject({ record: { status: 'sent' }, practice: null, chart: { documents: chartDocuments } });
	});

	it.each(['arrived', 'unable-to-confirm', 'still-pending'] as const)('uses the 13:42 %s reply to determine whether a new image request is available', status => {
		const docs = practiceDocuments({ accession: 'MB-082-508', status });
		const extracted = verifyChartSummary(docs, 'local');
		expect(extracted.issues).toEqual([]);
		expect(extracted.crossChecks).toContainEqual(expect.objectContaining({
			label: 'Imaging Records reply at 13:42', evidence: [practiceReplyEvidence(docs)]
		}));
		const workflow = openPractice(status);
		const state = workflow.snapshot();
		expect(state.imagingNotice.status).toBe({arrived: 'received', 'unable-to-confirm': 'needs-review', 'still-pending': 'requested'}[status]);
		if (status === 'still-pending') expect(state.record!.history[0].assignmentOrigin).toBe('automatic');
		else expect(state.record).toBeNull();

	});

	it('adds practice support to an older database without disturbing the active signed assignment', () => {
		const sent = store.clinical.forward(store.clinical.version(), nurse, 'review-report');
		store.close();
		const legacy = new DatabaseSync(path);
		try { legacy.exec('ALTER TABLE clinical_handoff DROP COLUMN practice'); } finally { legacy.close(); }
		store = new PacketStore(path);
		expect(store.clinical.snapshot()).toMatchObject({ record: sent, practice: null, version: sent.version });
		store.clinical.randomize(sent.version, admin);
		expect(store.clinical.snapshot().practice).toBeTruthy();
	});
});
