// The product's name and launch settings, in one place, so a rename is a code-only change.
// Everything that shows the name reads it from here: copy.ts (and so the "… photos" save folder),
// the page's <head> tags and install manifest (vite.config.ts), the test build's title check,
// make_notices.mjs and the e2e/QA scripts. tests/brand.test.ts fails if the name is written out
// anywhere else in src/, index.html, vite*.ts or scripts/.
// Plain constants only: Node scripts import this file directly (Node strips the types).

/** The product name (D-rename, Nov 10). */
export const APP_NAME = 'Upsort'
/** The home-screen label. */
export const APP_SHORT_NAME = APP_NAME
/** The owner's tagline (D41): the start screen's footer and the share title. */
export const TAGLINE = 'Made for recovered files.'

/**
 * The public web address, with a trailing slash (e.g. 'https://example.org/'). Empty until the
 * domain is bought (D42): while it's empty, the address-dependent head tags (canonical, og:url,
 * og:image) are left out.
 */
export const SITE_URL: string = 'https://upsort.app/'

/**
 * The public code repository (e.g. 'https://github.com/<owner>/<repo>'). Empty until the repo is
 * public: while it's empty, the privacy page leaves out "Nothing is hidden" and its "See the code"
 * link (D48). When set, it must be an https:// address.
 */
export const REPO_URL: string = ''

/**
 * The launch video on the start screen (D43, on since Nov 12). null = the "Watch" section isn't shown.
 * Paths are relative to the page and live under public/launch/, which the offline cache skips.
 * `seconds` is the film's length, shown on the Play button. A build can swap in a stand-in with
 * VITE_LAUNCH_VIDEO and VITE_LAUNCH_CAPTIONS (see src/ui/launchVideo.ts).
 */
export const LAUNCH_VIDEO: { src: string; captions: string; seconds: number } | null = {
  src: 'launch/upsort-launch.mp4',
  captions: 'launch/upsort-launch.en.vtt',
  seconds: 40,
}

// The <head> text (D41), built from the name so a rename carries through.
export const SITE_TITLE = `${APP_NAME}: sort recovered photos by date`
export const DESCRIPTION = `${APP_NAME} turns the jumble of files a recovery program like PhotoRec gives back into a photo library sorted by date. Free, in your browser, nothing uploaded.`
export const SHARE_TITLE = `${TAGLINE.replace(/\.$/, '')}: your photos, sorted by date.`
export const SHARE_DESCRIPTION = 'Sorts recovered files into a photo library by date. Free, in your browser.'
/** The share image (made by scripts/make-share-image.mjs), relative to SITE_URL. */
export const SHARE_IMAGE = 'launch/share.png'
export const SHARE_IMAGE_ALT = 'Three printed photos fanned out, the middle one dated March 2009.'
