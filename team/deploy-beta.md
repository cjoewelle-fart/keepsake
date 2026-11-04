# Putting the beta online (T85)

How to put `dist/` on a free static host at a private, unlisted HTTPS address (D27), under the working name Keepsake (D26). Once the owner has an account on Cloudflare Pages or Netlify, this takes about 10–15 minutes. Both hosts take a direct upload of the `dist/` folder, so there's no Git connection and the repo stays private.

## What the build already contains

`npm run build` writes everything the host needs into `dist/`. You don't add or edit anything after the build.

| File | What it's for |
|---|---|
| `_headers` | Response headers. Cloudflare Pages and Netlify both read this format. Generated from `vite.deploy.ts`: don't edit it by hand. |
| `robots.txt` | `Disallow: /` for every crawler (unlisted beta) |
| `sw.js`, `registerSW.js`, `manifest.webmanifest` | Offline install. Sent with `Cache-Control: no-cache` so a new upload reaches testers on their next visit |
| `assets/*` | Content-hashed files, cached for a year (`immutable`) |

The headers in `_headers`:

- Every path: `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `Content-Security-Policy` uses the same policy as the `<meta>` tag in `index.html`, from one constant, with `connect-src 'self'`. The build fails if the two ever differ. It's set on `/`, `/index.html`, `/sw.js` and the thumbnail worker.
- Paths that don't match a file get the app page from the host's single-page fallback. Those responses have no CSP header, only the `<meta>` CSP inside the page.
- The scan and save workers start from `blob:` URLs, so they inherit the page's policy. Only workers loaded from their own URL (thumbnail, HEIC) take their CSP from their own response.
- The HEIC decoder worker (`assets/heic.worker-*.js`, the large one) gets **no** CSP header. As a URL-loaded worker it takes its CSP from its own response, and `script-src 'self'` blocks WebAssembly, so the header would break iPhone photo previews. That's the same as today, because the `<meta>` tag never reaches URL-loaded workers. The build fails if the HEIC worker would ever get the header. Covering this worker too means adding `'wasm-unsafe-eval'` to `script-src`, which only allows WebAssembly, not JavaScript `eval`. Changing the CSP is the owner's call, so it's been raised with the Team Lead for the dashboard.

## 1. Build (both hosts)

From a clean checkout of the commit you want testers to get:

```
npm ci
npm test
npm run build
```

Optional: run the release checks against `dist/` with the real hosting headers before you upload anything:

```
npm run fixture                          # once: the test recovery folder
npm run serve-dist                       # serves dist/ with _headers at http://localhost:4180 (leave it running)
BASE_URL=http://localhost:4180/ npm run e2e
BASE_URL=http://localhost:4180/ npm run offline-check
```

## 2a. Cloudflare Pages (direct upload)

1. Sign in at dash.cloudflare.com. Go to **Workers & Pages**, then **Create**, then the **Pages** tab, then **Upload assets**. The label may say "Use direct upload".
2. Project name: something hard to guess, like `keepsake-beta-7f3k2q`. The address is `https://<project-name>.pages.dev`, and anyone who knows the name can open it.
3. Drag the **`dist` folder** onto the upload area. Check that `_headers` and `robots.txt` are in the file list. Then click **Deploy site**.
4. In the project's settings, make sure **Web Analytics** is off. If it's on, Cloudflare adds a tracking script. The CSP would block it, but the e2e check would report it as a request to another address.
5. To ship an update, open the project, choose **Create new deployment**, and upload the new `dist`. To roll back, open **Deployments**, pick an earlier one, and choose **Rollback to this deployment**.

Command-line alternative (needs a one-time `wrangler login`): `npx wrangler pages deploy dist --project-name=<project-name>`

Note: Cloudflare redirects `/index.html` to `/`. That's expected.

## 2b. Netlify (manual deploy)

1. Sign in at app.netlify.com. Go to **Add new project** (or "Add new site"), then **Deploy manually**.
2. Drag the **`dist` folder** onto the drop area.
3. Netlify picks a random name. To change it, go to **Project configuration**, then **Change project name** (or site name), and pick something hard to guess. The address is `https://<name>.netlify.app`.
4. Leave **Snippet injection** empty and don't turn on Netlify Analytics.
5. To ship an update, open **Deploys** and drag the new `dist` onto "Need to update your site?". To roll back, pick an earlier deploy and choose **Publish deploy**.

Command-line alternative (needs a one-time `netlify login`): `npx netlify-cli deploy --dir=dist --prod`

## 3. Check the headers (2 minutes)

Replace `$URL` with the address, ending in `/`:

```
curl -sI "$URL" | grep -iE 'content-security|x-robots|referrer|nosniff|permissions|cache-control'
curl -sI "${URL}sw.js" | grep -iE 'content-security|cache-control'
curl -sI "${URL}manifest.webmanifest" | grep -i cache-control
curl -s  "${URL}robots.txt"
grep -o 'assets/[^ ]*\.js' dist/_headers | head -1     # a hashed file to check:
curl -sI "${URL}assets/<that file>" | grep -i cache-control
```

You should see:

- `/`: the CSP, which must match `dist/_headers` character for character and include `connect-src 'self'`. Also `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Cache-Control: no-cache`.
- `sw.js`: the CSP and `Cache-Control: no-cache`.
- `manifest.webmanifest`: `Cache-Control: no-cache`.
- `robots.txt`: `User-agent: *` and `Disallow: /`.
- The hashed asset: `Cache-Control: public, max-age=31536000, immutable`.
- No header should show up twice. If one does, a host-level setting is adding it as well.

## 4. Run the e2e and offline checks against the hosted address

Both scripts accept `BASE_URL`, or `--base-url <url>`. With it set, they skip the local preview server and test the hosted copy. Without it, they behave as before. You still need the local test folder (`npm run fixture`), because the scripts pick files from this computer.

```
npm run fixture
BASE_URL=https://<address>/ npm run e2e
BASE_URL=https://<address>/ npm run offline-check
```

- Both must pass. `e2e` ends with "No requests left this computer." `offline-check` ends with "OFFLINE CHECK PASSED" and "zero requests to any origin other than https://<address>".
- Both fail on any CSP violation, in the page or in its workers. `offline-check` also scans a folder holding only a HEIC photo and checks that its on-screen tile shows the decoded picture.
- Set `CHROMIUM_PATH` if Playwright's own browser isn't installed.
- A quick look by hand doesn't hurt: open the address in Chrome, choose a folder with the files from `tests/heic/`, and check you see pictures, not grey tiles labelled "HEIC".

## 5. Before testers get the link

- **Privacy page:** the line about "The website that sends you the app" in `team/content/privacy-page.md` has `[CONFIRM: hosting provider and what visit logs it keeps]`. Once the owner picks the host, the writer fills it in from that host's own documentation on visit logs. Don't change it as part of the deploy.
- **Unlisted is not private.** Anyone with the link can open the app. `noindex` and `robots.txt` only keep it out of search engines. If the owner wants a password or an allow-list (Cloudflare Access, or Netlify's password protection on paid plans), that's the owner's call.
- Make sure the in-app feedback link is ready before the first invite (T87).

## Known gaps

- The CSP-violation watch uses Chromium's DevTools protocol, so these checks only run in Chromium.
- A scan of a very small folder (1–3 files) sometimes stops at "Checked 1 of 1 files, 100%" and never shows the results. This is a separate app bug and not about hosting. `offline-check` retries its HEIC-only scan up to 3 times and prints a NOTE line when it does.
- If you set `BASE_URL` to a path below the domain root, the `_headers` paths (`/sw.js`, `/assets/*`) won't match. Deploy at the root of the address.
