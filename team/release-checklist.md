# Release checklist (T95)

<!-- Team Lead · 2026-11-12. Everything needed before the repo goes public and the launch build goes live. Re-check each ✅ on the release commit: most evidence below is from HEAD 84e7d1e on Nov 12. -->

Status key: ✅ done (with evidence) · 🟡 ready, waiting on an owner decision (named) · ⬜ to do (owner: team or owner).

Owner calls this list waits on: **D6** (licence: GPL-3.0 recommended, MIT or AGPL-3.0), **D42** (domain / `SITE_URL`), **T99** (free trademark search on "Upsort", D39), **go/no-go**, and making the repo public. Nothing here makes any of those calls.

## Summary

| | Count |
|---|---|
| ✅ done | 15 |
| 🟡 ready, waiting on an owner decision | 13 (D6 ×6, D42 ×2, T99 ×2, go/no-go ×2, repo public ×1) |
| ⬜ to do | 18 (team 11, owner 7) |

---

## 1. Licence

| # | Item | Status | Evidence / what's left |
|---|---|---|---|
| 1.1 | Licence chosen | ✅ Nov 12 | Owner chose GPL-3.0 (D6, in chat). SPDX `GPL-3.0-or-later` (the FSF default; switch to `-only` if the owner prefers). |
| 1.2 | Candidate licence texts ready | ✅ / ⚠️ | `licenses/candidates/GPL-3.0.txt`: FSF text, copied from `/usr/share/common-licenses/GPL-3` (sha256 `3972dc97…b36986`, 35,149 bytes, the same as gnu.org's `gpl-3.0.txt`). `licenses/candidates/MIT.txt`: the standard MIT text (from `node_modules/react/LICENSE`) with `Copyright (c) 2026 <owner name> — fill in`. **AGPL-3.0: no copy on this machine** (searched node_modules, /usr, /opt, /root, /home). If D6 = AGPL, someone has to get the text from https://www.gnu.org/licenses/agpl-3.0.txt (team, 2 min). |
| 1.3 | Top-level `LICENSE` | ✅ Nov 12 | FSF GPL-3.0 text (sha256 matches gnu.org). Was: | After D6, run `cp licenses/candidates/<choice>.txt LICENSE` (for MIT, fill in the copyright line first), then `git rm -r licenses/candidates`. Team, 5 min. |
| 1.4 | `package.json` `"license"` field | ✅ Nov 12 | `"GPL-3.0-or-later"`, `"private": true` kept. Was: | Add `"license": "GPL-3.0-only"` (or `"GPL-3.0-or-later"`: the owner decides which; we recommend `-or-later`, the FSF default), `"MIT"` or `"AGPL-3.0-or-later"`. Keep `"private": true` so it never goes to npm. |
| 1.5 | Licence headers in source files | 🟡 D6 | Not legally needed for any of the three. Recommendation: no per-file headers; a one-line `SPDX-License-Identifier` in `src/main.tsx` and `vite.config.ts` is optional. The README's Licence section names the licence and the copyright holder (see 3.5). |
| 1.6 | Source link from the hosted app | 🟡 D6 + owner (look) | GPL-3.0 §6(d) (object code sent from a website) and AGPL-3.0 §13 (users over a network) both need the site to point to the source. MIT doesn't. The privacy page draft already has "See the code" (`team/content/privacy-page.md`, "Nothing is hidden"), but that text was left out of the app until it's true (`src/ui/copy.ts` comment above `info`). Adding it to the in-app privacy page is user-visible copy on the privacy page, so the owner approves the wording (D35 covered only the launch-message lines). Not needed for the README. |

## 2. Third-party notices and LGPL (libheif / libde265)

| # | Item | Status | Evidence / what's left |
|---|---|---|---|
| 2.1 | `THIRD_PARTY_NOTICES.txt` matches what ships | ✅ | `npm ls --omit=dev --all`: 6 direct deps + react, react-dom, scheduler. The script also adds 4 Workbox packages bundled into `sw.js`. All 13 are in `public/THIRD_PARTY_NOTICES.txt` at the installed versions, plus libde265 and zlib. Regenerated on Nov 12 into scratch with the same script: **byte-identical** to the committed file (141,862 bytes). `tests/previewQueue.test.ts` ("third-party notices") fails if a direct dependency is missing. |
| 2.2 | Notices file ships in the build | ✅ | `dist/THIRD_PARTY_NOTICES.txt` (copied from `public/`). |
| 2.3 | libheif and libde265 versions named correctly | ✅ | Strings in `node_modules/libheif-js/libheif-wasm/libheif.wasm`: libheif **1.23.2**, libde265 **1.0.15**. The notices say "libheif-js 1.23.2" and "libde265 … 1.0.15". |
| 2.4 | LGPL-3.0 §4(b): LGPL **and** GPL texts go with the app | ✅ | The notices hold the full LGPL-3.0 text (lines 665, 839, 1913) and the full GPL-3.0 text (lines 1007, 2081). |
| 2.5 | LGPL-3.0 §4(a): prominent notice that the app uses libheif/libde265 under the LGPL | ⬜ owner (look) | Today the notice lives in `/THIRD_PARTY_NOTICES.txt` and the README, but **nothing in the app links to it**. Also, the privacy page says the HEIC part "comes with Upsort" without naming it. Minimum fix: one line plus a link, e.g. "Open-source licences" → `THIRD_PARTY_NOTICES.txt`, in the privacy page or the start screen footer. That's a visible change, so it's the owner's call on where it goes (Quiet Prints rule). The team then adds it (½h). |
| 2.6 | LGPL-3.0 §4(d)(0): users can rebuild the app with a changed libheif | 🟡 repo public | We use option (0): we provide the "Minimal Corresponding Source", meaning our app's source with its build files. The libheif WebAssembly is inlined into `assets/heic.worker-*.js` together with our glue code (`src/worker/heic.worker.ts`, `heicDecode.ts`), so it is **not** a swappable shared library, and option (1) doesn't apply. Option (0) is met once the repo is public: `npm ci && npm run build` rebuilds the app, and anyone can point `libheif-js` at a modified build. This holds under GPL, AGPL **and** MIT: MIT already allows changing the app and reverse engineering it. The only condition is that the public source matches the deployed build (deploy from a tagged commit, see 6.9). |
| 2.7 | LGPL-3.0 §4(d)(0) → GPL-3.0 §6: give access to the **Library's** Corresponding Source | ⬜ team | Needed on top of our own source: the source of libheif 1.23.2, libde265 1.0.15 and the libheif-js 1.23.2 build scripts (emscripten flags). A link to someone else's server is allowed only if we make sure it stays up (GPL §6(d)). Simplest safe route: (a) download `libheif-1.23.2.tar.gz`, `libde265-1.0.15.tar.gz` and the `libheif-js` v1.23.2 source archive, (b) attach them to the GitHub release made at launch (6.9), and (c) add a "Source code for the LGPL parts" paragraph to `scripts/make_notices.mjs` (libheif-js section) that points to that release, then `npm run notices`. About 1h, needs network. Do it after the repo is public and before the launch build goes live. |
| 2.8 | LGPL-3.0 §4(e) Installation Information | ✅ (n/a) | Only applies to "User Products" (devices). A web app isn't one. |
| 2.9 | Small build helpers in the bundle (Vite/Rolldown preload + runtime helpers, MIT) | ✅ Nov 13 | `make_notices.mjs` now adds a "vite 8.3.4 / License: MIT" section with Vite's own MIT notice (the part of `node_modules/vite/LICENSE.md` before its bundled-dependency licences); `npm run notices` regenerated `public/THIRD_PARTY_NOTICES.txt`, notices test passes. |
| 2.10 | Fonts (OFL-1.1), Unsplash photos, test media | ✅ | Fonts: full OFL text in notices. Hero photos: `src/assets/hero/CREDITS.md` + README "Photo credits" (and `video/launch-film/assets/img/CREDITS.md`). Real-phone test files: `tests/real-phones/README.md` ("free to use however you wish", source commit named). `tests/looks/*` and the video's photos (`video/launch-film/assets/photos/`) are generated by our own scripts (`make_look_samples.py`, `make_pilot_folder.py`: procedural images). |

## 3. README for a public audience

| # | Item | Status | Evidence / what's left |
|---|---|---|---|
| 3.1 | Uses the name Upsort | ✅ | Title and body say Upsort (T94). |
| 3.2 | Remove internal and out-of-date notes | ✅ Nov 13 (a, b, d) · 🟡 (c) owner 4.4 | Nov 13: "Status: phase 1" replaced by a short "What it does today"; the placeholder-screenshots remark dropped; perf/memory detail moved word for word to `docs/testing.md` (internal task ids T19/T52/T57/G2 removed). (c) waits on 4.4. Was: (a) "Status: phase 1 (prototype the engine)" is out of date: replace it with a short "What it does today". (b) "screenshots in the guide are labelled placeholders until QA supplies them": no guide placeholders remain in `src/ui/copy.ts`, so drop it. (c) "The team" section ("Role definitions for AI assistants…") depends on the owner's call on `.claude/` (item 4.4). (d) The long test/perf detail (T57 memory numbers, `PERF_*` env vars) is better in `CONTRIBUTING.md` or `docs/testing.md`; keep `README` to what it is, privacy, run, test, licence. |
| 3.3 | How to run | ✅ | "Run it" (`npm install`, `npm run dev`, `npm run build`, `npm run preview`). Add a one-line "Use it online: <SITE_URL>" once D42 is decided (🟡 D42). |
| 3.4 | Privacy wording matches the approved privacy page | ✅ Nov 13 | Nov 13: the privacy section opens with the in-app promise word for word (bold, as in `copy.ts`). The offline bullet now says only what `offline-check` proves (opens and scans with the network off; the launch video needs a connection). The public "turn off your Wi-Fi" line stays held. Was: The README's privacy section is technical and accurate, but it doesn't open with the approved promise. Add the in-app page's lead sentence word for word: "Your photos never leave this computer, and Upsort never changes or deletes your files." (`src/ui/copy.ts` PRIVACY; owner-approved lines D35). Also: README says "Works offline". The launch message holds "works offline" until QA and the owner sign off for public copy (voice rule 4, `launch-message.md`). Either keep it as a technical statement (offline-check passes) or soften it. Writer flags this to the owner if unsure. |
| 3.5 | Licence section | 🟡 D6 | Today it reads "GPL-3.0 (planned; add the LICENSE file before publishing)". Replace it with the chosen licence and "Copyright (C) 2026 <owner name>", keeping the third-party paragraph and photo credits. |
| 3.6 | Mentions of the beta host | ⬜ team | README doesn't name the host. But see 6.6: the in-app privacy page names **Netlify** and its badge. |

## 4. Repo contents and history (before making it public)

| # | Item | Status | Evidence / what's left |
|---|---|---|---|
| 4.1 | Secrets/credentials scan of **all** history (69 commits, both branches) | ✅ | `git log --all -p` grep for GitHub/OpenAI/Anthropic/AWS/Google/Slack tokens, private keys, Bearer tokens, `api_key=`/`secret=`/`password=`/`token=` literals: **no hits**. No `.pem/.key/id_rsa/.p12/credentials` files ever committed. |
| 4.2 | `.env.artifact` | ✅ | Tracked since `b8e7a81`. The only content is `VITE_SAMPLES=1` (turns on the example-files button in the preview build). Not a secret, fine to publish. |
| 4.3 | Emails / personal data in history | ✅ (+ note) | Authors and committers: `Claude <noreply@anthropic.com>` (65) and `Keepsake <dev@keepsake.local>` (4). **The owner's email appears nowhere.** Other emails in diffs come only from licence texts (zlib authors, isaacs). `/home/me/…` paths are made-up test paths. Tester research (`team/research/`) has no names or contacts. Note: **67 commit messages carry `https://claude.ai/code/session_…` links**, and tracked files hold 5 claude.ai artifact links (dashboard in `CLAUDE.md` and `team/OPERATING_MODEL.md`; `team/brand/visual-directions.md`; `team/dashboard/seed.mjs` ×3). They're private (sign-in needed), but they become visible. Removing them from commit messages means rewriting history (can't be undone): owner, item 4.4. |
| 4.4 | Internal team files: keep public or move out | ⬜ owner | See the table under "Owner decision: internal files" below. |
| 4.5 | Music never committed | ✅ | `git log --all -- '*.mp3' '*.wav' '*.m4a' '*.aac' '*.flac' '*.ogg'` → empty. `git rev-list --all --objects` → no audio files. `video/launch-film/assets/audio/` is in `.gitignore`. Note: `video/launch-film-vertical/assets/audio` is a tracked **symlink** to that ignored folder. It's harmless (it shows as a broken link on GitHub), but it could be removed. |
| 4.6 | Other branches | ⬜ owner | `origin/heic-support` (5 commits not in `main`, last Oct 15; HEIC work since merged differently). Making the repo public publishes every branch. Recommend deleting it first, or say to keep it. |
| 4.7 | Repo name and URL | 🟡 T99 / owner | The repo is `github.com/<owner account>/keepsake`. Rename to `upsort` after T99 clears (Settings → General → Repository name; GitHub redirects the old URL). Optional: move it to an organisation if the owner doesn't want the personal account name in the public URL. Also internal leftovers of the old name, invisible to users: `"name": "keepsake"` in `package.json`, `keepsake-*` plugin names in `vite*.ts`, `# Keepsake` in `CLAUDE.md` and `OPERATING_MODEL.md`. Team can rename after T99 (Tier 2). |
| 4.8 | Large files | ✅ | `.git` is 25 MB. The largest tracked media is `video/launch-film-vertical/assets/clips/review.mp4` (2.8 MB). Build outputs, fixtures and e2e shots are ignored. |

### Owner decision: internal files

Everything below is tracked today and would be public. None of it holds secrets (4.1–4.3). It shows how the project is run: by AI agents, with the owner's decisions and notes.

| Path | What it is | Recommendation |
|---|---|---|
| `CLAUDE.md` | Agent instructions + dashboard link | **Keep** (it's how contributors' agents work on the repo), but drop the dashboard link line or move it to an untracked `CLAUDE.local.md`. |
| `.claude/agents/*.md` (7) | Role definitions | **Keep**. They're referenced from README and harmless. If the owner prefers not to show the AI-team setup, move them to a private repo and drop README's "The team". |
| `team/OPERATING_MODEL.md`, `team/plan-phase4.md`, `team/dashboard/` | How the team runs, plans, dashboard page + seed | **Move to a private repo** (or a private `team` submodule). They hold owner rules, dates and private artifact links, and they're of no use to the public. |
| `team/research/` (10) | Competitors, pilot debrief, beta notes, audits, gate check | **Move**. Competitor notes and beta findings are internal. `accessibility-audit.md` and `screen-reader-pass.md` could stay as evidence of a11y work (owner's choice). |
| `team/brand/` (34, incl. 20 naming rounds) | Naming research, visual direction, voice | **Move** the naming rounds (they list other products' names and trademark notes). `voice.md` and `quiet-prints/` can stay as design docs if the owner likes. |
| `team/content/` (7) | Privacy page, guide, launch message, captions, tester kit | **Keep** `privacy-page.md` and `photorec-guide.md` (sources of in-app text). **Move** `launch-message.md`, `launch-page-proposal.md`, `beta-tester-kit.md` and `review-export-copy.md` until they're published (all are "not yet public" drafts with team notes). |
| `team/deploy-beta.md`, `team/beta-feedback-form.md` | Beta hosting steps, feedback form | Deploy steps: **keep** (rename to `docs/deploy.md` after the launch build exists). Feedback form: **move**. |
| `video/` (capture scripts, HyperFrames projects, `launch-film/CLAUDE.md`, `SPEC.md`) | Launch film sources. Captures are of the synthetic pilot folder (`video/capture/pilot-files.json`: synthetic `recup_dir.N/f…` names, no real photos) | **Keep** or move: no privacy issue. `video/README.md` says the music licence page isn't checked (6.11). |

Note: moving files out of the tree doesn't remove them from **history**. If the owner wants any of them truly unpublished, the options are (a) rewrite history (`git filter-repo`, can't be undone, Tier 1) or (b) publish a fresh repo from a squashed snapshot. Recommendation: keep history as is and move only what the owner marks. Nothing found makes a rewrite necessary.

**Done Nov 13 (D47, owner approved):** 37 internal files were taken out of this repo and handed to the owner as `upsort-team-files.zip` for the private repo `cjoewelle-fart/upsort-team`. They are the naming rounds, the launch-page mockups, `plan-phase4.md`, `dashboard/`, `beta-feedback-form.md`, the tester kit, the launch-page proposal, and the competitor, PHOTO home, pilot debrief, pilot kit and usability-plan research. Kept here because the app, tests or the team's daily work use them: the operating model, agent briefs, voice and Quiet Prints, the privacy page, guide, launch message and captions, beta notes, gate check, accessibility evidence, the pilot folder key, this checklist and the marketing plan. The `heic-support` branch was deleted. History is unchanged, as chosen.

## 5. Launch build switch (ready to build, off)

**Today** every production build is a no-index beta build:

- `vite.deploy.ts` line 110, in `headersFile()`: `add('/*', 'X-Robots-Tag', 'noindex, nofollow')`
- `vite.deploy.ts` line 126: `export const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'`
- `vite.deploy.ts` line 167, in `deployFiles().generateBundle`: `if (!existsSync('public/robots.txt')) this.emitFile({ … fileName: 'robots.txt', source: ROBOTS_TXT })`
- `tests/deploy.test.ts` lines 88 and 160 expect exactly those.
- `index.html` has no robots `<meta>`. `vite.launch.ts` `headTags()` already writes canonical, `og:url` and `og:image` only when `SITE_URL` (in `src/brand.ts`) is non-empty.

**Change design** (for the dev; ½d with tests). Keep the beta build exactly as it is and add a separate mode:

1. `package.json`: `"build:launch": "tsc -b && vite build --mode launch"`. Output to **`dist-launch/`** (`build: { outDir: 'dist-launch' }` for that mode), so a launch build can never be uploaded to the beta address by mistake, and `tests/deploy.test.ts`'s `dist/` checks are unaffected. Add `dist-launch/` to `.gitignore`.
2. `vite.deploy.ts`: `headersFile(workers, csp = CSP, { indexable = false } = {})`. Add the `X-Robots-Tag` line only when `!indexable`. Add `export const ROBOTS_TXT_LAUNCH = (siteUrl: string) => 'User-agent: *\nAllow: /\n'` (optionally followed by `Sitemap: ${siteUrl}sitemap.txt` with a one-line `sitemap.txt`). `deployFiles({ launch = false } = {})` passes `indexable: launch` and emits the launch robots text.
3. Guards in `deployFiles` when `launch` is true. The build **fails** if any of these hold:
   - `SITE_URL` is empty, isn't `https://`, or lacks the trailing slash (message: "launch build needs SITE_URL in src/brand.ts (D42)").
   - `public/robots.txt` exists (it would silently win today).
   - The emitted `index.html` lacks `<link rel="canonical" href="${SITE_URL}">` or `og:image`.
   - `public/launch/share.png` is missing.
4. `vite.config.ts`: add `mode === 'launch'` → same plugin list as the default build, but `deployFiles({ launch: true })`. Test modes (`testbuild`, `artifact-test`) can never pass `launch`.
5. Tests: one unit test for `headersFile(…, { indexable: true })` (no `X-Robots-Tag`, all other headers identical); one for each guard (empty `SITE_URL` throws); keep the existing beta assertions unchanged.
6. Optional, for the launch host only: `Strict-Transport-Security: max-age=31536000` on `/*` in launch mode, after HTTPS on the domain is confirmed.

Status: ✅ implemented Nov 12 (dev, uncommitted at the time of writing), then 🟡 D42 to switch on (set `SITE_URL`, run `npm run build:launch`).

Evidence (Nov 12):
- Points 1–5 are done as designed. Point 6 (HSTS) is left out until HTTPS on the domain is confirmed. There is no sitemap.
- `npm run build:launch` writes `dist-launch/` (in `.gitignore`). Only `vite build --mode launch` passes `deployFiles({ launch: true })`.
- With `SITE_URL = ''` (today), the build stops before bundling and leaves no `dist-launch/`. Its message: "launch build needs SITE_URL in src/brand.ts (D42): an https:// address ending in '/', e.g. 'https://example.org/'; it is """.
- With `SITE_URL` set to `'https://example.org/'` for one build (then set back to `''`):
  - The build passes.
  - `_headers` is the beta file minus the `X-Robots-Tag` line (`diff` shows nothing else).
  - `robots.txt` is `User-agent: *` / `Allow: /`.
  - `index.html` has `<link rel="canonical" href="https://example.org/" />`, plus `og:url` and `og:image` (`https://example.org/launch/share.png`).
  - The CSP meta is identical to the beta build's.
  - `sw.js` lists no `launch/` files.
- The beta builds (`dist/`, `dist-test/`) and the artifact build are byte-identical before and after the change in `_headers`, `robots.txt`, `index.html` and `sw.js`.
- `tests/launchBuild.test.ts` covers:
  - headers without `X-Robots-Tag`, everything else identical;
  - both robots texts;
  - every guard: empty, `http://` and no-trailing-slash `SITE_URL`, `public/robots.txt`, missing share image, and missing canonical or og:image;
  - the config wiring.

  The beta assertions in `tests/deploy.test.ts` are unchanged.
- `npm test`: 408 passed, 3 expected fails. `npm run build` and `npm run build:test` pass.

## 6. Launch build checks, hosting and launch materials

| # | Item | Status | Evidence / what's left |
|---|---|---|---|
| 6.1 | Launch-build switch implemented | ✅ | Section 5, committed in 667d37b. |
| 6.2 | `SITE_URL` set in `src/brand.ts` | 🟡 D42 | `export const SITE_URL: string = ''` today. Set it to `https://<domain>/` (trailing slash). Then `node video/sync-brand.mjs` so the films' end card has the address, and re-render if it's shown there. |
| 6.3 | Share image and og tags | 🟡 D42 | `public/launch/share.png` committed (330 KB). `headTags()` writes `og:image`, `og:url` and canonical once `SITE_URL` is set. After deploy: check with a share-preview debugger (Facebook Sharing Debugger, LinkedIn Post Inspector) and `curl -s $URL | grep -E 'og:|canonical'`. |
| 6.4 | Domain bought + DNS + HTTPS on the host | ⬜ owner (D42, costs money) | Then the team connects it in the host's dashboard (custom domain), and waits for the certificate. |
| 6.5 | Hosting headers on the new domain | ⬜ team | Run `team/deploy-beta.md` §3 against `https://<domain>/` with the launch build. Expect everything there **except** `X-Robots-Tag` (absent), and `robots.txt` = `Allow: /`. No header doubled. The host's analytics and snippet injection are off. |
| 6.6 | In-app privacy page matches the launch host | ⬜ team (writer) → owner | `src/ui/copy.ts` PRIVACY names **Netlify** three times (badge, Network tab, visit records). If the launch host or plan differs from the beta (e.g. no "Powered by Netlify" badge on the custom domain), these lines must change. That's privacy-promise copy, so the owner approves. Also check: is the Netlify badge actually served? The CSP and e2e say no other origin is contacted, so confirm the badge file is same-origin as the text claims. |
| 6.7 | e2e, offline check, a11y on the **launch** build | 🟡 local pass Nov 13; hosted run waits on D42 | Nov 13, local launch build of 656db17 (`SITE_URL` set to https://example.org/ for the test only, then reverted): e2e PASS in desktop, phone and zoom200 (1,407 files, 322/322 saved, zip OK); offline-check PASS (17/17); a11y PASS (0 serious, 0 minor, 2 info, 460 checks; run via a dist/ copy before `BASE_URL` support was added to `a11y-check.mjs` the same day); launch video loads only on Play, captions on, never cached. 0 outside requests in every watched run. Note: the default a11y run is flaky (1 serious contrast hit in about 2 of 3 runs, axe catching the scanning→results switch mid-way). Was: `npm run build:launch && node scripts/serve-dist.mjs dist-launch`, then `BASE_URL=http://localhost:4180/ npm run e2e`, `… npm run offline-check`, `… npm run a11y` (a11y takes `BASE_URL` / `--base-url` since Nov 13 and fails on any request to another origin). Then again with `BASE_URL=https://<domain>/` after deploy. The current `dist/` is from Nov 11 (stale), so rebuild first. |
| 6.8 | Phase-4 gate (T96) on the hosted release candidate | 🟡 local pass Nov 12; hosted run waits on D42 | QA on the release candidate (667d37b work, local): 40,000 files incl. 262 HEIC, median 37.7 s; offline-check pass; full gate pass (team/research/gate-check.md). Still to do: the same on the hosted launch build. | `npm run gate` on the release commit + the hosted checks above. Gate pass/fail is the owner's call. |
| 6.9 | Tag and release the exact deployed commit | ⬜ team | `git tag v1.0.0 <commit>` + GitHub release with the LGPL source archives (2.7). The deployed build must come from that tag (2.6). |
| 6.10 | Launch video files | ✅ (Nov 12, 667d37b) | Committed and switched on (`LAUNCH_VIDEO`, 40 s). QA: no request before Play, never in the precache or Cache Storage, plays with captions, offline line when the network is off. Still to do on the launch build: play it once. Earlier note: | `public/launch/upsort-launch.mp4` (8.2 MB) and `upsort-launch.en.vtt` exist but are **untracked** (being worked on now). `LAUNCH_VIDEO` in `src/brand.ts` is being switched on (D43). To do: commit them, confirm they're excluded from the offline cache (`precacheGuard` in `vite.launch.ts` fails the build if not), and play once on the launch build. The 9:16 cut for social lives only in ignored `renders/`: keep a copy outside the repo for posting. |
| 6.11 | Music licence checked | ⬜ owner (or team reads, owner confirms) | `video/README.md`: Pixabay-style file, "**licence page has not been checked yet**". The music is inside the mp4 that will be committed and served publicly. Confirm the Pixabay Content License covers this track before launch (the track page shows the licence). |
| 6.12 | Launch message ready | 🟡 go/no-go | `team/content/launch-message.md` is complete (hierarchy, launch page, FAQ). The privacy and no-delete lines were approved (D35). It still holds "works offline" out of public copy until QA + owner sign-off. Needs `SITE_URL` (D42) for links. Publishing is the owner's call. |
| 6.13 | Trademark search | 🟡 T99 | Owner's 20-minute browser search (USPTO, TMview, WIPO) before the name goes public. |
| 6.14 | Go / no-go | 🟡 go/no-go | After 6.8 and the items above. |
| 6.15 | Make the repo public | ⬜ owner | Steps in section 7, after D6 (LICENSE in), 4.4 and 4.6. |

## 7. Making the repo public (owner steps)

**Right before** (team prepares, owner checks):

1. `LICENSE` is at the top level and README's Licence section is final (D6). The release commit is on `main`. `git status` is clean.
2. The internal files the owner marked to move are gone from `main` (4.4).
3. `heic-support` is deleted or confirmed (4.6): **Code → branches → bin icon** next to it.
4. Settings → **Secrets and variables → Actions**: empty (there are no workflows). Settings → **Deploy keys**, **Webhooks**: empty or expected. Settings → **Collaborators**: only the people you want.
5. Optional: rename to `upsort` after T99 (Settings → General → Repository name → **Rename**).

**Make it public:**

6. Repo → **Settings** → **General** → scroll to **Danger Zone** → **Change repository visibility** → **Change visibility** → **Make public**. Read the warnings, click **I want to make this repository public**, then **I have read and understand these effects**, type the repo name when asked, and confirm (and 2FA if prompted).

**Straight after:**

7. Repo home → **About** (gear icon): description "Sort photos recovered by PhotoRec into a clean, dated library, entirely on your own computer." Website: the `SITE_URL` (D42). Topics: `photorec`, `photo-recovery`, `photo-organizer`, `heic`, `privacy`, `offline-first`, `pwa`, `webassembly`, `react`, `typescript`. Tick **Releases**, untick **Packages** and **Deployments** if unused.
8. Settings → General → **Features**: Issues on or off (recommendation: **on**, with a short issue template later; off if you don't want to answer them yet). Wiki **off**. Discussions off for now. Projects off. Sponsorships off (unless decided).
9. Settings → General → **Social preview** → upload `public/launch/share.png` (1200×630 is accepted; GitHub suggests 1280×640).
10. Settings → **Rules → Rulesets → New ruleset → New branch ruleset**: name `main`, Enforcement **Active**, Target **Include default branch**. Tick **Restrict deletions** and **Block force pushes**. Optional: **Require a pull request before merging** (only if all changes will come through PRs; the team pushes to `main` today, so leave it off or add yourself to the bypass list). Rulesets are enforced on public repos on the free plan.
11. Settings → **Code security**: turn on **Secret Protection** (secret scanning) and **Push protection**, **Dependabot alerts** and **Private vulnerability reporting**. All are free on public repos.
12. Settings → **Actions → General**: if Actions stay unused, choose **Disable actions**. Otherwise, **Require approval for all outside collaborators** on fork PR workflows.
13. Check from a signed-out browser window that the repo, README and LICENSE show as expected.
