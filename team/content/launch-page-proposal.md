# Start screen as the public launch page (proposal, Nov 11)

<!-- Team Lead, with a taste-skill (design-taste-frontend) review. Proposal only: no code changed.
     Visible changes need the owner's OK (Quiet Prints rule, D41). Mockups: team/brand/launch-page/. -->

**Status:** proposal. Nothing here is built. The mockup was made by editing the built page in a test browser (`6ac1efc`), not the code.

**Limits kept:** Quiet Prints fonts, colours, vermilion button, paper grain and the photo-stack headline. No glass, shaders or new effects. Nothing loads from another address, and the CSP is unchanged. Taste-skill's own `system.css`, `system.js` and effects aren't used. Its checklist was used as a review lens only, and its copy-lint passes the new copy (0 FAIL, 0 WARN).

## Before → after

| # | Before | After |
|---|---|---|
| 1 | Title "Upsort". Description says "clean". No share tags or canonical. | Title "Upsort: sort recovered photos by date". New description (154 characters, see below). Open Graph and Twitter share tags with a 1200×630 share image we host ourselves. |
| 2 | h1 "Recovered photos, [prints] sorted by date." | The approved line, split at its colon: a small first line "Made for recovered files." in the h1, then "Your photos, [prints] sorted by date." Screen readers hear the whole approved line. |
| 3 | Lede "Seeing lots of files with strange names?…" | Your approved sentence, word for word: "Upsort turns the jumble of files a recovery tool gives back… It's free, runs in your browser, and nothing is uploaded or deleted." This puts "free" on the first screen. |
| 4 | Button "Choose recovery folder" | "Sort my recovered files". This is the same label as the button at the end of the PhotoRec guide and in the launch message. It still opens the folder picker. |
| 5 | "Works best in Chrome or Edge" only shows in other browsers | It shows for everyone, under the recup_dir hint. Taste-skill says to admit limits early, and so does voice.md rule 5. |
| 6 | No video | A "Watch Upsort sort a recovery folder" section after How it works. Its poster uses our own three prints and a "Play the video (1 min)" button, and nothing loads until that button is pressed (details below). |
| 7 | Good to know: "Do you see my photos?", "Do I need an account?", "Will it change my files?" | "Is it free?", "Does it upload my photos?", "Will it change my files?", "I haven't recovered my files yet" (with a link to the PhotoRec guide). "Do I need an account?" is folded into "Is it free?". The second guide link under Good to know is dropped so the guide link isn't shown twice. |

**Main button at 1366×768:** its bottom edge is at 531 px (before: 455 px). That is inside the 768 px window, and also inside the roughly 657 px a browser leaves once its toolbars are drawn. Phone (390×844): 553 px.

## Head tags (item 1)

```html
<title>Upsort: sort recovered photos by date</title>
<meta name="description" content="Upsort turns the jumble of files a recovery program like PhotoRec gives back into a photo library sorted by date. Free, in your browser, nothing uploaded." />
<link rel="canonical" href="https://LAUNCH-ADDRESS/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Upsort" />
<meta property="og:title" content="Made for recovered files: your photos, sorted by date." />
<meta property="og:description" content="Sorts recovered files into a photo library by date. Free, in your browser." />
<meta property="og:url" content="https://LAUNCH-ADDRESS/" />
<meta property="og:image" content="https://LAUNCH-ADDRESS/launch/share.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Three printed photos fanned out, the middle one dated March 2009." />
<meta name="twitter:card" content="summary_large_image" />
```

- Share previews need full addresses, so `LAUNCH-ADDRESS` waits for D42.
- The share image is made from our own hero prints. It sits in `launch/` so the offline cache skips it.
- The manifest description should match the new description.
- The beta's `noindex` header and its robots.txt block come off only in the launch build. That is part of making it public, so it stays with T95 and your go/no-go.

## Video slot (item 6)

- **Before the click:** the page has no `<video>` element and requests 0 bytes. The poster is built from the prints the page already shows.
- **On the click:** the page inserts `<video controls playsinline src="launch/upsort-launch.mp4">` with a captions track (`launch/upsort-launch.en.vtt`, `default`) and moves focus to it. The click counts as consent, so nothing ever autoplays.
- **Not in the offline cache:** add `globIgnores: ['launch/**']` to the Workbox settings. mp4 and vtt don't match `globPatterns` today, but the share image (png) would. Also add a build test that fails if `sw.js` lists anything under `launch/`. The service worker has no runtime caching, so the video is never stored.
- **Offline:** if the video can't load, show the line "The video needs an internet connection. Everything else here works offline." (Check that wording against the offline check before publishing it.)
- **CSP unchanged:** `media-src 'self'` already covers the video and its captions, and `img-src 'self'` covers the poster.
- **Size:** about 1 minute, H.264, 10 MB at most. The label says "(1 min)".

## Taste-skill items not adopted, and why

- Its `system.css`/`system.js`, dealt palettes and fonts, shader grounds, hover layer and stand-in photography: you ruled these out, and Quiet Prints already covers them.
- "One section per screen": How it works and Good to know are short on purpose. Stretching them to a full screen would add empty space.
- A closing call-to-action section after the FAQ: optional. Ask if you want one.

## Needs the owner

- **D41:** approve the visible changes above (Quiet Prints rule).
- **D42:** the launch web address (needed for the share tags).
- **D43:** who makes the launch video.
