// Settings page. Currently houses the theme picker; designed to be a
// landing place for future preference toggles (notifications, default
// canoe priority, etc.). Styled to match the Roster + Schedule pages
// — cream surface, red accents, the same SectionLabel pattern.

import { useTheme, THEMES, type ThemeId, type Theme } from "./useTheme";

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

// Tiny device-frame preview that mirrors the actual visual change a
// theme applies. The radius/border/colors come from the theme's
// `preview` block — purely a thumbnail, no interactive state.
function ThemePreview({ theme }: { theme: Theme }) {
  const { bg, accent, radius, border, text } = theme.preview;
  // For "edge" the outer frame is square AND there's a thin black
  // border to make the sharp aesthetic legible at thumbnail size.
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 10',
        background: bg,
        border: border ?? `1px solid ${T.inkLine}`,
        borderRadius: Math.min(radius, 12),
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 18, height: 18, background: accent, borderRadius: Math.min(radius, 9) }} />
        <div style={{ flex: 1, height: 8, background: text === '#f4f4f4' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)', borderRadius: Math.min(radius, 4) }} />
      </div>
      {/* Two stacked rows of "chips" to communicate the corner shape */}
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ flex: 2, height: 14, background: text === '#f4f4f4' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', borderRadius: Math.min(radius, 7) }} />
        <div style={{ flex: 1, height: 14, background: accent, opacity: 0.85, borderRadius: Math.min(radius, 7) }} />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ flex: 1, height: 14, background: text === '#f4f4f4' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', borderRadius: Math.min(radius, 7) }} />
        <div style={{ flex: 2, height: 14, background: text === '#f4f4f4' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', borderRadius: Math.min(radius, 7) }} />
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  active,
  onSelect,
}: {
  theme: Theme;
  active: boolean;
  onSelect: (id: ThemeId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className="btn-zoom"
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: 12,
        borderRadius: 14,
        border: active ? `2px solid ${T.red}` : `1px solid ${T.inkLine}`,
        // Inset compensates for the +1px from the active border so cards don't
        // visibly shift size when toggling between active/inactive.
        margin: active ? 0 : 1,
        background: T.bone,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: active
          ? '0 6px 18px rgba(200,32,40,0.15), 0 0 0 4px rgba(200,32,40,0.08)'
          : '0 1px 2px rgba(0,0,0,0.05)',
        transition: 'box-shadow 180ms ease, border-color 180ms ease',
      }}
    >
      <ThemePreview theme={theme} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: T.charcoal, lineHeight: 1 }}>
          {theme.name}
        </span>
        {active && (
          <span style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.red }}>
            Active
          </span>
        )}
      </div>
      <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.muted, lineHeight: 1.4 }}>
        {theme.blurb}
      </span>
    </button>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

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

      <SectionLabel>Theme</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 28,
        }}
      >
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            active={theme === t.id}
            onSelect={setTheme}
          />
        ))}
      </div>

      <p style={{ fontSize: 11, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>
        Theme choice is remembered on this device only. More preferences coming soon.
      </p>
    </div>
  );
}
