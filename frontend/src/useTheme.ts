import { useCallback, useEffect, useState } from "react";

// Theme is two independent axes:
//   • color     — the palette: cream/red ('lokahi') or dark slate ('midnight')
//   • sharpness — the corner-radius treatment: round / soft / subtle / sharp
// Both are applied as separate attributes on <html> (`data-color` and
// `data-sharpness`) and the matching CSS rules in index.css are scoped
// under those attributes. Defaults (`lokahi` / `soft`) need no rules —
// they fall through to the un-scoped CSS.
//
// Splitting these used to be one combined `data-theme="edge|pillow|…"`
// attribute that conflated palette and shape, which made nonsense
// combos like "round corners on dark slate" unreachable. The two-axis
// model lets the user mix any palette with any sharpness.
export type ColorId = 'lokahi' | 'midnight';
export type SharpnessId = 'round' | 'soft' | 'subtle' | 'sharp';

export type Color = {
  id: ColorId;
  name: string;
  // Sample colors used by the Settings preview tile and the small
  // selector swatches. The actual app surfaces are recolored by the
  // CSS rules under [data-color="<id>"] (for non-default colors).
  surface: string;
  accent: string;
  text: string;
};

export type Sharpness = {
  id: SharpnessId;
  label: string;
  // Sample border-radius (in px) used by the Settings preview tile to
  // visualize the sharpness level. Real app radii come from the CSS
  // rules under [data-sharpness="<id>"] — this is just for the picker.
  sample: number;
};

export const COLORS: Color[] = [
  { id: 'lokahi',   name: 'Lokahi',   surface: '#faf9f7', accent: '#ed1c24', text: '#1a1a1a' },
  { id: 'midnight', name: 'Midnight', surface: '#1a1d23', accent: '#ff5a60', text: '#e8e8e8' },
];

export const SHARPNESS_LEVELS: Sharpness[] = [
  { id: 'round',  label: 'Round',  sample: 9999 },
  { id: 'soft',   label: 'Soft',   sample: 12 },
  { id: 'subtle', label: 'Subtle', sample: 4 },
  { id: 'sharp',  label: 'Sharp',  sample: 0 },
];

const COLOR_KEY = 'lokahi.theme.color';
const SHARPNESS_KEY = 'lokahi.theme.sharpness';
const LEGACY_KEY = 'lokahi.theme';

const DEFAULT_COLOR: ColorId = 'lokahi';
const DEFAULT_SHARPNESS: SharpnessId = 'soft';

// Migrate the old single-axis `lokahi.theme` key into the new pair.
// Maps: lokahi→(lokahi,soft), midnight→(midnight,soft), edge→(lokahi,sharp),
// pillow→(lokahi,round). Runs once per browser, then deletes the legacy
// key so subsequent reads come from the new pair.
function migrateLegacy(): { color?: ColorId; sharpness?: SharpnessId } {
  if (typeof window === 'undefined') return {};
  const old = window.localStorage.getItem(LEGACY_KEY);
  if (!old) return {};
  let color: ColorId | undefined;
  let sharpness: SharpnessId | undefined;
  if (old === 'midnight') color = 'midnight';
  else if (old === 'edge') sharpness = 'sharp';
  else if (old === 'pillow') sharpness = 'round';
  else if (old === 'lokahi') { /* defaults */ }
  if (color) window.localStorage.setItem(COLOR_KEY, color);
  if (sharpness) window.localStorage.setItem(SHARPNESS_KEY, sharpness);
  window.localStorage.removeItem(LEGACY_KEY);
  return { color, sharpness };
}

function readColor(): ColorId {
  if (typeof window === 'undefined') return DEFAULT_COLOR;
  const v = window.localStorage.getItem(COLOR_KEY) as ColorId | null;
  return v && COLORS.some(c => c.id === v) ? v : DEFAULT_COLOR;
}

function readSharpness(): SharpnessId {
  if (typeof window === 'undefined') return DEFAULT_SHARPNESS;
  const v = window.localStorage.getItem(SHARPNESS_KEY) as SharpnessId | null;
  return v && SHARPNESS_LEVELS.some(s => s.id === v) ? v : DEFAULT_SHARPNESS;
}

function applyColor(id: ColorId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-color', id);
}
function applySharpness(id: SharpnessId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-sharpness', id);
}

// Apply on module load so the very first paint matches the persisted
// theme — avoids a flash of the default theme on hard refresh.
if (typeof document !== 'undefined') {
  migrateLegacy();
  applyColor(readColor());
  applySharpness(readSharpness());
}

export function useTheme() {
  const [color, setColorState] = useState<ColorId>(() => readColor());
  const [sharpness, setSharpnessState] = useState<SharpnessId>(() => readSharpness());

  const setColor = useCallback((id: ColorId) => {
    setColorState(id);
    applyColor(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLOR_KEY, id);
    }
  }, []);

  const setSharpness = useCallback((id: SharpnessId) => {
    setSharpnessState(id);
    applySharpness(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SHARPNESS_KEY, id);
    }
  }, []);

  // Sync if another tab updates either axis.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === COLOR_KEY) {
        const next = readColor();
        setColorState(next);
        applyColor(next);
      } else if (e.key === SHARPNESS_KEY) {
        const next = readSharpness();
        setSharpnessState(next);
        applySharpness(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { color, sharpness, setColor, setSharpness, colors: COLORS, sharpnessLevels: SHARPNESS_LEVELS } as const;
}
