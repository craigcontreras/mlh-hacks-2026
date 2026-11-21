# Intake Desk

A doctor or administrative worker receives a transfer note and generates a brief with links to the original lines. The reviewer signs a documented follow-up for a doctor or nurse. The recipient can acknowledge receipt and sign the other documented task onward. A separate registration workflow handles conflicting administrative fields. All documents, people, facilities and signatures in this demo are fictional.

## Run locally

The demo was built with Node.js 26.3.1 and npm 11.16.0. Install the Codex CLI on the demo machine and sign in with your own account for model extraction. The server uses the same CLI login as your terminal. Check the CLI supports the flags in `codex exec --help`, including `--ignore-user-config`, `--output-schema` and `--ephemeral`. The demo was tested with Codex CLI 0.163.0.

```sh
npm ci
codex login status
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. If you need to sign in, run `codex login`. The template parser also works offline. Each teammate can use a separate checkout and database. Use one laptop for the demo so both views read the same SQLite file.

## Three-minute walkthrough

1. Open **Handoff review**. The [synthetic transfer note (PDF)](static/samples/ED-104-transfer-note.pdf) includes an ED narrative, a radiology attachment and two instructions for the receiving staff. The app reads the corresponding [numbered source text](static/samples/ED-104-transfer-note.txt).
2. Choose **Summarize with Codex**. Compare the available report with the pending comparison images. Open the source link for the radiology impression to see its complete original wording. The method and elapsed time come from the actual run.
3. Choose the documented report-review task and sign as **Administrative staff**. Send it to the **Doctor** inbox. The doctor can see the approved task, the full brief, the highlighted source, who sent it and when.
4. Acknowledge receipt as the doctor, then sign the remaining image-status task for the **Nurse**. Open the nurse inbox and trace both handoffs. Acknowledging a message records receipt. Clinical work completion is outside this demo.

For a second pass, start with a doctor reviewer and route the nurse task first. Only an explicitly signed action enters an inbox. Role selection simulates the different workers on one laptop. The local parser is available for offline rehearsals. Open **Demo controls** on the review page to reset this sample.

## Registration packet walkthrough

1. Open **Corrected transfer** in registration and parse with Codex. Inspect the two sources for Avery Example and Cedar House. Compare the transfer form’s callback **214** with the signed amendment’s **241**.
2. Select the amendment, approve for the registration desk, then open the receiving view. Inspect the callback source and refresh to see the same approval time.
3. Open **Ambiguous transfer**. Choose the local parser for a fast second example. The unsigned conflict blocks approval. Hold it for clarification and return to the receiving desk. The held packet stays with intake.
4. **Consistent transfer** demonstrates a one-click sign-off after extraction. Reset from the individual sample to clear its draft and any receipt before another rehearsal.

For the Design entry, run the five-minute volunteer task and record one observed issue, the change made and the retest result. The form and judging plan are in [SPEC.md](SPEC.md). [Meeting questions and project answers](docs/meeting-questions.md) covers the team's open questions.

## Extraction and storage

**Codex** sends only the selected bundled synthetic text, labeled with document IDs and line numbers, to a signed-in Codex session. The server invokes the CLI in a temporary directory with a read-only sandbox and a structured output schema. It checks every returned value and citation against the fixture. Missing, duplicate or unsupported evidence blocks approval. If the CLI times out or is unavailable, retry or explicitly select the local parser. The UI identifies which method produced each draft. For the ED note, the brief extracts four source-backed facts and the two assignments written in the note. The verifier checks role, line, full wording, and qualifiers. It blocks sign-off when evidence is missing or inconsistent. This demo accepts the bundled text templates.

**SQLite** lives at `.data/intake.sqlite` by default. A single write stores the approved values and evidence with the reviewer's demo identity, destination, extraction method and timestamp. Repeated approval reads the existing receipt. Stale edits cannot replace a newer draft. The demo reset removes only the selected sample's local record. The new handoff flow stores a copy of the source text, the signed chain of recipients and acknowledgment times alongside the brief. Reviewer and recipient roles are demo identities. Run this on loopback with bundled fictional records.

Optional server settings are `INTAKE_DB_PATH` for a different SQLite file and `INTAKE_CODEX_MODEL` to choose a model available to your CLI account. Set these in the shell when starting the app.

## Checks

```sh
npx playwright install chromium
npm run check
npm run lint
npm test
npm run build
```

Tests exercise signed corrections, ambiguous and matching packets, model provenance, SQLite persistence, repeated approval, stale requests and a failed storage write.
