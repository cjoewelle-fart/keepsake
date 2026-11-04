// Shared checks for the browser scripts (e2e.mjs, offline-check.mjs).

/**
 * Reports every Content-Security-Policy violation in a page AND in the workers it starts
 * (URL-loaded and blob: workers, and the service worker). A worker's violations never reach the
 * page's console or its securitypolicyviolation event, so this listens to DevTools "issues"
 * (the Audits domain) in each target. Workers are attached with flatten: false, so their messages
 * come through this one CDP session. Chromium only.
 * Returns { workers() } so a check can prove the workers were actually being watched.
 */
export async function watchCsp(context, page, onViolation) {
  const cdp = await context.newCDPSession(page);
  const targets = new Map();
  let id = 1;
  const report = (where, issue) => {
    if (issue.code !== 'ContentSecurityPolicyIssue') return;
    const d = issue.details.contentSecurityPolicyIssueDetails ?? {};
    onViolation(`CSP violation in ${where}: ${d.contentSecurityPolicyViolationType} (${d.violatedDirective})${d.blockedURL ? ` ${d.blockedURL}` : ''}`);
  };
  cdp.on('Audits.issueAdded', (e) => report(page.url(), e.issue));
  cdp.on('Target.attachedToTarget', (e) => {
    targets.set(e.sessionId, e.targetInfo);
    // Audits.enable also sends the issues raised before it was called.
    cdp.send('Target.sendMessageToTarget', { sessionId: e.sessionId, message: JSON.stringify({ id: id++, method: 'Audits.enable' }) }).catch(() => {});
  });
  cdp.on('Target.receivedMessageFromTarget', (e) => {
    const m = JSON.parse(e.message);
    if (m.method === 'Audits.issueAdded') report(`${targets.get(e.sessionId)?.type} ${targets.get(e.sessionId)?.url}`, m.params.issue);
  });
  await cdp.send('Audits.enable');
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
  return { workers: () => [...targets.values()].map((t) => t.url) };
}

/**
 * Scans a folder holding one HEIC photo and checks its preview was really decoded: the tile is
 * on screen, its canvas holds a picture (not blank), and no "HEIC" placeholder label is left.
 * The context's init scripts must already force the file-input fallback.
 */
export async function checkHeicPreview(context, url, folder) {
  const page = await context.newPage();
  const violations = [];
  const watch = await watchCsp(context, page, (v) => violations.push(v));
  try {
    // A scan of a very small folder sometimes ends up stuck on "Checked 1 of 1 files, 100%",
    // sometimes after the results were already shown (a separate app bug, seen 2026-11-04 with
    // 1-3 file folders, HEIC or not). Try up to 3 times and say so, so this check stays about
    // the HEIC preview.
    let stalls = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto(url);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
      await chooser.setFiles(folder);
      // The results screen (the progress screen also says "Files checked").
      const review = page.getByRole('button', { name: /^Review my/ });
      // ...and still there a moment later (the bug can show the results, then go back to 100%).
      const reached = await review.waitFor({ timeout: 20_000 }).then(() => true, () => false)
        && await page.waitForTimeout(1500).then(() => review.isVisible());
      if (reached) break;
      stalls++;
    }
    if (stalls) console.log(`NOTE  the HEIC-only scan stalled at 100% ${stalls} time(s) and was retried (small-folder scan bug, not HEIC)`);
    const tile = page.locator('.tile').first();
    const found = await tile.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    if (!found) {
      return { ok: false, detail: `no preview tile after the scan (screen: "${(await page.locator('h1').first().innerText().catch(() => '?')).replace(/\s+/g, ' ')}"), workers watched: [${watch.workers().join(', ')}]${violations.length ? `\n  ${violations.join('\n  ')}` : ''}` };
    }
    await tile.scrollIntoViewIfNeeded();
    const onScreen = await tile.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    // Decoding takes about a second; give it up to 20.
    let state = { canvas: 0, painted: false, labels: [] };
    for (let i = 0; i < 40; i++) {
      state = await tile.evaluate((el) => {
        const c = el.querySelector('canvas');
        let painted = false;
        if (c && c.width > 0 && c.height > 0 && getComputedStyle(c).display !== 'none') {
          const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let j = 3; j < px.length; j += 4 * 97) if (px[j] > 0 && (px[j - 1] || px[j - 2] || px[j - 3])) { painted = true; break; }
        }
        return { canvas: c?.width ?? 0, painted, labels: [...el.ownerDocument.querySelectorAll('.tile-label')].map((l) => l.textContent) };
      });
      if (state.painted && !state.labels.includes('HEIC')) break;
      await page.waitForTimeout(500);
    }
    const heicWorkerWatched = watch.workers().some((u) => /heic\.worker-.*\.js$/.test(u));
    return {
      ok: onScreen && state.painted && !state.labels.includes('HEIC') && heicWorkerWatched && violations.length === 0,
      detail: `tile on screen: ${onScreen}, canvas ${state.canvas}px painted: ${state.painted}, labels left: [${state.labels.join(', ')}], HEIC worker watched for CSP: ${heicWorkerWatched}${violations.length ? `\n  ${violations.join('\n  ')}` : ''}`,
    };
  } finally {
    await page.close();
  }
}
