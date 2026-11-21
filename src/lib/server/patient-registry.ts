import type { DatabaseSync } from 'node:sqlite';
import { clinicalActivity, type PatientEvent } from '../clinical-activity';
import { demoAccounts, type DemoAccount } from './accounts';
import { chartDocuments, chartPatient, clinicalDocument, practiceReplyEvidence, type ChartDocument, type PracticeRound } from './chart';
import { chartSnapshot, isAssignedTo, type ClinicalState } from './clinical-store';
import { ReviewError } from './store';
import registration from '../../../samples/records/ED-116-registration.txt?raw';
import receiptCheck from '../../../samples/records/ED-116-receipt-check.txt?raw';
import receipt from '../../../samples/records/ED-116-visit-receipt.txt?raw';
import nursing from '../../../samples/records/ED-116-nursing.txt?raw';
import physician from '../../../samples/records/ED-116-physician.txt?raw';
import intake from '../../../samples/records/ED-071-intake.txt?raw';
import delivery from '../../../samples/records/ED-071-access.txt?raw';
import history from '../../../samples/records/ED-082-history.txt?raw';

const jordanHistory: ChartDocument = {
	id: 'ED-082-history', patientId: chartPatient.id, visitId: 'ED-082', date: '2026-09-04',
	title: 'Medical and family history', text: history, sourceUrl: '/samples/ED-082-history.txt'
};
const casey = { id: 'C-116', name: 'Casey Rowan', hospital: chartPatient.hospital };
function caseyDocument(id: string, title: string, text: string, visitId: string, date: string): ChartDocument {
	return { id, title, text, patientId: casey.id, visitId, date, sourceUrl: '/samples/' + id + '.txt' };
}
const caseyDocuments = [
	caseyDocument('ED-116-receipt-check', 'Nursing paperwork confirmation', receiptCheck, 'ED-116', '2026-11-20'),
	caseyDocument('ED-116-registration', 'Communication preferences', registration, 'ED-116', '2026-11-20'),
	caseyDocument('ED-116-visit-receipt', 'Visit paperwork receipt', receipt, 'ED-116', '2026-11-20'),
	caseyDocument('ED-116-nursing', 'Nursing reassessment', nursing, 'ED-116', '2026-11-20'),
	caseyDocument('ED-116-physician', 'Physician progress note', physician, 'ED-116', '2026-11-20'),
	caseyDocument('ED-071-intake', 'Prior visit intake', intake, 'ED-071', '2026-08-18'),
	caseyDocument('ED-071-access', 'Accessible print delivery', delivery, 'ED-071', '2026-08-18')
];
// The demo records name their chart date and local time. A source prefix locates the cited observation.
const chartEntries: Record<string, [string, string]> = {
	'ED-104': ['13:20:00-05:00', 'Prepared by:'],
	'ED-104-radiology': ['12:32:00-05:00', 'Impression:'],
	'ED-104-registration': ['13:18:00-05:00', 'Prior study link:'],
	'ED-082-intake': ['09:21:00-04:00', 'Jordan reported'],
	'ED-082-study': ['10:36:00-04:00', 'Archive entry:'],
	'ED-082-history': ['09:35:00-04:00', 'Personal history:'],
	'ED-116-receipt-check': ['16:46:00-05:00', 'Riley Ortiz verified'],
	'ED-116-registration': ['15:12:00-05:00', 'Casey requested'],
	'ED-116-visit-receipt': ['16:40:00-05:00', 'A large-type printed copy'],
	'ED-116-nursing': ['15:45:00-05:00', 'Casey reported'],
	'ED-116-physician': ['16:18:00-05:00', 'Casey and'],
	'ED-071-intake': ['09:04:00-04:00', 'Casey requested'],
	'ED-071-access': ['11:21:00-04:00', 'Large-type']
};

interface StoredDocument extends ChartDocument { recordedAt: string; passage: string }
type Workspace = '/handoffs' | '/inbox/J-104' | null;
interface PatientRow {
	id: string; name: string; hospital: string; visitCount: number; lastVisit: string; latest: PatientEvent; clinicalUpdate: PatientEvent | null;
	status: string; owner: string | null; assignedToMe: boolean; workspace: Workspace;
}

function workFor(state: ClinicalState | null, account: DemoAccount) {
	const active = state?.history.at(-1);
	const admin = account.role === 'Administrative staff';
	let owner: string | null = 'Administrative staff';
	let assignedToMe = admin;
	let status = state ? 'Transfer brief prepared' : 'Transfer packet filed';
	if (state?.imageFollowup && !state.imageFollowup.resolvedAt) {
		status = 'Comparison image follow-up';
		owner = state.imageFollowup.recipientName;
		assignedToMe = state.imageFollowup.recipientAccountId === account.id;
	} else if (state?.status === 'reviewed') {
		status = 'Report review signed';
		owner = null;
		assignedToMe = false;
	} else if (state?.status === 'returned') {
		status = 'Review needs reassignment';
	} else if (active) {
		status = active.taskId === 'check-images' ? 'Image status check assigned' : 'Report review assigned';
		owner = active.recipientName ?? demoAccounts.find(person => isAssignedTo(active, person))?.name ?? active.recipient;
		assignedToMe = isAssignedTo(active, account);
	}
	const workspace: Workspace = !admin && assignedToMe ? '/inbox/J-104' : '/handoffs';
	return { status, owner, assignedToMe, workspace };
}

function entry(doc: ChartDocument, stored: StoredDocument): PatientEvent {
	const lines = doc.text.split(/\r?\n/);
	const index = lines.findIndex(line => line.startsWith(stored.passage));
	return {
		id: doc.id, visitId: doc.visitId, at: stored.recordedAt, title: doc.title, source: doc.title,
		documentId: doc.id, line: index < 0 ? null : index + 1, text: index < 0 ? doc.title : lines[index]
	};
}

export class PatientRegistry {
	constructor(private readonly db: DatabaseSync) {
		db.exec(`CREATE TABLE IF NOT EXISTS hospital_patients (id TEXT PRIMARY KEY, name TEXT NOT NULL, hospital TEXT NOT NULL);
			CREATE TABLE IF NOT EXISTS hospital_documents (
				id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES hospital_patients(id), visitId TEXT NOT NULL,
				date TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, sourceUrl TEXT NOT NULL,
				recordedAt TEXT NOT NULL, passage TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS hospital_visit_documents ON hospital_documents(patientId, visitId);
			CREATE TABLE IF NOT EXISTS hospital_updates (
				id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES hospital_patients(id), visitId TEXT NOT NULL,
				at TEXT NOT NULL, text TEXT NOT NULL, accountId TEXT NOT NULL, source TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS hospital_patient_updates ON hospital_updates(patientId, at);
			CREATE TABLE IF NOT EXISTS hospital_completed_assignments (
				documentId TEXT PRIMARY KEY REFERENCES hospital_documents(id), accountId TEXT NOT NULL
			)`);
		db.exec('BEGIN IMMEDIATE');
		try {
			const addPatient = db.prepare('INSERT INTO hospital_patients (id,name,hospital) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING');
			for (const patient of [chartPatient, casey]) addPatient.run(patient.id, patient.name, patient.hospital);
			const addDoc = db.prepare(`INSERT INTO hospital_documents
				(id,patientId,visitId,date,title,text,sourceUrl,recordedAt,passage) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`);
			for (const doc of [...chartDocuments, jordanHistory, ...caseyDocuments]) {
				const [time, passage] = chartEntries[doc.id];
				const at = new Date(doc.date + 'T' + time).toISOString();
				addDoc.run(doc.id, doc.patientId, doc.visitId, doc.date, doc.title, doc.text, doc.sourceUrl, at, passage);
			}
			db.prepare('INSERT INTO hospital_completed_assignments (documentId,accountId) VALUES (?,?) ON CONFLICT(documentId) DO NOTHING').run('ED-116-receipt-check', 'nurse');
			db.exec('COMMIT');
		} catch (err) { db.exec('ROLLBACK'); throw err; }
	}

	completedAssignments(account: DemoAccount) {
		const documents = this.db.prepare(`SELECT d.*,p.name FROM hospital_completed_assignments a
			JOIN hospital_documents d ON d.id=a.documentId JOIN hospital_patients p ON p.id=d.patientId
			WHERE a.accountId=? ORDER BY d.recordedAt DESC, d.id`).all(account.id) as unknown as (StoredDocument & {name:string})[];
		return documents.map(doc => ({
			patientId: doc.patientId, name: doc.name, visitId: doc.visitId, active: false, text: doc.title,
			completion: entry(doc, doc), document: doc
		}));
	}

	addCoordinationUpdate(patientId: string, visitId: string, text: string, account: DemoAccount, requestId: string) {
		if (account.role !== 'Administrative staff') throw new ReviewError('Only administrative staff can add coordination updates.', 400);
		const note = text.trim();
		if (!note || note.length > 1000) throw new ReviewError('Enter a coordination update of 1 to 1,000 characters.', 400);
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) {
			throw new ReviewError('Reopen this chart and try again.', 400);
		}
		const visit = this.db.prepare('SELECT 1 FROM hospital_documents WHERE patientId=? AND visitId=? LIMIT 1').get(patientId, visitId);
		if (!visit) throw new ReviewError('Choose a visit from this patient’s chart.', 400);
		const saved = this.db.prepare(`INSERT INTO hospital_updates (id,patientId,visitId,at,text,accountId,source)
			VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run(requestId, patientId, visitId, new Date().toISOString(), note, account.id, account.name);
		if (!saved.changes) {
			const previous = this.db.prepare('SELECT patientId,visitId,text,accountId FROM hospital_updates WHERE id=?').get(requestId);
			if (previous?.patientId !== patientId || previous.visitId !== visitId || previous.text !== note || previous.accountId !== account.id) {
				throw new ReviewError('This update was already saved. Reopen the chart to add another.');
			}
		}
	}

	view(account: DemoAccount, state: ClinicalState | null, query: string, mine: boolean, selectedId: string | null, practice: PracticeRound | null = null) {
		const patients = this.db.prepare('SELECT id,name,hospital FROM hospital_patients').all() as unknown as (typeof chartPatient)[];
		const matches: PatientRow[] = [];
		let patient: PatientRow | null = null;
		let documents: ChartDocument[] = [];
		let timeline: PatientEvent[] = [];
		const search = query.trim().toLowerCase();
		const selectDocs = this.db.prepare('SELECT * FROM hospital_documents WHERE patientId=? ORDER BY recordedAt DESC,id');
		const selectLogs = this.db.prepare(`SELECT id,visitId,at,text,source,'Coordination update' AS title, NULL AS documentId, NULL AS line
			FROM hospital_updates WHERE patientId=? ORDER BY at DESC`);
		for (const person of patients) {
			const stored = selectDocs.all(person.id) as unknown as StoredDocument[];
			if (!stored.length) continue;
			const transfer = person.id === chartPatient.id;
			const savedDocs = transfer && (state || practice) ? chartSnapshot(state, practice).documents : [];
			const records = stored.map(doc => savedDocs.find(saved => saved.id === doc.id) ?? doc);
			const entries = records.map((doc, index) => entry(doc, stored[index]));
			const reply = transfer && practiceReplyEvidence(records);
			if (reply) entries.push({
				id: reply.documentId + '-reply', visitId: clinicalDocument.visitId,
				at: new Date(clinicalDocument.date + 'T13:42:00-05:00').toISOString(),
				title: 'Imaging Records reply', source: 'Registration and transfer checklist',
				documentId: reply.documentId, line: reply.line, text: reply.quote
			});
			entries.push(...selectLogs.all(person.id) as unknown as PatientEvent[]);
			if (transfer && state) entries.push(...clinicalActivity(state, clinicalDocument.visitId));
			entries.sort((a, b) => b.at.localeCompare(a.at));
			const visits = new Set(records.map(doc => doc.visitId));
			const work = transfer ? workFor(state, account) : { status: 'Visit documented', owner: null, assignedToMe: false, workspace: null };
			const clinicalUpdate = entries.find(event => event.visitId === stored[0].visitId && event.line !== null &&
				(event.documentId === 'ED-104-radiology' || event.documentId === 'ED-116-nursing')) ?? null;
			const row = { ...person, ...work, visitCount: visits.size, lastVisit: stored[0].date, latest: entries[0], clinicalUpdate };
			if ((!mine || row.assignedToMe) && [row.name, row.id, ...visits].some(label => label.toLowerCase().includes(search))) matches.push(row);
			if (person.id === selectedId) { patient = row; documents = records; timeline = entries; }
		}
		matches.sort((a, b) => b.latest.at.localeCompare(a.latest.at) || a.name.localeCompare(b.name));
		return { query, mine, matches, patient, documents, timeline, hasTransfer: patient?.id === chartPatient.id };
	}
}
