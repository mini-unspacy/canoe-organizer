// Themed date + time pickers for the event editor.
//
// The native <input type="date"> and <input type="time"> pickers ignore
// `accent-color` for their popup UI (they only theme the control itself),
// so on desktop the popup renders in Chrome's default blue regardless of
// what CSS we set. These components swap in a custom popover on desktop
// (detected via `(hover: hover) and (pointer: fine)`) and fall through to
// the native inputs on mobile, which already look good because they defer
// to the OS picker.
//
// Values stay in the same string formats used everywhere else so no caller
// has to change: "YYYY-MM-DD" for dates, "HH:MM" (24-hour) for times.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ACCENT = '#005280';
const ACCENT_RING = 'rgba(0,82,128,0.14)';
const ACCENT_SOFT = 'rgba(0,82,128,0.10)';

const baseFieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 38,
  padding: '0 10px',
  backgroundColor: '#ffffff',
  border: '1px solid rgba(0,0,0,0.14)',
  borderRadius: 8,
  color: '#222',
  fontSize: 14,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  outline: 'none',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
  accentColor: ACCENT,
  colorScheme: 'light',
};

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const handler = () => setDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return desktop;
}

function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso: string): string {
  const d = parseDate(iso);
  if (!d) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function parseTime(value: string): { h24: number; minute: number } | null {
  if (!value) return null;
  const [hStr, mStr] = value.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return null;
  return { h24: h, minute: m };
}

function formatDisplayTime(value: string): string {
  const p = parseTime(value);
  if (!p) return '';
  const ampm = p.h24 >= 12 ? 'PM' : 'AM';
  const h12 = p.h24 % 12 === 0 ? 12 : p.h24 % 12;
  return `${h12}:${String(p.minute).padStart(2, '0')} ${ampm}`;
}

function clampPopoverLeft(left: number, width: number): number {
  if (typeof window === 'undefined') return left;
  const vw = window.innerWidth;
  const pad = 8;
  if (left + width > vw - pad) return Math.max(pad, vw - width - pad);
  if (left < pad) return pad;
  return left;
}

// ----- Chip button shared by both pickers ----------------------------------

function ChipButton({
  refCb, open, onClick, displayValue, placeholder, icon,
}: {
  refCb: (el: HTMLButtonElement | null) => void;
  open: boolean;
  onClick: () => void;
  displayValue: string;
  placeholder: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      ref={refCb}
      type="button"
      onClick={onClick}
      style={{
        ...baseFieldStyle,
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        color: displayValue ? '#222' : '#9a9a9a',
        borderColor: open ? ACCENT : 'rgba(0,0,0,0.14)',
        boxShadow: open ? `0 0 0 3px ${ACCENT_RING}` : 'none',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayValue || placeholder}
      </span>
      {icon}
    </button>
  );
}

// ----- Date input ----------------------------------------------------------

function DesktopDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = parseDate(value) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Close on outside click / viewport changes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Only close on resize — NOT on scroll. A capture-phase scroll listener
    // would fire whenever the user scrolls inside the popover's own columns
    // (hour / minute lists) and immediately close it, making the picker
    // unusable. Outer page scrolls are rare during editing and the portal
    // anchor tolerates a bit of drift; users can click outside to dismiss.
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const handleOpen = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setAnchor({ left: r.left, top: r.bottom });
    // Jump view to selected month when reopening.
    const d = parseDate(value) || new Date();
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setOpen(o => !o);
  };

  const selected = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build the 6-row calendar grid.
  const firstDow = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const prevMonthLast = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0).getDate();
  const cells: Array<{ date: Date; otherMonth: boolean }> = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({
      date: new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, prevMonthLast - i),
      otherMonth: true,
    });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ date: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i), otherMonth: false });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      otherMonth: true,
    });
    if (cells.length >= 42) break;
  }

  const popoverWidth = 272;
  const icon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  return (
    <>
      <ChipButton
        refCb={el => { (btnRef as React.MutableRefObject<HTMLButtonElement | null>).current = el; }}
        open={open}
        onClick={handleOpen}
        displayValue={formatDisplayDate(value)}
        placeholder="Select date"
        icon={icon}
      />
      {open && anchor && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Select date"
          style={{
            position: 'fixed',
            top: anchor.top + 6,
            left: clampPopoverLeft(anchor.left, popoverWidth),
            width: popoverWidth,
            zIndex: 300,
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            color: '#222',
          }}
        >
          {/* Month header with prev / next */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              aria-label="Previous month"
              style={monthNavButtonStyle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#484848" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6" /></svg>
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
              {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              aria-label="Next month"
              style={monthNavButtonStyle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#484848" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6" /></svg>
            </button>
          </div>
          {/* Weekday labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9a9a9a', letterSpacing: '0.08em' }}>
                {d}
              </div>
            ))}
          </div>
          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map(({ date: d, otherMonth }) => {
              const isSelected = !!selected && sameYMD(d, selected);
              const isToday = sameYMD(d, today);
              return (
                <button
                  key={toIso(d)}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(toIso(d));
                    setOpen(false);
                  }}
                  style={{
                    height: 32,
                    borderRadius: 6,
                    border: isToday && !isSelected ? `1px solid ${ACCENT}` : '1px solid transparent',
                    background: isSelected ? ACCENT : 'transparent',
                    color: isSelected ? '#ffffff' : otherMonth ? '#c8c8c8' : '#222',
                    fontWeight: isSelected ? 700 : isToday ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'background 100ms ease',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = ACCENT_SOFT; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {/* Footer actions */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={footerSecondaryButton}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date(); t.setHours(0, 0, 0, 0);
                onChange(toIso(t));
                setOpen(false);
              }}
              style={footerPrimaryButton}
            >
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function sameYMD(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const monthNavButtonStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6,
  border: '1px solid rgba(0,0,0,0.08)',
  background: '#fff', cursor: 'pointer', padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const footerSecondaryButton: React.CSSProperties = {
  flex: 1, height: 30, borderRadius: 6,
  border: '1px solid rgba(0,0,0,0.12)', background: '#fff',
  color: '#717171', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const footerPrimaryButton: React.CSSProperties = {
  flex: 1, height: 30, borderRadius: 6,
  border: 'none', background: ACCENT,
  color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

// ----- Time input ----------------------------------------------------------

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const AMPMS = ['AM', 'PM'] as const;

function DesktopTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // Only close on resize — NOT on scroll. A capture-phase scroll listener
    // would fire whenever the user scrolls inside the popover's own columns
    // (hour / minute lists) and immediately close it, making the picker
    // unusable. Outer page scrolls are rare during editing and the portal
    // anchor tolerates a bit of drift; users can click outside to dismiss.
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Scroll selected items into view when the popover opens.
  useEffect(() => {
    if (!open) return;
    const p = parseTime(value) ?? { h24: 6, minute: 0 };
    const hour12 = p.h24 % 12 === 0 ? 12 : p.h24 % 12;
    requestAnimationFrame(() => {
      const scrollToIdx = (col: HTMLDivElement | null, idx: number) => {
        if (!col) return;
        const child = col.children[idx] as HTMLElement | undefined;
        if (child) col.scrollTop = child.offsetTop - col.clientHeight / 2 + child.clientHeight / 2;
      };
      scrollToIdx(hourColRef.current, hour12 - 1);
      scrollToIdx(minColRef.current, p.minute);
    });
  }, [open, value]);

  const handleOpen = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setAnchor({ left: r.left, top: r.bottom });
    setOpen(o => !o);
  };

  const current = parseTime(value) ?? { h24: 6, minute: 0 };
  const currentH12 = current.h24 % 12 === 0 ? 12 : current.h24 % 12;
  const currentAmPm: 'AM' | 'PM' = current.h24 >= 12 ? 'PM' : 'AM';

  const setParts = (h12: number, m: number, ap: 'AM' | 'PM') => {
    let h24 = h12 === 12 ? 0 : h12;
    if (ap === 'PM') h24 += 12;
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const popoverWidth = 240;
  const icon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );

  const renderColumn = (
    items: readonly (number | string)[],
    isSelected: (item: number | string) => boolean,
    onPick: (item: number | string) => void,
    format: (item: number | string) => string,
    ref?: React.RefObject<HTMLDivElement | null>,
    flex?: number,
  ) => (
    <div
      ref={ref}
      style={{
        flex: flex ?? 1,
        height: 180,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        scrollbarWidth: 'thin',
        padding: '4px 2px',
      }}
    >
      {items.map(item => {
        const sel = isSelected(item);
        return (
          <button
            key={String(item)}
            type="button"
            onClick={() => onPick(item)}
            style={{
              height: 32,
              flexShrink: 0,
              border: 'none',
              borderRadius: 6,
              background: sel ? ACCENT : 'transparent',
              color: sel ? '#fff' : '#222',
              fontWeight: sel ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
              margin: '1px 0',
              transition: 'background 80ms ease',
            }}
            onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = ACCENT_SOFT; }}
            onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
          >
            {format(item)}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <ChipButton
        refCb={el => { (btnRef as React.MutableRefObject<HTMLButtonElement | null>).current = el; }}
        open={open}
        onClick={handleOpen}
        displayValue={formatDisplayTime(value)}
        placeholder="Select time"
        icon={icon}
      />
      {open && anchor && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Select time"
          style={{
            position: 'fixed',
            top: anchor.top + 6,
            left: clampPopoverLeft(anchor.left, popoverWidth),
            width: popoverWidth,
            zIndex: 300,
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            color: '#222',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {renderColumn(
              HOURS_12,
              (h) => h === currentH12,
              (h) => setParts(h as number, current.minute, currentAmPm),
              (h) => String(h).padStart(2, '0'),
              hourColRef,
            )}
            {renderColumn(
              MINUTES,
              (m) => m === current.minute,
              (m) => setParts(currentH12, m as number, currentAmPm),
              (m) => String(m).padStart(2, '0'),
              minColRef,
            )}
            {renderColumn(
              AMPMS,
              (ap) => ap === currentAmPm,
              (ap) => setParts(currentH12, current.minute, ap as 'AM' | 'PM'),
              (ap) => String(ap),
              undefined,
              0.8,
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ ...footerPrimaryButton, flex: 'none', padding: '0 14px' }}
            >
              Done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ----- Public API ----------------------------------------------------------

export function applyFocusRing(e: React.FocusEvent<HTMLInputElement>, focused: boolean) {
  e.currentTarget.style.borderColor = focused ? ACCENT : 'rgba(0,0,0,0.14)';
  e.currentTarget.style.boxShadow = focused ? `0 0 0 3px ${ACCENT_RING}` : 'none';
}

export const themedFieldStyle = baseFieldStyle;

export function ThemedDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const desktop = useIsDesktop();
  if (desktop) return <DesktopDateInput value={value} onChange={onChange} />;
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={e => applyFocusRing(e, true)}
      onBlur={e => applyFocusRing(e, false)}
      style={baseFieldStyle}
    />
  );
}

export function ThemedTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const desktop = useIsDesktop();
  if (desktop) return <DesktopTimeInput value={value} onChange={onChange} />;
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={e => applyFocusRing(e, true)}
      onBlur={e => applyFocusRing(e, false)}
      style={baseFieldStyle}
    />
  );
}
