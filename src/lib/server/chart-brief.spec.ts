import { expect, test, vi } from 'vitest';
import { demoAccounts } from './accounts';
import { prepareChartBrief } from './chart-brief';
import { PacketStore } from './store';

test('both chart briefs use only the current visit and reproduce each source line exactly', async () => {
	const store = new PacketStore(':memory:');
	try {
		for (const id of ['J-104','C-116']) {
			const view = store.patients.view(demoAccounts[0], null, '', false, id);
			const select = vi.fn();
			const brief = await prepareChartBrief(view, 'local', select);
			expect(select).not.toHaveBeenCalled();
			expect(brief.items[0].documentId).toBe(id === 'C-116' ? 'ED-116-nursing' : 'ED-104-radiology');
			for (const item of brief.items) {
				const doc = view.documents.find(doc => doc.id === item.documentId)!;
				expect(doc.patientId).toBe(id);
				expect(doc.visitId).toBe(brief.visitId);
				expect(doc.text.split(/\r?\n/)[item.line - 1]).toBe(item.text);
			}
			expect(store.clinical.get()).toBeNull();
		}
	} finally { store.close(); }
});

test('the model can select validated IDs, and cannot introduce prose, a different patient, or uncited staff notes', async () => {
	const store = new PacketStore(':memory:');
	try {
		const chart = store.patients.view(demoAccounts[1], null, '', false, 'C-116');
		const key = 'ED-116-nursing';
		const approved = await prepareChartBrief(chart, 'codex', () => Promise.resolve({ ids: [key, 'ED-116-physician'] }));
		expect(approved.items.map(item => item.id)).toEqual([key,'ED-116-physician']);
		for (const raw of [{ ids: [key, 'ED-104-radiology'] }, { ids:[key], opinion: 'A new conclusion' }, { ids:['ED-116-physician'] }, { ids:[key,key] }, { ids:['an operational update'] }]) {
			await expect(prepareChartBrief(chart, 'codex', () => Promise.resolve(raw))).rejects.toThrow(/unverified/);
		}
		const corrupt = { ...chart, documents: chart.documents.map(doc => ({ ...doc, text: doc.text.replace('Patient: Casey Rowan','Patient: Jordan Vale') })) };
		const select = vi.fn();
		await expect(prepareChartBrief(corrupt, 'codex', select)).rejects.toThrow(/No verified/);
		expect(select).not.toHaveBeenCalled();
	} finally { store.close(); }
});
