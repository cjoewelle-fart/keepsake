# Competitor scan: tools that sort PhotoRec output

*T15, Gate 1 (Validate). Re-checked 19 Oct 2026.*

| Name | Type | What it does | Gaps vs Keepsake | Link |
|---|---|---|---|---|
| sort-PhotorecRecoveredFiles | Command-line tool (Python) | Copies files into folders by type, and JPEGs by year and "event". Doesn't change the originals | No interface. Doesn't set aside previews, copies or broken files | [GitHub](https://github.com/tfrdidi/sort-PhotorecRecoveredFiles) |
| photorec-sorter (v0.2.2, Jan 2026) | Command-line tool (Python) | Updated copy of the tool above | Same gaps | [PyPI](https://pypi.org/project/photorec-sorter/) |
| sortrec, photorec-directory-beautifier, photorec-sort, recsort | Command-line tools (Go, Java, Python) | Sort by file type and EXIF date | No interface. No cleanup | [sortrec](https://github.com/yunginnanet/sortrec), [beautifier](https://github.com/de-jcup/photorec-directory-beautifier) |
| PRECsort | Shell script | Moves files by type, removes duplicates, renames JPEGs | Command line. Moves and deletes, so it can't be undone | [CGSecurity wiki](https://www.cgsecurity.org/wiki/After_Using_PhotoRec) |
| reclaim | Terminal toolkit | Copies the card, recovers files, repairs videos, groups copies by fingerprint (moves them), sorts by date | Terminal only, for experts. No preview filter. Windows needs WSL2 | [GitHub](https://github.com/hjanesh/reclaim) |
| PhotoRec Refinery | Desktop app (Mac, Windows, Linux) | Deletes unwanted file types from `recup_dir` and moves the rest into folders by type | Deletes files. Sorts by type only, not date. No previews, copies or broken-file checks. Made for forensics users (0 stars) | [GitHub](https://github.com/WarpedWing/photorec-refinery) |
| Czkawka / dupeGuru | Desktop duplicate finders | Find exact and similar copies, broken files, empty files | Not built for recovered files. No dated library. Deleting is the default action | [Czkawka](https://linuxuprising.com/2021/03/find-and-remove-duplicate-files-similar.html) |
| Disk Drill (and other paid recovery suites) | Paid desktop recovery app | Recovers files and filters results by type, with previews | Doesn't work on an existing PhotoRec folder. No dated library or cleanup of previews and copies | [CleverFiles](https://www.cleverfiles.com/help/find-specific-lost-item-in-disk-drill.html) |
| PHOTO home (v1.0.0 Oct 14, v1.1 by Oct 29, 2026) | Free Windows desktop app, GPL-3.0, offline | Sorts a photo archive into Year/Month folders, with a plan you review first. Copies by default and never deletes. Undo journal. Undated photos go to `_UNDATED`. No account, cloud or telemetry | Windows only. Made for home photo archives and phone imports, not PhotoRec output. No cleanup of tiny previews, system files or broken files described. **Closest product found so far:** same promises (offline, never deletes, undoable, dated library). Found Oct 27 in naming round 6. | [wingetly](https://wingetly.io/apps/robertas-ta/photo-home) |
| Sortrix (Microsoft Store) | Windows app, "fully offline & private" | Sorts photos into folders by year from the date taken; finds duplicate and similar photos "so you can remove them"; can group faces | Not built for PhotoRec output; no cleanup of previews, system or broken files described. Offers removal of duplicates, which we never do. Found Oct 28 in naming round 13. | [Microsoft Store](https://apps.microsoft.com/detail/9n5hppbjp1mm) |

## Conclusion

1. No strong competitor: no tool combines a friendly interface, cleanup of previews, copies and broken files, and a dated library.
2. The nearest one, PhotoRec Refinery, deletes files and sorts by type only. That conflicts with "never destructive" and doesn't help non-technical users.
3. Gate 1's "no strong competitor" condition is met. Re-check before the public launch (phase 5).
4. **Oct 27 update:** PHOTO home (above) shares our core promises for ordinary photo archives. It doesn't target recovered files or clean up previews and junk, but it's the closest product yet. Whether it changes gate 1 is the owner's call (D22).
5. **Oct 28 update:** Sortrix (above) also sorts photos by year offline. It removes duplicates and isn't made for recovered files. Added to D22.
6. **Nov 3 update (D22, T84):** docs-based look in [photo-home-deeper-look.md](photo-home-deeper-look.md). Likely misses all 204 small previews and the 2 cut-off videos on the pilot folder; not yet run, so unverified.

## Sources

- [CGSecurity: After Using PhotoRec](https://www.cgsecurity.org/wiki/After_Using_PhotoRec)
- [GitHub topic: photorec](https://github.com/topics/photorec)
- [sort-PhotorecRecoveredFiles](https://github.com/tfrdidi/sort-PhotorecRecoveredFiles)
- [photorec-sorter (PyPI)](https://pypi.org/project/photorec-sorter/)
- [sortrec](https://github.com/yunginnanet/sortrec)
- [photorec-directory-beautifier](https://github.com/de-jcup/photorec-directory-beautifier)
- [reclaim](https://github.com/hjanesh/reclaim)
- [PhotoRec Refinery](https://github.com/WarpedWing/photorec-refinery)
- [Linux Uprising: Czkawka](https://linuxuprising.com/2021/03/find-and-remove-duplicate-files-similar.html)
- [PHOTO home (wingetly)](https://wingetly.io/apps/robertas-ta/photo-home)
- [Sortrix (Microsoft Store)](https://apps.microsoft.com/detail/9n5hppbjp1mm)
- [Disk Drill help](https://www.cleverfiles.com/help/find-specific-lost-item-in-disk-drill.html)


## Update — Nov 9, 2026 (T93, R10: re-check before launch)

### Existing competitors
| Name | Change since Oct 19–29 | Source |
|---|---|---|
| PHOTO home | No change: still v1.1, listing last updated Oct 29, Windows 10/11 only, GPL-3.0, offline. Still no mention of recovered files or PhotoRec. Never copies the same content twice (checked byte for byte); duplicate finding is in a separate app from the same publisher. Our trial run on the pilot folder (D22/T84) still hasn't happened. | [wingetly](https://wingetly.io/apps/robertas-ta/photo-home) |
| photorec-sorter | No change: v0.2.2 (Jan 5, 2026), command line only, copies files and never changes the originals. | [PyPI](https://pypi.org/project/photorec-sorter/) |
| sort-photorec-datarecovery | Not new, but missing from our list: Python script, sorts by type, year and month. Moves files rather than copying them. Last updated Mar 2022. | [SourceForge](https://sourceforge.net/projects/sort-photorec-datarecovery) |
| Stellar Photo Recovery | Its date-sorting guide (updated Jun 12, 2026) still sorts by EXIF date by hand or with other tools. No built-in date sorting. | [Stellar blog](https://www.stellarinfo.com/blog/restore-recovered-photos-with-exif-metadata) |
| Sortrix, PhotoRec Refinery | Not re-checked: both pages were blocked this session. | — |

### New entrants
| Name | What it is | Gaps vs Keepsake | Source |
|---|---|---|---|
| **Photo Date Rescue (PDR)** v3.1 (Nov 2026) | Paid Windows photo suite: $19/mo, $79/yr or $199 lifetime. Free trial is capped at 1,000 files. Mac version targeted for Q4 2026 to Q1 2027. Fixes photo dates and shows how sure it is about each one. Photos it can't date go to a "Needs Dates" view. Fixes are saved as copies and the originals are left alone. Deleted items go to an in-app recycle bin. v3.1 added "Clones", a duplicate finder that sorts copies into five piles and suggests which one to keep. Photos are never uploaded, but trial runs must reach an online counter. | Paid. Windows only for now. Doesn't mention PhotoRec or recovered files. No filter for small previews, damaged files or system images. A large app (the AI model download is 577 MB). Its "Needs Dates" view does the same job as our Undated group. | [Home](https://pdr-website.pages.dev/), [What's new](https://pdr-website.pages.dev/whats-new.html) |
| Wondershare Recoverit "AI Search" | Paid recovery suite. Describes a "new" search of recovered files by plain-language query, with filters for time, device and file type. Groups related files such as RAW+JPG pairs. Runs on your computer "where supported". Page updated Nov 6, 2026. | Search inside its own scan results, not a dated library. Doesn't work on a PhotoRec folder. No clear filter for small previews. Doesn't fully promise local processing. | [Recoverit AI Search](https://recoverit.wondershare.com/photo-recovery/how-ai-search-works-in-photo-recovery.html), [Recoverit: recovered photos without file names](https://recoverit.wondershare.com/photo-recovery/find-recovered-photos-without-file-names.html) |
| photosort (Show HN, Apr 2, 2026) | Browser app (Chrome and Edge), €9.99. Local AI sorts photos into event folders such as trips and weddings. | Sorts by event, not date. Paid. Not made for recovered files. No cleanup. | [HN Showcase](https://hnshowcase.com/post/47620198/i-built-an-offline-and-privacy-first-photo-sorter) |
| PhotoSo | Free browser app that works offline. You sort photos by hand into accepted and rejected folders, and it moves the files on disk. | Hand sorting, no dates. Moves the files. Not made for recovered files. | [dev.to](https://dev.to/salswa/photoso-sort-your-photos-fast-privately-in-browser-without-leaving-any-window-gaf) |
| PixelTidy | Mac app, $6. Sorts photos into year/month/day folders from EXIF. Can rename, move or skip duplicates. Works offline. | Mac only, paid. Not made for recovered files. | [AlternativeTo](https://alternativeto.net/software/pixeltidy/about) |

### Platform features
- **Google Photos:** found in an app teardown, not released: "Ask" may let you change one photo's date, caption or place. Bulk editing isn't mentioned. It works on photos already in the cloud, so it doesn't help with a recovery folder. ([Android Authority, Jul 15, 2026](https://androidauthority.com/google-photos-ask-photos-edit-metadata-apk-teardown-3687738))
- **Apple Photos:** I didn't verify anything; my searches found no feature for recovered or undated files.

### Conclusion
1. Still no strong competitor for PhotoRec output. No tool found combines all of: made for recovered files, sets aside previews, damaged files and system images, a dated library, and plain language for non-technical users.
2. Many tools now promise offline, private and non-destructive (PHOTO home, PDR, Sortrix, PixelTidy, photosort, PhotoSo). Those promises are no longer unique to us. Being made for recovered files, and free, is what sets us apart.
3. PDR is now the most polished nearby product: date confidence, a "Needs Dates" view, and a duplicate finder. It is paid, Windows only, and not built for recovered files.
4. Still open: running PHOTO home on the pilot folder (D22/T84), and re-checking Sortrix and PhotoRec Refinery.
