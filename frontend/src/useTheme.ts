import { useCallback, useEffect, useState } from "react";

// Themes are applied by setting `data-theme="<id>"` on <html>. The
// matching CSS rules live in index.css under the same attribute
// selector. The default Lokahi theme uses no `data-theme` value (or
// `data-theme="lokahi"`) and inherits the unscoped CSS — so only
// non-default themes need their own override block.
export type ThemeId = 'lokahi' | 'edge' | 'pillow' | 'midnight';

export type Theme = {
  id: ThemeId;
  name: string;
  blurb: string;
  // Canvas + accent colors used by the SettingsPage preview tile. The
  // actual visual differences (corner shape, surface recoloring, etc.)
  // come from the CSS rules scoped under [data-theme="<id>"] — the
  // preview tile sets that attribute on its own wrapper so the same
  // rules paint the preview as well.
  preview: {
    bg: string;
    accent: string;
  };
};

export const THEMES: Theme[] = [
  {
    id: 'lokahi',
    name: 'Lokahi',
    blurb: 'The original — cream and Hawaiian red, soft corners.',
    preview: { bg: '#faf9f7', accent: '#ed1c24' },
  },
  {
    id: 'edge',
    name: 'Edge',
    blurb: 'Sharp, non-rounded corners. Industrial feel.',
    preview: { bg: '#ffffff', accent: '#ed1c24' },
  },
  {
    id: 'pillow',
    name: 'Pillow',
    blurb: 'Extra-rounded buttons and chips. Maximum softness.',
    preview: { bg: '#faf9f7', accent: '#ed1c24' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    blurb: 'Dark canvas. Recolors most surfaces to a deep slate.',
    preview: { bg: '#14171c', accent: '#ff5a60' },
  },
];

const STORAGE_KEY = 'lokahi.theme';
const DEFAULT_THEME: ThemeId = 'lokahi';

function readTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const v = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  return v && THEMES.some(t => t.id === v) ? v : DEFAULT_THEME;
}

function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', id);
}

// Apply on module load so the very first paint matches the persisted
// theme — avoids a flash of the default theme on hard refresh.
if (typeof document !== 'undefined') {
  applyTheme(readTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => readTheme());

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    applyTheme(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  // Sync if another tab updates the theme.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readTheme();
      setThemeState(next);
      applyTheme(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { theme, setTheme, themes: THEMES } as const;
}
