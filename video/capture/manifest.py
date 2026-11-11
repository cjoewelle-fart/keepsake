import json, os, re, subprocess
from PIL import Image
import os
OUT = os.environ.get('CAPTURE_OUT', 'video/capture/out')
PILOT = '/home/claude/keepsake/fixtures/pilot/Recovered from old phone'
key = json.load(open('/home/claude/keepsake/fixtures/pilot/pilot-key.json'))['files']
files = []
for dp, _, fs in os.walk(PILOT):
    for f in fs:
        rel = os.path.relpath(os.path.join(dp, f), PILOT)
        k = key.get(rel, {})
        files.append({'path': rel, 'bytes': os.path.getsize(os.path.join(dp, f)), 'group': k.get('label'), 'note': k.get('note'), 'kind': k.get('kind'), 'year': k.get('year')})
files.sort(key=lambda x: x['path'])
json.dump({'folder': 'Recovered from old phone', 'count': len(files), 'groupNames': {'keep': 'Kept, sorted by date', 'small': 'Small preview copies', 'duplicate': 'Exact copies', 'damaged': 'Damaged or incomplete files', 'system': 'App and system files'}, 'files': files}, open(f'{OUT}/pilot-files.json', 'w'), indent=1)

def probe(p):
    e = subprocess.run(['/usr/local/bin/ffmpeg', '-i', p, '-map', '0:v', '-c', 'copy', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.search(r'Video: (\w+).*?(yuv\w+).*?, (\d+)x(\d+).*?, ([\d.]+) fps', e)
    d = re.search(r'Duration: (\d+):(\d+):([\d.]+)', e); n = re.findall(r'frame=\s*(\d+)', e)
    return {'codec': m.group(1), 'pix_fmt': m.group(2), 'resolution': f'{m.group(3)}x{m.group(4)}', 'fps': float(m.group(5)),
            'duration_s': round(int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)), 2), 'frames': round(int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)), 2) * 30 // 1}

DESC = {
 'start-entrance': ('1 start (extra)', 'Page load of the start screen with its own entrance motion (hero photo fan deals in), then rest. First ~0.5 s is the blank page before first paint; trim it.'),
 'start': ('1 start', 'Start screen at rest after the entrance: "Recovered photos, sorted by date.", hero photo fan, "Sort my recovered files" button, privacy line, stepper Scan/Sort/Choose/Save.'),
 'scan': ('2 scan', 'Press "Sort my recovered files" -> "Checking your files..." with progress bar "Checked N of 539 files" and the three stage ticks -> results screen with the 214 count-up; ~1.5 s hold.'),
 'results': ('3 results', 'Results settled: "We found 214 photos and videos."; ledger Files checked 539 / Kept, sorted by date 214 / Set aside, kept safe below 325; "None of your files were deleted or sent anywhere." note; Review button.'),
 'setaside': ('4 setaside', 'Opens "Small preview copies 204", its explanation and "Keep these files", then "See all 204 files" list (real names, e.g. recup_dir.2/f0221440.jpg Photo 10.4 KB) under "These files stay in your recovery folder. Nothing has been deleted."'),
 'review': ('5 review', '"Choose what to save" timeline, eased scroll (~6.5 s) from December 2024 down through the months of 2024 (desktop to ~April 2024, phone to ~February 2024); 214 of 214 selected.'),
 'save': ('6 save', 'Press "Save my 214 photos and videos" -> "Where should we save your 214 photos and videos?" (Save to a folder, How your folder will look) ~2.5 s -> Choose a folder (Pictures, via the picker stand-in) -> "Your 214 photos and videos are saved." with tick drawing; ~1.5 s hold. Longer than 8 s: two screens; trim as needed.'),
 'done': ('6 done', 'Done screen settled: "Your 214 photos and videos are saved.", 183 days 2019-2024 plus 20 no date, "sorted into a folder for each year and month", Pictures > Upsort photos; desktop also shows the receipt (Saved 214, Couldn\'t save 0, Sorted into 6 years, 68 months, plus No date (20), Recovery folder Untouched).'),
}
STILL = {'1-start': 'start', '3-results': 'results', '3-results-full': 'results (full page)', '4-setaside': 'setaside', '5-review': 'review (end of scroll)', '5-review-top': 'review (top)', '6-save-choose': 'save (choose a folder screen)', '6-done': 'done', '6-done-full': 'done (full page)'}
items = []
for s in ['desktop', 'phone']:
    info = json.load(open(f'{OUT}/raw/{s}-info.json'))
    for c in ['start-entrance', 'start', 'scan', 'results', 'setaside', 'review', 'save', 'done']:
        p = f'{OUT}/{s}/{c}.mp4'
        items.append({'type': 'clip', 'set': s, 'shot': DESC[c][0], 'name': c, 'path': p, **probe(p), 'on_screen': DESC[c][1]})
    for k, v in STILL.items():
        p = f'{OUT}/{s}/{k}.png'
        w, h = Image.open(p).size
        items.append({'type': 'still', 'set': s, 'shot': v, 'path': p, 'resolution': f'{w}x{h}'})
sets = {}
for s in ['desktop', 'phone']:
    info = json.load(open(f'{OUT}/raw/{s}-info.json'))
    sets[s] = {'viewport': info['viewport'], 'scan_seconds': info['shots']['scan']['scanSeconds'], 'progress_texts_seen': info['shots']['scan']['progressTexts'],
               'numbers': {'results': info['shots']['results'], 'review_selected': info['shots']['review']['selected'], 'review_filter_chips': info['shots']['review']['filterChips'],
                           'done': {k: info['shots']['done'][k] for k in ('h1', 'saved', 'failed', 'find')}, 'files_written_to_Pictures': info['saved']['count'],
                           'year_folders_written': len({f.split('/')[1] for f in info['saved']['folders'] if f.split('/')[1][:2] in ('19','20')}), 'month_folders_written': len([f for f in info['saved']['folders'] if f.count('/') == 2 and f.split('/')[1][:2] in ('19','20')]), 'no_date_folder': any(f.split('/')[1] == 'No date' for f in info['saved']['folders'])},
               'console_errors': info['errors'], 'requests_to_other_origins': info['outside']}
json.dump({'source': 'Upsort test build (dist-test, repo 7a90772) served by scripts/serve-dist.mjs on :4600; pilot folder "Recovered from old phone" (539 files) copied into OPFS and picked via a showDirectoryPicker stand-in (pilot-e2e approach). Save went through the folder (File System Access) path into an OPFS "Pictures" folder.',
           'capture': 'CDP Page.startScreencast, jpeg q95, everyNthFrame 1, full-res frames (phone: Chromium launched with --force-device-scale-factor=3, otherwise screencast gave 390x844); frames held by timestamp to constant 30 fps; libx264 crf 16 preset slow yuv420p. reducedMotion no-preference; no cursor drawn (headless).',
           'sets': sets, 'items': items, 'pilot_files': f'{OUT}/pilot-files.json'}, open(f'{OUT}/manifest.json', 'w'), indent=1)
for i in items:
    if i['type'] == 'clip': print(i['set'], i['name'], i['resolution'], i['fps'], i['duration_s'], i['frames'], i['codec'], i['pix_fmt'])
print(json.dumps(sets, indent=1)[:2500])
