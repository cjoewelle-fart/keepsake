// D43: the launch video on the start screen. Off (null) unless src/brand.ts sets one, or a build
// passes a stand-in: VITE_LAUNCH_VIDEO=launch/standin.webm VITE_LAUNCH_CAPTIONS=launch/standin.en.vtt
// (and VITE_LAUNCH_MINUTES, default 1). Files live in public/launch/, which the offline cache skips.
import { LAUNCH_VIDEO } from '../brand';

export type LaunchVideo = { src: string; captions: string; minutes: number };

/** The video from the build's environment, else the brand setting. A video needs captions. */
export function launchVideo(env: Record<string, string | undefined> = import.meta.env ?? {}): LaunchVideo | null {
  const src = env.VITE_LAUNCH_VIDEO?.trim();
  const captions = env.VITE_LAUNCH_CAPTIONS?.trim();
  if (src && captions) {
    const minutes = Number(env.VITE_LAUNCH_MINUTES);
    return { src, captions, minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 1 };
  }
  return LAUNCH_VIDEO;
}
