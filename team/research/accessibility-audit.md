# Accessibility audit (T30): WCAG 2.1 AA, every screen

QA, 2026-10-19, branch `qa/t30-a11y` (base 1b6ad65). Production build (`npm run build`), served by `vite preview`, driven in headless Chromium 1194 on the 1,510-file synthetic fixture (`fixtures/recovery`: 363 kept, 1,147 set aside).

How it was checked:
- **axe-core 4.14.0** (rule tags wcag2a, wcag2aa, wcag21a, wcag21aa and best-practice) on 42 screen/state/viewport combinations.
- **Scripted checks** for what axe can't see: a keyboard-only run through the whole flow (Tab, Shift+Tab, Enter, Space), a focus ring on every Tab stop, no traps, focus moved to the new h1 on each step, live-region text, target sizes, headings, `lang`, page titles, side scrolling, reduced motion, and forced colours (computed styles under `forcedColors: 'active'`).
- **Viewports:** desktop 1280×900; phone 390×844 with touch (`pointer: coarse` confirmed); 200% zoom (640×450 CSS px at 2× density); 320×640 (reflow, 1.4.10); and forced colours with reduced motion at 1280×900.
- **States covered:** start; empty folder; scanning; scan stopped; nothing worth keeping; results; each set-aside group opened; a group moved back; review; nothing selected; a filter with nothing to show; save choose (folder, and zip on the narrow runs); folder refused by the picker; saving; saving stopped; drive full; broke partway; permission lost; done (folder and zip).
- **Save failures** are stubbed in the page with an in-memory folder whose writes slow down or throw `QuotaExceededError`, `InvalidStateError` or `NotAllowedError`. Nothing is written to disk.
- **Not checked:** the "That's your recovery folder" card (it needs a real picked recovery folder; it uses the same component as "folder refused", which passed). No screen reader was run (no NVDA, JAWS or VoiceOver here), so announcements are checked by the text in the live regions, not by hearing them.

Re-run: `npm run build && npm run a11y -- <path-to-chromium>` (`scripts/a11y-check.mjs`; `A11Y_PASSES=1` also lists the passes). It exits 1 on any serious finding.

## Results

Before the fixes: 0 blockers, 3 serious, 7 minor. After the fixes in this branch: **1 serious and 4 minor are still open** for the developer. Final run: 275 scripted checks passed, all 42 axe runs clean, and the script exits 1 on the one open serious issue (S1).

| # | Screen | Issue | WCAG | Severity | How to reproduce | Status |
|---|---|---|---|---|---|---|
| S1 | Start | "This folder is empty. Choose the folder…" is not announced. The note's `role="status"` element is created together with its text (`App.tsx:163`), so screen readers usually stay silent: the person picks a folder and hears nothing. The same applies to "Scan stopped. Nothing was changed…": Start mounts with the note already in it, and focus goes to the h1, so the note is never read. | 4.1.3 | Serious | Choose a folder that has only `.DS_Store` in it. In the DOM, `main [role=status]` count was 0 before and 1 after. | **Open (developer).** Keep one status region mounted on Start and put the note text into it after mount. For "Scan stopped", either do the same, or add the note to what focus lands on. |
| S2 | Review, nothing selected (all viewports) | The file-type label ("HEIC", "MOV") on an unselected tile with no preview was 2.45:1 (#899290 on #DCE3E1). The cause was `opacity: .55` on the whole `.tile`. | 1.4.3 | Serious | Choose Unselect all, then look at a tile with no preview. axe `color-contrast`. | **Fixed:** only the `img` fades; the label is now #45504D on #DCE3E1, 6.43:1. |
| S3 | Review, forced colours (Windows contrast themes) | The tick on a selected photo was white on white (`stroke #FFF` on a background forced to Canvas). Selected and unselected marks computed identically, and only the dashed tile outline still showed the difference. Pressed or current pills (All/Photos, year, month) looked the same as the others. | 1.4.11, 1.3.1 (under a user contrast theme) | Serious | `forcedColors: 'active'`, then untick one photo: both `.dot` elements compute `rgb(255,255,255) none`. | **Fixed:** an `@media (forced-colors: active)` block in `app.css` draws chosen pills and ticked marks in Highlight/HighlightText and unselected marks as an outlined ring. |
| M1 | Every step | The page title is always "Keepsake", so it doesn't say which step you're on. | 2.4.2 | Minor | Read `document.title` on every screen. | **Open (developer):** for example `document.title = \`${stepLine} – ${initialTitle}\`` in `App.tsx`. Keep the initial title so the test build's "(test)" suffix survives. |
| M2 | Scanning, Saving | "Stop scanning" and "Stop saving" become `disabled` when pressed (`App.tsx:198`, `Save.tsx:214`), so keyboard focus falls to `<body>` while stopping. | 2.4.3 | Minor | Found by reading the code. Not measured: the fixture's scan ended before focus could be read. | **Open:** use `aria-disabled` only (keep the button focusable) and ignore repeat presses. |
| M3 | Review | Days far from the screen are not drawn (placeholders). Tab presses faster than one frame skipped undrawn days: in automation 302 and then 173 of 363 photos were reached. At human speed (33 ms and 150 ms between presses) all 363 were reached. The risk is a screen reader's browse mode, and Find in page, meeting empty placeholders. | 2.1.1, 1.3.1 (risk) | Minor (unverified) | Tab through the timeline without a pause between presses. | **Open:** test with NVDA and VoiceOver browse mode on a big folder. If content is skipped, draw blocks ahead of the virtual cursor, or give placeholders a text summary ("Friday 28 June, 6 photos"). |
| M4 | Review | Getting past the photos takes many Tab stops: 619 for 363 photos, because each single-photo day adds a day checkbox. With 40,000 files the month pills and "Jump to a month" are the only shortcuts. | 2.4.1 (usability) | Minor | Tab from Save to "Back to Clean up". | **Open:** a roving tabindex within each day (arrow keys between photos, Tab to the next day), or a "Skip to next month" link after each month heading. |
| M5 | Clean up | The group rows' `aria-label` ("Show small preview copies, 660 files") didn't start with the visible label ("Small preview copies 660 Show"). axe `label-content-name-mismatch` (axe rates it serious; WCAG is met because the label is contained, so rated minor here). | 2.5.3 | Minor | axe on Clean up. | **Fixed:** removed the `aria-label`; the name is now the row's own text ("Small preview copies 660 Show", plus "Keeping these" when moved back), with `aria-expanded` for the state. `copy.results.groupLabel` is now unused, so the UX writer can delete it. |
| M6 | Phone, Review | The "All" filter pill was 42×44 px. | 2.5.5 (AAA) / team rule of 44 px on phones | Minor | 390 px wide with touch: measure `.tl-filter .chip`. | **Fixed:** `.chip { min-width: 44px }` on narrow and touch screens. |
| M7 | Review, Scanning, Saving (forced colours) | The primary button had no visible edge (`border: 0`), the disabled Save looked the same as the enabled one, and the progress bar disappeared (the "Checked x of y" text remained). | 1.4.11 | Minor | `forcedColors: 'active'`. | **Fixed** in the same forced-colours block (button edge, GrayText for the disabled Save, progress in Highlight). |

## What passed

- **axe:** after the fixes, no violations on any of the 42 runs (every state listed above, across desktop, phone, 200% and 320 px).
- **Keyboard:**
  - The whole flow works with the keyboard alone: start, choose the folder (Enter), results, open a group (Space), keep it and undo (Enter), review, untick a photo and a day (Space), jump to a month (Enter; focus goes to that month's h2), disabled Save ignores Enter, choose a folder, done, Save receipt and Print.
  - No keyboard traps on any screen. Every Tab stop has a 3 px teal ring (or the ring on the photo's dot).
  - Focused controls are scrolled into view and are never under the sticky tools bar on desktop (2.4.11 is a WCAG 2.2 check, done as a bonus; the phone's sticky footer was not keyboard-tested).
  - Tab order follows the reading order:
    - Clean up: Review → Scan a different folder → years → +more → groups.
    - Review: Save → Select/Unselect all → years → months → filters → months and days.
- **Skip link:** "Skip to content" shows when focused and moves past the header. At load the app puts focus on the h1, so the skip link is reached with Shift+Tab; that's fine.
- **Focus on step change:** focus moves to the new h1 on scanning, scan stopped, results, nothing to keep, review, save choose, saving, stopped, full, broke, lost and done. After the picker refuses a folder, focus stays on the button (now "Choose a different folder") and the problem card is `role="alert"`.
- **Live regions:**
  - Scan progress is announced every 10% ("Checking your files… 10%").
  - Moving a group back: "Now keeping 1,023 files. 487 set aside."
  - Selection changes, a second after you stop: "Friday 27 December: 0 of 1 selected. 362 of 363 selected in all." With nothing selected: "Nothing selected. Nothing is deleted."
  - Save progress: "Saved 36 of 363."
- **Names:**
  - Every photo checkbox is named, for example "Save photo from 27 December 2024, 18:43" or "Save video with no date (1 of 90)".
  - Decorative art, swatches and icons are `aria-hidden`.
  - Clean-up previews have `alt=""` with the date as a visible caption.
  - The h1 names read with spaces ("Choose what to save 363 selected").
- **Structure:** `lang="en"`. One h1 per screen, and heading levels never skip.
- **Reflow:** no horizontal scroll at 390 px, at 200% zoom or at 320 px on any screen.
- **Targets:** all at least 44 px on the phone run after M6. On desktop the smallest are the 36 px pills, above the 24 px of 2.5.8.
- **Reduced motion:** there are a few short animations (the start screen's prints settling and their date tag, the scanning ticks drawing, the results ledger arriving, tiles after a year chip). None loops, none is larger than a card, none delays focus or clicks. Under `prefers-reduced-motion: reduce` the global rule removes every animation and transition (each animation uses `backwards` fill, so the resting state shows at once), and scrolling is instant.

### Contrast of the colour tokens (computed)

| Pair | Ratio | Needs |
|---|---|---|
| White on teal #23596B (primary button, chosen pills) | 7.74 | 4.5 |
| White on teal hover #173E4B | 11.49 | 4.5 |
| Grey #545B5F on background #ECF1F0 / white / tint-2 #E4EEEF / surface-2 | 6.06 / 6.91 / 5.85 / 6.71 | 4.5 |
| Ink-soft #45504D on tint-2 / blank tile #DCE3E1 / disabled Save #CBD8D4 | 7.09 / 6.43 / 5.71 | 4.5 |
| Teal on tint-2 (safe box) / surface-2 (Show, Hide) / background (links) | 6.55 / 7.51 / 6.79 | 4.5 |
| Accent-deep #1D4D5D on tint (ledger safe row) / tint-2 (note box) | 7.50 / 7.82 | 4.5 |
| Date #8A4B08 on white (date tags) | 6.79 | 4.5 |
| Control edge #767D80 on white / on background (secondary button edge, dashed unselected tile) | 4.19 / 3.67 | 3 (non-text) |
| Focus ring teal on background | 6.79 | 3 (non-text) |

## Other

- `tests/save.test.ts:92` ("40,000 files in a few busy minutes") takes about 7.9 s against vitest's 5 s default and failed 2 of 5 `npm test` runs on this machine. It has nothing to do with accessibility. Give it an explicit timeout.
