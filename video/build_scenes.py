"""Builds the launch films' scene files (third cut, Nov 12) for HyperFrames.

    python3 video/build_scenes.py

Writes video/launch-film/compositions/*.html (16:9, 40 s) and
video/launch-film-vertical/compositions/*.html (9:16, 15 s), plus both index.html files.

The app's pieces (button, progress bar, stages, set-aside list, year chips, photo tiles, folder
tree) are rebuilt as type and images with the app's own labels, colours and icons, so they can
move like a film. Everything sits straight on the paper ground: no cards, no shadows on UI.
Product name, tagline and address come from assets/brand.js (made from src/brand.ts by
video/sync-brand.mjs); caption text comes from assets/captions.js.
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILM = ROOT / 'launch-film'
VERT = ROOT / 'launch-film-vertical'
files = json.load(open(ROOT / 'capture' / 'pilot-files.json'))['files']

INK, MUTED, ACCENT, DEEP, CTA, CTA_DOWN = '#1F2427', '#545B5F', '#23596B', '#1D4D5D', '#C2410C', '#9A3412'
RULE, DATE, GROUND = '#CBD8D4', '#8A4B08', '#ECF1F0'

FONTS = '''@font-face { font-family: "Bricolage Grotesque"; src: url("assets/fonts/bricolage-grotesque-latin-opsz-normal.woff2") format("woff2"); font-weight: 200 800; }
    @font-face { font-family: "Atkinson Hyperlegible"; src: url("assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2") format("woff2"); font-weight: 400; }
    @font-face { font-family: "Atkinson Hyperlegible"; src: url("assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2") format("woff2"); font-weight: 700; }'''

# The app's own icons (src/ui/icons.tsx), 24-unit grid, stroke 1.8.
def icon(paths, size, colour, width=1.8, extra=''):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{colour}" stroke-width="{width}" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {extra}>{paths}</svg>')
FOLDER_OPEN = ('<path d="M4 19.5h14.2a1.6 1.6 0 0 0 1.55-1.2l1.7-6.3A1.2 1.2 0 0 0 20.3 10.5H8.3a1.6 1.6 0 0 0-1.55 1.2L4 19.5z" />'
               '<path d="M4 19.5A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5h4.4l2 2.2h6.1A1.5 1.5 0 0 1 18 8.2v2.3" />')
FOLDER = '<path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h4.6l2.1 2.2h8.3A1.5 1.5 0 0 1 21 9.2v8.3a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />'
PHOTO = '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><circle cx="9" cy="9.5" r="1.6" /><path d="M20.5 15.5l-4.5-4.5-8 8" />'
LOCK = '<rect x="4.5" y="10.5" width="15" height="10" rx="2.6" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /><path d="M12 14.6v2" />'
SHIELD = '<path d="M12 3l7.5 2.8v5.6c0 4.6-3.1 8.1-7.5 9.6-4.4-1.5-7.5-5-7.5-9.6V5.8z" /><path d="M8.6 12.1l2.4 2.4 4.4-4.6" />'
CHECK_CIRCLE = '<circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.7 2.7 5.3-5.6" />'

def kb(b):
    return f'{b / 1048576:.1f} MB' if b >= 1048576 else (f'{round(b / 1024)} KB' if b >= 1024 else f'{b} bytes')


def scene(path, sid, w, h, dur, css, html, js, exit_at=None):
    exit_js = ''
    if exit_at is not None:
        exit_js = (f'tl.to("#{sid}-stage", {{ filter: "blur(18px)", opacity: 0, duration: 0.4, ease: "power2.in" }}, {exit_at});')
    path.write_text(f'''<template>
  <style>
    {FONTS}
    #root {{ position: absolute; inset: 0; }}
    .stage {{ position: absolute; inset: 0; }}
    .abs {{ position: absolute; }}
    .disp {{ font-family: "Bricolage Grotesque", sans-serif; font-variation-settings: "opsz" 96; font-weight: 800; letter-spacing: -0.03em; color: {INK}; }}
    .body {{ font-family: "Atkinson Hyperlegible", sans-serif; color: {INK}; }}
    {css}
  </style>
  <div id="root" data-composition-id="{sid}" data-width="{w}" data-height="{h}">
    <div id="{sid}-stage" class="stage">
      {html}
    </div>
  </div>
  <script>
    const B = window.BRAND, C = window.CAPTIONS[window.CAPTION_LANG] || window.CAPTIONS.en;
    const tl = gsap.timeline({{ paused: true }});
    tl.fromTo("#{sid}-stage", {{ opacity: 1, filter: "blur(0px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.01 }}, 0);
    {js}
    {exit_js}
    window.__timelines["{sid}"] = tl;
  </script>
</template>
''')


def counter(sel, to, start, dur, ease='power2.out', fmt='n'):
    """A number that counts up on the timeline (its text is a function of timeline time)."""
    return (f'(() => {{ const o = {{ v: 0 }}; const el = document.querySelector("{sel}"); el.textContent = "0"; '
            f'tl.to(o, {{ v: {to}, duration: {dur}, ease: "{ease}", onUpdate: () => {{ el.textContent = Math.round(o.v).toLocaleString("en-US"); }} }}, {start}); }})();')


# ---------------------------------------------------------------- shared pieces

def wall(prefix, cols, x0, col_w, top, rows_per_col, size, speeds, seed):
    """Columns of the folder's real file names, drifting up at different speeds."""
    random.seed(seed)
    names = files[:]
    html, js = [], []
    for c in range(cols):
        chunk = names[(c * rows_per_col) % len(names):][:rows_per_col]
        rows = ''.join(
            f'<div class="wn{" sm" if f["bytes"] < 20000 else ""}"><span>{f["path"].split("/")[-1]}</span><b>{kb(f["bytes"])}</b></div>'
            for f in chunk)
        html.append(f'<div id="{prefix}-col{c}" class="wcol" style="left:{x0 + c * col_w}px;top:{top}px;width:{col_w - 40}px">{rows}</div>')
        js.append(f'tl.fromTo("#{prefix}-col{c}", {{ y: {random.randint(-200, 0)} }}, {{ y: "-={speeds[c % len(speeds)]}", duration: DUR, ease: "none" }}, 0);')
    css = f'''.wcol {{ position: absolute; }}
    .wn {{ display: flex; justify-content: space-between; height: {int(size * 1.9)}px; align-items: center; gap: 16px; font: 400 {size}px "JetBrains Mono", monospace; color: {MUTED}; opacity: 0.7; white-space: nowrap; border-bottom: 1px solid rgba(203,216,212,.6); }}
    .wn b {{ font-weight: 400; }}
    .wn.sm {{ color: {MUTED}; }}'''
    return css, ''.join(html), '\n    '.join(js)


def button_css(scale):
    s = scale
    return f'''.btn {{ position: absolute; display: flex; align-items: center; justify-content: center; gap: {int(14 * s)}px; height: {int(48 * s)}px;
      padding: 0 {int(26 * s)}px; border-radius: 999px; background: {CTA}; color: #fff; font: 700 {int(18 * s)}px/1 "Atkinson Hyperlegible", sans-serif; white-space: nowrap; transform-origin: 50% 50%; }}
    .btn .lbl {{ display: flex; align-items: center; gap: {int(12 * s)}px; }}'''


def stages_html(prefix, x, y, gap, size):
    names = ['Check every file', 'Spot exact copies', 'Sort them by date']
    out = []
    for i, n in enumerate(names):
        out.append(f'''<div id="{prefix}-st{i}" class="abs stage-row" style="left:{x}px;top:{y + i * gap}px">
        <span class="st-ico"><svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="#767D80" stroke-width="1.8" />
          <circle id="{prefix}-st{i}-fill" cx="12" cy="12" r="9" fill="{ACCENT}" stroke="{ACCENT}" stroke-width="1.8" />
          <path id="{prefix}-st{i}-tick" d="M8 12.3l2.7 2.7 5.3-5.6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" />
        </svg></span><span id="{prefix}-st{i}-t" class="st-t">{n}</span></div>''')
    css = f'''.stage-row {{ display: flex; align-items: center; gap: {int(size * 0.55)}px; }}
    .st-t {{ font: 700 {int(size * 0.92)}px/1.2 "Atkinson Hyperlegible", sans-serif; color: {MUTED}; }}'''
    return css, ''.join(out)


def stages_js(prefix, enter, done_times):
    js = []
    for i in range(3):
        js.append(f'tl.fromTo("#{prefix}-st{i}", {{ opacity: 0, x: 90, filter: "blur(8px)" }}, {{ opacity: 1, x: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }}, {enter + i * 0.12});')
        js.append(f'tl.fromTo("#{prefix}-st{i}-fill", {{ scale: 0, transformOrigin: "50% 50%" }}, {{ scale: 0, duration: 0.01 }}, 0);')
        js.append(f'tl.fromTo("#{prefix}-st{i}-tick", {{ strokeDashoffset: 1 }}, {{ strokeDashoffset: 1, duration: 0.01 }}, 0);')
    cur = [enter + 0.1] + [t + 0.05 for t in done_times[:-1]]
    for i, t in enumerate(done_times):
        js.append(f'tl.to("#{prefix}-st{i}-t", {{ color: "{INK}", duration: 0.25 }}, {cur[i]});')
        js.append(f'tl.to("#{prefix}-st{i}-fill", {{ scale: 1, duration: 0.35, ease: "back.out(1.6)" }}, {t});')
        js.append(f'tl.to("#{prefix}-st{i}-tick", {{ strokeDashoffset: 0, duration: 0.3, ease: "power2.out" }}, {t + 0.12});')
    return '\n    '.join(js)


# ---------------------------------------------------------------- 16:9 film

def film_169():
    W, H = 1920, 1080
    C = FILM / 'compositions'
    for old in C.glob('*.html'):
        old.unlink()

    # 1 hook: the folder's real names as a full-bleed wall; the count rises with it.
    wcss, whtml, wjs = wall('hk', 3, 820, 360, -40, 70, 22, [520, 380, 600], 3)
    scene(C / 'hook.html', 'hook', W, H, 6.5, wcss + f'''
    #hk-wall {{ position: absolute; inset: 0; -webkit-mask-image: linear-gradient(90deg, transparent 760px, #000 1000px), linear-gradient(180deg, transparent 0, #000 140px, #000 760px, transparent 900px); -webkit-mask-composite: source-in; mask-image: linear-gradient(90deg, transparent 760px, #000 1000px), linear-gradient(180deg, transparent 0, #000 140px, #000 760px, transparent 900px); mask-composite: intersect; }}
    #hk-fade {{ position: absolute; left: 720px; top: 0; width: 260px; height: 1080px; background: linear-gradient(90deg, {GROUND}, rgba(236,241,240,0)); }}
    #hk-fade2 {{ position: absolute; left: 0; right: 0; top: 760px; height: 320px; background: linear-gradient(0deg, {GROUND} 45%, rgba(236,241,240,0)); }}
    #hk-fade3 {{ position: absolute; left: 0; right: 0; top: 0; height: 120px; background: linear-gradient(180deg, {GROUND}, rgba(236,241,240,0)); }}
    #hk-num {{ left: 160px; top: 250px; font-size: 300px; line-height: .9; color: {ACCENT}; font-variant-numeric: tabular-nums; }}
    #hk-word {{ left: 166px; top: 540px; font-size: 96px; line-height: 1; }}
    #hk-sub {{ left: 168px; top: 660px; font-size: 38px; color: {MUTED}; }}''',
          f'''<div id="hk-wall" data-layout-ignore>{whtml}</div>
      <div id="hk-num" class="abs disp">0</div><div id="hk-word" class="abs disp">files</div>
      <div id="hk-sub" class="abs body">in one recovery folder</div>''',
          f'''const DUR = 6.5;
    {wjs}
    tl.fromTo("#hk-wall", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.8, ease: "power1.out" }}, 0);
    {counter("#hk-num", 539, 0.3, 2.6, 'power2.inOut')}
    tl.fromTo("#hk-word", {{ opacity: 0, y: 30, filter: "blur(8px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }}, 0.5);
    tl.fromTo("#hk-sub", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power3.out" }}, 0.9);
    document.getElementById("hk-word").textContent = C.filesWord;
    tl.to(".wn.sm", {{ color: "{DATE}", opacity: 0.9, duration: 0.5, stagger: 0.004 }}, 3.5);''', exit_at=6.1)

    # 2 choose: the button is pressed, then becomes the progress bar.
    scene(C / 'choose.html', 'choose', W, H, 4.0, button_css(2.4) + f'''
    #ch-btn {{ left: 960px; top: 470px; width: 820px; }}
    #ch-priv {{ left: 0; right: 0; top: 610px; display: flex; justify-content: center; align-items: center; gap: 14px; font: 400 32px "Atkinson Hyperlegible", sans-serif; color: {DEEP}; }}''',
          f'''<div id="ch-btn" class="btn"><span id="ch-lbl" class="lbl">{icon(FOLDER_OPEN, 50, '#fff')}<span>Sort my recovered files</span></span></div>
      <div id="ch-priv" class="abs">{icon(LOCK, 34, ACCENT)}<span>Your photos stay on your computer.</span></div>''',
          f'''tl.fromTo("#ch-btn", {{ xPercent: -50, yPercent: -50, opacity: 0, scale: 0.86, filter: "blur(12px)" }}, {{ xPercent: -50, yPercent: -50, opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }}, 0.15);
    tl.fromTo("#ch-priv", {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }}, 0.55);
    // The click: the button goes down and darkens, then springs back.
    tl.to("#ch-btn", {{ scale: 0.955, backgroundColor: "{CTA_DOWN}", duration: 0.11, ease: "power2.in" }}, 1.75);
    tl.to("#ch-btn", {{ scale: 1, duration: 0.35, ease: "back.out(2.2)" }}, 1.86);
    // Then it becomes the progress bar: the label leaves, the pill thins into the bar's track.
    tl.to("#ch-lbl", {{ opacity: 0, filter: "blur(6px)", duration: 0.18, ease: "power2.in" }}, 2.25);
    tl.to("#ch-priv", {{ opacity: 0, y: 12, duration: 0.25, ease: "power2.in" }}, 2.2);
    tl.to("#ch-btn", {{ width: 1200, height: 14, padding: 0, y: 57, duration: 0.7, ease: "power3.inOut" }}, 2.4);
    tl.to("#ch-btn", {{ backgroundColor: "{RULE}", duration: 0.3, ease: "power2.out" }}, 2.4);''')

    # 3 scan: the bar fills smoothly while the stages arrive and tick off.
    scss, shtml = stages_html('sc', 360, 640, 74, 44)
    scene(C / 'scan.html', 'scan', W, H, 5.0, scss + f'''
    #sc-track {{ left: 360px; top: 513px; width: 1200px; height: 14px; border-radius: 999px; background: {RULE}; overflow: hidden; }}
    #sc-fill {{ position: absolute; left: 0; top: 0; height: 100%; width: 1200px; border-radius: 999px; background: {ACCENT}; transform-origin: 0 50%; }}
    #sc-h, #sc-h2 {{ left: 356px; top: 330px; font-size: 104px; line-height: 1.1; }}
    #sc-count {{ left: 360px; top: 550px; font-size: 32px; color: {MUTED}; font-variant-numeric: tabular-nums; }}
    #sc-pct {{ left: 1360px; width: 200px; text-align: right; top: 550px; font-size: 32px; color: {MUTED}; font-variant-numeric: tabular-nums; }}''',
          f'''<div id="sc-track" class="abs"><div id="sc-fill"></div></div>
      <div id="sc-h" class="abs disp">Checking your files…</div><div id="sc-h2" class="abs disp">Checking for photos saved twice…</div>
      <div id="sc-count" class="abs body">Checked <span id="sc-n">0</span> of 539 files</div><div id="sc-pct" class="abs body"><span id="sc-p">0</span>%</div>
      {shtml}''',
          f'''tl.fromTo("#sc-fill", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 3.6, ease: "power1.inOut" }}, 0.2);
    {counter("#sc-n", 539, 0.2, 3.6, 'power1.inOut')}
    {counter("#sc-p", 100, 0.2, 3.6, 'power1.inOut')}
    tl.fromTo("#sc-h", {{ opacity: 0, y: 24, filter: "blur(10px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }}, 0.1);
    tl.fromTo("#sc-count", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4 }}, 0.3);
    tl.fromTo("#sc-pct", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4 }}, 0.3);
    tl.set("#sc-h2", {{ opacity: 0 }}, 0);
    tl.to("#sc-h", {{ opacity: 0, y: -18, filter: "blur(8px)", duration: 0.25, ease: "power2.in" }}, 2.0);
    tl.fromTo("#sc-h2", {{ opacity: 0, y: 18, filter: "blur(8px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.4, ease: "power3.out" }}, 2.15);
    {stages_js('sc', 0.5, [1.6, 2.9, 3.85])}''', exit_at=4.6)

    # 4 set aside: the four groups as a full-bleed list; they move aside, the promise stays.
    groups = ['Small preview copies', 'Exact copies', 'Damaged or incomplete files', 'App and system files']
    rows = ''.join(f'''<div id="sa-r{i}" class="abs sa-row" style="top:{300 + i * 104}px"><img src="assets/parts/thumbs-{i + 1}.png" alt="" /><span>{g}</span></div>''' for i, g in enumerate(groups))
    rjs = '\n    '.join(f'tl.fromTo("#sa-r{i}", {{ opacity: 0, x: 140, filter: "blur(10px)" }}, {{ opacity: 1, x: 0, filter: "blur(0px)", duration: 0.65, ease: "expo.out" }}, {0.45 + i * 0.13});' for i in range(4))
    scene(C / 'setaside.html', 'setaside', W, H, 5.5, f'''
    #sa-h {{ left: 156px; top: 150px; font-size: 96px; line-height: 1; }}
    .sa-row {{ left: 160px; width: 1600px; height: 104px; display: flex; align-items: center; gap: 36px; border-top: 1.5px solid {RULE};
      font: 400 44px "Atkinson Hyperlegible", sans-serif; color: {INK}; }}
    .sa-row img {{ height: 64px; width: auto; }}
    #sa-line {{ left: 160px; top: 300px; width: 1600px; height: 2px; background: {RULE}; transform-origin: 0 50%; }}
    #sa-safe {{ left: 160px; top: 760px; display: flex; align-items: center; gap: 20px; font: 700 46px "Atkinson Hyperlegible", sans-serif; color: {DEEP}; }}''',
          f'''<div id="sa-h" class="abs disp">Set aside, kept safe</div>{rows}
      <div id="sa-safe" class="abs">{icon(SHIELD, 56, ACCENT)}<span>None of your files were deleted or sent anywhere.</span></div>''',
          f'''tl.fromTo("#sa-h", {{ opacity: 0, y: 24, filter: "blur(10px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }}, 0.1);
    {rjs}
    tl.to(".sa-row", {{ x: 60, opacity: 0.45, duration: 0.7, ease: "power3.inOut", stagger: 0.06 }}, 2.3);
    tl.fromTo("#sa-safe", {{ opacity: 0, y: 30, filter: "blur(10px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }}, 2.7);''', exit_at=5.1)

    # 5 by date: the year chips, a selection that slides, the photos for each year.
    years = ['2024', '2023', '2022', '2021', '2020', '2019', 'No date']
    widths = [158, 158, 158, 158, 158, 158, 200]
    xs, x = [], 160
    for wd in widths:
        xs.append(x)
        x += wd + 14
    chips = ''.join(f'<div id="bd-c{i}" class="abs chip" style="left:{xs[i]}px;width:{widths[i]}px">{y}</div>' for i, y in enumerate(years))
    sets = {'2024': 0, '2022': 2, '2019': 5}
    photos, pjs = [], []
    order = [('2024', 0.6), ('2022', 2.4), ('2019', 4.1)]
    for k, (yr, t) in enumerate(order):
        for j in range(5):
            pid = f'bd-p{yr}-{j}'
            photos.append(f'<div id="{pid}" class="abs tile" style="left:{160 + j * 324}px"><img src="assets/photos/{yr}-{j}.jpg" alt="" />'
                          f'<span id="{pid}-box" class="box"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path id="{pid}-tick" d="M5 12.5l4.3 4.3L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg></span></div>')
            pjs.append(f'tl.fromTo("#{pid}", {{ opacity: 0, y: 40, filter: "blur(10px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }}, {t + 0.15 + j * 0.07});')
            if k < 2:
                pjs.append(f'tl.to("#{pid}", {{ opacity: 0, y: -24, filter: "blur(8px)", duration: 0.3, ease: "power2.in" }}, {order[k + 1][1] - 0.1 + j * 0.03});')
    ind_js = [f'tl.fromTo("#bd-ind", {{ x: {xs[0]}, width: {widths[0]} }}, {{ x: {xs[0]}, width: {widths[0]}, duration: 0.01 }}, 0);',
              f'tl.fromTo("#bd-c0", {{ color: "{INK}" }}, {{ color: "#ffffff", duration: 0.2 }}, 0.5);',
              f'tl.fromTo("#bd-ind", {{ opacity: 0, scale: 0.8 }}, {{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)" }}, 0.45);']
    prev = 0
    for yr, t in order[1:]:
        i = sets[yr]
        ind_js += [f'tl.to("#bd-ind", {{ x: {xs[i]}, duration: 0.55, ease: "power3.inOut" }}, {t - 0.2});',
                   f'tl.to("#bd-c{prev}", {{ color: "{INK}", duration: 0.25 }}, {t - 0.15});',
                   f'tl.to("#bd-c{i}", {{ color: "#ffffff", duration: 0.25 }}, {t + 0.1});']
        prev = i
    # Unselect one photo, as in the app: the tick clears, the tile fades and gets a dashed edge.
    off = 'bd-p2019-1'
    un_js = [f'tl.to("#{off}-box", {{ backgroundColor: "#ffffff", borderColor: "#767D80", duration: 0.15 }}, 5.6);',
             f'tl.to("#{off}-tick", {{ opacity: 0, duration: 0.1 }}, 5.6);',
             f'tl.to("#{off} img", {{ opacity: 0.45, duration: 0.25 }}, 5.65);',
             f'tl.to("#{off}", {{ outlineColor: "#767D80", duration: 0.25 }}, 5.65);',
             f'tl.to("#{off}", {{ scale: 0.96, duration: 0.1, ease: "power2.in" }}, 5.5);',
             f'tl.to("#{off}", {{ scale: 1, duration: 0.3, ease: "back.out(2)" }}, 5.6);']
    scene(C / 'bydate.html', 'bydate', W, H, 7.0, f'''
    .chip {{ top: 150px; height: 76px; border-radius: 999px; border: 1.5px solid #767D80; display: flex; align-items: center; justify-content: center;
      font: 400 36px "Atkinson Hyperlegible", sans-serif; color: {INK}; z-index: 2; }}
    #bd-ind {{ left: 0; top: 150px; height: 76px; border-radius: 999px; background: {ACCENT}; z-index: 1; }}
    .tile {{ top: 290px; width: 304px; height: 470px; border-radius: 14px; overflow: hidden; outline: 3px dashed rgba(118,125,128,0); outline-offset: 4px; }}
    .tile img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
    .box {{ position: absolute; right: 14px; top: 14px; width: 38px; height: 38px; border-radius: 9px; background: {ACCENT}; border: 2px solid {ACCENT};
      display: flex; align-items: center; justify-content: center; }}''',
          f'<div id="bd-ind" class="abs"></div>{chips}{"".join(photos)}',
          '\n    '.join(['tl.fromTo(".chip", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.05 }, 0.1);'] + ind_js + pjs + un_js), exit_at=6.6)

    # 6 save: the folder it makes, typed out; then "saved" with the prints; then the receipt line.
    tree = [(0, FOLDER, '{APP} photos', True), (1, FOLDER, '2024', False), (2, FOLDER, '06 June', False),
            (3, PHOTO, '2024-06-28 14.32.jpg', False), (3, PHOTO, '2024-06-28 14.32 (2).jpg', False), (1, FOLDER, 'No date', False)]
    lines = ''.join(f'<div id="sv-l{i}" class="abs tl" style="left:{160 + d * 54}px;top:{200 + i * 78}px">{icon(ic, 40, ACCENT if ic == FOLDER else DATE)}<span id="sv-l{i}-t" class="{"b" if b else ""}">{t}</span></div>' for i, (d, ic, t, b) in enumerate(tree))
    ljs = '\n    '.join(f'tl.fromTo("#sv-l{i}", {{ opacity: 0, x: -30, filter: "blur(6px)" }}, {{ opacity: 1, x: 0, filter: "blur(0px)", duration: 0.45, ease: "expo.out" }}, {0.2 + i * 0.16});' for i in range(len(tree)))
    prints = ''.join(f'<div id="sv-p{i}" class="abs print" style="left:{1120 + i * 170}px"><img src="assets/img/{n}" alt="" /></div>' for i, n in enumerate(['6-beach-480.webp', '3-candles-480.webp', '4-roadtrip-480.webp']))
    pjs2 = '\n    '.join(f'tl.fromTo("#sv-p{i}", {{ opacity: 0, y: 90, rotation: {r * 2} }}, {{ opacity: 1, y: {-12 if i == 1 else 8}, rotation: {r}, duration: 0.8, ease: "expo.out" }}, {1.4 + i * 0.12});' for i, r in enumerate([-7, 0, 6]))
    scene(C / 'save.html', 'save', W, H, 5.5, f'''
    .tl {{ display: flex; align-items: center; gap: 18px; font: 400 40px "Atkinson Hyperlegible", sans-serif; color: {INK}; }}
    .tl .b {{ font-weight: 700; }}
    .print {{ top: 180px; width: 250px; height: 300px; background: #fff; padding: 12px 12px 40px; border-radius: 6px; box-shadow: 0 2px 4px rgba(31,36,39,.12), 0 12px 28px rgba(31,36,39,.12); }}
    .print img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
    #sv-p1 {{ z-index: 2; }}
    #sv-h {{ left: 1110px; top: 540px; width: 680px; font-size: 76px; line-height: 1.02; }}
    #sv-rule {{ left: 160px; top: 760px; width: 1600px; height: 1.5px; background: {RULE}; transform-origin: 0 50%; }}
    #sv-row {{ left: 160px; top: 790px; width: 1600px; display: flex; justify-content: space-between; font: 700 40px "Atkinson Hyperlegible", sans-serif; color: {INK}; }}
    #sv-row .r {{ color: {DEEP}; display: flex; gap: 14px; align-items: center; }}''',
          f'''{lines}{prints}<div id="sv-h" class="abs disp">Your photos and videos are saved.</div>
      <div id="sv-rule" class="abs"></div><div id="sv-row" class="abs"><span>Your files</span><span class="r">{icon(CHECK_CIRCLE, 44, ACCENT)}None deleted, none sent anywhere</span></div>''',
          f'''document.getElementById("sv-l0-t").textContent = B.appName + " photos";
    {ljs}
    {pjs2}
    tl.fromTo("#sv-h", {{ opacity: 0, y: 30, filter: "blur(10px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }}, 1.9);
    tl.fromTo("#sv-rule", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.6, ease: "power3.inOut" }}, 2.7);
    tl.fromTo("#sv-row", {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }}, 2.9);''', exit_at=5.1)

    endcard(C / 'endcard.html', 'endcard', W, H, 6.5, wide=True)
    captions(C / 'captions.html', 'captions', W, H, [('c1', 0.4, 2.8), ('c2', 3.4, 2.8), ('c3', 6.8, 3.4), ('c4', 10.9, 4.2),
                                                     ('c5', 15.9, 4.8), ('c6', 21.4, 6.2), ('c7', 28.4, 4.8)], wide=True)
    index(FILM, W, H, 40, [('hook', 0, 6.5), ('choose', 6.5, 4.0), ('scan', 10.5, 5.0), ('setaside', 15.5, 5.5),
                           ('bydate', 21, 7.0), ('save', 28, 5.5), ('endcard', 33.5, 6.5)], 'captions')


# ---------------------------------------------------------------- end card and captions (both)

def endcard(path, sid, W, H, dur, wide, split=None):
    p = 'ec' if wide else 've'
    if wide:
        geo = dict(pt=150, pw=300, ph=360, px=[600, 810, 1020], pr=590, pf=88, lt=330, nf=170, mk=170, tf=52, ff=40)
    else:
        geo = dict(pt=300, pw=290, ph=350, px=[120, 395, 670], pr=760, pf=78, lt=480, nf=150, mk=170, tf=54, ff=42)
    split = split or (3.4 if wide else 2.2)
    scene(path, sid, W, H, dur, f'''
    .print {{ top: {geo["pt"]}px; width: {geo["pw"]}px; height: {geo["ph"]}px; background: #fff; padding: 14px 14px 46px; border-radius: 6px;
      box-shadow: 0 2px 4px rgba(31,36,39,.12), 0 14px 32px rgba(31,36,39,.12); }}
    .print img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
    #{p}-p1 {{ z-index: 2; }}
    .promise {{ left: 60px; right: 60px; top: {geo["pr"]}px; text-align: center; font-size: {geo["pf"]}px; line-height: 1.06; }}
    .promise .b {{ color: {ACCENT}; }}
    .lock {{ left: 0; right: 0; top: {geo["lt"]}px; display: flex; flex-direction: column; align-items: center; gap: 26px; }}
    .mark-row {{ display: flex; align-items: center; gap: 34px; {'' if wide else 'flex-direction: column;'} }}
    .name {{ font-size: {geo["nf"]}px; line-height: 1; letter-spacing: -0.035em; }}
    .tag {{ font: 700 {geo["tf"]}px/1.2 "Atkinson Hyperlegible", sans-serif; color: {INK}; }}
    .free {{ font: 400 {geo["ff"]}px/1.2 "Atkinson Hyperlegible", sans-serif; color: {MUTED}; }}
    .url {{ font: 700 {geo["ff"] + 4}px/1.2 "Atkinson Hyperlegible", sans-serif; color: {ACCENT}; }}''',
          f'''<div id="{p}-a" class="clip" data-start="0" data-duration="{split}">
        {''.join(f'<div id="{p}-p{i}" class="abs print" style="left:{geo["px"][i]}px"><img src="assets/img/{n}" alt="" /></div>' for i, n in enumerate(['6-beach-480.webp', '3-candles-480.webp', '4-roadtrip-480.webp']))}
        <div class="abs promise disp"><div id="{p}-l1"></div><div id="{p}-l2" class="b"></div></div>
      </div>
      <div id="{p}-b" class="clip" data-start="{split}" data-duration="{round(dur - split, 2)}">
        <div class="abs lock">
          <div class="mark-row">
            <svg id="{p}-mark" width="{geo["mk"]}" height="{geo["mk"]}" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="24" height="24" rx="6" fill="#FFFFFF" stroke="{ACCENT}" stroke-width="1.8" />
              <path d="M6.5 15.5c2.5-2.2 5-2.2 7.5 0s5 2.2 7.5 0" stroke="{ACCENT}" stroke-width="1.8" stroke-linecap="round" />
              <path d="M6.5 21h8" stroke="{DATE}" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <div id="{p}-name" class="name disp"></div>
          </div>
          <div id="{p}-tag" class="tag"></div><div id="{p}-free" class="free"></div><div id="{p}-url" class="url"></div>
        </div>
      </div>''',
          f'''document.getElementById("{p}-l1").textContent = C.promiseA;
    document.getElementById("{p}-l2").textContent = C.promiseB;
    document.getElementById("{p}-name").textContent = B.appName;
    document.getElementById("{p}-tag").textContent = B.tagline;
    document.getElementById("{p}-free").textContent = B.freeLine;
    document.getElementById("{p}-url").textContent = B.siteUrl || "";
    [["#{p}-p0", -7], ["#{p}-p1", 0], ["#{p}-p2", 6]].forEach(([s, r], i) => {{
      tl.fromTo(s, {{ opacity: 0, y: 90, rotation: r * 2 }}, {{ opacity: 1, y: i === 1 ? -10 : 10, rotation: r, duration: 0.8, ease: "expo.out" }}, 0.05 + i * 0.12);
    }});
    tl.fromTo("#{p}-l1", {{ opacity: 0, filter: "blur(16px)", y: 24 }}, {{ opacity: 1, filter: "blur(0px)", y: 0, duration: 0.6, ease: "power3.out" }}, 0.45);
    tl.fromTo("#{p}-l2", {{ opacity: 0, filter: "blur(16px)", y: 24 }}, {{ opacity: 1, filter: "blur(0px)", y: 0, duration: 0.6, ease: "power3.out" }}, 0.9);
    tl.to("#{p}-a", {{ filter: "blur(24px)", opacity: 0, duration: 0.35, ease: "power2.in" }}, {split - 0.35});
    tl.fromTo("#{p}-mark", {{ opacity: 0, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.4)" }}, {split + 0.05});
    tl.fromTo("#{p}-name", {{ opacity: 0, filter: "blur(10px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }}, {split + 0.25});
    tl.fromTo("#{p}-tag", {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }}, {split + 0.55});
    tl.fromTo("#{p}-free", {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }}, {split + 0.7});
    tl.fromTo("#{p}-url", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.45 }}, {split + 0.85});''')


def captions(path, sid, W, H, caps, wide):
    # No card and no shadow: words in ink straight on the paper, after a short accent rule.
    if wide:
        pos = 'left: 160px; right: 160px; bottom: 74px;'
        size = 50
    else:
        pos = 'left: 90px; right: 90px; top: 1190px;'
        size = 58
    els = '\n'.join(f'    <div id="{sid}-{i}" class="cap clip" data-start="{s}" data-duration="{d}"><span class="rule"></span><div id="{sid}-{i}-t" class="t"></div></div>' for i, s, d in caps)
    keys = json.dumps([[i, s, d] for i, s, d in caps])
    path.write_text(f'''<template>
  <style>
    @font-face {{ font-family: "Atkinson Hyperlegible"; src: url("assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2") format("woff2"); font-weight: 700; }}
    #root {{ position: absolute; inset: 0; }}
    .cap {{ position: absolute; {pos} overflow: visible; }}
    .cap .rule {{ display: block; width: 56px; height: 5px; border-radius: 3px; background: {ACCENT}; margin-bottom: 18px; }}
    .cap .t {{ font: 700 {size}px/1.22 "Atkinson Hyperlegible", sans-serif; color: {INK}; letter-spacing: -0.005em; }}
    .cap .w {{ display: inline-block; white-space: pre; }}
  </style>
  <div id="root" data-composition-id="{sid}" data-width="{W}" data-height="{H}">
{els}
  </div>
  <script>
    const C = window.CAPTIONS[window.CAPTION_LANG] || window.CAPTIONS.en;
    const APP = window.BRAND.appName;
    const tl = gsap.timeline({{ paused: true }});
    {keys}.forEach(([k, s, d]) => {{
      const box = document.getElementById("{sid}-" + k + "-t");
      const words = C[k].replace("{{APP}}", APP).split(" ");
      words.forEach((w, i) => {{ if (i) box.appendChild(document.createTextNode(" ")); const sp = document.createElement("span"); sp.className = "w"; sp.textContent = w; box.appendChild(sp); }});
      tl.fromTo("#{sid}-" + k + " .rule", {{ scaleX: 0, transformOrigin: "0 50%" }}, {{ scaleX: 1, duration: 0.35, ease: "power3.out" }}, s);
      tl.fromTo(box.querySelectorAll(".w"), {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.16, ease: "power4.out", stagger: 0.06 }}, s + 0.05);
      tl.to("#{sid}-" + k, {{ opacity: 0, filter: "blur(6px)", duration: 0.2, ease: "power2.in" }}, Math.round((s + d - 0.2) * 100) / 100);
    }});
    window.__timelines["{sid}"] = tl;
  </script>
</template>
''')


def index(folder, W, H, dur, scenes, caps_id):
    hosts = ''.join(f'      <div id="{i}" data-composition-id="{i}" data-composition-src="compositions/{i}.html" data-start="{a}" data-duration="{d}" data-track-index="1" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>\n' for i, a, d in scenes)
    (folder / 'index.html').write_text(f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <script src="assets/brand.js"></script>
    <script src="assets/captions.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: {GROUND}; }}
      #paper {{ position: absolute; inset: 0; background: {GROUND}; }}
      #paper-grain {{ position: absolute; inset: 0; background-image: url(assets/img/grain.png); background-size: 256px; opacity: 0.35; mix-blend-mode: multiply; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{dur}" data-width="{W}" data-height="{H}">
      <div id="paper" class="clip" data-start="0" data-duration="{dur}" data-track-index="0"><div id="paper-grain"></div></div>
{hosts}      <div id="{caps_id}" data-composition-id="{caps_id}" data-composition-src="compositions/{caps_id}.html" data-start="0" data-duration="{dur}" data-track-index="2" data-track-kind="captions" data-width="{W}" data-height="{H}"></div>
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
''')


# ---------------------------------------------------------------- 9:16 cut

def film_916():
    W, H = 1080, 1920
    C = VERT / 'compositions'
    for old in C.glob('*.html'):
        old.unlink()
    # 1 the count rises over the wall of real names it is counting.
    wcss, whtml, wjs = wall('vh', 3, 50, 340, 0, 60, 20, [420, 300, 500], 5)
    scene(C / 'vhook.html', 'vhook', W, H, 2.8, wcss + f'''
    #vh-wall {{ position: absolute; left: 0; right: 0; top: 660px; height: 480px; overflow: hidden;
      -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 120px, #000 340px, transparent 100%); mask-image: linear-gradient(180deg, transparent 0, #000 120px, #000 340px, transparent 100%); }}
    #vh-fade {{ position: absolute; left: 0; right: 0; top: 660px; height: 140px; background: linear-gradient(180deg, {GROUND}, rgba(236,241,240,0)); }}
    #vh-fade2 {{ position: absolute; left: 0; right: 0; top: 1000px; height: 140px; background: linear-gradient(0deg, {GROUND}, rgba(236,241,240,0)); }}
    #vh-num {{ left: 84px; top: 210px; font-size: 270px; line-height: .9; color: {ACCENT}; font-variant-numeric: tabular-nums; }}
    #vh-word {{ left: 92px; top: 460px; font-size: 84px; line-height: 1; }}
    #vh-sub {{ left: 96px; top: 560px; font-size: 40px; color: {MUTED}; }}''',
          f'''<div id="vh-wall" data-layout-ignore>{whtml}</div>
      <div id="vh-num" class="abs disp">0</div><div id="vh-word" class="abs disp">files</div><div id="vh-sub" class="abs body">in one recovery folder</div>''',
          f'''const DUR = 2.8;
    {wjs}
    {counter("#vh-num", 539, 0.0, 2.0, 'power2.inOut')}
    tl.fromTo("#vh-word", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }}, 0.2);
    tl.fromTo("#vh-sub", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4 }}, 0.5);
    document.getElementById("vh-word").textContent = C.filesWord;''', exit_at=2.45)
    # 2 the click, the bar, the stages.
    scss, shtml = stages_html('vs', 110, 760, 84, 46)
    scene(C / 'vscan.html', 'vscan', W, H, 3.4, button_css(2.2) + scss + f'''
    #vs-btn {{ left: 540px; top: 600px; width: 760px; }}
    #vs-track {{ left: 110px; top: 593px; width: 860px; height: 14px; border-radius: 999px; background: {RULE}; overflow: hidden; }}
    #vs-fill {{ position: absolute; inset: 0; border-radius: 999px; background: {ACCENT}; transform-origin: 0 50%; }}
    #vs-h {{ left: 106px; top: 420px; width: 880px; font-size: 92px; line-height: 1.02; }}
    #vs-count {{ left: 110px; top: 630px; font-size: 34px; color: {MUTED}; font-variant-numeric: tabular-nums; }}''',
          f'''<div id="vs-track" class="abs"><div id="vs-fill"></div></div>
      <div id="vs-btn" class="btn"><span id="vs-lbl" class="lbl">{icon(FOLDER_OPEN, 46, '#fff')}<span>Sort my recovered files</span></span></div>
      <div id="vs-h" class="abs disp">Checking your files…</div><div id="vs-count" class="abs body">Checked <span id="vs-n">0</span> of 539 files</div>{shtml}''',
          f'''tl.fromTo("#vs-btn", {{ xPercent: -50, yPercent: -50, opacity: 0, scale: 0.88 }}, {{ xPercent: -50, yPercent: -50, opacity: 1, scale: 1, duration: 0.45, ease: "expo.out" }}, 0.0);
    tl.fromTo("#vs-track", {{ opacity: 0 }}, {{ opacity: 0, duration: 0.01 }}, 0);
    tl.to("#vs-btn", {{ scale: 0.955, backgroundColor: "{CTA_DOWN}", duration: 0.1, ease: "power2.in" }}, 0.5);
    tl.to("#vs-btn", {{ scale: 1, duration: 0.3, ease: "back.out(2.2)" }}, 0.6);
    tl.to("#vs-lbl", {{ opacity: 0, duration: 0.15 }}, 0.85);
    tl.to("#vs-btn", {{ width: 860, height: 14, padding: 0, duration: 0.5, ease: "power3.inOut" }}, 0.9);
    tl.to("#vs-btn", {{ backgroundColor: "{RULE}", duration: 0.25 }}, 0.9);
    tl.set("#vs-track", {{ opacity: 1 }}, 1.4);
    tl.set("#vs-btn", {{ opacity: 0 }}, 1.4);
    tl.fromTo("#vs-fill", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.6, ease: "power1.inOut" }}, 1.4);
    {counter("#vs-n", 539, 1.4, 1.6, 'power1.inOut')}
    tl.fromTo("#vs-h", {{ opacity: 0, y: 20, filter: "blur(8px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }}, 1.2);
    tl.fromTo("#vs-count", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, 1.4);
    {stages_js('vs', 1.3, [1.9, 2.45, 2.95])}''', exit_at=3.05)
    # 3 one screen, numbers that count up (no second fade-in).
    ledger = [('Files checked', 539), ('Kept, sorted by date', 214), ('Set aside, kept safe below', 325)]
    lrows = ''.join(f'<div id="vf-r{i}" class="abs lrow" style="top:{720 + i * 96}px"><span>{t}</span><b id="vf-n{i}">0</b></div>' for i, (t, _) in enumerate(ledger))
    ljs = '\n    '.join(f'tl.fromTo("#vf-r{i}", {{ opacity: 0, x: 60 }}, {{ opacity: 1, x: 0, duration: 0.5, ease: "expo.out" }}, {0.5 + i * 0.15});\n    ' + counter(f'#vf-n{i}', n, 0.6 + i * 0.15, 1.2, 'power2.out') for i, (_, n) in enumerate(ledger))
    scene(C / 'vfound.html', 'vfound', W, H, 2.6, f'''
    #vf-a {{ left: 106px; top: 240px; font-size: 84px; line-height: 1; }}
    #vf-n {{ left: 98px; top: 330px; font-size: 230px; line-height: 1; color: {ACCENT}; font-variant-numeric: tabular-nums; }}
    #vf-b {{ left: 106px; top: 560px; font-size: 76px; line-height: 1; }}
    .lrow {{ left: 110px; width: 860px; height: 96px; display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid {RULE};
      font: 400 40px "Atkinson Hyperlegible", sans-serif; color: {INK}; }}
    .lrow b {{ font-weight: 700; font-variant-numeric: tabular-nums; }}''',
          f'<div id="vf-a" class="abs disp">We found</div><div id="vf-n" class="abs disp">0</div><div id="vf-b" class="abs disp">photos and videos.</div>{lrows}',
          f'''tl.fromTo("#vf-a", {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }}, 0.05);
    {counter("#vf-n", 214, 0.15, 1.3, 'power2.out')}
    tl.fromTo("#vf-b", {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }}, 0.3);
    {ljs}''', exit_at=2.25)
    # 4 photos by date as slow plates: three rows drifting in opposite directions.
    rows_html, rjs = [], []
    for k, yr in enumerate(['2024', '2022', '2019']):
        tiles = ''.join(f'<img src="assets/photos/{yr}-{j}.jpg" alt="" />' for j in range(6))
        rows_html.append(f'<div id="vd-y{k}" class="abs yr disp" style="top:{250 + k * 300}px">{yr}</div>'
                         f'<div id="vd-r{k}" class="abs prow" style="top:{320 + k * 300}px">{tiles}</div>')
        d = -1 if k % 2 == 0 else 1
        rjs.append(f'tl.fromTo("#vd-r{k}", {{ x: {-160 if d > 0 else 0} }}, {{ x: {0 if d > 0 else -160}, duration: 2.6, ease: "none" }}, 0);')
        rjs.append(f'tl.fromTo("#vd-r{k} img", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.05 }}, {0.1 + k * 0.25});')
        rjs.append(f'tl.fromTo("#vd-y{k}", {{ opacity: 0, x: -20 }}, {{ opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }}, {0.05 + k * 0.25});')
    scene(C / 'vdate.html', 'vdate', W, H, 2.6, f'''
    .yr {{ left: 92px; font-size: 64px; line-height: 1; color: {ACCENT}; }}
    .prow {{ left: 92px; display: flex; gap: 18px; }}
    .prow img {{ width: 230px; height: 200px; object-fit: cover; border-radius: 12px; display: block; }}''',
          ''.join(rows_html), '\n    '.join(rjs), exit_at=2.25)
    endcard(C / 'vend.html', 'vend', W, H, 3.6, wide=False, split=1.9)
    captions(C / 'vcaps.html', 'vcaps', W, H, [('v1', 0.2, 2.4), ('v2', 3.0, 3.0), ('v3', 6.4, 2.3), ('v4', 9.0, 2.3)], wide=False)
    index(VERT, W, H, 15, [('vhook', 0, 2.8), ('vscan', 2.8, 3.4), ('vfound', 6.2, 2.6), ('vdate', 8.8, 2.6), ('vend', 11.4, 3.6)], 'vcaps')


if __name__ == '__main__':
    film_169()
    film_916()
    print('scenes written')
