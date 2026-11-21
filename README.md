# Intake Desk

Intake Desk is a shared patient portal for the fictional Mossbridge Community Hospital. Administrative staff, doctors, and nurses can see the latest recorded update, open the original document, and find who owns the next task. One chart follows care inside the hospital. A second follows an imaging report through a transfer and reassignment. All patients, staff, records and images are synthetic.

## Run locally

The demo was built with Node.js 26.3.1 and npm 11.16.0. For the local PDF demonstration, put Poppler’s `pdftotext` on your path (`brew install poppler` on macOS).

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. For optional model extraction, install the Codex CLI and run `codex login` under your own account. The server uses that CLI login. This path was tested with Codex CLI 0.163.0. Use one server for the demo so all staff accounts see the same SQLite records.

## Watch the walkthrough

Open **Glossary → Watch the walkthrough** to follow Jordan from Riley’s inbox to the doctor’s signed review. [Download the narrated video](docs/Intake-Desk-walkthrough.mp4)

## Show the benefit in 30 seconds

Let Craig drive as Riley Ortiz and Yousif narrate. Use the original Jordan sample. If someone has already rehearsed, Maya can restart it under **Open transfer workspace → Demo controls → Reset handoff demo**. Reset is a presenter control.

1. Sign in as **Riley Ortiz → My inbox → Jordan Vale**. “Riley is the first person to open the chart. The earlier X-ray is already pending, and this task already belongs to Riley.”
2. Click **View imaging status**, then open **View request**. “The transfer checklist identifies the missing pictures. The archive supplies the matching study number, MB-082-LA. Imaging Records has the request, and Riley can see the same evidence.”
3. Return to Riley’s assignment. Click **Sign and send report to doctor**. “Today’s written report is available, so Avery can review it while the earlier pictures are on their way.”

For an AI example, open **Jordan Vale → Summary → Summary options → Order findings with Codex**. The signed-in Codex CLI orders the chart’s verified findings. The running app uses the source evidence to assign the task locally. The assignment can be opened even when the model is unavailable. [Visual dictionary](docs/Intake-Desk-visual-dictionary.pdf)

## End-of-day file check

Open **Patients → Jordan Vale → Documents** from any staff account to see which expected records are available and who is following up on anything outstanding. The September X-ray archive entry and the September picture are separate items. When the matching image arrives in the demo, **Open earlier X-ray** displays the shared copy. The original transfer note continues to show what was available at departure.

To share additional synthetic paperwork, choose **Add files to this chart**, select the visit, choose the files and click **File for care team**. Sign in as a different staff member and open the same patient’s Documents to read the files. The count covers the listed expected records and additional filed documents. A file from an outside facility must reach the chart before the team can open it.

## Three-minute walkthrough

**Open with Jordan’s problem.** “Jordan’s ankle was X-rayed today. The doctor’s written report is here. Pictures from an earlier visit were requested separately. How does the next person know which item is ready, where that information came from, and who is chasing the rest?”

For the first rehearsal, Craig can drive and Yousif can narrate. Swap for the second run. At **/login**, select a name, click **Fill passcode → Sign in**. To switch people, sign out and repeat. You can also sign into each account in a separate browser profile on the same laptop. The steps below follow the original Jordan sample. To rehearse this branch with the older images still outstanding, start a fresh original sample before simulating delivery.

<details>
<summary>Demo account passcodes for manual sign-in</summary>

| Maya Chen | Riley Ortiz | Dr. Avery Shah | Dr. Morgan Lee |
| --- | --- | --- | --- |
| `maya-demo-104` | `riley-demo-104` | `avery-demo-104` | `morgan-demo-104` |

</details>

| On screen | What the narrator can say |
| --- | --- |
| **Riley Ortiz · nurse.** Open **My inbox → Jordan Vale**. Read the pending image status and open **View imaging status → View request** to inspect the request and its supporting records. | “The chart gives Riley a check to follow and asks Imaging Records for the file. Both happened automatically when the packet was loaded.” |
| **Riley.** Return to the assignment and click **Sign and send report to doctor**. | “Riley reviews the handoff and sends today’s written report to Avery. Riley can add a new observation if something has changed.” |
| **Dr. Avery Shah · first doctor.** Open **My inbox → Jordan Vale → Read signed radiology impression**. Close the source. Expand **Return to administrative staff**, enter “Called to another patient,” and click **Return handoff to admin**. | “This is the original report author’s conclusion. Avery can read it, but another patient needs Avery’s attention. The return records why someone else must take this review.” |
| **Maya, then Dr. Morgan Lee.** As Maya, reopen Jordan’s transfer workspace. Choose **Dr. Morgan Lee → Sign and reassign**. As Morgan, open **My inbox → Jordan Vale → Read signed radiology impression**, close the source, and click **Sign report review**. Pause on the confirmation. | “Morgan just signed that they reviewed today’s report. The imaging request already exists. We can check its status on the chart.” |
| **Any care-team account.** Open Jordan’s **Documents** and show the Imaging Records receipt. As Maya use **Demo controls → Simulate file arrival**, then **Open earlier X-ray**. | “The next shift can see who reviewed the report and when the picture became available.” |

**Check you can explain it.** Ask your teammate to show who requested the earlier picture, who reviewed today’s report and which source supports each action. The answers are in the Imaging Records receipt and Morgan’s signed review. If you have one minute, Avery can sign directly.

**Rehearse a different answer.** In Maya’s transfer workspace, click **Reset and randomize sample**. Use the new study number to find the Imaging Records reply. A verified missing study produces a pending assignment in Riley’s inbox. An already available study needs no missing-file task. An unclear match goes to review.

**What you can claim.** You demonstrated a source lookup, a named handoff and a follow-up that survives sign-off. The timed result below measures how quickly the sample brief appears. Time saved by hospital staff or patients would require observation in a real workflow. [Timing and method](#extraction-and-storage) · [Illustrated doctor walkthrough](docs/Jordan-doctor-walkthrough.pdf)

**If a judge asks whether this is only for transfers**, open **Patient overview → Casey Rowan** and click **Patient log**. Show the nursing reassessment and physician progress note from the same hospital visit. Maya can add a dated entry with **Add coordination update**. Open Casey under another account to see the same update and author.

**Other controls for Jordan.** **Visit history and plan editor** shows the earlier visits and lets Maya edit a planned destination. On packets awaiting preparation, **Parser options → Summarize with Codex** runs optional model extraction. Chart-summary ordering is available after routing.

A plan can record the next doctor, facility, department, staff-entered priority and coordination impact. Same-hospital updates show an internal handoff. A different facility shows a planned external transfer. Original documents, saved plan revisions and the signed handoff each retain their own provenance.

Jordan’s [transfer note](samples/records/ED-104-transfer-note.pdf), [signed radiology report](samples/records/ED-104-radiology.pdf) and [two-view synthetic X-ray](samples/records/ED-104-ankle.png) are bundled. Casey has a separate [physician progress note](samples/records/ED-116-physician.pdf). A document opens to a short summary. **See passage** opens the cited text, with the matching PDF available in the source viewer.

## Registration packet walkthrough

1. Open **Corrected transfer** in registration and parse with Codex. Inspect the two sources for Avery Example and Cedar House. Compare the transfer form’s callback **214** with the signed amendment’s **241**.
2. Select the amendment, approve for the registration desk, then open the receiving view. Inspect the callback source and refresh to see the same approval time.
3. Open **Ambiguous transfer**. Choose the local parser for a fast second example. The unsigned conflict blocks approval. Hold it for clarification and return to the receiving desk. The held packet stays with intake.
4. **Consistent transfer** demonstrates a one-click sign-off after extraction. Reset from the individual sample to clear its draft and any receipt before another rehearsal.

For the Design entry, run the five-minute volunteer task and record one observed issue, the change made and the retest result. The form and judging plan are in [SPEC.md](SPEC.md). [Meeting questions and project answers](docs/meeting-questions.md) covers the team's open questions.

## Extraction and storage

The automatic route verifies the bundled transcripts against the original PDFs and matches the transfer note, archive and documented nursing task. On packets awaiting manual preparation, **Prepare transfer brief** reads Jordan’s two original PDFs with Poppler, compares the extracted passages with the bundled transcripts, and checks them against three other records. If Poppler is unavailable, the demo can use its verified transcripts and labels that method on the brief. The local parser uses the image manifest for printed labels. The signed radiology report supplies the findings.

In the earlier manual-preparation workflow on the event laptop, ten production-preview runs took **49–120 ms from clicking Prepare transfer brief to seeing Sign and send to nurse**, with a **50 ms median**. Server PDF extraction and verification took 12–34 ms. These measurements cover the bundled Jordan packet using Poppler. The optional full Codex extraction took 16.6 seconds in a separate run and passed the same source checks.

**Codex** receives the selected synthetic chart in a temporary CLI session with a read-only sandbox. For Jordan’s handoff, the current image is passed as an image attachment alongside numbered text. The verifier checks patient and visit identity, the original quotes, signed report agreement, study identifiers, documented ownership, and the printed image markers. An inconsistent or incomplete draft blocks sign-off. The generated X-ray illustrates the current visit. Clinical findings are quoted from a fictional signed report. The supported fixtures have a known structure.

**SQLite** stores the automatic assignment, signed tasks, nurse observations, doctor review or return, the named records request, operational note and plan revisions, and reviewed document snapshots at `.data/intake.sqlite` by default. The server derives the signer and recipient permissions from the signed-in account. Repeating a request or refreshing the app preserves the receipt. Demo sessions expire and require another sign-in after a server restart. Use the app on loopback with the bundled synthetic data. Imaging Records and the staff inboxes are local to this demo.

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
