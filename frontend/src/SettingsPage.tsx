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

// Hardcoded per-theme preview. Each card paints itself based on its
// theme.id so the preview is what the theme would look like — NOT
// what the currently-active theme looks like. We deliberately do NOT
// rely on the live `data-theme` CSS rules here, because those rules
// cascade from <html> downward and an attribute selector on a deeper
// wrapper has the same specificity as the html-level one — so under
// e.g. a globally-active "Edge" theme, every preview card would also
// get edge corners no matter what data-theme it tried to advertise.
//
// The mapping below mirrors what each theme's index.css block does
// to the real app:
//   • lokahi   → soft 10px rounding, light cream canvas, white inner
//   • edge     → 0px rounding everywhere
//   • pillow   → max-pill on the chip/button, normal corners on cards
//   • midnight → dark canvas, dark inner card, light text
function previewLook(id: Theme['id']) {
  switch (id) {
    case 'edge':
      return {
        outerRadius: 0,
        innerRadius: 0,
        chipRadius: 0,
        barRadius: 0,
        canvas: '#ffffff',
        surface: '#ffffff',
        border: '1px solid #1a1a1a',
        text: '#111111',
        muted: 'rgba(0,0,0,0.10)',
        subtle: 'rgba(0,0,0,0.18)',
      };
    case 'pillow':
      return {
        outerRadius: 10,
        innerRadius: 10,
        chipRadius: 9999,
        barRadius: 9999,
        canvas: '#faf9f7',
        surface: '#ffffff',
        border: `1px solid ${T.inkLine}`,
        text: '#222222',
        muted: 'rgba(0,0,0,0.07)',
        subtle: 'rgba(0,0,0,0.14)',
      };
    case 'midnight':
      return {
        outerRadius: 10,
        innerRadius: 10,
        chipRadius: 8,
        barRadius: 4,
        canvas: '#14171c',
        surface: '#232730',
        border: '1px solid rgba(255,255,255,0.10)',
        text: '#e8e8e8',
        muted: 'rgba(255,255,255,0.10)',
        subtle: 'rgba(255,255,255,0.20)',
      };
    case 'lokahi':
    default:
      return {
        outerRadius: 10,
        innerRadius: 10,
        chipRadius: 8,
        barRadius: 4,
        canvas: '#faf9f7',
        surface: '#ffffff',
        border: `1px solid ${T.inkLine}`,
        text: '#222222',
        muted: 'rgba(0,0,0,0.07)',
        subtle: 'rgba(0,0,0,0.14)',
      };
  }
}

function ThemePreview({ theme }: { theme: Theme }) {
  const { accent } = theme.preview;
  const look = previewLook(theme.id);
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 11',
        background: look.canvas,
        border: look.border,
        borderRadius: look.outerRadius,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxSizing: 'border-box',
        overflow: 'hidden',
        color: look.text,
      }}
    >
      {/* Top bar: accent dot + a "title" line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 18,
          height: 18,
          background: accent,
          borderRadius: theme.id === 'edge' ? 0 : 9,
        }} />
        <div style={{ flex: 1, height: 6, background: look.subtle, borderRadius: look.barRadius }} />
      </div>
      {/* Card surface */}
      <div
        style={{
          background: look.surface,
          borderRadius: look.innerRadius,
          padding: 7,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          flex: 1,
          boxShadow: theme.id === 'midnight'
            ? '0 1px 2px rgba(0,0,0,0.4)'
            : theme.id === 'edge'
              ? 'none'
              : '0 1px 2px rgba(0,0,0,0.06)',
          color: look.text,
          border: theme.id === 'edge' ? '1px solid #1a1a1a' : 'none',
        }}
      >
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 8, background: look.subtle, borderRadius: look.barRadius }} />
          {/* Pill / chip — chipRadius captures Edge (0), Pillow (9999), and the rest (8). */}
          <div
            style={{
              padding: '0 8px',
              height: 16,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: accent,
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              borderRadius: look.chipRadius,
              lineHeight: 1,
              letterSpacing: '0.04em',
            }}
          >
            GO
          </div>
        </div>
        <div style={{ height: 8, background: look.muted, borderRadius: look.barRadius }} />
        <div style={{ height: 8, width: '70%', background: look.muted, borderRadius: look.barRadius }} />
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
