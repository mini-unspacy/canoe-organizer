import { useEffect, useState } from "react";

// Shared visual dims for the paddler chip. Exposed so both the On Shore
// pool (with a zoom slider) and the canoe seat rows can select a matching
// size — when the two render at the same dims, dragging a paddler back
// and forth between the pool and a seat produces a consistent drag
// preview, which is critical for the drop-target affordance to feel right.
export type PaddlerRowDims = { minH: number; fs: number; dot: number; gap: number };

export const POOL_ROW_ZOOM_STEPS: PaddlerRowDims[] = [
  { minH: 22, fs: 14, dot: 8,  gap: 2 },
  { minH: 25, fs: 16, dot: 9,  gap: 3 },
  { minH: 28, fs: 18, dot: 10, gap: 3 },
  { minH: 34, fs: 20, dot: 11, gap: 4 },
];

// Default pool zoom (step 2). The canoe seat rows size-match to this
// step so the drag preview looks identical across both surfaces.
export const DEFAULT_POOL_ZOOM = 2;
export const SEAT_CHIP_DIMS = POOL_ROW_ZOOM_STEPS[DEFAULT_POOL_ZOOM];
export const SEAT_CHIP_DIMS_COMPACT = POOL_ROW_ZOOM_STEPS[0];

// Visual chip rendered inside each paddler Draggable. The chip is a
// CHILD of the draggable wrapper (not the draggable element itself) so
// the dnd measurement pass sees a clean bounding box at drag-start. The
// chip owns the resting/hover/pressed/dragging shadow + transform tiers
// so the user gets a "lift / hold / fly" affordance when grabbing a
// paddler, with hit-detection still driven by the untouched wrapper.
//
//   resting  → subtle 1px shadow (or none when flat)
//   hover    → lift + larger shadow (indicates "grabbable")
//   pressed  → bigger shadow + scale-down (indicates "held")
//   dragging → strongest shadow with white ring (dnd has taken over)
//
// `flat` is used for chips that live inside canoe seats — the seat row
// already has its own background/border, so the chip renders with a
// transparent fill at rest and only draws its own background on hover/
// press/drag. `flat` chips still use the same dims + padding + shadow
// tiers as the pool chips, which keeps drag previews consistent.
export const PaddlerChip: React.FC<{
  label: string;
  color: string;
  dims: PaddlerRowDims;
  flat?: boolean;
  isDragging?: boolean;
  title?: string;
  // When false, the chip is a static label — no hover/press transforms,
  // no resting shadow, default cursor. Used in non-admin views where the
  // chip isn't draggable and shouldn't advertise itself as interactive.
  interactive?: boolean;
}> = ({ label, color, dims, flat, isDragging, title, interactive = true }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Defensive: if dnd captures the pointer and the chip never receives
  // mouseup/touchend, `pressed` would otherwise stay true forever and
  // leave the chip visibly stuck in its grabbed state. A window-level
  // mouseup/touchend listener reliably clears it, even when the real
  // events were captured elsewhere. Also clear on unmount.
  useEffect(() => {
    if (!pressed) return;
    const clear = () => setPressed(false);
    window.addEventListener('mouseup', clear);
    window.addEventListener('touchend', clear);
    window.addEventListener('touchcancel', clear);
    return () => {
      window.removeEventListener('mouseup', clear);
      window.removeEventListener('touchend', clear);
      window.removeEventListener('touchcancel', clear);
    };
  }, [pressed]);

  // While dnd is dragging the chip, suppress local hover/press visuals
  // and don't apply any transform — dnd owns the drag preview's
  // transform via draggableProps.style on the wrapper. Applying our
  // own transform on the child here would layer on top of dnd's and
  // shift the element under the cursor mid-drag.
  // Non-interactive chips ignore hover/press entirely and render at rest.
  const effHovered = interactive && hovered;
  const effPressed = interactive && pressed;
  const shadow = isDragging
    ? '0 16px 32px rgba(0,0,0,0.34), 0 0 0 1.5px rgba(255,255,255,0.9)'
    : effPressed
      ? '0 10px 22px rgba(0,0,0,0.3)'
      : effHovered
        ? '0 6px 14px rgba(0,0,0,0.22)'
        : flat ? 'none' : '0 1px 2px rgba(0,0,0,0.08)';
  // Only hover transforms the chip. Pressed keeps the element's
  // position stable so @hello-pangea/dnd's drag-start threshold check
  // isn't confused by an element shifting under the cursor between
  // mousedown and the 5px drag threshold being crossed.
  const transform = isDragging || effPressed
    ? 'none'
    : effHovered
      ? 'translateY(-3px) scale(1.02)'
      : 'none';
  const restBg = flat ? 'transparent' : 'rgba(0,0,0,0.04)';
  const restBorder = flat ? '1px solid transparent' : '1px solid rgba(0,0,0,0.06)';
  const bg = isDragging
    ? 'rgba(255,255,255,0.96)'
    : effPressed
      ? (flat ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.96)')
      : effHovered
        ? (flat ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)')
        : restBg;
  return (
    <div
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => { setHovered(false); setPressed(false); } : undefined}
      onMouseDown={interactive ? () => setPressed(true) : undefined}
      onMouseUp={interactive ? () => setPressed(false) : undefined}
      onTouchStart={interactive ? () => setPressed(true) : undefined}
      onTouchEnd={interactive ? () => setPressed(false) : undefined}
      onTouchCancel={interactive ? () => setPressed(false) : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        // box-sizing: border-box so dims.minH is the ACTUAL rendered
        // height of the chip. With the default content-box, a chip with
        // minH=28 + padding 3+3 + border 1+1 renders at 36px — 8px
        // taller than expected. Consumers (seat rows, pool rows) size
        // themselves around the chip's minH, so letting it mean "actual
        // height" lets those containers size correctly without having
        // to add +8 everywhere.
        boxSizing: 'border-box',
        padding: '3px 8px',
        borderRadius: 7,
        background: bg,
        border: restBorder,
        minHeight: dims.minH,
        boxShadow: shadow,
        opacity: isDragging ? 0.95 : 1,
        transform,
        transition: 'box-shadow 140ms ease, transform 140ms ease, background 140ms ease',
        cursor: !interactive ? 'default' : (isDragging ? 'grabbing' : 'grab'),
        maxWidth: '100%',
        gap: dims.gap + 3,
      }}
    >
      <span
        style={{
          fontSize: dims.fs,
          lineHeight: 1,
          fontWeight: 700,
          color,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          // Truncate by clipping — no trailing ellipsis, which just
          // eats horizontal space inside an already-tight seat row.
          overflow: 'hidden',
          textOverflow: 'clip',
          minWidth: 0,
        }}
        title={title}
      >
        {label}
      </span>
    </div>
  );
};
