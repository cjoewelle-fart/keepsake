# Build constant-30fps H.264 MP4s from screencast frames (frames held by timestamp).
import json, os, subprocess, sys
import os
OUT = os.environ.get('CAPTURE_OUT', 'video/capture/out')
for s in sys.argv[1:]:
    raw = f'{OUT}/raw/{s}'
    for clip in sorted(os.listdir(raw)):
        fj = f'{raw}/{clip}/frames.json'
        if not os.path.exists(fj): continue
        d = json.load(open(fj)); fr = d['frames']; t0, t1 = d['t0'], d['t1']
        fr = [f for f in fr if f['ts'] <= t1]
        lines = []
        for i, f in enumerate(fr):
            start = t0 if i == 0 else f['ts']          # first frame stands from the clip start
            end = fr[i + 1]['ts'] if i + 1 < len(fr) else t1
            lines += [f"file '{raw}/{clip}/{f['file']}'", f'duration {max(end - start, 0.001):.6f}']
        lines.append(f"file '{raw}/{clip}/{fr[-1]['file']}'")
        lst = f'{raw}/{clip}/concat.txt'; open(lst, 'w').write('\n'.join(lines) + '\n')
        out = f'{OUT}/{s}/{clip}.mp4'
        subprocess.run(['/usr/local/bin/ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                        '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
                        '-r', '30', '-t', f'{t1 - t0:.3f}', '-movflags', '+faststart', '-an', out], check=True)
        print(out, len(fr), 'frames', round(t1 - t0, 2), 's')
