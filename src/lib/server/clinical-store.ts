import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { demoAccounts, doctorAccounts, type AccountId, type DemoAccount } from './accounts';
import { chartDocuments, chartPatient, clinicalDocument, practiceDocuments, type ChartDocument, type ChartEvidence, type ImageStatus, type PracticeRound } from './chart';
import { reconcileImagingNotice, type ImagingNotice } from './imaging-notice';
import { verifyChartSummary, type ClinicalSummary } from './clinical-summary';
import { packetStore, ReviewError } from './store';
import { hasVerifiedPdfTranscripts } from './pdf-ingest';

export type ClinicalRecipientRole = 'Doctor' | 'Nurse';

export interface ClinicalHandoff {
	id: string;
	taskId: string;
	recipient: ClinicalRecipientRole;
	recipientAccountId?: AccountId;
	recipientName?: string;
	signedBy: string;
	assignmentOrigin?: 'automatic';
	signedByAccountId?: AccountId;
	sentAt: string;
	acknowledgedAt: string | null;
	acknowledgedBy?: string;
	acknowledgedByAccountId?: AccountId;
	returned?: { reason: string; returnedBy: string; returnedByAccountId: AccountId; returnedAt: string };
	reviewed?: { reviewedBy: string; reviewedByAccountId: AccountId; reviewedAt: string };
	reassignedFrom?: { accountId: AccountId; name: string; assignmentId: string };
}

export type { ImageStatus } from './chart';
type ImageObservation = { status: ImageStatus; recordedBy: string; recordedByAccountId: AccountId; recordedAt: string };
export type CarePriority = 'unspecified' | 'routine' | 'urgent' | 'critical';

interface VisitEntry {
	id: string;
	visitId: string;
	savedBy: string;
	savedByAccountId: AccountId;
	savedAt: string;
}

interface CarePlan extends VisitEntry {
	doctorId: AccountId | null;
	doctorName: string | null;
	receivingFacility: string;
	receivingDepartment: string;
	priority: CarePriority;
	impact: string;
}

interface PriorStudyRequest {
	accession: string;
	text: string;
	evidence: ChartEvidence[];
	requestedBy: string;
	requestedByAccountId: AccountId;
	requestedAt: string;
	status: 'Queued for imaging records';
}

interface StoredState {
	status: 'draft' | 'sent' | 'acknowledged' | 'returned' | 'reviewed';
	flow?: 'admin-nurse-doctor';
	summary: ClinicalSummary;
	sourceText: string;
	sources?: ChartDocument[];
	elapsedMs: number;
	history: ClinicalHandoff[];
	priorStudyRequest?: PriorStudyRequest;
	operationalNotes?: (VisitEntry & { text: string })[];
	carePlans?: CarePlan[];
	imageStatus?: ImageObservation;
	imageFollowup?: {
		recipientAccountId: AccountId; recipientName: string; openedAt: string; openedBy: string;
		initial: ImageObservation; resolvedAt?: string;
		observations: { id: string; status: ImageStatus; at: string; by: string }[];
	};
}

export interface ClinicalState extends StoredState {
	version: string;
}

function isRecipient(role: unknown): role is ClinicalRecipientRole {
	return role === 'Doctor' || role === 'Nurse';
}

function recipientId(event: ClinicalHandoff) {
	return event.recipientAccountId ?? (event.recipient === 'Doctor' ? 'doctor' : 'nurse');
}

export function isAssignedTo(event: ClinicalHandoff | undefined, account: DemoAccount) {
	return !!event && event.recipient === account.role && recipientId(event) === account.id;
}

export function plannedReportDoctor(state: StoredState) {
	const id = state.carePlans?.findLast(plan => plan.visitId === clinicalDocument.visitId)?.doctorId ?? 'doctor';
	const doctor = doctorAccounts.find(candidate => candidate.id === id);
	if (!doctor) throw new ReviewError('Choose a doctor account for the report review.', 400);
	return doctor;
}

function requireOwner(state: StoredState | null, account: DemoAccount) {
	const active = state?.history.at(-1);
	if (!state || !active || !isAssignedTo(active, account) || active.returned || active.reviewed) {
		throw new ReviewError('This inbox no longer owns the active handoff.');
	}
	return { state, active };
}

function send(state: StoredState, taskId: string, account: DemoAccount | null, doctorId?: AccountId): StoredState {
	const task = state.summary.tasks.find((candidate) => candidate.id === taskId);
	if (!task || !isRecipient(task.role)) throw new ReviewError('Choose a documented task.', 400);
	if (state.status !== 'returned' && state.history.some((event) => event.taskId === task.id)) {
		throw new ReviewError('This task was already sent.');
	}
	const receiver = demoAccounts.find((candidate) =>
		candidate.id === (task.role === 'Doctor' ? doctorId ?? 'doctor' : 'nurse') && candidate.role === task.role
	);
	if (!receiver) throw new ReviewError('Choose an account that matches the documented assignment.', 400);
	const event: ClinicalHandoff = {
		id: randomUUID(), taskId: task.id, recipient: task.role,
		recipientAccountId: receiver.id, recipientName: receiver.name,
		...(account ? { signedBy: account.name, signedByAccountId: account.id } : { signedBy: 'Intake Desk', assignmentOrigin: 'automatic' }),
		sentAt: new Date().toISOString(), acknowledgedAt: null
	};
	return { ...state, status: 'sent', history: [...state.history, event] };
}

function assignPendingImages(data: StoredState | null, documents: ChartDocument[], notice: ImagingNotice): StoredState | null {
	if (notice.status !== 'requested' || (data && (data.status !== 'draft' || data.history.length || data.summary.issues.length))) return data;
	const started = performance.now();
	const verified = verifyChartSummary(documents, 'local');
	const task = verified.tasks.find(item => item.id === 'check-images');
	const note = documents.find(doc => doc.id === clinicalDocument.id);
	if (verified.issues.length || !task || !note || !hasVerifiedPdfTranscripts(documents)) return data;
	if (data && (data.sourceText !== note.text || !data.summary.tasks.some(item =>
		item.id === task.id && item.role === task.role && item.quote === task.quote && item.line === task.line))) return data;
	const draft: StoredState = data ?? {
		status: 'draft', history: [], sourceText: note.text, sources: documents, summary: { ...verified, pdfInput: 'verified-transcripts' },
		elapsedMs: Math.round(performance.now() - started)
	};
	return send({ ...draft, flow: 'admin-nurse-doctor' }, 'check-images', null);
}

function visitEntry(state: StoredState, visitId: string, account: DemoAccount): VisitEntry {
	if (!(state.sources ?? chartDocuments).some((source) => source.visitId === visitId)) {
		throw new ReviewError('Choose a documented visit on this chart.', 400);
	}
	return { id: randomUUID(), visitId, savedBy: account.name, savedByAccountId: account.id, savedAt: new Date().toISOString() };
}

function requireAdministrator(account: DemoAccount) {
	if (account.role !== 'Administrative staff') throw new ReviewError('This action requires the triage agent.', 400);
}

function requireBrief(state: StoredState | null) {
	if (!state) throw new ReviewError('Prepare the chart brief before adding an operational update.');
	return state;
}

function checkedStatus(status: string): ImageStatus {
	if (status === 'arrived' || status === 'still-pending' || status === 'unable-to-confirm') return status;
	throw new ReviewError('Choose a valid comparison image status.', 400);
}

export class ClinicalStore {
	constructor(private readonly db: DatabaseSync) {
		this.db.exec('BEGIN IMMEDIATE');
		try {
			this.db.exec(`
			CREATE TABLE IF NOT EXISTS clinical_handoff (
				singleton INTEGER PRIMARY KEY CHECK(singleton=1),
				version TEXT NOT NULL,
				data TEXT,
				last_request TEXT,
				practice TEXT,
				imaging_notice TEXT
			);
			INSERT INTO clinical_handoff(singleton, version) VALUES (1, '')
			ON CONFLICT(singleton) DO NOTHING;
		`);
			if (!db.prepare("SELECT 1 FROM pragma_table_info('clinical_handoff') WHERE name='practice'").get()) {
				db.exec('ALTER TABLE clinical_handoff ADD COLUMN practice TEXT');
			}
			if (!db.prepare("SELECT 1 FROM pragma_table_info('clinical_handoff') WHERE name='imaging_notice'").get()) {
				db.exec('ALTER TABLE clinical_handoff ADD COLUMN imaging_notice TEXT');
			}
			const { data, version, practice, imagingNotice } = this.read();
			const record = data && { ...data, version };
			const { documents } = chartSnapshot(record, practice);
			const notice = reconcileImagingNotice(documents, record, imagingNotice, new Date().toISOString());
			const assigned = assignPendingImages(data, documents, notice);
			if (assigned !== data) {
				db.prepare('UPDATE clinical_handoff SET data=?, version=?, last_request=NULL WHERE singleton=1')
					.run(JSON.stringify(assigned), randomUUID());
			}
			db.prepare('UPDATE clinical_handoff SET imaging_notice=? WHERE singleton=1 AND imaging_notice IS NOT ?')
				.run(JSON.stringify(notice), JSON.stringify(notice));
			db.exec('COMMIT');
		} catch (error) { db.exec('ROLLBACK'); throw error; }
	}

	private read() {
		const row = this.db.prepare('SELECT version, data, last_request, practice, imaging_notice FROM clinical_handoff WHERE singleton=1').get()!;
		const version = row.version as string;
		const data = row.data === null ? null : JSON.parse(row.data as string) as StoredState;
		const practice = row.practice === null ? null : JSON.parse(row.practice as string) as PracticeRound;
		const imagingNotice: ImagingNotice | null = row.imaging_notice === null ? null : JSON.parse(row.imaging_notice as string) as ImagingNotice;
		return { version, data, practice, imagingNotice, lastRequest: row.last_request as string | null };
	}

	get(): ClinicalState | null {
		const { data, version } = this.read();
		return data && { ...data, version };
	}

	version(): string { return this.read().version; }

	snapshot() {
		const { data, version, practice, imagingNotice } = this.read();
		const record = data && { ...data, version };
		return { record, version, practice, imagingNotice: imagingNotice!, chart: chartSnapshot(record, practice) };
	}

	private change(version: string, request: unknown[], update: (state: StoredState | null, practice: PracticeRound | null, notice: ImagingNotice | null) => StoredState): ClinicalState;
	private change(version: string, request: unknown[], update: () => null, newPractice: (previous: PracticeRound | null) => PracticeRound | null): null;
	private change(version: string, request: unknown[], update: (state: StoredState | null, practice: PracticeRound | null, notice: ImagingNotice | null) => StoredState | null, newPractice?: (previous: PracticeRound | null) => PracticeRound | null) {
		const key = createHash('sha256').update(JSON.stringify([version, ...request])).digest('hex');
		const before = this.read();
		if (before.lastRequest === key) return before.data && { ...before.data, version: before.version };
		if (before.version !== version) throw new ReviewError('This handoff changed. Review the latest version.');

		let data = update(before.data, before.practice, before.imagingNotice);
		const practice = newPractice ? newPractice(before.practice) : before.practice;
		if (!newPractice && data === before.data && practice === before.practice) return data && { ...data, version: before.version };
		const newVersion = randomUUID();
		const record = data && { ...data, version: newVersion };
		const { documents } = chartSnapshot(record, practice);
		const imagingNotice = reconcileImagingNotice(documents, record,
			newPractice ? null : before.imagingNotice, new Date().toISOString());
		data = assignPendingImages(data, documents, imagingNotice);
		const saved = this.db.prepare('UPDATE clinical_handoff SET version=?, data=?, last_request=?, practice=?, imaging_notice=? WHERE singleton=1 AND version=?')
			.run(newVersion, data && JSON.stringify(data), key, practice && JSON.stringify(practice), JSON.stringify(imagingNotice), version);
		if (!saved.changes) {
			const after = this.read();
			if (after.lastRequest === key) return after.data && { ...after.data, version: after.version };
			throw new ReviewError('This handoff changed. Review the latest version.');
		}
		return data && { ...data, version: newVersion };
	}

	saveSummary(version: string, summary: ClinicalSummary, elapsedMs: number, sourceText: string, sources?: ChartDocument[]): ClinicalState {
		if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || typeof sourceText !== 'string' || !sourceText.trim()) {
			throw new ReviewError('The extraction needs its source text and elapsed time.', 400);
		}
		return this.change(version, ['save', summary, elapsedMs, sourceText, sources], (state, practice) => {
			if (state && state.status !== 'draft') throw new ReviewError('The routed summary is read-only.');
			if (practice && JSON.stringify(sources) !== JSON.stringify(practiceDocuments(practice))) {
				throw new ReviewError('Prepare the brief from the current practice packet.');
			}
			if (state?.priorStudyRequest && (state.sourceText !== sourceText || JSON.stringify(state.sources) !== JSON.stringify(sources))) {
				throw new ReviewError('The queued request already cites this version of the chart.');
			}
			return { ...state, status: 'draft', summary, elapsedMs, sourceText, sources, history: [] };
		});
	}

	approve(version: string, account: DemoAccount, taskId: string): ClinicalState {
		requireAdministrator(account);
		return this.change(version, ['approve', account.id, taskId], (state) => {
			if (!state || state.status !== 'draft') throw new ReviewError('A reviewed draft is required to send a handoff.');
			if (state.summary.issues.length) throw new ReviewError('Resolve the extraction issues before signing off.', 400);
			if (taskId !== 'check-images') throw new ReviewError('Send the documented image-status task to Nurse first.', 400);
			return send({ ...state, flow: 'admin-nurse-doctor' }, taskId, account);
		});
	}

	acknowledge(version: string, account: DemoAccount): ClinicalState {
		const { role } = account;
		if (!isRecipient(role)) throw new ReviewError('Choose a valid receiving role.', 400);
		return this.change(version, ['acknowledge', account.id], (record) => {
			const { state, active } = requireOwner(record, account);
			if (active.acknowledgedAt !== null) throw new ReviewError('This handoff receipt has already been recorded.');
			const acknowledged = {
				...active, acknowledgedAt: new Date().toISOString(),
				acknowledgedBy: account.name, acknowledgedByAccountId: account.id
			};
			return { ...state, status: 'acknowledged', history: [...state.history.slice(0, -1), acknowledged] };
		});
	}

	forward(version: string, account: DemoAccount, taskId: string): ClinicalState {
		const { role } = account;
		if (!isRecipient(role)) throw new ReviewError('Choose a valid receiving role.', 400);
		return this.change(version, ['forward', account.id, taskId], (record, _practice, notice) => {
			const { state } = requireOwner(record, account);
			if (state.flow === 'admin-nurse-doctor') {
				if (role !== 'Nurse' || taskId !== 'review-report') {
					throw new ReviewError('Only Nurse can send the documented report-review task onward.', 400);
				}
				if (!state.imageStatus && (!notice || notice.status === 'needs-review')) {
					throw new ReviewError('Record the comparison image status before forwarding an unclear receipt.', 400);
				}
			}
			return send(state, taskId, account, plannedReportDoctor(state).id);
		});
	}

	recordImageStatus(version: string, account: DemoAccount, status: string): ClinicalState {
		if (account.role !== 'Nurse') throw new ReviewError('This action requires the assigned nurse.', 400);
		const observation = checkedStatus(status);
		return this.change(version, ['image-status', account.id, status], (record) => {
			const { state, active } = requireOwner(record, account);
			if (active.taskId !== 'check-images') throw new ReviewError('This assignment does not cover comparison images.', 400);
			return { ...state, imageStatus: { status: observation, recordedBy: account.name, recordedByAccountId: account.id, recordedAt: new Date().toISOString() } };
		});
	}

	signReview(version: string, account: DemoAccount): ClinicalState {
		if (account.role !== 'Doctor') throw new ReviewError('This action requires the assigned doctor.', 400);
		return this.change(version, ['sign-review', account.id], (record, _practice, notice) => {
			const { state, active } = requireOwner(record, account);
			if (active.taskId !== 'review-report') throw new ReviewError('This assignment is not for report review.', 400);
			const reviewed = { reviewedBy: account.name, reviewedByAccountId: account.id, reviewedAt: new Date().toISOString() };
			const initial = state.imageStatus;
			const imageFollowup = initial && initial.status !== 'arrived' && state.flow === 'admin-nurse-doctor' && notice?.status !== 'received'
				? { initial, recipientAccountId: initial.recordedByAccountId, recipientName: initial.recordedBy,
					openedAt: reviewed.reviewedAt, openedBy: account.name, observations: [] }
				: undefined;
			return { ...state, status: 'reviewed', imageFollowup, history: [...state.history.slice(0, -1), { ...active, reviewed }] };
		});
	}

	updateImageFollowup(version: string, account: DemoAccount, status: string): ClinicalState {
		if (account.role !== 'Nurse') throw new ReviewError('This follow-up requires the assigned nurse.', 400);
		const observation = checkedStatus(status);
		return this.change(version, ['image-followup', account.id, observation], state => {
			const followup = state?.imageFollowup;
			if (!state || !followup || followup.resolvedAt || followup.recipientAccountId !== account.id) {
				throw new ReviewError('There is no open image follow-up assigned to this account.');
			}
			const at = new Date().toISOString();
			return {
				...state,
				imageStatus: { status: observation, recordedAt: at, recordedBy: account.name, recordedByAccountId: account.id },
				imageFollowup: { ...followup, resolvedAt: observation === 'arrived' ? at : undefined,
					observations: [...followup.observations, { id: randomUUID(), at, by: account.name, status: observation }] }
			};
		});
	}

	returnToAdmin(version: string, account: DemoAccount, reason: string): ClinicalState {
		if (account.role !== 'Doctor') throw new ReviewError('This action requires the assigned doctor.', 400);
		const text = reason.trim();
		if (!text || text.length > 500) throw new ReviewError('Give a return reason of 1 to 500 characters.', 400);
		return this.change(version, ['return-to-admin', account.id, text], (record) => {
			const { state, active } = requireOwner(record, account);
			if (active.taskId !== 'review-report') throw new ReviewError('This assignment is not for report review.', 400);
			const returned = { reason: text, returnedBy: account.name, returnedByAccountId: account.id, returnedAt: new Date().toISOString() };
			return { ...state, status: 'returned', history: [...state.history.slice(0, -1), { ...active, returned }] };
		});
	}

	reassign(version: string, account: DemoAccount, doctorId: string): ClinicalState {
		requireAdministrator(account);
		const doctor = doctorAccounts.find((candidate) => candidate.id === doctorId);
		if (!doctor) throw new ReviewError('Choose a doctor account.', 400);
		return this.change(version, ['reassign', account.id, doctorId], (state) => {
			const active = state?.history.at(-1);
			if (!state || state.status !== 'returned' || !active?.returned || active.recipient !== 'Doctor') {
				throw new ReviewError('A returned doctor assignment is required before reassigning.');
			}
			if (recipientId(active) === doctor.id) throw new ReviewError('Choose a different doctor.', 400);
			const rerouted = send(state, active.taskId, account, doctor.id);
			const accountId = recipientId(active);
			rerouted.history.at(-1)!.reassignedFrom = {
				accountId, assignmentId: active.id, name: active.recipientName ?? doctorAccounts.find((candidate) => candidate.id === accountId)!.name
			};
			const plans = state.carePlans ?? [];
			const visitId = clinicalDocument.visitId;
			const prior = plans.findLast((plan) => plan.visitId === visitId);
			const revised: CarePlan = {
				receivingFacility: '', receivingDepartment: '', priority: 'unspecified', impact: '',
				...prior, ...visitEntry(state, visitId, account), doctorId: doctor.id, doctorName: doctor.name
			};
			return { ...rerouted, carePlans: [...plans, revised] };
		});
	}

	saveNote(version: string, account: DemoAccount, visitId: string, noteText: string): ClinicalState {
		requireAdministrator(account);
		const text = noteText.trim();
		if (!text || text.length > 1000) throw new ReviewError('Enter an operational note of 1 to 1,000 characters.', 400);
		return this.change(version, ['save-note', account.id, visitId, text], (record) => {
			const state = requireBrief(record);
			const entry = { ...visitEntry(state, visitId, account), text };
			return { ...state, operationalNotes: [...(state.operationalNotes ?? []), entry] };
		});
	}

	saveCarePlan(
		version: string, account: DemoAccount, visitId: string, doctorId: string, facility: string,
		priority = 'unspecified', impactText = '', department = ''
	): ClinicalState {
		requireAdministrator(account);
		const receivingFacility = facility.trim();
		const receivingDepartment = department.trim();
		const impact = impactText.trim();
		if (receivingFacility.length > 120) throw new ReviewError('Use a facility name of no more than 120 characters.', 400);
		if (receivingDepartment.length > 120 || impact.length > 200) {
			throw new ReviewError('Use up to 120 characters for the department and 200 for the coordination impact.', 400);
		}
		if (priority !== 'unspecified' && priority !== 'routine' && priority !== 'urgent' && priority !== 'critical') {
			throw new ReviewError('Choose a valid planning priority.', 400);
		}
		const doctor = doctorAccounts.find((candidate) => candidate.id === doctorId);
		if (doctorId && !doctor) throw new ReviewError('Choose a doctor account.', 400);
		return this.change(version, ['save-care-plan', account.id, visitId, doctorId, receivingFacility, priority, impact, receivingDepartment], (record) => {
			const state = requireBrief(record);
			const entry: CarePlan = {
				...visitEntry(state, visitId, account), doctorId: doctor?.id ?? null,
				doctorName: doctor?.name ?? null, receivingFacility, priority, impact, receivingDepartment
			};
			const plans = state.carePlans ?? [];
			const prior = plans.findLast((plan) => plan.visitId === visitId);
			if (prior?.doctorId === entry.doctorId && prior.receivingFacility === receivingFacility &&
				prior.priority === priority && prior.impact === impact && prior.receivingDepartment === receivingDepartment) return state;
			return { ...state, carePlans: [...plans, entry] };
		});
	}

	requestPriorStudy(version: string, account: DemoAccount): ClinicalState {
		if (account.role !== 'Administrative staff') throw new ReviewError('A prior-study request requires the triage agent.', 400);
		return this.change(version, ['request-prior-study', account.id], (state) => {
			if (state?.priorStudyRequest) return state;
			if (!state || state.summary.issues.length || !state.summary.adminAction) {
				throw new ReviewError('A verified request from the chart is required.', 400);
			}
			return {
				...state,
				priorStudyRequest: {
					...state.summary.adminAction, requestedBy: account.name, requestedByAccountId: account.id,
					requestedAt: new Date().toISOString(), status: 'Queued for imaging records'
				}
			};
		});
	}

	receiveImagingDelivery(version: string, receipt: { patientId: string; visitId: string; accession: string }): ImagingNotice {
		const key = createHash('sha256').update(JSON.stringify([version, 'imaging-delivery', receipt.patientId, receipt.visitId, receipt.accession])).digest('hex');
		const current = this.read();
		const notice = current.imagingNotice;
		if (!notice || receipt.patientId !== chartPatient.id || receipt.visitId !== clinicalDocument.visitId ||
			!receipt.accession || receipt.accession !== notice.accession) {
			throw new ReviewError('The file delivery does not match this patient, visit and study.', 400);
		}
		if (notice.receivedVia === 'matched-delivery' && (notice.deliveryVersion === version || current.lastRequest === key)) return notice;
		if (current.version !== version) throw new ReviewError('This practice chart changed. Refresh before receiving the file.');
		if (notice.status === 'received') return notice;
		if (notice.status !== 'requested') throw new ReviewError('Match the source documents before filing this delivery.', 400);
		const receivedAt = new Date().toISOString();
		const received: ImagingNotice = { ...notice, status: 'received', receivedVia: 'matched-delivery', deliveryVersion: version,
			receivedAt, message: 'The earlier images for study ' + receipt.accession + ' are available in Jordan’s chart.' };
		const data = current.data;
		const followup = data?.imageFollowup;
		if (data && followup && !followup.resolvedAt) {
			followup.resolvedAt = receivedAt;
			followup.observations.push({ id: randomUUID(), status: 'arrived', at: receivedAt, by: notice.recipient });
		}
		const saved = this.db.prepare('UPDATE clinical_handoff SET imaging_notice=?, data=?, version=?, last_request=? WHERE singleton=1 AND version=?')
			.run(JSON.stringify(received), data && JSON.stringify(data), randomUUID(), key, version);
		if (!saved.changes) {
			const after = this.read();
			if (after.imagingNotice?.receivedVia === 'matched-delivery' && (after.lastRequest === key || after.imagingNotice.deliveryVersion === version)) return after.imagingNotice;
			throw new ReviewError('This practice chart changed. Refresh before receiving the file.');
		}
		return received;
	}

	reset(version: string): void {
		this.change(version, ['reset'], () => null, () => null);
	}

	randomize(version: string, account: DemoAccount): void {
		requireAdministrator(account);
		this.change(version, ['randomize', account.id], () => null, previous => {
			const accessions = ['MB-082-174', 'MB-082-326', 'MB-082-508', 'MB-082-632', 'MB-082-751', 'MB-082-893'];
			const statuses: ImageStatus[] = ['arrived', 'still-pending', 'unable-to-confirm'];
			const studies = accessions.filter(id => id !== previous?.accession);
			const replies = statuses.filter(status => status !== previous?.status);
			return { accession: studies[randomInt(studies.length)], status: replies[randomInt(replies.length)] };
		});
	}
}

export function clinicalStore() { return packetStore().clinical; }

export function chartSnapshot(record: ClinicalState | null, practice: PracticeRound | null = null) {
	const documents = record?.sources ?? practiceDocuments(practice).map((document) =>
		record && document.id === 'ED-104' ? { ...document, text: record.sourceText } : document
	);
	return { patient: chartPatient, documents };
}

export function documentedEncounters(documents: ChartDocument[]) {
	const sources = [
		{ id: 'ED-082-intake', match: /^Visit services: (.+)$/, description: '' },
		{ id: 'ED-104', match: /^Prepared by: ([^|]+) \| Transfer packet closed at \d{2}:\d{2}$/, description: 'Prepared the transfer packet' },
		{ id: 'ED-104-radiology', match: /^Signed by (.+?) \(fictional\)\.$/, description: 'Signed the final radiology report' }
	];
	return sources.flatMap(({ id, match, description }) => {
		const document = documents.find((item) => item.id === id);
		if (!document) return [];
		const lines = document.text.split(/\r?\n/);
		const index = lines.findIndex((line) => match.test(line));
		if (index < 0) return [];
		const quote = lines[index];
		const recorded = match.exec(quote)![1].trim();
		return [{
			visitId: document.visitId, facility: chartPatient.hospital, clinician: description ? recorded : null,
			description: description || recorded, evidence: { documentId: id, line: index + 1, quote }
		}];
	});
}
