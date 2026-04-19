// CanoeViewPicker — 4-way toggle matching the Lokahi mock's Fleet section
// control. Lets the user switch between "1" (one canoe per row), "list"
// (auto-fit grid, the default), "2" (two per row), and "4" (2x2 grid with
// pagination). Active segment fills with the club red and inverts its icon
// to white; inactive segments are transparent with charcoal icons.

export type CanoeView = '1' | 'list' | '2' | '4';

export const CANOE_VIEW_VALUES: CanoeView[] = ['1', 'list', '2', '4'];

const RED = '#b91c1c';
const CHARCOAL = '#2a2a2a';
const INK_LINE = 'rgba(0,0,0,0.12)';

function ViewIcon({ value, active }: { value: CanoeView; active: boolean }) {
  const c = active ? '#ffffff' : CHARCOAL;
  if (value === 'list') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="1.5" y="2"   width="9" height="1.6" rx="0.4" fill={c} />
        <rect x="1.5" y="5.2" width="9" height="1.6" rx="0.4" fill={c} />
        <rect x="1.5" y="8.4" width="9" height="1.6" rx="0.4" fill={c} />
      </svg>
    );
  }
  if (value === '1') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="1.5" y="1.5" width="9" height="9" rx="1.2" fill={c} />
      </svg>
    );
  }
  if (value === '2') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="1.5" y="1.5" width="4" height="9" rx="1" fill={c} />
        <rect x="6.5" y="1.5" width="4" height="9" rx="1" fill={c} />
      </svg>
    );
  }
  // '4' — 2x2 grid
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1.5" y="1.5" width="4" height="4" rx="0.8" fill={c} />
      <rect x="6.5" y="1.5" width="4" height="4" rx="0.8" fill={c} />
      <rect x="1.5" y="6.5" width="4" height="4" rx="0.8" fill={c} />
      <rect x="6.5" y="6.5" width="4" height="4" rx="0.8" fill={c} />
    </svg>
  );
}

export const CanoeViewPicker: React.FC<{
  value: CanoeView;
  onChange: (v: CanoeView) => void;
}> = ({ value, onChange }) => {
  return (
    <div
      role="tablist"
      aria-label="Canoe view"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        height: 24,
        background: '#ffffff',
        border: `1px solid ${INK_LINE}`,
        borderRadius: 7,
      }}
    >
      {CANOE_VIEW_VALUES.map(v => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-label={`canoes ${v}`}
            aria-selected={active}
            onClick={() => onChange(v)}
            style={{
              width: 22,
              height: 20,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 5,
              background: active ? RED : 'transparent',
              cursor: 'pointer',
              transition: 'background 120ms ease',
            }}
          >
            <ViewIcon value={v} active={active} />
          </button>
        );
      })}
    </div>
  );
};
