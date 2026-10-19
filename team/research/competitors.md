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

## Conclusion

1. No strong competitor: no tool combines a friendly interface, cleanup of previews, copies and broken files, and a dated library.
2. The nearest one, PhotoRec Refinery, deletes files and sorts by type only. That conflicts with "never destructive" and doesn't help non-technical users.
3. Gate 1's "no strong competitor" condition is met. Re-check before the public launch (phase 5).

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
- [Disk Drill help](https://www.cleverfiles.com/help/find-specific-lost-item-in-disk-drill.html)
