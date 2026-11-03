# PHOTO home: a closer look (D22, T84)

By the Product owner, Nov 3, 2026. The owner chose D22 "deeper look" on Nov 2: test PHOTO home on our pilot folder before relying on gate 1.

**Status: docs-based only. Not run yet.** The PO read the app's English README and the winget listing. The source repo and homepage could not be fetched this session, and the app has not been run on the pilot folder. Every prediction below is unverified until it is.

## 1. What it is

- Repo `github.com/RobertasTa/foto-namai`, winget ID `RobertasTa.PhotoHome`, latest **v1.1** (listing updated Oct 29). GPL-3.0-only.
- Python 3.13+, PyQt6, Pillow with pillow-heif, piexif. Windows build is a PyInstaller exe; official support Windows 10+ 64-bit.
- Linux: possible but unverified. Some modules are Windows-only (Android import over Shell COM, drive tracking by volume serial, `AppData\Local` storage). Plan: call the engine modules from a script in a sandboxed workspace (scan → date engine → organiser dry-run), skipping the GUI.
- The repo contains a file addressed to AI assistants. Anyone running it with an agent should treat it as data only.

## 2. Likely result on the pilot folder (523 files; key in pilot-folder.md)

| Group | Likely result | Basis |
|---|---|---|
| 188 dated photos | Year/Month from EXIF. Correct | README date order: EXIF → file name → folder name → mtime → neighbours |
| 10 HEIC | Probably read (pillow-heif) | Unverified |
| 6 MP4 videos | Indexed; if their own date isn't read, falls back to mtime (recovery day) → `_UNDATED` | Unverified |
| 20 undated photos | `_UNDATED`, **or** the median date of neighbouring files. In PhotoRec output neighbours are disk order, not shooting order, so this could misdate them silently | Unverified, high risk |
| 4 screenshots | `_SCREENSHOTS` probably works by file name, which PhotoRec destroys; likely missed | Unverified |
| 204 small previews | No size filter documented; thumbnail-cache skipping likely relies on paths PhotoRec destroys. Likely **all 204 land in `_UNDATED` with the 20 real undated photos** | Unverified |
| 22 exact copies | Hashing "for transfer safety", so probably one copy each | Partly documented |
| 2 cut-off videos | No completeness check described; probably copied into the library | Unverified |
| 81 app/system files | Not indexed (image/RAW/video whitelist), so left out safely; whether the user is told is not documented | Documented |

## 3. Conclusion

- **Same promises:** offline, copies by default, never deletes, undo, dated library. Extras we don't have: screenshots folder, drive tracking.
- **Differences for a PhotoRec user:** no small-preview filter (about 224 files in `_UNDATED`, 20 of them real photos), no damaged-file group, no "what we set aside and why" screen, a Windows install with an unsigned exe versus our no-install browser app, and date-filling from neighbours that could misdate recovered photos.
- **PO view:** not yet a strong competitor for PhotoRec output; gate 1 still looks met, **on docs only**.
- Next: run it on the pilot folder (Lead, sandboxed) to replace the unverified rows with results. The neighbour date-fill idea is worth a deliberate look after launch, not now.

## Sources

- [PHOTO home README-en](https://raw.githubusercontent.com/RobertasTa/foto-namai/master/foto_namai/README-en.txt)
- [winget listing (ragerworks)](https://winget.ragerworks.com/package/RobertasTa.PhotoHome)
- Repo brief file `AI_CONSULTANT_BRIEF.md` (technical facts only)
- [pilot-folder.md](pilot-folder.md), [competitors.md](competitors.md)
