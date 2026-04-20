import { useState } from "react";

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
  { minH: 40, fs: 22, dot: 12, gap: 5 },
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
  tag: string;
  dims: PaddlerRowDims;
  flat?: boolean;
  isDragging?: boolean;
  title?: string;
}> = ({ label, color, tag, dims, flat, isDragging, title }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const shadow = isDragging
    ? '0 16px 32px rgba(0,0,0,0.34), 0 0 0 1.5px rgba(255,255,255,0.9)'
    : pressed
      ? '0 10px 22px rgba(0,0,0,0.3)'
      : hovered
        ? '0 6px 14px rgba(0,0,0,0.22)'
        : flat ? 'none' : '0 1px 2px rgba(0,0,0,0.08)';
  const transform = isDragging
    ? 'none'
    : pressed
      ? 'translateY(-1px) scale(0.94)'
      : hovered
        ? 'translateY(-3px) scale(1.02)'
        : 'none';
  const restBg = flat ? 'transparent' : 'rgba(0,0,0,0.04)';
  const restBorder = flat ? '1px solid transparent' : '1px solid rgba(0,0,0,0.06)';
  const bg = isDragging
    ? 'rgba(255,255,255,0.96)'
    : pressed
      ? (flat ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.96)')
      : hovered
        ? (flat ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)')
        : restBg;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dims.gap + 3,
        padding: '3px 8px',
        borderRadius: 7,
        background: bg,
        border: restBorder,
        minHeight: dims.minH,
        boxShadow: shadow,
        opacity: isDragging ? 0.95 : 1,
        transform,
        transition: 'box-shadow 140ms ease, transform 140ms ease, background 140ms ease',
        cursor: isDragging ? 'grabbing' : 'grab',
        maxWidth: '100%',
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: dims.dot,
          height: dims.dot,
          borderRadius: 3,
          background: color,
          opacity: 0.85,
        }}
      />
      <span
        style={{
          fontSize: dims.fs,
          lineHeight: 1,
          fontWeight: 700,
          color,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
        title={title}
      >
        {label}
      </span>
      {tag && (
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: '#9a9a9a',
            flexShrink: 0,
          }}
        >
          {tag}
        </span>
      )}
    </div>
  );
};
