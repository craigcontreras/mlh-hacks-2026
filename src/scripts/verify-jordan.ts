// Run from the project root after npm run build. All writes go to a temporary SQLite database.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chromium, type Browser } from 'playwright';
import { preview, type PreviewServer } from 'vite';

const scratch = mkdtempSync(join(tmpdir(), 'jordan-rehearsal-'));
const filename = join(scratch, 'rehearsal.sqlite');
process.env.INTAKE_DB_PATH = filename;
let server: PreviewServer | undefined;
let browser: Browser | undefined;
let db: DatabaseSync | undefined;
try {
	server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
	const baseURL = server.resolvedUrls?.local[0];
	assert.ok(baseURL, 'The isolated preview must be listening.');
	browser = await chromium.launch();
	const page = await browser.newPage({ baseURL });
	page.setDefaultTimeout(8000);
	const submissions: string[] = [];
	page.on('request', request => {
		const url = new URL(request.url());
		if (request.method() === 'POST' && url.pathname !== '/login') submissions.push(url.search);
	});
	const step = (n: number) => page.locator(`[data-demo-step="${n}"]`);
	await page.goto('/login?guide=jordan');
	await step(1).click();
	await step(2).click();
	await step(3).waitFor();

	db = new DatabaseSync(filename, { readOnly: true });
	const saved = db.prepare(`SELECT json_array_length(data, '$.history') AS assignments,
		json_extract(data, '$.history[0].recipientName') AS nurse,
		json_extract(data, '$.history[0].assignmentOrigin') AS origin,
		json_extract(data, '$.history[#-1].reviewed.reviewedBy') AS signer,
		json_extract(data, '$.imageStatus') AS nursingObservation,
		json_extract(imaging_notice, '$.recipient') AS recordsOffice,
		json_extract(imaging_notice, '$.status') AS imageStatus,
		imaging_notice AS receipt, version FROM clinical_handoff WHERE singleton=1`);
	const initial = saved.get();
	assert.ok(initial);
	assert.equal(initial.assignments, 1);
	assert.equal(initial.nurse, 'Riley Ortiz');
	assert.equal(initial.origin, 'automatic');
	assert.equal(initial.recordsOffice, 'Imaging Records');
	assert.equal(initial.imageStatus, 'requested');
	const humanSubmissionsBeforeAssignment = submissions.length;
	assert.equal(humanSubmissionsBeforeAssignment, 0);
	for (let i = 0; i < 3; i++) {
		await page.reload();
		await step(3).waitFor();
		assert.deepEqual(saved.get(), initial, 'Reload must retain the same task and imaging request.');
	}

	await step(3).click(); // Riley sends today’s report to Avery.
	await step(4).click();
	await step(5).click();
	await page.locator('summary', { has: step(6), hasText: 'Return for reassignment' }).click();
	await page.getByRole('textbox', { name: /Step 7\..*Reason for returning/ }).fill('Covering a higher-priority case.');
	await page.getByRole('button', { name: 'Step 8. Return to triage agent' }).click();
	await step(9).click(); // Maya opens the returned assignment.
	await page.getByText('Triage agent · Demo', { exact: true }).waitFor();
	await page.getByRole('combobox', { name: /Step 10\..*New receiving doctor/ }).selectOption('doctor-morgan');
	await step(11).click();
	await step(12).click(); // Morgan opens the signed source before signing the review.
	await step(13).click();
	await step(14).click();
	assert.match(await page.locator('dialog .highlight').innerText(), /Impression:/);
	await step(15).click();
	await step(16).click();
	await page.getByRole('heading', { name: 'Report review signed' }).waitFor();
	const final = saved.get();
	assert.ok(final);
	assert.equal(final.nursingObservation, null);
	assert.equal(final.receipt, initial.receipt);
	assert.equal(final.imageStatus, 'requested');
	assert.equal(final.signer, 'Dr. Morgan Lee');
	assert.deepEqual(submissions, ['?/forward', '?/returnToAdmin', '?/reassign', '?/signReview']);
	console.log(
		`Jordan passed all 16 steps. ${humanSubmissionsBeforeAssignment} human submissions before Riley. ` +
		`${initial.assignments} nursing assignment and the same imaging request after 3 reloads. ` +
		`${submissions.length} staff decisions. ${final.signer} signed with the earlier image still ${final.imageStatus}.`
	);
} finally {
	db?.close();
	await browser?.close();
	await server?.close();
	rmSync(scratch, { recursive: true, force: true });
}
