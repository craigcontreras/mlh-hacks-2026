# Intake Desk

Intake Desk helps hospital staff answer a question during transfer: **Which information can I pass on, and where did it come from?** A clerk cross-checks current paperwork against earlier visits and sends the documented follow-up to nursing. The assigned nurse records image status and sends the report to the doctor. The doctor signs the review or sends the assignment back to the clerk. All people, facilities, records and images in this demo are fictional.

## Run locally

The demo was built with Node.js 26.3.1 and npm 11.16.0. Install the Codex CLI on the demo machine and sign in with your own account for model extraction. The server uses the same CLI login as your terminal. Check the CLI supports the flags in `codex exec --help`, including `--ignore-user-config`, `--output-schema` and `--ephemeral`. The demo was tested with Codex CLI 0.163.0.

```sh
npm ci
codex login status
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. If you need to sign in, run `codex login`. The template parser also works offline. Each teammate can use a separate checkout and database. Use one laptop for the demo so both views read the same SQLite file.

## Three-minute walkthrough

Open **/login** and select an account. **Fill passcode** enters its demo credential. Sign out to switch users in the same window. Separate browser profiles also work when they point to the same local server.

| Account | Demo passcode | Workspace |
| --- | --- | --- |
| Maya Chen · administrative staff | `maya-demo-104` | Request records, maintain operational notes and planned destinations, and route or reassign the handoff. |
| Riley Ortiz · nurse | `riley-demo-104` | Record comparison image status and sign the report-review task onward. |
| Dr. Avery Shah · doctor | `avery-demo-104` | Open the source report and sign the review or return the task with a reason. |
| Dr. Morgan Lee · doctor | `morgan-demo-104` | Open a reassigned review from an independent inbox. |

1. **Maya opens Jordan Vale’s transfer** and selects **Prepare transfer brief** to use the local parser. For model extraction, choose **Parser options → Summarize with Codex**. Expand **Compare current and prior records**. The prior imaging archive lists study **MB-082-LA**, and the current transfer checklist says its images are still outstanding. Click either source to see the highlighted passage in the original document.
2. **Maya sends the documented image check to Riley.** To show the archive request first, expand **Request the prior study (optional)**. The request enters the local Imaging Records queue. **Sign and send to nurse** assigns the check. Open **Visit history and plan editor** to see earlier visits or change a destination.
3. **Riley opens Jordan from My inbox.** Record **Still pending** for the comparison images. Sign and send the documented report-review task to the doctor. The nursing update is visible on the doctor’s assignment.
4. **Avery opens Jordan from My inbox.** Inspect the signed report and sign the review. To demonstrate reassignment, return the handoff instead and enter a reason. Maya opens the returned task and reassigns it to Morgan. Morgan then signs from their own inbox. The history shows the return, the new owner and the signed review.

A plan can record the next doctor, facility, department, staff-entered priority and coordination impact. Same-hospital updates show an internal handoff. A different facility shows a planned external transfer. Original documents, saved plan revisions and the signed handoff each retain their own provenance.

The [transfer PDF](samples/records/ED-104-transfer-note.pdf), [source text](samples/records/ED-104-transfer-note.txt), [synthetic X-ray](samples/records/ED-104-ankle.png) and [visit records](samples/records) are bundled. Select the local parser for an offline rehearsal. Its image labels come from the file manifest.

## Registration packet walkthrough

1. Open **Corrected transfer** in registration and parse with Codex. Inspect the two sources for Avery Example and Cedar House. Compare the transfer form’s callback **214** with the signed amendment’s **241**.
2. Select the amendment, approve for the registration desk, then open the receiving view. Inspect the callback source and refresh to see the same approval time.
3. Open **Ambiguous transfer**. Choose the local parser for a fast second example. The unsigned conflict blocks approval. Hold it for clarification and return to the receiving desk. The held packet stays with intake.
4. **Consistent transfer** demonstrates a one-click sign-off after extraction. Reset from the individual sample to clear its draft and any receipt before another rehearsal.

For the Design entry, run the five-minute volunteer task and record one observed issue, the change made and the retest result. The form and judging plan are in [SPEC.md](SPEC.md). [Meeting questions and project answers](docs/meeting-questions.md) covers the team's open questions.

## Extraction and storage

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
