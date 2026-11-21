import { expect, test, vi } from 'vitest';
import { GET as getSample } from '../../routes/samples/[filename]/+server';
import { demoAccounts, type DemoAccount } from './accounts';
import { chartDocuments, chartPatient, clinicalDocument, practiceDocuments } from './chart';
import { verifyChartSummary } from './clinical-summary';
import { patientFileInventory, priorImageFilename } from './file-inventory';
import * as storeModule from './store';

test('the shared inventory includes every expected source and flags a missing note independently of uploads', () => {
	const store = new storeModule.PacketStore(':memory:');
	try {
		for (const account of demoAccounts) {
			const jordan = store.patients.view(account, null, '', false, chartPatient.id);
			const inventory = patientFileInventory(jordan.patient!, jordan.documents, null);
			expect(inventory).toMatchObject({ available: 7, expected: 8, missingDocuments: [],
				priorImage: { status: 'pending', accession: 'MB-082-LA', url: null } });
			const casey = store.patients.view(account, null, '', false, 'C-116');
			expect(patientFileInventory(casey.patient!, casey.documents, null)).toMatchObject({
				available: 7, expected: 7, missingDocuments: [], priorImage: null
			});
			const missing = casey.documents.filter(doc => doc.id !== 'ED-116-physician');
			expect(patientFileInventory(casey.patient!, missing, null, 1)).toMatchObject({
				available: 7, expected: 8, missingDocuments: [{ id: 'ED-116-physician' }], priorImage: null
			});
		}
	} finally { store.close(); }
});

test('an arrived reply must identify the archived study and nurse observations supersede the handoff snapshot', () => {
	const store = new storeModule.PacketStore(':memory:');
	try {
		const practice = {accession: 'MB-082-147', status: 'arrived' as const};
		const docs = practiceDocuments(practice);
		const view = store.patients.view(demoAccounts[0], null, '', false, chartPatient.id, practice);
		const inventory = patientFileInventory(chartPatient, view.documents, null);
		expect(inventory).toMatchObject({ available: 8, expected: 8, priorImage: { status: 'available',
			url: '/samples/ED-082-ankle.png?study=MB-082-147' } });
		const unsigned = view.documents.map(doc => doc.id === 'ED-104-registration'
			? {...doc, text: doc.text.replace('now shows the comparison images for study MB-082-147', 'now shows the comparison images for study MB-082-148')} : doc);
		expect(patientFileInventory(chartPatient, unsigned, null).priorImage).toMatchObject({ status: 'unconfirmed', url: null });
		const flow = store.clinical;
		const draft = flow.saveSummary(flow.version(), verifyChartSummary(docs, 'local'), 1, clinicalDocument.text, docs);
		const sent = flow.approve(draft.version, demoAccounts[0], 'check-images');
		const pending = flow.recordImageStatus(sent.version, demoAccounts[2], 'unable-to-confirm');
		expect(patientFileInventory(chartPatient, view.documents, pending).priorImage).toMatchObject({ status: 'unconfirmed', owner: 'Riley Ortiz', url: null });
		const arrived = flow.recordImageStatus(pending.version, demoAccounts[2], 'arrived');
		const unmatched = view.documents.map(doc => doc.id === 'ED-082-study' ? {...doc,text:doc.text.replace(practice.accession, 'OTHER-STUDY')} : doc);
		expect(patientFileInventory(chartPatient, unmatched, arrived).priorImage).toMatchObject({status:'unconfirmed', url:null});
	} finally { store.close(); }
});

test('the earlier film requires a session and current study receipt, and the same bytes open for all four accounts', async () => {
	const store = new storeModule.PacketStore(':memory:');
	const access = vi.spyOn(storeModule, 'packetStore').mockReturnValue(store);
	const open = async (account?: DemoAccount, study = '') => getSample({
		locals: {account: account ?? null}, params: {filename: priorImageFilename},
		url: new URL('http://localhost/samples/' + priorImageFilename + '?study=' + study)
	} as Parameters<typeof getSample>[0]);
	try {
		await expect(open()).rejects.toMatchObject({status:303});
		await expect(open(demoAccounts[0], 'MB-082-LA')).rejects.toMatchObject({status:404});
		const flow = store.clinical;
		const draft = flow.saveSummary(flow.version(), verifyChartSummary(chartDocuments, 'local'), 0, clinicalDocument.text, chartDocuments);
		const nursing = flow.approve(draft.version, demoAccounts[0], 'check-images');
		const arrived = flow.recordImageStatus(nursing.version, demoAccounts[2], 'arrived');
		await expect(open(demoAccounts[0])).rejects.toMatchObject({status:404});
		await expect(open(demoAccounts[0], 'UNKNOWN')).rejects.toMatchObject({status:404});
		for (const account of demoAccounts) {
			const response = await open(account, 'MB-082-LA');
			expect(response.headers.get('Cache-Control')).toBe('private, no-store');
			expect(response.headers.get('Content-Type')).toBe('image/png');
			const bytes = new Uint8Array(await response.arrayBuffer());
			expect([...bytes.slice(0, 8)]).toEqual([137,80,78,71,13,10,26,10]);
		}
		flow.reset(arrived.version);
		await expect(open(demoAccounts[0], 'MB-082-LA')).rejects.toMatchObject({status:404});
	} finally { access.mockRestore(); store.close(); }
});

test('matching delivered bytes are immediately available to each role and a later nursing observation cannot remove them', async () => {
	const store = new storeModule.PacketStore(':memory:');
	const access = vi.spyOn(storeModule, 'packetStore').mockReturnValue(store);
	try {
		const flow = store.clinical;
		const openChart = async (account: DemoAccount) => {
			const { record, imagingNotice } = flow.snapshot();
			const view = store.patients.view(account, record, '', false, chartPatient.id);
			const inventory = patientFileInventory(chartPatient, view.documents, record, 0, imagingNotice);
			expect(inventory).toMatchObject({available:8, expected:8, priorImage:{status:'available'}});
			const response = await getSample({ locals:{account}, params:{filename: priorImageFilename},
				url:new URL(inventory.priorImage!.url!, 'http://localhost') } as Parameters<typeof getSample>[0]);
			expect(new Uint8Array(await response.arrayBuffer()).slice(0,4)).toEqual(new Uint8Array([137,80,78,71]));
		};
		expect(patientFileInventory(chartPatient, chartDocuments, null, 0, flow.snapshot().imagingNotice).priorImage?.owner).toBe('Imaging Records');
		flow.receiveImagingDelivery(flow.version(), {patientId: chartPatient.id, visitId:'ED-104', accession:'MB-082-LA'});
		expect(flow.get()).toBeNull();
		for (const account of demoAccounts) await openChart(account);
		const draft = flow.saveSummary(flow.version(), verifyChartSummary(chartDocuments,'local'), 0, clinicalDocument.text, chartDocuments);
		const assigned = flow.approve(draft.version, demoAccounts[0], 'check-images');
		flow.recordImageStatus(assigned.version, demoAccounts[2], 'still-pending');
		await openChart(demoAccounts[2]);
	} finally { access.mockRestore(); store.close(); }
});
