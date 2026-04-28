// Paddler badges — small icons that appear before the paddler's name in
// every chip (canoe seats, On Shore pool, going list, roster). Stored on
// the paddler doc as an array of badge ids; missing/undefined means the
// paddler has no badges.
//
// Adding a new badge: append to BADGES with a fresh id. Old paddlers
// keep working (their `badges` field just doesn't reference it). The
// rendering code falls back to nothing for unknown ids, so retiring a
// badge is also non-breaking — paddlers that referenced it just stop
// showing that glyph.
//
// Glyphs are emoji rather than SVG to stay consistent with the rest of
// the app (gender markers ♂️/♀️, "today" indicators, etc.) and to render
// natively across platforms without us shipping an icon font.

export interface BadgeDef {
  id: string;
  label: string;
  glyph: string;
  hint: string; // Tooltip / aria-label
}

export const BADGES: BadgeDef[] = [
  { id: 'star',    label: 'star',    glyph: '⭐', hint: 'Star — recognition' },
  { id: 'flower',  label: 'flower',  glyph: '🌺', hint: 'Hibiscus — special honoree' },
  { id: 'paddle',  label: 'paddle',  glyph: '🛶', hint: 'Paddle — paddling milestone' },
  { id: 'crown',   label: 'crown',   glyph: '👑', hint: 'Crown — leader / captain' },
  { id: 'honu',    label: 'honu',    glyph: '🐢', hint: 'Honu — elder / longtime member' },
  { id: 'anchor',  label: 'anchor',  glyph: '⚓', hint: 'Anchor — steerer / stroker' },
  { id: 'wave',    label: 'wave',    glyph: '🌊', hint: 'Wave — strong ocean experience' },
  { id: 'fire',    label: 'fire',    glyph: '🔥', hint: 'Fire — top performer' },
  { id: 'shaka',   label: 'shaka',   glyph: '🤙', hint: 'Shaka — great vibes' },
];

// Lookup map for O(1) id → BadgeDef resolution at render time. Built
// once at module load so render passes don't re-scan the array.
export const BADGE_BY_ID: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map(b => [b.id, b])
);

// Resolve a list of stored badge ids to BadgeDefs, dropping unknown ids
// silently so a retired-or-typo'd id never crashes a chip.
export function resolveBadges(ids: string[] | undefined): BadgeDef[] {
  if (!ids || ids.length === 0) return [];
  const out: BadgeDef[] = [];
  for (const id of ids) {
    const def = BADGE_BY_ID[id];
    if (def) out.push(def);
  }
  return out;
}
