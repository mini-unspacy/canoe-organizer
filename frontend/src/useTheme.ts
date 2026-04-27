import { useCallback, useEffect, useState } from "react";

// Theme is two independent axes:
//   • color     — the palette: identifies an accent + a mode
//                 ('light' = cream surfaces, 'dark' = slate surfaces).
//                 Each color carries both because they should always
//                 be selected together; no UI ever picks a "light"
//                 mode without also picking the accent that goes with
//                 it (e.g. cream-and-red Lokahi or dark-and-cyan
//                 Abyss).
//   • sharpness — the corner-radius treatment: round / soft / subtle / sharp
//
// Both are applied as separate attributes on <html>. `data-color`
// drives accent overrides, `data-mode` drives the (much heavier)
// surface + text recoloring. Splitting mode out lets every dark
// theme share one set of substring matchers for surfaces/text/etc;
// otherwise we'd need to copy the whole Midnight CSS for every new
// dark color we add. Defaults (`lokahi` / `light` / `soft`) need no
// rules — they fall through to the un-scoped CSS.
export type ColorId =
  | 'lokahi'    // light · Hawaiian red    (default)
  | 'ocean'     // light · deep cyan/teal
  | 'sunrise'   // light · burnt orange
  | 'forest'    // light · pine green
  | 'midnight'  // dark  · pink-red
  | 'abyss';    // dark  · electric cyan

export type SharpnessId = 'round' | 'soft' | 'subtle' | 'sharp';
export type ModeId = 'light' | 'dark';

export type Color = {
  id: ColorId;
  name: string;
  mode: ModeId;
  // Used by the Settings preview tile and the small color swatches.
  // The actual app surfaces are recolored by CSS rules under
  // [data-mode="dark"] (shared) and [data-color="<id>"] (per-theme
  // accent). These are just the canonical sample colors.
  surface: string;
  accent: string;
  text: string;
};

export type Sharpness = {
  id: SharpnessId;
  label: string;
  // Sample border-radius (px) used by the Settings preview tile.
  // Real app radii come from the [data-sharpness] CSS rules.
  sample: number;
};

// Canonical color list. The `surface` field here is the canvas
// color the theme paints on the page — keep it in sync with the
// matching --bg-canvas value in index.css. Sample colors used by
// the SettingsPage swatches and preview tile so the picker shows
// each theme's own surface, not the live theme's.
export const COLORS: Color[] = [
  { id: 'lokahi',   name: 'Lokahi',   mode: 'light', surface: '#faf9f7', accent: '#c82028', text: '#1a1a1a' },
  { id: 'ocean',    name: 'Ocean',    mode: 'light', surface: '#c2dae6', accent: '#0e7490', text: '#1a1a1a' },
  { id: 'sunrise',  name: 'Sunrise',  mode: 'light', surface: '#f4caa3', accent: '#c2410c', text: '#1a1a1a' },
  { id: 'forest',   name: 'Forest',   mode: 'light', surface: '#c2d8c5', accent: '#15803d', text: '#1a1a1a' },
  { id: 'midnight', name: 'Midnight', mode: 'dark',  surface: '#14171c', accent: '#ff5a60', text: '#e8e8e8' },
  { id: 'abyss',    name: 'Abyss',    mode: 'dark',  surface: '#081320', accent: '#22d3ee', text: '#e8e8e8' },
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
  // Keep `data-mode` in sync so the shared dark-mode CSS lights up
  // on every dark color. Looked up via the COLORS table to keep
  // mode and color tied at one place.
  const mode = COLORS.find(c => c.id === id)?.mode ?? 'light';
  document.documentElement.setAttribute('data-mode', mode);
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
