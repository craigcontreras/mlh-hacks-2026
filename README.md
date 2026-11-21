# Intake Desk

An ER registration clerk reviews facts extracted from a synthetic transfer packet, checks the source of each field, and approves a handoff to the registration desk. The receiving view shows the approved values, source lines, reviewer and time. All documents, people, facilities and signatures in this demo are fictional.

## Run locally

The demo was built with Node.js 26.3.1 and npm 11.16.0. Install the Codex CLI on the demo machine and sign in with your own account for model extraction. The server uses the same CLI login as your terminal. Check the CLI supports the flags in `codex exec --help`, including `--ignore-user-config`, `--output-schema` and `--ephemeral`. The demo was tested with Codex CLI 0.163.0.

```sh
npm ci
codex login status
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. If you need to sign in, run `codex login`. The template parser also works offline. Each teammate can use a separate checkout and database. Use one laptop for the demo so both views read the same SQLite file.

## Three-minute walkthrough

1. Open **Corrected transfer** and parse with Codex. Inspect the two sources for Avery Example and Cedar House. Compare the transfer form’s callback **214** with the signed amendment’s **241**.
2. Select the amendment, approve for the registration desk, then open the receiving view. Inspect the callback source and refresh to see the same approval time.
3. Open **Ambiguous transfer**. Choose the local parser for a fast second example. The unsigned conflict blocks approval. Hold it for clarification and return to the receiving desk. The held packet stays with intake.
4. **Consistent transfer** demonstrates a one-click sign-off after extraction. Reset from the individual sample to clear its draft and any receipt before another rehearsal.

For the Design entry, run the five-minute volunteer task and record one observed issue, the change made and the retest result. The form and judging plan are in [SPEC.md](SPEC.md). [Meeting questions and project answers](docs/meeting-questions.md) covers the team's open questions.

## Extraction and storage

**Codex** sends only the selected bundled synthetic text, labeled with document IDs and line numbers, to a signed-in Codex session. The server invokes the CLI in a temporary directory with a read-only sandbox and a structured output schema. It checks every returned value and citation against the fixture. Missing, duplicate or unsupported evidence blocks approval. If the CLI times out or is unavailable, retry or explicitly select the local parser. The UI identifies which method produced each draft.

**SQLite** lives at `.data/intake.sqlite` by default. A single write stores the approved values and evidence with the reviewer's demo identity, destination, extraction method and timestamp. Repeated approval reads the existing receipt. Stale edits cannot replace a newer draft. The demo reset removes only the selected sample's local record. The reviewer is a fixed demo identity. Run this on loopback with bundled fictional records.

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
