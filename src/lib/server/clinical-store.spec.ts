import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clinicalDocument, verifyClinicalSummary } from './clinical-summary';
import { parsePacket } from './extraction';
import { fixtures } from './fixtures';
import { PacketStore } from './store';

const sourceText = clinicalDocument.text;
const summary = verifyClinicalSummary(sourceText, 'local');

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

	it('records one doctor-to-doctor sign-off across duplicate requests and reopening', () => {
		const clinical = store.clinical;
		const initial = clinical.version();
		const draft = clinical.saveSummary(initial, summary, 4, sourceText);
		expect(clinical.saveSummary(initial, summary, 4, sourceText)).toEqual(draft);
		expect(() => clinical.saveSummary(initial, summary, 5, sourceText)).toThrow(/changed/);
		const sent = clinical.approve(draft.version, 'Doctor', 'review-report');
		expect(sent).toMatchObject({
			status: 'sent', elapsedMs: 4, sourceText,
			history: [{ recipient: 'Doctor', signedBy: 'Reviewing doctor', taskId: 'review-report', acknowledgedAt: null }]
		});
		store.close();
		store = new PacketStore(path);
		expect(store.clinical.approve(draft.version, 'Doctor', 'review-report')).toEqual(sent);
		expect(() => store.clinical.approve(draft.version, 'Administrative staff', 'review-report')).toThrow(/changed/);
		expect(() => store.clinical.saveSummary(sent.version, summary, 4, sourceText + '\n')).toThrow(/read-only/);
		expect(store.clinical.get()).toEqual(sent);
	});

	it('validates reviewing roles and documented tasks, and blocks a draft with extraction issues', () => {
		const clinical = store.clinical;
		const draft = clinical.saveSummary(clinical.version(), summary, 8, sourceText);
		expect(() => clinical.approve(draft.version, 'Nurse' as never, 'review-report')).toThrow(/reviewing role/);
		expect(() => clinical.approve(draft.version, 'Doctor', 'invented-task')).toThrow(/documented task/);
		expect(() => clinical.acknowledge(draft.version, 'Doctor')).toThrow(/active handoff/);
		expect(clinical.get()).toEqual(draft);
		const blocked = clinical.saveSummary(draft.version, { ...summary, issues: ['Unverified source.'] }, 9, sourceText);
		expect(() => clinical.approve(blocked.version, 'Administrative staff', 'check-images')).toThrow(/extraction issues/);
		expect(clinical.get()).toEqual(blocked);
	});

	it('allows the current recipient alone to acknowledge and forward the unused assignment', () => {
		const clinical = store.clinical;
		const draft = clinical.saveSummary(clinical.version(), summary, 4, sourceText);
		const sent = clinical.approve(draft.version, 'Administrative staff', 'review-report');
		expect(() => clinical.acknowledge(sent.version, 'Administrative staff' as never)).toThrow(/receiving role/);
		expect(() => clinical.acknowledge(sent.version, 'Nurse')).toThrow(/active handoff/);
		expect(() => clinical.forward(sent.version, 'Nurse', 'check-images')).toThrow(/active handoff/);
		expect(() => clinical.forward(sent.version, 'Doctor', 'review-report')).toThrow(/already sent/);
		const acknowledged = clinical.acknowledge(sent.version, 'Doctor');
		expect(acknowledged.status).toBe('acknowledged');
		expect(acknowledged.history[0].acknowledgedAt).toBeTypeOf('string');
		expect(clinical.acknowledge(sent.version, 'Doctor')).toEqual(acknowledged);

		const forwarded = clinical.forward(acknowledged.version, 'Doctor', 'check-images');
		expect(clinical.forward(acknowledged.version, 'Doctor', 'check-images')).toEqual(forwarded);
		expect(forwarded.status).toBe('sent');
		expect(forwarded.sourceText).toBe(sourceText);
		expect(forwarded.history[0]).toEqual(acknowledged.history[0]);
		expect(forwarded.history[1]).toMatchObject({
			taskId: 'check-images', recipient: 'Nurse', signedBy: 'Receiving doctor', acknowledgedAt: null
		});
		expect(() => clinical.acknowledge(forwarded.version, 'Doctor')).toThrow(/active handoff/);
		expect(() => clinical.forward(forwarded.version, 'Nurse', 'review-report')).toThrow(/already sent/);
		const nurseReceived = clinical.acknowledge(forwarded.version, 'Nurse');
		expect(nurseReceived.history[1].acknowledgedAt).toBeTypeOf('string');
		expect(clinical.get()).toEqual(nurseReceived);
	});

	it('preserves the draft after a failed write and allows one successful sign-off retry', () => {
		const clinical = store.clinical;
		const draft = clinical.saveSummary(clinical.version(), summary, 12, sourceText);
		const admin = new DatabaseSync(path);
		try {
			admin.exec("CREATE TRIGGER fail_handoff BEFORE UPDATE ON clinical_handoff BEGIN SELECT RAISE(ABORT, 'test write failure'); END;");
			expect(() => clinical.approve(draft.version, 'Doctor', 'review-report')).toThrow(/test write failure/);
			expect(clinical.get()).toEqual(draft);
			admin.exec('DROP TRIGGER fail_handoff');
		} finally {
			admin.close();
		}
		const sent = clinical.approve(draft.version, 'Doctor', 'review-report');
		expect(clinical.approve(draft.version, 'Doctor', 'review-report')).toEqual(sent);
		expect(sent.history).toHaveLength(1);
	});

	it('resets only the clinical chain and invalidates extraction started before reset', () => {
		store.saveDraft('corrected', '', parsePacket(fixtures.corrected));
		const clinical = store.clinical;
		const initial = clinical.version();
		const draft = clinical.saveSummary(initial, summary, 4, sourceText);
		const sent = clinical.approve(draft.version, 'Doctor', 'review-report');
		clinical.reset(sent.version);
		const resetVersion = clinical.version();
		clinical.reset(sent.version);
		expect(clinical.version()).toBe(resetVersion);
		expect(clinical.get()).toBeNull();
		expect(store.get('corrected')).toBeTruthy();
		expect(() => clinical.saveSummary(initial, summary, 4, sourceText)).toThrow(/changed/);
		expect(() => clinical.acknowledge(sent.version, 'Doctor')).toThrow(/changed/);
		expect(clinical.saveSummary(resetVersion, summary, 4, sourceText).history).toEqual([]);
	});
});
