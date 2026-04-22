import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { CanoeViewPicker, type CanoeView } from "./components/CanoeViewPicker";
import type { Paddler, Canoe, CanoeSortItem } from "./types";
import { CANOE_DESIGNATIONS, CANOE_NAME_BY_DESIGNATION } from "./utils";
import { pickFreshCanoeName } from "./canoeNames";
import { PaddlerChip, SEAT_CHIP_DIMS, SEAT_CHIP_DIMS_COMPACT } from "./PaddlerChip";

// Animated counter — plays a small slide-in when the value changes,
// direction based on whether it went up or down. The number is wrapped
// in an overflow:hidden inline-block so the translate effect stays
// within its own box.
function AnimatedNumber({ value }: { value: number }) {
  const prevRef = useRef<number>(value);
  const direction =
    value > prevRef.current ? 'up' : value < prevRef.current ? 'down' : null;
  useEffect(() => { prevRef.current = value; }, [value]);
  // No outer wrapper — inline-block with overflow:hidden broke baseline
  // alignment with adjacent text. The keyed span alone re-mounts on value
  // change, which replays the slide animation. The slide is only a few px
  // so clipping isn't needed.
  return (
    <span
      key={value}
      className={direction === 'up' ? 'count-roll-up' : direction === 'down' ? 'count-roll-down' : undefined}
      style={{ display: 'inline-block' }}
    >
      {value}
    </span>
  );
}

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
  /** When a paddler is being dragged from a seat, this is the id of the
   *  canoe they're dragging from — used to boost that canoe card's
   *  z-index so the pangea drag clone paints above later-in-DOM sibling
   *  canoes (fixes a mobile-only paint-order glitch where the clone
   *  would render *under* another canoe card). */
  draggingFromCanoeId?: string | null;
  /** Canoe the drag is currently HOVERING over. Used to pop that card
   *  above the On Shore drawer (which sits at zIndex 30) so the user
   *  can see the target seats clearly while the drawer would otherwise
   *  overlap them. */
  draggingOverCanoeId?: string | null;
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
  canoePriority, setCanoePriority, draggingFromCanoeId, draggingOverCanoeId,
  setScrollToEventId, setActivePage,
  windowWidth,
}: TodayViewProps) {
  const [openDesignator, setOpenDesignator] = useState<string | null>(null);
  // Anchor rect for the # cluster popover. Captured when a canoe's #
  // badge is clicked so we can render the popover via createPortal at
  // the document root — this avoids any parent stacking-context or
  // overflow:hidden ancestor clipping the menu (which was blocking the
  // first canoe's popover on certain layouts).
  const [designatorAnchor, setDesignatorAnchor] = useState<{
    left: number; top: number; width: number;
  } | null>(null);
  // Close the popover when the viewport resizes so its anchor math stays
  // honest; also refresh anchor on scroll so it tracks the button.
  useEffect(() => {
    if (!openDesignator) return;
    const onClose = () => setOpenDesignator(null);
    window.addEventListener('resize', onClose);
    return () => window.removeEventListener('resize', onClose);
  }, [openDesignator]);
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
      {/* Event info card — serif title + stacked date stamp, matches the mock.
          Warm cream→white gradient for subtle depth, plus breathe-in on mount. */}
      <div className="breathe-in" style={{ background: 'linear-gradient(180deg, #faf6ee 0%, #fcfaf5 55%, #ffffff 100%)', borderRadius: '14px', padding: '18px 20px 14px', marginBottom: '12px', boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.04), 0 8px 20px rgba(0,0,0,.06)', position: 'relative', zIndex: 20 }}>
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
              className="btn-zoom"
              onClick={(e) => { e.stopPropagation(); setShowGoingList(!showGoingList); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '999px',
                background: showGoingList ? 'rgba(0,82,128,0.08)' : '#faf9f7',
                border: `1px solid ${showGoingList ? '#005280' : 'rgba(0,0,0,.08)'}`,
                cursor: 'pointer', userSelect: 'none', flexShrink: 0,
              }}
            >
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#5a8a5f', boxShadow: '0 0 0 2px rgba(90,138,95,0.22)',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '12px', color: showGoingList ? '#005280' : '#222222', fontWeight: 600 }}>
                <AnimatedNumber value={_goingCount} /> going
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={showGoingList ? '#005280' : '#717171'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showGoingList ? 'rotate(90deg)' : 'none', transition: 'transform 160ms ease' }}>
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
            className="btn-zoom"
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
            className="btn-zoom"
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
              className="btn-zoom"
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
        <span className="live-dot" aria-hidden="true" />
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
      {canoes === undefined && (
        <>
          {[0, 1, 2, 3].map(i => (
            <div
              key={`canoe-skel-${i}`}
              style={{
                display: 'flex', flexDirection: 'column',
                backgroundColor: '#ffffff',
                borderRadius: 14,
                padding: canoeView === '4' ? '8px 6px 6px' : '10px 10px 8px',
                boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.04), 0 8px 20px rgba(0,0,0,.06)',
                minWidth: 0,
                gap: 6,
                minHeight: canoeView === '4' ? 140 : 200,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="shimmer" style={{ width: 14, height: 14, borderRadius: 3 }} />
                <div className="shimmer" style={{ width: '55%', height: 14 }} />
              </div>
              <div className="shimmer" style={{ width: '100%', height: 6, marginTop: 4 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {[0, 1, 2, 3, 4, 5].map(s => (
                  <div key={s} className="shimmer" style={{ width: '100%', height: canoeView === '4' ? 14 : 18 }} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      {canoes?.map((canoe, canoeIdx) => {
        const canoeEventAssignments = canoeAssignmentsByCanoe.get(canoe.id) || [];
        // Seat-fill flourish: when all 6 seats are filled the card takes on a
        // soft green halo in place of the neutral shadow, and the FULL badge
        // below pops in with a spring scale.
        const fillCount = canoeEventAssignments.length;
        const isFull = fillCount === 6;
        // Only the LAST canoe in the fleet shows an X delete button.
        // Removing canoes out of order would leave gaps / re-order the
        // line-up, so admins must delete from the end.
        const isLastCanoe = !!canoes && canoeIdx === canoes.length - 1;
        return (
          <div
            key={canoe._id.toString()}
            className="breathe-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: canoeView === '4' ? '8px 6px 6px' : '10px 10px 8px',
              boxShadow: isFull
                ? '0 0 0 1px rgba(47,122,71,0.35), 0 2px 6px rgba(47,122,71,0.10), 0 10px 28px rgba(47,122,71,0.18)'
                : '0 0 0 1px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.04), 0 8px 20px rgba(0,0,0,.06)',
              minWidth: 0,
              // Stagger the entry: each card delays 40ms more than the last,
              // capped at 8 cards so a huge fleet doesn't feel sluggish.
              animationDelay: `${Math.min(canoeIdx, 8) * 40}ms`,
              transition: 'box-shadow 320ms ease',
              // Paint-order fix + drag-over lift:
              // • SOURCE canoe (draggingFromCanoeId): bump z-index HIGH
              //   so the drag clone (a descendant of this card, at
              //   pangea's internal z-index ~5000 scoped to THIS card's
              //   stacking context) paints above every other card AND
              //   above the On Shore drawer (zIndex 30). The clone's
              //   effective stacking is capped by its source card's
              //   z-index — if anything else outranks the source, the
              //   clone gets painted UNDER that thing.
              // • OVER canoe (draggingOverCanoeId): lift above the On
              //   Shore drawer (30) so the user can see the target
              //   seats, but STAY BELOW the source card so we don't
              //   cover the drag clone. Only applied when the drag
              //   started from another canoe — when the drag started
              //   from On Shore the clone lives inside the drawer's
              //   stacking context (30), so lifting a canoe above the
              //   drawer would cover the clone.
              // Same canoe is both source and over (in-canoe swaps): the
              // source branch fires first, card ends up at 200.
              zIndex:
                draggingFromCanoeId === canoe.id ? 200 :
                draggingFromCanoeId && draggingOverCanoeId === canoe.id ? 100 :
                undefined,
            }}
          >
            {/* Seat-fill flourish — FULL pill pops in when all 6 seats are
                taken. Keying on isFull so it remounts (replaying the pop
                animation) whenever the canoe crosses back to full. */}
            {/* Seat-fill flourish — the green halo boxShadow on the card is
                the entire indicator; no separate badge. */}
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
                    className={isEditable ? "btn-zoom" : undefined}
                    onClick={(e) => {
                      if (!isEditable) return;
                      // Toggle closed if we're clicking the same canoe's
                      // badge while it's already open.
                      if (openDesignator === canoe.id) {
                        setOpenDesignator(null);
                        setDesignatorAnchor(null);
                        return;
                      }
                      // Capture the button's viewport-relative rect so the
                      // portal-rendered popover can anchor against it with
                      // position: fixed, escaping any parent stacking
                      // context / overflow clip.
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setDesignatorAnchor({ left: rect.left, top: rect.bottom, width: rect.width });
                      setOpenDesignator(canoe.id);
                    }}
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
              {/* Designation selector dropdown. Rendered via a portal to
                  document.body so parent overflow / stacking contexts
                  can't clip or obscure it (which was breaking the very
                  first canoe's popover). Cells are 40×40 for comfortable
                  tapping, with the taken-by short label under each in-use
                  number. Footer groups Custom and Clear as distinct pills
                  rather than reusing the cell style. */}
              {openDesignator === canoe.id && designatorAnchor && createPortal(
                (() => {
                  // Clamp the popover inside the viewport — on the
                  // leftmost canoe of a 4-col grid `anchor.left` can be
                  // near 0, and on the rightmost canoe the raw menu would
                  // overflow the right edge.
                  const menuWidth = 240;
                  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
                  const pad = 8;
                  let menuLeft = designatorAnchor.left;
                  if (menuLeft + menuWidth > vw - pad) menuLeft = vw - menuWidth - pad;
                  if (menuLeft < pad) menuLeft = pad;
                  const menuTop = designatorAnchor.top + 6;
                  return (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'transparent' }}
                        onClick={() => { setOpenDesignator(null); setDesignatorAnchor(null); }}
                      />
                      <div
                        role="dialog"
                        aria-label="Assign canoe number"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'fixed', top: menuTop, left: menuLeft, zIndex: 200,
                          width: menuWidth,
                          backgroundColor: '#ffffff',
                          borderRadius: 14,
                          padding: 10,
                          boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
                          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '2px 4px 8px',
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#717171', textTransform: 'uppercase' }}>
                            Canoe #
                          </span>
                          <span style={{ fontSize: 11, color: '#9a9a9a' }}>
                            {canoeDesignations[canoe.id] ? `currently ${canoeDesignations[canoe.id]}` : 'unassigned'}
                          </span>
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, 40px)',
                          gap: 6,
                          justifyContent: 'center',
                        }}>
                          {CANOE_DESIGNATIONS.map(d => {
                            const isMine = canoeDesignations[canoe.id] === d;
                            const takenEntry = Object.entries(canoeDesignations).find(([cid, v]) => v === d && cid !== canoe.id);
                            const takenByCanoe = takenEntry ? (canoes ?? []).find(c => c.id === takenEntry[0]) : undefined;
                            // Always show a canoe name under every # button.
                            // If the # is currently taken by another canoe,
                            // show that canoe's actual name (admin may have
                            // customized it). Otherwise fall back to the
                            // canonical mapping from CANOE_NAME_BY_DESIGNATION.
                            const canonicalName = CANOE_NAME_BY_DESIGNATION[d] ?? '';
                            const nameLabel = takenByCanoe?.name
                              ? takenByCanoe.name.slice(0, 4)
                              : canonicalName
                                ? canonicalName.slice(0, 4)
                                : (takenEntry ? '—' : '');
                            return (
                              <button
                                key={d}
                                type="button"
                                // A canoe # can only be assigned to one
                                // canoe at a time — so if another canoe
                                // already has this #, disable the button.
                                // The admin has to clear the other canoe's
                                // # first (via Clear # on that canoe) to
                                // free it up.
                                className={takenEntry && !isMine ? undefined : "btn-zoom"}
                                disabled={!!takenEntry && !isMine}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (takenEntry && !isMine) return;
                                  const nextDesignation = isMine ? '' : d;
                                  updateDesignationMut({ canoeId: canoe.id, designation: nextDesignation });
                                  const nextName = nextDesignation
                                    ? (CANOE_NAME_BY_DESIGNATION[nextDesignation] ?? '')
                                    : '';
                                  renameCanoeMut({ canoeId: canoe.id, name: nextName });
                                  setOpenDesignator(null);
                                  setDesignatorAnchor(null);
                                }}
                                title={takenEntry ? `Currently on ${takenByCanoe?.name ?? 'another canoe'} — clear its # first` : d}
                                style={{
                                  width: 40, height: 40, borderRadius: 10,
                                  border: `1px solid ${isMine ? '#b91c1c' : 'rgba(0,0,0,0.10)'}`,
                                  background: isMine ? '#b91c1c' : '#ffffff',
                                  color: isMine ? '#ffffff' : takenEntry ? '#b0b0b0' : '#222222',
                                  fontWeight: 700,
                                  fontSize: d.length >= 3 ? 12 : 15,
                                  cursor: takenEntry && !isMine ? 'not-allowed' : 'pointer',
                                  opacity: takenEntry && !isMine ? 0.55 : 1,
                                  display: 'flex', flexDirection: 'column',
                                  alignItems: 'center', justifyContent: 'center',
                                  padding: 0, gap: 1,
                                  transition: 'background 100ms ease, color 100ms ease, border-color 100ms ease',
                                  boxShadow: isMine ? '0 1px 2px rgba(185,28,28,0.25)' : 'none',
                                }}
                              >
                                <span style={{ lineHeight: 1 }}>{d}</span>
                                {nameLabel && (
                                  <span style={{
                                    fontSize: 8, fontWeight: 500, lineHeight: 1, letterSpacing: 0,
                                    color: isMine
                                      ? 'rgba(255,255,255,0.85)'
                                      : takenEntry
                                        ? '#b0b0b0'
                                        : '#9a9a9a',
                                  }}>
                                    {nameLabel}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button
                            type="button"
                            className="btn-zoom"
                            onClick={(e) => {
                              e.stopPropagation();
                              const custom = prompt('Enter canoe designation:');
                              if (custom && custom.trim()) {
                                const d = custom.trim();
                                updateDesignationMut({ canoeId: canoe.id, designation: d });
                                const mapped = CANOE_NAME_BY_DESIGNATION[d];
                                const takenNames = (canoes ?? []).map(c => c.name).filter(Boolean);
                                const nextName = mapped ?? pickFreshCanoeName(takenNames);
                                renameCanoeMut({ canoeId: canoe.id, name: nextName });
                              }
                              setOpenDesignator(null);
                              setDesignatorAnchor(null);
                            }}
                            style={{
                              flex: 1, height: 32, borderRadius: 8,
                              border: '1px solid rgba(0,0,0,0.12)',
                              background: '#ffffff', color: '#484848',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            }}
                          >
                            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Custom
                          </button>
                          <button
                            type="button"
                            className={canoeDesignations[canoe.id] ? "btn-zoom" : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDesignationMut({ canoeId: canoe.id, designation: '' });
                              renameCanoeMut({ canoeId: canoe.id, name: '' });
                              setOpenDesignator(null);
                              setDesignatorAnchor(null);
                            }}
                            disabled={!canoeDesignations[canoe.id]}
                            style={{
                              flex: 1, height: 32, borderRadius: 8,
                              border: '1px solid rgba(185,28,28,0.25)',
                              background: canoeDesignations[canoe.id] ? 'rgba(185,28,28,0.06)' : 'transparent',
                              color: canoeDesignations[canoe.id] ? '#b91c1c' : '#c0c0c0',
                              fontSize: 12, fontWeight: 600,
                              cursor: canoeDesignations[canoe.id] ? 'pointer' : 'not-allowed',
                            }}
                          >
                            Clear #
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })(),
                document.body,
              )}
              {isAdmin && showCanoeChrome && <button
                type="button"
                className="btn-zoom-sm"
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
              {isAdmin && showCanoeChrome && isLastCanoe && <button
                type="button"
                className={lockedCanoes.has(canoe.id) ? undefined : "btn-zoom-sm"}
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
            {/* Seats column: the flex gap that used to sit BETWEEN rows
                is now absorbed as internal padding on each Droppable
                (see seatHitPad below). This removes the hit-test dead
                zone between rows that made dragging a paddler onto an
                already-occupied seat feel sticky — the user had to
                "aim around" the existing paddler because between-row
                space belonged to no Droppable. With gap: 0 and internal
                padding, adjacent Droppables touch edge-to-edge and the
                cursor is always inside some Droppable's hit box. */}
            <div style={{ padding: canoeView === '4' ? '0' : '0 2px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>
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
                      // The seat number belongs to the SLOT (Droppable),
                      // not to the paddler (Draggable), so it's rendered
                      // outside the Draggable and absolute-positioned
                      // over the row. Two wins: (1) the dragged clone is
                      // just the paddler chip — the seat # doesn't ride
                      // along with the cursor. (2) the seat # stays
                      // visible in its slot even while the paddler is
                      // mid-drag. pointer-events: none so clicks/taps
                      // on the number area pass through to the Draggable
                      // beneath, preserving whole-row hit targeting.
                      const seatNumColWidth = canoeView === '4' ? 10 : 12;
                      const seatNumPad = canoeView === '4' ? 3 : 4;
                      const seatNumGap = canoeView === '4' ? 2 : 3;
                      const seatNumberStyle: React.CSSProperties = {
                        position: 'absolute',
                        left: seatNumPad,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        zIndex: 1,
                        fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
                        fontSize: canoeView === '4' ? '13px' : '16px',
                        fontWeight: 600,
                        color: hasPaddler ? '#2a2a2a' : '#484848',
                        lineHeight: 1,
                        width: seatNumColWidth,
                        textAlign: 'right',
                      };
                      // Seat row height is sized to the FILLED state so
                      // empty + filled rows render at the same height and
                      // the canoe doesn't shift when a paddler is dropped
                      // in. A filled row contains a PaddlerChip with its
                      // own minHeight (SEAT_CHIP_DIMS.minH = 28 regular,
                      // SEAT_CHIP_DIMS_COMPACT.minH = 22 compact), and
                      // because box-sizing is border-box the row's
                      // minHeight must equal chip.minH + row-padding-y +
                      // row-border-y so the chip fits without pushing the
                      // row taller. Regular: 28 + 4 + 2 = 34. Compact:
                      // 22 + 2 + 2 = 26.
                      //
                      // paddingLeft reserves space for the absolute-
                      // positioned seat number: seat-num-pad + seat-num-
                      // width + seat-num-gap. Without this, the chip
                      // would overlap the seat #.
                      const rowInnerStyle: React.CSSProperties = {
                        display: 'flex',
                        alignItems: 'center',
                        paddingTop: canoeView === '4' ? 1 : 2,
                        paddingBottom: canoeView === '4' ? 1 : 2,
                        paddingLeft: seatNumPad + seatNumColWidth + seatNumGap,
                        paddingRight: seatNumPad,
                        borderRadius: 7,
                        background: active ? 'rgba(200,32,40,0.18)' : hasPaddler ? 'rgba(0,0,0,0.025)' : 'rgba(0,0,0,0.03)',
                        border: `1px ${active ? 'solid' : hasPaddler ? 'solid' : 'dashed'} ${active ? '#c82028' : hasPaddler ? 'transparent' : 'rgba(0,0,0,0.18)'}`,
                        // Louder drop affordance when a paddler is being
                        // dragged over this seat: outline + soft red halo
                        // so the target is unmissable even when the
                        // dragged preview is partially covering the row.
                        // Use outline (not a thicker border) so the row's
                        // border-box height doesn't jump mid-drag.
                        outline: active ? '2px solid #c82028' : 'none',
                        outlineOffset: active ? '-1px' : '0',
                        boxShadow: active ? '0 0 0 4px rgba(200,32,40,0.16)' : 'none',
                        transition: 'background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, outline-color 120ms ease',
                        minHeight: canoeView === '4' ? 26 : 34,
                        boxSizing: 'border-box',
                      };
                      // Half the former flex-gap becomes padding at the
                      // top and bottom of each Droppable, so adjacent
                      // Droppables meet edge-to-edge. The visual row
                      // (rowInnerStyle) stays the same size inside; only
                      // the hit box grows. Without this, the cursor
                      // crossing the ~3px gap between rows landed in a
                      // no-Droppable dead zone, which is what made
                      // dragging onto an occupied seat feel like you
                      // had to go AROUND the existing paddler.
                      const seatHitPad = canoeView === '4' ? 1 : 1.5;
                      // Dim the sitting paddler when a DIFFERENT paddler is
                      // being dragged over this seat, so the swap target is
                      // obvious. draggingOverWith is the id of the dragged
                      // item when it's over this (outer) Droppable; if it
                      // equals the sitting paddler's id, the sitting paddler
                      // is being dragged over its own seat, so don't dim.
                      const overWith = snapshot.draggingOverWith;
                      const someoneElseOver = !!(snapshot.isDraggingOver && overWith && overWith !== assignedPaddler?.id);
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            position: 'relative',
                            paddingTop: seatHitPad,
                            paddingBottom: seatHitPad,
                          }}
                        >
                          {/* Seat # is rendered here (a sibling of the
                              Draggable, not a child) so it stays anchored
                              to the slot when a paddler is dragged out.
                              pointer-events: none so the number doesn't
                              intercept taps — the whole row (including
                              the number's visual column) remains a single
                              grab target for the Draggable beneath. */}
                          <span style={seatNumberStyle}>{seat}</span>
                          {/* Visual drop-target row — ALWAYS a flow element
                              (never a Draggable), so the outer Droppable
                              `canoe-X-seat-Y` is always a Draggable-free
                              list from pangea's perspective. This is the
                              key fix for drop-over-occupied-seat feeling
                              sticky: when a Droppable contains a Draggable,
                              pangea treats it as a reorderable list and
                              runs insertion-index displacement math on the
                              sitting paddler as the cursor moves over it.
                              By moving the sitting Draggable into a
                              SEPARATE drop-disabled Droppable below
                              (paddler-host-...), dropping onto an occupied
                              seat looks identical to dropping onto an
                              empty seat from pangea's perspective. */}
                          <div style={rowInnerStyle}>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }} />
                          </div>
                          {/* Paddler overlay — absolute over the visual
                              row. Its Droppable is drop-DISABLED so pangea
                              never considers it a drop target and never
                              runs list-reorder math on the Draggable
                              inside. The Draggable still lifts/moves
                              normally when grabbed; drops from elsewhere
                              pass through to the outer Droppable. */}
                          {assignedPaddler && (
                            // KEY by paddler id (not seat) so that when a
                            // swap changes the occupant of this seat,
                            // React fully unmounts the old paddler-host +
                            // its Draggable and mounts a fresh pair.
                            // Without a key here React reuses the same
                            // Draggable instance across the swap (only
                            // the draggableId prop changes), and pangea
                            // ends up with stale internal state on the
                            // reused instance — manifests as the
                            // swapped-in paddler being un-grabbable.
                            // pangea's docs explicitly recommend keying
                            // each Draggable by its draggableId for
                            // exactly this reason.
                            <Droppable
                              key={assignedPaddler.id}
                              droppableId={`paddler-host-canoe-${canoe.id}-seat-${seat}`}
                              isDropDisabled={true}
                            >
                              {(hostProvided) => (
                                <div
                                  ref={hostProvided.innerRef}
                                  {...hostProvided.droppableProps}
                                  style={{
                                    position: 'absolute',
                                    top: seatHitPad,
                                    bottom: seatHitPad,
                                    left: 0,
                                    right: 0,
                                    // pointer-events: none so the wrapper
                                    // doesn't swallow clicks outside the
                                    // Draggable. The Draggable re-enables
                                    // pointer-events below so it stays
                                    // grab-able.
                                    pointerEvents: 'none',
                                    display: 'flex',
                                  }}
                                >
                                  <Draggable key={assignedPaddler.id} draggableId={assignedPaddler.id} index={0} shouldRespectForcePress={false} isDragDisabled={!isAdmin}>
                                    {(dp, dragSnapshot) => (
                                      <div
                                        ref={dp.innerRef}
                                        {...dp.draggableProps}
                                        {...dp.dragHandleProps}
                                        tabIndex={-1}
                                        role="none"
                                        aria-roledescription=""
                                        // dp.draggableProps.style MUST come last:
                                        // pangea drives the drop animation via
                                        // `transition: transform ...` on this
                                        // element and listens for the
                                        // transform transition-end to dispatch
                                        // DROP_COMPLETE. If our transition were
                                        // spread after, it'd clobber pangea's
                                        // and drops would hang. The on-shore
                                        // size overrides go AFTER pangea's
                                        // style so we can override the
                                        // captured width/height mid-drag.
                                        style={(() => {
                                          // Drag clone should look like a
                                          // seat-row CARD (full seat width,
                                          // white bg, lifted shadow) when
                                          // hovering over the canoe fleet, and
                                          // collapse to a plain paddler chip
                                          // when hovering over the on-shore
                                          // area — matching the destination's
                                          // native size so it's obvious what
                                          // shape the paddler will land as.
                                          // `draggingOver` is the droppableId
                                          // under the cursor, null when over
                                          // a non-droppable region.
                                          const over = dragSnapshot.draggingOver;
                                          const isOverStaging = dragSnapshot.isDragging && !!over && over.startsWith('staging-');
                                          const isDraggingAsCard = dragSnapshot.isDragging && !isOverStaging;
                                          return {
                                            display: 'flex',
                                            alignItems: 'center',
                                            paddingTop: canoeView === '4' ? 1 : 2,
                                            paddingBottom: canoeView === '4' ? 1 : 2,
                                            paddingLeft: seatNumPad + seatNumColWidth + seatNumGap,
                                            paddingRight: seatNumPad,
                                            minHeight: canoeView === '4' ? 26 : 34,
                                            boxSizing: 'border-box' as const,
                                            // When NOT dragging: transparent —
                                            // the visual row below this layer
                                            // provides the idle affordance.
                                            // When dragging over the canoe
                                            // fleet: tint the card with the
                                            // paddler's gender color so the
                                            // drag clone reads as ONE unified
                                            // card (no nested white pill
                                            // against a white card). Alpha
                                            // hex `1A` (~10%) is the soft
                                            // background tint, `66` (~40%)
                                            // gives a visible matching border.
                                            // Over on-shore: transparent so
                                            // only the chip shows.
                                            background: isDraggingAsCard ? `${paddlerColor}1A` : 'transparent',
                                            border: isDraggingAsCard
                                              ? `1px solid ${paddlerColor}66`
                                              : '1px solid transparent',
                                            borderRadius: 7,
                                            boxShadow: isDraggingAsCard
                                              ? '0 10px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)'
                                              : 'none',
                                            touchAction: 'manipulation' as const,
                                            WebkitUserSelect: 'none' as const,
                                            userSelect: 'none' as const,
                                            cursor: !isAdmin ? 'default' : dragSnapshot.isDragging ? 'grabbing' : 'grab',
                                            opacity: (someoneElseOver && !dragSnapshot.isDragging) ? 0.3 : 1,
                                            width: '100%',
                                            pointerEvents: 'auto' as const,
                                            ...dp.draggableProps.style,
                                            // Over the on-shore area: shrink
                                            // the lifted footprint to just
                                            // the chip. Pangea captured the
                                            // full seat width/height at drag
                                            // start; overriding AFTER
                                            // dp.draggableProps.style lets us
                                            // collapse to the native chip
                                            // size while keeping pangea's
                                            // position:fixed + transform.
                                            ...(isOverStaging ? {
                                              width: 'auto' as const,
                                              minHeight: 0,
                                              paddingLeft: 0,
                                              paddingRight: 0,
                                              paddingTop: 0,
                                              paddingBottom: 0,
                                              background: 'transparent',
                                              border: '1px solid transparent',
                                              boxShadow: 'none',
                                            } : {}),
                                          };
                                        })()}
                                        data-animation-key={animationKey}
                                      >
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                                          <PaddlerChip
                                            label={paddlerLabel}
                                            color={paddlerColor}
                                            dims={canoeView === '4' ? SEAT_CHIP_DIMS_COMPACT : SEAT_CHIP_DIMS}
                                            flat
                                            // Only light up the chip's own
                                            // dragging pill (white bg + ring)
                                            // when it IS the visible drag
                                            // clone — over the on-shore area.
                                            // When dragging over the canoe
                                            // fleet the OUTER card is the
                                            // drag clone, so keep the chip
                                            // flat (just the colored name)
                                            // to avoid a nested pill.
                                            isDragging={dragSnapshot.isDragging && !!dragSnapshot.draggingOver && dragSnapshot.draggingOver.startsWith('staging-')}
                                            // Non-admin: chip is a static
                                            // label, no hover/press visuals
                                            // and no grab cursor.
                                            interactive={isAdmin}
                                            title={assignedPaddler.firstName + (assignedPaddler.lastName ? ' ' + assignedPaddler.lastName : '')}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                  <div style={{ display: 'none' }}>{hostProvided.placeholder}</div>
                                </div>
                              )}
                            </Droppable>
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
