"""Makes the start screen's copy of the launch film and its captions track (Nov 12).

    python3 video/make_web_video.py

Reads the delivery render video/launch-film/renders/upsort-launch-16x9.mp4 and writes
public/launch/upsort-launch.mp4 (H.264 CRF 29, AAC 128k, fast start, about 8 MB) and
public/launch/upsort-launch.en.vtt (the burned-in captions as a text track). The product name comes
from video/launch-film/assets/brand.js (made from src/brand.ts by video/sync-brand.mjs).
public/launch/ is never in the offline cache (vite.launch.ts).
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILM = ROOT / 'video' / 'launch-film'
OUT = ROOT / 'public' / 'launch'

# Caption timings: the same as in build_scenes.py (film_169 captions).
CAPS = [('c1', 0.4, 2.8), ('c2', 3.4, 2.8), ('c3', 6.8, 3.4), ('c4', 10.9, 4.2),
        ('c5', 15.9, 4.8), ('c6', 21.4, 6.2), ('c7', 28.4, 4.8)]


def js_string(src, key):
    return re.search(key + r":\s*(['\"])(.*?)\1,", src).group(2)


def ts(t):
    return f'00:{int(t // 60):02d}:{t % 60:06.3f}'


def main():
    brand = (FILM / 'assets' / 'brand.js').read_text()
    caps = (FILM / 'assets' / 'captions.js').read_text()
    app, tagline, free = js_string(brand, 'appName'), js_string(brand, 'tagline'), js_string(brand, 'freeLine')
    lines = ['WEBVTT', '']
    for i, (k, s, d) in enumerate(CAPS, 1):
        lines += [str(i), f'{ts(s)} --> {ts(s + d)}', js_string(caps, k).replace('{APP}', app), '']
    lines += ['8', f'{ts(34.0)} --> {ts(37.0)}', f"{js_string(caps, 'promiseA')} {js_string(caps, 'promiseB')}", '',
              '9', f'{ts(37.1)} --> {ts(40.0)}', f'{app}. {tagline} {free}', '']
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'upsort-launch.en.vtt').write_text('\n'.join(lines))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(FILM / 'renders' / 'upsort-launch-16x9.mp4'),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(OUT / 'upsort-launch.mp4')], check=True)
    print('wrote', OUT / 'upsort-launch.mp4', OUT / 'upsort-launch.en.vtt')


if __name__ == '__main__':
    main()
