// The public launch page (D41–D43): head tags from the one name setting, the launch video off by
// default, and the guard that keeps launch files out of the offline cache.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME, DESCRIPTION, SITE_TITLE } from '../src/brand';
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
  it('is off unless a build sets both the video and its captions', () => {
    expect(launchVideo({})).toBeNull();
    expect(launchVideo({ VITE_LAUNCH_VIDEO: 'launch/standin.webm' })).toBeNull();
    expect(launchVideo({ VITE_LAUNCH_VIDEO: 'launch/standin.webm', VITE_LAUNCH_CAPTIONS: 'launch/standin.en.vtt' }))
      .toEqual({ src: 'launch/standin.webm', captions: 'launch/standin.en.vtt', minutes: 1 });
  });
});
