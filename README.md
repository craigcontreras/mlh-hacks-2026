# Intake Desk

Intake Desk helps hospital staff answer a question during transfer: **Which information can I pass on, and where did it come from?** A clerk cross-checks current paperwork against earlier visits, signs a records request and routes a documented task. A doctor and nurse receive the task in their own workspaces. All people, facilities, records and images in this demo are fictional.

## Run locally

The demo was built with Node.js 26.3.1 and npm 11.16.0. Install the Codex CLI on the demo machine and sign in with your own account for model extraction. The server uses the same CLI login as your terminal. Check the CLI supports the flags in `codex exec --help`, including `--ignore-user-config`, `--output-schema` and `--ephemeral`. The demo was tested with Codex CLI 0.163.0.

```sh
npm ci
codex login status
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. If you need to sign in, run `codex login`. The template parser also works offline. Each teammate can use a separate checkout and database. Use one laptop for the demo so both views read the same SQLite file.

## Three-minute walkthrough

Open **/login** on the running app. Each account has its own passcode and server-side role. **Fill passcode** enters the displayed demo credential. For a live presentation, sign into three separate browser profiles on the same laptop, or sign out between staff members in one window.

| Account | Demo passcode | Workspace |
| --- | --- | --- |
| Maya Chen · administrative staff | `maya-demo-104` | Compare records, queue the imaging request, sign and send the initial handoff. |
| Dr. Avery Shah · doctor | `avery-demo-104` | Receive the report-review task, inspect its sources and sign the documented nurse task onward. |
| Riley Ortiz · nurse | `riley-demo-104` | Receive the image-status task, inspect its sources and acknowledge receipt. |

1. **Maya receives Jordan Vale’s transfer.** Open **Summarize with Codex**. The parser reads five documents spanning two visits and the printed identifiers on a synthetic current-visit X-ray. Click a source in the brief to open its original document line. The impression comes from the signed radiology report.
2. **Find the missing comparison.** The older visit’s archive lists study **MB-082-LA**. Today’s registration checklist says its images have yet to be attached. Inspect those two lines, then sign the request to Imaging Records. Its local queue receipt records Maya and the time. The image attachment status stays pending.
3. **Pass an approved action to the next worker.** Maya signs the report-review task for the doctor. Open Avery’s inbox, acknowledge the message, then sign the remaining image-status task for Riley. In Riley’s inbox, inspect the cited instruction and acknowledge receipt. Refresh to see the saved chain.
4. **Explore patient history.** Open **Patient records** and search by name, chart number or visit. Jordan has an active transfer. Casey Rowan has four documents across two completed visits, including a prior intake preference and a delivery receipt. Casey’s chart is available for lookup.

The [transfer PDF](samples/records/ED-104-transfer-note.pdf), [source text](samples/records/ED-104-transfer-note.txt), [synthetic X-ray](samples/records/ED-104-ankle.png) and [visit records](samples/records) are bundled with the repository. The local parser supports an offline rehearsal. It reads the labels from the image manifest and identifies that method in the brief.

## Registration packet walkthrough

1. Open **Corrected transfer** in registration and parse with Codex. Inspect the two sources for Avery Example and Cedar House. Compare the transfer form’s callback **214** with the signed amendment’s **241**.
2. Select the amendment, approve for the registration desk, then open the receiving view. Inspect the callback source and refresh to see the same approval time.
3. Open **Ambiguous transfer**. Choose the local parser for a fast second example. The unsigned conflict blocks approval. Hold it for clarification and return to the receiving desk. The held packet stays with intake.
4. **Consistent transfer** demonstrates a one-click sign-off after extraction. Reset from the individual sample to clear its draft and any receipt before another rehearsal.

For the Design entry, run the five-minute volunteer task and record one observed issue, the change made and the retest result. The form and judging plan are in [SPEC.md](SPEC.md). [Meeting questions and project answers](docs/meeting-questions.md) covers the team's open questions.

## Extraction and storage

**Codex** receives the selected synthetic chart in a temporary CLI session with a read-only sandbox. For Jordan’s handoff, the current image is passed as an image attachment alongside numbered text. The verifier checks patient and visit identity, the original quotes, signed report agreement, study identifiers, documented ownership, and the printed image markers. An inconsistent or incomplete draft blocks sign-off. The generated X-ray illustrates the current visit. Clinical findings are quoted from a fictional signed report. The supported fixtures have a known structure.

**SQLite** stores signed tasks, acknowledgment times, the named records request and reviewed document snapshots at `.data/intake.sqlite` by default. The server derives the signer and recipient permissions from the signed-in account. Repeating a request or refreshing the app preserves the receipt. Demo sessions expire and require another sign-in after a server restart. Use the app on loopback with the bundled synthetic data. Imaging Records and the staff inboxes are local to this demo.

Optional server settings are `INTAKE_DB_PATH` for a different SQLite file and `INTAKE_CODEX_MODEL` to choose a model available to your CLI account. The event laptop uses `INTAKE_DB_PATH=.data/role-demo.sqlite` for this walkthrough. Set the same path when restarting to reopen the same handoffs. Maya can use **Demo controls → Reset handoff demo** to rehearse Jordan’s transfer from the beginning.

## Checks

```sh
npx playwright install chromium
npm run check
npm run lint
npm test
npm run build
```

Tests exercise signed corrections, ambiguous and matching packets, model provenance, SQLite persistence, repeated approval, stale requests and a failed storage write.
