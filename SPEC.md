# Intake Desk

**MT-haCks 2026 · MedTech + Design · November 21 demo specification**

## Medical document handoff

**Primary demo.** During an ER transfer, staff need to distinguish a current signed report from comparison images held under an earlier encounter. A clerk, doctor or nurse can find the original evidence in the chart. Each worker signs only those actions assigned to their account. [Synthetic transfer note](samples/records/ED-104-transfer-note.pdf) · [Demo walkthrough](README.md#three-minute-walkthrough)

| Acceptance example | Observable result |
| --- | --- |
| Maya signs in and opens the active transfer. | The administrative workspace shows Jordan Vale's two visits. Dr. Avery Shah and Riley Ortiz land in their own inboxes. Role permissions apply on the server and each signed action records the actual account. |
| Generate a brief from Jordan’s chart. | Four facts and two documented assignments link to the original transfer note. Three comparisons cite evidence across five documents. Clinical wording and qualifiers come from the signed report. |
| Inspect the current study and prior visit. | Codex reads the visit ID, side marker and training watermark on the current synthetic image. The earlier intake and archive identify the prior study. The current transfer checklist states its images are still outstanding. Offline mode labels the image data as coming from the manifest. |
| Maya signs the proposed records request. | A single local Imaging Records queue entry stores accession MB-082-LA, the source references, signer and time. The older images remain pending. A missing, inconsistent or mismatched citation blocks release. |
| Maya signs a report-review handoff for Avery. | Only the doctor can acknowledge or forward that assigned handoff. Avery can sign the documented image-status task onward to Riley. SQLite retains the source snapshots and history across refresh. |
| Search the patient directory for Casey. | Both completed visits have their own two documents. Opening Casey’s chart shows only Casey’s visit paperwork. |
| A participant tries the demo. | Capture which evidence they use to explain what is available, who should act and what sign-off did. Record task time, prompting and a retest after one observed issue is addressed. |

## Registration packet workflow

A clerk opens a synthetic ER transfer packet. The transfer form lists callback extension **214**. A signed amendment corrects it to **241**. The clerk sees both lines together, accepts the correction, and signs off once. The receiving registration desk then sees **241**, who approved it, and when. If the paperwork leaves the answer unclear, the clerk can hold the packet.

[Open the interactive design](design/intake-desk.html). It exercises the review decision with sample values. The SvelteKit app implements source-text extraction and SQLite storage. See the [local demo instructions](README.md).

## User and problem

**Primary users** — Administrative staff reconcile transfer paperwork. The receiving doctor reviews the available report and the nurse can check for outstanding images. The separate registration example focuses on the clerk preparing a callback for the registration desk.

**Team goal** — Help doctors and nurses find information that already exists in a patient's paperwork sooner. Drawing on document-parsing experience at GUILD, the team proposed extracting facts from synthetic intake and discharge documents, showing the source to a clerk, and forwarding the reviewed information after sign-off. The meeting’s estimated wait times are brainstorming figures. Time spent finding paperwork and any effect on admission time remain unmeasured. [Team meeting questions](docs/meeting-questions.md)

**Additional registration example** — A synthetic callback correction demonstrates a separate handoff to the registration desk. A subsequent workflow interview should establish which information a doctor or nurse actually needs, where it becomes available, and where their approval belongs. The team also identified an intake-to-discharge workflow map and a shared terminology glossary as research tasks.

**Working hypothesis** — A clerk comparing a transfer form with a later correction could pass along an outdated callback. The two extensions in this demo illustrate that possibility. To validate the scenario, ask someone familiar with registration to describe the last time two documents disagreed, what they checked, and who received the correction. Record their role and the workflow without collecting patient details.

**Design goal** — A first-time participant can distinguish the current report from the outstanding images, open both supporting sources and route the documented follow-up without coaching. From the receiving inbox, a second participant can name the sender and explain the assignment. In the separate registration example the equivalent task is to identify the corrected callback and approving clerk.

## The clerk's experience

| Moment | What the clerk sees | What the system does |
| --- | --- | --- |
| Open sample | One transfer packet marked synthetic. The patient display name and sending facility are already filled in. A text label identifies the callback conflict. | Read the two bundled text documents and attach the source document and line to each extracted value. |
| Review evidence | The earlier form and the signed correction appear together, each with its document label and source wording. Both values are legible without relying on color. | Leave the callback unresolved until the clerk acts. Agreed fields require no individual confirmation. |
| Resolve or hold | Selecting the documented correction makes the draft ready for sign-off. The clerk can change the choice or use **Hold for clarification**. For an entirely consistent packet, sign-off is the only required action. | A hold keeps the packet in the clerk's workspace. Reopening it returns the clerk to review. The receiving desk sees only approved handoffs. |
| Sign off | One action names both the approval and the destination. The named demo clerk reviews the final three values before committing. | Validate the decision on the server and record the reviewed values, evidence, clerk, destination and server time together. |
| Read the handoff | The local **Registration desk** view shows the approved summary and a receipt. | Reopening the view shows the same signed record. An approved record is read-only. |

**Interaction details.** Keep the disputed field and its source lines in the same reading order on a phone. Give actions descriptive text, visible keyboard focus, and a clear result that a screen reader can announce. Place the reason an approval is unavailable next to the action. Use the packet or document mark as the product icon to carry the same meaning across the clerk and recipient views.

## Input and decision rules

The build starts from bundled synthetic plain text. Two documents belonging to the same demo packet share a packet identifier. Each source has a display label, and each extracted candidate carries its original value, document identifier and line number. The parser reads labeled lines at runtime. A change in the source text must change the proposed values.

| Field | Synthetic transfer form | Synthetic signed amendment | Expected review |
| --- | --- | --- | --- |
| Patient display name | Avery Example | Avery Example or omitted | Show Avery Example with source. |
| Sending facility | Cedar House | Cedar House or omitted | Show Cedar House with source. |
| Facility callback extension | 214 | 241, explicitly replacing the earlier callback, with a demo signatory | Show both values and their provenance. The clerk may accept 241 or hold. |

- One distinct value for a required field is available for sign-off. Trim surrounding whitespace for comparison and preserve the original text for display. Preserve extensions as text, including leading zeroes.
- Two different values require review. For this template, a correction must name the field it replaces, identify the same packet and carry the demo signatory. A later timestamp by itself cannot settle a conflict. Both source lines stay visible after resolution.
- A missing required field, mismatched packet identifier, unsupported document shape, or conflict without an explicit correction blocks approval. Show the specific reason and offer a hold. The demo trusts the bundled fixture labels. Signature verification and patient matching would require separate work in a deployment.
- For the registration example, sign-off covers the three administrative fields above. A human handles decisions about urgency, diagnosis, treatment and admission in the existing clinical workflow. All sample data are synthetic, including the signer. Put the data declaration in the interface and submission README.

## Implementation contract

Use the repo’s SvelteKit and TypeScript starter, npm, and one local SQLite database. The clinical workspace and staff inbox support transfers. Registration has its own review and receiving-desk views. The team subsequently selected Codex for extraction. The server supplies the bundled synthetic documents to the signed-in Codex CLI and verifies its structured response. The standalone clickable design uses prefilled fields. For an offline demo, use the local labeled-text parser and show which method produced the draft.

1. **Extract and verify.** Ask Codex for candidate values for the three administrative fields, each with a document and line reference. Check each value against the cited field and line. For the bounded demo template, also scan the labeled source lines so a missing candidate cannot silently erase a conflict. Flag a mismatch or omission for review. If Codex is unavailable, the clerk can use the local parser for the same fixture. Both paths apply the same correction and approval rules.
2. **Review.** Store the clerk's draft or hold against the packet identifier. The browser sends the selected source reference to the server. The server derives the final values from the source and checks the allowed transition. A held packet must return to review before approval.
3. **Approve.** Store one approved snapshot per packet in SQLite. Commit the values, source references, demo reviewer, destination and approval time atomically. A repeated approval returns the existing receipt. A failed write leaves the draft available, shows a retry message and creates no receiving-desk entry.
4. **Receive.** Query approved records for the receiving view. Keep the snapshot immutable. Show its original time after refresh. Use a separate demo reset outside the sign-off flow for rehearsal.

**States.** A packet starts **In review**. The draft can be ready or blocked, based on its fields. A clerk may put it **On hold** and later resume review. Only a ready draft may become **Approved**. The receiving desk reads the approved snapshot.

**Scope for today.** Both people can develop against the same synthetic fixture. A local staff inbox demonstrates communication. Prioritize the review flow and an observed Design test. Free-form uploads, scanned-document OCR, EHR integration, clinical triage, production identity management and external messaging remain outside the demo.

## Acceptance examples

| ID | Exercise | Passing behavior |
| --- | --- | --- |
| A1 | Open the corrected packet on a fresh run. | The clerk sees Avery Example, Cedar House, 214 and 241. The callback is unresolved. The receiving desk is empty. |
| A2 | Change both fixture extensions to an unused pair, rebuild the draft, and inspect its evidence. | Both new values appear with the correct document and source line. No sample number is hardcoded in the parser or approval rule. |
| A3 | Select the signed correction, then reconsider before signing. | The selection makes the draft ready. The clerk can undo it. No receiving record appears for either action. A fresh choice and explicit sign-off are required. |
| A4 | Remove the correction wording or signatory while keeping two different extensions. | The user sees what prevents approval and can hold. Resuming the held packet keeps it unresolved. A direct approval request also fails. |
| A5 | Omit the patient name from all sources, or change an amendment's packet ID. | Explain the missing field or mismatched packet. The server prevents handoff. |
| A6 | Sign off on 241, activate approval twice, and refresh the recipient view. | Exactly one read-only handoff contains Avery Example, Cedar House, 241, the supporting references, demo reviewer, Registration desk, and the original approval time. |
| A7 | Make a local write fail, then restore storage and retry. | The clerk sees the failure and keeps the draft. The successful retry creates exactly one receipt. |
| A8 | Complete the corrected case by keyboard and inspect it at a 375 px viewport. | Every action is reachable, focus is visible, status uses words, and both source values and the destination are readable without horizontal scrolling. |
| A9 | Open a complete packet with matching values and no correction. | All three fields show their sources. One explicit sign-off creates the handoff without per-field confirmation. |
| A10 | Supply a model result with an unsupported value or with the amendment omitted, then simulate a provider outage. | The unsupported draft cannot be approved. An offline retry visibly identifies the local parser, recovers both source values, and still requires human review and sign-off. |

## Five-minute Design test

Run the signed-in transfer workspace with a real person at the event. A neighboring participant can test usability. Record their actual role. A clerk or clinician familiar with intake can also speak to workflow fit.

1. Start at Maya’s transfer workspace. Say **“Jordan’s transfer has arrived. Find what imaging is available, show me how you know, and get the next task to the person who needs it.”** Give the participant control. Let them choose their own route.
2. Observe their first action, whether they distinguish the attached report from the pending comparison images, the source they point to, whether they need a prompt and whether they recognize that their sign-off sent it. Afterward ask **“What changed when you signed the records request?”**
3. Capture one screen before editing, change one detail in response to something observed, and repeat the same task from reset. Show judges the original, the observation, and the change. Record a second person's first attempt if time permits.

| Evidence to fill in at the event | Actual result |
| --- | --- |
| Participant role, local time, prototype version | |
| First action, hesitation or exact words | |
| Study status, supporting sources, recipient, prompts, time to finish | |
| Change made and why, before/after screen references | |
| Retest result and remaining confusion | |

The five-minute session is a usability test. Claims about ER wait times, staff hours saved, or clinical outcomes would need different evidence.

## Two-person build and demo

Suggested split, adjustable between teammates. **Craig** owns the review and recipient screens, keyboard flow, and observed design iteration. **Yousif** owns the synthetic packet, parsing, approval transaction and acceptance checks. First rehearse one signed transfer and one source lookup in the prior visit. Integrate a complete path before refining the presentation.

| Checkpoint (ET) | Done when |
| --- | --- |
| First 20 minutes | Both can describe the same packet, draft and receipt. Run the first usability session on the design. |
| By 3:15 p.m. | On one laptop the corrected sample parses, the clerk signs, and a refresh shows the persisted receipt. |
| By 4:00 p.m. | The ambiguous sample stays held, repeat approval is safe, and the UI change from the volunteer test is documented. |
| By 4:30 p.m. | Freeze the demo, rehearse it, verify the README setup and synthetic-data declaration, and prepare the short deck and submission. |
| Before 5:00 p.m. | Submit the repo, description, team, MedTech track and Design entry through OrganizerHQ. |

| Demo time | What the judges see |
| --- | --- |
| 0:00–0:25 | Sign in as Maya. Jordan's transfer has arrived and references an earlier X-ray. |
| 0:25–1:10 | Generate the brief. Open the older archive entry and the current transfer checklist to show which images are still pending. |
| 1:10–1:50 | Sign the Imaging Records request and send the report-review task to the doctor. |
| 1:50–2:25 | Avery acknowledges the message, inspects the report and signs the outstanding image-status task onward. Show Riley’s inbox. |
| 2:25–3:00 | Show any observed usability finding and retest result. Identify the supported synthetic documents and the next question for staff. |

**Rubric coverage.** The live handoff demonstrates working system (25). The clerk scenario, workflow discovery and observed task support problem/user understanding (20). Source-linked extraction, failure handling and durable approval demonstrate technical rigor (20). A local, bounded template supports feasibility (15). Synthetic data, human sign-off and accessible interaction support equity/privacy/trust (10). The rehearsed three-minute story supports presentation (10).

**Sources.** [Team meeting questions](docs/meeting-questions.md) · [Team repository](https://github.com/craigcontreras/mlh-hacks-2026). Event constraints come from the supplied *MT-haCks 2026 Track Packets* (MedTech, Design, judging, submission) and *MT Hacks 2026 Opening Ceremony* (slides 10 and 17–18).
