# Launch and growth plan

<!-- Marketing lead (new role, owner approved Nov 13) with the Team Lead. Owner calls are marked "you". Nothing here is posted until you say so. -->

**Status (Nov 13):** upsort.app is live on Cloudflare Pages, and you gave the go for launch and search engines on Nov 13. The repo becomes public on release day (release checklist, section 7).

## 1. How tools like Upsort usually get found

Small, free, open-source utilities rarely grow through their own social pages. They grow where people already go when they have the problem, and through the people who recommend tools. What we found on Nov 13:

- **PhotoRec's own docs list sorting tools.** The "After Using PhotoRec" page on the CGSecurity wiki and section 14 of the official docs both link third-party scripts that sort recovered files: a PowerShell script, and Python tools such as sort-PhotorecRecoveredFiles, photorec_sorter and PRECsort. Every one of them needs a command line. The wiki page is protected, so a listing comes through the maintainer (Christophe Grenier) or the CGSecurity forum's "Contribution" threads, where these scripts were first posted.
- **People ask where help already exists:** the CGSecurity forum, Ask Ubuntu / Launchpad answers, Reddit (r/datarecovery and photography subs), blog tutorials like "how to sort and organize files recovered by PhotoRec".
- **Open-source launches** usually go: a clear README and repo; Show HN and relevant subreddits (author disclosed) on a Tuesday to Thursday morning US time; listings (AlternativeTo, GitHub topics, awesome-lists); then a follow-up post and tutorials. Paid promotion comes last, if at all. Judge traction at 90 days.

**What makes Upsort different from the existing scripts:** no install and no command line, it runs in the browser, sorts by the date the photo was taken (not by file type), sets aside previews, copies and damaged files instead of deleting them, and nothing is uploaded. That's the line for every listing, in the approved words of `team/content/launch-message.md`.

## 2. Channels, in order

| # | Channel | What we'd do | Who | Your call |
|---|---|---|---|---|
| 1 | **CGSecurity forum ("Contribution")** | A short, honest post: what Upsort is, that it reads PhotoRec output on the user's machine, the source link, and a request for feedback. | Marketing drafts, you post | Posting (needs a forum account) |
| 2 | **PhotoRec docs and wiki listing** | A polite note to the maintainer asking to be listed next to the other sorting tools, with a one-line description. | Marketing drafts, you send | Sending; your name on it |
| 3 | **Answer existing questions** | Find 5–10 real, still-useful questions ("how do I sort PhotoRec files by date?"). Answer the question in full first, and mention Upsort as one option, saying you made it. | Marketing drafts, you post | Each post |
| 4 | **Repo goes public** | Description, topics (`photorec`, `photo-recovery`, `photo-organizer`…), social preview image, the 16:9 film or a GIF in the README, first release v1.0.0. | Team | Making it public (already planned) |
| 5 | **Show HN** | "Show HN: Upsort – sort PhotoRec's recovered files into a dated library, in the browser". A short first comment on how it works and the privacy model. Tue–Thu, early US morning. | Marketing drafts, you post | Date; posting from your account |
| 6 | **Listings** | AlternativeTo (as an alternative to the PhotoRec sorter scripts), GitHub topics, relevant awesome-lists (privacy, photography, data recovery) by pull request. | Marketing drafts | Each listing (accounts) |
| 7 | **Search** | The app is one page, so search engines see little. Proposal: a static, crawlable copy of the PhotoRec guide and a "Sort PhotoRec files by date" page on upsort.app, using the existing guide content. | Dev + writer, after your OK | Adding pages (look and scope) |
| 8 | **Social clips** | The 15 s 9:16 film for Facebook and TikTok, and the 16:9 for YouTube. Post in photography and phone-repair groups only where the group allows it, rather than building pages that need daily posting. | Marketing drafts captions | Which accounts, if any (D50) |
| 9 | **Recommenders** | A short note for phone and computer repair shops and tech writers who already write PhotoRec tutorials. | Marketing drafts | Outreach (later) |

## 3. Social media pages: our recommendation

Not at launch. A page needs regular posts to be worth having. Our users don't follow photo-sorting tools; they search when it happens to them. Start with the repo and the website as the home. Use your existing personal accounts for the launch posts (disclosing that you made it). Add one channel later if people ask to follow updates. This is decision D50.

## 4. Measuring without tracking

No analytics in the app (the privacy promise). We use:
- GitHub stars, forks and the repo's traffic page;
- Cloudflare's aggregate request counts for upsort.app (the host already keeps these, as the privacy page says);
- replies, mentions and issues.

The marketing lead records these weekly as dashboard metrics. We won't add trackers, pixels or link shorteners that track.

## 5. Order of work

1. **Release day (team, then you):** move the internal files (D47), make the repo public, set `REPO_URL` and redeploy so "See the code" appears, cut v1.0.0 with the LGPL source archives.
2. **Launch week:**
   - CGSecurity forum post and the maintainer note (channels 1–2);
   - 3–5 helpful answers (channel 3);
   - Show HN on a Tue–Thu (channel 5);
   - AlternativeTo (channel 6).
3. **Weeks 2–4:**
   - the remaining listings and awesome-list PRs;
   - search pages, if you approve;
   - social clips in groups that allow them;
   - a follow-up post with what we learned and fixed.
4. **Day 90:** review the metrics with you, and decide what to keep doing.
