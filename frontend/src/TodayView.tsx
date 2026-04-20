import { useState, useRef, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { CanoeViewPicker, type CanoeView } from "./components/CanoeViewPicker";
import type { Paddler, Canoe, CanoeSortItem } from "./types";
import { CANOE_DESIGNATIONS, CANOE_NAME_BY_DESIGNATION } from "./utils";
import { pickFreshCanoeName } from "./canoeNames";
import { PaddlerChip, SEAT_CHIP_DIMS, SEAT_CHIP_DIMS_COMPACT } from "./PaddlerChip";

// localStorage key used to persist the user's Fleet section view preference
// across sessions. Matches the Lokahi mock's canoeView state.
const CANOE_VIEW_LS_KEY = 'lokahi.canoeView';

const loadCanoeView = (): CanoeView => {
  if (typeof window === 'undefined') return '1';
  try {
    const v = window.localStorage.getItem(CANOE_VIEW_LS_KEY);
    if (v === '1' || v === '2' || v === '4') return v;
  } catch {}
  return '1';
};

interface SelectedEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  eventType?: string;
}

interface TodayViewProps {
  selectedEvent: SelectedEvent | null;
  isAdmin: boolean;
  sidebarOpen: boolean;
  canoes: Canoe[] | undefined;
  paddlers: Paddler[] | undefined;
  canoeSortedPaddlers: Paddler[];
  canoeAssignmentsByCanoe: Map<string, { seat: number; paddlerId: string }[]>;
  eventAssignments: any[] | undefined;
  eventAttendingPaddlerIds: Set<string> | null;
  eventGuests: any[] | undefined;
  guestPaddlerMap: Map<string, Paddler>;
  lockedCanoes: Set<string>;
  setLockedCanoes: React.Dispatch<React.SetStateAction<Set<string>>>;
  canoeDesignations: Record<string, string>;
  updateDesignationMut: (args: { canoeId: string; designation: string }) => void;
  renameCanoeMut: (args: { canoeId: string; name: string }) => void;
  animationKey: number;
  boatWidth: number;
  canoeRowHeight: number;
  canoeMargin: number;
  currentUser: { email: string; role: string; paddlerId: string };
  selectedPaddlerId: string | null;
  /** Live window width — used to hide grid-view chrome only when the
   *  viewport is too narrow to fit it without overlap. */
  windowWidth: number;
  showAllBoats: boolean;
  setShowAllBoats: (v: boolean) => void;
  showGoingList: boolean;
  setShowGoingList: (v: boolean) => void;
  handleToggleAttendance: (paddlerId: string, eventId: string) => void;
  removeGuestMut: (args: { guestId: any }) => Promise<any>;
  addGuestMut: (args: { eventId: string; name: string }) => Promise<any>;
  handleAssign: () => void;
  handleUnassignAll: () => void;
  handleReassignCanoes: () => void;
  handleRemoveCanoe: (canoeId: string) => void;
  handleAddCanoeAfter: (index: number) => void;
  addCanoe: (args: { name: string }) => void;
  triggerAnimation: () => void;
  canoePriority: CanoeSortItem[];
  setCanoePriority: (p: CanoeSortItem[]) => void;
  setScrollToEventId: (id: string | null) => void;
  setActivePage: (page: 'today' | 'roster' | 'schedule' | 'attendance' | 'crews') => void;
}

export function TodayView({
  selectedEvent, isAdmin, canoes, paddlers, canoeSortedPaddlers,
  canoeAssignmentsByCanoe, eventAttendingPaddlerIds, eventGuests,
  guestPaddlerMap, lockedCanoes, setLockedCanoes,
  canoeDesignations, updateDesignationMut, renameCanoeMut, animationKey,
  selectedPaddlerId,
  showGoingList, setShowGoingList, handleToggleAttendance, removeGuestMut, addGuestMut,
  handleAssign, handleUnassignAll, handleReassignCanoes,
  handleRemoveCanoe, handleAddCanoeAfter, triggerAnimation,
  canoePriority, setCanoePriority, setScrollToEventId, setActivePage,
  windowWidth,
}: TodayViewProps) {
  const [openDesignator, setOpenDesignator] = useState<string | null>(null);
  const [sortPillOpen, setSortPillOpen] = useState(false);
  const [tempPriority, setTempPriority] = useState<CanoeSortItem[]>(canoePriority);
  const sortPillRef = useRef<HTMLDivElement>(null);
  // Fleet section view: '1' | '2' | '4'. All modes render every canoe in a
  // fixed-column grid; the page scrolls vertically when they overflow.
  const [canoeView, setCanoeView] = useState<CanoeView>(() => loadCanoeView());
  useEffect(() => {
    try { window.localStorage.setItem(CANOE_VIEW_LS_KEY, canoeView); } catch {}
  }, [canoeView]);

  // In 4-col grid view each canoe card is super narrow; the lock + X
  // buttons collide with the canoe name below this width. Keep them on
  // desktop-small and wider tablets — they only vanish at true iPhone
  // widths where the card is too tight to fit them.
  const GRID_CHROME_MIN_W = 440;
  const showCanoeChrome = canoeView !== '4' || windowWidth >= GRID_CHROME_MIN_W;

  // Going-menu scroll state — drives the top/bottom fade overlays AND a
  // custom right-side thumb indicator that hints at "there's more above/
  // below, scroll to see it". `thumbTop` + `thumbHeight` are expressed as
  // fractions of the visible track so the thumb reflects both the list's
  // length relative to the menu AND the current scroll position.
  // Recomputed when the menu opens, when the attendee list changes, and
  // on every scroll.
  const goingScrollRef = useRef<HTMLDivElement>(null);
  const [goingScroll, setGoingScroll] = useState<{
    atTop: boolean;
    atBottom: boolean;
    scrollable: boolean;
    thumbTop: number;    // 0..1 fraction of track
    thumbHeight: number; // 0..1 fraction of track
  }>({ atTop: true, atBottom: true, scrollable: false, thumbTop: 0, thumbHeight: 1 });
  const recomputeGoingScroll = useCallback(() => {
    const el = goingScrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight > el.clientHeight + 1;
    // Thumb height = fraction of content that fits in the menu, clamped
    // to a readable minimum so the pill doesn't disappear for very long
    // lists. Thumb top = fraction of the remaining track the user has
    // scrolled past.
    const rawThumbH = scrollable ? el.clientHeight / el.scrollHeight : 1;
    const thumbHeight = Math.max(0.12, Math.min(1, rawThumbH));
    const scrollRange = Math.max(1, el.scrollHeight - el.clientHeight);
    const thumbTop = scrollable
      ? (el.scrollTop / scrollRange) * (1 - thumbHeight)
      : 0;
    setGoingScroll({
      atTop: el.scrollTop <= 4,
      atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 4,
      scrollable,
      thumbTop,
      thumbHeight,
    });
  }, []);
  useEffect(() => {
    if (!showGoingList) return;
    const raf = requestAnimationFrame(recomputeGoingScroll);
    window.addEventListener("resize", recomputeGoingScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", recomputeGoingScroll);
    };
    // Recompute whenever the set of paddlers/guests that feeds the list changes.
  }, [showGoingList, paddlers, eventGuests, eventAttendingPaddlerIds, recomputeGoingScroll]);

  // Going-menu inline add UI state — tapping the "+" button opens a small
  // popover with "Paddler" / "Guest" choices; selecting one sets
  // `addingType`, which swaps in the search panel or guest-name input.
  const [addingType, setAddingType] = useState<null | 'paddler' | 'guest'>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [guestName, setGuestName] = useState('');
  const addPaddlerInputRef = useRef<HTMLInputElement>(null);
  const addGuestInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  // Focus the relevant input when the picker opens.
  useEffect(() => {
    if (addingType === 'paddler') addPaddlerInputRef.current?.focus();
    if (addingType === 'guest') addGuestInputRef.current?.focus();
  }, [addingType]);
  // Close the add-type popover on click outside.
  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addMenuOpen]);
  // Reset the inline add UI whenever the menu itself closes.
  useEffect(() => {
    if (!showGoingList) {
      setAddingType(null);
      setAddMenuOpen(false);
      setAddQuery('');
      setGuestName('');
    }
  }, [showGoingList]);

  return (
    <>
    {/* Header — no-event fallback */}
    {!selectedEvent && (
      <div className="py-1" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
        <span style={{ fontSize: '14px', color: '#717171', fontWeight: 500 }}>{(() => {
          const now = new Date();
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          return `${dayNames[now.getDay()]} ${now.getMonth() + 1}/${now.getDate()} ---`;
        })()}</span>
      </div>
    )}

    {selectedEvent && (() => {
      const _d = new Date(selectedEvent.date + 'T00:00:00');
      const _dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const _monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const _dayName = _dayNames[_d.getDay()];
      const _monthName = _monthNames[_d.getMonth()];
      const _dayNum = _d.getDate();
      const _isAttending = selectedPaddlerId && eventAttendingPaddlerIds ? eventAttendingPaddlerIds.has(selectedPaddlerId) : false;
      const _goingPaddlers = eventAttendingPaddlerIds && paddlers ? paddlers.filter((p: Paddler) => eventAttendingPaddlerIds.has(p.id)).length : 0;
      const _guestCount = eventGuests?.length || 0;
      const _goingCount = _goingPaddlers + _guestCount;
      const _typeLabel: { text: string; color: string; bg: string } | null =
        selectedEvent.eventType === 'race'
          ? { text: 'RACE', color: '#b8181e', bg: 'rgba(200,32,40,0.2)' }
          : selectedEvent.eventType === 'practice'
          ? { text: 'PRACTICE', color: '#2e6b80', bg: 'rgba(46,107,128,0.18)' }
          : selectedEvent.eventType === 'other'
          ? { text: 'OTHER', color: '#6b6558', bg: 'rgba(107,101,88,0.18)' }
          : null;
      return (
    <div style={{ width: '100%', maxWidth: '600px', margin: '10px auto 0', padding: '0 4px', boxSizing: 'border-box' }}>
      {/* Event info card — serif title + stacked date stamp, matches the mock */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '18px 20px 14px', marginBottom: '12px', boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.04), 0 8px 20px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', alignItems: 'flex-start' }}>
        <div
          onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }}
          style={{ width: '56px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', paddingTop: '2px' }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#717171', letterSpacing: '1.4px', lineHeight: 1 }}>{_dayName}</div>
          <div style={{
            fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
            fontSize: '40px', fontWeight: 600, color: '#222222', lineHeight: 1, marginTop: '2px',
          }}>{_dayNum}</div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#717171', letterSpacing: '1.4px', lineHeight: 1, marginTop: '2px' }}>{_monthName}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'visible', marginTop: '0px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {selectedPaddlerId && (
              <div
                role="switch"
                aria-checked={_isAttending}
                aria-label={_isAttending ? 'Going — tap to mark not going' : 'Not going — tap to mark going'}
                onClick={(e) => { e.stopPropagation(); handleToggleAttendance(selectedPaddlerId, selectedEvent.id); }}
                style={{
                  position: 'relative',
                  width: 36, height: 20, borderRadius: 999, flexShrink: 0,
                  display: 'inline-block',
                  cursor: 'pointer', userSelect: 'none',
                  background: _isAttending ? '#2f7a47' : '#d6d1c8',
                  transition: 'background 180ms ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: _isAttending ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                    transition: 'left 180ms ease',
                  }}
                />
              </div>
            )}
            {_typeLabel && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.15em',
                color: _typeLabel.color, background: _typeLabel.bg,
                padding: '3px 6px', borderRadius: 3, flexShrink: 0,
              }}>{_typeLabel.text}</span>
            )}
            <div style={{
              fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
              fontSize: '24px', color: '#222222', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.15,
              minWidth: 0, flex: 1,
            }}>
              <span onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }} style={{ cursor: 'pointer' }}>
                {selectedEvent.title}
              </span>
            </div>
          </div>
          {/* Location / time row with the going pill tucked to the right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '4px' }}>
            <div style={{ fontSize: '13px', color: '#717171', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span>{selectedEvent.time}</span>
              <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
              <span>{selectedEvent.location}</span>
            </div>
            <div style={{ flex: 1 }} />
            <div
              onClick={(e) => { e.stopPropagation(); setShowGoingList(!showGoingList); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '999px',
                background: '#faf9f7', border: '1px solid rgba(0,0,0,.08)',
                cursor: 'pointer', userSelect: 'none', flexShrink: 0,
              }}
            >
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#5a8a5f', boxShadow: '0 0 0 2px rgba(90,138,95,0.22)',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '12px', color: '#222222', fontWeight: 600 }}>
                {_goingCount} going
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      {/* Expanded attendee list — dropdown anchored below the header card.
          Sized to a fraction of the viewport so long rosters don't push the
          canoes off-screen, and with top/bottom fade overlays that hint at
          "there's more to scroll". Each row is tap-to-remove. */}
      <div style={{ position: 'relative', marginBottom: showGoingList ? '10px' : '0' }}>
        {showGoingList && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.08)', borderRadius: '12px',
              zIndex: 100,
              boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.12)',
              display: 'flex', flexDirection: 'column',
              // Cap the menu at a viewport-relative height so a long roster
              // never pushes the canoes off the screen. 55vh leaves room
              // for the event header above and some of the fleet below.
              maxHeight: 'min(55vh, 480px)',
              overflow: 'hidden',
            }}
          >
            {/* Header — count breakdown, with a single "+" button on the
                right that opens a popover offering "Paddler" / "Guest".
                This keeps the header compact on narrow viewports while
                still giving both adds a clear tap target in the popover. */}
            <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#222', letterSpacing: '0.08em', flexShrink: 0 }}>
                GOING
              </span>
              <span style={{ fontSize: '11px', color: '#717171', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {_goingPaddlers} paddler{_goingPaddlers === 1 ? '' : 's'}
                {_guestCount > 0 ? ` + ${_guestCount} guest${_guestCount === 1 ? '' : 's'}` : ''}
              </span>
              <div style={{ flex: 1 }} />
              {isAdmin && selectedEvent && (
                <div ref={addMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (addingType) { setAddingType(null); return; }
                      setAddMenuOpen(v => !v);
                    }}
                    aria-label="Add paddler or guest"
                    aria-expanded={addMenuOpen || !!addingType}
                    style={{
                      width: 32, height: 32,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                      fontSize: 20, fontWeight: 700, lineHeight: 1,
                      color: (addMenuOpen || addingType) ? '#fff' : '#005280',
                      background: (addMenuOpen || addingType) ? '#005280' : '#ffffff',
                      border: `1px solid ${(addMenuOpen || addingType) ? '#005280' : 'rgba(0,82,128,0.45)'}`,
                      borderRadius: 8, cursor: 'pointer',
                      boxShadow: (addMenuOpen || addingType) ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'transform 120ms ease, background 120ms ease, color 120ms ease',
                      transform: addingType ? 'rotate(45deg)' : 'none',
                    }}
                  >
                    +
                  </button>
                  {addMenuOpen && (
                    <div
                      role="menu"
                      style={{
                        position: 'absolute', right: 0, top: '100%',
                        marginTop: 6,
                        zIndex: 110,
                        minWidth: 140,
                        background: '#ffffff',
                        border: '1px solid rgba(0,0,0,.08)',
                        borderRadius: 10,
                        padding: 4,
                        boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 6px 16px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.12)',
                      }}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setAddingType('paddler'); setAddMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '8px 10px',
                          border: 'none', borderRadius: 6,
                          background: 'transparent',
                          color: '#005280',
                          fontSize: 13, fontWeight: 600, textAlign: 'left',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,82,128,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#005280' }} />
                        Paddler
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setAddingType('guest'); setAddMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '8px 10px',
                          border: 'none', borderRadius: 6,
                          background: 'transparent',
                          color: '#a07838',
                          fontSize: 13, fontWeight: 600, textAlign: 'left',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(160,120,56,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a07838' }} />
                        Guest
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Inline add picker — paddler search (filters roster to not-yet-
                attending, tap to toggle them on) or guest name input
                (Enter to add). Swapped in below the header, above the list. */}
            {isAdmin && selectedEvent && addingType === 'paddler' && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,.06)', background: '#faf9f7' }}>
                <input
                  ref={addPaddlerInputRef}
                  type="text"
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="Search roster…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '6px 10px', fontSize: 13,
                    border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6,
                    outline: 'none', background: '#fff',
                  }}
                />
                <div style={{ maxHeight: 160, overflowY: 'auto', overflowX: 'hidden', marginTop: 6 }} className="scrollbar-hidden">
                  {(paddlers || [])
                    .filter((p: Paddler) => !eventAttendingPaddlerIds?.has(p.id))
                    .filter((p: Paddler) => {
                      const q = addQuery.trim().toLowerCase();
                      if (!q) return true;
                      const full = `${p.firstName} ${p.lastName || p.lastInitial || ''}`.toLowerCase();
                      return full.includes(q);
                    })
                    .sort((a: Paddler, b: Paddler) => a.firstName.localeCompare(b.firstName))
                    .slice(0, 40)
                    .map((p: Paddler) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', boxSizing: 'border-box', textAlign: 'left',
                          padding: '3px 4px 3px 8px',
                          borderRadius: 6,
                          background: 'transparent', color: '#222',
                          fontSize: 13, fontWeight: 500,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.gender === 'wahine' ? '#a81a22' : '#1f4e5e', flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.firstName} {p.lastName || p.lastInitial}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add ${p.firstName}`}
                          onClick={() => { handleToggleAttendance(p.id, selectedEvent.id); setAddQuery(''); }}
                          style={{
                            flexShrink: 0,
                            width: 24, height: 24,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                            border: '1px solid rgba(0,82,128,0.45)',
                            borderRadius: 6,
                            background: '#ffffff',
                            color: '#005280',
                            fontSize: 15, fontWeight: 700, lineHeight: 1,
                            cursor: 'pointer',
                            transition: 'background 120ms ease, color 120ms ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#005280'; e.currentTarget.style.color = '#ffffff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#005280'; }}
                        >
                          +
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {isAdmin && selectedEvent && addingType === 'guest' && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,.06)', background: '#faf9f7' }}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = guestName.trim();
                    if (!name) return;
                    void addGuestMut({ eventId: selectedEvent.id, name });
                    setGuestName('');
                  }}
                  style={{ display: 'flex', gap: 6 }}
                >
                  <input
                    ref={addGuestInputRef}
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Guest name…"
                    style={{
                      flex: 1, boxSizing: 'border-box',
                      padding: '6px 10px', fontSize: 13,
                      border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6,
                      outline: 'none', background: '#fff',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!guestName.trim()}
                    style={{
                      height: 30, padding: '0 12px',
                      fontSize: 12, fontWeight: 600,
                      color: '#fff',
                      background: guestName.trim() ? '#a07838' : '#d6d1c8',
                      border: 'none', borderRadius: 6,
                      cursor: guestName.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Add
                  </button>
                </form>
              </div>
            )}
            {_goingCount === 0 ? (
              <div style={{ fontSize: '14px', color: '#717171', padding: '14px 16px' }}>No one yet</div>
            ) : (
              <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div
                  ref={goingScrollRef}
                  onScroll={recomputeGoingScroll}
                  className="scrollbar-hidden"
                  style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 8px' }}
                >
                  {paddlers
                    ?.filter((p: Paddler) => eventAttendingPaddlerIds!.has(p.id))
                    .sort((a: Paddler, b: Paddler) => a.firstName.localeCompare(b.firstName))
                    .map((p: Paddler) => {
                      const isWahine = p.gender === 'wahine';
                      const isKane = p.gender === 'kane';
                      const dotColor = isWahine ? '#a81a22' : isKane ? '#1f4e5e' : '#8a8a8a';
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', boxSizing: 'border-box', textAlign: 'left',
                            padding: '4px 4px 4px 10px',
                            borderRadius: 8,
                            background: 'transparent',
                            color: '#222',
                            fontSize: 13, fontWeight: 500,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.firstName} {p.lastName || p.lastInitial}
                          </span>
                          {isAdmin && selectedEvent && (
                            <button
                              type="button"
                              aria-label={`Remove ${p.firstName}`}
                              onClick={() => handleToggleAttendance(p.id, selectedEvent.id)}
                              style={{
                                flexShrink: 0,
                                width: 24, height: 24,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0,
                                border: '1px solid rgba(0,0,0,0.12)',
                                borderRadius: 6,
                                background: '#ffffff',
                                color: '#717171',
                                fontSize: 14, lineHeight: 1,
                                cursor: 'pointer',
                                transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(200,32,40,0.10)'; e.currentTarget.style.borderColor = 'rgba(200,32,40,0.45)'; e.currentTarget.style.color = '#c82028'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.color = '#717171'; }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  {eventGuests && eventGuests.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', margin: '6px 2px 4px', paddingTop: '6px', fontSize: '10px', color: '#a07838', fontWeight: 700, letterSpacing: '0.1em' }}>
                      GUESTS ({_guestCount})
                    </div>
                  )}
                  {eventGuests && eventGuests.length > 0 && eventGuests.map((g: any) => (
                    <div
                      key={g._id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', boxSizing: 'border-box', textAlign: 'left',
                        padding: '4px 4px 4px 10px',
                        borderRadius: 8,
                        background: 'transparent',
                        color: '#a07838',
                        fontSize: 13, fontWeight: 500,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a07838', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.name}
                        <span style={{ marginLeft: 6, fontSize: '10px', opacity: 0.7 }}>guest</span>
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          aria-label={`Remove ${g.name}`}
                          onClick={() => { void removeGuestMut({ guestId: g._id }); }}
                          style={{
                            flexShrink: 0,
                            width: 24, height: 24,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                            border: '1px solid rgba(0,0,0,0.12)',
                            borderRadius: 6,
                            background: '#ffffff',
                            color: '#717171',
                            fontSize: 14, lineHeight: 1,
                            cursor: 'pointer',
                            transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(160,120,56,0.15)'; e.currentTarget.style.borderColor = 'rgba(160,120,56,0.5)'; e.currentTarget.style.color = '#a07838'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.color = '#717171'; }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {/* Top fade — shown when the list is scrolled down from its
                    start, to hint that there's more above. */}
                {goingScroll.scrollable && !goingScroll.atTop && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18, pointerEvents: 'none', background: 'linear-gradient(to bottom, #ffffff, rgba(255,255,255,0))' }} />
                )}
                {/* Bottom fade — shown when there's more below the fold. */}
                {goingScroll.scrollable && !goingScroll.atBottom && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 22, pointerEvents: 'none', background: 'linear-gradient(to top, #ffffff, rgba(255,255,255,0))' }} />
                )}
                {/* Custom scroll-track + thumb on the right edge. Only
                    rendered when the list actually overflows the menu so
                    it doesn't add visual noise for short rosters. The
                    thumb reflects both the content-to-menu ratio (via
                    height) and the user's current position (via top). */}
                {goingScroll.scrollable && (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 6, bottom: 6, right: 3,
                      width: 4,
                      pointerEvents: 'none',
                    }}
                  >
                    {/* Faint track so users see the full scrollable range,
                        not just the thumb. */}
                    <div
                      style={{
                        position: 'absolute', inset: 0,
                        borderRadius: 2,
                        background: 'rgba(0,0,0,0.06)',
                      }}
                    />
                    {/* Thumb — sized/positioned in fractions of the track. */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0, right: 0,
                        top: `${goingScroll.thumbTop * 100}%`,
                        height: `${goingScroll.thumbHeight * 100}%`,
                        borderRadius: 2,
                        background: 'rgba(0,82,128,0.45)',
                        transition: 'top 80ms ease',
                      }}
                    />
                  </div>
                )}
                {/* "More below" chevron pill — appears at bottom-center when
                    there's additional content past the fold, giving a
                    clear "scroll down" affordance on top of the fade. */}
                {goingScroll.scrollable && !goingScroll.atBottom && (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      bottom: 6, left: '50%',
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none',
                      display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(0,82,128,0.12)',
                      color: '#005280',
                      fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>more</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Admin action bar — Auto / Clear / + Canoe / Sort. Non-admins see
          the same fleet view below but with no editing controls, so we
          simply skip this whole strip for them. */}
      {isAdmin && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0', marginBottom: '0', flexWrap: 'nowrap', overflowX: 'auto' }}>
          {/* Mock-style outlined-pill action bar: Auto / Clear / + Canoe / Sort,
              roughly matching the Lokahi mock's Today toolbar (with Sort By kept
              as a fourth pill since the feature is useful). */}
          <button
            type="button"
            onClick={() => { triggerAnimation(); handleAssign(); }}
            title="Auto-assign paddlers to seats"
            style={{
              height: 32, padding: '0 12px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#484848',
              background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5M4 20l17-17M4 4l5 5M15 15l6 6M21 16v5h-5" />
            </svg>
            Auto
          </button>
          <button
            type="button"
            onClick={() => { triggerAnimation(); handleUnassignAll(); }}
            title="Clear all assignments"
            style={{
              height: 32, padding: '0 12px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#484848',
              background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
            Clear
          </button>
          <div ref={sortPillRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => { setTempPriority(canoePriority); setSortPillOpen(!sortPillOpen); }}
              title="Change sort priority"
              style={{
                height: 32, padding: '0 12px',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: '#484848',
                background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h14M20 17h0" />
                <circle cx="16" cy="7" r="2" fill="currentColor" />
                <circle cx="10" cy="12" r="2" fill="currentColor" />
              </svg>
              Sort: {(() => {
                const top = canoePriority[0];
                const label = top
                  ? ({ ability: 'Ability', gender: 'Gender', type: 'Racer?', seatPreference: 'Seat' } as Record<string, string>)[top.id]
                  : 'Default';
                return label || 'Default';
              })()}
            </button>
            {sortPillOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.12)', zIndex: 40, overflow: 'hidden', minWidth: '160px', padding: '8px' }}>
                <DragDropContext onDragEnd={(result) => {
                  if (!result.destination) return;
                  const newPriority = Array.from(tempPriority);
                  const [reorderedItem] = newPriority.splice(result.source.index, 1);
                  newPriority.splice(result.destination.index, 0, reorderedItem);
                  setTempPriority(newPriority);
                }}>
                <Droppable droppableId="canoe-priority" direction="vertical">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {tempPriority.map((item, index) => (
                        <Draggable key={item.id} draggableId={`canoe-${item.id}`} index={index} shouldRespectForcePress={false}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                touchAction: 'none',
                                padding: '8px 12px',
                                backgroundColor: snapshot.isDragging ? 'rgba(0,82,128,0.08)' : '#faf9f7',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#484848',
                                cursor: 'grab',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <span style={{ color: '#b0b0b0', fontSize: '11px' }}>{index + 1}.</span>
                              {{ ability: 'ability', gender: 'gender', type: 'racer?', seatPreference: 'seat' }[item.id]}
                              <span style={{ marginLeft: 'auto', color: '#b0b0b0', fontSize: '11px' }}>⠿</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                </DragDropContext>
                <div
                  onClick={() => { setCanoePriority(tempPriority); setSortPillOpen(false); handleReassignCanoes(); }}
                  style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#005280', color: '#ffffff', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textAlign: 'center', cursor: 'pointer', transition: 'opacity 0.15s' }}
                >
                  apply
                </div>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
      </div>
      )}
      </div>{/* end event info card */}
      {/* FLEET / N CANOES divider strip — matches the mock-up's section header.
          On the right we add a CanoeViewPicker (1/2/4). All modes render the
          whole fleet and let the page scroll vertically. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 4px 10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.6px', color: '#717171', textTransform: 'uppercase' }}>Fleet</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0,0,0,.08)' }} />
        <CanoeViewPicker value={canoeView} onChange={(v) => setCanoeView(v)} />
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.6px', color: '#717171', textTransform: 'uppercase' }}>
          {canoes?.length ?? 0} {(canoes?.length ?? 0) === 1 ? 'Canoe' : 'Canoes'}
        </span>
      </div>
      {/* Grid layout: 1/2/4 fixed columns, entire fleet rendered, page
          handles vertical scroll. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns:
          canoeView === '1' ? 'minmax(0, 1fr)'
          : canoeView === '2' ? 'repeat(2, minmax(0, 1fr))'
          : 'repeat(4, minmax(0, 1fr))',
        gridAutoRows: canoeView === '4' ? 'min-content' : undefined,
        gap: canoeView === '4' ? '6px' : '8px',
        padding: `4px 0 16px`,
      }}>
      {canoes?.map((canoe) => {
        const canoeEventAssignments = canoeAssignmentsByCanoe.get(canoe.id) || [];
        return (
          <div
            key={canoe._id.toString()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: canoeView === '4' ? '8px 6px 6px' : '10px 10px 8px',
              boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.04), 0 8px 20px rgba(0,0,0,.06)',
              minWidth: 0,
            }}
          >
            {/* Header row: canoe-hull icon · Hawaiian name (big serif) over
                designation · fill count ... 6-bar status strip · lock icon.
                Mirrors the mock's CanoeCard header. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 2px', marginBottom: '4px', position: 'relative' }}>
              {/* Canoe # badge — tappable, opens the designation picker.
                  Mirrors the Lokahi.html #N / #? pill from CanoeCard. */}
              {(() => {
                const designation = canoeDesignations[canoe.id] || '';
                // Strip a leading word like "RACE " so the badge shows just
                // the short token ("RACE 1" -> "1", "M" -> "M", "57" -> "57").
                const short = designation.replace(/^[A-Za-z]+\s+/, '').trim();
                const hasNum = short.length > 0;
                const isEditable = isAdmin && !lockedCanoes.has(canoe.id);
                // Numbered = solid black pill, white text, sized for up to
                // 3 chars (e.g. "700"). No "#" prefix — the black pill is
                // distinct enough on its own.
                // Unassigned = dashed neutral outline + grey "?" so admins
                // can still see which canoes need a # assigned.
                const badgeFs = short.length >= 3 ? 10 : short.length === 2 ? 12 : 13;
                return (
                  <button
                    type="button"
                    onClick={() => isEditable && setOpenDesignator(openDesignator === canoe.id ? null : canoe.id)}
                    disabled={!isEditable}
                    aria-label={hasNum ? `Canoe number ${designation}` : 'Assign canoe number'}
                    style={{
                      minWidth: 36, height: 22, flexShrink: 0,
                      borderRadius: 11,
                      border: hasNum ? 'none' : '1px dashed rgba(0,0,0,0.20)',
                      background: hasNum ? '#1a1a1a' : 'transparent',
                      color: hasNum ? '#ffffff' : '#9a9a9a',
                      fontWeight: 700,
                      fontSize: hasNum ? badgeFs : 11,
                      letterSpacing: hasNum ? 0 : '0.04em',
                      cursor: isEditable ? 'pointer' : 'default',
                      padding: '0 7px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                    }}
                  >
                    {hasNum ? short : '?'}
                  </button>
                );
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                {canoeView !== '4' && (
                  <span
                    style={{
                      fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
                      fontSize: '17px',
                      fontWeight: 600,
                      color: '#222222',
                      lineHeight: 1.1,
                      letterSpacing: '0.2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {canoe.name}
                  </span>
                )}
              </div>
              {/* Designation selector dropdown — Lokahi.html-style 5-col grid
                  with taken numbers dimmed and a Clear row at the bottom. */}
              {openDesignator === canoe.id && (
                <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setOpenDesignator(null)} />
                <div style={{ position: 'absolute', top: '100%', left: '4px', zIndex: 20, marginTop: 4 }}>
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(5, 34px)', gap: '4px', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,.08)' }}>
                    {CANOE_DESIGNATIONS.map(d => {
                      const isMine = canoeDesignations[canoe.id] === d;
                      const takenBy = Object.entries(canoeDesignations).find(([cid, v]) => v === d && cid !== canoe.id);
                      return (
                        <button
                          key={d}
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextDesignation = isMine ? '' : d;
                            updateDesignationMut({ canoeId: canoe.id, designation: nextDesignation });
                            // Auto-populate the canoe's name from the # mapping.
                            // Clearing the # also clears the name.
                            const nextName = nextDesignation
                              ? (CANOE_NAME_BY_DESIGNATION[nextDesignation] ?? '')
                              : '';
                            renameCanoeMut({ canoeId: canoe.id, name: nextName });
                            setOpenDesignator(null);
                          }}
                          style={{
                            width: 34, height: 34, borderRadius: 8,
                            border: `1px solid ${isMine ? '#b91c1c' : 'rgba(0,0,0,0.12)'}`,
                            background: isMine ? 'rgba(185,28,28,0.14)' : takenBy ? 'rgba(0,0,0,0.04)' : '#fff',
                            color: isMine ? '#b91c1c' : takenBy ? '#9a9a9a' : '#484848',
                            fontWeight: 700, fontSize: d.length >= 3 ? 11 : 14,
                            cursor: 'pointer', opacity: takenBy ? 0.5 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          }}
                        >
                          {d}
                        </button>
                      );
                    })}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const custom = prompt('Enter canoe designation:');
                        if (custom && custom.trim()) {
                          const d = custom.trim();
                          updateDesignationMut({ canoeId: canoe.id, designation: d });
                          // Custom # has no canonical name — pick a random
                          // unused Hawaiian name so the canoe still has one.
                          const mapped = CANOE_NAME_BY_DESIGNATION[d];
                          const takenNames = (canoes ?? []).map(c => c.name).filter(Boolean);
                          const nextName = mapped ?? pickFreshCanoeName(takenNames);
                          renameCanoeMut({ canoeId: canoe.id, name: nextName });
                        }
                        setOpenDesignator(null);
                      }}
                      style={{
                        width: 34, height: 34, borderRadius: 8,
                        border: '1px dashed rgba(0,0,0,0.20)',
                        background: 'transparent',
                        color: '#484848',
                        fontWeight: 700, fontSize: 16,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDesignationMut({ canoeId: canoe.id, designation: '' });
                        renameCanoeMut({ canoeId: canoe.id, name: '' });
                        setOpenDesignator(null);
                      }}
                      style={{
                        gridColumn: '1 / -1', padding: '6px 8px', marginTop: 2,
                        background: 'transparent', border: '1px dashed rgba(0,0,0,0.20)',
                        color: '#9a9a9a', fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      Clear #
                    </button>
                  </div>
                </div>
                </>
              )}
              {isAdmin && showCanoeChrome && <button
                type="button"
                onClick={() => setLockedCanoes(prev => {
                  const next = new Set(prev);
                  if (next.has(canoe.id)) next.delete(canoe.id);
                  else next.add(canoe.id);
                  return next;
                })}
                title={lockedCanoes.has(canoe.id) ? 'Unlock canoe' : 'Lock canoe'}
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${lockedCanoes.has(canoe.id) ? '#ed1c24' : 'rgba(0,0,0,.12)'}`,
                  background: lockedCanoes.has(canoe.id) ? 'rgba(237,28,36,0.10)' : 'transparent',
                  cursor: 'pointer', padding: 0, flexShrink: 0,
                }}
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke={lockedCanoes.has(canoe.id) ? '#ed1c24' : '#717171'}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  {lockedCanoes.has(canoe.id)
                    ? <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    : <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  }
                </svg>
              </button>}
              {isAdmin && showCanoeChrome && <button
                type="button"
                onClick={() => { if (!lockedCanoes.has(canoe.id)) handleRemoveCanoe(canoe.id); }}
                disabled={lockedCanoes.has(canoe.id)}
                title={lockedCanoes.has(canoe.id) ? 'Unlock canoe to delete' : 'Delete canoe'}
                aria-label="Delete canoe"
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(0,0,0,.12)',
                  background: 'transparent',
                  cursor: lockedCanoes.has(canoe.id) ? 'not-allowed' : 'pointer',
                  opacity: lockedCanoes.has(canoe.id) ? 0.4 : 1,
                  padding: 0, flexShrink: 0,
                }}
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="#717171"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>}
            </div>
            {/* 6 seats in a single vertical column. Each seat row gets a
                subtle dashed-border card treatment matching the Lokahi mock:
                dashed border + light tint when empty, red-solid border +
                red tint when the drop target is active, with the seat
                number colored red only when a paddler is seated. Paddlers
                get a small RC/CS/VC type tag on the right. */}
            <div style={{ padding: canoeView === '4' ? '0' : '0 2px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: canoeView === '4' ? '2px' : '3px' }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const seat = i + 1;
                const assignment = canoeEventAssignments.find(a => a.seat === seat);
                const assignedPaddler = assignment ? (canoeSortedPaddlers.find((p: Paddler) => p.id === assignment.paddlerId) || guestPaddlerMap.get(assignment.paddlerId)) : undefined;

                return (
                  <Droppable droppableId={`canoe-${canoe.id}-seat-${seat}`} key={seat} isDropDisabled={!isAdmin}>
                    {(provided, snapshot) => {
                      const active = snapshot.isDraggingOver;
                      const hasPaddler = !!assignedPaddler;
                      // Compose the paddler's seat label as "FirstnameL" (no
                      // space, no trailing period) — e.g. "SharinC" — so the
                      // name reads clean in the tight iPhone grid rows.
                      const pFirst = assignedPaddler?.firstName || '';
                      const pLi = (assignedPaddler?.lastInitial || assignedPaddler?.lastName?.[0] || '').toUpperCase();
                      const paddlerLabel = pFirst && pLi ? `${pFirst}${pLi}` : (pFirst || 'Guest');
                      const isGuest = assignedPaddler?.id?.startsWith('guest-');
                      const paddlerColor = isGuest
                        ? '#a07838'
                        : assignedPaddler?.gender === 'wahine'
                          ? '#a81a22'
                          : assignedPaddler?.gender === 'kane'
                            ? '#1f4e5e'
                            : '#2a2a2a';
                      // The Droppable is the outer seat cell. When a
                      // paddler is assigned, the WHOLE row becomes the
                      // Draggable wrapper — including the seat number —
                      // so pressing anywhere on the row (not just on the
                      // paddler name) grabs the paddler. This makes seat
                      // rows much easier to hit on iPhone.
                      const seatNumberStyle: React.CSSProperties = {
                        flexShrink: 0,
                        fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
                        fontSize: canoeView === '4' ? '13px' : '16px',
                        fontWeight: 600,
                        color: hasPaddler ? '#2a2a2a' : '#484848',
                        lineHeight: 1,
                        width: canoeView === '4' ? '10px' : '12px',
                        textAlign: 'right',
                      };
                      const rowInnerStyle: React.CSSProperties = {
                        display: 'flex',
                        alignItems: 'center',
                        gap: canoeView === '4' ? 2 : 3,
                        padding: canoeView === '4' ? '1px 3px' : '2px 4px',
                        borderRadius: 7,
                        background: active ? 'rgba(200,32,40,0.12)' : hasPaddler ? 'rgba(0,0,0,0.025)' : 'rgba(0,0,0,0.03)',
                        border: `1px ${active ? 'solid' : hasPaddler ? 'solid' : 'dashed'} ${active ? '#c82028' : hasPaddler ? 'transparent' : 'rgba(0,0,0,0.18)'}`,
                        transition: 'background 120ms ease, border-color 120ms ease',
                        minHeight: canoeView === '4' ? 22 : 26,
                        boxSizing: 'border-box',
                      };
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{ position: 'relative' }}
                        >
                          {assignedPaddler ? (
                            <Draggable draggableId={assignedPaddler.id} index={0} shouldRespectForcePress={false} isDragDisabled={!isAdmin}>
                              {(dp, dragSnapshot) => (
                                <div
                                  ref={dp.innerRef}
                                  {...dp.draggableProps}
                                  {...dp.dragHandleProps}
                                  tabIndex={-1}
                                  role="none"
                                  aria-roledescription=""
                                  style={{
                                    ...dp.draggableProps.style,
                                    ...rowInnerStyle,
                                    touchAction: 'manipulation',
                                    WebkitUserSelect: 'none',
                                    userSelect: 'none',
                                    cursor: !isAdmin ? 'default' : dragSnapshot.isDragging ? 'grabbing' : 'grab',
                                    visibility: (snapshot.isDraggingOver && !snapshot.draggingFromThisWith) ? 'hidden' : 'visible',
                                    width: '100%',
                                  }}
                                  data-animation-key={animationKey}
                                >
                                  <span style={seatNumberStyle}>{seat}</span>
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                                    <PaddlerChip
                                      label={paddlerLabel}
                                      color={paddlerColor}
                                      dims={canoeView === '4' ? SEAT_CHIP_DIMS_COMPACT : SEAT_CHIP_DIMS}
                                      flat
                                      isDragging={dragSnapshot.isDragging}
                                      title={assignedPaddler.firstName + (assignedPaddler.lastName ? ' ' + assignedPaddler.lastName : '')}
                                    />
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ) : (
                            <div style={rowInnerStyle}>
                              <span style={seatNumberStyle}>{seat}</span>
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                                {active ? (
                                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#c82028', fontStyle: 'italic', letterSpacing: '0.2px' }}>
                                    drop here
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'none' }}>{provided.placeholder}</div>
                        </div>
                      );
                    }}
                  </Droppable>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Ghost "add canoe" placeholder — sits at the end of the grid as an
          extra cell so scrolling to the bottom surfaces a big dashed card
          to tap. Admin-only; shown whether or not any canoes exist. */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => {
            // Blank name on add — the name is populated when the admin picks
            // a canoe # from the designation picker on the new card.
            handleAddCanoeAfter(canoes?.length ?? 0);
          }}
          title="Add canoe"
          aria-label="Add canoe"
          style={{
            minHeight: canoeView === '4' ? 140 : 200,
            width: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            padding: '18px',
            borderRadius: 14,
            border: '2px dashed rgba(0,0,0,.18)',
            background: 'rgba(0,0,0,0.025)',
            color: '#9a9a9a',
            cursor: 'pointer',
            transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#b91c1c';
            e.currentTarget.style.color = '#b91c1c';
            e.currentTarget.style.background = 'rgba(185,28,28,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,0,0,.18)';
            e.currentTarget.style.color = '#9a9a9a';
            e.currentTarget.style.background = 'rgba(0,0,0,0.025)';
          }}
        >
          <svg width={canoeView === '4' ? 28 : 36} height={canoeView === '4' ? 28 : 36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {canoeView !== '4' && (
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>Add canoe</span>
          )}
        </button>
      )}
      </div>{/* end fleet grid */}
    </div>
      ); })()}
    </>
  );
}
