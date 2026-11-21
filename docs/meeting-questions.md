# Intake Desk meeting questions

Quoted wording comes from Granola's transcript summaries. The unquoted questions turn the meeting's topics and action items into decisions the team can check. *MedTech hackathon project brainstorm and tech stack planning*, November 21, 2026.

## Questions about the project

| Question | Answer or status |
| --- | --- |
| “How can we get the doctor sooner to see these test results?” | The meeting proposed surfacing information that already exists in the paperwork. Intake Desk tests the smaller step of helping a clerk find, compare, and forward an approved administrative detail. The intended receiving desk is Registration. Which information a doctor or nurse needs, when they need it, and who currently follows up remain open. [Spec](../SPEC.md) |
| Where is the delay, and what could we measure? | The roughly 14-hour cycle and its breakdown are brainstorming estimates. Separate time waiting for a test result from time between result availability and review. For the demo, observe whether a participant can find the correct callback, cite its source, and complete the handoff. Clinical workflow and changes in wait or admission time remain unmeasured. [Spec and usability task](../SPEC.md#five-minute-design-test) |
| What does the agent do, and where does a person act? | Extraction proposes a patient display name, sending facility, and callback extension with source lines. The clerk resolves a documented discrepancy or puts the packet on hold. Explicit sign-off releases the reviewed values to the local Registration desk. Clinical urgency, diagnosis, treatment, and admission stay with clinicians. [Spec](../SPEC.md) |
| What should we build and test the workflow with? | Use labeled synthetic transfer forms and amendments. In the corrected sample, the original extension is **214** and a signed amendment explicitly replaces it with **241**. Show both lines. An ambiguous, missing, mismatched, or unsupported required value blocks the handoff. Later, ask a registration worker how they handle a real disagreement in paperwork, using an example stripped of patient details. [Demo cases](../src/lib/server/fixtures.ts) · [Spec](../SPEC.md) |
| “You wanna make it?” | Craig's shared GitHub repo exists, and Yousif's authenticated account has push access. Each teammate's local setup is a separate check. [Team repo](https://github.com/craigcontreras/mlh-hacks-2026) · [Setup](../README.md) |
| What is Browserbase? *(Meeting question, paraphrased.)* | It provides cloud browser sessions that software can control, for example to interact with a web form through a browser. Intake Desk's demo uses bundled text and a local receiver. Browser automation remains outside this demo. [Browserbase documentation](https://docs.browserbase.com/welcome/introduction) · [Spec](../SPEC.md) |
| Which stack and prize categories fit? | The local SvelteKit/TypeScript app uses npm, SQLite, and synthetic fixtures. The team's later choice is **Codex** for model-assisted extraction, with a local parser for the labeled fixtures. One laptop can show both staff views. The submission plan is MedTech and Design. Design evidence is a usability task observed during the event and a change based on it. [Spec and design test](../SPEC.md#five-minute-design-test) · MT-haCks Track Packet, MedTech and Design sections. |

## What does the ED pipeline look like?

One common outline is **arrival → registration and triage → clinical evaluation → testing and treatment as needed → disposition**. Examples of disposition are discharge, inpatient admission, or transfer to another facility. Steps can overlap or repeat. This is a reference map for interviewing staff about their local process. Intake Desk models a transfer-document handoff at the receiving end. [AHRQ ED workflow example](https://www.ahrq.gov/sites/default/files/wysiwyg/professionals/quality-patient-safety/quality-resources/tools/cap-toolkit/ed-workflowdiagrams.pdf) · [AHRQ disposition definitions](https://hcup-us.ahrq.gov/db/vars/disp_ed/nedsnote.jsp)

| Term | Meaning here |
| --- | --- |
| ED / ER | Emergency department / emergency room. |
| Registration / intake | Registration captures administrative details for the encounter. Nursing intake captures information used in evaluation and care. The prototype focuses on the receiving desk's paperwork. [AHRQ workflow example](https://www.ahrq.gov/sites/default/files/wysiwyg/professionals/quality-patient-safety/quality-resources/tools/cap-toolkit/ed-workflowdiagrams.pdf) |
| Triage / acuity | Clinical assessment of urgency to prioritize evaluation. The Emergency Severity Index (ESI) is one triage scale. [ACEP and ENA triage policy](https://www.ena.org/sites/default/files/2025-08/Emergency%20Department%20Triage.pdf) |
| Disposition | What happens when someone leaves ED care, such as discharge, transfer, or inpatient admission. [AHRQ disposition definitions](https://hcup-us.ahrq.gov/db/vars/disp_ed/nedsnote.jsp) |
| Handoff | Information passed from one role or team to another. In this demo, the receiving desk gets the reviewed values and a receipt. [Spec](../SPEC.md) |
| Provenance | Where the information came from. In this demo, each candidate has a source document and line. The receipt also records the reviewer and approval time. [Spec](../SPEC.md) |
