import { expect, test } from 'vitest';
import { demoAccounts } from './server/accounts';
import { chartDocuments, clinicalDocument, practiceDocuments } from './server/chart';
import { summarizePatientChart } from './server/chart-brief';
import { verifyChartSummary } from './server/clinical-summary';
import { PacketStore } from './server/store';
import { reconcileImagingNotice } from './server/imaging-notice';
import { buildEvidenceMap } from './patient-map';

const [admin, avery, riley, morgan] = demoAccounts;

test('the same report keeps its original instruction as nursing, reassignment, sign-off and follow-up change owners', () => {
	const store = new PacketStore(':memory:');
	try {
		const flow = store.clinical;
		function finding(id: string, account = admin) {
			const { record, imagingNotice } = flow.snapshot();
			const view = store.patients.view(account, record, '', false, 'J-104');
			return buildEvidenceMap(summarizePatientChart(view).items, view, record, imagingNotice).find(row => row.id === id)!;
		}
		expect(finding('family-history').actions).toEqual([]);
		expect(finding('medical-history').actions).toEqual([]);
		expect(finding('comparison-images').actions).toMatchObject([{
			title: 'Request the earlier X-ray', person: 'Requested by Intake Desk', status: 'Queued for Imaging Records'
		}]);
		const draft = flow.saveSummary(flow.version(), verifyChartSummary(chartDocuments, 'local'), 1, clinicalDocument.text, chartDocuments);
		const nursing = flow.approve(draft.version, admin, 'check-images');
		expect(finding('comparison-images', riley).actions[0]).toMatchObject({person: riley.name, workspace: '/inbox/J-104'});
		expect(finding('radiology', riley).actions[0].workspace).toBeFalsy();
		const checked = flow.recordImageStatus(nursing.version, riley, 'still-pending');
		const sent = flow.forward(checked.version, riley, 'review-report');
		const review = finding('radiology', avery).actions[0];
		expect(review).toMatchObject({person: avery.name, workspace: '/inbox/J-104', citation: {documentId: 'ED-104', line: 15}});
		const returned = flow.returnToAdmin(sent.version, avery, 'Covering another emergency.');
		expect(finding('radiology', avery).actions[0].workspace).toBeFalsy();
		expect(finding('radiology', admin).actions[0]).toMatchObject({status: 'Awaiting reassignment', workspace: '/handoffs'});
		const reassigned = flow.reassign(returned.version, admin, morgan.id);
		expect(finding('radiology', avery).actions[0].workspace).toBeFalsy();
		expect(finding('radiology', morgan).actions[0]).toMatchObject({person: morgan.name, workspace: '/inbox/J-104', citation: review.citation});
		flow.signReview(reassigned.version, morgan);
		expect(finding('radiology', morgan).actions[0]).toMatchObject({
			person: morgan.name, status: 'Signed',
			history: [riley.name + ' sent the assignment to ' + avery.name + '.', avery.name + ' returned it. Covering another emergency.',
				admin.name + ' sent the assignment to ' + morgan.name + '.', morgan.name + ' signed the report review.']
		});
		expect(finding('comparison-images', morgan).actions[0].workspace).toBeFalsy();
		expect(finding('comparison-images', riley).actions[0]).toMatchObject({person: riley.name, status: 'Follow-up open', workspace: '/inbox/J-104'});
	} finally {
		store.close();
	}
});

test('Casey’s chart links recorded actions to actual signed visit passages and rejects another patient’s or changed source', () => {
	const store = new PacketStore(':memory:');
	try {
		const view = store.patients.view(riley, null, '', false, 'C-116');
		const jordan = store.patients.view(riley, null, '', false, 'J-104');
		const { items } = summarizePatientChart(view);
		const mapped = buildEvidenceMap(items, view, null);
		expect(mapped).toHaveLength(4);
		for (const row of mapped) {
			expect(row.actions).toHaveLength(1);
			expect(row.actions[0].workspace).toBeFalsy();
			const evidence = row.actions[0].citation;
			expect(view.documents.find(doc => doc.id === evidence.documentId)?.text.split('\n')[evidence.line - 1]).toBeTruthy();
		}
		expect(mapped.find(row => row.id === 'paperwork-receipt')?.actions[0]).toMatchObject({status: 'Closed', person: 'Recorded by Riley Ortiz, RN'});
		expect(buildEvidenceMap(items, jordan, null)).toEqual([]);
		const point = items[0];
		expect(buildEvidenceMap([{...point, sources:[{...point.sources[0], quote:'Unrelated paragraph.'}]}], view, null)).toEqual([]);
	} finally {
		store.close();
	}
});

test('the map distinguishes an already filed image from a queued request and never maps stale evidence', () => {
	const store = new PacketStore(':memory:');
	try {
		const practice = { accession: 'MB-082-506', status: 'arrived' as const };
		const view = store.patients.view(admin, null, '', false, 'J-104', practice);
		const notice = reconcileImagingNotice(practiceDocuments(practice), null, null, new Date().toISOString());
		const {items} = summarizePatientChart(view);
		const actions = buildEvidenceMap(items, view, null, notice).find(row => row.id === 'comparison-images')?.actions;
		expect(actions).toMatchObject([{title:'Link the earlier X-ray', person:'Imaging Records', status:'Image available', requestDetails:true}]);
		const stale = {...notice, evidence: notice.evidence.map((ref, i) => i === 0 ? {...ref, quote:'Replaced passage'} : ref)};
		expect(buildEvidenceMap(items, view, null, stale).find(row => row.id === 'comparison-images')?.actions).toEqual([]);
	} finally { store.close(); }
});
