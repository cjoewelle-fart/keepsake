# Crop the parts screencasts to their element rects and build 30 fps H.264 MP4s (crf 16) + last-frame PNGs,
# then write out/parts/manifest.json. Usage: python3 video/capture/assemble_parts.py
import json, os, subprocess
ROOT = '/home/claude/keepsake/video/capture/out'
RAW, OUT = f'{ROOT}/raw/parts', f'{ROOT}/parts'
FF = '/usr/local/bin/ffmpeg'
m = json.load(open(f'{RAW}/manifest.partial.json'))
import re, struct
def probe(p):
    if p.endswith('.png'):
        w, h = struct.unpack('>II', open(p, 'rb').read()[16:24]); return {'width': w, 'height': h}
    err = subprocess.run([FF, '-hide_banner', '-i', p], capture_output=True, text=True).stderr
    w, h = re.search(r'Video: .*?, (\d+)x(\d+)', err).groups(); return {'width': int(w), 'height': int(h)}
for c in m['clips']:
    name = c['file'][:-4]
    d = json.load(open(f'{RAW}/{name}/frames.json'))
    t0, t1, fr = d['t0'], d['t1'], sorted(d['frames'], key=lambda f: f['ts'])
    before = [f for f in fr if f['ts'] <= t0]
    use = before[-1:] + [f for f in fr if t0 < f['ts'] <= t1]
    lines = []
    for i, f in enumerate(use):
        start = t0 if i == 0 else f['ts']
        end = use[i + 1]['ts'] if i + 1 < len(use) else t1
        lines += [f"file '{RAW}/{name}/{f['file']}'", f'duration {max(end - start, 0.001):.6f}']
    lines.append(f"file '{RAW}/{name}/{use[-1]['file']}'")
    lst = f'{RAW}/{name}/concat.txt'; open(lst, 'w').write('\n'.join(lines) + '\n')
    k = d['dpr']; cr = d['crop']
    w, h, x, y = cr['width'] * k, cr['height'] * k, cr['x'] * k, cr['y'] * k
    w -= w % 2; h -= h % 2
    crop = f'crop={w}:{h}:{x}:{y}'
    subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', f'{crop},fps=30,format=yuv420p',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-r', '30', '-t', f'{t1 - t0:.3f}', '-movflags', '+faststart', '-an', f'{OUT}/{name}.mp4'], check=True)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', f'{RAW}/{name}/{use[-1]["file"]}', '-vf', crop, f'{OUT}/{name}-last.png'], check=True)
    s = probe(f'{OUT}/{name}.mp4')
    c.update(pixelSize=[s['width'], s['height']], seconds=round(t1 - t0, 2), fps=30, crf=16, sourceFramesUsed=len(use),
             lastFrameNote='last screencast frame (JPEG q95 source), cropped')
    print(c['file'], s['width'], 'x', s['height'], c['seconds'], 's', len(use), 'source frames')
for s in m['stills']:
    p = probe(f"{OUT}/{s['file']}"); s['pixelSize'] = [p['width'], p['height']]
json.dump(m, open(f'{OUT}/manifest.json', 'w'), indent=1, ensure_ascii=False)
print('stills', len(m['stills']), 'clips', len(m['clips']))
