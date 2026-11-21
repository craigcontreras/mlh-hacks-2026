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

Open **Glossary → Watch the walkthrough** to rehearse Jordan’s case. Follow Maya’s sign-off, Riley’s image check, Avery’s return and Morgan’s signed review. Use **Reset and randomize sample** in Maya’s transfer workspace when you want another round. [Download the narrated video](docs/Intake-Desk-walkthrough.mp4)

## Show the benefit in 30 seconds

Sign in as Maya, open **Patients → Jordan Vale**, and read the five bullets under **Chart summary**. Ask the audience, “Which X-rays does the doctor already have a report for, and which pictures still need checking?”

1. Click **Imaging result**. The **Ontology** tab follows that finding from the signed radiology report to the doctor’s review. Click a source to highlight the original sentence.
2. Click **Earlier images**. The checklist and the earlier imaging archive explain why the comparison pictures need a separate receipt check. The action shows who owns it or who recorded the result. **See supporting passage** opens the original staff instruction.
3. Click **Family history**. Jordan’s older intake says their mother has osteoporosis. No genetic test report accompanied that history. The map keeps this as background information.

For the judges: “Riley and Morgan can start with the same five findings. Either can check the original sentence, and each can see whether their part is still open.” Open **Glossary** for the illustrated key and the terms used in the demo. [Download the one-page visual dictionary](docs/Intake-Desk-visual-dictionary.pdf)

## Three-minute walkthrough

**Open with Jordan’s problem.** “Jordan’s ankle was X-rayed today. The doctor’s written report is here. Pictures from an earlier visit were requested separately. How does the next person know which item is ready, where that information came from, and who is chasing the rest?”

For the first rehearsal, Craig can drive and Yousif can narrate. Swap for the second run. At **/login**, select a name, click **Fill passcode → Sign in**. To switch people, sign out and repeat. You can also sign into each account in a separate browser profile on the same laptop. The steps below follow the original Jordan sample.

<details>
<summary>Demo account passcodes for manual sign-in</summary>

| Maya Chen | Riley Ortiz | Dr. Avery Shah | Dr. Morgan Lee |
| --- | --- | --- | --- |
| `maya-demo-104` | `riley-demo-104` | `avery-demo-104` | `morgan-demo-104` |

</details>

| On screen | What the narrator can say |
| --- | --- |
| **Maya Chen · administrator.** In **Patient overview**, open **Jordan Vale → Open transfer workspace → Prepare transfer brief**. Expand **Compare current and prior records → Current transfer checklist**. Point to the highlighted sentence about the missing images. Close it and click **Sign and send to nurse**. | “Here’s exactly where the paper says the older pictures are missing. Maya can give Riley one specific thing to check.” |
| **Riley Ortiz · nurse.** Open **My inbox → Jordan Vale**. For this rehearsal, choose **Still pending → Record image status → Sign and send report to doctor**. Point to the receiving doctor’s name before sending. | “The paperwork told us what was missing at departure. Riley records what’s available now. That update travels with the report.” |
| **Dr. Avery Shah · first doctor.** Open **My inbox → Jordan Vale → Read signed radiology impression**. Close the source. Expand **Return to administrative staff**, enter “Called to another patient,” and click **Return handoff to admin**. | “This is the original report author’s conclusion. Avery can read it, but another patient needs Avery’s attention. The return records why someone else must take this review.” |
| **Maya, then Dr. Morgan Lee.** As Maya, reopen Jordan’s transfer workspace. Choose **Dr. Morgan Lee → Sign and reassign**. As Morgan, open **My inbox → Jordan Vale → Read signed radiology impression**, close the source, and click **Sign report review**. Pause on the confirmation. | “Morgan just signed that they reviewed today’s report. The screen still names Riley as responsible for the missing pictures. Those are two separate pieces of work.” |
| **Riley.** Open Jordan in **My inbox** again. To demonstrate that the older images have now arrived, choose **Arrived → Save follow-up status**. In Jordan’s chart, click **Patient log**. | “The next shift can see who read the report and who confirmed the images arrived, even though those things happened at different times.” |

**Check you can explain it.** Pause right after Morgan signs. Ask your teammate to show, without your help, who reviewed today’s report, where its conclusion was written, and who still owns the older images. The answers are **Morgan’s signed review**, **the highlighted passage in the radiology report**, and **Riley’s open follow-up**. If you have only a minute, have Avery click **Sign report review** directly and show the same open follow-up with Avery as the signer.

**Rehearse a different answer.** As Maya, open Jordan’s transfer workspace and click **Reset and randomize sample**, then **Prepare transfer brief**. This starts a fresh Jordan handoff. Find the new lookup number for the older X-ray in the prior imaging archive and the current transfer checklist. As Riley, click **Read Imaging Records reply** and record the status that office actually reports. If the images have arrived, the doctor’s signature finishes the work. If they are still pending or their arrival is unconfirmed, show who owns the follow-up. Ask your teammate to predict which outcome you’ll see before the doctor signs.

**What you can claim.** You demonstrated a source lookup, a named handoff and a follow-up that survives sign-off. The timed result below measures how quickly the sample brief appears. Time saved by hospital staff or patients would require observation in a real workflow. [Timing and method](#extraction-and-storage) · [Illustrated doctor walkthrough](docs/Jordan-doctor-walkthrough.pdf)

**If a judge asks whether this is only for transfers**, open **Patient overview → Casey Rowan** and click **Patient log**. Show the nursing reassessment and physician progress note from the same hospital visit. Maya can add a dated entry with **Add coordination update**. Open Casey under another account to see the same update and author.

**Other controls for Jordan.** In the original sample, **Request the prior study (optional)** lets Maya request the archived images by their lookup number, **MB-082-LA**. **Visit history and plan editor** shows the earlier visits and lets Maya edit a planned destination. **Parser options → Summarize with Codex** runs optional model extraction.

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
