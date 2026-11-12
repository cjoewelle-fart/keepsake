// D43: the launch video on the start screen. Set in src/brand.ts (LAUNCH_VIDEO); a build can swap
// in a stand-in: VITE_LAUNCH_VIDEO=launch/standin.webm VITE_LAUNCH_CAPTIONS=launch/standin.en.vtt
// (and VITE_LAUNCH_SECONDS, default 40). Files live in public/launch/, which the offline cache skips.
import { LAUNCH_VIDEO } from '../brand';

export type LaunchVideo = { src: string; captions: string; seconds: number };

/** The stand-in's length when a build doesn't give one. */
const DEFAULT_SECONDS = 40;

/** The video from the build's environment, else the brand setting. A video needs captions. */
export function launchVideo(env: Record<string, string | undefined> = import.meta.env ?? {}): LaunchVideo | null {
  const src = env.VITE_LAUNCH_VIDEO?.trim();
  const captions = env.VITE_LAUNCH_CAPTIONS?.trim();
  if (src && captions) {
    const seconds = Number(env.VITE_LAUNCH_SECONDS);
    return { src, captions, seconds: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : DEFAULT_SECONDS };
  }
  return LAUNCH_VIDEO;
}
