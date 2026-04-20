import { useEffect, useRef } from "react";
import type { Paddler } from "../types";

// Paddler tile — matches the Lokahi mock's `PaddlerChip`:
// a small rounded rectangle with a gender-coded gradient background
// (teal for kane, red for wahine), first name on top, last initial +
// five ability dots on the bottom, and an optional role tag in the
// top-right corner. Replaces the older flat-row PaddlerCircle while
// keeping the same export names so existing callers work unchanged.

type Variant = 'boat' | 'sidebar';

export type ChipDims = { w: number; h: number; fs: number; dot: number; pad: string };

// Notched-zoom steps used by the mobile On Shore panel (Lokahi.html's
// NotchedZoom, zoom 0..4). Re-exported so callers can index into it.
export const ON_SHORE_ZOOM_STEPS: ChipDims[] = [
  { w: 44, h: 34, fs: 9,  dot: 2.2, pad: '3px 4px' },
  { w: 52, h: 40, fs: 10, dot: 2.8, pad: '3px 5px' },
  { w: 60, h: 46, fs: 11, dot: 3,   pad: '4px 6px' },
  { w: 72, h: 56, fs: 13, dot: 4,   pad: '6px 8px' },
  { w: 88, h: 68, fs: 14, dot: 4,   pad: '8px 10px' },
];

const dimsFor = (variant: Variant | undefined): ChipDims =>
  variant === 'sidebar'
    ? { w: 68, h: 52, fs: 12, dot: 3, pad: '5px 7px' }
    : { w: 74, h: 58, fs: 13, dot: 4, pad: '6px 8px' };

const genderPalette = (gender: Paddler['gender']) => {
  if (gender === 'wahine') {
    return {
      fg: '#ffeaec',
      bg1: '#a81a22',
      bg2: '#8a1218',
      border: '#d63441',
      dotOff: 'rgba(255,255,255,0.22)',
    };
  }
  return {
    fg: '#e5f2f8',
    bg1: '#2e6b80',
    bg2: '#1f4e5e',
    border: '#4a8ba0',
    dotOff: 'rgba(255,255,255,0.22)',
  };
};

export const PaddlerCircle: React.FC<{
  paddler: Paddler;
  isDragging?: boolean;
  animationKey?: number;
  animationDelay?: number;
  isAdmin?: boolean;
  variant?: Variant;
  /** Overrides variant-based sizing. Used by the On Shore zoom slider. */
  dims?: ChipDims;
}> = ({ paddler, isDragging, animationKey = 0, animationDelay = 0, variant, dims: dimsOverride }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animationKey === 0) return;
    const el = rootRef.current;
    if (!el) return;
    const anim = el.animate(
      [
        { transform: 'scale(0.3)', opacity: 0 },
        { transform: 'scale(1.08)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      {
        duration: 350,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        delay: animationDelay,
        fill: 'backwards',
      }
    );
    return () => anim.cancel();
  }, [animationKey, animationDelay]);

  const dims = dimsOverride ?? dimsFor(variant);
  const { fg, bg1, bg2, border, dotOff } = genderPalette(paddler.gender);

  const firstName = paddler.firstName || '?';
  const lastInitial = (paddler.lastInitial || paddler.lastName?.[0] || '').toUpperCase();

  // Derive a short role tag. The mock's PaddlerChip shows a "STEER" style
  // tag in the top-right when the paddler has a relevant note or seat hint.
  // We approximate that here off primary seat preference: seat 1 -> STEER.
  const pref = paddler.seatPreference || '';
  const primarySeat = pref.split('').map(Number).find((n: number) => n >= 1 && n <= 6);
  const roleTag = primarySeat === 1 ? 'STEER' : null;

  return (
    <div
      ref={rootRef}
      className={`flex-shrink-0 ${isDragging ? 'opacity-90' : ''} cursor-grab active:cursor-grabbing`}
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: 10,
        background: `linear-gradient(160deg, ${bg1}, ${bg2})`,
        border: `1px solid ${border}`,
        boxShadow: isDragging
          ? '0 10px 24px rgba(0,0,0,0.35), 0 0 0 1.5px #fff'
          : '0 1px 2px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.12)',
        color: fg,
        padding: dims.pad,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        transform: isDragging ? 'rotate(-3deg) scale(1.05)' : 'none',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        touchAction: 'manipulation',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* soft rim highlight */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 10,
          background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.14), transparent 50%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          fontSize: dims.fs,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          position: 'relative',
        }}
      >
        {firstName}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, position: 'relative' }}>
        <span style={{ fontSize: dims.fs - 3, opacity: 0.7, fontWeight: 500 }}>
          {lastInitial ? `${lastInitial}.` : ''}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <div
              key={n}
              style={{
                width: dims.dot,
                height: dims.dot,
                borderRadius: '50%',
                background: n <= paddler.ability ? fg : dotOff,
              }}
            />
          ))}
        </div>
      </div>
      {roleTag && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.85,
            background: 'rgba(0,0,0,0.28)',
            padding: '1px 4px',
            borderRadius: 4,
          }}
        >
          {roleTag}
        </div>
      )}
    </div>
  );
};

export const GuestPaddlerCircle: React.FC<{
  paddler: Paddler;
  isDragging?: boolean;
  variant?: Variant;
  dims?: ChipDims;
}> = ({ paddler, isDragging, variant, dims: dimsOverride }) => {
  const dims = dimsOverride ?? dimsFor(variant);
  const firstName = paddler.firstName || 'Guest';
  const lastInitial = (paddler.lastInitial || paddler.lastName?.[0] || '').toUpperCase();
  const fg = '#fff7e6';
  const bg1 = '#a07838';
  const bg2 = '#7a5a28';
  const border = '#c29a58';

  return (
    <div
      className={`flex-shrink-0 ${isDragging ? 'opacity-90' : ''} cursor-grab active:cursor-grabbing`}
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: 10,
        background: `linear-gradient(160deg, ${bg1}, ${bg2})`,
        border: `1px solid ${border}`,
        boxShadow: isDragging
          ? '0 10px 24px rgba(0,0,0,0.35), 0 0 0 1.5px #fff'
          : '0 1px 2px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.12)',
        color: fg,
        padding: dims.pad,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        touchAction: 'manipulation',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 10,
          background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.14), transparent 50%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          fontSize: dims.fs,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          position: 'relative',
        }}
      >
        {firstName}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, position: 'relative' }}>
        <span style={{ fontSize: dims.fs - 3, opacity: 0.75, fontWeight: 500 }}>
          {lastInitial ? `${lastInitial}.` : ''}
        </span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: 'rgba(0,0,0,0.28)',
            padding: '1px 4px',
            borderRadius: 4,
          }}
        >
          Guest
        </span>
      </div>
    </div>
  );
};
