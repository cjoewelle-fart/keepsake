// D49 (owner, Nov 13): the privacy page names the real host. Launch build: Cloudflare, no badge lines.
// Every other build (the beta on Netlify): unchanged.
import { describe, expect, it } from 'vitest';
import { privacyMd } from '../src/ui/copy';

describe('privacy page host lines (D49)', () => {
  it('beta (Netlify) keeps the badge and Netlify visit-record lines', () => {
    const md = privacyMd('', 'netlify');
    expect(md).toContain('“Powered by Netlify” badge');
    expect(md).toContain('plus one small file from Netlify for its badge');
    expect(md).toContain('is hosted by Netlify.');
    expect(md).not.toContain('Cloudflare');
  });
  it('launch (Cloudflare) has the three approved lines and no Netlify', () => {
    const md = privacyMd('', 'cloudflare');
    expect(md).toContain('It doesn’t use ads or tracking.\n\nPhotos');
    expect(md).toContain('loading its own files when the page opens. You won’t see your photos being sent anywhere.');
    expect(md).toContain('is hosted by Cloudflare. Like most hosts, Cloudflare may keep basic visit records');
    expect(md).not.toContain('Netlify');
  });
});
