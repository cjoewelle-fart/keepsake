# Launch films

HyperFrames projects for the launch video:
- `launch-film/` is the 16:9 film (40 s), for the start screen and the launch page.
- `launch-film-vertical/` is the 9:16 cut (15 s), for Facebook and TikTok.

The scenes are written by `build_scenes.py`. Edit that file and run `python3 video/build_scenes.py` rather than editing `compositions/` by hand.

- **Name, tagline, address:** run `node video/sync-brand.mjs` before rendering. It copies these from `src/brand.ts`, so a rename or a new domain carries through.
- **Captions:** `launch-film/assets/captions.js`.
- **Captures:** `capture/`, real recordings of the test build on the pilot folder.
- **Render:** `npx hyperframes render --quality delivery` inside each project.

## Music

The bed is `launch-film/assets/audio/music.mp3`, chosen by the owner on Nov 12. The original file name is `ikoliks_aj-background-background-music-432715.mp3`.
- **Licence:** the name looks like a Pixabay download (artist, title and track number). Under Pixabay's Content License the track can be used in videos without credit, but the file can't be shared on its own. **The licence page has not been checked yet.**
- **Not in git:** for that reason the mp3 is listed in `.gitignore`. It only exists inside the rendered videos. To re-render, put the file back at that path. The 9:16 project links to the same folder.
- **How it's used:** 110 BPM. The 16:9 film starts at 1.135 s into the track (its first beat), so the quiet intro sits under the opening. The 9:16 cut starts at 5.495 s, where the track is already at full level. Both fade out under the end card.
- **Loudness (measured, Nov 12):** 16:9 at -15.2 LUFS with peaks at -3.3 dBFS; 9:16 at -15.6 LUFS with peaks at -3.1 dBFS.
