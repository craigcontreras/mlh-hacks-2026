import { expect, test, vi } from 'vitest';
import { demoAccounts } from './accounts';
import { chartDocuments, chartPatient, practiceDocuments, type ChartDocument, type ImageStatus } from './chart';
import { prepareChartBrief, summarizeChartDocuments, summarizePatientChart } from './chart-brief';
import { PacketStore } from './store';

test('both chart briefs condense verified sources across visits without mixing patient or family histories', async () => {
	const store = new PacketStore(':memory:');
	try {
		for (const id of ['J-104', 'C-116']) {
			const view = store.patients.view(demoAccounts[0], null, '', false, id);
			const select = vi.fn();
			const brief = await prepareChartBrief(view, 'local', select);
			expect(select).not.toHaveBeenCalled();
			expect(brief).toEqual(summarizePatientChart(view));
			expect(brief.items).toHaveLength(id === 'C-116' ? 4 : 5);
			const cited = brief.items.flatMap(item => item.sources.map(source => source.visitId));
			expect(new Set(cited).size).toBe(2);
			for (const point of brief.items) {
				expect(point.sources.length).toBeGreaterThan(0);
				for (const source of point.sources) {
					const doc = view.documents.find(doc => doc.id === source.documentId)!;
					expect(doc.patientId).toBe(id);
					expect(source.visitId).toBe(doc.visitId);
					expect(doc.text.split(/\r?\n/)[source.line - 1]).toBe(source.quote);
					expect(point.text).not.toBe(source.quote);
				}
			}
			if (id === 'J-104') {
				expect(brief.items.find(point => point.id === 'medical-history')?.text).toContain('2024');
				const family = brief.items.find(point => point.id === 'family-history')!;
				expect(family.text).toContain('their mother has osteoporosis');
				expect(family.text).toContain('No genetic test report');
				expect(family.sources).toHaveLength(2);
				expect(brief.items.find(point => point.id === 'radiology')?.text).toContain('No new fracture was seen on these X-rays');
			} else {
				expect(brief.items.some(point => point.id === 'family-history')).toBe(false);
				expect(brief.items.find(point => point.id === 'print-preference')?.text).toContain('both visits');
				expect(brief.items.find(point => point.id === 'paperwork-receipt')?.sources).toHaveLength(2);
			}
		}
	} finally { store.close(); }
});

test('only matching current and prior study identifiers support an image status including practice-round replies', () => {
	const statuses: Record<ImageStatus,string> = {
		arrived: 'the receiving team could view them', 'still-pending': 'they were still pending',
		'unable-to-confirm': 'delivery was still unconfirmed'
	};
	for (const [status, text] of Object.entries(statuses)) {
		const docs = practiceDocuments({ accession: 'MB-082-150', status: status as ImageStatus });
		const point = summarizeChartDocuments(chartPatient, docs).items.find(point => point.id === 'comparison-images')!;
		expect(point.text).toContain('MB-082-150');
		expect(point.text).toContain('13:42, ' + text);
		expect(point.sources[0].quote).toContain('13:42');
		const changed = docs.map(doc => ({ ...doc, text: doc.text.replace('13:42 · Imaging Records reply:', 'Missing reply:') }));
		const reread = summarizeChartDocuments(chartPatient, changed).items.find(point => point.id === 'comparison-images')!;
		expect(reread.text).not.toContain('13:42');
		const mismatch = docs.map(doc => doc.id === 'ED-082-study' ? { ...doc, text: doc.text.replaceAll('MB-082-150', 'MB-082-777') } : doc);
		expect(summarizeChartDocuments(chartPatient, mismatch).items.find(point => point.id === 'comparison-images')?.text).not.toContain('were on file');
	}
});

test('every chart and saved packet document also has a verifiable standalone overview', () => {
	const store = new PacketStore(':memory:');
	try {
		const saved = store.clinical.get()!;
		for (const id of ['J-104','C-116']) {
			const view = store.patients.view(demoAccounts[0], saved, '', false, id);
			for (const doc of view.documents) {
				const { items } = summarizeChartDocuments(view.patient!, [doc]);
				expect(items.length, doc.title).toBeGreaterThan(0);
				expect(items.length, doc.title).toBeLessThanOrEqual(5);
				for (const point of items) {
					expect(point.text, doc.title).not.toBe(point.sources[0].quote);
					for (const source of point.sources) {
						expect(source.documentId).toBe(doc.id);
						expect(source.quote).toBe(doc.text.split('\n')[source.line - 1]);
					}
				}
			}
			if (id === 'J-104') {
				expect(view.documents.map(doc => doc.id)).toContain('ED-082-history');
				expect(store.clinical.snapshot().chart.documents).toHaveLength(5);
			}
		}
	} finally { store.close(); }
});

test('editing content or moving a line changes the actual summary and its citation, and conflicting reports stay visible', () => {
	const edited = chartDocuments.map(doc => doc.id === 'ED-104-radiology' ? { ...doc,
		text: doc.text.replace('Impression: Lateral soft tissue swelling. No acute fracture identified on these views.', '\nImpression: Comparison is limited by motion.')
	} : doc);
	const result = summarizeChartDocuments(chartPatient, edited).items.find(point => point.id === 'radiology')!;
	expect(result.text).toBe('Comparison is limited by motion. The transfer note gives a different impression.');
	expect(result.sources[0].quote).toBe('Impression: Comparison is limited by motion.');
	expect(edited.find(doc => doc.id === result.sources[0].documentId)?.text.split('\n')[result.sources[0].line - 1]).toBe(result.sources[0].quote);
	expect(summarizeChartDocuments({ id: 'other', name: 'Other Patient' }, edited).items).toEqual([]);
});

test('generic chart sections preserve personal, reported family, and documented test information without inferring from missing sections', () => {
	const patient = { id: 'S-9', name: 'Sam Green', hospital: 'Hillside' };
	const current: ChartDocument = { id:'report-9', title:'Clinic report', patientId: patient.id, visitId:'V-9', date:'2026-11-21', sourceUrl:'/records/report-9',
		text: ['Chart identity: S-9 | visit V-9 | Hillside', 'Patient: Sam Green', 'Date: 2026-11-21',
			'Chief complaint: Return visit for a sore wrist.', 'Assessment: Swelling is unchanged since yesterday.',
			'Impression: Comparison is limited.', 'PMH: Childhood asthma.', 'Family history: A sibling has asthma.'].join('\n') };
	const previous = { ...current, id:'report-8', visitId:'V-8', date:'2026-10-06', text: [
		'Chart identity: S-9 | visit V-8 | Hillside', 'Patient: Sam Green', 'Date: 2026-10-06',
		'Genetic test result: The outside report described an inconclusive result.'].join('\n') };
	const points = summarizeChartDocuments(patient, [current, previous]).items;
	expect(points[0].text).toBe('Return visit for a sore wrist.');
	expect(points).toHaveLength(5);
	expect(points.find(point => point.id === 'genetic-testing')?.text).toContain('inconclusive');
	expect(points.find(point => point.id === 'genetic-testing')?.sources[0].visitId).toBe('V-8');
	const familyOnly = { ...current, text: current.text.split('\n').filter(line => /^(Chart identity|Patient|Date|Family history):/.test(line)).join('\n') };
	expect(summarizeChartDocuments(patient, [familyOnly]).items.map(point => point.text)).toEqual(['A sibling has asthma.']);
	expect(summarizeChartDocuments(patient, [{...familyOnly, text:familyOnly.text.replace('visit V-9', 'visit V-8')}]).items).toEqual([]);
});

test.each(['codex', 'gemini'] as const)('%s may reorder existing points without changing, duplicating, dropping, or adding conclusions', async mode => {
	const store = new PacketStore(':memory:');
	try {
		const chart = store.patients.view(demoAccounts[1], null, '', false, 'C-116');
		const local = summarizePatientChart(chart);
		const ids = local.items.map(point => point.id).reverse();
		const approved = await prepareChartBrief(chart, mode, () => Promise.resolve({ ids }));
		expect(approved.mode).toBe(mode);
		expect(approved.items).toEqual([...local.items].reverse());
		for (const raw of [{ ids: [...ids.slice(1), 'foreign'] }, { ids, opinion: 'A conclusion' }, { ids: ids.slice(1) }, { ids: [...ids.slice(1), ids[1]] }]) {
			await expect(prepareChartBrief(chart, mode, () => Promise.resolve(raw))).rejects.toThrow(/unverified/);
		}
		const wrong = { ...chart, documents: chart.documents.map(doc => ({ ...doc, text: doc.text.replace('Patient: Casey Rowan','Patient: Jordan Vale') })) };
		const select = vi.fn();
		await expect(prepareChartBrief(wrong, mode, select)).rejects.toThrow(/No verified/);
		expect(select).not.toHaveBeenCalled();
	} finally { store.close(); }
});
