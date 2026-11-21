# Intake Desk

Intake Desk is a shared patient portal for the fictional Mossbridge Community Hospital. Administrative staff, doctors, and nurses can see the latest recorded update, open the original document, and find who owns the next task. One chart follows care inside the hospital. A second follows an imaging report through a transfer and reassignment. All patients, staff, records and images are synthetic.

## Run locally

The demo was built with Node.js 26.3.1 and npm 11.16.0. For the local PDF demonstration, put Poppler’s `pdftotext` on your path (`brew install poppler` on macOS).

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. For optional model extraction, install the Codex CLI and run `codex login` under your own account. The server uses that CLI login. This path was tested with Codex CLI 0.163.0. Use one server for the demo so all staff accounts see the same SQLite records.

## Three-minute walkthrough

Open **/login** and select an account. **Fill passcode** enters its demo credential. Sign out to switch users in the same window. Separate browser profiles also work when they point to the same local server.

Start in **Patient overview**. Open **Casey Rowan** for a visit within Mossbridge. In **Patient log**, open the nursing reassessment, physician progress note, and paperwork receipt to see what each person documented. Maya can use **Add coordination update** to record a new entry against a visit. Reopen Casey as a nurse or doctor to see the same dated entry and author. **All patients** shows both charts. **My assignments** filters to work currently assigned to the signed-in account or its administrative queue.

| Account | Demo passcode | Workspace |
| --- | --- | --- |
| Maya Chen · administrative staff | `maya-demo-104` | Request records, maintain operational notes and planned destinations, and route or reassign the handoff. |
| Riley Ortiz · nurse | `riley-demo-104` | Record comparison image status and sign the report-review task onward. |
| Dr. Avery Shah · doctor | `avery-demo-104` | Open the source report and sign the review or return the task with a reason. |
| Dr. Morgan Lee · doctor | `morgan-demo-104` | Open a reassigned review from an independent inbox. |

1. **Maya opens Jordan Vale → Open transfer workspace → Prepare transfer brief** to use the local parser. For model extraction, choose **Parser options → Summarize with Codex**. Expand **Compare current and prior records**. The prior imaging archive lists study **MB-082-LA**, and the current transfer checklist says its images are still outstanding. Click either source to see the highlighted passage in the original document.
2. **Maya sends the documented image check to Riley.** To show the archive request first, expand **Request the prior study (optional)**. The request enters the local Imaging Records queue. **Sign and send to nurse** assigns the check. Open **Visit history and plan editor** to see earlier visits or change a destination.
3. **Riley opens My inbox → Jordan Vale.** Casey’s completed paperwork check has its own page. For Jordan, choose **Still pending → Record image status → Sign and send report to doctor**. Riley’s observation goes to Dr. Avery Shah by default. The source link shows where the sending team requested the review.
4. **Avery opens My inbox → Jordan Vale → Read signed radiology impression.** For the reassignment demo, select **Return to administrative staff**, enter “Called to another patient,” and click **Return handoff to admin**. Maya opens Jordan’s transfer workspace, selects **Dr. Morgan Lee**, and clicks **Sign and reassign**. Morgan opens Jordan in **My inbox**, checks the report and clicks **Sign report review**.
5. **Riley closes the outstanding image check.** Morgan’s signature creates a follow-up for Riley because the prior images were still pending. Back in Jordan’s inbox page, choose **Arrived → Save follow-up status**. The patient log retains both the signature and the later image update. If Riley had recorded **Arrived** before the doctor signed, the workflow would already be complete.

Use the [illustrated doctor walkthrough](docs/Jordan-doctor-walkthrough.pdf) to rehearse. When demonstrating the sign-off, say “Morgan can review today’s report now. Riley still owns the missing images, and both decisions are recorded in Jordan’s chart.”

A plan can record the next doctor, facility, department, staff-entered priority and coordination impact. Same-hospital updates show an internal handoff. A different facility shows a planned external transfer. Original documents, saved plan revisions and the signed handoff each retain their own provenance.

Jordan’s [transfer note](samples/records/ED-104-transfer-note.pdf), [signed radiology report](samples/records/ED-104-radiology.pdf) and [two-view synthetic X-ray](samples/records/ED-104-ankle.png) are bundled. Casey has a separate [physician progress note](samples/records/ED-116-physician.pdf). A document opens to a short summary. **See passage** opens the cited text, with the matching PDF available in the source viewer.

## Registration packet walkthrough

1. Open **Corrected transfer** in registration and parse with Codex. Inspect the two sources for Avery Example and Cedar House. Compare the transfer form’s callback **214** with the signed amendment’s **241**.
2. Select the amendment, approve for the registration desk, then open the receiving view. Inspect the callback source and refresh to see the same approval time.
3. Open **Ambiguous transfer**. Choose the local parser for a fast second example. The unsigned conflict blocks approval. Hold it for clarification and return to the receiving desk. The held packet stays with intake.
4. **Consistent transfer** demonstrates a one-click sign-off after extraction. Reset from the individual sample to clear its draft and any receipt before another rehearsal.

For the Design entry, run the five-minute volunteer task and record one observed issue, the change made and the retest result. The form and judging plan are in [SPEC.md](SPEC.md). [Meeting questions and project answers](docs/meeting-questions.md) covers the team's open questions.

## Extraction and storage

**Prepare transfer brief** reads Jordan’s two original PDFs with Poppler, compares the extracted passages with the bundled transcripts, and checks them against three other records. If Poppler is unavailable, the demo can use its verified transcripts and labels that method on the brief. The local parser uses the image manifest for printed labels. The signed radiology report supplies the findings.

On the event laptop, ten production-preview runs took **49–120 ms from clicking Prepare transfer brief to seeing Sign and send to nurse**, with a **50 ms median**. Server PDF extraction and verification took 12–34 ms. These measurements cover the bundled Jordan packet using Poppler. The optional full Codex extraction took 16.6 seconds in a separate run and passed the same source checks.

**Codex** receives the selected synthetic chart in a temporary CLI session with a read-only sandbox. For Jordan’s handoff, the current image is passed as an image attachment alongside numbered text. The verifier checks patient and visit identity, the original quotes, signed report agreement, study identifiers, documented ownership, and the printed image markers. An inconsistent or incomplete draft blocks sign-off. The generated X-ray illustrates the current visit. Clinical findings are quoted from a fictional signed report. The supported fixtures have a known structure.

**SQLite** stores signed tasks, nurse status, doctor review or return, the named records request, operational note and plan revisions, and reviewed document snapshots at `.data/intake.sqlite` by default. The server derives the signer and recipient permissions from the signed-in account. Repeating a request or refreshing the app preserves the receipt. Demo sessions expire and require another sign-in after a server restart. Use the app on loopback with the bundled synthetic data. Imaging Records and the staff inboxes are local to this demo.

Optional server settings are `INTAKE_DB_PATH` for a different SQLite file and `INTAKE_CODEX_MODEL` to choose a model available to your CLI account. The event laptop uses `INTAKE_DB_PATH=.data/workflow-demo.sqlite` for this walkthrough. Set the same path when restarting to reopen the same handoffs. Maya can use **Demo controls → Reset handoff demo** to rehearse Jordan’s transfer from the beginning.

## Checks

```sh
npx playwright install chromium
npm run check
npm run lint
npm test
npm run build
```

Tests exercise signed corrections, ambiguous and matching packets, model provenance, SQLite persistence, repeated approval, stale requests and a failed storage write.
