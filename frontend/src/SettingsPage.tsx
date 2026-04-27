// Settings page. Two independent theme axes: color (Lokahi / Midnight)
// and sharpness (Round / Soft / Subtle / Sharp). A single live preview
// at the top reflects the current combination; the swatches and slider
// below are the picker controls.

import {
  useTheme,
  COLORS,
  SHARPNESS_LEVELS,
  type ColorId,
  type SharpnessId,
  type Color,
  type Sharpness,
} from "./useTheme";

const T = {
  bone: "#ffffff",
  inkSoft: "#f5f3ef",
  inkLine: "#e3e0da",
  inkHigh: "#1a1a1a",
  charcoal: "#1a1a1a",
  muted: "#6b6558",
  red: "#c82028",
};
const FONT_BODY = "'Figtree', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const FONT_DISPLAY = "'Instrument Serif', Georgia, serif";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: T.muted, marginBottom: 12 }}>
      <span>{children}</span>
      <div style={{ flex: 1, height: 1, background: T.inkLine }} />
    </div>
  );
}

// Single live preview tile. Reflects the current color × sharpness
// combination by reading both off useTheme. Unlike the old per-card
// previews this one isn't isolated from the live cascade — it IS the
// live cascade — so it always matches whatever's selected without
// needing to restate values.
function ThemePreview({ color, sharpness }: { color: Color; sharpness: Sharpness }) {
  const isDark = color.mode === 'dark';
  const innerSurface = isDark ? '#232730' : '#ffffff';
  const subtleBar = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
  const mutedBar = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  const border = isDark ? '1px solid rgba(255,255,255,0.10)' : `1px solid ${T.inkLine}`;
  // Outer wrapper uses the chosen radius too so "round" reads as a
  // pill-shaped tile and "sharp" reads as a slab. Capped at 18px for
  // the outer chrome so 9999 doesn't make the whole tile a sausage.
  const outerR = Math.min(sharpness.sample, 18);
  const innerR = Math.min(sharpness.sample, 14);
  const chipR = sharpness.sample;
  const barR = Math.min(sharpness.sample, 6);
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 8',
        background: color.surface,
        border,
        borderRadius: outerR,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
        overflow: 'hidden',
        color: color.text,
      }}
    >
      {/* Top bar: accent dot + a "title" line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 22,
          height: 22,
          background: color.accent,
          borderRadius: chipR,
          flexShrink: 0,
        }} />
        <div style={{ flex: 1, height: 8, background: subtleBar, borderRadius: barR }} />
      </div>
      {/* Card surface */}
      <div
        style={{
          background: innerSurface,
          borderRadius: innerR,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          flex: 1,
          boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 10, background: subtleBar, borderRadius: barR }} />
          <div
            style={{
              padding: '0 12px',
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: color.accent,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: chipR,
              lineHeight: 1,
              letterSpacing: '0.04em',
            }}
          >
            GO
          </div>
        </div>
        <div style={{ height: 10, background: mutedBar, borderRadius: barR }} />
        <div style={{ height: 10, width: '70%', background: mutedBar, borderRadius: barR }} />
      </div>
    </div>
  );
}

// Small color swatch — circle showing the color's surface + accent.
// Selected state gets a red ring matching the selected-card affordance.
function ColorSwatch({
  color,
  active,
  onSelect,
}: {
  color: Color;
  active: boolean;
  onSelect: (id: ColorId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(color.id)}
      title={color.name}
      aria-label={`Color: ${color.name}`}
      aria-pressed={active}
      // `theme-locked` keeps the global [data-color] / [data-mode]
      // matchers from recoloring this swatch's inline surface +
      // accent — without it, every swatch would render in the LIVE
      // theme's color instead of its own.
      className="btn-zoom theme-locked"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: FONT_BODY,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: color.surface,
          border: active ? `2px solid ${T.red}` : `1px solid ${T.inkLine}`,
          boxShadow: active
            ? '0 0 0 4px rgba(200,32,40,0.12)'
            : '0 1px 2px rgba(0,0,0,0.05)',
          position: 'relative',
          transition: 'box-shadow 180ms ease, border-color 180ms ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Inner accent dot — gives the swatch a clear identity beyond
            just "light circle" / "dark circle" by showing the brand
            accent color too. */}
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: color.accent }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? T.red : T.muted, letterSpacing: '0.04em' }}>
        {color.name}
      </span>
    </button>
  );
}

// Sharpness slider — a 4-stop range input with tick marks below. We
// use a real <input type="range"> so keyboard nav and accessibility
// come for free; the visual styling is a thin track + a red thumb to
// echo the selected-card chrome from the color swatches.
function SharpnessSlider({
  value,
  onChange,
}: {
  value: SharpnessId;
  onChange: (id: SharpnessId) => void;
}) {
  const idx = SHARPNESS_LEVELS.findIndex(s => s.id === value);
  const max = SHARPNESS_LEVELS.length - 1;
  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={idx === -1 ? 0 : idx}
        onChange={(e) => {
          const next = SHARPNESS_LEVELS[Number(e.target.value)];
          if (next) onChange(next.id);
        }}
        aria-label="Corner sharpness"
        style={{
          width: '100%',
          accentColor: T.red,
          margin: 0,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {SHARPNESS_LEVELS.map((s, i) => {
          const active = i === idx;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              style={{
                fontFamily: FONT_BODY,
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: active ? T.red : T.muted,
                background: 'transparent',
                border: 'none',
                padding: '2px 0',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsPage({
  email,
  onLogout,
}: {
  // Both optional so the page is callable with no props (the desktop
  // sidebar used to host the email + logout, but now they live here —
  // and we want this page to keep working in any future entry point
  // that doesn't have a logged-in user).
  email?: string;
  onLogout?: () => void;
}) {
  const { color, sharpness, setColor, setSharpness } = useTheme();
  const currentColor = COLORS.find(c => c.id === color) ?? COLORS[0];
  const currentSharpness = SHARPNESS_LEVELS.find(s => s.id === sharpness) ?? SHARPNESS_LEVELS[1];

  return (
    <div
      className="page-fade-in"
      style={{
        padding: '20px 18px 40px',
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: FONT_BODY,
        color: T.charcoal,
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 36, lineHeight: 1, margin: 0, color: T.inkHigh, fontWeight: 400 }}>
          Settings
        </h1>
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: T.muted }}>
          Personalize how Lokahi looks and feels.
        </p>
      </div>

      {/* Live preview — reflects the current color × sharpness combo. */}
      <SectionLabel>Preview</SectionLabel>
      <div style={{ marginBottom: 28 }}>
        <ThemePreview color={currentColor} sharpness={currentSharpness} />
      </div>

      {/* Color swatches — small, just the palette. Grouped by mode so
          the user sees the four light variants together and the dark
          variants together; visually mirrors the surface they paint. */}
      <SectionLabel>Color</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {COLORS.filter(c => c.mode === 'light').map(c => (
            <ColorSwatch key={c.id} color={c} active={color === c.id} onSelect={setColor} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {COLORS.filter(c => c.mode === 'dark').map(c => (
            <ColorSwatch key={c.id} color={c} active={color === c.id} onSelect={setColor} />
          ))}
        </div>
      </div>

      {/* Sharpness slider — corner shape, independent of color. */}
      <SectionLabel>Corner sharpness</SectionLabel>
      <div style={{ marginBottom: 28 }}>
        <SharpnessSlider value={sharpness} onChange={setSharpness} />
      </div>

      <p style={{ fontSize: 11, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>
        Theme choice is remembered on this device only.
      </p>

      {/* Account block — sign-in identity + logout. The desktop sidebar
          used to be the only home for these; with the sidebar gone they
          live here at every viewport width. */}
      {(email || onLogout) && (
        <div style={{ marginTop: 36 }}>
          <SectionLabel>Account</SectionLabel>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              border: `1px solid ${T.inkLine}`,
              background: T.bone,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
                Signed in as
              </div>
              <div style={{ fontSize: 14, color: T.charcoal, wordBreak: 'break-all' }}>
                {email || '—'}
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.inkLine}`,
                  background: T.bone,
                  color: T.red,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#faf3f3'; e.currentTarget.style.borderColor = T.red; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = T.bone; e.currentTarget.style.borderColor = T.inkLine; }}
              >
                Log out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
