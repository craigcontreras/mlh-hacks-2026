import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { demoAccounts } from './accounts';
import { chartDocuments, clinicalDocument } from './chart';
import { verifyChartSummary } from './clinical-summary';
import { PacketStore } from './store';

const [admin, avery, riley, morgan] = demoAccounts;

test('the roster opens independently from chart detail and every progress entry opens its own patient source', () => {
	const store = new PacketStore(':memory:');
	try {
		const roster = store.patients.view(riley, null, '', false, null);
		expect(roster.matches.map(row => row.id)).toEqual(['J-104', 'C-116']);
		expect(roster.patient).toBeNull();
		expect(roster.documents).toEqual([]);
		const chart = store.patients.view(avery, null, ' ed-071 ', false, 'C-116');
		expect(chart.matches.map(row => row.name)).toEqual(['Casey Rowan']);
		expect(chart.patient?.visitCount).toBe(2);
		expect(chart.patient?.workspace).toBeNull();
		expect(chart.timeline.map(event => event.title)).toContain('Nursing reassessment');
		expect(chart.timeline.map(event => event.title)).toContain('Physician progress note');
		for (const event of chart.timeline) {
			const doc = chart.documents.find(doc => doc.id === event.documentId)!;
			expect(doc.patientId).toBe('C-116');
			expect(doc.text.split(/\r?\n/)[event.line! - 1]).toBe(event.text);
		}
	} finally { store.close(); }
});

test('administrative updates persist across startup with role, visit and retry boundaries', () => {
	const dir = mkdtempSync(join(tmpdir(), 'registry-test-'));
	const filename = join(dir, 'hospital.sqlite');
	const id = randomUUID();
	let store = new PacketStore(filename);
	try {
		expect(() => store.patients.addCoordinationUpdate('C-116', 'ED-116', 'Called.', riley, id)).toThrow(/administrative/);
		expect(() => store.patients.addCoordinationUpdate('C-116', 'ED-104', 'Called.', admin, id)).toThrow(/visit/);
		expect(() => store.patients.addCoordinationUpdate('C-116', 'ED-116', '  ', admin, id)).toThrow(/1 to 1,000/);
		expect(() => store.patients.addCoordinationUpdate('C-116', 'ED-116', 'Called.', admin, 'broken')).toThrow(/Reopen/);
		store.patients.addCoordinationUpdate('C-116', 'ED-116', 'Printed copy collected.', admin, id);
		store.close();
		store = new PacketStore(filename);
		store.patients.addCoordinationUpdate('C-116', 'ED-116', '  Printed copy collected. ', admin, id);
		expect(() => store.patients.addCoordinationUpdate('J-104', 'ED-104', 'Duplicate key.', admin, id)).toThrow(/already saved/);
		const chart = store.patients.view(avery, null, '', false, 'C-116');
		expect(chart.timeline.filter(event => event.id === id)).toEqual([expect.objectContaining({ text: 'Printed copy collected.', source: 'Maya Chen', visitId: 'ED-116' })]);
		expect(store.patients.view(admin, null, '', false, 'J-104').timeline.some(event => event.id === id)).toBe(false);
		expect(chart.documents).toHaveLength(7);
		expect(chart.patient?.clinicalUpdate?.documentId).toBe('ED-116-nursing');
		expect(chart.patient?.clinicalUpdate?.text).toContain('headache had eased');
		expect(chart.patient?.clinicalUpdate?.id).not.toBe(id);
	} finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('my assignments follow the actual handoff owner and completed review keeps its named history', () => {
	const store = new PacketStore(':memory:');
	try {
		const workflow = store.clinical;
		const current = (account: typeof avery) => store.patients.view(account, workflow.get(), '', true, null).matches;
		const draft = workflow.saveSummary(workflow.version(), verifyChartSummary(chartDocuments, 'local'), 5, clinicalDocument.text, chartDocuments);
		expect(current(admin)).toHaveLength(1);
		const nurse = workflow.approve(draft.version, admin, 'check-images');
		expect(current(riley)[0].workspace).toBe('/inbox/J-104');
		expect(current(avery)).toEqual([]);
		const checked = workflow.recordImageStatus(nurse.version, riley, 'still-pending');
		const sent = workflow.forward(checked.version, riley, 'review-report');
		expect(current(avery)[0].owner).toBe(avery.name);
		expect(current(morgan)).toEqual([]);
		const returned = workflow.returnToAdmin(sent.version, avery, 'Unavailable.');
		expect(current(admin)[0].status).toBe('Review needs reassignment');
		const reassigned = workflow.reassign(returned.version, admin, 'doctor-morgan');
		expect(current(morgan)[0].owner).toBe(morgan.name);
		expect(current(avery)).toEqual([]);
		const signed = workflow.signReview(reassigned.version, morgan);
		const chart = store.patients.view(admin, signed, '', false, 'J-104');
		expect(chart.patient?.status).toBe('Comparison image follow-up');
		expect(chart.patient?.owner).toBe(riley.name);
		expect(current(riley)[0].workspace).toBe('/inbox/J-104');
		expect(chart.timeline).toContainEqual(expect.objectContaining({title:'Report review signed', source:morgan.name}));
		expect(current(morgan)).toEqual([]);
	} finally { store.close(); }
});
