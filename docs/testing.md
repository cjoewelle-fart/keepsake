# Testing and performance

Extra test, benchmark and memory tools for Upsort, run from the repository root; the everyday commands are in the README.

## Remaking test files

```bash
python3 scripts/make_heic_samples.py tests/heic   # remake the HEIC test files (needs pillow-heif)
python3 scripts/make_video_samples.py tests/videos   # remake the hard-to-play video test files (needs ffmpeg with libx265)
```

## Performance and memory

```bash
node scripts/bench_copies.mjs --files 40000 --concurrency 1,4   # times a 40,000-file scan (12 GB in a temp dir, deleted after)
node scripts/bench_copies_browser.mjs <path-to-chromium> <folder>   # the same in a Chromium worker (make <folder> with bench_copies.mjs --dir)
python3 scripts/make_perf_folder.py /tmp/perf/recovery   # a realistic 40,000-file recovery (~5.6 GB: 12 MP JPEGs and HEICs, videos, thumbnails, junk; delete after)
npm run build && node scripts/perf-browser.mjs <path-to-chromium> /tmp/perf/recovery --runs 3   # full scan + review timeline in the built app: times, memory, long tasks, scroll smoothness
```

`perf-browser.mjs` serves the production build on port 4175 (`--port`), runs each pass in a fresh browser, and prints one line per run plus the median and range. Add `--profile <dir>` to save CPU profiles of the page and the scan worker (open them in Chrome DevTools' Performance panel), or `--no-previews` to replace every preview with a blank image (tells picture decoding apart from the page's own work). `--handoff` measures only the seconds after picking: the longest time the page is blocked, when progress first moves, and how fast Stop answers. `PERF_TRACE=<file>` writes memory samples over time; `PERF_MEMDUMP=1` adds Chrome's own memory breakdown (memory-infra) before and after the review screen (`PERF_MEMDUMP=2` adds sub-allocators; the tracing service itself then adds ~40 MB). Each run also reports memory on the results screen just before Review opens (`resultsPssMB`, by process type, plus the page and worker JS heaps). For memory work, `--results-only` stops there; `PERF_GC=1` measures again after a forced garbage collection and `PERF_GC_DURING=1` collects garbage in the workers every ~2 s of the scan (diagnostics only: the DevTools heap profiler adds its own memory); `PERF_HEAPSNAP=<dir>` saves heap snapshots of the page and workers. `node scripts/preview-check.mjs <chromium> <folder>` checks that review tiles show small, upright copies (HEIC included) and nothing leaves the computer. Timings depend on the machine and on anything else running; the load average is printed with each run.

Memory with 40,000 picked files (Chromium 1194, results screen, PSS of all browser processes): about 850 MB, of which Upsort's own share is small. In a bare page with no Upsort code, picking the same folder costs the browser process ~290 MB and the renderer ~50 MB (Chromium's bookkeeping for each picked file; dropping the File objects and collecting garbage gives none of it back), and handing the files to a worker and reading their first 256 KB brings the whole browser to ~735 MB. The page's own JS heap is ~15 MB (records included). What the app controls: the scan worker lets go of each set-aside file as soon as the first pass has sorted it (only files still in Keep are read again, by the copy check), and the worker is shut down once the scan ends, since its copies of the File objects live as long as it does. That took the results screen from ~898 to ~848 MB (median of 3). Previews on the review timeline add their own peak on top (decoding full-size photos for small copies).

The exact-copy check fingerprints 4 files at a time (`copyConcurrency` in `scanAll`), so at most 4 whole files (each up to 64 MB) are in memory at once.
