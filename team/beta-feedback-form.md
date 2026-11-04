# Beta feedback form (T87)

By the Product owner, Nov 4, 2026. Follows D28: 5–8 testers the owner knows, a 5-question form the owner creates, and an optional 20-minute call. `[Name]` means the product name. It stays "Keepsake" until T94 renames the app, and the owner updates the form at the same time.

**Principle:** private by design. The app never sends anything by itself. A tester sends feedback only by clicking a plain link, which opens the form in a new tab. Nothing from the app goes with it, and the app's `connect-src 'self'` doesn't change.

---

## 1. The form (copy it in exactly as written)

**Title:** [Name] beta: 5 quick questions

**Intro (form description):**
> Thanks for trying [Name]. This takes about 2 minutes. You don't need to sign in, and you can skip anything you'd rather not answer.
>
> **Please don't attach photos or screenshots of your photos, or links to them.** Words are all we need.
>
> This form is run by Google Forms, not by [Name]. Only [owner's first name] sees your answers.

| # | Question (as shown) | Answer type | Required |
|---|---|---|---|
| 1 | **Did you finish sorting your recovered folder?** | Multiple choice: *Yes, on my own* · *Yes, but someone helped me* · *I stopped partway* · *I didn't get started* | Yes |
| 2a | **What computer did you use?** | Multiple choice: *Windows* · *Mac* · *Other or not sure* | Yes |
| 2b | **Which web browser?** | Multiple choice: *Chrome* · *Edge* · *Firefox* · *Safari* · *Other or not sure* | Yes |
| 3 | **About how many files were in your recovered folder?** Help text: "The 'Checked … files' number on screen is fine. A rough guess is OK too." | Multiple choice: *Fewer than 1,000* · *1,000 to 10,000* · *10,000 to 40,000* · *More than 40,000* · *Not sure* | Yes |
| 4a | **At any point, did you think [Name] might…** | Checkboxes: *delete some of your files* · *upload or send your photos somewhere* · *change your recovery folder* · *None of these* | Yes |
| 4b | **Did anything confuse or worry you? If you can, copy the words on screen.** | Paragraph (short text) | No |
| 5a | **How likely are you to recommend [Name] to a friend who lost photos?** | Scale 1–5 (1 = Not likely, 5 = Very likely) | Yes |
| 5b | **Would you be up for an optional 20-minute call about it?** | Multiple choice: *Yes* · *No thanks* | Yes |
| 5c | **If yes, how should we reach you?** Help text: "Your name and an email or phone number. We'll only use this to set up the call." | Short text | No |

**Message after sending:** "Thank you. Your answers went to [owner's first name] only."

Why this order: Q1 maps to the phase 3/4 "finish without help" evidence. Q2 and Q3 tell us which setup and folder size each answer comes from (R3, R5, and the 40,000-file gate). Q4a measures the trust finding from the pilot (T6 was Critical) as a number we can count.

## 2. Form settings (Google Forms, or the same settings in another tool)

- **Collect email addresses:** Do not collect.
- **Sign-in:** none. Leave "Limit to 1 response" **off**, because it forces a Google sign-in. Leave "Restrict to users in [organisation]" **off**.
- **No file-upload question.** Never add one. In Google Forms it also forces sign-in.
- **Who sees responses:** only the owner. Turn "View results summary" **off**, keep "Allow response editing" **off**, and don't share the form or its response sheet with anyone as an editor.
- **Pre-filled links:** don't use them. The app links to the plain form URL.
- **Optional:** in Presentation settings, keep "Show progress bar" off. One page holds everything.

## 3. The "Send feedback" link in the app

| Where | What shows | Why |
|---|---|---|
| **Done screen** (all saves: full, partial, zip), below the "To see them, open…" line | Link: **Send feedback**. Line under it: "A short form opens in a new tab. Nothing from [Name] is sent with it." | Testers finish the task here, so their memory is freshest |
| **Start screen**, in the quiet links row with "How [Name] keeps your photos private" and "New to PhotoRec? Here's how to recover your files" | Link: **Send feedback** (no extra line) | Lets testers who get stuck or stop early still tell us. Every error screen leads back to start |

Not on scanning, results or Review: it would interrupt the task, and a calm flow matters more.

Behaviour (for the developer):
- A plain `<a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">`. With `noreferrer`, the form host never learns the unlisted beta URL.
- The accessible name is "Send feedback (opens in a new tab)". The extra words are visually hidden.
- `FEEDBACK_URL` is set at build time. It has no query string and no fragment, so no counts, file names, browser details or app state go with it. Nothing tracks the click: no fetch, beacon, analytics or log.
- If `FEEDBACK_URL` is empty, the link doesn't show. It is set only for the beta build that T85 hosts.
- The CSP stays exactly as it is. Opening a link in a new tab isn't covered by `connect-src`, so no CSP change is needed or allowed.

## 4. Acceptance check for T87

The task is done when every statement below is true for the hosted beta build (T85):

1. Someone who hasn't seen the form clicks **Send feedback** on the Done screen, answers every required question and submits in **under 2 minutes** (timed once on Windows/Chrome and once on Mac/Safari).
2. They submit from a private window while signed out of Google, and no sign-in prompt appears.
3. The form has no file-upload question. The response sheet has no email column. "View results summary" is off.
4. Clicking the link opens the form in a **new tab**. The app tab keeps its state.
5. In the built DOM, both links have `href` exactly equal to `FEEDBACK_URL`, plus `target="_blank"` and `rel` containing `noopener` and `noreferrer`.
6. The CSP in the built `index.html` and `_headers` is unchanged by T87. `connect-src 'self'` stays as it is.
7. **QA network check:** a full run of the built app shows **zero** requests from the app tab to any origin other than its own (scan, Review, save, clicking Send feedback). The form loads only in the new tab.
8. Offline: with the network off after load, the app still works end to end. Clicking the link opens a tab that can't load, and the app tab isn't affected.
9. A build with `FEEDBACK_URL` empty shows no link anywhere. `npm test` and the accessibility checks in `npm run gate` pass, and the link can be reached and opened with the keyboard.

## 5. Open items for the owner

- [ ] ★ **Create the form** exactly as in sections 1 and 2 (needs a free Google account — your call). Then send one test answer from a private window while signed out.
- [ ] ★ **Paste the form's URL** on the dashboard by **Nov 12**, so the developer can build it into the T85 hosted beta before testers start on Nov 16.

Notes: whether the link stays after launch goes on the T95 release checklist. The tester kit says the form is run by Google, which sees what testers type.
