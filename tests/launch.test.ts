// The public launch page (D41–D43): head tags from the one name setting, the launch video (on since
// Nov 12), and the guard that keeps launch files out of the offline cache.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME, DESCRIPTION, LAUNCH_VIDEO, SITE_TITLE } from '../src/brand';
import { copy } from '../src/ui/copy';
import { launchVideo } from '../src/ui/launchVideo';
import { HEAD_MARKER, brandHead, headTags, precacheProblems, precacheUrls } from '../vite.launch';

const sw = (urls: string[]) => `define(["./workbox"],function(e){e.precacheAndRoute([${urls.map((u) => `{url:"${u}",revision:"abc"}`).join(',')}],{})});`;

describe('offline cache guard', () => {
  it('passes the app\'s own files', () => {
    expect(precacheProblems(sw(['index.html', 'assets/index-AAA.js', 'icons/icon-192.png', 'manifest.webmanifest']))).toEqual([]);
  });
  it('fails on anything under launch/, and on any video or captions file', () => {
    expect(precacheProblems(sw(['index.html', 'launch/share.png']))).toEqual(['launch/share.png is in the offline cache']);
    expect(precacheProblems(sw(['index.html', 'assets/clip.mp4', 'a.webm', 'captions.en.vtt'])).length).toBe(3);
  });
  it('fails when no precache list is found (so a format change can\'t silently pass)', () => {
    expect(precacheProblems('self.addEventListener("fetch",()=>{})')).toEqual(['no precache list found in sw.js']);
  });
  it('reads the minified list Workbox writes', () => {
    expect(precacheUrls('e.precacheAndRoute([{url:"registerSW.js",revision:"1"},{revision:null,url:"assets/x.js"}])')).toEqual(['registerSW.js', 'assets/x.js']);
  });
  it('is wired into the build config with launch/ ignored', () => {
    const config = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf8');
    expect(config).toContain("globIgnores: ['launch/**']");
    expect(config.match(/deployFiles\(\), precacheGuard\(\)\]/g)?.length).toBe(2); // production and test build
  });
});

describe('head tags', () => {
  it('give the title, description and share tags without an address (D42: none yet)', () => {
    const tags = headTags('');
    expect(tags).toContain(`<title>${SITE_TITLE}</title>`);
    expect(tags).toContain(`<meta name="description" content="${DESCRIPTION}" />`);
    expect(tags).toContain('<meta property="og:type" content="website" />');
    expect(tags).toContain(`<meta property="og:site_name" content="${APP_NAME}" />`);
    expect(tags).toContain('<meta property="og:title" content="Made for recovered files: your photos, sorted by date." />');
    expect(tags).toContain('<meta property="og:description" content="Sorts recovered files into a photo library by date. Free, in your browser." />');
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(tags).not.toMatch(/canonical|og:url|og:image/);
  });
  it('add the address tags once an address is set', () => {
    const tags = headTags('https://example.org');
    expect(tags).toContain('<link rel="canonical" href="https://example.org/" />');
    expect(tags).toContain('<meta property="og:url" content="https://example.org/" />');
    expect(tags).toContain('<meta property="og:image" content="https://example.org/launch/share.png" />');
    expect(tags).toMatch(/og:image:width" content="1200"[\s\S]*og:image:height" content="630"[\s\S]*og:image:alt/);
  });
  it('match the approved text', () => {
    expect(SITE_TITLE).toBe(`${APP_NAME}: sort recovered photos by date`);
    expect(DESCRIPTION).toBe(`${APP_NAME} turns the jumble of files a recovery program like PhotoRec gives back into a photo library sorted by date. Free, in your browser, nothing uploaded.`);
  });
  it('replace the marker in index.html, and the test builds get their marked title', () => {
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain(HEAD_MARKER);
    expect(html).not.toMatch(/<title>/);
    const hook = brandHead(`${APP_NAME} (test)`).transformIndexHtml as { handler: (h: string) => string };
    expect(hook.handler(html)).toContain(`<title>${APP_NAME} (test)</title>`);
  });
});

describe('launch video (D43)', () => {
  it('is the real 40-second film with captions, from public/launch/', () => {
    expect(LAUNCH_VIDEO).toEqual({ src: 'launch/upsort-launch.mp4', captions: 'launch/upsort-launch.en.vtt', seconds: 40 });
    for (const f of [LAUNCH_VIDEO!.src, LAUNCH_VIDEO!.captions]) expect(existsSync(join(__dirname, '..', 'public', f))).toBe(true);
    expect(readFileSync(join(__dirname, '..', 'public', LAUNCH_VIDEO!.captions), 'utf8')).toMatch(/^WEBVTT/);
  });
  it('uses the brand setting unless a build sets both a stand-in video and its captions', () => {
    expect(launchVideo({})).toBe(LAUNCH_VIDEO);
    expect(launchVideo({ VITE_LAUNCH_VIDEO: 'launch/standin.webm' })).toBe(LAUNCH_VIDEO);
    expect(launchVideo({ VITE_LAUNCH_VIDEO: 'launch/standin.webm', VITE_LAUNCH_CAPTIONS: 'launch/standin.en.vtt' }))
      .toEqual({ src: 'launch/standin.webm', captions: 'launch/standin.en.vtt', seconds: 40 });
    expect(launchVideo({ VITE_LAUNCH_VIDEO: 'a.webm', VITE_LAUNCH_CAPTIONS: 'a.vtt', VITE_LAUNCH_SECONDS: '75' })?.seconds).toBe(75);
    expect(launchVideo({ VITE_LAUNCH_VIDEO: 'a.webm', VITE_LAUNCH_CAPTIONS: 'a.vtt', VITE_LAUNCH_SECONDS: 'x' })?.seconds).toBe(40);
  });
  it('says its real length: 40 sec on the button, 40 seconds in its name; no line under the heading (owner, Nov 12)', () => {
    expect(copy.start.video.play(40)).toBe('Play the video (40 sec)');
    expect(copy.start.video.playName(40)).toBe('Play the video, 40 seconds');
    expect('line' in copy.start.video).toBe(false);
  });
});
