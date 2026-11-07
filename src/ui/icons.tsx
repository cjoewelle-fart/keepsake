// The app's icons (warmth spec §5): inline SVG, so no icon font and no requests. One grid for all of
// them: 24×24 viewBox, outlined in the text colour, stroke 1.8 (the logo's), round caps and joins.
// Drawn at 20px in buttons and text and 24px in card rows. Always decorative: the words beside an
// icon carry its meaning, so every icon is aria-hidden and never takes focus.
import type { ReactNode, SVGProps } from 'react';
import candles480 from '../assets/hero/3-candles-480.webp';
import candles240 from '../assets/hero/3-candles-240.webp';
import roadtrip480 from '../assets/hero/4-roadtrip-480.webp';
import roadtrip240 from '../assets/hero/4-roadtrip-240.webp';
import beach480 from '../assets/hero/6-beach-480.webp';
import beach240 from '../assets/hero/6-beach-240.webp';

type IconProps = { size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, 'children'>;

function Icon({ size = 20, className, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `icon ${className}` : 'icon'}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const FolderOpenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19.5h14.2a1.6 1.6 0 0 0 1.55-1.2l1.7-6.3A1.2 1.2 0 0 0 20.3 10.5H8.3a1.6 1.6 0 0 0-1.55 1.2L4 19.5z" />
    <path d="M4 19.5A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5h4.4l2 2.2h6.1A1.5 1.5 0 0 1 18 8.2v2.3" />
  </Icon>
);

export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h4.6l2.1 2.2h8.3A1.5 1.5 0 0 1 21 9.2v8.3a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
  </Icon>
);

export const PhotoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="M5.5 18l4.2-4.6 3.3 3.3 2.4-2.4 3.2 3.4" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.6" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    <path d="M12 14.6v2" />
  </Icon>
);

export const ShieldCheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l7.5 2.8v5.6c0 4.6-3.1 8.1-7.5 9.6-4.4-1.5-7.5-5-7.5-9.6V5.8z" />
    <path d="M8.6 12.1l2.4 2.4 4.4-4.6" />
  </Icon>
);

export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.6 5.6A10 10 0 0 1 12 5.5c5.2 0 8.6 4.6 9.4 6.5-.4.9-1.3 2.3-2.6 3.6" />
    <path d="M6.6 7.1C4.5 8.5 3.1 10.6 2.6 12c.8 1.9 4.2 6.5 9.4 6.5a9.6 9.6 0 0 0 4.6-1.2" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3.5 3.5l17 17" />
  </Icon>
);

export const UserXIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9.5" cy="8" r="3.8" />
    <path d="M2.8 20c.6-3.6 3.3-5.8 6.7-5.8s6.1 2.2 6.7 5.8" />
    <path d="M17 8.5l4 4M21 8.5l-4 4" />
  </Icon>
);

export const FileCheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a1.8 1.8 0 0 0-1.8 1.8v14.4A1.8 1.8 0 0 0 7 21h10a1.8 1.8 0 0 0 1.8-1.8V7.8z" />
    <path d="M14 3v4.8h4.8" />
    <path d="M9 14.2l2.1 2.1 4-4.1" />
  </Icon>
);

export const BookOpenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6.8C10.4 5.4 8 4.8 3 4.8v13.4c5 0 7.4.6 9 2 1.6-1.4 4-2 9-2V4.8c-5 0-7.4.6-9 2z" />
    <path d="M12 6.8v13.4" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />
  </Icon>
);

export const CornerUpLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 14.5L4 9.5l5-5" />
    <path d="M4 9.5h9.5a6.5 6.5 0 0 1 6.5 6.5v3.5" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12h15" />
    <path d="M13.5 6l6 6-6 6" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v11.5" />
    <path d="M7 10.5l5 5 5-5" />
    <path d="M4 17.5v1.2A1.8 1.8 0 0 0 5.8 20.5h12.4a1.8 1.8 0 0 0 1.8-1.8v-1.2" />
  </Icon>
);

/** The done screen's mark. Its two strokes draw themselves (pathLength 1, see .draw in app.css). */
export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle className="draw draw-ring" cx="12" cy="12" r="9" pathLength={1} transform="rotate(-90 12 12)" />
    <path className="draw draw-tick" d="M8 12.3l2.7 2.7 5.3-5.6" pathLength={1} />
  </Icon>
);

/** The scanning stages (done, current, not reached), on the same grid. */
export function StageIcon({ state }: { state: 'done' | 'current' | 'todo' }) {
  return (
    <Icon size={20} className={`stage-icon stage-${state}`}>
      {state === 'done' && <><circle cx="12" cy="12" r="9.2" fill="currentColor" /><path d="M7.9 12.2l2.8 2.8 5.4-5.6" stroke="#FFFFFF" /></>}
      {state === 'current' && <><circle cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" /></>}
      {state === 'todo' && <circle cx="12" cy="12" r="8.8" />}
    </Icon>
  );
}

/** A warning triangle for problem alerts. Filled, unlike the rest (kept from T83). */
export const CautionIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" focusable="false" className="icon problem-icon">
    <path d="M13 3.5L24 22.5H2z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M13 10v6" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="13" cy="19.2" r="1.3" fill="#FFFFFF" />
  </svg>
);

/**
 * Three prints, fanned out, with a date tag on the middle one. Decorative (alt=""). `settle`: deal
 * them out once. Real photos bundled with the app (img-src 'self' covers them): three Unsplash
 * photos (src/assets/hero, credits in CREDITS.md) in the rounder print frame.
 * On the start screen (round 4) the fan sits inside the h1 between the two parts of the heading:
 * `as="span"` keeps the h1's content phrasing, and `sizes` lets the browser pick the 240px files
 * when the prints are small. Elsewhere only where photos are really there or coming: scanning,
 * done. Empty and error states use BlankPrint.
 */
export function Prints({ settle = false, date, children, as: Box = 'div', sizes }: { settle?: boolean; date?: ReactNode; children?: ReactNode; as?: 'div' | 'span'; sizes?: string }) {
  const photo = (src480: string, src240: string) => (
    <img className="ph" src={src480} srcSet={sizes ? `${src240} 240w, ${src480} 480w` : undefined} sizes={sizes}
      alt="" width={480} height={384} decoding="async" draggable={false} />
  );
  return (
    <Box className={`fan${settle ? ' fan-deal' : ''}`} aria-hidden="true">
      <Box className="fan-print fan-l">{photo(beach480, beach240)}</Box>
      <Box className="fan-print fan-r">{photo(roadtrip480, roadtrip240)}</Box>
      <Box className="fan-print fan-c">{photo(candles480, candles240)}{date && <span className="tag">{date}</span>}</Box>
      {children}
    </Box>
  );
}

/** An empty print, outlined, with a folder on it: for "nothing found" and "couldn't open". Decorative. */
export const BlankPrint = () => (
  <div className="blank-print" aria-hidden="true">
    <FolderIcon size={40} />
  </div>
);
